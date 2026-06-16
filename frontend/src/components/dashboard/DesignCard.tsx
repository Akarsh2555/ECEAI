import { Badge } from '../shared/Badge'
import { Clock, GitFork, Trash2, ArrowRight } from 'lucide-react'
import type { DesignRow } from '../../types/supabase'

interface DesignCardProps {
  design: DesignRow
  onOpen: () => void
  onFork: () => void
  onDelete: () => void
}

const DOMAIN_BADGE: Record<string, 'digital' | 'analog' | 'signal'> = {
  digital: 'digital',
  analog: 'analog',
  signal: 'signal',
}

export function DesignCard({ design, onOpen, onFork, onDelete }: DesignCardProps) {
  const timeAgo = getTimeAgo(design.updated_at)

  return (
    <div className="glass-card p-4 group hover:border-slate-600 transition-all duration-200 cursor-pointer" onClick={onOpen}>
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-slate-200 truncate">{design.title}</h3>
          <div className="flex items-center gap-2 mt-1">
            <Badge variant={DOMAIN_BADGE[design.domain] || 'default'}>{design.domain}</Badge>
            <span className="flex items-center gap-1 text-[10px] text-slate-500">
              <Clock size={10} /> {timeAgo}
            </span>
          </div>
        </div>
        <ArrowRight size={14} className="text-slate-600 group-hover:text-indigo-400 transition-colors mt-1" />
      </div>

      {/* Actions */}
      <div className="flex gap-2 mt-3 pt-3 border-t border-slate-800/50" onClick={(e) => e.stopPropagation()}>
        <button onClick={onFork} className="flex items-center gap-1 px-2 py-1 text-[10px] text-slate-500 hover:text-slate-300 hover:bg-slate-800 rounded transition-colors">
          <GitFork size={10} /> Fork
        </button>
        <button onClick={onDelete} className="flex items-center gap-1 px-2 py-1 text-[10px] text-rose-500/60 hover:text-rose-400 hover:bg-rose-600/10 rounded transition-colors ml-auto">
          <Trash2 size={10} /> Delete
        </button>
      </div>
    </div>
  )
}

function getTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}
