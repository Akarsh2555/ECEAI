import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import type { MuxNodeData } from '../../../types/canvas'

function MuxNodeComponent({ data, selected }: NodeProps) {
  const muxData = data as unknown as MuxNodeData
  const isMux = muxData.type === 'MUX'
  const dataCount = muxData.dataPins?.length || 4
  const selCount = muxData.selectorPins?.length || 2
  const color = isMux ? '#06b6d4' : '#10b981'

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
      {/* Data input handles (left for MUX, right for DEMUX) */}
      {Array.from({ length: dataCount }).map((_, i) => (
        <Handle
          key={`d-${i}`}
          type={isMux ? 'target' : 'source'}
          position={isMux ? Position.Left : Position.Right}
          id={muxData.dataPins?.[i] || `d${i}`}
          style={{
            top: `${((i + 1) / (dataCount + 1)) * 100}%`,
            background: '#0f1011',
            border: '2px solid #06b6d4',
            width: 10,
            height: 10,
            [isMux ? 'left' : 'right']: -5,
          }}
        />
      ))}

      {/* Selector handles (bottom) */}
      {Array.from({ length: selCount }).map((_, i) => (
        <Handle
          key={`s-${i}`}
          type="target"
          position={Position.Bottom}
          id={muxData.selectorPins?.[i] || `s${i}`}
          style={{
            left: `${((i + 1) / (selCount + 1)) * 100}%`,
            background: '#0f1011',
            border: '2px solid #f59e0b',
            width: 10,
            height: 10,
            bottom: -5,
          }}
        />
      ))}

      {/* Output handle (right for MUX, left for DEMUX) */}
      <Handle
        type={isMux ? 'source' : 'target'}
        position={isMux ? Position.Right : Position.Left}
        id={muxData.outputPins?.[0] || 'out'}
        style={{
          background: '#0f1011',
          border: '2px solid #10b981',
          width: 10,
          height: 10,
          [isMux ? 'right' : 'left']: -5,
        }}
      />

      {/* Icon Area */}
      <div 
        className="flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center shadow-sm" 
        style={{ backgroundColor: color }}
      >
        <span className="text-sm font-mono font-bold leading-none text-white">{muxData.type}</span>
      </div>

      {/* Text Area */}
      <div className="flex flex-col justify-center text-left">
        <span className="text-sm font-medium text-slate-200 tracking-wide font-sans">
          {muxData.label || (isMux ? 'MULTIPLEXER' : 'DEMULTIPLEXER')}
        </span>
        <span className="text-[10px] text-slate-500 uppercase tracking-wider font-mono">
          {dataCount}:{isMux ? '1' : dataCount} • {selCount} SEL
        </span>
      </div>
    </div>
  )
}

export const MuxNode = memo(MuxNodeComponent)
