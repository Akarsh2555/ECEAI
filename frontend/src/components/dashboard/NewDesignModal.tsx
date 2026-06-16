import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDesigns } from '../../hooks/useDesigns'
import { Modal } from '../shared/Modal'
import { Button } from '../shared/Button'
import type { DomainType } from '../../types/canvas'

interface NewDesignModalProps {
  open: boolean
  onClose: () => void
  onCreated: () => void
}

const DOMAINS: { key: DomainType; label: string; desc: string; color: string }[] = [
  { key: 'digital', label: 'Digital Logic', desc: 'Gates, MUX, flip-flops, truth tables', color: '#6366f1' },
  { key: 'analog', label: 'Analog/RF', desc: 'R, C, L, transistors, op-amps', color: '#10b981' },
  { key: 'system', label: 'System (Simulink)', desc: 'Block diagrams, modulation, scope', color: '#06b6d4' },
]

export function NewDesignModal({ open, onClose, onCreated }: NewDesignModalProps) {
  const [title, setTitle] = useState('')
  const [domain, setDomain] = useState<DomainType>('digital')
  const [creating, setCreating] = useState(false)
  const { createDesign } = useDesigns()
  const navigate = useNavigate()

  const handleCreate = async () => {
    if (!title.trim()) return
    setCreating(true)
    try {
      const design = await createDesign(title.trim(), domain)
      onCreated()
      onClose()
      navigate(`/editor/${design.id}`)
    } catch (err) {
      console.error('Failed to create design:', err)
    } finally {
      setCreating(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="New Design">
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-400 mb-1.5">Design Title</label>
          <input
            id="new-design-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. 4-bit ALU, Butterworth Filter..."
            className="w-full px-3 py-2.5 bg-slate-800/50 border border-slate-700 rounded-lg text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
            autoFocus
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-400 mb-2">Domain</label>
          <div className="grid grid-cols-3 gap-2">
            {DOMAINS.map((d) => (
              <button
                key={d.key}
                onClick={() => setDomain(d.key)}
                className={`
                  p-3 rounded-lg border text-left transition-all duration-200
                  ${domain === d.key ? 'border-opacity-60 bg-opacity-10' : 'border-slate-700 bg-slate-800/30 hover:bg-slate-800/60'}
                `}
                style={{
                  borderColor: domain === d.key ? d.color : undefined,
                  backgroundColor: domain === d.key ? `${d.color}15` : undefined,
                }}
              >
                <span className="text-xs font-semibold" style={{ color: d.color }}>{d.label}</span>
                <p className="text-[9px] text-slate-500 mt-0.5">{d.desc}</p>
              </button>
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button loading={creating} disabled={!title.trim()} onClick={handleCreate}>Create Design</Button>
        </div>
      </div>
    </Modal>
  )
}
