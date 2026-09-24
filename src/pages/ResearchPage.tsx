import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { useApp } from '../app/context'
import { Delta } from '../components/Delta'
import { DuelistLink } from '../components/DuelistLink'
import { Empty } from '../components/Empty'
import { PageTitle } from '../components/Layout'
import { Rating } from '../components/Rating'
import { Scatter } from '../components/Scatter'
import { continuity, entrantMix, headToHead, integrityIssues, summarizeTransfers, transferRows } from '../domain/research'
import { displayName, upsets } from '../domain/stats'

export function ResearchPage() {
  const { model, base } = useApp()
  const rows = transferRows(model)
  const summary = summarizeTransfers(rows)
  // Duels whose transfer is known but one pre-match rating isn't stay in the table, not the plot.
  const plotted = rows.filter((r): r is typeof r & { gap: number } => r.gap !== null)
  const issues = integrityIssues(model)
  const cont = continuity(model)
  const contChanged = cont.filter((c) => c.status === 'changed')
  const mix = entrantMix(model.data.tournaments, model.duelistById)
  const h2h = headToHead(model)
  const topUpsets = upsets(model.analyses, model.data.tournaments).slice(0, 10)
  const moved = model.rows.filter((r) => r.rating.deltaFromInitial !== null)
  const risers = [...moved].sort((a, b) => b.rating.deltaFromInitial! - a.rating.deltaFromInitial!).slice(0, 8)
  const fallers = [...moved].sort((a, b) => a.rating.deltaFromInitial! - b.rating.deltaFromInitial!).slice(0, 8)
  const finalists = model.rows.filter((r) => r.record.finals > 0).sort((a, b) => b.record.titles - a.record.titles || b.record.finals - a.record.finals)

  return (
    <>
      <PageTitle>Research</PageTitle>
      <p className="-mt-2 mb-6 max-w-prose text-sm text-ink-2">
        Everything here is computed from recorded ratings and nothing is predicted. CPU duels are treated as zero-sum; the open question is what decides how
        many points move.
      </p>

      <Section title="Points moved vs. rating gap" note="One dot per CPU duel with known before and after ratings. Left of the dashed line the underdog won.">
        {rows.length === 0 ? (
          <Empty>No CPU duels with known ratings yet.</Empty>
        ) : (
          <>
            <Scatter
              ariaLabel="Scatter of points moved against the winner-minus-loser rating gap; the table below lists every duel"
              xLabel="Rating gap (winner − loser, before the duel)"
              yLabel="Points moved"
              xRef={0}
              points={plotted.map((r) => ({
                x: r.gap,
                y: r.transfer,
                label: `${displayName(model, r.winnerId)} beat ${displayName(model, r.loserId)}`,
                details: [`${r.winnerPre} vs ${r.loserPre}, gap ${r.gap > 0 ? '+' : ''}${r.gap}`, `${r.transfer} points moved`, `Tournament #${r.tournament.number}, Level ${r.tournament.tournamentLevel}`],
              }))}
            />
            <dl className="mt-3 flex flex-wrap gap-x-8 gap-y-2 text-sm">
              <Fact label="Duels">{summary.count}</Fact>
              <Fact label="Fewest points">{summary.min}</Fact>
              <Fact label="Most points">{summary.max}</Fact>
              <Fact label="Most common">{summary.mode ?? 'no repeats yet'}</Fact>
              <Fact label="Mean when the underdog won">{summary.upsetMean?.toFixed(1) ?? '—'}</Fact>
              <Fact label="Mean when the favourite won">{summary.favouriteMean?.toFixed(1) ?? '—'}</Fact>
            </dl>
            {summary.repeatedGaps.length > 0 && (
              <p className="mt-2 text-sm text-ink-2">
                Gaps seen more than once:{' '}
                {summary.repeatedGaps.map((g) => `${g.gap > 0 ? '+' : ''}${g.gap} → ${g.transfers.join(', ')}`).join('; ')}. The same gap always moving the same points would
                point to a fixed formula.
              </p>
            )}
            <details className="mt-3">
              <summary className="cursor-pointer text-sm font-medium text-accent">Show all {rows.length} duels</summary>
              <div className="panel mt-2 overflow-x-auto">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Tournament</th>
                      <th>Winner</th>
                      <th className="num">Before</th>
                      <th>Loser</th>
                      <th className="num">Before</th>
                      <th className="num">Gap</th>
                      <th className="num">Points</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.ratings.match.id}>
                        <td>
                          <Link className="text-accent hover:underline" to={`${base}/tournaments/${r.tournament.id}`}>
                            #{r.tournament.number}
                          </Link>{' '}
                          <span className="text-ink-3">LV{r.tournament.tournamentLevel}</span>
                        </td>
                        <td>
                          <DuelistLink id={r.winnerId} />
                        </td>
                        <td className="num">{r.winnerPre ?? '—'}</td>
                        <td>
                          <DuelistLink id={r.loserId} />
                        </td>
                        <td className="num">{r.loserPre ?? '—'}</td>
                        <td className="num">
                          <Delta value={r.gap} />
                        </td>
                        <td className="num font-semibold">{r.transfer}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          </>
        )}
      </Section>

      <div className="grid gap-x-8 lg:grid-cols-2">
        <Section title="Typos to check" note="Duels where both new ratings were typed in but their changes don't cancel out.">
          {issues.length === 0 ? (
            <Empty>None.</Empty>
          ) : (
            <ul className="panel divide-y divide-rule text-sm">
              {issues.map(({ ratings: r, tournament: t }) => (
                <li key={r.match.id} className="px-4 py-2">
                  <Link className="text-accent hover:underline" to={`${base}/tournaments/${t.id}`}>
                    #{t.number}
                  </Link>{' '}
                  {displayName(model, r.match.playerAId)} vs {displayName(model, r.match.playerBId)}
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section
          title="Tournaments to save again"
          note="A tournament stores each CPU's rating going in when it's saved. If a reading or an earlier tournament is corrected afterwards, the two no longer match; open the tournament and save it again."
        >
          {contChanged.length === 0 ? (
            <Empty>{cont.length === 0 ? 'No tournaments yet.' : 'All tournaments are up to date.'}</Empty>
          ) : (
            <div className="panel max-h-80 overflow-auto">
              <table className="table">
                <tbody>
                  {contChanged.map((c) => (
                    <tr key={`${c.tournament.id}-${c.duelistId}`}>
                      <td>
                        <Link className="text-accent hover:underline" to={`${base}/tournaments/${c.tournament.id}`}>
                          #{c.tournament.number}
                        </Link>
                      </td>
                      <td>
                        <DuelistLink id={c.duelistId} />
                      </td>
                      <td className="num">
                        {c.entry} → {c.now}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Section>
      </div>

      <Section title="Who enters each level" note="Entrants by their documented tournament level. Higher levels mixing in lower-level duelists shows up off the diagonal.">
        {model.data.tournaments.length === 0 ? (
          <Empty>No tournaments yet.</Empty>
        ) : (
          <div className="panel overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Tournament</th>
                  <th className="num">Recorded</th>
                  <th className="num">LV1 entrants</th>
                  <th className="num">LV2 entrants</th>
                  <th className="num">LV3 entrants</th>
                </tr>
              </thead>
              <tbody>
                {([1, 2, 3] as const).map((l) => (
                  <tr key={l}>
                    <td>Level {l}</td>
                    <td className="num">{mix[l].tournaments}</td>
                    {([1, 2, 3] as const).map((c) => (
                      <td key={c} className={`num ${c === l ? 'font-semibold' : ''}`}>
                        {mix[l].byClass[c] || '—'}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <Section title="Initial rating vs. now" note="Above the dashed line a CPU has gained since a fresh save; below it, lost. Does the initial rating predict long-run strength?">
        {moved.length === 0 ? (
          <Empty>No recorded ratings yet.</Empty>
        ) : (
          <Scatter
            ariaLabel="Scatter of each CPU's initial rating against its current rating; the lists below name the biggest movers"
            xLabel="Initial rating"
            yLabel="Current rating"
            diagonal
            points={moved.map((r) => ({
              x: r.duelist.initialRating!,
              y: r.rating.current.value!,
              label: r.duelist.name,
              details: [`${r.duelist.initialRating} → ${r.rating.current.value}`, `${r.record.wins}–${r.record.losses} recorded`],
            }))}
          />
        )}
      </Section>

      <div className="grid gap-x-8 lg:grid-cols-3">
        <Section title="Biggest risers">
          <MoverList rows={risers.filter((r) => r.rating.deltaFromInitial! > 0)} />
        </Section>
        <Section title="Biggest fallers">
          <MoverList rows={fallers.filter((r) => r.rating.deltaFromInitial! < 0)} />
        </Section>
        <Section title="Finals and titles">
          {finalists.length === 0 ? (
            <Empty>No finals recorded.</Empty>
          ) : (
            <table className="table panel">
              <thead>
                <tr>
                  <th>Duelist</th>
                  <th className="num">Titles</th>
                  <th className="num">Finals</th>
                </tr>
              </thead>
              <tbody>
                {finalists.slice(0, 10).map((r) => (
                  <tr key={r.duelist.id}>
                    <td>
                      <DuelistLink id={r.duelist.id} />
                    </td>
                    <td className="num font-semibold">{r.record.titles}</td>
                    <td className="num">{r.record.finals}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Section>
      </div>

      <div className="grid gap-x-8 lg:grid-cols-2">
        <Section title="Biggest upsets">
          {topUpsets.length === 0 ? (
            <Empty>None recorded.</Empty>
          ) : (
            <ul className="panel divide-y divide-rule text-sm">
              {topUpsets.map((u) => (
                <li key={u.ratings.match.id} className="flex justify-between gap-3 px-4 py-2">
                  <span>
                    <DuelistLink id={u.winnerId} /> <Rating value={u.winnerBefore} /> beat <DuelistLink id={u.loserId} /> <Rating value={u.loserBefore} />
                  </span>
                  <span className="whitespace-nowrap font-semibold">{u.magnitude} gap</span>
                </li>
              ))}
            </ul>
          )}
        </Section>
        <Section title="Rivalries" note="CPU pairs that met at least twice.">
          {h2h.length === 0 ? (
            <Empty>No pair has met twice yet.</Empty>
          ) : (
            <ul className="panel divide-y divide-rule text-sm">
              {h2h.slice(0, 12).map((h) => (
                <li key={`${h.a}|${h.b}`} className="flex justify-between gap-3 px-4 py-2">
                  <span>
                    <DuelistLink id={h.a} /> vs <DuelistLink id={h.b} />
                  </span>
                  <span className="font-semibold">
                    {h.aWins}–{h.bWins}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>
    </>
  )
}

function Section({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className="text-xl font-semibold">{title}</h2>
      {note && <p className="mb-2 max-w-prose text-sm text-ink-2">{note}</p>}
      <div className={note ? '' : 'mt-2'}>{children}</div>
    </section>
  )
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-ink-3">{label}</dt>
      <dd className="font-display text-lg font-semibold">{children ?? '—'}</dd>
    </div>
  )
}

function MoverList({ rows }: { rows: { duelist: { id: string; initialRating: number | null }; rating: { deltaFromInitial: number | null; current: { value: number | null } } }[] }) {
  if (rows.length === 0) return <Empty>None yet.</Empty>
  return (
    <ul className="panel divide-y divide-rule text-sm">
      {rows.map((r) => (
        <li key={r.duelist.id} className="flex justify-between gap-3 px-4 py-2">
          <DuelistLink id={r.duelist.id} />
          <span className="whitespace-nowrap">
            <span className="text-ink-3">
              {r.duelist.initialRating} → {r.rating.current.value}
            </span>{' '}
            <Delta value={r.rating.deltaFromInitial} />
          </span>
        </li>
      ))}
    </ul>
  )
}
