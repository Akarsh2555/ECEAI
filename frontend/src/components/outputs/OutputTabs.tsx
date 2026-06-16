import { useArtifactStore } from '../../store/artifactStore'
import { useCanvasStore } from '../../store/canvasStore'
import { Table2, Activity, BarChart3, AudioWaveform, Code2, Download, LineChart, Grid3x3 } from 'lucide-react'
import { lazy, Suspense, useEffect } from 'react'
import { Spinner } from '../shared/Spinner'

const TruthTablePanel = lazy(() => import('./TruthTablePanel').then(m => ({ default: m.TruthTablePanel })))
const TimingDiagramPanel = lazy(() => import('./TimingDiagramPanel').then(m => ({ default: m.TimingDiagramPanel })))
const BodePlotPanel = lazy(() => import('./BodePlotPanel').then(m => ({ default: m.BodePlotPanel })))
const HdlCodePanel = lazy(() => import('./HdlCodePanel').then(m => ({ default: m.HdlCodePanel })))
const DownloadPanel = lazy(() => import('./DownloadPanel').then(m => ({ default: m.DownloadPanel })))
const SimulationPanel = lazy(() => import('./SimulationPanel').then(m => ({ default: m.SimulationPanel })))
const SpectrumPanel = lazy(() => import('./SpectrumPanel').then(m => ({ default: m.SpectrumPanel })))
const ConstellationPanel = lazy(() => import('./ConstellationPanel').then(m => ({ default: m.ConstellationPanel })))

interface TabDef {
  id: string
  label: string
  icon: React.ReactNode
  domains: string[]
}

const TABS: TabDef[] = [
  { id: 'simulation', label: 'Scope', icon: <LineChart size={13} />, domains: ['system'] },
  { id: 'spectrum', label: 'Spectrum', icon: <BarChart3 size={13} />, domains: ['system'] },
  { id: 'constellation', label: 'Constellation', icon: <Grid3x3 size={13} />, domains: ['system'] },
  { id: 'truth_table', label: 'Truth Table', icon: <Table2 size={13} />, domains: ['digital'] },
  { id: 'timing', label: 'Timing', icon: <Activity size={13} />, domains: ['digital'] },
  { id: 'bode', label: 'Bode Plot', icon: <AudioWaveform size={13} />, domains: ['analog'] },
  { id: 'hdl', label: 'HDL Code', icon: <Code2 size={13} />, domains: ['digital'] },
  { id: 'download', label: 'Download', icon: <Download size={13} />, domains: ['digital', 'analog', 'system'] },
]

export function OutputTabs() {
  const { activeTab, setActiveTab } = useArtifactStore()
  const domain = useCanvasStore((s) => s.domain)
  const visibleTabs = TABS.filter((t) => t.domains.includes(domain))

  // If the active tab isn't available for the current domain, fall back to the
  // first visible tab so the content area is never blank.
  useEffect(() => {
    if (visibleTabs.length && !visibleTabs.some((t) => t.id === activeTab)) {
      setActiveTab(visibleTabs[0].id)
    }
  }, [domain, activeTab, visibleTabs, setActiveTab])

  return (
    <div className="flex flex-col h-full bg-slate-900/60">
      {/* Tab bar */}
      <div className="flex border-b border-slate-800 overflow-x-auto">
        {visibleTabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`
              flex items-center gap-1.5 px-3 py-2 text-xs font-medium whitespace-nowrap
              transition-all duration-200 border-b-2
              ${activeTab === tab.id
                ? 'border-indigo-500 text-indigo-300 bg-indigo-600/5'
                : 'border-transparent text-slate-500 hover:text-slate-300'}
            `}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Panel content */}
      <div className="flex-1 overflow-auto">
        <Suspense fallback={<div className="flex items-center justify-center h-full"><Spinner /></div>}>
          {activeTab === 'simulation' && <SimulationPanel />}
          {activeTab === 'spectrum' && <SpectrumPanel />}
          {activeTab === 'constellation' && <ConstellationPanel />}
          {activeTab === 'truth_table' && <TruthTablePanel />}
          {activeTab === 'timing' && <TimingDiagramPanel />}
          {activeTab === 'bode' && <BodePlotPanel />}
          {activeTab === 'hdl' && <HdlCodePanel />}
          {activeTab === 'download' && <DownloadPanel designId="demo" />}
        </Suspense>
      </div>
    </div>
  )
}
