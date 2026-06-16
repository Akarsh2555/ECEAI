import { type DragEvent } from 'react'
import { useCanvasStore } from '../../store/canvasStore'
import { NodeInspector } from './NodeInspector'
import {
  CircuitBoard, ToggleLeft, Binary, Cpu, Waves,
  Zap, Disc, Triangle, Radio, LogIn, LogOut,
  StepForward, Plus, Sigma, Activity, Monitor, FunctionSquare,
  X, RadioTower, AudioLines, BarChart3, Filter,
  Battery, ArrowDownToLine, Clock,
  Antenna, Spline, Grid3x3, Binary as BinaryIcon
} from 'lucide-react'
import type { DomainType } from '../../types/canvas'

interface PaletteItem {
  nodeType: string
  label: string
  icon: React.ReactNode
  data: Record<string, unknown>
}

const DIGITAL_ITEMS: PaletteItem[] = [
  { nodeType: 'gate', label: 'Input', icon: <LogIn size={14} />, data: { type: 'INPUT', label: 'IN', inputHandles: [], outputHandles: ['out'] } },
  { nodeType: 'gate', label: 'Output', icon: <LogOut size={14} />, data: { type: 'OUTPUT', label: 'OUT', inputHandles: ['in-0'], outputHandles: [] } },
  { nodeType: 'gate', label: 'Clock', icon: <Clock size={14} />, data: { type: 'CLOCK', label: 'CLK', inputHandles: [], outputHandles: ['out'] } },
  { nodeType: 'gate', label: 'AND', icon: <CircuitBoard size={14} />, data: { type: 'AND', label: 'AND', inputHandles: ['in-0', 'in-1'], outputHandles: ['out'] } },
  { nodeType: 'gate', label: 'OR', icon: <CircuitBoard size={14} />, data: { type: 'OR', label: 'OR', inputHandles: ['in-0', 'in-1'], outputHandles: ['out'] } },
  { nodeType: 'gate', label: 'NOT', icon: <CircuitBoard size={14} />, data: { type: 'NOT', label: 'NOT', inputHandles: ['in-0'], outputHandles: ['out'] } },
  { nodeType: 'gate', label: 'NAND', icon: <CircuitBoard size={14} />, data: { type: 'NAND', label: 'NAND', inputHandles: ['in-0', 'in-1'], outputHandles: ['out'] } },
  { nodeType: 'gate', label: 'NOR', icon: <CircuitBoard size={14} />, data: { type: 'NOR', label: 'NOR', inputHandles: ['in-0', 'in-1'], outputHandles: ['out'] } },
  { nodeType: 'gate', label: 'XOR', icon: <CircuitBoard size={14} />, data: { type: 'XOR', label: 'XOR', inputHandles: ['in-0', 'in-1'], outputHandles: ['out'] } },
  { nodeType: 'gate', label: 'XNOR', icon: <CircuitBoard size={14} />, data: { type: 'XNOR', label: 'XNOR', inputHandles: ['in-0', 'in-1'], outputHandles: ['out'] } },
  { nodeType: 'mux', label: 'MUX 4:1', icon: <ToggleLeft size={14} />, data: { type: 'MUX', label: 'MUX', selectorPins: ['s0', 's1'], dataPins: ['d0', 'd1', 'd2', 'd3'], outputPins: ['out'], bitWidth: 4 } },
  { nodeType: 'mux', label: 'DEMUX 1:4', icon: <ToggleLeft size={14} />, data: { type: 'DEMUX', label: 'DEMUX', selectorPins: ['s0', 's1'], dataPins: ['d0', 'd1', 'd2', 'd3'], outputPins: ['in'], bitWidth: 4 } },
  { nodeType: 'flipflop', label: 'D Flip-Flop', icon: <Binary size={14} />, data: { type: 'D', label: 'D-FF', clockEdge: 'rising', hasReset: true, hasPreset: true } },
  { nodeType: 'flipflop', label: 'JK Flip-Flop', icon: <Binary size={14} />, data: { type: 'JK', label: 'JK-FF', clockEdge: 'rising', hasReset: true, hasPreset: true } },
  { nodeType: 'flipflop', label: 'SR Flip-Flop', icon: <Binary size={14} />, data: { type: 'SR', label: 'SR-FF', clockEdge: 'rising', hasReset: true, hasPreset: true } },
  { nodeType: 'adder', label: 'Half Adder', icon: <Sigma size={14} />, data: { type: 'HALFADDER', label: 'Half Adder' } },
  { nodeType: 'adder', label: 'Full Adder', icon: <Sigma size={14} />, data: { type: 'FULLADDER', label: 'Full Adder' } },
]

