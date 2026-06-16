import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import type { GateNodeData, GateType } from '../../../types/canvas'

/* SVG path data for each gate symbol */
const GATE_SYMBOLS: Record<GateType, { path: string; viewBox: string }> = {
  AND: {
    path: 'M4 2 H12 Q20 2 20 10 Q20 18 12 18 H4 Z',
    viewBox: '0 0 24 20',
  },
  OR: {
    path: 'M4 2 Q8 2 12 10 Q8 18 4 18 Q10 10 4 2 Z M12 10 Q16 2 20 10 Q16 18 12 10 Z',
    viewBox: '0 0 24 20',
  },
  NOT: {
    path: 'M4 2 L18 10 L4 18 Z M19 10 A2 2 0 1 0 23 10 A2 2 0 1 0 19 10',
    viewBox: '0 0 26 20',
  },
  NAND: {
    path: 'M4 2 H12 Q20 2 20 10 Q20 18 12 18 H4 Z M21 10 A2 2 0 1 0 25 10 A2 2 0 1 0 21 10',
    viewBox: '0 0 28 20',
  },
  NOR: {
    path: 'M4 2 Q8 2 12 10 Q8 18 4 18 Q10 10 4 2 Z M12 10 Q16 2 20 10 Q16 18 12 10 Z M21 10 A2 2 0 1 0 25 10 A2 2 0 1 0 21 10',
    viewBox: '0 0 28 20',
  },
  XOR: {
    path: 'M6 2 Q10 2 14 10 Q10 18 6 18 Q12 10 6 2 Z M14 10 Q18 2 22 10 Q18 18 14 10 Z M2 2 Q8 10 2 18',
    viewBox: '0 0 26 20',
  },
  XNOR: {
    path: 'M6 2 Q10 2 14 10 Q10 18 6 18 Q12 10 6 2 Z M14 10 Q18 2 22 10 Q18 18 14 10 Z M2 2 Q8 10 2 18 M23 10 A2 2 0 1 0 27 10 A2 2 0 1 0 23 10',
    viewBox: '0 0 30 20',
  },
  INPUT: {
    path: 'M4 4 H16 V16 H4 Z',
    viewBox: '0 0 20 20',
  },
  OUTPUT: {
    path: 'M2 4 H12 L18 10 L12 16 H2 Z',
    viewBox: '0 0 20 20',
  },
  CLOCK: {
    path: 'M2 10 L6 10 L6 4 L12 4 L12 16 L18 16 L18 10 L22 10',
    viewBox: '0 0 24 20',
  },
}

const GATE_COLORS: Record<GateType, string> = {
  AND: '#6366f1',
  OR: '#818cf8',
  NOT: '#f43f5e',
  NAND: '#a855f7',
  NOR: '#ec4899',
  XOR: '#06b6d4',
  XNOR: '#14b8a6',
  INPUT: '#3b82f6',
  OUTPUT: '#f59e0b',
  CLOCK: '#10b981',
}

function GateNodeComponent({ data, selected }: NodeProps) {
  const gateData = data as unknown as GateNodeData
  const symbol = GATE_SYMBOLS[gateData.type]
  const color = GATE_COLORS[gateData.type] || '#3b82f6'
  const isClockOrInput = gateData.type === 'INPUT' || gateData.type === 'CLOCK'
  const inputCount = gateData.inputHandles?.length ?? (gateData.type === 'NOT' ? 1 : (isClockOrInput ? 0 : 2))
  const hasOutput = gateData.type !== 'OUTPUT'

  const isRound = gateData.type === 'INPUT' || gateData.type === 'OUTPUT' || gateData.type === 'CLOCK'

  return (
    <div
      className={`
        relative px-4 py-3 ${isRound ? 'rounded-full' : 'rounded-xl'} border transition-colors bg-[#0f1011] flex items-center gap-3
      `}
      style={{ 
        minWidth: 160,
        borderColor: selected ? color : '#23252a'
      }}
    >
      {/* Input handles */}
      {Array.from({ length: inputCount }).map((_, i) => (
        <Handle
          key={`in-${i}`}
          type="target"
          position={Position.Left}
          id={gateData.inputHandles?.[i] || `in-${i}`}
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
        className={`flex-shrink-0 w-10 h-10 ${isRound ? 'rounded-full' : 'rounded-lg'} flex items-center justify-center shadow-sm`} 
        style={{ backgroundColor: color }}
      >
        <svg width="24" height="16" viewBox={symbol.viewBox}>
          <path d={symbol.path} fill="none" stroke="#ffffff" strokeWidth="2.5" />
        </svg>
      </div>

      {/* Text Area */}
      <div className="flex flex-col justify-center">
        <span className="text-sm font-medium text-slate-200 tracking-wide font-sans">
          {gateData.type}
        </span>
        <span className="text-[10px] text-slate-500 uppercase tracking-wider font-mono">
          {gateData.label && gateData.label !== gateData.type ? gateData.label : 'LOGIC GATE'}
        </span>
      </div>

      {/* Output handle */}
      {hasOutput && (
        <Handle
          type="source"
          position={Position.Right}
          id={gateData.outputHandles?.[0] || 'out'}
          style={{
            background: color,
            border: `2px solid #0f1011`,
            width: 10,
            height: 10,
            right: -5,
          }}
        />
      )}
    </div>
  )
}

export const GateNode = memo(GateNodeComponent)
