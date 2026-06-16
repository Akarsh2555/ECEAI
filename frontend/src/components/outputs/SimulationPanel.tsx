import { useState, useCallback } from 'react'
import { Plot } from '../../lib/plotly'
import { Play, Loader2, Sparkles } from 'lucide-react'
import toast from 'react-hot-toast'
import { useArtifactStore } from '../../store/artifactStore'
import { useCanvasStore } from '../../store/canvasStore'
import { useMathApi } from '../../hooks/useMathApi'
import { EmptyPanel } from './EmptyPanel'

const LINE_COLORS = ['#ff6c37', '#28b9cc', '#4caf61', '#f5a623', '#a78bfa', '#ef5350']

/** A ready-made unity-feedback control loop: Step → Σ(+,−) → Gain → 1/(s+1) → Scope. */
function exampleFeedbackSystem() {
  const nodes = [
    { id: 'ex-step', type: 'systemBlock', position: { x: 40, y: 120 }, data: { type: 'STEP', label: 'Step', amplitude: 1, step_time: 0 } },
    { id: 'ex-sum', type: 'systemBlock', position: { x: 200, y: 120 }, data: { type: 'SUM', label: 'Sum', signs: ['+', '-'] } },
    { id: 'ex-gain', type: 'systemBlock', position: { x: 340, y: 120 }, data: { type: 'GAIN', label: 'K', gain: 2 } },
    { id: 'ex-plant', type: 'systemBlock', position: { x: 480, y: 120 }, data: { type: 'TF', label: 'Plant', num: [1], den: [1, 1] } },
    { id: 'ex-scope', type: 'systemBlock', position: { x: 640, y: 120 }, data: { type: 'SCOPE', label: 'Output' } },
  ]
  const edges = [
    { id: 'e1', source: 'ex-step', target: 'ex-sum', sourceHandle: 'out', targetHandle: 'in-0', type: 'circuit' },
    { id: 'e2', source: 'ex-sum', target: 'ex-gain', sourceHandle: 'out', targetHandle: 'in-0', type: 'circuit' },
    { id: 'e3', source: 'ex-gain', target: 'ex-plant', sourceHandle: 'out', targetHandle: 'in-0', type: 'circuit' },
    { id: 'e4', source: 'ex-plant', target: 'ex-scope', sourceHandle: 'out', targetHandle: 'in-0', type: 'circuit' },
    { id: 'e5', source: 'ex-plant', target: 'ex-sum', sourceHandle: 'out', targetHandle: 'in-1', type: 'circuit' },
  ]
  return { domain: 'system' as const, nodes, edges }
}

/** A DSB-SC modulator: Message(5 Hz) × Carrier(50 Hz) → Spectrum (sidebands at 45/55 Hz). */
function exampleDsbSc() {
  const nodes = [
    { id: 'dsb-msg', type: 'systemBlock', position: { x: 40, y: 60 }, data: { type: 'MESSAGE', label: 'Message', amplitude: 1, frequency: 5 } },
    { id: 'dsb-car', type: 'systemBlock', position: { x: 40, y: 200 }, data: { type: 'CARRIER', label: 'Carrier', amplitude: 1, frequency: 50 } },
    { id: 'dsb-mul', type: 'systemBlock', position: { x: 280, y: 130 }, data: { type: 'PRODUCT', label: 'Mixer' } },
    { id: 'dsb-spec', type: 'systemBlock', position: { x: 480, y: 130 }, data: { type: 'SPECTRUM', label: 'DSB-SC' } },
  ]
  const edges = [
    { id: 'd1', source: 'dsb-msg', target: 'dsb-mul', sourceHandle: 'out', targetHandle: 'in-0', type: 'circuit' },
    { id: 'd2', source: 'dsb-car', target: 'dsb-mul', sourceHandle: 'out', targetHandle: 'in-1', type: 'circuit' },
    { id: 'd3', source: 'dsb-mul', target: 'dsb-spec', sourceHandle: 'out', targetHandle: 'in-0', type: 'circuit' },
  ]
  return { domain: 'system' as const, nodes, edges }
}

