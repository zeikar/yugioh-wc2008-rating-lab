/** The game's rating icon: a gold inverted triangle hanging from a ring, with a dot in the middle. */
export function RatingMark({ className }: { className: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={`shrink-0 fill-gold stroke-ink ${className}`}>
      <circle cx="12" cy="3.6" r="1.9" fill="none" strokeWidth="1.6" />
      <path d="M3 6.2H21L12 22.2Z" strokeWidth="1.6" strokeLinejoin="round" />
      <circle cx="12" cy="11.4" r="2" className="fill-ink" stroke="none" />
    </svg>
  )
}

/**
 * A rating the way the game shows it: the rating mark, then the number.
 * Where a value came from (typed, zero-sum fill, roster baseline) is not shown;
 * only a possibly out-of-date value is flagged.
 */
export function Rating({ value, stale = false, size = 'md' }: { value: number | null; stale?: boolean; size?: 'md' | 'lg' }) {
  if (value === null) return <span className="text-ink-3">—</span>
  return (
    <span className={`inline-flex items-baseline gap-1 whitespace-nowrap ${size === 'lg' ? 'text-3xl font-display font-bold' : ''}`}>
      <RatingMark className={`self-center ${size === 'lg' ? 'size-6.5' : 'size-[1.05em]'}`} />
      <span>{value}</span>
      {stale && <Tag title="This CPU played a recorded CPU match after this value, with no known result rating" tone="warn">stale</Tag>}
    </span>
  )
}

export function Tag({ children, title, tone = 'plain' }: { children: string; title?: string; tone?: 'plain' | 'warn' | 'accent' }) {
  const tones = {
    plain: 'bg-paper text-ink-2 border-rule',
    warn: 'bg-warn-soft text-warn border-[#f0d9a8]',
    accent: 'bg-accent-soft text-accent border-[#c9d5f5]',
  }
  return (
    <span title={title} className={`rounded border px-1 py-px text-[0.7rem] font-medium not-italic leading-none ${tones[tone]}`}>
      {children}
    </span>
  )
}
