import clsx from 'clsx'

type BadgeVariant = 'default' | 'digital' | 'analog' | 'signal' | 'success' | 'warning' | 'error'

interface BadgeProps {
  variant?: BadgeVariant
  children: React.ReactNode
  className?: string
}

const variantStyles: Record<BadgeVariant, string> = {
  default: 'bg-slate-700/50 text-slate-300 border-slate-600/50',
  digital: 'bg-indigo-600/20 text-indigo-400 border-indigo-500/30',
  analog: 'bg-emerald-600/20 text-emerald-400 border-emerald-500/30',
  signal: 'bg-amber-600/20 text-amber-400 border-amber-500/30',
  success: 'bg-emerald-600/20 text-emerald-400 border-emerald-500/30',
  warning: 'bg-amber-600/20 text-amber-400 border-amber-500/30',
  error: 'bg-rose-600/20 text-rose-400 border-rose-500/30',
}

export function Badge({ variant = 'default', children, className }: BadgeProps) {
  return (
    <span
      className={clsx(
        'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border',
        variantStyles[variant],
        className
      )}
    >
      {children}
    </span>
  )
}
