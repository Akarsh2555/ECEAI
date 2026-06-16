import { Plot } from '../../lib/plotly'

import { useArtifactStore } from '../../store/artifactStore'
import { EmptyPanel } from './EmptyPanel'

export function BodePlotPanel() {
  const bode = useArtifactStore((s) => s.artifacts.bode_data || s.artifacts.signal_data)

  if (!bode || !('freqs_hz' in bode) || !bode.freqs_hz?.length) {
    return <EmptyPanel label="Run a filter design to see the Bode plot" />
  }

  return (
    <div className="flex flex-col gap-2 p-4 animate-fade-in">
      <Plot
        data={[{
          x: bode.freqs_hz,
          y: bode.magnitude_db,
          type: 'scatter',
          mode: 'lines',
          name: 'Magnitude (dB)',
          line: { color: '#ff6c37', width: 2 },
        }]}
        layout={{
          title: { text: 'Bode Plot — Magnitude', font: { color: '#9097a0', size: 14 } },
          xaxis: { title: { text: 'Frequency (Hz)' }, type: 'log', gridcolor: '#31363f', color: '#9097a0' },
          yaxis: { title: { text: 'Magnitude (dB)' }, gridcolor: '#31363f', color: '#9097a0' },
          paper_bgcolor: '#24282f',
          plot_bgcolor: '#24282f',
          font: { color: '#9097a0', family: 'JetBrains Mono, monospace', size: 11 },
          margin: { t: 40, r: 20, b: 60, l: 60 },
        }}
        config={{ responsive: true }}
        className="w-full"
        useResizeHandler
        style={{ width: '100%', height: '250px' }}
      />
      <Plot
        data={[{
          x: bode.freqs_hz,
          y: bode.phase_deg,
          type: 'scatter',
          mode: 'lines',
          name: 'Phase (°)',
          line: { color: '#f59e0b', width: 2 },
        }]}
        layout={{
          title: { text: 'Bode Plot — Phase', font: { color: '#9097a0', size: 14 } },
          xaxis: { title: { text: 'Frequency (Hz)' }, type: 'log', gridcolor: '#31363f', color: '#9097a0' },
          yaxis: { title: { text: 'Phase (°)' }, gridcolor: '#31363f', color: '#9097a0' },
          paper_bgcolor: '#24282f',
          plot_bgcolor: '#24282f',
          font: { color: '#9097a0', family: 'JetBrains Mono, monospace', size: 11 },
          margin: { t: 40, r: 20, b: 60, l: 60 },
        }}
        config={{ responsive: true }}
        className="w-full"
        useResizeHandler
        style={{ width: '100%', height: '250px' }}
      />
    </div>
  )
}
