import { Link } from 'react-router'
import { useApp } from '../app/context'
import { listDrafts } from '../app/drafts'
import { DuelistLink } from '../components/DuelistLink'
import { Empty } from '../components/Empty'
import { useStartTournament } from '../app/useStartTournament'
import { PageTitle } from '../components/Layout'
import { championOf, groupBy } from '../domain/stats'
import { PLAYER_ID } from '../types'

export function TournamentsPage() {
  const { model, base, dataset, canEdit } = useApp()
  const start = useStartTournament()
  const tournaments = [...model.index.tournaments].reverse()
  const matchesBy = groupBy(model.data.matches, (m) => m.tournamentId)
  const drafts = canEdit ? listDrafts(dataset.uid).sort((a, b) => b.number - a.number) : []

  return (
    <>
      <PageTitle aside={canEdit && <button className="btn btn-primary" onClick={start}>+ New tournament</button>}>Tournaments</PageTitle>

      {drafts.length > 0 && (
        <section className="mb-6">
          <h2 className="mb-2 text-lg font-semibold">Unsaved on this device</h2>
          <ul className="panel divide-y divide-rule">
            {drafts.map((d) => (
              <li key={d.id} className="flex items-center justify-between px-4 py-2 text-sm">
                <span>
                  Tournament #{d.number}, Level {d.tournamentLevel}
                  {model.tournamentById.has(d.id) ? ' (edits to a saved tournament)' : ' (new)'}
                </span>
                <Link to={`${base}/tournaments/${d.id}`} className="font-medium text-accent hover:underline">
                  Continue
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="panel overflow-x-auto">
        {tournaments.length === 0 ? (
          <Empty>No tournaments recorded yet.{canEdit ? ' Start one with “New tournament” while the game is running.' : ''}</Empty>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>#</th>
                <th>Played</th>
                <th>Level</th>
                <th className="num">Matches</th>
                <th>Champion</th>
                <th>Title</th>
              </tr>
            </thead>
            <tbody>
              {tournaments.map((t) => {
                const champion = championOf(model.data.matches, t.id)
                return (
                  <tr key={t.id}>
                    <td>
                      <Link to={`${base}/tournaments/${t.id}`} className="font-semibold text-accent hover:underline">
                        #{t.number}
                      </Link>
                    </td>
                    <td className="whitespace-nowrap">{t.playedAt.toLocaleString()}</td>
                    <td>Level {t.tournamentLevel}</td>
                    <td className="num">{(matchesBy.get(t.id) ?? []).length} / 7</td>
                    <td>{champion ? champion === PLAYER_ID ? <span className="font-semibold text-accent">You</span> : <DuelistLink id={champion} /> : <span className="text-ink-3">—</span>}</td>
                    <td className="text-ink-2">{t.title}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </>
  )
}
