import { useCallback } from 'react'
import { apiClient } from '../lib/apiClient'
import { useAuth } from './useAuth'
import type { TruthTableData, BodeData, FFTData, FilterCoefficients, SimulationData } from '../types/agent'

interface GraphPayload {
  nodes: unknown[]
  edges: unknown[]
}

export function useMathApi() {
  const { getToken } = useAuth()

  const computeTruthTable = useCallback(
    async (expression: string, variables: string[]): Promise<TruthTableData> => {
      const token = await getToken()
      return apiClient.post<TruthTableData>(
        '/math/truth_table',
        { expression, variables },
        token || undefined
      )
    },
    [getToken]
  )

  const minimizeKmap = useCallback(
    async (variables: string[], minterms: number[], dontCares?: number[]) => {
      const token = await getToken()
      return apiClient.post<{ minimized: string; groups: number[][] }>(
        '/math/kmap_minimize',
        { variables, minterms, dont_cares: dontCares || [] },
        token || undefined
      )
    },
    [getToken]
  )

  const computeFFT = useCallback(
    async (signal: number[], fs: number, window?: string): Promise<FFTData> => {
      const token = await getToken()
      return apiClient.post<FFTData>(
        '/math/fft',
        { signal, fs, window: window || 'hann' },
        token || undefined
      )
    },
    [getToken]
  )

  const designFilter = useCallback(
    async (params: {
      type: string
      order: number
      cutoff_hz: number | number[]
      fs: number
      btype?: string
      window?: string
      ripple_db?: number
    }): Promise<FilterCoefficients> => {
      const token = await getToken()
      return apiClient.post<FilterCoefficients>(
        '/math/filter_design',
        params,
        token || undefined
      )
    },
    [getToken]
  )

  const computeBode = useCallback(
    async (params: {
      b: number[]
      a: number[]
      freq_start?: number
      freq_end?: number
      n_points?: number
      fs?: number
    }): Promise<BodeData> => {
      const token = await getToken()
      return apiClient.post<BodeData>('/math/bode', params, token || undefined)
    },
    [getToken]
  )

  const computeConvolution = useCallback(
    async (signal1: number[], signal2: number[]) => {
      const token = await getToken()
      return apiClient.post<{ result: number[] }>(
        '/math/convolution',
        { signal1, signal2 },
        token || undefined
      )
    },
    [getToken]
  )

  const simulateSystem = useCallback(
    async (graph: GraphPayload, tEnd = 10, nPoints = 800): Promise<SimulationData> => {
      const token = await getToken()
      return apiClient.post<SimulationData>(
        '/math/simulate',
        { nodes: graph.nodes, edges: graph.edges, t_end: tEnd, n_points: nPoints },
        token || undefined
      )
    },
    [getToken]
  )

  const analyzeDigital = useCallback(
    async (graph: GraphPayload) => {
      const token = await getToken()
      return apiClient.post<{
        truth_table: TruthTableData | null
        timing: { signals: { name: string; values: number[]; timepoints: number[] }[]; clockPeriod: number } | null
        hdl: string
        hdl_language: string
        bom: unknown
        minimized: string | null
        suggestions: { id: string; description: string; patch: Record<string, unknown> }[]
        summary: { inputs: string[]; outputs: string[]; gate_count: number }
      }>('/math/digital_analyze', { nodes: graph.nodes, edges: graph.edges }, token || undefined)
    },
    [getToken]
  )

  const generateMatlab = useCallback(
    async (graph: GraphPayload, tEnd = 10): Promise<{ matlab: string; python: string }> => {
      const token = await getToken()
      return apiClient.post<{ matlab: string; python: string }>(
        '/math/generate_matlab',
        { nodes: graph.nodes, edges: graph.edges, t_end: tEnd },
        token || undefined
      )
    },
    [getToken]
  )

  return {
    computeTruthTable,
    minimizeKmap,
    computeFFT,
    designFilter,
    computeBode,
    computeConvolution,
    simulateSystem,
    generateMatlab,
    analyzeDigital,
  }
}
