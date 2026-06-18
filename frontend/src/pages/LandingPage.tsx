import { useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { ArrowRight, Sparkles, Zap, Cpu, Activity, Shield, Bot, Radio } from 'lucide-react'

function HeroBackgroundGraphic() {
  return (
    <div className="absolute top-[310px] left-1/2 -translate-x-1/2 -translate-y-1/2 w-[900px] h-[900px] pointer-events-none opacity-60 flex items-center justify-center -z-10">
      <svg viewBox="0 0 800 800" className="w-full h-full animate-[spin_180s_linear_infinite]">
        
        {/* Outer Ring */}
        <circle cx="400" cy="400" r="360" fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="1" />
        
        {/* Ticks */}
        {Array.from({ length: 36 }).map((_, i) => (
          <line
            key={`tick-${i}`}
            x1="400" y1="40" x2="400" y2="70"
            stroke="rgba(255,255,255,0.08)"
            strokeWidth="1.5"
            transform={`rotate(${i * 10} 400 400)`}
          />
        ))}

        {/* Orbiting concentric rings */}
        <circle cx="400" cy="400" r="300" fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="1" strokeDasharray="4 8" />
        <circle cx="400" cy="400" r="220" fill="none" stroke="rgba(249,115,22,0.04)" strokeWidth="1" />

        {/* Dense overlapping ellipses (Wireframe Torus) */}
        {Array.from({ length: 60 }).map((_, i) => (
          <ellipse
            key={`ellipse-${i}`}
            cx="400" cy="400"
            rx="280" ry="80"
            fill="none"
            stroke="rgba(249,115,22,0.05)"
            strokeWidth="1"
            transform={`rotate(${i * 6} 400 400)`}
          />
        ))}

        {/* Inner spiky fibrous bursts */}
        {Array.from({ length: 120 }).map((_, i) => {
          const r = Math.abs(Math.sin(i * 3.14)) * 80 + 120; // 120 to 200
          return (
            <line
              key={`spike-${i}`}
              x1="400" y1="280" x2="400" y2={400 - r - 80}
              stroke="rgba(255,255,255,0.06)"
              strokeWidth="1"
              transform={`rotate(${i * 3} 400 400)`}
            />
          )
        })}

        {/* Inner empty core ring */}
        <circle cx="400" cy="400" r="110" fill="#0c0c0c" stroke="rgba(249,115,22,0.15)" strokeWidth="1.5" />
        <circle cx="400" cy="400" r="100" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="1" strokeDasharray="2 4" />
      </svg>
    </div>
  )
}

export function LandingPage() {
  const { user, loading } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (user && !loading) {
      navigate('/dashboard', { replace: true })
    }
  }, [user, loading, navigate])

  return (
    <div className="min-h-screen bg-[#0c0c0c] font-sans overflow-x-hidden selection:bg-orange-500/30 flex flex-col relative">
      
      {/* Background Grid & Light Flares */}
      <div className="absolute inset-0 pointer-events-none z-0">
        {/* Subtle Grid covering the whole page */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff05_1px,transparent_1px),linear-gradient(to_bottom,#ffffff05_1px,transparent_1px)] bg-[size:64px_64px]" />
        
        {/* Fixed Diagonal Light Flares (stays in top right as you scroll) */}
        <div className="fixed -top-64 -right-64 w-[800px] h-[800px] bg-orange-500/10 blur-[100px] rounded-full transform rotate-45 pointer-events-none" />
        <div className="fixed -top-32 -right-32 w-[1000px] h-[200px] bg-gradient-to-r from-transparent via-orange-500/20 to-transparent blur-[60px] transform -rotate-45 pointer-events-none" />
      </div>



      {/* Main Navbar */}
      <nav className="relative z-50 flex items-center justify-between px-8 py-5">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-500 to-indigo-700 flex items-center justify-center">
            <Zap className="w-4 h-4 text-white" />
          </div>
          <span className="text-white font-bold text-lg tracking-wide">ELECTO</span>
        </div>

        <div className="hidden md:flex items-center gap-1 text-[13px] font-medium text-slate-400 bg-[#161616] border border-white/5 rounded-xl p-1 shadow-xl">
          <a href="#" className="bg-orange-500 text-white px-3 py-1 rounded-lg flex items-center gap-1.5 transition-colors shadow-sm">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
              <polyline points="9 22 9 12 15 12 15 22"></polyline>
            </svg>
            Products
          </a>
          <a href="#" className="hover:text-white hover:bg-white/5 px-3 py-1 rounded-lg transition-colors">Pricing</a>
          <a href="#" className="hover:text-white hover:bg-white/5 px-3 py-1 rounded-lg transition-colors">Resources</a>
          <a href="#" className="hover:text-white hover:bg-white/5 px-3 py-1 rounded-lg transition-colors">Partners</a>
          <a href="#" className="hover:text-white hover:bg-white/5 px-3 py-1 rounded-lg transition-colors">Why Us</a>
        </div>

        <div className="flex items-center gap-4">
          <Link to="/login" className="text-sm font-medium text-slate-300 hover:text-white transition-colors hidden sm:block">
            Log in
          </Link>
          <Link to="/login" className="text-sm font-medium text-slate-300 hover:text-white transition-colors px-4 py-2 rounded-full border border-white/10 bg-white/5 hover:bg-white/10">
            Contact us
          </Link>
          <Link to="/signup" className="text-sm font-semibold text-white px-5 py-2 rounded-full bg-[#f97316] hover:bg-[#ea580c] transition-colors shadow-[0_0_20px_rgba(249,115,22,0.4)]">
            Sign up for free
          </Link>
        </div>
      </nav>

      {/* Hero Section */}
      <main className="relative z-10 flex-1 flex flex-col items-center pt-16 md:pt-24 px-6 min-h-[90vh]">
        
        <HeroBackgroundGraphic />

        <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs font-medium text-slate-300 mb-8 backdrop-blur-sm cursor-pointer hover:bg-white/10 transition-colors">
          <Sparkles size={12} className="text-orange-500" />
          Beta release
        </div>

        <h1 className="text-5xl md:text-7xl font-semibold text-white tracking-tight mb-6 text-center">
          Intelligence at the Edge
        </h1>
        
        <p className="text-slate-400 text-base md:text-lg max-w-2xl text-center leading-relaxed mb-12">
          Boost your hardware design's speed and efficiency globally by bringing LangGraph inference directly to your canvas. Enjoy component-level customization and real-time validation for a best-in-class EDA experience.
        </p>

        <div className="flex items-center gap-4 mb-16">
          <Link to="/signup" className="px-8 py-3.5 rounded-full bg-[#f97316] text-white font-semibold hover:bg-[#ea580c] transition-colors shadow-[0_0_30px_rgba(249,115,22,0.3)]">
            Get started
          </Link>
          <Link to="/login" className="px-8 py-3.5 rounded-full bg-[#1a1a1a] border border-white/10 text-white font-medium hover:bg-white/5 transition-colors">
            Book a demo
          </Link>
        </div>

        <div className="relative w-full max-w-5xl h-[500px] flex items-center justify-center mt-4">
          
          <div className="absolute z-20 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-40 h-40 rounded-[2.5rem] bg-[#111111] border border-white/5 shadow-[0_0_60px_rgba(0,0,0,0.9)] flex items-center justify-center group">
            <div className="absolute -left-2 top-6 bottom-6 flex flex-col justify-between py-2">
              {[1,2,3,4,5].map(i => <div key={i} className="w-2 h-1.5 bg-slate-600/80 rounded-l" />)}
            </div>
            <div className="absolute -right-2 top-6 bottom-6 flex flex-col justify-between py-2">
              {[1,2,3,4,5].map(i => <div key={i} className="w-2 h-1.5 bg-slate-600/80 rounded-r" />)}
            </div>
            <div className="absolute -top-2 left-6 right-6 flex justify-between px-2">
              {[1,2,3,4,5].map(i => <div key={i} className="w-1.5 h-2 bg-slate-600/80 rounded-t" />)}
            </div>
            <div className="absolute -bottom-2 left-6 right-6 flex justify-between px-2">
              {[1,2,3,4,5].map(i => <div key={i} className="w-1.5 h-2 bg-slate-600/80 rounded-b" />)}
            </div>
            
            <span className="text-5xl font-bold text-white tracking-wider opacity-90">AI</span>
            <div className="absolute inset-0 rounded-[2.5rem] shadow-[inset_0_0_40px_rgba(255,255,255,0.02)] pointer-events-none" />
          </div>

          <svg viewBox="0 0 1024 500" className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full pointer-events-none" style={{ filter: 'drop-shadow(0 0 10px rgba(249,115,22,0.6))' }}>
            <defs>
              <linearGradient id="glow" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#f97316" stopOpacity="0" />
                <stop offset="50%" stopColor="#f97316" stopOpacity="1" />
                <stop offset="100%" stopColor="#f97316" stopOpacity="0" />
              </linearGradient>
            </defs>

            {/* Left Traces */}
            <path d="M 512 250 L 300 250 L 250 172 L 172 172" fill="none" stroke="#2a2a2a" strokeWidth="2" />
            <path d="M 512 270 L 300 270 L 260 348 L 138 348" fill="none" stroke="#2a2a2a" strokeWidth="2" />
            
            {/* Right Traces */}
            <path d="M 512 230 L 700 230 L 760 152 L 862 152" fill="none" stroke="#2a2a2a" strokeWidth="2" />
            <path d="M 512 250 L 700 250 L 750 274 L 894 274" fill="none" stroke="#2a2a2a" strokeWidth="2" />
            <path d="M 512 280 L 700 280 L 730 372 L 862 372" fill="none" stroke="#2a2a2a" strokeWidth="2" />

            {/* Bottom Trace */}
            <path d="M 512 250 L 512 460" fill="none" stroke="#2a2a2a" strokeWidth="2" />
            <path d="M 488 250 L 488 290 L 410 368 L 410 430" fill="none" stroke="#2a2a2a" strokeWidth="2" />

            {/* Glowing animated dashes */}
            <path d="M 512 250 L 300 250 L 250 172 L 172 172" fill="none" stroke="url(#glow)" strokeWidth="3" strokeDasharray="60 500" className="animate-[dash_3s_linear_infinite]" />
            <path d="M 512 230 L 700 230 L 760 152 L 862 152" fill="none" stroke="url(#glow)" strokeWidth="3" strokeDasharray="60 500" className="animate-[dash_4s_linear_infinite_reverse]" />
            <path d="M 512 280 L 700 280 L 730 372 L 862 372" fill="none" stroke="url(#glow)" strokeWidth="3" strokeDasharray="60 500" className="animate-[dash_3.5s_linear_infinite]" />
            <path d="M 512 250 L 512 460" fill="none" stroke="url(#glow)" strokeWidth="3" strokeDasharray="60 500" className="animate-[dash_2.5s_linear_infinite]" />
            <path d="M 488 250 L 488 290 L 410 368 L 410 430" fill="none" stroke="url(#glow)" strokeWidth="3" strokeDasharray="60 500" className="animate-[dash_3.2s_linear_infinite_reverse]" />
          </svg>

          {/* Top Left: Capacitor */}
          <div className="absolute top-[140px] left-[140px] w-16 h-16 rounded-2xl bg-[#1a1a1a] border border-white/5 flex items-center justify-center shadow-lg hover:border-orange-500/50 transition-colors">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-400">
              <path d="M 12 2 L 12 10" />
              <path d="M 6 10 L 18 10" />
              <path d="M 6 14 L 18 14" />
              <path d="M 12 14 L 12 22" />
            </svg>
          </div>
          {/* Bottom Left: Resistor */}
          <div className="absolute top-[320px] left-[100px] w-14 h-14 rounded-2xl bg-[#1a1a1a] border border-orange-500/40 flex items-center justify-center shadow-[0_0_20px_rgba(249,115,22,0.2)] hover:border-orange-500 transition-colors">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-orange-400">
              <path d="M 2 12 L 6 12 L 8 8 L 12 16 L 16 8 L 18 12 L 22 12" />
            </svg>
          </div>
          
          {/* Top Right: AND Gate */}
          <div className="absolute top-[120px] right-[130px] w-16 h-16 rounded-2xl bg-[#1a1a1a] border border-white/5 flex items-center justify-center shadow-lg hover:border-orange-500/50 transition-colors">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-300">
              <path d="M 4 4 L 12 4 C 18 4 20 8 20 12 C 20 16 18 20 12 20 L 4 20 Z" />
              <path d="M 0 8 L 4 8" />
              <path d="M 0 16 L 4 16" />
              <path d="M 20 12 L 24 12" />
            </svg>
          </div>
          {/* Mid Right: Ground */}
          <div className="absolute top-[250px] right-[70px] w-12 h-12 rounded-xl bg-[#1a1a1a] border border-white/5 flex items-center justify-center shadow-lg hover:border-orange-500/50 transition-colors">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-400">
              <path d="M 12 4 L 12 14" />
              <path d="M 6 14 L 18 14" />
              <path d="M 8 18 L 16 18" />
              <path d="M 10 22 L 14 22" />
            </svg>
          </div>
          {/* Bottom Right: Op-Amp */}
          <div className="absolute top-[340px] right-[100px] w-16 h-16 rounded-2xl bg-[#1a1a1a] border border-white/5 flex items-center justify-center shadow-lg hover:border-orange-500/50 transition-colors">
            <svg width="32" height="32" viewBox="0 0 26 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-400">
              <path d="M 6 4 L 20 12 L 6 20 Z" />
              <path d="M 0 8 L 6 8" />
              <path d="M 0 16 L 6 16" />
              <path d="M 20 12 L 26 12" />
            </svg>
          </div>
          {/* Bottom Center: Diode */}
          <div className="absolute top-[432px] left-[484px] w-14 h-14 rounded-2xl bg-[#1a1a1a] border border-white/5 flex items-center justify-center shadow-lg hover:border-orange-500/50 transition-colors">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-300">
              <path d="M 2 12 L 8 12" />
              <path d="M 8 6 L 8 18 L 16 12 Z" />
              <path d="M 16 6 L 16 18" />
              <path d="M 16 12 L 22 12" />
            </svg>
          </div>
          {/* Bottom Left Center: Inductor */}
          <div className="absolute top-[402px] left-[382px] w-14 h-14 rounded-2xl bg-[#1a1a1a] border border-white/5 flex items-center justify-center shadow-lg hover:border-orange-500/50 transition-colors">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-400">
              <path d="M 2 12 L 5 12" />
              <path d="M 5 12 C 5 7 9 7 9 12 C 9 7 13 7 13 12 C 13 7 17 7 17 12" />
              <path d="M 17 12 L 20 12" />
            </svg>
          </div>
        </div>
      </main>

      {/* Editor Preview Section */}
      <section className="relative z-10 w-full max-w-7xl mx-auto py-24 px-6 border-t border-white/5 mt-12">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-5xl font-bold text-white mb-6">Experience the Workspace.</h2>
          <p className="text-slate-400 text-lg max-w-2xl mx-auto">
            A fully immersive, premium canvas built for designing, simulating, and analyzing complex circuits with AI-assisted precision.
          </p>
        </div>
        <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
          {/* Card 1: Digital */}
          <div className="bg-[#121212] border border-white/5 rounded-[2rem] p-3 shadow-2xl shadow-black/50 hover:border-orange-500/30 transition-all duration-500 group">
            <div className="rounded-3xl overflow-hidden border border-white/5 bg-[#0a0a0a] relative">
              <div className="absolute inset-0 bg-gradient-to-t from-[#121212] to-transparent opacity-50 z-10"></div>
              <img src="/analog-editor-preview.png" alt="Digital Circuit Editor" className="w-full h-auto object-cover opacity-80 group-hover:opacity-100 group-hover:scale-105 transition-all duration-700 ease-out" />
            </div>
            <div className="mt-6 px-5 pb-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-8 h-8 rounded-full bg-orange-500/10 flex items-center justify-center border border-orange-500/20">
                  <Activity size={14} className="text-orange-500" />
                </div>
                <h3 className="text-lg font-semibold text-white">Digital Logic Copilot</h3>
              </div>
              <p className="text-slate-400 text-sm leading-relaxed">
                Design and simulate logic gates, flip-flops, and full architectures with real-time AI timing analysis.
              </p>
            </div>
          </div>
          
          {/* Card 2: Analog */}
          <div className="bg-[#121212] border border-white/5 rounded-[2rem] p-3 shadow-2xl shadow-black/50 hover:border-orange-500/30 transition-all duration-500 group md:mt-12">
            <div className="rounded-3xl overflow-hidden border border-white/5 bg-[#0a0a0a] relative">
              <div className="absolute inset-0 bg-gradient-to-t from-[#121212] to-transparent opacity-50 z-10"></div>
              <img src="/digital-editor-preview.png" alt="Analog Circuit Editor" className="w-full h-auto object-cover opacity-80 group-hover:opacity-100 group-hover:scale-105 transition-all duration-700 ease-out" />
            </div>
            <div className="mt-6 px-5 pb-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-8 h-8 rounded-full bg-orange-500/10 flex items-center justify-center border border-orange-500/20">
                  <Cpu size={14} className="text-orange-500" />
                </div>
                <h3 className="text-lg font-semibold text-white">Analog Processing</h3>
              </div>
              <p className="text-slate-400 text-sm leading-relaxed">
                Build op-amp circuits, filters, and amplifiers with instant Bode plots and frequency charts.
              </p>
            </div>
          </div>
        </div>

        {/* Card 3: Communication System — full width */}
        <div className="mt-8 max-w-5xl mx-auto bg-[#121212] border border-white/5 rounded-[2rem] p-3 shadow-2xl shadow-black/50 hover:border-orange-500/30 transition-all duration-500 group">
          <div className="rounded-3xl overflow-hidden border border-white/5 bg-[#0a0a0a] relative">
            <div className="absolute inset-0 bg-gradient-to-t from-[#121212] to-transparent opacity-50 z-10"></div>
            <img src="/Screenshot 2026-06-18 162415.png" alt="Communication System Editor" className="w-full h-auto object-cover opacity-80 group-hover:opacity-100 group-hover:scale-[1.02] transition-all duration-700 ease-out" />
          </div>
          <div className="mt-6 px-5 pb-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-8 h-8 rounded-full bg-orange-500/10 flex items-center justify-center border border-orange-500/20">
                <Radio size={14} className="text-orange-500" />
              </div>
              <h3 className="text-lg font-semibold text-white">Communication Systems</h3>
            </div>
            <p className="text-slate-400 text-sm leading-relaxed">
              Simulate and analyze AM/FM modulators, channel noise, mixers, and full transceiver chains with real-time spectral analysis.
            </p>
          </div>
        </div>
      </section>

      {/* Minimal Footer */}
      <footer className="relative z-10 border-t border-white/5 py-12 px-6">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-md bg-gradient-to-br from-indigo-500 to-indigo-700 flex items-center justify-center">
              <Zap className="w-3 h-3 text-white" />
            </div>
            <span className="text-slate-300 font-semibold text-sm">ELECTO</span>
          </div>
          <p className="text-slate-500 text-sm">© 2026 Electo. Engineered for excellence.</p>
        </div>
      </footer>

      <style>{`
        @keyframes dash {
          from {
            stroke-dashoffset: 560;
          }
          to {
            stroke-dashoffset: 0;
          }
        }
      `}</style>
    </div>
  )
}
