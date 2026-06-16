import { useState } from 'react'
import { Plot } from '../../lib/plotly'
import { useArtifactStore } from '../../store/artifactStore'
import { EmptyPanel } from './EmptyPanel'
import type { ConstellationData } from '../../types/agent'

function ConstellationPlot({ c, showNoise }: { c: ConstellationData; showNoise: boolean }) {
  const ideal = c.ideal ?? []
  const symbols = c.symbols ?? []
  const noisy = c.noisy ?? []

  // Axis range from the widest set of points, padded.
  const all = [...ideal, ...symbols, ...(showNoise ? noisy : [])]
  const m = Math.max(1.2, ...all.map((p) => Math.max(Math.abs(p.i), Math.abs(p.q)))) * 1.2

  const data: Record<string, unknown>[] = []

  if (showNoise && noisy.length) {
    data.push({
      x: noisy.map((p) => p.i),
      y: noisy.map((p) => p.q),
      type: 'scattergl',
      mode: 'markers',
      name: `Received (AWGN${c.snr_db != null ? `, ${c.snr_db} dB` : ''})`,
      marker: { color: '#28b9cc', size: 5, opacity: 0.5 },
    })
  }

  // Ideal reference grid with Gray-code bit labels.
  data.push({
    x: ideal.map((p) => p.i),
    y: ideal.map((p) => p.q),
    type: 'scatter',
    mode: 'markers+text',
    name: 'Ideal symbols',
    text: ideal.map((p) => p.bits),
    textposition: 'top center',
    textfont: { color: '#9097a0', size: 9, family: 'JetBrains Mono, monospace' },
    marker: { color: '#ff6c37', size: 11, symbol: 'x', line: { width: 2 } },
  })

  return (
    <div className="mb-4">
      <Plot
        data={data}
        layout={{
          title: {
            text: `${c.label} — ${c.scheme}${c.M > 2 ? ` (M=${c.M})` : ''}, ${c.bits_per_symbol} bit/sym`,
            font: { color: '#9097a0', size: 13 },
          },
          xaxis: {
            title: { text: c.axes?.i ?? 'In-phase (I)' }, range: [-m, m],
            gridcolor: '#31363f', color: '#9097a0', zerolinecolor: '#5a6270', zerolinewidth: 1,
          },
          yaxis: {
            title: { text: c.axes?.q ?? 'Quadrature (Q)' }, range: [-m, m],
            gridcolor: '#31363f', color: '#9097a0', zerolinecolor: '#5a6270', zerolinewidth: 1,
            scaleanchor: 'x', scaleratio: 1,
          },
          paper_bgcolor: '#24282f',
          plot_bgcolor: '#24282f',
          font: { color: '#9097a0', family: 'JetBrains Mono, monospace', size: 11 },
          margin: { t: 44, r: 20, b: 50, l: 60 },
          showlegend: true,
          legend: { font: { color: '#9097a0', size: 10 }, orientation: 'h', y: -0.2 },
        }}
        config={{ responsive: true }}
        useResizeHandler
        style={{ width: '100%', height: '380px' }}
      />
    </div>
  )
}

export function ConstellationPanel() {
  const sim = useArtifactStore((s) => s.artifacts.simulation)
  const [showNoise, setShowNoise] = useState(true)
  const constellations = sim?.constellations ?? []

  if (!constellations.length) {
    return (
      <EmptyPanel label="Add a digital modulator (ASK/FSK/BPSK/QPSK/QAM) fed by a Bitstream, wire it into a Constellation block, then Run the simulation." />
    )
  }

  return (
    <div className="p-4 animate-fade-in">
      <div className="flex items-center justify-end mb-2">
        <button
          onClick={() => setShowNoise((v) => !v)}
          className={`px-2.5 py-1 text-xs rounded border transition-colors ${
            showNoise
              ? 'bg-cyan-500/15 text-cyan-300 border-cyan-500/40'
              : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-slate-200'
          }`}
        >
          {showNoise ? 'Noise: ON' : 'Noise: OFF'}
        </button>
      </div>
      {constellations.map((c) => (
        <ConstellationPlot key={c.id} c={c} showNoise={showNoise} />
      ))}
    </div>
  )
}
