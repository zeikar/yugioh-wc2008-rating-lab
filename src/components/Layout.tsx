import type { ReactNode } from 'react'
import { NavLink } from 'react-router'
import { useApp } from '../app/context'
import { useStartTournament } from '../app/useStartTournament'
import { USE_EMULATORS } from '../firebase'
import { RatingMark } from './Rating'

const NAV = [
  { to: '/', label: 'Dashboard', end: true },
  { to: '/duelists', label: 'Duelists' },
  { to: '/tournaments', label: 'Tournaments' },
  { to: '/research', label: 'Research' },
  { to: '/data', label: 'Data' },
]

export function Layout({ children }: { children: ReactNode }) {
  const { user, isAdmin, signIn, signOut, pendingWrites, synced, error, dismissError, loading, loadFailed } = useApp()
  const start = useStartTournament()
  return (
    <div className="min-h-screen">
      <header className="border-b border-rule bg-card">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-2.5">
          <NavLink to="/" className="flex items-center gap-2 font-display text-lg font-bold">
            <RatingMark className="size-5.5" />
            WC2008 Rating Lab
          </NavLink>
          <nav className="flex flex-wrap gap-1">
            {NAV.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                end={n.end}
                className={({ isActive }) => `rounded-md px-2.5 py-1 text-sm font-medium ${isActive ? 'bg-accent-soft text-accent' : 'text-ink-2 hover:text-ink'}`}
              >
                {n.label}
              </NavLink>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-3 text-sm">
            {USE_EMULATORS && <span className="rounded bg-warn-soft px-1.5 py-0.5 text-xs font-medium text-warn">emulator</span>}
            {/* After a failed load the error banner says what to do; a sync state would mislead. */}
            {!loading && !loadFailed && (
              <span className="text-ink-3" title={!pendingWrites && !synced ? 'Showing the copy saved on this device until the server answers' : undefined}>
                {pendingWrites ? 'Syncing…' : synced ? 'Synced' : 'Connecting…'}
              </span>
            )}
            {isAdmin && (
              <button className="btn btn-primary" onClick={start}>
                + New tournament
              </button>
            )}
            {user ? (
              <button className="text-ink-2 hover:text-ink" onClick={signOut} title={user.email ?? user.uid}>
                Sign out
              </button>
            ) : (
              <button className="btn" onClick={signIn}>
                Sign in with Google
              </button>
            )}
          </div>
        </div>
      </header>
      {error && (
        <div role="alert" className="border-b border-[#f0c4bd] bg-[#fdecea] text-down">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-2 text-sm">
            <span>{error}</span>
            <button className="font-medium underline" onClick={dismissError}>
              Dismiss
            </button>
          </div>
        </div>
      )}
      <main className="mx-auto max-w-7xl px-4 py-6">{children}</main>
    </div>
  )
}

export function PageTitle({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <h1 className="text-3xl font-bold">{children}</h1>
      {aside}
    </div>
  )
}
