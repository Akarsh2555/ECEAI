import { useCanvasStore } from '../../store/canvasStore'
import { Trash2, SlidersHorizontal } from 'lucide-react'

/** Numeric fields to expose per block/component type. */
const NUMERIC_FIELDS: Record<string, { key: string; label: string }[]> = {
  STEP: [{ key: 'amplitude', label: 'Amplitude' }, { key: 'step_time', label: 'Step time (s)' }],
  RAMP: [{ key: 'amplitude', label: 'Slope' }, { key: 'step_time', label: 'Start (s)' }],
  SINE: [{ key: 'amplitude', label: 'Amplitude' }, { key: 'frequency', label: 'Frequency (Hz)' }, { key: 'phase', label: 'Phase (°)' }, { key: 'offset', label: 'Offset' }],
  SQUARE: [{ key: 'amplitude', label: 'Amplitude' }, { key: 'frequency', label: 'Frequency (Hz)' }],
  IMPULSE: [{ key: 'amplitude', label: 'Amplitude' }],
  CONSTANT: [{ key: 'amplitude', label: 'Value' }],
  GAIN: [{ key: 'gain', label: 'Gain' }],
  // communication blocks
  MESSAGE: [{ key: 'amplitude', label: 'Amplitude' }, { key: 'frequency', label: 'Message freq fm (Hz)' }, { key: 'phase', label: 'Phase (°)' }],
  CARRIER: [{ key: 'amplitude', label: 'Amplitude' }, { key: 'frequency', label: 'Carrier freq fc (Hz)' }, { key: 'phase', label: 'Phase (°)' }],
  COSINE: [{ key: 'amplitude', label: 'Amplitude' }, { key: 'frequency', label: 'Frequency (Hz)' }, { key: 'phase', label: 'Phase (°)' }],
  NOISE: [{ key: 'amplitude', label: 'Amplitude' }],
  LPF: [{ key: 'cutoff_hz', label: 'Cutoff (Hz)' }],
  // digital data + modulators
  BITSTREAM: [{ key: 'bit_rate', label: 'Bit rate Rb (bits/s)' }],
  FM: [{ key: 'frequency', label: 'Carrier fc (Hz)' }, { key: 'amplitude', label: 'Amplitude Ac' }, { key: 'sensitivity', label: 'Freq sensitivity kf (Hz/V)' }],
  PM: [{ key: 'frequency', label: 'Carrier fc (Hz)' }, { key: 'amplitude', label: 'Amplitude Ac' }, { key: 'sensitivity', label: 'Phase sensitivity kp (rad/V)' }],
  ASK: [{ key: 'frequency', label: 'Carrier fc (Hz)' }, { key: 'amplitude', label: 'Amplitude Ac' }],
  FSK: [{ key: 'frequency', label: 'Carrier fc (Hz)' }, { key: 'amplitude', label: 'Amplitude Ac' }, { key: 'freq_dev', label: 'Freq deviation Δf (Hz)' }],
  BPSK: [{ key: 'frequency', label: 'Carrier fc (Hz)' }, { key: 'amplitude', label: 'Amplitude Ac' }],
  QPSK: [{ key: 'frequency', label: 'Carrier fc (Hz)' }, { key: 'amplitude', label: 'Amplitude Ac' }],
  PSK: [{ key: 'frequency', label: 'Carrier fc (Hz)' }, { key: 'amplitude', label: 'Amplitude Ac' }, { key: 'M', label: 'Order M (2,4,8,16)' }],
  QAM: [{ key: 'frequency', label: 'Carrier fc (Hz)' }, { key: 'amplitude', label: 'Amplitude Ac' }, { key: 'M', label: 'Order M (4,16,64)' }],
  CONSTELLATION: [{ key: 'snr_db', label: 'Channel SNR (dB)' }],
  // analog components
  R: [{ key: 'value', label: 'Resistance' }],
  C: [{ key: 'value', label: 'Capacitance' }],
  L: [{ key: 'value', label: 'Inductance' }],
}

function NumberField({
  label, value, onChange,
}: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <label className="block">
      <span className="block text-[11px] text-slate-500 mb-1">{label}</span>
      <input
        type="number"
        value={Number.isFinite(value) ? value : 0}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full px-2.5 py-1.5 bg-slate-800/60 border border-slate-700 rounded-md text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500/40"
      />
    </label>
  )
}

