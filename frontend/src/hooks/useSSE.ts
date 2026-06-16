import { useEffect, useRef, useCallback } from 'react'
import { supabase } from '../lib/supabaseClient'
import { createSSEConnection, type SSEEvent } from '../lib/sseClient'
import { useSessionStore } from '../store/sessionStore'
import { useArtifactStore } from '../store/artifactStore'

export function useSSE(sessionId: string | null) {
  const cleanupRef = useRef<(() => void) | null>(null)
  const { addTrace, addSuggestion, setStatus } = useSessionStore()
  const { setArtifact } = useArtifactStore()

  const connect = useCallback(
    async (sid: string) => {
      const { data } = await supabase.auth.getSession()
      const token = data.session?.access_token || 'demo_token'

      cleanupRef.current = createSSEConnection(
        sid,
        token,
        (evt: SSEEvent) => {
          if (evt.type === 'trace' && evt.message) {
            addTrace(evt.message)
          }
          if (evt.type === 'suggestion') {
            addSuggestion({
              id: evt.id || `sug-${Date.now()}`,
              description: evt.description || '',
              patch: (evt.patch as Record<string, unknown>) || {},
            })
          }
          if (evt.type === 'artifact' && evt.kind) {
            setArtifact(evt.kind, evt.payload)
          }
          if (evt.type === 'error') {
            setStatus('error')
          }
        },
        () => setStatus('complete'),
        () => setStatus('error')
      )
    },
    [addTrace, addSuggestion, setArtifact, setStatus]
  )

  useEffect(() => {
    if (sessionId) {
      connect(sessionId)
    }
    return () => {
      cleanupRef.current?.()
    }
  }, [sessionId, connect])
}
