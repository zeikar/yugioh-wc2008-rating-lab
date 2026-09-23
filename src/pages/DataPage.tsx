import { useState, type ReactNode } from 'react'
import { useApp } from '../app/context'
import { PageTitle } from '../components/Layout'
import { Link } from 'react-router'
import { ROSTER } from '../data/duelists'
import { grantAdminInEmulator, replaceAll } from '../db/repository'
import { parseBackup, toBackup } from '../domain/backup'
import { USE_EMULATORS } from '../firebase'
import type { Dataset } from '../types'

export function DataPage() {
  const { model, user, isAdmin, signIn, reportError, synced, loadFailed } = useApp()

  const exportJson = () => {
    const blob = new Blob([toBackup(model.data, new Date())], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `wcs2008-rating-lab-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <>
      <PageTitle>Data</PageTitle>

      <Block title="Account">
        {user ? (
          <p className="text-sm">
            Signed in as {user.email ?? user.uid}. {isAdmin ? 'You can edit.' : 'This account can only view.'}
          </p>
        ) : (
          <p className="text-sm">
            Anyone can view. Only the owner can edit.{' '}
            <button className="text-accent underline" onClick={signIn}>
              Sign in with Google
            </button>
          </p>
        )}
        {user && !isAdmin && (
          <div className="mt-2 text-sm text-ink-2">
            <p>
              To make this account the owner, create a document <code className="rounded bg-paper px-1">admins/{user.uid}</code> in the Firebase console.
            </p>
            {USE_EMULATORS && (
              <button className="btn mt-2" onClick={() => grantAdminInEmulator(user.uid).catch(reportError)}>
                Make me the owner (emulator only)
              </button>
            )}
          </div>
        )}
      </Block>

      {isAdmin && (
        <Block title="Roster">
          <p className="max-w-prose text-sm text-ink-2">
            {model.data.duelists.length === 0
              ? `The roster isn't set up yet. Add the ${ROSTER.length} tournament CPUs, mark which are unlocked in your save and record their current ratings.`
              : 'Mark which CPUs are unlocked in your save and record their current ratings, all in one list in the game\'s order.'}
          </p>
          <Link to="/roster" className="btn btn-primary mt-3 inline-block">
            Open roster setup
          </Link>
        </Block>
      )}

      <Block title="Back up">
        <p className="max-w-prose text-sm text-ink-2">
          Downloads every duelist, tournament, match and rating as one JSON file ({model.data.observations.length} ratings right now).
        </p>
        {loadFailed && <p className="mt-2 text-sm text-down">Loading failed, so an export now would be incomplete. Reload the page first.</p>}
        <button className="btn mt-3" disabled={loadFailed} onClick={exportJson}>
          Export JSON
        </button>
      </Block>

      {isAdmin && <ImportBlock current={model.data} exportFirst={exportJson} synced={synced} />}
    </>
  )
}

function ImportBlock({ current, exportFirst, synced }: { current: Dataset; exportFirst: () => void; synced: boolean }) {
  const [parsed, setParsed] = useState<{ ok: true; data: Dataset } | { ok: false; errors: string[] } | null>(null)
  const [confirm, setConfirm] = useState('')
  const [progress, setProgress] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  return (
    <Block title="Restore from a backup">
      <p className="max-w-prose text-sm text-ink-2">
        Importing <strong>replaces all current data</strong> with the file's contents. The file is checked first and nothing is written until you confirm. The
        file's data is written first and leftovers are removed last, so an interrupted import leaves extra data rather than missing data. Export a backup first
        anyway.
      </p>
      <input
        type="file"
        accept="application/json,.json"
        className="mt-3 block text-sm"
        onChange={async (e) => {
          const file = e.target.files?.[0]
          setConfirm('')
          setProgress(null)
          setParsed(file ? parseBackup(await file.text()) : null)
        }}
      />
      {parsed && !parsed.ok && (
        <div className="mt-3 text-sm text-down">
          <p className="font-medium">This file can't be imported:</p>
          <ul className="mt-1 list-disc pl-5">
            {parsed.errors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </div>
      )}
      {parsed?.ok && (
        <div className="mt-3 space-y-3 text-sm">
          <p>
            The file is valid: {parsed.data.duelists.length} duelists, {parsed.data.tournaments.length} tournaments, {parsed.data.matches.length} matches,{' '}
            {parsed.data.observations.length} ratings. It will replace the current data ({current.tournaments.length} tournaments, {current.observations.length} ratings).
          </p>
          <button className="btn" onClick={exportFirst}>
            Export current data first
          </button>
          <label className="flex flex-wrap items-center gap-2">
            Type <code className="rounded bg-paper px-1">replace</code> to confirm
            <input className="field w-32" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          </label>
          <NeedsServer synced={synced} />
          <button
            className="btn btn-danger"
            disabled={confirm !== 'replace' || busy || !synced}
            onClick={async () => {
              setBusy(true)
              try {
                await replaceAll(current, parsed.data, (done, total) => setProgress(`Writing… ${done} / ${total}`))
                setProgress('Import finished.')
                setParsed(null)
              } catch (e) {
                setProgress(`Import stopped partway: ${(e as Error).message}. Re-import the same file to finish; nothing from it is lost.`)
              } finally {
                setBusy(false)
              }
            }}
          >
            Replace all data
          </button>
        </div>
      )}
      {progress && <p className="mt-2 text-sm">{progress}</p>}
    </Block>
  )
}

/** Bulk writes decide what to change from what the app can see; a cache-only view may be incomplete. */
function NeedsServer({ synced }: { synced: boolean }) {
  if (synced) return null
  return <p className="mt-2 text-sm text-warn">Waiting for a connection to the server. This works only on fully loaded data.</p>
}

function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="panel mb-5 p-4">
      <h2 className="mb-2 text-xl font-semibold">{title}</h2>
      {children}
    </section>
  )
}
