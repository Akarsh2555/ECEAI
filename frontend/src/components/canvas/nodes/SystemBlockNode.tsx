import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import type { SystemBlockNodeData, SystemBlockType } from '../../../types/canvas'

const SOURCES: SystemBlockType[] = ['STEP', 'SINE', 'COSINE', 'SQUARE', 'IMPULSE', 'RAMP', 'CONSTANT', 'MESSAGE', 'CARRIER', 'NOISE', 'BITSTREAM']
const SINKS: SystemBlockType[] = ['SCOPE', 'SPECTRUM', 'OUTPUT', 'CONSTELLATION']
const MODULATORS: SystemBlockType[] = ['FM', 'PM', 'ASK', 'FSK', 'BPSK', 'PSK', 'QPSK', 'QAM']

const COLORS: Record<string, string> = {
  source: '#10b981',
  dynamic: '#6366f1',
  algebraic: '#f59e0b',
  modulator: '#ff6c37',
  sink: '#06b6d4',
}

function kindOf(t: SystemBlockType): keyof typeof COLORS {
  if (SOURCES.includes(t)) return 'source'
  if (SINKS.includes(t)) return 'sink'
  if (MODULATORS.includes(t)) return 'modulator'
  if (t === 'GAIN' || t === 'SUM' || t === 'PRODUCT') return 'algebraic'
  return 'dynamic'
}

/** Small inner glyph/formula shown inside the block body. */
function blockGlyph(d: SystemBlockNodeData): string {
  switch (d.type) {
    case 'STEP': return '⎍'
    case 'RAMP': return '╱'
    case 'SINE': return '∿'
    case 'SQUARE': return '⊓⊔'
    case 'IMPULSE': return 'δ'
    case 'CONSTANT': return String(d.amplitude ?? 1)
    case 'GAIN': return `▷ ${d.gain ?? 1}`
    case 'SUM': return (d.signs ?? ['+', '-']).join(' ')
    case 'INTEGRATOR': return '1/s'
    case 'DERIVATIVE': return 'du/dt'
    case 'SCOPE': return '▱'
    case 'OUTPUT': return 'y'
    case 'COSINE': return '∿'
    case 'NOISE': return '⁘'
    case 'MESSAGE': return `m·t`
    case 'CARRIER': return `cos ωc`
    case 'PRODUCT': return '×'
    case 'LPF': return 'LPF'
    case 'BITSTREAM': return '101'
    case 'FM': return 'FM'
    case 'PM': return 'PM'
    case 'ASK': return 'ASK'
    case 'FSK': return 'FSK'
    case 'BPSK': return 'BPSK'
    case 'PSK': return `${d.M ?? 8}PSK`
    case 'QPSK': return 'QPSK'
    case 'QAM': return `${d.M ?? 16}QAM`
    case 'CONSTELLATION': return '⊕'
    case 'SPECTRUM': return '▮▭'
    case 'TF': {
      const num = (d.num ?? [1]).join(' ')
      const den = (d.den ?? [1, 1]).join(' ')
      return `${num} ⁄ ${den}`
    }
    default: return ''
  }
}

function SystemBlockComponent({ data, selected }: NodeProps) {
  const d = data as unknown as SystemBlockNodeData
  const kind = kindOf(d.type)
  const color = COLORS[kind]
  const isSource = kind === 'source'
  const isSink = kind === 'sink'
  const inputCount = isSource ? 0
    : d.type === 'SUM' ? (d.signs?.length ?? 2)
    : d.type === 'PRODUCT' ? 2
    : 1

  return (
    <div
      className={`
        relative px-4 py-3 rounded-xl border transition-colors bg-[#0f1011] flex items-center gap-3
      `}
      style={{
        minWidth: 160,
        borderColor: selected ? color : '#23252a'
      }}
    >
      {Array.from({ length: inputCount }).map((_, i) => (
        <Handle
          key={`in-${i}`}
          type="target"
          position={Position.Left}
          id={`in-${i}`}
          style={{
            top: `${((i + 1) / (inputCount + 1)) * 100}%`,
            background: '#0f1011',
            border: `2px solid ${color}`,
            width: 10,
            height: 10,
            left: -5,
          }}
        />
      ))}

      {/* Icon Area */}
      <div 
        className="flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center shadow-sm" 
        style={{ backgroundColor: color }}
      >
        <span className="text-xl font-mono font-bold leading-none text-white">{blockGlyph(d)}</span>
      </div>

      {/* Text Area */}
      <div className="flex flex-col justify-center text-left">
        <span className="text-sm font-medium text-slate-200 tracking-wide font-sans">
          {d.type}
        </span>
        <span className="text-[10px] text-slate-500 uppercase tracking-wider font-mono">
          {d.label || 'SYSTEM BLOCK'}
        </span>
      </div>

      {!isSink && (
        <Handle
          type="source"
          position={Position.Right}
          id="out"
          style={{ background: '#0f1011', border: `2px solid ${color}`, width: 10, height: 10, right: -5 }}
        />
      )}
    </div>
  )
}

export const SystemBlockNode = memo(SystemBlockComponent)
