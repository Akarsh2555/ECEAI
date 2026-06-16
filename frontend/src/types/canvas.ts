import type { Node, Edge } from '@xyflow/react'

/* ─── Component sub-types per domain ─── */
export type GateType = 'AND' | 'OR' | 'NOT' | 'NAND' | 'NOR' | 'XOR' | 'XNOR' | 'INPUT' | 'OUTPUT' | 'CLOCK'
export type MuxType = 'MUX' | 'DEMUX'
export type FlipFlopType = 'D' | 'JK' | 'SR'
export type AnalogComponentType = 'R' | 'C' | 'L' | 'DIODE' | 'BJT' | 'MOSFET' | 'OPAMP' | 'AC_SOURCE' | 'DC_SOURCE' | 'GROUND'
export type SystemBlockType =
  | 'STEP' | 'SINE' | 'COSINE' | 'SQUARE' | 'IMPULSE' | 'RAMP' | 'CONSTANT'
  | 'MESSAGE' | 'CARRIER' | 'NOISE' | 'BITSTREAM'
  | 'GAIN' | 'SUM' | 'PRODUCT' | 'TF' | 'INTEGRATOR' | 'DERIVATIVE' | 'LPF'
  | 'FM' | 'PM' | 'ASK' | 'FSK' | 'BPSK' | 'PSK' | 'QPSK' | 'QAM'
  | 'SCOPE' | 'SPECTRUM' | 'OUTPUT' | 'CONSTELLATION'

/* ─── Node data payloads ─── */
export interface GateNodeData {
  type: GateType
  label: string
  inputHandles: string[]
  outputHandles: string[]
  truthTable?: boolean[][]
}

export interface MuxNodeData {
  type: MuxType
  label: string
  selectorPins: string[]
  dataPins: string[]
  outputPins: string[]
  bitWidth: number
}

export interface FlipFlopNodeData {
  type: FlipFlopType
  label: string
  clockEdge: 'rising' | 'falling'
  hasReset: boolean
  hasPreset: boolean
}

export interface AnalogNodeData {
  type: AnalogComponentType
  label: string
  value?: number
  unit?: string
  model?: string
}

export interface SystemBlockNodeData {
  type: SystemBlockType
  label: string
  // source params
  amplitude?: number
  frequency?: number
  phase?: number
  offset?: number
  step_time?: number
  // gain
  gain?: number
  // sum
  signs?: ('+' | '-')[]
  // transfer function H(s) = num / den
  num?: number[]
  den?: number[]
  // digital data source (BITSTREAM)
  pattern?: string
  bit_rate?: number
  // modulators
  sensitivity?: number   // FM: Hz per unit input; PM: rad per unit input
  freq_dev?: number      // FSK frequency deviation (Hz)
  M?: number             // modulation order (M-PSK / M-QAM)
  // constellation sink
  snr_db?: number
}

/* ─── Unified circuit node/edge types ─── */
export type CircuitNodeData =
  | GateNodeData
  | MuxNodeData
  | FlipFlopNodeData
  | AnalogNodeData
  | SystemBlockNodeData

// @xyflow/react requires the node data generic to satisfy Record<string, unknown>.
// Intersecting with an index signature preserves the discriminated union while
// satisfying that constraint.
export type CircuitNode = Node<CircuitNodeData & Record<string, unknown>>
export type CircuitEdge = Edge & {
  data?: {
    signalDirection?: 'forward' | 'backward'
    wireColor?: string
  }
}

/* ─── Netlist JSON (persisted to Supabase) ─── */
export interface NetlistJSON {
  domain: DomainType
  nodes: CircuitNode[]
  edges: CircuitEdge[]
  version: number
}

/* ─── Domain type ─── */
export type DomainType = 'digital' | 'analog' | 'system'
