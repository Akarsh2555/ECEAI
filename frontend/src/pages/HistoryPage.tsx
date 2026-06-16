import { EmptyState } from '../components/shared/EmptyState'
import { Clock } from 'lucide-react'

export function HistoryPage() {
  return (
    <div className="min-h-screen bg-slate-950 p-8">
      <h1 className="text-xl font-bold text-slate-200 mb-6">Design History</h1>
      <EmptyState
        icon={<Clock size={48} />}
        title="Version history coming soon"
        description="Track changes and restore previous versions of your circuit designs"
      />
    </div>
  )
}
