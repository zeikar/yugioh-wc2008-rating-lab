import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { useApp } from '../app/context'
import { Delta } from '../components/Delta'
import { Empty } from '../components/Empty'
import { PageTitle } from '../components/Layout'
import { Avatar } from '../components/Portrait'
import { Rating, Tag } from '../components/Rating'
import { DECK_STYLES, DECKS } from '../data/decks'
import { ROSTER } from '../data/duelists'
import type { DuelistRow } from '../domain/stats'

type Value = string | number | null

/** Position in the game's own CPU list, as Roster setup numbers it. */
const LIST_NO = new Map(ROSTER.map((d, i) => [d.id, i + 1]))

/** Sortable columns: what each sorts by, and the direction a first click uses. */
const COLUMNS = {
  no: { label: '#', value: (r: DuelistRow): Value => LIST_NO.get(r.duelist.id) ?? null, firstDir: 1, num: true },
  name: { label: 'Duelist', value: (r: DuelistRow): Value => r.duelist.name, firstDir: 1, num: false },
  level: { label: 'LV', value: (r: DuelistRow): Value => r.duelist.tournamentLevel, firstDir: 1, num: false },
  initial: { label: 'Initial', value: (r: DuelistRow): Value => r.duelist.initialRating, firstDir: -1, num: true },
  current: { label: 'Current', value: (r: DuelistRow): Value => r.rating.current.value, firstDir: -1, num: true },
  delta: { label: 'Δ initial', value: (r: DuelistRow): Value => r.rating.deltaFromInitial, firstDir: -1, num: true },
  peak: { label: 'Peak', value: (r: DuelistRow): Value => r.rating.peak, firstDir: -1, num: true },
  low: { label: 'Low', value: (r: DuelistRow): Value => r.rating.low, firstDir: -1, num: true },
  wins: { label: 'W–L', value: (r: DuelistRow): Value => (r.record.played > 0 ? r.record.wins : null), firstDir: -1, num: true },
  finals: { label: 'Finals', value: (r: DuelistRow): Value => r.record.finals, firstDir: -1, num: true },
  titles: { label: 'Titles', value: (r: DuelistRow): Value => r.record.titles, firstDir: -1, num: true },
} as const
type ColumnKey = keyof typeof COLUMNS

/** Unknown values always sort last, whatever the direction. */
function compare(a: Value, b: Value, dir: number): number {
  if (a === null && b === null) return 0
  if (a === null) return 1
  if (b === null) return -1
  return (typeof a === 'string' ? a.localeCompare(b as string) : a - (b as number)) * dir
}

function SortHeader({ column, sort, onSort, className = '' }: { column: ColumnKey; sort: { key: ColumnKey; dir: number }; onSort: (k: ColumnKey) => void; className?: string }) {
  const c = COLUMNS[column]
  const active = sort.key === column
  return (
    <th className={`${c.num ? 'num' : ''} ${className}`} aria-sort={active ? (sort.dir > 0 ? 'ascending' : 'descending') : 'none'}>
      <button className={`inline-flex items-center gap-1 hover:text-ink ${active ? 'text-ink' : ''}`} onClick={() => onSort(column)}>
        {c.label}
        <span aria-hidden className={`text-[0.65rem] ${active ? 'text-accent' : 'invisible'}`}>
          {sort.dir > 0 ? '▲' : '▼'}
        </span>
      </button>
    </th>
  )
}

