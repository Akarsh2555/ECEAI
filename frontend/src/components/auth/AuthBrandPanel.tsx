import { Zap, CircuitBoard, Waves, Bot, Check } from 'lucide-react'

const POINTS = [
  { icon: <CircuitBoard size={15} />, text: 'Digital, analog & comms on one canvas' },
  { icon: <Bot size={15} />, text: 'A LangGraph AI copilot that streams live' },
  { icon: <Waves size={15} />, text: 'Truth tables, Bode plots, spectra & Verilog' },
]

/** Left-hand showcase panel for the auth screens (hidden below lg). */
export function AuthBrandPanel() {
  return (
    <div className="hidden lg:flex flex-col justify-between w-[44%] max-w-2xl relative overflow-hidden bg-slate-900 border-r border-slate-800 p-12">
      {/* Ambient glow + dotted grid */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-24 -left-10 w-96 h-96 rounded-full blur-3xl" style={{ background: 'rgba(255,108,55,0.12)' }} />
        <div className="absolute bottom-0 right-0 w-80 h-80 rounded-full blur-3xl" style={{ background: 'rgba(40,185,204,0.08)' }} />
        <div className="absolute inset-0 opacity-[0.5]" style={{ backgroundImage: 'radial-gradient(#2a2f37 1px, transparent 1px)', backgroundSize: '22px 22px' }} />
      </div>

      <div className="relative">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-indigo-500 to-indigo-700 flex items-center justify-center">
            <Zap size={18} className="text-white" />
          </div>
          <span className="font-semibold text-slate-100 text-lg tracking-tight">ECE Copilot</span>
        </div>
      </div>

      <div className="relative">
        <span className="eyebrow-mono text-slate-500">AI-native ECE IDE</span>
        <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-100 leading-tight">
          Design circuits at the<br /><span style={{ color: '#ff6c37' }}>speed of thought.</span>
        </h2>
        <ul className="mt-8 space-y-3.5">
          {POINTS.map((p) => (
            <li key={p.text} className="flex items-center gap-3 text-slate-300">
              <span
                className="w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0"
                style={{ color: '#ff6c37', backgroundColor: 'rgba(255,108,55,0.12)', border: '1px solid rgba(255,108,55,0.25)' }}
              >
                {p.icon}
              </span>
              <span className="text-sm">{p.text}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="relative flex items-center gap-2 text-slate-500">
        <Check size={14} style={{ color: '#4caf61' }} />
        <span className="text-sm">Trusted for digital, analog & signal design</span>
      </div>
    </div>
  )
}
