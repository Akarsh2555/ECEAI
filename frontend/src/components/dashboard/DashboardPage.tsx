import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDesigns } from '../../hooks/useDesigns'
import { useAuth } from '../../hooks/useAuth'
import { DesignCard } from './DesignCard'
import { NewDesignModal } from './NewDesignModal'
import { Button } from '../shared/Button'
import { Spinner } from '../shared/Spinner'
import { EmptyState } from '../shared/EmptyState'
import { Plus, Zap, LogOut, CircuitBoard } from 'lucide-react'
import type { DesignRow } from '../../types/supabase'

export function DashboardPage() {
  const [designs, setDesigns] = useState<DesignRow[]>([])
  const [loading, setLoading] = useState(true)
  const [showNewModal, setShowNewModal] = useState(false)
  const { listDesigns, deleteDesign, forkDesign } = useDesigns()
  const { user, signOut } = useAuth()
  const navigate = useNavigate()

  const loadDesigns = async () => {
    try {
      const data = await listDesigns()
      setDesigns(data)
    } catch (err) {
      console.error('Failed to load designs:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadDesigns() }, [])

  const handleDelete = async (id: string) => {
    await deleteDesign(id)
    setDesigns((d) => d.filter((x) => x.id !== id))
  }

  const handleFork = async (id: string) => {
    const forked = await forkDesign(id)
    navigate(`/editor/${forked.id}`)
  }

  return (
    <div className="min-h-screen bg-slate-950">
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-900/50 backdrop-blur-sm sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-indigo-500 to-indigo-700 flex items-center justify-center">
              <Zap size={18} className="text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white">ECE Copilot</h1>
              <p className="text-[10px] text-slate-500">{user?.email || 'Demo Mode'}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button icon={<Plus size={14} />} onClick={() => setShowNewModal(true)}>
              New Design
            </Button>
            <button onClick={() => signOut()} className="p-2 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-slate-800 transition-colors">
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        <h2 className="text-xl font-semibold text-slate-200 mb-6">Your Designs</h2>

        {loading ? (
          <Spinner size="lg" className="mt-20" />
        ) : designs.length === 0 ? (
          <EmptyState
            icon={<CircuitBoard size={48} />}
            title="No designs yet"
            description="Create your first circuit design to get started with AI-powered analysis"
            action={<Button icon={<Plus size={14} />} onClick={() => setShowNewModal(true)}>Create Design</Button>}
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {designs.map((design) => (
              <DesignCard
                key={design.id}
                design={design}
                onOpen={() => navigate(`/editor/${design.id}`)}
                onFork={() => handleFork(design.id)}
                onDelete={() => handleDelete(design.id)}
              />
            ))}
          </div>
        )}
      </main>

      <NewDesignModal open={showNewModal} onClose={() => setShowNewModal(false)} onCreated={loadDesigns} />
    </div>
  )
}
