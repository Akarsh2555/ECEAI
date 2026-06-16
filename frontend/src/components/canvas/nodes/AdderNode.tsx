import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'

interface AdderData {
  type: 'HALFADDER' | 'FULLADDER'
  label?: string
}

const COLOR = '#8b5cf6'

/** Prebuilt arithmetic blocks: half adder (A,B → Sum,Carry) and
 *  full adder (A,B,Cin → Sum,Cout). Single composite node — the backend
 *  expands it into gate logic for the truth table and Verilog. */
function AdderNodeComponent({ data, selected }: NodeProps) {
  const d = data as unknown as AdderData
  const isFull = d.type === 'FULLADDER'
  const inputs = isFull ? ['a', 'b', 'cin'] : ['a', 'b']
  const outputs = isFull ? ['sum', 'cout'] : ['sum', 'carry']

  return (
    <div
      className="relative px-4 py-3 rounded-xl border transition-colors bg-[#0f1011] flex items-center gap-3"
      style={{ minWidth: 170, borderColor: selected ? COLOR : '#23252a' }}
    >
      {/* Inputs (left) */}
      {inputs.map((pin, i) => (
        <div key={pin}>
          <Handle
            type="target"
            position={Position.Left}
            id={pin}
            style={{
              top: `${((i + 1) / (inputs.length + 1)) * 100}%`,
              background: '#0f1011', border: `2px solid ${COLOR}`, width: 10, height: 10, left: -5,
            }}
          />
          <span
            className="absolute text-[8px] text-violet-300 font-mono"
            style={{ left: 4, top: `calc(${((i + 1) / (inputs.length + 1)) * 100}% - 6px)` }}
          >
            {pin.toUpperCase()}
          </span>
        </div>
      ))}

      {/* Outputs (right) */}
      {outputs.map((pin, i) => (
        <div key={pin}>
          <Handle
            type="source"
            position={Position.Right}
            id={pin}
            style={{
              top: `${((i + 1) / (outputs.length + 1)) * 100}%`,
              background: '#0f1011', border: `2px solid #10b981`, width: 10, height: 10, right: -5,
            }}
          />
          <span
            className="absolute right-1 text-[8px] text-emerald-300 font-mono"
            style={{ top: `calc(${((i + 1) / (outputs.length + 1)) * 100}% - 6px)` }}
          >
            {pin === 'cout' || pin === 'carry' ? 'C' : 'S'}
          </span>
        </div>
      ))}

      {/* Icon */}
      <div className="flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center shadow-sm" style={{ backgroundColor: COLOR }}>
        <span className="text-lg font-mono font-bold leading-none text-white">Σ</span>
      </div>

      {/* Label */}
      <div className="flex flex-col justify-center text-left">
        <span className="text-sm font-medium text-slate-200 tracking-wide font-sans">
          {d.label || (isFull ? 'Full Adder' : 'Half Adder')}
        </span>
        <span className="text-[10px] text-slate-500 uppercase tracking-wider font-mono">
          {isFull ? 'A B Cin → S Cout' : 'A B → S Carry'}
        </span>
      </div>
    </div>
  )
}

export const AdderNode = memo(AdderNodeComponent)
