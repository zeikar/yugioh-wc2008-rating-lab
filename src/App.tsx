import { Link, Navigate, Outlet, Route, Routes, useLocation } from 'react-router'
import { useApp } from './app/context'
import { RESEARCH, saveRef } from './app/datasets'
import { Layout } from './components/Layout'
import { DashboardPage } from './pages/DashboardPage'
import { DataPage } from './pages/DataPage'
import { DuelistPage } from './pages/DuelistPage'
import { DuelistsPage } from './pages/DuelistsPage'
import { ResearchPage } from './pages/ResearchPage'
import { RosterSetupPage } from './pages/RosterSetupPage'
import { TournamentPage } from './pages/TournamentPage'
import { TournamentsPage } from './pages/TournamentsPage'

// Every dataset has the same pages (MVP §6), under its own prefix.
const PAGES = (
  <>
    <Route index element={<DashboardPage />} />
    <Route path="duelists" element={<DuelistsPage />} />
    <Route path="duelists/:id" element={<DuelistPage />} />
    <Route path="tournaments" element={<TournamentsPage />} />
    <Route path="tournaments/:id" element={<TournamentPage />} />
    <Route path="research" element={<ResearchPage />} />
    <Route path="data" element={<DataPage />} />
    <Route path="roster" element={<RosterSetupPage />} />
  </>
)

export function App() {
  const { pathname, search, hash } = useLocation()
  // GitHub Pages answers /research with a redirect to /research/, since public/research/ is a
  // real folder. The app's paths have no trailing slash, and NavLink matches only those.
  if (pathname !== '/' && pathname.endsWith('/')) return <Navigate replace to={{ pathname: pathname.replace(/\/+$/, '') || '/', search, hash }} />
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/research">{PAGES}</Route>
        <Route path="/u/:uid" element={<SaveOutlet />}>
          {PAGES}
        </Route>
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Layout>
  )
}

/** `/` opens your own save when you're signed in, the research dataset otherwise (MVP §3). */
function Home() {
  const { user, authReady } = useApp()
  if (!authReady) return <p className="text-ink-2">Loading…</p>
  return <Navigate replace to={user ? saveRef(user.uid).base : RESEARCH.base} />
}

/** A save's pages, when the URL's uid could be one (datasetFromPath). */
function SaveOutlet() {
  const { dataset } = useApp()
  return dataset ? <Outlet /> : <NotFound />
}

function NotFound() {
  return (
    <p className="text-ink-2">
      No page here. <Link to="/" className="text-accent underline">Back to the dashboard</Link>
    </p>
  )
}
