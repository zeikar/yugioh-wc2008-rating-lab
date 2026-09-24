import { Component, type ReactNode } from 'react'
import { Link, NavLink, useLocation } from 'react-router'
import { useApp } from '../app/context'
import { RESEARCH, RESEARCH_NAME, saveRef, switchPath } from '../app/datasets'
import { useStartTournament } from '../app/useStartTournament'
import { USE_EMULATORS } from '../firebase'
import { Empty } from './Empty'
import { RatingMark } from './Rating'

/** Page paths inside a dataset, after its base. */
const NAV = [
  { to: '', label: 'Dashboard', end: true },
  { to: '/duelists', label: 'Duelists' },
  { to: '/tournaments', label: 'Tournaments' },
  { to: '/research', label: 'Research' },
  { to: '/data', label: 'Data' },
]

export function Layout({ children }: { children: ReactNode }) {
  const { model, user, authReady, dataset, base, profile, canEdit, signIn, signOut, pendingWrites, synced, error, dismissError, loading, loadFailed } = useApp()
  const { pathname, key: locationKey } = useLocation()
  const start = useStartTournament()
  // A save shows its own name, never the account's (MVP §3); none until it has loaded.
  const name = dataset?.kind === 'research' ? RESEARCH_NAME : dataset && !loading && !loadFailed ? (profile?.name ?? 'Unnamed save') : null
  // Signed out there is no save of yours to offer: just the way to the research dataset, unless you're on it.
  const switches = user
    ? [{ label: 'Emulator', to: RESEARCH }, { label: 'My save', to: saveRef(user.uid) }]
    : dataset?.kind === 'research'
      ? []
      : [{ label: 'Emulator', to: RESEARCH }]
  return (
    <div className="min-h-screen">
      <header className="border-b border-rule bg-card">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-2.5">
          <NavLink to="/" className="flex items-center gap-2 font-display text-lg font-bold">
            <RatingMark className="size-5.5" />
            WC2008 Rating Lab
          </NavLink>
          {name && <span className="text-sm font-medium text-ink-2">{name}</span>}
          <nav className="flex flex-wrap gap-1">
            {NAV.map((n) => (
              <NavLink
                key={n.label}
                to={base + n.to}
                end={n.end}
                className={({ isActive }) => `rounded-md px-2.5 py-1 text-sm font-medium ${isActive ? 'bg-accent-soft text-accent' : 'text-ink-2 hover:text-ink'}`}
              >
                {n.label}
              </NavLink>
            ))}
          </nav>
          <div className="ml-auto flex flex-wrap items-center gap-x-3 gap-y-2 text-sm">
            {USE_EMULATORS && <span className="rounded bg-warn-soft px-1.5 py-0.5 text-xs font-medium text-warn">emulator</span>}
            {/* Only your own writes sync. After a failed load the error banner says what to do; a sync state would mislead. */}
            {canEdit && !loading && !loadFailed && (
              <span className="text-ink-3" title={!pendingWrites && !synced ? 'Showing the copy saved on this device until the server answers' : undefined}>
                {pendingWrites ? 'Syncing…' : synced ? 'Synced' : 'Connecting…'}
              </span>
            )}
            {/* Moves between datasets and keeps the page (MVP §3). */}
            {switches.length > 0 && (
              <span role="group" aria-label="Dataset" className="flex overflow-hidden rounded-md border border-rule">
                {switches.map((s) => {
                  const active = dataset?.base === s.to.base
                  return (
                    <Link
                      key={s.label}
                      to={switchPath(pathname, dataset, s.to)}
                      aria-current={active || undefined}
                      className={`px-2.5 py-1 font-medium ${active ? 'bg-accent-soft text-accent' : 'text-ink-2 hover:text-ink'}`}
                    >
                      {s.label}
                    </Link>
                  )
                })}
              </span>
            )}
            {/* Numbered from the loaded tournaments, so not before they are there. */}
            {canEdit && !loading && !loadFailed && (
              <button className="btn btn-primary" onClick={start}>
                + New tournament
              </button>
            )}
            {user ? (
              <button className="text-ink-2 hover:text-ink" onClick={signOut}>
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
      {/* Keyed on the dataset, so no page carries its state (typed edits, filters) into another one. */}
      <main key={base} className="mx-auto max-w-7xl px-4 py-6">
        {/* Pages wait for their data here, so none shows an empty state that isn't true, and on a
            save for the sign-in state too, so your own doesn't pass for read-only meanwhile. */}
        {loading || (dataset?.kind === 'save' && !authReady) ? (
          <p className="text-ink-2">Loading…</p>
        ) : (
          <PageBoundary
            resetKeys={[locationKey, model]}
            fallback={(message) => (
              <Empty>
                This page couldn't be shown.{' '}
                <Link to={base} className="text-accent underline">
                  Back to the dashboard
                </Link>
                <br />
                <span className="text-ink-3">{message}</span>
              </Empty>
            )}
          >
            {children}
          </PageBoundary>
        )}
      </main>
    </div>
  )
}

interface PageBoundaryProps {
  /**
   * A change in any of them retries the children: the location's key (any
   * navigation, even to the same page) and the model (new data, such as a fix).
   */
  resetKeys: readonly unknown[]
  fallback: (message: string) => ReactNode
  children: ReactNode
}

interface PageBoundaryState {
  /** The thrown error's message; null while the page renders. */
  message: string | null
  resetKeys: readonly unknown[]
}

/**
 * With open sign-up, anyone's save can hold data the rules don't check in
 * depth (MVP §3), and a page that throws on it, or on an app bug, would blank
 * the whole app. This keeps the header usable instead. Inside `main`, which
 * is keyed on the dataset, so a switch starts it over too. React still logs
 * the error.
 */
class PageBoundary extends Component<PageBoundaryProps, PageBoundaryState> {
  state: PageBoundaryState = { message: null, resetKeys: this.props.resetKeys }

  static getDerivedStateFromError(error: unknown) {
    return { message: error instanceof Error ? error.message : String(error) }
  }

  static getDerivedStateFromProps(props: PageBoundaryProps, state: PageBoundaryState) {
    return props.resetKeys.every((k, i) => Object.is(k, state.resetKeys[i])) ? null : { message: null, resetKeys: props.resetKeys }
  }

  render() {
    return this.state.message === null ? this.props.children : this.props.fallback(this.state.message)
  }
}

export function PageTitle({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <h1 className="text-3xl font-bold">{children}</h1>
      {aside}
    </div>
  )
}
