const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000'

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'
  body?: unknown
  token?: string
  headers?: Record<string, string>
}

class ApiError extends Error {
  status: number
  detail: string

  constructor(status: number, detail: string) {
    super(detail)
    this.name = 'ApiError'
    this.status = status
    this.detail = detail
  }
}

/**
 * Typed fetch wrapper for FastAPI backend calls.
 * Automatically includes Authorization header when token is provided.
 */
async function request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, token, headers = {} } = options

  const config: RequestInit = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  }

  if (body && method !== 'GET') {
    config.body = JSON.stringify(body)
  }

  const response = await fetch(`${BACKEND_URL}${endpoint}`, config)

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({ detail: 'Unknown error' }))
    throw new ApiError(response.status, errorBody.detail || `HTTP ${response.status}`)
  }

  return response.json() as Promise<T>
}

export const apiClient = {
  get: <T>(endpoint: string, token?: string) =>
    request<T>(endpoint, { method: 'GET', token }),

  post: <T>(endpoint: string, body: unknown, token?: string) =>
    request<T>(endpoint, { method: 'POST', body, token }),

  put: <T>(endpoint: string, body: unknown, token?: string) =>
    request<T>(endpoint, { method: 'PUT', body, token }),

  delete: <T>(endpoint: string, token?: string) =>
    request<T>(endpoint, { method: 'DELETE', token }),

  /** Submit a design to the LangGraph orchestrator */
  submitDesign: (designId: string, canvasJson: unknown, userMessage: string, token: string) =>
    request<{ session_id: string }>('/api/design/submit', {
      method: 'POST',
      body: { design_id: designId, canvas_json: canvasJson, user_message: userMessage },
      token,
    }),

  /** Approve/reject suggestions from HITL */
  approveSuggestions: (sessionId: string, approvedIds: string[], rejectedIds: string[], token: string) =>
    request<{ status: string }>('/api/design/approve', {
      method: 'POST',
      body: { session_id: sessionId, approved_ids: approvedIds, rejected_ids: rejectedIds },
      token,
    }),
}

export { ApiError }
