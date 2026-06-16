import { useCallback } from 'react'
import { useCanvasStore } from '../store/canvasStore'
import { useArtifactStore } from '../store/artifactStore'
import { useSessionStore } from '../store/sessionStore'
import { useMathApi } from './useMathApi'

const GATE_TYPES = ['AND', 'OR', 'NOT', 'NAND', 'NOR', 'XOR', 'XNOR']

/** Map a natural-language request to a boolean expression — only used as a
 * fallback when the canvas has no gates to trace. */
function parseBoolean(message: string): { expression: string; variables: string[] } {
  const m = message.toLowerCase()
  let expression = 'A AND B'
  if (/\bxnor\b/.test(m)) expression = 'A XNOR B'
  else if (/\bxor\b|adder|half.?adder|sum bit/.test(m)) expression = 'A XOR B'
  else if (/\bnand\b/.test(m)) expression = 'A NAND B'
  else if (/\bnor\b/.test(m)) expression = 'A NOR B'
  else if (/\bnot\b|inverter/.test(m)) expression = 'NOT A'
  else if (/\bmux\b|multiplex/.test(m)) expression = '(A AND NOT S) OR (B AND S)'
  else if (/\bor\b/.test(m)) expression = 'A OR B'
  else if (/\band\b/.test(m)) expression = 'A AND B'

  const ops = new Set(['AND', 'OR', 'NOT', 'NAND', 'NOR', 'XOR', 'XNOR'])
  const variables = [...new Set(
    expression.split(/[^A-Z]+/).filter((t) => t.length === 1 && /[A-Z]/.test(t) && !ops.has(t))
  )]
  return { expression, variables }
}


/**
 * Runs a real analysis pipeline against the (auth-free) math service, deriving
 * everything from the user's canvas wherever possible, and populates the
 * artifact store so the output panels render. Used in demo mode and as a
 * backend fallback.
 */
export function useAgentRun() {
  const { computeTruthTable, designFilter, computeBode, simulateSystem, analyzeDigital } = useMathApi()

  return useCallback(
    async (message: string) => {
      const { domain, nodes, edges } = useCanvasStore.getState()
      const { setArtifact, setActiveTab } = useArtifactStore.getState()
      const { addTrace, addSuggestion, setStatus } = useSessionStore.getState()

      setStatus('running')
      try {
        if (domain === 'system') {
          addTrace('🔧 Assembling block-diagram system from the canvas…')
          if (nodes.length === 0) {
            addTrace('No blocks on the canvas — add a Step → H(s) → Scope, then ask again.')
            setStatus('complete')
            return
          }
          const sim = await simulateSystem({ nodes, edges })
          setArtifact('simulation', sim)
          setActiveTab('simulation')
          const tEnd = sim.t.length ? sim.t[sim.t.length - 1].toFixed(1) : '0'
          addTrace(`📈 Simulated ${sim.signals.length} scope signal(s) over ${tEnd}s (SciPy).`)
        } else if (domain === 'analog') {
          addTrace('🔍 Extracting filter parameters from your request…')
          const order = /(\d+)(?:st|nd|rd|th)?[ -]?order/.exec(message)?.[1]
          const isHigh = /high[ -]?pass/.test(message.toLowerCase())
          const coeffs = await designFilter({
            type: 'butter',
            order: order ? parseInt(order, 10) : 4,
            cutoff_hz: 1000,
            fs: 44100,
            btype: isHigh ? 'high' : 'low',
          })
          setArtifact('filter_coefficients', coeffs)
          addTrace(`🧮 Designed Butterworth ${isHigh ? 'high' : 'low'}-pass filter (Python/SciPy).`)
          const bode = await computeBode({ b: coeffs.b, a: coeffs.a, fs: 44100, freq_start: 1, freq_end: 22050 })
          setArtifact('bode_data', bode)
          setArtifact('signal_data', bode)
          setActiveTab('bode')
          addTrace('📊 Computed Bode magnitude & phase response.')
        } else {
          // Digital: trace the actual drawn circuit when gates are present.
          const gates = nodes.filter((n) => GATE_TYPES.includes(String((n.data as Record<string, unknown>)?.type)))
          if (gates.length > 0) {
            addTrace('🔍 Tracing your circuit wiring…')
            const res = await analyzeDigital({ nodes, edges })
            if (res.truth_table) {
              setArtifact('truth_table', res.truth_table)
              setActiveTab('truth_table')
            }
            if (res.timing) setArtifact('timing_diagram', res.timing)
            if (res.hdl) {
              setArtifact('hdl_code', res.hdl)
              setArtifact('hdl_language', res.hdl_language)
            }
            if (res.bom) setArtifact('bom', res.bom)
            res.suggestions.forEach((s) => addSuggestion(s))
            addTrace(`📋 Truth table, Verilog & BOM derived from your circuit (${res.summary.gate_count} gate(s), ${res.summary.inputs.length} input(s)).`)
            if (res.minimized) addTrace(`🧮 Minimized output: ${res.minimized}`)
            if (res.suggestions.length) addTrace(`⚠️ ${res.suggestions.length} issue(s) found — review the suggestion cards below.`)
          } else {
            addTrace('🔍 No gates on the canvas — interpreting your request…')
            const { expression, variables } = parseBoolean(message)
            const tt = await computeTruthTable(expression, variables)
            setArtifact('truth_table', tt)
            setActiveTab('truth_table')
            addTrace(`📋 Truth table for ${expression} (Python). Tip: drag gates onto the canvas for a circuit-derived analysis.`)
          }
        }
        addTrace('✅ Analysis complete.')
        setStatus('complete')
      } catch (err) {
        addTrace(`⚠️ Analysis failed: ${err instanceof Error ? err.message : 'unknown error'}`)
        setStatus('error')
      }
    },
    [computeTruthTable, designFilter, computeBode, simulateSystem, analyzeDigital]
  )
}
