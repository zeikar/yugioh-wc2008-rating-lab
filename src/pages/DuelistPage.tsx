import { useState, type ReactNode } from 'react'
import { Link, useParams } from 'react-router'
import { useApp } from '../app/context'
import { plural } from '../components/format'
import { Delta } from '../components/Delta'
import { DuelistLink } from '../components/DuelistLink'
import { Empty } from '../components/Empty'
import { PortraitCard } from '../components/Portrait'
import { Rating, Tag } from '../components/Rating'
import { RatingChart, type ChartPoint } from '../components/RatingChart'
import { DECK_STYLES, DECKS, EXTRA_DECK, deckSize, type Deck } from '../data/decks'
import { deleteReading, saveReading, updateDuelist } from '../db/repository'
import { matchLabel } from '../domain/bracket'
import { displayName, type Model } from '../domain/stats'
import type { HistoryPoint } from '../domain/timeline'
import { PLAYER_ID, type Duelist } from '../types'

function describe(model: Model, duelistId: string, p: HistoryPoint): string[] {
  const lines: string[] = []
  if (p.tournament) lines.push(`Tournament #${p.tournament.number}, Level ${p.tournament.tournamentLevel}, ${p.tournament.playedAt.toLocaleDateString()}`)
  if (p.kind === 'entry') lines.push('Rating at entry')
  if (p.kind === 'standalone') lines.push(`Reading on ${p.observation.observedAt.toLocaleDateString()}`)
  if (p.match) {
    const m = p.match
    const opponent = m.playerAId === duelistId ? m.playerBId : m.playerAId
    const transfer = model.analyses.get(m.tournamentId)?.matches.find((r) => r.match.id === m.id)?.transfer
    const label = matchLabel(m.round, m.slot)
    lines.push(`${label}: ${m.winnerId === duelistId ? 'beat' : 'lost to'} ${displayName(model, opponent)}${transfer != null ? ` (${transfer} pts)` : ''}`)
  }
  if (p.observation.note) lines.push(p.observation.note)
  return lines
}

