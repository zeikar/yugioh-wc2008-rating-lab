import { useId, useMemo, useState } from 'react'
import { flushSync } from 'react-dom'
import { PLAYER_ID, type Duelist, type TournamentLevel } from '../types'

interface Option {
  id: string
  label: string
  hint: string
  disabled: boolean
}

interface Props {
  value: string | null
  onChange: (id: string | null) => void
  duelists: Duelist[]
  tournamentLevel: TournamentLevel
  /** Entrants already seated elsewhere in the bracket. */
  taken: ReadonlySet<string>
  navIndex: number
  label: string
}

function matches(d: Duelist, q: string): boolean {
  return [d.name, ...(d.aliases ?? [])].some((n) => n.toLowerCase().includes(q))
}

/**
 * Type-ahead seat picker over the unlocked duelists (only they can enter a
 * tournament). Enter picks the highlighted option; the form's Enter handler
 * then moves focus on. "You" is always the first option.
 */
export function DuelistPicker({ value, onChange, duelists, tournamentLevel, taken, navIndex, label }: Props) {
  const listId = useId()
  const [query, setQuery] = useState('')
  // Open/closed is separate from focus: a mouse pick keeps focus in the input but closes the list.
  const [open, setOpen] = useState(false)
  const [highlight, setHighlight] = useState(0)

  const options = useMemo<Option[]>(() => {
    const q = query.trim().toLowerCase()
    const you: Option[] = !q || 'you'.startsWith(q) ? [{ id: PLAYER_ID, label: 'You', hint: 'player', disabled: taken.has(PLAYER_ID) && value !== PLAYER_ID }] : []
    const cpus = duelists
      .filter((d) => d.unlocked && (!q || matches(d, q)))
      .sort((a, b) => {
        // Documented pool levels at or below this tournament first, closest level first.
        const rank = (d: Duelist) => (d.tournamentLevel <= tournamentLevel ? tournamentLevel - d.tournamentLevel : 10 + d.tournamentLevel)
        return rank(a) - rank(b) || a.name.localeCompare(b.name)
      })
      .map((d) => ({ id: d.id, label: d.name, hint: `LV${d.tournamentLevel}`, disabled: taken.has(d.id) && value !== d.id }))
    return [...you, ...cpus]
  }, [query, duelists, tournamentLevel, taken, value])

  const selectedLabel = value === null ? '' : value === PLAYER_ID ? 'You' : (duelists.find((d) => d.id === value)?.name ?? value)
  const enabled = options.filter((o) => !o.disabled)
  const active = enabled[Math.min(highlight, enabled.length - 1)]

  const pick = (id: string) => {
    // Render synchronously so the form's Enter handler can move focus to the
    // rating input this choice reveals.
    flushSync(() => onChange(id))
    setQuery('')
    setHighlight(0)
    setOpen(false)
  }

  return (
    <div className="relative min-w-0 flex-1">
      <input
        aria-label={label}
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-activedescendant={open && active ? `${listId}-${active.id}` : undefined}
        data-nav={navIndex}
        className={`field w-full ${value === PLAYER_ID ? 'font-semibold text-accent' : ''}`}
        placeholder="Type a name…"
        value={open ? query : selectedLabel}
        onFocus={() => {
          setOpen(true)
          setQuery('')
          setHighlight(0)
        }}
        onClick={() => {
          if (open) return
          setOpen(true)
          setQuery('')
          setHighlight(0)
        }}
        onBlur={() => setOpen(false)}
        onChange={(e) => {
          setQuery(e.target.value)
          setHighlight(0)
          setOpen(true)
        }}
        onKeyDown={(e) => {
          // Keys that confirm an IME conversion (e.g. typing a Japanese alias) aren't commands.
          if (e.nativeEvent.isComposing) return
          if (e.key === 'ArrowDown') {
            e.preventDefault()
            if (!open) setOpen(true)
            setHighlight((h) => Math.min(h + 1, enabled.length - 1))
          } else if (e.key === 'ArrowUp') {
            e.preventDefault()
            setHighlight((h) => Math.max(h - 1, 0))
          } else if (e.key === 'Enter' && query.trim() && active) {
            pick(active.id)
          } else if (e.key === 'Escape') {
            setQuery('')
            setOpen(false)
          } else if (e.key === 'Delete' && !query) {
            onChange(null)
          }
        }}
      />
      {open && (
        <ul id={listId} role="listbox" tabIndex={-1} className="panel absolute z-20 mt-1 max-h-72 w-full min-w-64 overflow-auto py-1 shadow-lg">
          {options.length === 0 && (
            <li className="px-3 py-1.5 text-sm text-ink-3">No unlocked duelist matches “{query}”. Unlock it in Roster setup first.</li>
          )}
          {options.map((o) => (
            <li
              key={o.id}
              id={`${listId}-${o.id}`}
              role="option"
              aria-selected={o === active}
              aria-disabled={o.disabled}
              className={`flex cursor-pointer items-baseline justify-between gap-3 px-3 py-1 text-sm ${o === active ? 'bg-accent-soft' : ''} ${o.disabled ? 'cursor-not-allowed text-ink-3' : ''}`}
              onMouseDown={(e) => {
                e.preventDefault()
                if (!o.disabled) pick(o.id)
              }}
            >
              <span className={o.id === PLAYER_ID ? 'font-semibold' : ''}>{o.label}</span>
              <span className="text-xs text-ink-3">{o.disabled ? 'in bracket' : o.hint}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
