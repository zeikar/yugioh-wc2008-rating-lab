import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { Link } from 'react-router'
import { useApp } from '../app/context'
import { saveRef } from '../app/datasets'
import { Empty } from '../components/Empty'
import { plural } from '../components/format'
import { PageTitle } from '../components/Layout'
import { Rating, RatingMark } from '../components/Rating'
import { ROSTER } from '../data/duelists'
import { saveRosterSetup } from '../db/repository'
import { parseRating } from '../domain/draft'
import { ratingsToFill, rosterSetupPayload, withSaveFill, type RosterRowEdit } from '../domain/roster'
import { MAX_SAVE_FILE_SIZE, readSaveRatings } from '../domain/saveFile'

/**
 * Brings the save in line with the built-in roster and records where the
 * user's game stands: which CPUs are unlocked and their current ratings
 * (MVP §5). Rows are in the game's own list order.
 */
export function RosterSetupPage() {
  const { model, base, dataset, canEdit, user, synced, reportError } = useApp()
  const [edits, setEdits] = useState<Record<string, RosterRowEdit>>({})
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null)
  const [saving, setSaving] = useState(false)
  const saveFileInput = useRef<HTMLInputElement>(null)

  const stored = model.duelistById
  const payload = useMemo(() => rosterSetupPayload(ROSTER, model.data.duelists, edits), [model.data.duelists, edits])
  const pending = payload.create.length + payload.update.length + payload.readings.length
  const baseUnlocked = (id: string) => stored.get(id)?.unlocked ?? ROSTER.find((d) => d.id === id)!.unlocked
  const unlockedOf = (id: string) => edits[id]?.unlocked ?? baseUnlocked(id)
  const unlockedCount = ROSTER.filter((d) => unlockedOf(d.id)).length
  const firstSetup = model.data.duelists.length === 0
  const saveDisabled = saving || !synced || pending === 0 || payload.errors.length > 0

  // Typed ratings live only in this page; don't lose them to a stray reload.
  // A row cleared back to how it was, by hand or by a save-file fill, doesn't count.
  // While saving, the stored flags already show the local write; keep warning until the server accepts it.
  const dirty = saving || Object.entries(edits).some(([id, e]) => e.rating.trim() !== '' || e.unlocked !== baseUnlocked(id))
  useEffect(() => {
    if (!dirty) return
    const warn = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  if (!canEdit) {
    if (dataset?.kind === 'research') return <Empty>The research dataset is read-only.</Empty>
    if (!user) return <Empty>Sign in to set up your own save.</Empty>
    return (
      <Empty>
        This isn't your save, so its roster is read-only.{' '}
        <Link to={`${saveRef(user.uid).base}/roster`} className="text-accent underline">
          Open your own roster
        </Link>
      </Empty>
    )
  }

  const edit = (id: string, fn: (e: RosterRowEdit) => RosterRowEdit) => {
    setEdits((all) => ({ ...all, [id]: fn(all[id] ?? { unlocked: unlockedOf(id), rating: '' }) }))
    setMessage(null)
  }
  const setAll = (unlocked: boolean) =>
    setEdits((all) => Object.fromEntries(ROSTER.map((d) => [d.id, { unlocked, rating: all[d.id]?.rating ?? '' }])))

  const save = () => {
    const counts = `${payload.create.length} added, ${payload.update.length} updated, ${plural(payload.readings.length, 'rating')} recorded`
    setSaving(true)
    setMessage({ text: 'Saving… (waiting for the server)' })
    // Edits stay until the server accepts the save, so a rejection loses nothing.
    saveRosterSetup(dataset.uid, payload, new Date(), reportError).then(
      () => {
        setEdits({})
        setSaving(false)
        setMessage({ text: `Roster saved: ${counts}.` })
      },
      () => {
        setSaving(false)
        setMessage({ text: 'The save was rejected, so nothing changed and your entries are still here.', error: true })
      },
    )
  }

  const fillFromSave = async (file: File) => {
    // Checked before reading: with no accept filter, a video picked by mistake could crash the tab.
    if (file.size > MAX_SAVE_FILE_SIZE) {
      setMessage({ text: `${file.name} can't be used. It's too large to be a WC2008 save file (256 KiB).`, error: true })
      return
    }
    let bytes: Uint8Array
    try {
      bytes = new Uint8Array(await file.arrayBuffer())
    } catch (e) {
      setMessage({ text: `Couldn't read ${file.name}: ${(e as Error).message}.`, error: true })
      return
    }
    const read = readSaveRatings(bytes, ROSTER)
    if (!read.ok) {
      setMessage({ text: `${file.name} can't be used. ${read.error}.`, error: true })
      return
    }
    const fill = ratingsToFill(ROSTER, read.ratings, (id) => model.rowById.get(id)?.rating.current)
    const cleared = Object.entries(edits).filter(([id, e]) => e.rating.trim() !== '' && !fill.has(id)).length
    setEdits((all) => withSaveFill(all, fill, unlockedOf))
    const result =
      fill.size > 0
        ? `Filled ${plural(fill.size, 'rating')} from ${file.name}. Check them, then save.`
        : `${file.name} matches every rating the app knows, so there is nothing to fill.`
    setMessage({ text: cleared > 0 ? `${result} Cleared ${plural(cleared, 'rating')} entered earlier.` : result })
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
              {unlockedCount} of {ROSTER.length} unlocked, {plural(payload.readings.length, 'rating')} to record
            </span>
            {/* Needs the loaded ratings to tell what's new, like Save. */}
            <button className="btn" disabled={saving || !synced} onClick={() => saveFileInput.current?.click()}>
              Fill from save file
            </button>
            {/* No accept filter: iOS greys out extensions it doesn't know, such as Delta's .dsv. */}
            <input
              ref={saveFileInput}
              type="file"
              hidden
              onChange={(e) => {
                const file = e.target.files?.[0]
                e.target.value = '' // picking the same file again still fires
                if (file) void fillFromSave(file)
              }}
            />
            <button className="btn btn-primary" disabled={saveDisabled} onClick={save}>
              Save roster
            </button>
          </div>
        }
      >
        Roster setup
      </PageTitle>

      {/* Every status note sits right under the buttons, above the instructions. */}
      <div className="max-w-prose text-sm">
        {/* Always mounted: screen readers skip a live region that appears together with its text. */}
        <div role="status">{message && <p className={`mb-2 font-medium ${message.error ? 'text-down' : 'text-ink'}`}>{message.text}</p>}</div>
        {!synced && <p className="mb-2 font-medium text-warn">Waiting for a connection to the server. Saving works only on fully loaded data.</p>}
        {payload.errors.map((e) => (
          <p key={e} className="mb-2 font-medium text-down">
            {e}.
          </p>
        ))}
      </div>
      <div className="mb-4 max-w-prose space-y-2 text-sm text-ink-2">
        <p>
          Tick the CPUs unlocked in your save and type each one's current rating as the game shows it. Saving records those ratings as readings taken now, which
          become the starting point of each CPU's history. Leave a rating empty to record nothing for that CPU.
        </p>
        <p>
          The initial column is the rating on a fresh save, from the guides (<Link to={`${base}/duelists`} className="text-accent underline">details per duelist</Link>
          ). Enter moves to the next rating; typing a rating ticks Unlocked.
        </p>
        <p>
          <strong>Fill from save file</strong> reads the ratings from your save file (such as the <code>.dsv</code> Delta exports) and fills in the ones the
          app doesn't know yet, replacing any ratings already typed. Use a save from after your last recorded tournament.
        </p>
        {firstSetup && <p className="font-medium text-ink">The roster isn't in the database yet. Saving adds all {ROSTER.length} duelists.</p>}
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
              // Marked in the row itself: the error list at the top is off-screen from most of the table.
              const invalid = parseRating(row?.rating) === 'invalid'
              return (
                <tr key={d.id} className={`[&>td]:py-1 ${unlocked ? '' : 'text-ink-3'}`}>
                  <td className="num text-ink-3">{i + 1}</td>
                  <td>
                    {/* Red too: on a phone the table opens scrolled left, with the rating input off-screen. */}
                    <span className={`font-medium ${invalid ? 'text-down' : ''}`}>{d.name}</span>
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
                        className={`field w-20 py-0.5 text-right ${invalid ? 'border-down' : ''}`}
                        aria-invalid={invalid || undefined}
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
        {payload.errors.length > 0 ? (
          <span className="font-medium text-down">Fix {plural(payload.errors.length, 'rating')} marked in red to save.</span>
        ) : (
          message && <span className={message.error ? 'text-down' : 'text-ink-2'}>{message.text}</span>
        )}
        <button className="btn btn-primary" disabled={saveDisabled} onClick={save}>
          Save roster
        </button>
      </div>
    </>
  )
}
