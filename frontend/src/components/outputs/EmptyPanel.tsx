interface EmptyPanelProps {
  label: string
}

export function EmptyPanel({ label }: EmptyPanelProps) {
  return (
    <div className="flex items-center justify-center h-full min-h-[200px] text-slate-600 text-sm">
      {label}
    </div>
  )
}