export function DuelistPage() {
  const { id = '' } = useParams()
  const { model, isAdmin } = useApp()
  const row = model.rowById.get(id)
  if (!row) {
    return (
      <Empty>
        No duelist with this id. <Link to="/duelists" className="text-accent underline">Back to duelists</Link>
      </Empty>
    )
  }
  const { duelist, rating, record } = row
  // A tournament's carried entry rating repeats the point before it; showing it would only add duplicates.
  const history = rating.history.filter((p) => !(p.kind === 'entry' && p.observation.source === 'derived'))

  const points: ChartPoint[] = []
  if (duelist.initialRating !== null) points.push({ x: 0, rating: duelist.initialRating, details: ['Initial rating on a fresh save'] })
  history.forEach((p, i) => points.push({ x: i + 1, rating: p.observation.rating, details: describe(model, id, p) }))

  const h2h = new Map<string, { w: number; l: number }>()
  for (const m of model.data.matches) {
    if (m.playerAId !== id && m.playerBId !== id) continue
    const opp = m.playerAId === id ? m.playerBId : m.playerAId
    const rec = h2h.get(opp) ?? { w: 0, l: 0 }
    if (m.winnerId === id) rec.w++
    else rec.l++
    h2h.set(opp, rec)
  }

  return (
    <>
      <div className="mb-6 flex flex-wrap gap-x-6 gap-y-4">
        <PortraitCard duelist={duelist} />
        <div className="min-w-0 flex-1 basis-80">
          {/* Floated so the meta line sits right under the name and only wraps below the rating when it runs long. */}
          <div className="flow-root">
            <div className="float-right ml-4 text-right">
              <Rating value={rating.current.value} stale={rating.current.stale} size="lg" />
              <p className="text-sm">
                <Delta value={rating.deltaFromInitial} /> <span className="text-ink-3">from initial {duelist.initialRating ?? '—'}</span>
              </p>
            </div>
            <h1 className="text-3xl font-bold">{duelist.name}</h1>
            <p className="mt-1 text-sm text-ink-2">
              Tournament level {duelist.tournamentLevel}, {duelist.category === 'monster' ? 'monster' : 'anime character'}
              {duelist.aliases?.length ? `, also “${duelist.aliases.join('”, “')}”` : ''}
              {!duelist.unlocked && ', locked'}
            </p>
          </div>
          {DECKS[id] && <DeckInfo deck={DECKS[id]} />}
        </div>
      </div>
      {DECKS[id] && <Decklist deck={DECKS[id]} />}

      <dl className="mb-6 grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4 lg:grid-cols-8">
        <Stat label="Peak">{rating.peak ?? '—'}</Stat>
        <Stat label="Low">{rating.low ?? '—'}</Stat>
        <Stat label="Biggest rise">
          <Delta value={rating.biggestRise} />
        </Stat>
        <Stat label="Biggest drop">
          <Delta value={rating.biggestDrop} />
        </Stat>
        <Stat label="Recorded W–L">{record.played > 0 ? `${record.wins}–${record.losses}` : '—'}</Stat>
        <Stat label="Win rate">{record.winRate === null ? '—' : `${Math.round(record.winRate * 100)}%`}</Stat>
        <Stat label="Longest streak">{record.longestWinStreak || '—'}</Stat>
        <Stat label="Finals / titles">
          {record.finals} / {record.titles}
        </Stat>
      </dl>
      <p className="-mt-3 mb-6 text-sm text-ink-3">
        vs CPUs {record.vsCpu.wins}–{record.vsCpu.losses}, vs you {record.vsPlayer.wins}–{record.vsPlayer.losses}. Entered {plural(record.tournamentsEntered, 'tournament')}{record.levelsAppeared.length > 0 ? ` (levels ${record.levelsAppeared.join(', ')})` : ''}. Counts cover recorded matches only.
      </p>

      <section className="panel mb-6 p-4">
        <h2 className="mb-2 text-xl font-semibold">Rating history</h2>
        {history.length === 0 ? (
          <Empty>No ratings recorded yet{duelist.initialRating !== null ? `; it starts at ${duelist.initialRating}` : ''}.</Empty>
        ) : (
          <RatingChart points={points} />
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <section>
          <h2 className="mb-2 text-xl font-semibold">Recent ratings</h2>
          <div className="panel overflow-x-auto">
            {history.length === 0 ? (
              <Empty>Nothing yet.</Empty>
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th>When</th>
                    <th className="num">Rating</th>
                    <th className="num">Change</th>
                    <th>Context</th>
                    {isAdmin && <th />}
                  </tr>
                </thead>
                <tbody>
                  {history
                    .map((p, i) => ({ p, prev: history[i - 1] }))
                    .slice(-12)
                    .reverse()
                    .map(({ p, prev }) => (
                      <tr key={p.observation.id}>
                        <td className="whitespace-nowrap text-ink-2">{p.observation.observedAt.toLocaleDateString()}</td>
                        <td className="num">
                          <Rating value={p.observation.rating} />
                        </td>
                        <td className="num">
                          <Delta value={prev ? p.observation.rating - prev.observation.rating : null} />
                        </td>
                        <td className="text-ink-2">
                          {p.tournament ? (
                            <Link to={`/tournaments/${p.tournament.id}`} className="hover:text-accent hover:underline">
                              {describe(model, id, p).join('. ')}
                            </Link>
                          ) : (
                            describe(model, id, p).join('. ')
                          )}
                        </td>
                        {isAdmin && (
                          <td className="text-right">
                            {p.kind === 'standalone' && <ReadingActions duelistId={id} point={p} />}
                          </td>
                        )}
                      </tr>
                    ))}
                </tbody>
              </table>
            )}
          </div>
          {/* Keyed so half-typed input never carries over to another duelist's page. */}
          {isAdmin && <AddReading key={duelist.id} duelist={duelist} />}
        </section>

        <section>
          <h2 className="mb-2 text-xl font-semibold">Head to head</h2>
          <div className="panel">
            {h2h.size === 0 ? (
              <Empty>No recorded matches.</Empty>
            ) : (
              <table className="table">
                <tbody>
                  {[...h2h]
                    .sort((a, b) => b[1].w + b[1].l - (a[1].w + a[1].l))
                    .map(([opp, rec]) => (
                      <tr key={opp}>
                        <td>{opp === PLAYER_ID ? <span className="font-semibold text-accent">You</span> : <DuelistLink id={opp} />}</td>
                        <td className="num whitespace-nowrap">
                          {rec.w}–{rec.l}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            )}
          </div>
          {isAdmin && <OwnerControls key={duelist.id} duelist={duelist} />}
        </section>
      </div>
    </>
  )
}

function DeckInfo({ deck }: { deck: Deck }) {
  return (
    <div className="mt-4">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-ink-3">Deck</h2>
      <p className="font-display text-xl font-semibold">
        {deck.name}{' '}
        <span lang="ja" className="font-sans text-sm font-normal text-ink-3">
          {deck.jaName}
        </span>
      </p>
      <div className="mt-1 flex flex-wrap gap-1">
        {deck.styles.map((s) => (
          <Tag key={s}>{DECK_STYLES[s]}</Tag>
        ))}
      </div>
      <p className="mt-2 max-w-prose text-sm text-ink-2">{deck.summary}</p>
    </div>
  )
}

function Decklist({ deck }: { deck: Deck }) {
  const extra = deckSize(deck, true)
  return (
    <details className="mb-6">
      <summary className="w-fit cursor-pointer py-1.5 text-sm font-medium text-accent">
        Decklist: {deckSize(deck, false)} cards{extra > 0 && `, ${extra} in the Extra Deck`}
      </summary>
      <div className="panel mt-2 p-4">
        <div className="gap-6 sm:columns-2 lg:columns-3">
          {deck.sections.map((s) => (
            <section key={s.title} className="mb-4 break-inside-avoid">
              <h3 className="mb-1 text-sm font-semibold text-ink-2">
                {s.title}
                {s.title === EXTRA_DECK && <span className="font-normal text-ink-3"> (Extra Deck)</span>}
              </h3>
              <ul className="text-sm">
                {s.cards.map(([name, copies]) => (
                  <li key={name} className="flex">
                    <span className="w-6 shrink-0 text-ink-3">{copies}×</span>
                    {name}
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
        <p className="mt-2 text-xs text-ink-3">
          List and portrait from{' '}
          <a href={`https://yugipedia.com/wiki/${encodeURIComponent(deck.wiki.replaceAll(' ', '_'))}`} target="_blank" rel="noreferrer" className="underline hover:text-accent">
            Yugipedia
          </a>
          . Style and summary are this app's reading of the list.
        </p>
      </div>
    </details>
  )
}

function Stat({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-ink-3">{label}</dt>
      <dd className="font-display text-xl font-semibold">{children}</dd>
    </div>
  )
}

function AddReading({ duelist }: { duelist: Duelist }) {
  const { reportError } = useApp()
  const [rating, setRating] = useState('')
  // Empty means "when I press Add": a reading must not predate a tournament saved since the page opened.
  const [at, setAt] = useState('')
  const [note, setNote] = useState('')
  const valid = /^\d{1,5}$/.test(rating.trim()) && (at === '' || !Number.isNaN(new Date(at).getTime()))
  return (
    <form
      className="mt-3 flex flex-wrap items-end gap-2 text-sm"
      onSubmit={(e) => {
        e.preventDefault()
        if (!valid) return
        saveReading({ duelistId: duelist.id, rating: Number(rating), observedAt: at === '' ? new Date() : new Date(at), note: note.trim() || undefined }, reportError)
        setRating('')
        setAt('')
        setNote('')
      }}
    >
      <label className="flex flex-col gap-1">
        <span className="text-ink-2">Rating seen outside a tournament</span>
        <input className="field w-28" inputMode="numeric" placeholder="e.g. 1141" value={rating} onChange={(e) => setRating(e.target.value)} />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-ink-2">Seen at (empty = now)</span>
        <input type="datetime-local" step={1} className="field" value={at} onChange={(e) => setAt(e.target.value)} />
      </label>
      <label className="flex min-w-40 flex-1 flex-col gap-1">
        <span className="text-ink-2">Note (optional)</span>
        <input className="field" value={note} onChange={(e) => setNote(e.target.value)} />
      </label>
      <button className="btn btn-primary" disabled={!valid}>
        Add reading
      </button>
    </form>
  )
}

function ReadingActions({ duelistId, point }: { duelistId: string; point: HistoryPoint }) {
  const { reportError } = useApp()
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(String(point.observation.rating))
  if (editing) {
    return (
      <span className="inline-flex gap-1">
        <input className="field w-20 text-right" value={value} onChange={(e) => setValue(e.target.value)} aria-label="Corrected rating" />
        <button
          className="btn px-2 py-0.5"
          disabled={!/^\d{1,5}$/.test(value.trim())}
          onClick={() => {
            const o = point.observation
            saveReading({ id: o.id, duelistId, rating: Number(value), observedAt: o.observedAt, note: o.note, createdAt: o.createdAt }, reportError)
            setEditing(false)
          }}
        >
          Save
        </button>
      </span>
    )
  }
  return (
    <span className="inline-flex gap-2 text-xs">
      <button className="text-accent hover:underline" onClick={() => setEditing(true)}>
        Edit
      </button>
      <button className="text-down hover:underline" onClick={() => deleteReading(point.observation.id, reportError)}>
        Delete
      </button>
    </span>
  )
}

function OwnerControls({ duelist }: { duelist: Duelist }) {
  const { reportError } = useApp()
  const [notes, setNotes] = useState(duelist.notes ?? '')
  return (
    <div className="mt-6 space-y-3 text-sm">
      <label className="flex items-center gap-2">
        <input type="checkbox" checked={duelist.unlocked} onChange={(e) => updateDuelist(duelist.id, { unlocked: e.target.checked }, reportError)} />
        Unlocked in my save
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-ink-2">Notes</span>
        <textarea className="field min-h-20" value={notes} onChange={(e) => setNotes(e.target.value)} />
      </label>
      {notes !== (duelist.notes ?? '') && (
        <button className="btn" onClick={() => updateDuelist(duelist.id, { notes }, reportError)}>
          Save notes
        </button>
      )}
      {duelist.notes && notes === duelist.notes && <Tag>saved</Tag>}
    </div>
  )
}
