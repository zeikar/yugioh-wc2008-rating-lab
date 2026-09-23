import { useMemo, useState, type KeyboardEvent, type ReactNode } from 'react'
import { flushSync } from 'react-dom'
import { Link, useLocation, useNavigate, useParams } from 'react-router'
import { useApp } from '../app/context'
import { discardDraft, loadDraft, storeDraft } from '../app/drafts'
import { Delta } from '../components/Delta'
import { DuelistLink } from '../components/DuelistLink'
import { DuelistPicker } from '../components/DuelistPicker'
import { Empty } from '../components/Empty'
import { PageTitle } from '../components/Layout'
import { Rating } from '../components/Rating'
import { deleteTournament, saveTournament } from '../db/repository'
import {
  BRACKET_SLOTS,
  buildSavePayload,
  draftFingerprint,
  draftFromSaved,
  emptyMatchDraft,
  entryRatingsOf,
  evaluateDraft,
  type DraftEvaluation,
  type TournamentDraft,
} from '../domain/draft'
import { MATCHES_PER_ROUND, ROUND_LABEL, isCpu, matchLabel, slotKey, type Pairing } from '../domain/bracket'
import { displayName } from '../domain/stats'
import { buildTimeline, ratingAtStart } from '../domain/timeline'
import { ratingEnteringRound } from '../domain/tournamentRatings'
import { PLAYER_ID, ROUNDS, type Duelist, type Round, type Tournament, type TournamentLevel } from '../types'

export function TournamentPage() {
  const { id = '' } = useParams()
  const { model, isAdmin, loading } = useApp()
  if (loading) return <p className="text-ink-2">Loading…</p>
  const saved = model.tournamentById.get(id)
  if (isAdmin) return <TournamentEditor key={id} id={id} saved={saved} />
  if (!saved) {
    return (
      <Empty>
        No saved tournament here. <Link to="/tournaments" className="text-accent underline">Back to tournaments</Link>
      </Empty>
    )
  }
  return <TournamentView tournament={saved} />
}

function useSavedDocs(id: string, saved: Tournament | undefined) {
  const { model } = useApp()
  return useMemo(
    () => ({
      tournament: saved,
      matches: model.data.matches.filter((m) => m.tournamentId === id),
      observations: model.data.observations.filter((o) => o.tournamentId === id),
    }),
    [model.data, id, saved],
  )
}

function TournamentView({ tournament }: { tournament: Tournament }) {
  const docs = useSavedDocs(tournament.id, tournament)
  const draft = useMemo(() => draftFromSaved(tournament, docs.matches, docs.observations), [tournament, docs])
  const ev = useMemo(() => evaluateDraft(draft, entryRatingsOf(tournament.id, docs.observations)), [draft, tournament.id, docs])
  return (
    <>
      <PageTitle>
        Tournament #{tournament.number}
        {tournament.title && <span className="ml-2 font-medium text-ink-2">{tournament.title}</span>}
      </PageTitle>
      <p className="-mt-3 mb-5 text-sm text-ink-2">
        Level {tournament.tournamentLevel}, {tournament.playedAt.toLocaleString()}
      </p>
      {tournament.notes && <p className="mb-5 max-w-prose text-sm">{tournament.notes}</p>}
      <Bracket draft={draft} ev={ev} editable={false} />
      <Transfers ev={ev} />
    </>
  )
}

