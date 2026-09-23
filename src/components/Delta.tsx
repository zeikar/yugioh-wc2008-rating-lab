export function Delta({ value, className = '' }: { value: number | null; className?: string }) {
  if (value === null) return <span className="text-ink-3">—</span>
  if (value === 0) return <span className={`text-ink-2 ${className}`}>±0</span>
  const up = value > 0
  return <span className={`${up ? 'text-up' : 'text-down'} font-medium ${className}`}>{up ? `+${value}` : `−${Math.abs(value)}`}</span>
}
