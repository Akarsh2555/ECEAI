import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Suggestion, TraceEntry, SessionStatus } from '../types/agent'

interface SessionState {
  sessionId: string | null
  status: SessionStatus
  traces: TraceEntry[]
  suggestions: Suggestion[]
  userMessage: string

  setSessionId: (id: string | null) => void
  setStatus: (status: SessionStatus) => void
  setUserMessage: (msg: string) => void
  addTrace: (message: string, nodeType?: string) => void
  addSuggestion: (suggestion: Omit<Suggestion, 'status'>) => void
  updateSuggestionStatus: (id: string, status: 'accepted' | 'rejected') => void
  clearSession: () => void
}

let traceCounter = 0

// Unique even across page reloads: the module-level counter resets to 0 on
// reload, but persisted traces are rehydrated from localStorage — so a bare
// counter would re-mint `trace-1` and collide. Mix in a per-load random seed.
const traceSeed = Math.random().toString(36).slice(2, 8)
const genTraceId = () =>
  typeof crypto !== 'undefined' && crypto.randomUUID
    ? `trace-${crypto.randomUUID()}`
    : `trace-${traceSeed}-${++traceCounter}`

export const useSessionStore = create<SessionState>()(
  persist(
    (set) => ({
      sessionId: null,
  status: 'idle',
  traces: [],
  suggestions: [],
  userMessage: '',

  setSessionId: (id) => set({ sessionId: id }),

  setStatus: (status) => set({ status }),

  setUserMessage: (msg) => set({ userMessage: msg }),

  addTrace: (message, nodeType) =>
    set((s) => {
      if (message.startsWith('[chat_responder]')) {
        const last = s.traces[s.traces.length - 1]
        if (last && last.message.startsWith('[chat_responder]')) {
          const updated = [...s.traces]
          updated[updated.length - 1] = { ...last, message }
          return { traces: updated }
        }
      }
      return {
        traces: [
          ...s.traces,
          {
            id: genTraceId(),
            message,
            timestamp: Date.now(),
            nodeType,
          },
        ],
      }
    }),

  appendChatChunk: (chunk: string) =>
    set((s) => {
      const traces = [...s.traces]
      const last = traces[traces.length - 1]
      if (last && last.message.startsWith('[chat_responder]')) {
        traces[traces.length - 1] = { ...last, message: last.message + chunk }
      } else {
        traces.push({
          id: genTraceId(),
          message: `[chat_responder] ${chunk}`,
          timestamp: Date.now(),
        })
      }
      return { traces }
    }),

  addSuggestion: (suggestion) =>
    set((s) => ({
      suggestions: [
        ...s.suggestions,
        { ...suggestion, id: suggestion.id || `sug-${Date.now()}`, status: 'pending' as const },
      ],
      status: 'awaiting_approval',
    })),

  updateSuggestionStatus: (id, status) =>
    set((s) => ({
      suggestions: s.suggestions.map((sg) =>
        sg.id === id ? { ...sg, status } : sg
      ),
    })),

  clearSession: () =>
    set({
      sessionId: null,
      status: 'idle',
      traces: [],
      suggestions: [],
      userMessage: '',
    }),
    }),
    {
      name: 'ece-copilot-session-storage',
    }
  )
)
