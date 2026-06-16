export type SSEEventType = 'trace' | 'suggestion' | 'artifact' | 'done' | 'error'

export interface SSEEvent {
  type: SSEEventType
  message?: string
  id?: string
  description?: string
  patch?: Record<string, unknown>
  kind?: string
  payload?: unknown
}

const MAX_RECONNECT_ATTEMPTS = 5
const BASE_RECONNECT_DELAY_MS = 1000

/**
 * Creates an SSE connection to the LangGraph streaming endpoint.
 * Includes exponential backoff reconnection logic.
 * Returns a cleanup function to close the connection.
 */
export function createSSEConnection(
  sessionId: string,
  token: string,
  onEvent: (evt: SSEEvent) => void,
  onDone: () => void,
  onError: (err: Event) => void
): () => void {
  let reconnectAttempts = 0
  let es: EventSource | null = null
  let closed = false

  function connect() {
    if (closed) return

    const url = `${import.meta.env.VITE_BACKEND_URL}/api/stream/${sessionId}?token=${token}`
    es = new EventSource(url)

    es.onopen = () => {
      // Reset reconnect counter on successful connection
      reconnectAttempts = 0
    }

    es.onmessage = (e) => {
      try {
        const parsed: SSEEvent = JSON.parse(e.data)
        onEvent(parsed)
        if (parsed.type === 'done') {
          es?.close()
          onDone()
        }
      } catch {
        // Ignore malformed events
      }
    }

    es.onerror = (err) => {
      es?.close()

      if (closed) return

      if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
        const delay = BASE_RECONNECT_DELAY_MS * Math.pow(2, reconnectAttempts)
        reconnectAttempts++
        setTimeout(connect, delay)
      } else {
        onError(err)
      }
    }
  }

  connect()

  return () => {
    closed = true
    es?.close()
  }
}