const ANALOG_ITEMS: PaletteItem[] = [
  { nodeType: 'analog', label: 'Resistor', icon: <Zap size={14} />, data: { type: 'R', label: 'R1', value: 1000, unit: 'Ω' } },
  { nodeType: 'analog', label: 'Capacitor', icon: <Disc size={14} />, data: { type: 'C', label: 'C1', value: 100, unit: 'nF' } },
  { nodeType: 'analog', label: 'Inductor', icon: <Waves size={14} />, data: { type: 'L', label: 'L1', value: 10, unit: 'mH' } },
  { nodeType: 'analog', label: 'Diode', icon: <Triangle size={14} />, data: { type: 'DIODE', label: 'D1' } },
  { nodeType: 'analog', label: 'BJT', icon: <Cpu size={14} />, data: { type: 'BJT', label: 'Q1', model: 'NPN' } },
  { nodeType: 'analog', label: 'MOSFET', icon: <Cpu size={14} />, data: { type: 'MOSFET', label: 'M1', model: 'NMOS' } },
  { nodeType: 'analog', label: 'Op-Amp', icon: <Triangle size={14} />, data: { type: 'OPAMP', label: 'U1' } },
  { nodeType: 'analog', label: 'DC Source', icon: <Battery size={14} />, data: { type: 'DC_SOURCE', label: 'V1', value: 5, unit: 'V' } },
  { nodeType: 'analog', label: 'AC Source', icon: <Waves size={14} />, data: { type: 'AC_SOURCE', label: 'V2', value: 5, unit: 'V' } },
  { nodeType: 'analog', label: 'Ground', icon: <ArrowDownToLine size={14} />, data: { type: 'GROUND', label: 'GND' } },
]

const SYSTEM_ITEMS: PaletteItem[] = [
  { nodeType: 'systemBlock', label: 'Step', icon: <StepForward size={14} />, data: { type: 'STEP', label: 'Step', amplitude: 1, step_time: 0 } },
  { nodeType: 'systemBlock', label: 'Sine', icon: <Waves size={14} />, data: { type: 'SINE', label: 'Sine', amplitude: 1, frequency: 1, phase: 0, offset: 0 } },
  { nodeType: 'systemBlock', label: 'Square', icon: <Radio size={14} />, data: { type: 'SQUARE', label: 'Square', amplitude: 1, frequency: 1 } },
  { nodeType: 'systemBlock', label: 'Impulse', icon: <Zap size={14} />, data: { type: 'IMPULSE', label: 'Impulse', amplitude: 1 } },
  { nodeType: 'systemBlock', label: 'Sum', icon: <Plus size={14} />, data: { type: 'SUM', label: 'Sum', signs: ['+', '-'] } },
  { nodeType: 'systemBlock', label: 'Gain', icon: <Triangle size={14} />, data: { type: 'GAIN', label: 'Gain', gain: 2 } },
  { nodeType: 'systemBlock', label: 'Transfer Fn', icon: <FunctionSquare size={14} />, data: { type: 'TF', label: 'H(s)', num: [1], den: [1, 1] } },
  { nodeType: 'systemBlock', label: 'Integrator', icon: <Sigma size={14} />, data: { type: 'INTEGRATOR', label: 'Integrator' } },
  { nodeType: 'systemBlock', label: 'Derivative', icon: <Activity size={14} />, data: { type: 'DERIVATIVE', label: 'Derivative' } },
  { nodeType: 'systemBlock', label: 'Scope', icon: <Monitor size={14} />, data: { type: 'SCOPE', label: 'Scope' } },
  // ── Communications ──
  { nodeType: 'systemBlock', label: 'Message', icon: <AudioLines size={14} />, data: { type: 'MESSAGE', label: 'Message', amplitude: 1, frequency: 5 } },
  { nodeType: 'systemBlock', label: 'Carrier', icon: <RadioTower size={14} />, data: { type: 'CARRIER', label: 'Carrier', amplitude: 1, frequency: 50 } },
  { nodeType: 'systemBlock', label: 'Product (×)', icon: <X size={14} />, data: { type: 'PRODUCT', label: 'Mixer' } },
  { nodeType: 'systemBlock', label: 'Low-Pass Filter', icon: <Filter size={14} />, data: { type: 'LPF', label: 'LPF', cutoff_hz: 10 } },
  { nodeType: 'systemBlock', label: 'Spectrum', icon: <BarChart3 size={14} />, data: { type: 'SPECTRUM', label: 'Spectrum' } },
  // ── Analog angle modulation ──
  { nodeType: 'systemBlock', label: 'FM Modulator', icon: <Antenna size={14} />, data: { type: 'FM', label: 'FM', frequency: 100, amplitude: 1, sensitivity: 20 } },
  { nodeType: 'systemBlock', label: 'PM Modulator', icon: <Spline size={14} />, data: { type: 'PM', label: 'PM', frequency: 100, amplitude: 1, sensitivity: 1.5 } },
  // ── Digital data + modulation ──
  { nodeType: 'systemBlock', label: 'Bitstream', icon: <BinaryIcon size={14} />, data: { type: 'BITSTREAM', label: 'Data', pattern: '1011001010011101', bit_rate: 20 } },
  { nodeType: 'systemBlock', label: 'ASK / OOK', icon: <RadioTower size={14} />, data: { type: 'ASK', label: 'ASK', frequency: 200, amplitude: 1 } },
  { nodeType: 'systemBlock', label: 'FSK', icon: <RadioTower size={14} />, data: { type: 'FSK', label: 'FSK', frequency: 200, amplitude: 1, freq_dev: 80 } },
  { nodeType: 'systemBlock', label: 'BPSK', icon: <RadioTower size={14} />, data: { type: 'BPSK', label: 'BPSK', frequency: 200, amplitude: 1 } },
  { nodeType: 'systemBlock', label: 'QPSK', icon: <RadioTower size={14} />, data: { type: 'QPSK', label: 'QPSK', frequency: 200, amplitude: 1, M: 4 } },
  { nodeType: 'systemBlock', label: 'M-PSK', icon: <RadioTower size={14} />, data: { type: 'PSK', label: 'PSK', frequency: 200, amplitude: 1, M: 8 } },
  { nodeType: 'systemBlock', label: 'M-QAM', icon: <Grid3x3 size={14} />, data: { type: 'QAM', label: 'QAM', frequency: 200, amplitude: 1, M: 16 } },
  { nodeType: 'systemBlock', label: 'Constellation', icon: <Grid3x3 size={14} />, data: { type: 'CONSTELLATION', label: 'Constellation', snr_db: 15 } },
]

