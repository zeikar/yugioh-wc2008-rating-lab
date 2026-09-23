import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { useApp } from '../app/context'
import { Delta } from '../components/Delta'
import { Empty } from '../components/Empty'
import { PageTitle } from '../components/Layout'
import { Rating } from '../components/Rating'
import type { DuelistRow } from '../domain/stats'

const SORTS = {
  current: { label: 'Current rating', key: (r: DuelistRow) => r.rating.current.value, dir: -1 },
  gain: { label: 'Biggest gain', key: (r: DuelistRow) => r.rating.deltaFromInitial, dir: -1 },
  loss: { label: 'Biggest loss', key: (r: DuelistRow) => r.rating.deltaFromInitial, dir: 1 },
  titles: { label: 'Titles', key: (r: DuelistRow) => r.record.titles, dir: -1 },
  finals: { label: 'Finals', key: (r: DuelistRow) => r.record.finals, dir: -1 },
  level: { label: 'Tournament level', key: (r: DuelistRow) => r.duelist.tournamentLevel, dir: 1 },
  name: { label: 'Name', key: (r: DuelistRow) => r.duelist.name, dir: 1 },
} as const
type SortKey = keyof typeof SORTS

/** Unknown values always sort last, whatever the direction. */
function compare(a: string | number | null, b: string | number | null, dir: number): number {
  if (a === null && b === null) return 0
  if (a === null) return 1
  if (b === null) return -1
  return (typeof a === 'string' ? a.localeCompare(b as string) : a - (b as number)) * dir
}

export function DuelistsPage() {
  const { model } = useApp()
  const [sort, setSort] = useState<SortKey>('current')
  const [level, setLevel] = useState<'all' | '1' | '2' | '3'>('all')
  const [lock, setLock] = useState<'all' | 'unlocked' | 'locked'>('all')
  const [query, setQuery] = useState('')

  const rankById = useMemo(() => {
    const ranked = model.rows.filter((r) => r.rating.current.value !== null).sort((a, b) => b.rating.current.value! - a.rating.current.value!)
    return new Map(ranked.map((r, i) => [r.duelist.id, i + 1]))
  }, [model.rows])

  const q = query.trim().toLowerCase()
  const rows = model.rows
    .filter((r) => level === 'all' || r.duelist.tournamentLevel === Number(level))
    .filter((r) => lock === 'all' || r.duelist.unlocked === (lock === 'unlocked'))
    .filter((r) => !q || [r.duelist.name, ...(r.duelist.aliases ?? [])].some((n) => n.toLowerCase().includes(q)))
    .sort((a, b) => compare(SORTS[sort].key(a), SORTS[sort].key(b), SORTS[sort].dir) || a.duelist.name.localeCompare(b.duelist.name))

  return (
    <>
      <PageTitle>Duelists</PageTitle>
      <div className="mb-3 flex flex-wrap items-center gap-3 text-sm">
        <input className="field w-56" placeholder="Search name or alias" aria-label="Search duelists" value={query} onChange={(e) => setQuery(e.target.value)} />
        <label className="flex items-center gap-1.5">
          Sort by
          <select className="field" value={sort} onChange={(e) => setSort(e.target.value as SortKey)}>
            {Object.entries(SORTS).map(([k, s]) => (
              <option key={k} value={k}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
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
            <option value="all">All</option>
            <option value="unlocked">Unlocked</option>
            <option value="locked">Locked</option>
          </select>
        </label>
        <span className="ml-auto text-ink-3">W/L counts recorded matches only.</span>
      </div>
      <div className="panel overflow-x-auto">
        {model.rows.length === 0 ? (
          <Empty>
            The roster is empty. The owner sets it up in <Link to="/roster" className="text-accent underline">Roster setup</Link>.
          </Empty>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th className="num">Rank</th>
                <th>Duelist</th>
                <th>LV</th>
                <th className="num">Initial</th>
                <th className="num">Current</th>
                <th className="num">Δ initial</th>
                <th className="num">Peak</th>
                <th className="num">Low</th>
                <th className="num">W–L</th>
                <th className="num">Finals</th>
                <th className="num">Titles</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.duelist.id} className={r.duelist.unlocked ? '' : 'text-ink-3'}>
                  <td className="num text-ink-3">{rankById.get(r.duelist.id) ?? '—'}</td>
                  <td>
                    <Link to={`/duelists/${r.duelist.id}`} className="font-medium hover:text-accent hover:underline">
                      {r.duelist.name}
                    </Link>
                    {!r.duelist.unlocked && <span className="ml-2 text-xs">locked</span>}
                  </td>
                  <td>{r.duelist.tournamentLevel}</td>
                  <td className="num">{r.duelist.initialRating ?? '—'}</td>
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
