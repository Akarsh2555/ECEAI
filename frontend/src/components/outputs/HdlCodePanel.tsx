import { useArtifactStore } from '../../store/artifactStore'
import { useCanvasStore } from '../../store/canvasStore'
import { useAuth } from '../../hooks/useAuth'
import { apiClient } from '../../lib/apiClient'
import { EmptyPanel } from './EmptyPanel'
import { Light as SyntaxHighlighter } from 'react-syntax-highlighter'
import { atomOneDark } from 'react-syntax-highlighter/dist/esm/styles/hljs'
import { Copy, Check, Sparkles, Loader2 } from 'lucide-react'
import { useState } from 'react'
import toast from 'react-hot-toast'

export function HdlCodePanel() {
  const hdlCode = useArtifactStore((s) => s.artifacts.hdl_code)
  const hdlLang = useArtifactStore((s) => s.artifacts.hdl_language) || 'verilog'
  const setArtifact = useArtifactStore((s) => s.setArtifact)
  const { getToken } = useAuth()
  const [copied, setCopied] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [source, setSource] = useState<'llm' | 'structural' | null>(null)

  if (!hdlCode) return <EmptyPanel label="Run HDL compilation to see generated code" />

  const handleCopy = async () => {
    await navigator.clipboard.writeText(hdlCode)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const generateProduction = async () => {
    const { nodes, edges } = useCanvasStore.getState()
    if (!nodes.length) {
      toast.error('Draw a circuit on the canvas first')
      return
    }
    setGenerating(true)
    try {
      const token = await getToken()
      const res = await apiClient.post<{ hdl: string; language: string; source: 'llm' | 'structural' }>(
        '/api/generate_hdl',
        { nodes, edges, language: hdlLang },
        token || undefined
      )
      setArtifact('hdl_code', res.hdl)
      setArtifact('hdl_language', res.language)
      setSource(res.source)
      toast.success(
        res.source === 'llm'
          ? 'Production-grade HDL generated'
          : 'AI unavailable — showing structural HDL'
      )
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'HDL generation failed')
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div className="p-4 animate-fade-in">
      <div className="flex items-center justify-between mb-2">
        <span className="eyebrow-mono text-slate-500 flex items-center gap-2">
          {hdlLang === 'verilog' ? 'Verilog HDL' : 'VHDL'}
          {source === 'llm' && (
            <span className="px-1.5 py-0.5 rounded text-[10px] bg-indigo-500/15 text-indigo-300 border border-indigo-500/30">
              AI · production
            </span>
          )}
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={generateProduction}
            disabled={generating}
            className="flex items-center gap-1 px-2 py-1 text-xs rounded bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white transition-colors"
          >
            {generating ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
            {generating ? 'Generating…' : 'Generate production HDL'}
          </button>
          <button
            onClick={handleCopy}
            className="flex items-center gap-1 px-2 py-1 text-xs rounded bg-slate-800 hover:bg-slate-700 text-slate-400 transition-colors"
          >
            {copied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
      </div>
      <div className="rounded-lg overflow-hidden border border-slate-800">
        <SyntaxHighlighter
          language={hdlLang}
          style={atomOneDark}
          customStyle={{
            background: '#141516',           // surface-2 code block (masterdesign)
            padding: '16px',
            fontSize: '13px',
            margin: 0,
            fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
          }}
          codeTagProps={{ style: { fontFamily: "'JetBrains Mono', 'Fira Code', monospace" } }}
          showLineNumbers
          lineNumberStyle={{ color: '#4a4d55', fontSize: '10px' }}
        >
          {hdlCode}
        </SyntaxHighlighter>
      </div>
    </div>
  )
}
