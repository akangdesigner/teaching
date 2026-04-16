import { BrowserRouter, Routes, Route } from 'react-router-dom'
import AuthGuard from './components/AuthGuard'
import LoginPage from './pages/LoginPage'
import Dashboard from './pages/Dashboard'
import ClientDetail from './pages/ClientDetail'
import ClientForm from './pages/ClientForm'
import CalendarPage from './pages/CalendarPage'
import AIAssistant from './pages/AIAssistant'
import SettingsPage from './pages/SettingsPage'
import MigrationPage from './pages/MigrationPage'
import GoogleCallback from './pages/GoogleCallback'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/auth/google/callback" element={<GoogleCallback />} />
        <Route path="/*" element={
          <AuthGuard>
            <div className="dark min-h-screen bg-background text-foreground">
              <Routes>
                <Route path="/"                   element={<Dashboard />} />
                <Route path="/calendar"           element={<CalendarPage />} />
                <Route path="/ai"                 element={<AIAssistant />} />
                <Route path="/settings"           element={<SettingsPage />} />
                <Route path="/migrate"            element={<MigrationPage />} />
                <Route path="/clients/new"        element={<ClientForm />} />
                <Route path="/clients/:id"        element={<ClientDetail />} />
                <Route path="/clients/:id/edit"   element={<ClientForm />} />
              </Routes>
            </div>
          </AuthGuard>
        } />
      </Routes>
    </BrowserRouter>
  )
}
