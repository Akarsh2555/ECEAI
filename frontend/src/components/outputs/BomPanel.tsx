import { useArtifactStore } from '../../store/artifactStore'
import { EmptyPanel } from './EmptyPanel'

export function BomPanel() {
  const bom = useArtifactStore((s) => s.artifacts.bom)

  if (!bom?.entries?.length) return <EmptyPanel label="Run analysis to see the Bill of Materials" />

  return (
    <div className="p-4 animate-fade-in space-y-4">
      <div className="overflow-auto rounded-lg border border-slate-800">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-slate-800/80">
              <th className="px-3 py-2 text-left text-slate-400 font-medium">Component</th>
              <th className="px-3 py-2 text-left text-slate-400 font-medium">Type</th>
              <th className="px-3 py-2 text-left text-slate-400 font-medium">Value</th>
              <th className="px-3 py-2 text-center text-slate-400 font-medium">Qty</th>
              <th className="px-3 py-2 text-right text-slate-400 font-medium">Unit $</th>
              <th className="px-3 py-2 text-right text-slate-400 font-medium">Total $</th>
              <th className="px-3 py-2 text-right text-slate-400 font-medium">Power (mW)</th>
            </tr>
          </thead>
          <tbody>
            {bom.entries.map((entry, i) => (
              <tr key={i} className="border-t border-slate-800/50 hover:bg-slate-800/30 transition-colors">
                <td className="px-3 py-1.5 font-mono text-slate-300">{entry.component}</td>
                <td className="px-3 py-1.5 text-slate-400">{entry.type}</td>
                <td className="px-3 py-1.5 text-slate-400">{entry.value}</td>
                <td className="px-3 py-1.5 text-center text-slate-300">{entry.quantity}</td>
                <td className="px-3 py-1.5 text-right text-slate-400">${entry.unitCost.toFixed(2)}</td>
                <td className="px-3 py-1.5 text-right text-emerald-400">${entry.totalCost.toFixed(2)}</td>
                <td className="px-3 py-1.5 text-right text-amber-400">{entry.powerDissipation.toFixed(1)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        <div className="p-3 rounded-lg bg-emerald-600/10 border border-emerald-500/20 text-center">
          <p className="text-[10px] text-emerald-500 uppercase tracking-wider">Total Cost</p>
          <p className="text-lg font-bold text-emerald-400">${bom.totalCost.toFixed(2)}</p>
        </div>
        <div className="p-3 rounded-lg bg-amber-600/10 border border-amber-500/20 text-center">
          <p className="text-[10px] text-amber-500 uppercase tracking-wider">Total Power</p>
          <p className="text-lg font-bold text-amber-400">{bom.totalPower.toFixed(1)} mW</p>
        </div>
        <div className="p-3 rounded-lg bg-indigo-600/10 border border-indigo-500/20 text-center">
          <p className="text-[10px] text-indigo-500 uppercase tracking-wider">NAND Equiv.</p>
          <p className="text-lg font-bold text-indigo-400">{bom.totalNandEquivalent}</p>
        </div>
      </div>
    </div>
  )
}
