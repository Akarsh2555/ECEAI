import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import type { AnalogNodeData, AnalogComponentType } from '../../../types/canvas'

const ANALOG_ICONS: Record<AnalogComponentType, { path: string; viewBox: string; color: string; fill?: string }> = {
  R: {
    path: 'M 0 10 L 8 10 L 10 4 L 14 16 L 18 4 L 22 16 L 24 10 L 32 10',
    viewBox: '0 0 32 20',
    color: '#f59e0b',
  },
  C: {
    path: 'M 0 10 L 14 10 M 14 2 L 14 18 M 18 2 L 18 18 M 18 10 L 32 10',
    viewBox: '0 0 32 20',
    color: '#06b6d4',
  },
  L: {
    path: 'M 0 10 L 6 10 C 6 2, 12 2, 12 10 C 12 2, 18 2, 18 10 C 18 2, 24 2, 24 10 L 32 10',
    viewBox: '0 0 32 20',
    color: '#a855f7',
  },
  DIODE: {
    path: 'M 0 10 L 12 10 L 12 4 L 20 10 L 12 16 Z M 20 4 L 20 16 M 20 10 L 32 10',
    viewBox: '0 0 32 20',
    color: '#10b981',
    fill: '#10b981',
  },
  OPAMP: {
    path: 'M 4 2 L 4 18 L 24 10 Z M 8 6 L 12 6 M 8 14 L 12 14 M 10 12 L 10 16 M 0 6 L 4 6 M 0 14 L 4 14 M 24 10 L 32 10',
    viewBox: '0 0 32 20',
    color: '#f43f5e',
  },
  BJT: {
    path: 'M 0 16 L 10 16 M 10 8 L 10 24 M 10 12 L 18 4 L 18 0 M 10 20 L 18 28 L 18 32 M 16 23 L 18 28 L 13 27 Z',
    viewBox: '0 0 24 32',
    color: '#ec4899',
  },
  MOSFET: {
    path: 'M 0 16 L 8 16 M 8 8 L 8 24 M 12 8 L 12 12 M 12 14 L 12 18 M 12 20 L 12 24 M 12 10 L 20 10 L 20 0 M 12 22 L 20 22 L 20 32',
    viewBox: '0 0 24 32',
    color: '#6366f1',
  },
  AC_SOURCE: {
    path: 'M 16 2 A 8 8 0 1 0 16 18 A 8 8 0 1 0 16 2 Z M 11 10 Q 13.5 6 16 10 T 21 10 M 0 10 L 8 10 M 24 10 L 32 10',
    viewBox: '0 0 32 20',
    color: '#0ea5e9',
  },
  DC_SOURCE: {
    path: 'M 0 10 L 12 10 M 12 2 L 12 18 M 20 6 L 20 14 M 20 10 L 32 10 M 8 4 L 10 4 M 9 3 L 9 5',
    viewBox: '0 0 32 20',
    color: '#ef4444',
  },
  GROUND: {
    path: 'M 16 0 L 16 10 M 8 10 L 24 10 M 11 14 L 21 14 M 14 18 L 18 18',
    viewBox: '0 0 32 20',
    color: '#10b981',
  },
}

const HANDLE_CONFIG: Record<string, { type: 'source' | 'target'; position: Position; style: any }> = {
  p1: { type: 'target', position: Position.Left, style: { top: '50%' } },
  p2: { type: 'source', position: Position.Right, style: { top: '50%' } },
  anode: { type: 'target', position: Position.Left, style: { top: '50%' } },
  cathode: { type: 'source', position: Position.Right, style: { top: '50%' } },
  inv: { type: 'target', position: Position.Left, style: { top: '30%' } },
  non_inv: { type: 'target', position: Position.Left, style: { top: '70%' } },
  out: { type: 'source', position: Position.Right, style: { top: '50%' } },
  base: { type: 'target', position: Position.Left, style: { top: '50%' } },
  emitter: { type: 'source', position: Position.Bottom, style: { left: '75%' } },
  collector: { type: 'target', position: Position.Top, style: { left: '75%' } },
  gate: { type: 'target', position: Position.Left, style: { top: '50%' } },
  source: { type: 'source', position: Position.Bottom, style: { left: '83%' } },
  drain: { type: 'target', position: Position.Top, style: { left: '83%' } },
  gnd: { type: 'target', position: Position.Top, style: { left: '50%' } },
}

const ALL_PINS: Record<AnalogComponentType, string[]> = {
  R: ['p1', 'p2'],
  C: ['p1', 'p2'],
  L: ['p1', 'p2'],
  DIODE: ['anode', 'cathode'],
  OPAMP: ['inv', 'non_inv', 'out'],
  BJT: ['base', 'collector', 'emitter'],
  MOSFET: ['gate', 'drain', 'source'],
  AC_SOURCE: ['p1', 'p2'],
  DC_SOURCE: ['p1', 'p2'],
  GROUND: ['gnd'],
}

function AnalogNodeComponent({ data, selected }: NodeProps) {
  const aData = data as unknown as AnalogNodeData
  const { path, viewBox, color, fill } = ANALOG_ICONS[aData.type]
  const pins = ALL_PINS[aData.type]

  return (
    <div
      className={`
        relative flex flex-col items-center justify-center transition-all duration-200
        ${selected ? 'drop-shadow-[0_0_6px_rgba(255,255,255,0.2)]' : ''}
      `}
      style={{ minWidth: 64, minHeight: 48 }}
    >
      {/* Handles */}
      {pins.map((pin) => {
        const config = HANDLE_CONFIG[pin]
        return (
          <Handle
            key={pin}
            type={config.type}
            position={config.position}
            id={pin}
            style={{
              ...config.style,
              background: '#0f1011',
              border: `2px solid ${color}`,
              width: 8,
              height: 8,
            }}
          />
        )
      })}

      {/* SVG Icon */}
      <svg width={aData.type === 'BJT' || aData.type === 'MOSFET' ? '48' : '64'} height={aData.type === 'BJT' || aData.type === 'MOSFET' ? '64' : '40'} viewBox={viewBox} className="overflow-visible">
        <path d={path} fill={fill || 'none'} stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>

      {/* Labels */}
      <div className="absolute -top-6 text-center w-full whitespace-nowrap">
        <div className="text-[11px] font-mono font-bold text-slate-200 tracking-wider" style={{ color }}>
          {aData.label || aData.type}
        </div>
        {aData.value !== undefined && (
          <div className="text-[9px] text-slate-400 font-mono mt-0.5">
            {aData.value}{aData.unit}
          </div>
        )}
      </div>
    </div>
  )
}

export const AnalogNode = memo(AnalogNodeComponent)