function PolyField({
  label, value, onChange,
}: { label: string; value: number[]; onChange: (v: number[]) => void }) {
  return (
    <label className="block">
      <span className="block text-[11px] text-slate-500 mb-1">{label}</span>
      <input
        type="text"
        defaultValue={(value ?? []).join(', ')}
        onBlur={(e) => {
          const parsed = e.target.value
            .split(',')
            .map((s) => parseFloat(s.trim()))
            .filter((n) => Number.isFinite(n))
          onChange(parsed.length ? parsed : [0])
        }}
        placeholder="e.g. 1, 0.5"
        className="w-full px-2.5 py-1.5 bg-slate-800/60 border border-slate-700 rounded-md text-sm font-mono text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500/40"
      />
    </label>
  )
}

export function NodeInspector() {
  const { nodes, selectedNodeId, updateNodeData, removeNode, setSelectedNodeId } = useCanvasStore()
  const node = nodes.find((n) => n.id === selectedNodeId)

  if (!node) {
    return (
      <div className="p-4 text-center">
        <SlidersHorizontal size={20} className="mx-auto text-slate-700 mb-2" />
        <p className="text-xs text-slate-600">Select a block to edit its parameters</p>
      </div>
    )
  }

  const data = node.data as Record<string, unknown>
  const blockType = String(data.type ?? '')
  const fields = NUMERIC_FIELDS[blockType] ?? []

  return (
    <div className="p-3 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-slate-300 uppercase tracking-wide">{blockType}</span>
        <button
          onClick={() => { removeNode(node.id); setSelectedNodeId(null) }}
          className="p-1 rounded text-slate-600 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
          title="Delete block"
        >
          <Trash2 size={13} />
        </button>
      </div>

      <label className="block">
        <span className="block text-[11px] text-slate-500 mb-1">Label</span>
        <input
          type="text"
          value={String(data.label ?? '')}
          onChange={(e) => updateNodeData(node.id, { label: e.target.value })}
          className="w-full px-2.5 py-1.5 bg-slate-800/60 border border-slate-700 rounded-md text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500/40"
        />
      </label>

      {fields.map((f) => (
        <NumberField
          key={f.key}
          label={f.label}
          value={Number(data[f.key] ?? 0)}
          onChange={(v) => updateNodeData(node.id, { [f.key]: v })}
        />
      ))}

      {blockType === 'TF' && (
        <>
          <PolyField label="Numerator" value={data.num as number[]} onChange={(v) => updateNodeData(node.id, { num: v })} />
          <PolyField label="Denominator" value={data.den as number[]} onChange={(v) => updateNodeData(node.id, { den: v })} />
          <p className="text-[10px] text-slate-600 font-mono">
            H(s) = ({(data.num as number[] ?? [1]).join(' ')}) / ({(data.den as number[] ?? [1, 1]).join(' ')})
          </p>
        </>
      )}

      {blockType === 'BITSTREAM' && (
        <label className="block">
          <span className="block text-[11px] text-slate-500 mb-1">Bit pattern (0/1, repeats)</span>
          <input
            type="text"
            defaultValue={String(data.pattern ?? '1011001010011101')}
            onBlur={(e) => {
              const cleaned = e.target.value.replace(/[^01]/g, '') || '1011001010011101'
              updateNodeData(node.id, { pattern: cleaned })
            }}
            placeholder="e.g. 10110010"
            className="w-full px-2.5 py-1.5 bg-slate-800/60 border border-slate-700 rounded-md text-sm font-mono text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500/40"
          />
        </label>
      )}

      {blockType === 'SUM' && (
        <label className="block">
          <span className="block text-[11px] text-slate-500 mb-1">Signs (per input)</span>
          <input
            type="text"
            defaultValue={(data.signs as string[] ?? ['+', '-']).join(' ')}
            onBlur={(e) => {
              const signs = e.target.value.split(/\s+/).map((s) => (s === '-' ? '-' : '+'))
              updateNodeData(node.id, { signs })
            }}
            className="w-full px-2.5 py-1.5 bg-slate-800/60 border border-slate-700 rounded-md text-sm font-mono text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500/40"
          />
        </label>
      )}
    </div>
  )
}
