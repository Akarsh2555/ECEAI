/* ─── SSE Event Types ─── */
export type SSEEventType = 'trace' | 'suggestion' | 'artifact' | 'done' | 'error'

export interface SSEEvent {
  type: SSEEventType
  message?: string
  id?: string
  description?: string
  patch?: Record<string, unknown>
  kind?: string
  payload?: unknown
}

/* ─── Agent Suggestion ─── */
export interface Suggestion {
  id: string
  description: string
  patch: Record<string, unknown>
  status: 'pending' | 'accepted' | 'rejected'
}

/* ─── Artifact types produced by the graph ─── */
export interface TruthTableData {
  variables: string[]
  rows: boolean[][]
  outputs: boolean[]
  minimizedExpression?: string
  /** Present when derived from a real netlist with one or more OUTPUT nodes. */
  output_labels?: string[]
  output_columns?: boolean[][]
}

export interface TimingDiagramData {
  signals: Array<{
    name: string
    values: number[]
    timepoints: number[]
  }>
  clockPeriod: number
}

export interface BodeData {
  freqs_hz: number[]
  magnitude_db: number[]
  phase_deg: number[]
}

export interface FFTData {
  freqs: number[]
  magnitudes_db: number[]
  phase_deg: number[]
}

export interface SimulationSignal {
  id: string
  label: string
  y: number[]
}

export interface SpectrumSignal {
  id: string
  label: string
  freqs: number[]
  magnitude: number[]
}

export interface ConstellationPoint {
  i: number
  q: number
  bits: string
}

export interface ConstellationData {
  id: string
  label: string
  modulator?: string
  scheme: string
  M: number
  bits_per_symbol: number
  ideal: ConstellationPoint[]
  symbols: ConstellationPoint[]
  noisy?: ConstellationPoint[] | null
  snr_db?: number | null
  axes?: { i: string; q: string }
}

export interface SimulationData {
  t: number[]
  signals: SimulationSignal[]
  spectra?: SpectrumSignal[]
  constellations?: ConstellationData[]
  dt: number
  fs?: number
}

export interface FilterCoefficients {
  b: number[]
  a: number[]
  sos: number[][]
  zpk: {
    zeros: number[]
    poles: number[]
    gain: number
  }
}

export interface BOMEntry {
  component: string
  type: string
  value: string
  quantity: number
  unitCost: number
  totalCost: number
  powerDissipation: number
  nandEquivalent?: number
  package?: string
  manufacturer?: string
}

export interface BOMData {
  entries: BOMEntry[]
  totalCost: number
  totalPower: number
  totalNandEquivalent: number
}

/* ─── Full artifact bundle ─── */
export interface ArtifactBundle {
  truth_table?: TruthTableData
  timing_diagram?: TimingDiagramData
  bode_data?: BodeData
  fft_data?: FFTData
  filter_coefficients?: FilterCoefficients
  hdl_code?: string
  hdl_language?: 'verilog' | 'vhdl'
  matlab_script?: string
  python_script?: string
  bom?: BOMData
  signal_data?: BodeData | FFTData
  simulation?: SimulationData
}

/* ─── Session status ─── */
export type SessionStatus = 'idle' | 'running' | 'awaiting_approval' | 'complete' | 'error'

/* ─── Trace entry for chat display ─── */
export interface TraceEntry {
  id: string
  message: string
  timestamp: number
  nodeType?: string
}
