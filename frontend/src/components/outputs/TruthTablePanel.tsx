import { useState } from 'react'
import toast from 'react-hot-toast'
import { Sparkles, Loader2 } from 'lucide-react'
import { useArtifactStore } from '../../store/artifactStore'
import { useCanvasStore } from '../../store/canvasStore'
import { useMathApi } from '../../hooks/useMathApi'
import { EmptyPanel } from './EmptyPanel'

/** A half-adder built from real gates: A,B → XOR=Sum, AND=Carry. */
function halfAdder() {
  const nodes = [
    { id: 'ha-a', type: 'gate', position: { x: 40, y: 60 }, data: { type: 'INPUT', label: 'A', inputHandles: [], outputHandles: ['out'] } },
    { id: 'ha-b', type: 'gate', position: { x: 40, y: 180 }, data: { type: 'INPUT', label: 'B', inputHandles: [], outputHandles: ['out'] } },
    { id: 'ha-xor', type: 'gate', position: { x: 240, y: 70 }, data: { type: 'XOR', label: 'X1', inputHandles: ['in-0', 'in-1'], outputHandles: ['out'] } },
    { id: 'ha-and', type: 'gate', position: { x: 240, y: 190 }, data: { type: 'AND', label: 'A1', inputHandles: ['in-0', 'in-1'], outputHandles: ['out'] } },
    { id: 'ha-sum', type: 'gate', position: { x: 440, y: 70 }, data: { type: 'OUTPUT', label: 'Sum', inputHandles: ['in-0'], outputHandles: [] } },
    { id: 'ha-carry', type: 'gate', position: { x: 440, y: 190 }, data: { type: 'OUTPUT', label: 'Carry', inputHandles: ['in-0'], outputHandles: [] } },
  ]
  const edges = [
    { id: 'h1', source: 'ha-a', target: 'ha-xor', targetHandle: 'in-0', type: 'circuit' },
    { id: 'h2', source: 'ha-b', target: 'ha-xor', targetHandle: 'in-1', type: 'circuit' },
    { id: 'h3', source: 'ha-a', target: 'ha-and', targetHandle: 'in-0', type: 'circuit' },
    { id: 'h4', source: 'ha-b', target: 'ha-and', targetHandle: 'in-1', type: 'circuit' },
    { id: 'h5', source: 'ha-xor', target: 'ha-sum', targetHandle: 'in-0', type: 'circuit' },
    { id: 'h6', source: 'ha-and', target: 'ha-carry', targetHandle: 'in-0', type: 'circuit' },
  ]
  return { domain: 'digital' as const, nodes, edges }
}

export function TruthTablePanel() {
  const ttData = useArtifactStore((s) => s.artifacts.truth_table)
  const setArtifact = useArtifactStore((s) => s.setArtifact)
  const loadFromNetlist = useCanvasStore((s) => s.loadFromNetlist)
  const { analyzeDigital } = useMathApi()
  const [loading, setLoading] = useState(false)

  const loadExample = async () => {
    setLoading(true)
    try {
      const net = halfAdder()
      loadFromNetlist(net)
      const res = await analyzeDigital({ nodes: net.nodes, edges: net.edges })
      if (res.truth_table) setArtifact('truth_table', res.truth_table)
      if (res.timing) setArtifact('timing_diagram', res.timing)
      if (res.hdl) { setArtifact('hdl_code', res.hdl); setArtifact('hdl_language', res.hdl_language) }
      if (res.bom) setArtifact('bom', res.bom)
      toast.success('Half-adder loaded — table derived from the circuit')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Analysis failed')
    } finally {
      setLoading(false)
    }
  }

  if (!ttData?.variables?.length) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 p-4">
        <EmptyPanel label="Draw a circuit (INPUT → gates → OUTPUT) and ask the agent, or load an example." />
        <button
          onClick={loadExample}
          disabled={loading}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-medium transition-colors border border-slate-700 disabled:opacity-50"
        >
          {loading ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} className="text-indigo-400" />}
          Load example circuit
        </button>
      </div>
    )
  }

  const { variables, rows, outputs, minimizedExpression } = ttData

  // When derived from a real netlist we may have multiple OUTPUT columns;
  // otherwise fall back to the single "F" column.
  const outLabels = ttData.output_labels?.length ? ttData.output_labels : ['F']
  const outCols = ttData.output_columns?.length ? ttData.output_columns : [outputs]

  return (
    <div className="p-4 space-y-4 animate-fade-in">
      {/* Truth table */}
      <div className="overflow-auto rounded-lg border border-slate-800">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-slate-800/80">
              {variables.map((v) => (
                <th key={v} className="px-3 py-2 text-center font-mono text-indigo-400 font-semibold">{v}</th>
              ))}
              {outLabels.map((label, k) => (
                <th key={label} className={`px-3 py-2 text-center font-mono text-emerald-400 font-semibold ${k === 0 ? 'border-l border-slate-700' : ''}`}>
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} className="border-t border-slate-800/50 hover:bg-slate-800/30 transition-colors">
                {row.map((val, j) => (
                  <td key={j} className="px-3 py-1.5 text-center font-mono text-slate-300">
                    {val ? '1' : '0'}
                  </td>
                ))}
                {outCols.map((col, k) => (
                  <td key={k} className={`px-3 py-1.5 text-center font-mono font-bold ${k === 0 ? 'border-l border-slate-700' : ''} ${col[i] ? 'text-emerald-400' : 'text-slate-600'}`}>
                    {col[i] ? '1' : '0'}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Minimized expression */}
      {minimizedExpression && (
        <div className="p-3 rounded-lg bg-emerald-600/10 border border-emerald-500/20">
          <p className="text-[10px] text-emerald-500 mb-1 uppercase tracking-wider font-medium">Minimized Expression</p>
          <p className="text-sm font-mono text-emerald-300">{minimizedExpression}</p>
        </div>
      )}
    </div>
  )
}
