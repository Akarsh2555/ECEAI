import { Plot } from '../../lib/plotly'
import { useArtifactStore } from '../../store/artifactStore'
import { EmptyPanel } from './EmptyPanel'

const LINE_COLORS = ['#f59e0b', '#06b6d4', '#6366f1', '#10b981', '#f43f5e']

/** Frequency-domain magnitude spectrum of the simulation sinks — this is where
 * modulation sidebands (e.g. DSB-SC at fc±fm) become visible. */
export function SpectrumPanel() {
  const sim = useArtifactStore((s) => s.artifacts.simulation)
  const spectra = sim?.spectra

  if (!spectra || !spectra.length) {
    return <EmptyPanel label="Run a system/communication circuit (e.g. Message × Carrier) to see its spectrum." />
  }

  // Trim the plotted range to where there is meaningful energy so the sidebands
  // are easy to read instead of being squashed against the axis.
  const allFreqs = spectra[0].freqs
  let maxIdx = allFreqs.length - 1
  for (let i = allFreqs.length - 1; i >= 0; i--) {
    if (spectra.some((s) => s.magnitude[i] > 0.02)) { maxIdx = Math.min(allFreqs.length - 1, i + Math.floor(allFreqs.length * 0.1)); break }
  }

  return (
    <div className="p-4 animate-fade-in">
      <Plot
        data={spectra.map((s, i) => ({
          x: s.freqs.slice(0, maxIdx),
          y: s.magnitude.slice(0, maxIdx),
          type: 'scatter',
          mode: 'lines',
          name: s.label,
          line: { color: LINE_COLORS[i % LINE_COLORS.length], width: 2 },
          fill: 'tozeroy',
          fillcolor: 'rgba(245,158,11,0.08)',
        }))}
        layout={{
          title: { text: 'Spectrum — Magnitude', font: { color: '#9097a0', size: 14 } },
          xaxis: { title: { text: 'Frequency (Hz)' }, gridcolor: '#31363f', color: '#9097a0', zerolinecolor: '#444b55' },
          yaxis: { title: { text: 'Magnitude' }, gridcolor: '#31363f', color: '#9097a0', zerolinecolor: '#444b55' },
          paper_bgcolor: '#24282f',
          plot_bgcolor: '#24282f',
          font: { color: '#9097a0', family: 'JetBrains Mono, monospace', size: 11 },
          margin: { t: 40, r: 20, b: 50, l: 55 },
          showlegend: true,
          legend: { font: { color: '#9097a0', size: 10 } },
        }}
        config={{ responsive: true }}
        className="w-full"
        useResizeHandler
        style={{ width: '100%', height: '320px' }}
      />
    </div>
  )
}