function TournamentEditor({ id, saved }: { id: string; saved: Tournament | undefined }) {
  const { model, reportError, synced } = useApp()
  const navigate = useNavigate()
  const location = useLocation()
  const docs = useSavedDocs(id, saved)
  // Local edits live in `edits`, mirrored to localStorage. A new tournament's
  // first draft also arrives through navigation state, for when storage is blocked.
  const [edits, setEdits] = useState<TournamentDraft | null>(() => {
    const passed = (location.state as { draft?: TournamentDraft } | null)?.draft
    return loadDraft(id) ?? (passed?.id === id ? passed : null)
  })
  const fromSaved = useMemo(() => (saved ? draftFromSaved(saved, docs.matches, docs.observations) : null), [saved, docs])
  // What was just saved, normalized like fromSaved. Shown until the server
  // confirms the save, so the form never flickers to a half-arrived snapshot.
  const [justSaved, setJustSaved] = useState<TournamentDraft | null>(null)
  const draft = edits ?? justSaved ?? fromSaved
  const dirty = edits !== null
  const [message, setMessage] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  // The saved tournament changed since these edits began (another tab or device)
  // and not to what we'd save anyway: saving would overwrite that change.
  const savedVersion = fromSaved ? draftFingerprint(fromSaved) : null
  const conflict = edits !== null && savedVersion !== null && savedVersion !== (edits.baseVersion ?? null) && savedVersion !== draftFingerprint(edits)

  // Each CPU's rating going in comes from its history, which depends only on
  // where this tournament sits on the timeline, not on what's typed into it.
  const draftPlayedAt = draft?.playedAt
  const draftNumber = draft?.number
  const historyIndex = useMemo(() => {
    if (draftPlayedAt === undefined || draftNumber === undefined) return null
    const playedAt = new Date(draftPlayedAt)
    const stub: Tournament = {
      id,
      number: draftNumber,
      playedAt: Number.isNaN(playedAt.getTime()) ? new Date() : playedAt,
      tournamentLevel: 1,
      entrants: [],
      createdAt: saved?.createdAt ?? new Date(),
    }
    return buildTimeline({
      tournaments: [...model.data.tournaments.filter((t) => t.id !== id), stub],
      matches: model.data.matches.filter((m) => m.tournamentId !== id),
      observations: model.data.observations.filter((o) => o.tournamentId !== id),
    })
  }, [model.data, id, draftPlayedAt, draftNumber, saved])
  const entrantsKey = draft?.entrants.join('|') ?? ''
  const entryRatings = useMemo(() => {
    const ratings = new Map<string, number>()
    if (!historyIndex) return ratings
    for (const cpu of entrantsKey.split('|').filter(isCpu)) {
      const duelist = model.duelistById.get(cpu)
      const r = duelist ? ratingAtStart(historyIndex, duelist, id) : null
      if (r !== null) ratings.set(cpu, r)
    }
    return ratings
  }, [historyIndex, entrantsKey, model.duelistById, id])
  const ev = useMemo(() => (draft ? evaluateDraft(draft, entryRatings) : null), [draft, entryRatings])

  // A saved tournament whose history changed after it was saved (a reading or
  // an earlier tournament was corrected): saving again brings it up to date.
  const stale = useMemo(() => {
    if (!saved) return []
    const stored = entryRatingsOf(id, docs.observations)
    return [...entryRatings].filter(([cpu, r]) => stored.get(cpu) !== r).map(([cpu, r]) => ({ cpu, was: stored.get(cpu) ?? null, now: r }))
  }, [saved, id, docs, entryRatings])

  if (!draft || !ev || !historyIndex) {
    return (
      <Empty>
        This tournament doesn't exist or was discarded. <Link to="/tournaments" className="text-accent underline">Back to tournaments</Link>
      </Empty>
    )
  }

  const update = (fn: (d: TournamentDraft) => void) => {
    setEdits((current) => {
      // A fresh edit session remembers which saved version it started from.
      const next = current ? structuredClone(current) : { ...structuredClone(draft), baseVersion: justSaved ? draftFingerprint(justSaved) : savedVersion }
      fn(next)
      storeDraft(next)
      return next
    })
    setMessage(null)
  }

  const save = () => {
    let payload
    try {
      payload = buildSavePayload(draft, entryRatings, docs, new Date())
    } catch (e) {
      setMessage((e as Error).message)
      return
    }
    // Normalized exactly as the saved version will read back, so a reload
    // while the save is pending doesn't look like a conflicting change.
    const sent = draftFromSaved(payload.tournament, payload.matches, payload.observations)
    // The local copy stays in storage until the server accepts the save, so a
    // rejected or interrupted save loses nothing.
    storeDraft({ ...sent, baseVersion: draft.baseVersion ?? null })
    setJustSaved(sent)
    setEdits(null)
    setSaving(true)
    setMessage(null)
    saveTournament(payload, reportError).then(
      () => {
        const stored = loadDraft(id)
        if (stored && draftFingerprint(stored) === draftFingerprint(sent)) discardDraft(id)
        setJustSaved(null)
        setSaving(false)
        setMessage(`Saved tournament #${sent.number}.`)
      },
      () => {
        setEdits(loadDraft(id) ?? sent)
        setJustSaved(null)
        setSaving(false)
        setMessage('The save was rejected, so your entries are kept here. Fix the problem above and save again.')
      },
    )
  }

  const discard = () => {
    discardDraft(id)
    setEdits(null)
    setJustSaved(null)
    if (!saved) navigate('/tournaments')
  }

  const remove = () => {
    deleteTournament(id, model.data, reportError)
    discardDraft(id)
    navigate('/tournaments')
  }

  return (
    <div onKeyDown={moveOnEnter}>
      <PageTitle
        aside={
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-ink-2">
              {dirty ? (saved ? 'Unsaved changes' : 'Not saved yet') : saving ? 'Saving… (waiting for the server)' : 'All changes saved'}
            </span>
            {dirty && (
              <button className="btn" onClick={discard}>
                {saved ? 'Discard changes' : 'Discard tournament'}
              </button>
            )}
            <button className="btn btn-primary" disabled={(!dirty && stale.length === 0) || conflict || ev.errors.length > 0} onClick={save}>
              Save tournament
            </button>
          </div>
        }
      >
        Tournament #{draft.number}
      </PageTitle>

      <div className="mb-5 flex flex-wrap items-end gap-4 text-sm">
        <label className="flex flex-col gap-1">
          <span className="text-ink-2">Level</span>
          <select
            className="field"
            value={draft.tournamentLevel}
            onChange={(e) => update((d) => void (d.tournamentLevel = Number(e.target.value) as TournamentLevel))}
          >
            {[1, 2, 3].map((l) => (
              <option key={l} value={l}>
                Level {l}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-ink-2">Played at</span>
          <input type="datetime-local" step={1} className="field" value={draft.playedAt} onChange={(e) => update((d) => void (d.playedAt = e.target.value))} />
        </label>
        <label className="flex min-w-48 flex-1 flex-col gap-1">
          <span className="text-ink-2">Title (optional)</span>
          <input className="field" value={draft.title} onChange={(e) => update((d) => void (d.title = e.target.value))} />
        </label>
        <label className="flex min-w-48 flex-[2] flex-col gap-1">
          <span className="text-ink-2">Notes (optional)</span>
          <input className="field" value={draft.notes} onChange={(e) => update((d) => void (d.notes = e.target.value))} />
        </label>
      </div>

      {stale.length > 0 && !dirty && (
        <div role="status" className="mb-4 rounded-md border border-[#f0d9a8] bg-warn-soft px-3 py-2 text-sm text-warn">
          Ratings going into this tournament changed after it was saved:{' '}
          {stale.map((s) => `${displayName(model, s.cpu)} ${s.was ?? '—'} → ${s.now}`).join(', ')}. Save again to update this tournament.
        </div>
      )}

      {conflict && (
        <div role="alert" className="mb-4 flex flex-wrap items-center gap-3 rounded-md border border-[#f0d9a8] bg-warn-soft px-3 py-2 text-sm text-warn">
          This tournament was changed in another tab or on another device after you started editing here. Saving now would overwrite that.
          <button className="btn" onClick={discard}>
            Load the latest (drop my edits)
          </button>
          <button className="btn" onClick={() => update((d) => void (d.baseVersion = savedVersion))}>
            Keep my edits
          </button>
        </div>
      )}

      {(ev.errors.length > 0 || message) && (
        <div className="mb-4 space-y-1 text-sm">
          {ev.errors.map((e) => (
            <p key={e} className="text-down">
              Can't save yet: {e}.
            </p>
          ))}
          {message && <p className="text-ink-2">{message}</p>}
        </div>
      )}

      <p className="mb-3 max-w-prose text-sm text-ink-2">
        Seat the 8 entrants in bracket order; each CPU's rating going in comes from its history. After a CPU duel, type either side's new rating: the other
        side and the winner follow from it. For your own duels, press 1 or 2 (or click) to pick the winner. Enter moves to the next field.
      </p>

      <Bracket draft={draft} ev={ev} editable update={update} />
      <Transfers ev={ev} />

      {saved && (
        <div className="mt-10 border-t border-rule pt-4 text-sm">
          {!synced ? (
            <span className="text-ink-3">Deleting needs a connection to the server, so every linked rating is included.</span>
          ) : confirmDelete ? (
            <span className="flex flex-wrap items-center gap-3">
              Delete this tournament, its matches and every rating recorded in it?
              <button className="btn btn-danger" onClick={remove}>
                Delete tournament
              </button>
              <button className="btn" onClick={() => setConfirmDelete(false)}>
                Keep it
              </button>
            </span>
          ) : (
            <button className="text-down underline" onClick={() => setConfirmDelete(true)}>
              Delete tournament…
            </button>
          )}
        </div>
      )}
    </div>
  )
}

/** Enter on a [data-nav] field focuses the next one in data-nav order (MVP §6.5). */
function moveOnEnter(e: KeyboardEvent<HTMLDivElement>) {
  // The Enter that confirms an IME conversion (e.g. a Japanese alias) is not navigation.
  if (e.key !== 'Enter' || e.nativeEvent.isComposing) return
  const target = e.target as HTMLElement
  const n = Number(target.dataset.nav)
  if (target.dataset.nav === undefined || Number.isNaN(n)) return
  e.preventDefault()
  // Fields that Enter itself reveals (a seat's rating input) are already in
  // the DOM here: the picker commits its choice with flushSync.
  const next = [...e.currentTarget.querySelectorAll<HTMLElement>('[data-nav]')]
    .map((el) => ({ el, n: Number(el.dataset.nav) }))
    .filter((x) => x.n > n && !(x.el as HTMLInputElement).disabled)
    .sort((a, b) => a.n - b.n)[0]
  next?.el.focus()
}

interface BracketProps {
  draft: TournamentDraft
  ev: DraftEvaluation
  editable: boolean
  update?: (fn: (d: TournamentDraft) => void) => void
}

function Bracket(props: BracketProps) {
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1fr)]">
      {ROUNDS.map((round) => (
        <section key={round} aria-label={ROUND_LABEL[round]} className="flex flex-col">
          <h2 className="mb-2 text-lg font-semibold text-ink-2">{ROUND_LABEL[round]}</h2>
          <div className="flex flex-1 flex-col justify-around gap-3">
            {Array.from({ length: MATCHES_PER_ROUND[round] }, (_, slot) => (
              <MatchCard key={slot} {...props} round={round} slot={slot} />
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}

function MatchCard({ draft, ev, editable, update, round, slot }: BracketProps & { round: Round; slot: number }) {
  const { model } = useApp()
  const key = slotKey(round, slot)
  const pairing = ev.pairings.find((p) => p.round === round && p.slot === slot)!
  const ratings = ev.ratings.matches.find((r) => r.match.round === round && r.match.slot === slot)
  const result = draft.results[key] ?? emptyMatchDraft()
  const order = BRACKET_SLOTS.findIndex((s) => s.round === round && s.slot === slot)
  const nav = 100 + order * 10
  const players = [pairing.playerAId, pairing.playerBId]
  const cpuMatch = isCpu(players[0]) && isCpu(players[1])
  const ready = players[0] !== null && players[1] !== null
  // A CPU duel's winner follows from the typed ratings; a manual pick is only for your duels,
  // or a CPU duel whose ratings going in are unknown.
  const decidedByRatings = ev.inferredWinner.get(key) != null
  const needsManualPick = ready && (!cpuMatch || players.every((p) => p !== null && ratingEnteringRound(ev.ratings, ev.entryRatings, p, round) === null))
  const setResult = (fn: (r: TournamentDraft['results'][string]) => void) =>
    update?.((d) => {
      const r = d.results[key] ?? emptyMatchDraft()
      fn(r)
      d.results[key] = r
    })
  const pickWinner = (i: 0 | 1) => {
    const p = players[i]
    // Synchronous so an Enter right after the key press finds the rating inputs this reveals.
    if (editable && ready && p && !decidedByRatings) flushSync(() => setResult((r) => void (r.winnerId = r.winnerId === p ? null : p)))
  }

  return (
    <div className={`panel p-3 ${pairing.winnerId ? '' : 'border-dashed'}`}>
      <div className="mb-2 flex items-center justify-between text-xs text-ink-3">
        <span className="font-display text-sm font-semibold text-ink-2">{matchLabel(round, slot)}</span>
        {!ready && round !== 'quarterfinal' && <span>Waiting for both winners</span>}
        {ready && !cpuMatch && <span>Your duel: ratings don't change</span>}
      </div>
      <div
        role="group"
        aria-label={needsManualPick ? `${matchLabel(round, slot)}: press 1 or 2 to pick the winner` : matchLabel(round, slot)}
        tabIndex={editable && needsManualPick ? 0 : -1}
        data-nav={editable && needsManualPick ? nav : undefined}
        onKeyDown={(e) => {
          // Only when the group itself has focus: the rating inputs inside it take digits too.
          if (e.target !== e.currentTarget) return
          if (e.key === '1') pickWinner(0)
          if (e.key === '2') pickWinner(1)
        }}
        className="space-y-1.5 rounded-md"
      >
        {[0, 1].map((i) => (
          <SideRow
            key={i}
            side={i as 0 | 1}
            round={round}
            slot={slot}
            pairing={pairing}
            ratings={ratings}
            draft={draft}
            ev={ev}
            editable={editable}
            update={update}
            duelists={model.data.duelists}
            decidedByRatings={decidedByRatings}
            onWinner={() => pickWinner(i as 0 | 1)}
            setPost={(id, v) => setResult((r) => void (r.post[id] = v))}
            postValue={players[i] ? (result.post[players[i]!] ?? '') : ''}
            navBase={nav}
          />
        ))}
      </div>
      {ratings?.mismatch && <p className="mt-2 text-xs text-down">The two new ratings don't cancel out. One of them is probably a typo.</p>}
      {ratings?.winnerNotUp && <p className="mt-2 text-xs text-down">The winner didn't gain points. Check the winner or the ratings.</p>}
      {editable && ready && !pairing.winnerId && (result.remainingLp || result.notes) && (
        <p className="mt-2 text-xs text-ink-3">LP and notes are saved once a winner is picked.</p>
      )}
      {(editable || result.remainingLp || result.notes) && ready && (
        <div className="mt-2 flex gap-2 text-xs">
          {editable ? (
            <>
              <input
                aria-label="Winner's remaining LP"
                className="field w-20"
                placeholder="Winner's LP"
                inputMode="numeric"
                data-nav={nav + 3}
                value={result.remainingLp}
                onChange={(e) => setResult((r) => void (r.remainingLp = e.target.value))}
              />
              <input aria-label="Match notes" className="field flex-1" placeholder="Notes" value={result.notes} onChange={(e) => setResult((r) => void (r.notes = e.target.value))} />
            </>
          ) : (
            <span className="text-ink-2">
              {result.remainingLp && `${result.remainingLp} LP left`}
              {result.remainingLp && result.notes && ', '}
              {result.notes}
            </span>
          )}
        </div>
      )}
    </div>
  )
}

interface SideRowProps {
  side: 0 | 1
  round: Round
  slot: number
  pairing: Pairing
  ratings: DraftEvaluation['ratings']['matches'][number] | undefined
  draft: TournamentDraft
  ev: DraftEvaluation
  editable: boolean
  update?: BracketProps['update']
  duelists: Duelist[]
  decidedByRatings: boolean
  onWinner: () => void
  setPost: (duelistId: string, value: string) => void
  postValue: string
  navBase: number
}

function SideRow({ side, round, slot, pairing, ratings, draft, ev, editable, update, duelists, decidedByRatings, onWinner, setPost, postValue, navBase }: SideRowProps) {
  const { model } = useApp()
  const id = side === 0 ? pairing.playerAId : pairing.playerBId
  const other = side === 0 ? pairing.playerBId : pairing.playerAId
  const seat = slot * 2 + side
  const isWinner = pairing.winnerId !== null && pairing.winnerId === id
  const isLoser = pairing.winnerId !== null && pairing.winnerId !== id
  const cpuMatch = isCpu(id) && isCpu(other)
  const pre = ratings?.pre[id ?? ''] ?? (isCpu(id) ? ratingEnteringRound(ev.ratings, ev.entryRatings, id, round) : null)
  const post = id ? ratings?.post[id] : null

  let who: ReactNode
  if (round === 'quarterfinal' && editable) {
    const taken = new Set(draft.entrants.filter((e, i): e is string => e !== null && i !== seat))
    who = (
      <DuelistPicker
        label={`Seat ${seat + 1}`}
        value={draft.entrants[seat]}
        onChange={(v) => update?.((d) => void (d.entrants[seat] = v))}
        duelists={duelists}
        tournamentLevel={draft.tournamentLevel}
        taken={taken}
        navIndex={10 + seat}
      />
    )
  } else if (id === null) {
    who = <span className="text-ink-3">{round === 'quarterfinal' ? 'Unknown' : 'TBD'}</span>
  } else {
    who = (
      <span title={displayName(model, id)} className={`truncate ${isLoser ? 'text-ink-3 line-through decoration-ink-3/50' : ''} ${id === PLAYER_ID ? 'font-semibold text-accent' : ''}`}>
        {editable ? displayName(model, id) : <DuelistLink id={id} />}
      </span>
    )
  }

  const before: ReactNode = isCpu(id) ? <Rating value={pre} /> : null

  let after: ReactNode = null
  // The new-rating input is there as soon as both CPUs are known: typing it decides the winner.
  if (cpuMatch && id) {
    // The zero-sum fill for an empty side shows as the input's placeholder.
    const derived = post?.source === 'derived' ? post.rating : null
    const delta = post && pre !== null ? post.rating - pre : null
    after = (
      <span className="flex items-center justify-end gap-1.5">
        <span className="text-ink-3">→</span>
        {editable ? (
          <span className="flex items-center gap-1">
            <span aria-hidden className="text-xs text-gold">
              ▲
            </span>
            <input
              aria-label={`Rating of ${displayName(model, id)} after the duel`}
              className="field w-16 text-right placeholder:text-ink-2"
              inputMode="numeric"
              placeholder={derived?.toString() ?? ''}
              data-nav={navBase + 1 + side}
              value={postValue}
              onChange={(e) => setPost(id, e.target.value)}
            />
          </span>
        ) : (
          <Rating value={post?.rating ?? null} />
        )}
        <Delta value={delta} className="w-10 text-right text-sm" />
      </span>
    )
  }

  return (
    <div className={`grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-2 rounded-md px-1 ${isWinner ? 'bg-accent-soft' : ''}`}>
      <div className="flex min-w-0 items-center gap-2">
        <button
          type="button"
          aria-pressed={isWinner}
          aria-label={`${id ? displayName(model, id) : 'This side'} won`}
          tabIndex={-1}
          disabled={!editable || pairing.playerAId === null || pairing.playerBId === null || decidedByRatings}
          onClick={onWinner}
          className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs font-bold ${isWinner ? 'border-accent bg-accent text-white' : 'border-rule text-ink-3'} ${editable ? 'hover:border-accent' : ''}`}
          title={editable ? (decidedByRatings ? 'Decided by the ratings' : `Winner (key ${side + 1})`) : undefined}
        >
          {isWinner ? 'W' : side + 1}
        </button>
        {who}
      </div>
      <div className="justify-self-end">{before}</div>
      <div className="min-w-[7.5rem]">{after}</div>
    </div>
  )
}

function Transfers({ ev }: { ev: DraftEvaluation }) {
  const { model } = useApp()
  const rows = ev.ratings.matches.filter((r) => r.cpuMatch)
  if (rows.length === 0) return null
  return (
    <section className="mt-8">
      <h2 className="mb-2 text-xl font-semibold">Rating transfers</h2>
      <div className="panel overflow-x-auto">
        <table className="table">
          <thead>
            <tr>
              <th>Match</th>
              <th>Winner</th>
              <th className="num">Before</th>
              <th>Loser</th>
              <th className="num">Before</th>
              <th className="num">Gap</th>
              <th className="num">Points moved</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const w = r.match.winnerId
              const l = r.match.playerAId === w ? r.match.playerBId : r.match.playerAId
              const gap = r.pre[w] != null && r.pre[l] != null ? r.pre[w]! - r.pre[l]! : null
              return (
                <tr key={r.match.id}>
                  <td>{matchLabel(r.match.round, r.match.slot)}</td>
                  <td>{displayName(model, w)}</td>
                  <td className="num">
                    <Rating value={r.pre[w] ?? null} />
                  </td>
                  <td>{displayName(model, l)}</td>
                  <td className="num">
                    <Rating value={r.pre[l] ?? null} />
                  </td>
                  <td className="num">
                    <Delta value={gap} />
                  </td>
                  <td className="num font-semibold">{r.transfer ?? '—'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </section>
  )
}
