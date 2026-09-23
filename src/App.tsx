import { Route, Routes } from 'react-router'
import { Layout } from './components/Layout'
import { DashboardPage } from './pages/DashboardPage'
import { DataPage } from './pages/DataPage'
import { DuelistPage } from './pages/DuelistPage'
import { DuelistsPage } from './pages/DuelistsPage'
import { ResearchPage } from './pages/ResearchPage'
import { TournamentPage } from './pages/TournamentPage'
import { TournamentsPage } from './pages/TournamentsPage'

export function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/duelists" element={<DuelistsPage />} />
        <Route path="/duelists/:id" element={<DuelistPage />} />
        <Route path="/tournaments" element={<TournamentsPage />} />
        <Route path="/tournaments/:id" element={<TournamentPage />} />
        <Route path="/research" element={<ResearchPage />} />
        <Route path="/data" element={<DataPage />} />
        <Route path="*" element={<p className="text-ink-2">No page here. Use the navigation above.</p>} />
      </Routes>
    </Layout>
  )
}
