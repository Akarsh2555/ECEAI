import { Check, X } from 'lucide-react'
import { useSessionStore } from '../../store/sessionStore'
import { useAuth } from '../../hooks/useAuth'
import { apiClient } from '../../lib/apiClient'
import type { Suggestion } from '../../types/agent'
import { Button } from '../shared/Button'

interface SuggestionCardProps {
  suggestion: Suggestion
}

export function SuggestionCard({ suggestion }: SuggestionCardProps) {
  const { updateSuggestionStatus } = useSessionStore()
  const sessionId = useSessionStore((s) => s.sessionId)
  const { getToken } = useAuth()

  const handleAction = async (action: 'accepted' | 'rejected') => {
    updateSuggestionStatus(suggestion.id, action)
    try {
      const token = await getToken()
      if (sessionId && token) {
        const approved = action === 'accepted' ? [suggestion.id] : []
        const rejected = action === 'rejected' ? [suggestion.id] : []
        await apiClient.approveSuggestions(sessionId, approved, rejected, token)
      }
    } catch { /* Status already updated locally */ }
  }

  return (
    // Review card — "thinking" peach from the AI timeline palette, hairline only.
    <div
      className="animate-slide-in p-3 rounded-lg"
      style={{ backgroundColor: '#dfa88f0d', border: '1px solid #dfa88f33' }}
    >
      <span className="eyebrow-mono inline-block mb-1.5" style={{ color: '#dfa88f' }}>
        Suggestion
      </span>
      <p className="text-xs text-slate-300 mb-3 leading-relaxed">{suggestion.description}</p>
      <div className="flex gap-2">
        <Button size="sm" variant="success" icon={<Check size={12} />} onClick={() => handleAction('accepted')}>Accept</Button>
        <Button size="sm" variant="danger" icon={<X size={12} />} onClick={() => handleAction('rejected')}>Reject</Button>
      </div>
    </div>
  )
}
