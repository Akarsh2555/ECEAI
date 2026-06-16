import { useState, useCallback } from 'react'
import toast from 'react-hot-toast'
import { useArtifactStore } from '../../store/artifactStore'
import { useCanvasStore } from '../../store/canvasStore'
import { useMathApi } from '../../hooks/useMathApi'
import { Download, FileCode, FileText, Loader2, Sigma } from 'lucide-react'

function downloadText(content: string, filename: string) {
  const blob = new Blob([content], { type: 'text/plain' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function DownloadPanel(_props: { designId: string }) {
  const artifacts = useArtifactStore((s) => s.artifacts)
  const { nodes, edges, domain } = useCanvasStore()
  const { generateMatlab } = useMathApi()
  const [generating, setGenerating] = useState(false)

  // For the System (Simulink) domain, generate MATLAB/Python live from the
  // block graph rather than relying on a prior agent run.
  const generateFromCanvas = useCallback(
    async (kind: 'matlab' | 'python') => {
      if (nodes.length === 0) {
        toast.error('Add blocks to the canvas first')
        return
      }
      setGenerating(true)
      try {
        const { matlab, python } = await generateMatlab({ nodes, edges })
        downloadText(kind === 'matlab' ? matlab : python, kind === 'matlab' ? 'system_model.m' : 'system_model.py')
        toast.success(`Generated ${kind === 'matlab' ? 'MATLAB' : 'Python'} from your block diagram`)
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Code generation failed')
      } finally {
        setGenerating(false)
      }
    },
    [nodes, edges, generateMatlab]
  )

  const artifactItems = [
    { label: 'MATLAB Script (.m)', content: artifacts.matlab_script, filename: 'design.m', icon: <FileCode size={16} />, color: 'bg-amber-600 hover:bg-amber-500' },
    { label: 'Python Script (.py)', content: artifacts.python_script, filename: 'design.py', icon: <FileText size={16} />, color: 'bg-emerald-600 hover:bg-emerald-500' },
    { label: 'Verilog HDL (.v)', content: artifacts.hdl_code, filename: 'design.v', icon: <FileCode size={16} />, color: 'bg-indigo-600 hover:bg-indigo-500' },
  ]

  return (
    <div className="p-6 space-y-3 animate-fade-in">
      <h3 className="text-sm font-semibold text-slate-300 mb-2">Export Design Files</h3>

      {domain === 'system' && (
        <div className="space-y-3 pb-3 mb-1 border-b border-slate-800">
          <p className="text-[11px] text-slate-500 flex items-center gap-1.5">
            <Sigma size={12} /> Generate from your block diagram (MATLAB <code className="text-slate-400">connect()</code> + lsim)
          </p>
          <div className="grid grid-cols-2 gap-3">
            <button
              disabled={generating}
              onClick={() => generateFromCanvas('matlab')}
              className="flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white text-sm font-medium transition-colors"
            >
              {generating ? <Loader2 size={15} className="animate-spin" /> : <FileCode size={15} />}
              MATLAB .m
            </button>
            <button
              disabled={generating}
              onClick={() => generateFromCanvas('python')}
              className="flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm font-medium transition-colors"
            >
              {generating ? <Loader2 size={15} className="animate-spin" /> : <FileText size={15} />}
              Python .py
            </button>
          </div>
        </div>
      )}

      {artifactItems.map((item) => (
        <button
          key={item.filename}
          disabled={!item.content}
          onClick={() => item.content && downloadText(item.content, item.filename)}
          className={`
            w-full flex items-center gap-3 px-4 py-3 rounded-lg text-white text-sm font-medium
            transition-all duration-200 disabled:opacity-30 disabled:cursor-not-allowed
            ${item.color}
          `}
        >
          {item.icon}
          <span>{item.label}</span>
          <Download size={14} className="ml-auto" />
        </button>
      ))}
    </div>
  )
}
