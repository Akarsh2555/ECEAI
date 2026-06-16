import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import type { FlipFlopNodeData } from '../../../types/canvas'

const FF_COLORS: Record<string, string> = {
  D: '#a855f7',
  JK: '#ec4899',
  SR: '#f97316',
}

function FlipFlopNodeComponent({ data, selected }: NodeProps) {
  const ffData = data as unknown as FlipFlopNodeData
  const color = FF_COLORS[ffData.type] || '#a855f7'

  const inputLabels: string[] =
    ffData.type === 'D' ? ['D'] :
    ffData.type === 'JK' ? ['J', 'K'] :
    ['S', 'R']

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
      {/* Data inputs */}
      {inputLabels.map((label, i) => (
        <Handle
          key={`in-${label}`}
          type="target"
          position={Position.Left}
          id={label.toLowerCase()}
          style={{
            top: `${((i + 1) / (inputLabels.length + 2)) * 100}%`,
            background: '#0f1011',
            border: `2px solid ${color}`,
            width: 10,
            height: 10,
            left: -5,
          }}
        />
      ))}

      {/* Clock input */}
      <Handle
        type="target"
        position={Position.Left}
        id="clk"
        style={{
          top: `${((inputLabels.length + 1) / (inputLabels.length + 2)) * 100}%`,
          background: '#0f1011',
          border: '2px solid #f59e0b',
          width: 10,
          height: 10,
          left: -5,
        }}
      />

      {/* Asynchronous PRESET (Q→1, top) — active-high. Shown unless explicitly
          disabled, so flip-flops placed before this pin existed still get it. */}
      {ffData.hasPreset !== false && (
        <>
          <Handle
            type="target"
            position={Position.Top}
            id="pre"
            style={{ left: '50%', background: '#0f1011', border: '2px solid #22d3ee', width: 10, height: 10, top: -5 }}
          />
          <div className="absolute left-1/2 -translate-x-1/2 top-[-16px] text-[8px] text-cyan-400 font-mono">PRE</div>
        </>
      )}

      {/* Asynchronous CLR (Q→0, bottom) — active-high. Shown unless explicitly disabled. */}
      {ffData.hasReset !== false && (
        <>
          <Handle
            type="target"
            position={Position.Bottom}
            id="clr"
            style={{ left: '50%', background: '#0f1011', border: '2px solid #f43f5e', width: 10, height: 10, bottom: -5 }}
          />
          <div className="absolute left-1/2 -translate-x-1/2 bottom-[-16px] text-[8px] text-rose-400 font-mono">CLR</div>
        </>
      )}

      {/* Icon Area */}
      <div 
        className="flex-shrink-0 w-10 h-10 rounded-lg flex flex-col items-center justify-center shadow-sm" 
        style={{ backgroundColor: color }}
      >
        <span className="text-sm font-mono font-bold leading-none text-white">{ffData.type} FF</span>
        <div className="flex items-center gap-1 text-[8px] text-white/90 mt-0.5">
          {ffData.clockEdge === 'rising' ? '↑' : '↓'}
        </div>
      </div>

      {/* Text Area */}
      <div className="flex flex-col justify-center text-left">
        <span className="text-sm font-medium text-slate-200 tracking-wide font-sans">
          {ffData.label || 'FLIP FLOP'}
        </span>
        <span className="text-[10px] text-slate-500 uppercase tracking-wider font-mono">
          {inputLabels.join('/')} • CLK
        </span>
      </div>

      {/* Outputs: Q and Q' */}
      <Handle
        type="source"
        position={Position.Right}
        id="q"
        style={{ top: '33%', background: '#0f1011', border: '2px solid #10b981', width: 10, height: 10, right: -5 }}
      />
      <Handle
        type="source"
        position={Position.Right}
        id="q_bar"
        style={{ top: '66%', background: '#0f1011', border: '2px solid #ef4444', width: 10, height: 10, right: -5 }}
      />

      {/* Side labels */}
      <div className="absolute right-[-2px] top-[30%] translate-x-full text-[8px] text-emerald-400 font-mono ml-2">Q</div>
      <div className="absolute right-[-2px] top-[63%] translate-x-full text-[8px] text-red-400 font-mono ml-2">Q̄</div>
    </div>
  )
}

export const FlipFlopNode = memo(FlipFlopNodeComponent)