export function SimulationPanel() {
  const sim = useArtifactStore((s) => s.artifacts.simulation)
  const setArtifact = useArtifactStore((s) => s.setArtifact)
  const { nodes, edges, loadFromNetlist } = useCanvasStore()
  const { simulateSystem } = useMathApi()
  const [running, setRunning] = useState(false)

  const loadExample = useCallback(() => {
    loadFromNetlist(exampleFeedbackSystem())
    toast.success('Loaded feedback control example — press Run')
  }, [loadFromNetlist])

  const loadDsbSc = useCallback(() => {
    loadFromNetlist(exampleDsbSc())
    toast.success('Loaded DSB-SC modulator — press Run, then open Spectrum')
  }, [loadFromNetlist])

  const run = useCallback(async () => {
    if (nodes.length === 0) {
      toast.error('Add some blocks to the canvas first')
      return
    }
    setRunning(true)
    try {
      // Carrier-aware timing: sample well above the highest carrier (so a
      // modulated RF waveform isn't aliased) and run long enough for the lowest
      // tone / several symbols. Mirrors the backend graph-path heuristic.
      const freqs = nodes
        .map((nd) => Number((nd.data as { frequency?: number })?.frequency) || 0)
        .filter((f) => f > 0)
      const fcMax = freqs.length ? Math.max(...freqs) : 10
      const fMin = freqs.length ? Math.min(...freqs) : 1
      const fs = Math.max(20 * fcMax, 200)
      const tEnd = Math.max(0.4, 4 / fMin)
      const nPoints = Math.min(Math.round(fs * tEnd), 4000)
      const data = await simulateSystem({ nodes, edges }, tEnd, nPoints)
      setArtifact('simulation', data)
      if (!data.signals.length) {
        toast('No Scope block found — add one to see output', { icon: '💡' })
      } else {
        toast.success('Simulation complete')
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Simulation failed')
    } finally {
      setRunning(false)
    }
  }, [nodes, edges, simulateSystem, setArtifact])

  const RunButton = (
    <button
      onClick={run}
      disabled={running}
      className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white text-sm font-semibold transition-colors"
    >
      {running ? <Loader2 size={15} className="animate-spin" /> : <Play size={15} />}
      {running ? 'Running…' : 'Run Simulation'}
    </button>
  )

  if (!sim || !sim.signals.length) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 p-4">
        <EmptyPanel label="Build a control loop or an analog comms circuit (e.g. Message × Carrier → Spectrum), then run it — or ask the AI chat." />
        <div className="flex flex-wrap items-center justify-center gap-2">
          <button
            onClick={loadExample}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-medium transition-colors border border-slate-700"
          >
            <Sparkles size={15} className="text-cyan-400" />
            Control example
          </button>
          <button
            onClick={loadDsbSc}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-medium transition-colors border border-slate-700"
          >
            <Sparkles size={15} className="text-amber-400" />
            DSB-SC example
          </button>
          {RunButton}
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 animate-fade-in">
      <div className="flex justify-end mb-2">{RunButton}</div>
      <Plot
        data={sim.signals.map((sig, i) => ({
          x: sim.t,
          y: sig.y,
          type: 'scatter',
          mode: 'lines',
          name: sig.label,
          line: { color: LINE_COLORS[i % LINE_COLORS.length], width: 2 },
        }))}
        layout={{
          title: { text: 'Scope — Time Response', font: { color: '#9097a0', size: 14 } },
          xaxis: { title: { text: 'Time (s)' }, gridcolor: '#31363f', color: '#9097a0', zerolinecolor: '#444b55' },
          yaxis: { title: { text: 'Amplitude' }, gridcolor: '#31363f', color: '#9097a0', zerolinecolor: '#444b55' },
          paper_bgcolor: '#24282f',
          plot_bgcolor: '#24282f',
          font: { color: '#9097a0', family: 'JetBrains Mono, monospace', size: 11 },
          margin: { t: 40, r: 20, b: 50, l: 55 },
          showlegend: true,
          legend: { font: { color: '#9097a0', size: 10 } },
        }}
        config={{ responsive: true }}
        className="w-full"
        useResizeHandler
        style={{ width: '100%', height: '320px' }}
      />
    </div>
  )
}
