import { useParams } from 'react-router-dom'
import { CircuitCanvas } from '../components/canvas/CircuitCanvas'
import { NodePalette } from '../components/canvas/NodePalette'
import { ChatSidebar } from '../components/chat/ChatSidebar'
import { OutputTabs } from '../components/outputs/OutputTabs'
import { BrandMark } from '../components/shared/BrandMark'
import { useDesigns } from '../hooks/useDesigns'
import { useCanvasStore } from '../store/canvasStore'
import { useEffect, useRef, useState } from 'react'

export function EditorPage() {
  const { designId } = useParams<{ designId: string }>()
  const [outputHeight, setOutputHeight] = useState(280)
  const [title, setTitle] = useState<string | null>(null)
  const { getDesign, updateDesign } = useDesigns()

  const nodes = useCanvasStore((s) => s.nodes)
  const edges = useCanvasStore((s) => s.edges)
  const loadFromNetlist = useCanvasStore((s) => s.loadFromNetlist)
  const reset = useCanvasStore((s) => s.reset)
  // Tracks which design's canvas is currently loaded, so autosave never writes
  // one design's canvas into another during the load.
  const loadedRef = useRef<string | null>(null)

  // Load THIS design's canvas when it opens (a new design has an empty canvas,
  // so it no longer shows the previously-open design's circuit).
  useEffect(() => {
    let cancelled = false
    loadedRef.current = null
    if (!designId) { setTitle(null); reset(); return }
    getDesign(designId)
      .then((d) => {
        if (cancelled) return
        setTitle(d.title)
        const cj = d.canvas_json as { domain?: string; nodes?: unknown[]; edges?: unknown[] } | null
        if (cj && Array.isArray(cj.nodes) && cj.nodes.length) {
          loadFromNetlist({ domain: (cj.domain as never) ?? d.domain, nodes: cj.nodes as never, edges: (cj.edges as never) ?? [] })
        } else {
          reset()
          useCanvasStore.getState().setDomain(d.domain as never)
        }
        loadedRef.current = designId
      })
      .catch(() => { if (!cancelled) { setTitle(null); reset(); loadedRef.current = designId } })
    return () => { cancelled = true }
  }, [designId, getDesign, loadFromNetlist, reset])

  // Debounced autosave of the canvas back to this design (after it's loaded).
  useEffect(() => {
    if (!designId || loadedRef.current !== designId) return
    const t = setTimeout(() => {
      updateDesign(designId, { canvas_json: useCanvasStore.getState().toNetlistJSON() }).catch(() => {})
    }, 1200)
    return () => clearTimeout(t)
  }, [nodes, edges, designId, updateDesign])

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