const PALETTES: Record<DomainType, PaletteItem[]> = {
  digital: DIGITAL_ITEMS,
  analog: ANALOG_ITEMS,
  system: SYSTEM_ITEMS,
}

const DOMAIN_TABS: { key: DomainType; label: string; color: string }[] = [
  { key: 'digital', label: 'Digital', color: '#6366f1' },
  { key: 'analog', label: 'Analog', color: '#10b981' },
  { key: 'system', label: 'System', color: '#06b6d4' },
]

export function NodePalette() {
  const { domain, setDomain, selectedNodeId } = useCanvasStore()
  const items = PALETTES[domain]

  const onDragStart = (event: DragEvent, item: PaletteItem) => {
    event.dataTransfer.setData(
      'application/ece-node',
      JSON.stringify({ nodeType: item.nodeType, data: item.data })
    )
    event.dataTransfer.effectAllowed = 'move'
  }

  return (
    <div className="w-56 bg-slate-900/80 backdrop-blur-sm border-r border-slate-800 flex flex-col h-full">
      {/* Domain tabs */}
      <div className="flex border-b border-slate-800">
        {DOMAIN_TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setDomain(tab.key)}
            className={`
              flex-1 py-2.5 text-xs font-medium transition-all duration-200
              ${domain === tab.key
                ? 'border-b-2 text-white'
                : 'text-slate-500 hover:text-slate-300'
              }
            `}
            style={{
              borderBottomColor: domain === tab.key ? tab.color : 'transparent',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Component list */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {items.map((item, index) => (
          <div
            key={`${item.label}-${index}`}
            draggable
            onDragStart={(e) => onDragStart(e, item)}
            className="
              flex items-center gap-2.5 px-3 py-2 rounded-lg cursor-grab
              bg-slate-800/40 hover:bg-slate-800/80 border border-transparent
              hover:border-slate-700 transition-all duration-150
              active:cursor-grabbing active:scale-95
            "
          >
            <span className="text-slate-400">{item.icon}</span>
            <span className="text-xs text-slate-300 font-medium">{item.label}</span>
          </div>
        ))}
      </div>

      {/* Inspector (shown when a node is selected) */}
      {selectedNodeId ? (
        <div className="border-t border-slate-800 max-h-80 overflow-y-auto bg-slate-900/60">
          <NodeInspector />
        </div>
      ) : (
        <div className="p-3 border-t border-slate-800">
          <p className="text-[10px] text-slate-600 text-center">
            Drag components onto the canvas
          </p>
        </div>
      )}
    </div>
  )
}
