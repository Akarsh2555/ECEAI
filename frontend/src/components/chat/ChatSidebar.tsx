import { useState, useRef, useEffect } from 'react'
import { Send, Trash2, Bot } from 'lucide-react'
import { useSessionStore } from '../../store/sessionStore'
import { useCanvasStore } from '../../store/canvasStore'
import { useAuth } from '../../hooks/useAuth'
import { useSSE } from '../../hooks/useSSE'
import { apiClient } from '../../lib/apiClient'
import { TraceMessage } from './TraceMessage'
import { SuggestionCard } from './SuggestionCard'
import { AgentTypingIndicator } from './AgentTypingIndicator'
import { Button } from '../shared/Button'

interface ChatSidebarProps {
  designId: string | null
}

export function ChatSidebar({ designId }: ChatSidebarProps) {
  const [input, setInput] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  const { traces, suggestions, status, sessionId, setSessionId, setStatus, addTrace, clearSession } = useSessionStore()
  const { toNetlistJSON } = useCanvasStore()
  const { getToken } = useAuth()

  // Initialize SSE connection when we have a session
  useSSE(sessionId)

  // Auto-scroll to bottom on new traces
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [traces.length, suggestions.length])

  const handleSubmit = async () => {
    if (!input.trim() || submitting) return

    const message = input.trim()
    setInput('')
    setSubmitting(true)
    addTrace(`You: ${message}`)
    setStatus('running')

    try {
      const token = await getToken()
      const canvasJson = toNetlistJSON()

      const { session_id } = await apiClient.submitDesign(
        designId || 'untitled',
        canvasJson,
        message,
        token || '',
      )

      setSessionId(session_id)
    } catch (err) {
      addTrace(`⚠️ Backend unavailable (${err instanceof Error ? err.message : 'error'})`)
      setStatus('error')
    } finally {
      setSubmitting(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  return (
    <div className="w-80 bg-slate-900/80 backdrop-blur-sm border-l border-slate-800 flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <Bot size={16} className="text-indigo-400" />
          <span className="text-sm font-semibold text-slate-200">AI Copilot</span>
        </div>
        <div className="flex items-center gap-1">
          {status !== 'idle' && (
            // AI status pill — eyebrow mono + Cursor timeline pastels.
            <span
              className="eyebrow-mono inline-flex items-center px-2.5 py-1 rounded-full border"
              style={{
                color:
                  status === 'running' ? '#dfa88f'
                  : status === 'complete' ? '#00d992'
                  : status === 'error' ? '#cf2d56'
                  : '#9fbbe0',
                backgroundColor:
                  status === 'running' ? '#dfa88f14'
                  : status === 'complete' ? '#00d99214'
                  : status === 'error' ? '#cf2d5614'
                  : '#9fbbe014',
                borderColor:
                  status === 'running' ? '#dfa88f33'
                  : status === 'complete' ? '#00d99233'
                  : status === 'error' ? '#cf2d5633'
                  : '#9fbbe033',
              }}
            >
              {status.replace('_', ' ')}
            </span>
          )}
          <button
            onClick={clearSession}
            className="p-1.5 rounded-lg text-slate-600 hover:text-slate-400 hover:bg-slate-800 transition-colors"
            title="Clear session"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
        {traces.length === 0 && (
          <div className="text-center py-12">
            <Bot size={32} className="mx-auto text-slate-700 mb-3" />
            <p className="text-sm text-slate-500 mb-1">ECE Copilot ready</p>
            <p className="text-xs text-slate-600">
              Describe your circuit or ask a question
            </p>
          </div>
        )}

        {traces.map((trace) => (
          <TraceMessage key={trace.id} trace={trace} />
        ))}

        {suggestions
          .filter((s) => s.status === 'pending')
          .map((sug) => (
            <SuggestionCard key={sug.id} suggestion={sug} />
          ))}

        {status === 'running' && <AgentTypingIndicator />}
      </div>

      {/* Input */}
      <div className="p-3 border-t border-slate-800">
        <div className="flex gap-2">
          <textarea
            id="chat-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Describe your circuit..."
            rows={1}
            className="
              flex-1 px-3 py-2 bg-slate-800/50 border border-slate-700 rounded-lg
              text-sm text-slate-200 placeholder-slate-600 resize-none
              focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50
              transition-all
            "
          />
          <Button
            size="sm"
            onClick={handleSubmit}
            loading={submitting}
            disabled={!input.trim()}
            icon={<Send size={14} />}
          >
            Send
          </Button>
        </div>
      </div>
    </div>
  )
}
