import { Plot } from '../../lib/plotly'
import { useArtifactStore } from '../../store/artifactStore'
import { EmptyPanel } from './EmptyPanel'

export function TimingDiagramPanel() {
  const timing = useArtifactStore((s) => s.artifacts.timing_diagram)

  if (!timing?.signals?.length) {
    return <EmptyPanel label="Run simulation to see the timing diagram" />
  }

  const traces = timing.signals.map((sig, i) => ({
    x: sig.timepoints,
    y: sig.values.map((v) => v + i * 1.5),
    type: 'scatter' as const,
    mode: 'lines' as const,
    name: sig.name,
    line: { shape: 'hv' as const, width: 2 },
  }))

  return (
    <div className="p-4 animate-fade-in">
      <Plot
        data={traces}
        layout={{
          title: { text: 'Timing Diagram', font: { color: '#9097a0', size: 14 } },
          xaxis: { title: { text: 'Time' }, gridcolor: '#31363f', color: '#9097a0', zerolinecolor: '#444b55' },
          yaxis: { showticklabels: false, gridcolor: '#31363f', zerolinecolor: '#444b55' },
          paper_bgcolor: '#24282f',
          plot_bgcolor: '#24282f',
          font: { color: '#9097a0', family: 'JetBrains Mono, monospace', size: 11 },
          margin: { t: 40, r: 20, b: 60, l: 40 },
          showlegend: true,
          legend: { font: { color: '#9097a0', size: 10 } },
        }}
        config={{ responsive: true }}
        className="w-full"
        useResizeHandler
        style={{ width: '100%', height: '300px' }}
      />
    </div>
  )
}