export function DuelistsPage() {
  const { model, base, canEdit, loadFailed } = useApp()
  const [sort, setSort] = useState<{ key: ColumnKey; dir: number }>({ key: 'current', dir: -1 })
  const [level, setLevel] = useState<'all' | '1' | '2' | '3'>('all')
  const [lock, setLock] = useState<'all' | 'unlocked' | 'locked'>('unlocked')
  const [query, setQuery] = useState('')

  const rankById = useMemo(() => {
    const ranked = model.rows.filter((r) => r.rating.current.value !== null).sort((a, b) => b.rating.current.value! - a.rating.current.value!)
    return new Map(ranked.map((r, i) => [r.duelist.id, i + 1]))
  }, [model.rows])

  // First click sorts a column its natural way; clicking it again flips it.
  const sortBy = (key: ColumnKey) => setSort((s) => (s.key === key ? { key, dir: -s.dir } : { key, dir: COLUMNS[key].firstDir }))

  const q = query.trim().toLowerCase()
  const column = COLUMNS[sort.key]
  const rows = model.rows
    .filter((r) => level === 'all' || r.duelist.tournamentLevel === Number(level))
    .filter((r) => lock === 'all' || r.duelist.unlocked === (lock === 'unlocked'))
    .filter((r) => !q || [r.duelist.name, ...(r.duelist.aliases ?? [])].some((n) => n.toLowerCase().includes(q)))
    .sort((a, b) => compare(column.value(a), column.value(b), sort.dir) || a.duelist.name.localeCompare(b.duelist.name))

  return (
    <>
      <PageTitle>Duelists</PageTitle>
      <div className="mb-3 flex flex-wrap items-center gap-3 text-sm">
        <input className="field w-56" placeholder="Search name or alias" aria-label="Search duelists" value={query} onChange={(e) => setQuery(e.target.value)} />
        <label className="flex items-center gap-1.5">
          Level
          <select className="field" value={level} onChange={(e) => setLevel(e.target.value as typeof level)}>
            <option value="all">All</option>
            <option value="1">LV1</option>
            <option value="2">LV2</option>
            <option value="3">LV3</option>
          </select>
        </label>
        <label className="flex items-center gap-1.5">
          Show
          <select className="field" value={lock} onChange={(e) => setLock(e.target.value as typeof lock)}>
            <option value="unlocked">Unlocked</option>
            <option value="all">All</option>
            <option value="locked">Locked</option>
          </select>
        </label>
        <span className="ml-auto text-ink-3">Click a column to sort. W/L counts recorded matches only.</span>
      </div>
      <div className="panel overflow-x-auto">
        {model.rows.length === 0 ? (
          <Empty>
            {loadFailed ? 'Nothing loaded.' : canEdit ? "Your roster isn't set up yet." : "This save's roster isn't set up yet."}
            {canEdit && !loadFailed && (
              <>
                {' '}
                Set it up in <Link to={`${base}/roster`} className="text-accent underline">Roster setup</Link>.
              </>
            )}
          </Empty>
        ) : rows.length === 0 ? (
          <Empty>No duelist matches these filters.</Empty>
        ) : (
          <table className="table">
            <thead>
              <tr>
                {/* Hidden on phones, like Initial below, to keep Current on screen. */}
                <SortHeader column="no" sort={sort} onSort={sortBy} className="hidden sm:table-cell" />
                <th className="num">Rank</th>
                <SortHeader column="name" sort={sort} onSort={sortBy} />
                <th className="hidden md:table-cell">Style</th>
                {(Object.keys(COLUMNS) as ColumnKey[])
                  .filter((k) => k !== 'no' && k !== 'name')
                  .map((k) => (
                    // Phones drop Initial so Current stays on screen; Δ initial carries the comparison.
                    <SortHeader key={k} column={k} sort={sort} onSort={sortBy} className={k === 'initial' ? 'hidden sm:table-cell' : ''} />
                  ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.duelist.id} className={r.duelist.unlocked ? '' : 'text-ink-3'}>
                  <td className="num hidden text-ink-3 sm:table-cell">{LIST_NO.get(r.duelist.id) ?? '—'}</td>
                  <td className="num text-ink-3">{rankById.get(r.duelist.id) ?? '—'}</td>
                  <td>
                    <span className="flex items-center gap-2">
                      <Avatar duelist={r.duelist} className={`size-7 ${r.duelist.unlocked ? '' : 'opacity-50 grayscale'}`} />
                      <span>
                        <Link to={`${base}/duelists/${r.duelist.id}`} className="font-medium hover:text-accent hover:underline">
                          {r.duelist.name}
                        </Link>
                        {!r.duelist.unlocked && <span className="ml-2 text-xs">locked</span>}
                      </span>
                    </span>
                  </td>
                  <td title={DECKS[r.duelist.id]?.summary} className={`hidden md:table-cell ${r.duelist.unlocked ? '' : 'opacity-60'}`}>
                    <span className="flex flex-wrap gap-1">
                      {DECKS[r.duelist.id]?.styles.map((s) => (
                        <Tag key={s}>{DECK_STYLES[s]}</Tag>
                      ))}
                    </span>
                  </td>
                  <td>{r.duelist.tournamentLevel}</td>
                  <td className="num hidden sm:table-cell">{r.duelist.initialRating ?? '—'}</td>
                  <td className="num">
                    <Rating value={r.rating.current.value} stale={r.rating.current.stale} />
                  </td>
                  <td className="num">
                    <Delta value={r.rating.deltaFromInitial} />
                  </td>
                  <td className="num">{r.rating.peak ?? '—'}</td>
                  <td className="num">{r.rating.low ?? '—'}</td>
                  <td className="num whitespace-nowrap">{r.record.played > 0 ? `${r.record.wins}–${r.record.losses}` : '—'}</td>
                  <td className="num">{r.record.finals || '—'}</td>
                  <td className="num">{r.record.titles || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  )
}
