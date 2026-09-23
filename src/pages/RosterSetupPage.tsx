import { useEffect, useMemo, useState, type KeyboardEvent } from 'react'
import { Link } from 'react-router'
import { useApp } from '../app/context'
import { Empty } from '../components/Empty'
import { PageTitle } from '../components/Layout'
import { Rating, RatingMark } from '../components/Rating'
import { ROSTER } from '../data/duelists'
import { saveRosterSetup } from '../db/repository'
import { rosterSetupPayload, type RosterRowEdit } from '../domain/roster'

/**
 * Brings the database in line with the built-in roster and records where the
 * owner's save stands: which CPUs are unlocked and their current ratings
 * (MVP §5). Rows are in the game's own list order.
 */
export function RosterSetupPage() {
  const { model, isAdmin, synced, reportError } = useApp()
  const [edits, setEdits] = useState<Record<string, RosterRowEdit>>({})
  const [message, setMessage] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const stored = model.duelistById
  const payload = useMemo(() => rosterSetupPayload(ROSTER, model.data.duelists, edits), [model.data.duelists, edits])
  const pending = payload.create.length + payload.update.length + payload.readings.length
  const unlockedOf = (id: string) => edits[id]?.unlocked ?? stored.get(id)?.unlocked ?? ROSTER.find((d) => d.id === id)!.unlocked
  const unlockedCount = ROSTER.filter((d) => unlockedOf(d.id)).length
  const firstSetup = model.data.duelists.length === 0
  const saveDisabled = saving || !synced || pending === 0 || payload.errors.length > 0

  // Typed ratings live only in this page; don't lose them to a stray reload.
  const dirty = Object.keys(edits).length > 0
  useEffect(() => {
    if (!dirty) return
    const warn = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  if (!isAdmin) return <Empty>Only the owner can set up the roster. Sign in on the Data page.</Empty>

  const edit = (id: string, fn: (e: RosterRowEdit) => RosterRowEdit) => {
    setEdits((all) => ({ ...all, [id]: fn(all[id] ?? { unlocked: unlockedOf(id), rating: '' }) }))
    setMessage(null)
  }
  const setAll = (unlocked: boolean) =>
    setEdits((all) => Object.fromEntries(ROSTER.map((d) => [d.id, { unlocked, rating: all[d.id]?.rating ?? '' }])))

  const save = () => {
    const counts = `${payload.create.length} added, ${payload.update.length} updated, ${payload.readings.length} ratings recorded`
    setSaving(true)
    setMessage('Saving… (waiting for the server)')
    // Edits stay until the server accepts the save, so a rejection loses nothing.
    saveRosterSetup(payload, new Date(), reportError).then(
      () => {
        setEdits({})
        setSaving(false)
        setMessage(`Roster saved: ${counts}.`)
      },
      () => {
        setSaving(false)
        setMessage('The save was rejected, so nothing changed and your entries are still here.')
      },
    )
  }

  // Enter moves down the rating column, so a whole list goes in without the mouse.
  const nextOnEnter = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter' || e.nativeEvent.isComposing) return
    e.preventDefault()
    const inputs = [...document.querySelectorAll<HTMLInputElement>('input[data-roster-rating]')]
    inputs[inputs.indexOf(e.currentTarget) + 1]?.focus()
  }

  return (
    <>
      <PageTitle
        aside={
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <span className="text-ink-2">
              {unlockedCount} of {ROSTER.length} unlocked, {payload.readings.length} ratings to record
            </span>
            <button className="btn btn-primary" disabled={saveDisabled} onClick={save}>
              Save roster
            </button>
          </div>
        }
      >
        Roster setup
      </PageTitle>

      <div className="mb-4 max-w-prose space-y-2 text-sm text-ink-2">
        <p>
          Tick the CPUs unlocked in your save and type each one's current rating as the game shows it. Saving records those ratings as readings taken now, which
          become the starting point of each CPU's history. Leave a rating empty to record nothing for that CPU.
        </p>
        <p>
          The initial column is the rating on a fresh save, from the guides (<Link to="/duelists" className="text-accent underline">details per duelist</Link>
          ). Enter moves to the next rating; typing a rating ticks Unlocked.
        </p>
        {firstSetup && <p className="font-medium text-ink">The roster isn't in the database yet. Saving adds all {ROSTER.length} duelists.</p>}
        {!synced && <p className="text-warn">Waiting for a connection to the server. Saving works only on fully loaded data.</p>}
        {payload.errors.map((e) => (
          <p key={e} className="text-down">
            {e}.
          </p>
        ))}
        {message && <p className="text-ink">{message}</p>}
      </div>

      <div className="panel overflow-x-auto">
        <table className="table">
          <thead>
            <tr>
              <th className="num">#</th>
              <th>Duelist</th>
              <th>LV</th>
              <th className="num">Initial</th>
              <th>
                <span className="flex items-center gap-2">
                  Unlocked
                  <button className="text-xs font-medium text-accent hover:underline" onClick={() => setAll(true)}>
                    all
                  </button>
                  <button className="text-xs font-medium text-accent hover:underline" onClick={() => setAll(false)}>
                    none
                  </button>
                </span>
              </th>
              <th className="num">Last known</th>
              <th className="num">Current rating</th>
            </tr>
          </thead>
          <tbody>
            {ROSTER.map((d, i) => {
              const row = edits[d.id]
              const unlocked = unlockedOf(d.id)
              const known = model.rowById.get(d.id)?.rating.current
              return (
                <tr key={d.id} className={`[&>td]:py-1 ${unlocked ? '' : 'text-ink-3'}`}>
                  <td className="num text-ink-3">{i + 1}</td>
                  <td>
                    <span className="font-medium">{d.name}</span>
                    {d.aliases?.[0] && <span className="ml-2 text-xs text-ink-3">{d.aliases[0]}</span>}
                  </td>
                  <td>{d.tournamentLevel}</td>
                  <td className="num">{d.initialRating ?? '—'}</td>
                  <td>
                    <input
                      type="checkbox"
                      aria-label={`${d.name} unlocked`}
                      checked={unlocked}
                      onChange={(e) => edit(d.id, (r) => ({ ...r, unlocked: e.target.checked }))}
                    />
                  </td>
                  <td className="num">{known && known.kind !== 'baseline' ? <Rating value={known.value} stale={known.stale} /> : <span className="text-ink-3">—</span>}</td>
                  <td className="num">
                    <span className="inline-flex items-center gap-1">
                      <RatingMark className="size-3.5" />
                      <input
                        data-roster-rating
                        aria-label={`Current rating of ${d.name}`}
                        className="field w-20 py-0.5 text-right"
                        inputMode="numeric"
                        value={row?.rating ?? ''}
                        onKeyDown={nextOnEnter}
                        onChange={(e) => {
                          const rating = e.target.value
                          edit(d.id, (r) => ({ ...r, rating, unlocked: rating.trim() ? true : r.unlocked }))
                        }}
                      />
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {/* 78 rows scroll the top button out of reach. */}
      <div className="mt-4 flex items-center justify-end gap-3 text-sm">
        {message && <span className="text-ink-2">{message}</span>}
        <button className="btn btn-primary" disabled={saveDisabled} onClick={save}>
          Save roster
        </button>
      </div>
    </>
  )
}
