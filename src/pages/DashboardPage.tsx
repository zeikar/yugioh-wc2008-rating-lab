import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { useApp } from '../app/context'
import { plural } from '../components/format'
import { Delta } from '../components/Delta'
import { DuelistLink } from '../components/DuelistLink'
import { Empty } from '../components/Empty'
import { Rating } from '../components/Rating'
import { championOf, playerStats, upsets, type DuelistRow } from '../domain/stats'
import { PLAYER_ID } from '../types'

function best<T>(items: T[], score: (x: T) => number | null, dir: 1 | -1 = 1): T | null {
  let top: T | null = null
  let topScore = 0
  for (const x of items) {
    const s = score(x)
    if (s === null) continue
    if (top === null || s * dir > topScore * dir) {
      top = x
      topScore = s
    }
  }
  return top
}

export function DashboardPage() {
  const { model, loading } = useApp()
  if (loading) return <p className="text-ink-2">Loading…</p>
  const { data, rows } = model
  const recorded = (r: DuelistRow) => (r.rating.current.kind === 'entered' || r.rating.current.kind === 'derived' ? r.rating.current.value : null)

  const top = rows
    .filter((r) => recorded(r) !== null)
    .sort((a, b) => recorded(b)! - recorded(a)!)
    .slice(0, 10)
  const gain = best(rows, (r) => r.rating.deltaFromInitial)
  const loss = best(rows, (r) => r.rating.deltaFromInitial, -1)
  const peak = best(rows, (r) => r.rating.peak)
  const upset = upsets(model.analyses, data.tournaments)[0]
  const me = playerStats(data.matches, data.tournaments)
  const recent = [...model.index.tournaments].reverse().slice(0, 5)

  return (
    <>
      <div className="mb-6">
        <h1 className="text-3xl font-bold">CPU rating ecosystem</h1>
        <p className="mt-1 text-sm text-ink-2">
          {data.duelists.length} duelists ({data.duelists.filter((d) => d.unlocked).length} unlocked), {plural(data.tournaments.length, 'tournament')}, {plural(data.matches.length, 'match', 'matches')},{' '}
          {data.observations.length} ratings recorded.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <section>
          <h2 className="mb-2 text-xl font-semibold">Top 10 by current rating</h2>
          <div className="panel overflow-x-auto">
            {top.length === 0 ? (
              <Empty>No ratings recorded yet. Record a tournament to start the table.</Empty>
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th className="num">#</th>
                    <th>Duelist</th>
                    <th className="num">Current</th>
                    <th className="num">Δ initial</th>
                    <th className="num">W–L</th>
                  </tr>
                </thead>
                <tbody>
                  {top.map((r, i) => (
                    <tr key={r.duelist.id}>
                      <td className="num text-ink-3">{i + 1}</td>
                      <td>
                        <DuelistLink id={r.duelist.id} />
                      </td>
                      <td className="num">
                        <Rating value={r.rating.current.value} stale={r.rating.current.stale} />
                      </td>
                      <td className="num">
                        <Delta value={r.rating.deltaFromInitial} />
                      </td>
                      <td className="num">
                        {r.record.wins}–{r.record.losses}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>

        <section className="space-y-6">
          <div>
            <h2 className="mb-2 text-xl font-semibold">Highlights</h2>
            <dl className="panel divide-y divide-rule">
              <Highlight label="Highest now">{top[0] ? <Who id={top[0].duelist.id}><Rating value={recorded(top[0])} /></Who> : null}</Highlight>
              <Highlight label="Biggest climb">
                {gain && gain.rating.deltaFromInitial! > 0 ? <Who id={gain.duelist.id}><Delta value={gain.rating.deltaFromInitial} /></Who> : null}
              </Highlight>
              <Highlight label="Biggest fall">
                {loss && loss.rating.deltaFromInitial! < 0 ? <Who id={loss.duelist.id}><Delta value={loss.rating.deltaFromInitial} /></Who> : null}
              </Highlight>
              <Highlight label="Highest ever">{peak ? <Who id={peak.duelist.id}><Rating value={peak.rating.peak} /></Who> : null}</Highlight>
              <Highlight label="Biggest upset">
                {upset ? (
                  <span>
                    <DuelistLink id={upset.winnerId} /> ({upset.winnerBefore}) beat <DuelistLink id={upset.loserId} /> ({upset.loserBefore}),{' '}
                    <Link className="text-ink-3 hover:underline" to={`/tournaments/${upset.tournament.id}`}>
                      #{upset.tournament.number}
                    </Link>
                  </span>
                ) : null}
              </Highlight>
            </dl>
          </div>

          <div>
            <h2 className="mb-2 text-xl font-semibold">Your record</h2>
            <div className="panel p-4 text-sm">
              <p>
                Recorded duels: {me.wins}–{me.losses} across {plural(me.tournaments, 'tournament')}.
              </p>
              <p className="mt-2 text-ink-2">Titles per level (the game gives a pack after 5):</p>
              <ul className="mt-1 flex gap-4">
                {([1, 2, 3] as const).map((l) => (
                  <li key={l}>
                    Level {l}: <span className="font-semibold">{me.titlesByLevel[l]}</span>
                    <span className="text-ink-3"> / 5</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div>
            <h2 className="mb-2 text-xl font-semibold">Recent tournaments</h2>
            <ul className="panel divide-y divide-rule text-sm">
              {recent.length === 0 && <Empty>None yet.</Empty>}
              {recent.map((t) => {
                const champ = championOf(data.matches, t.id)
                return (
                  <li key={t.id} className="flex items-center justify-between gap-3 px-4 py-2">
                    <Link to={`/tournaments/${t.id}`} className="font-medium text-accent hover:underline">
                      #{t.number}, Level {t.tournamentLevel}
                    </Link>
                    <span className="text-ink-2">{champ ? champ === PLAYER_ID ? 'You won' : <>Won by <DuelistLink id={champ} /></> : 'No final recorded'}</span>
                  </li>
                )
              })}
            </ul>
          </div>
        </section>
      </div>
    </>
  )
}

function Highlight({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 px-4 py-2 text-sm">
      <dt className="text-ink-2">{label}</dt>
      <dd className="text-right">{children ?? <span className="text-ink-3">Not enough data</span>}</dd>
    </div>
  )
}

function Who({ id, children }: { id: string; children: ReactNode }) {
  return (
    <span className="inline-flex items-baseline gap-2">
      <DuelistLink id={id} />
      {children}
    </span>
  )
}
