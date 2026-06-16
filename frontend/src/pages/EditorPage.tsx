import { useParams } from 'react-router-dom'
import { CircuitCanvas } from '../components/canvas/CircuitCanvas'
import { NodePalette } from '../components/canvas/NodePalette'
import { ChatSidebar } from '../components/chat/ChatSidebar'
import { OutputTabs } from '../components/outputs/OutputTabs'
import { BrandMark } from '../components/shared/BrandMark'
import { useDesigns } from '../hooks/useDesigns'
import { useEffect, useState } from 'react'

export function EditorPage() {
  const { designId } = useParams<{ designId: string }>()
  const [outputHeight, setOutputHeight] = useState(280)
  const [title, setTitle] = useState<string | null>(null)
  const { getDesign } = useDesigns()

  // Show the user-given design name in the header (not the raw UUID).
  useEffect(() => {
    let cancelled = false
    if (!designId) { setTitle(null); return }
    getDesign(designId)
      .then((d) => { if (!cancelled) setTitle(d.title) })
      .catch(() => { if (!cancelled) setTitle(null) })
    return () => { cancelled = true }
  }, [designId, getDesign])

  return (
    <div className="h-screen flex flex-col bg-slate-950">
      {/* Top bar */}
      <header className="h-11 flex items-center px-4 border-b border-slate-800 bg-slate-900/60 backdrop-blur-sm flex-shrink-0">
        <div className="flex items-center gap-2">
          <BrandMark size={24} />
          <span className="text-sm font-semibold text-slate-300">ECE Copilot</span>
          <span className="text-slate-700 mx-2">|</span>
          <span className="text-xs text-slate-400 font-medium">{title || 'Untitled design'}</span>
        </div>
      </header>

      {/* Main workspace */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Node palette */}
        <NodePalette />

        {/* Center: Canvas + Output */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Canvas */}
          <div className="flex-1 min-h-0">
            <CircuitCanvas />
          </div>

          {/* Resize handle */}
          <div
            className="h-1.5 bg-slate-800 hover:bg-indigo-600/40 cursor-row-resize transition-colors flex-shrink-0"
            onMouseDown={(e) => {
              const startY = e.clientY
              const startH = outputHeight
              const onMove = (ev: MouseEvent) => {
                const delta = startY - ev.clientY
                setOutputHeight(Math.max(100, Math.min(600, startH + delta)))
              }
              const onUp = () => {
                document.removeEventListener('mousemove', onMove)
                document.removeEventListener('mouseup', onUp)
              }
              document.addEventListener('mousemove', onMove)
              document.addEventListener('mouseup', onUp)
            }}
          />

          {/* Output panels */}
          <div style={{ height: outputHeight }} className="flex-shrink-0 overflow-hidden">
            <OutputTabs />
          </div>
        </div>

        {/* Right: Chat sidebar */}
        <ChatSidebar designId={designId || null} />
      </div>
    </div>
  )
}
