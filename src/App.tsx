import { useEffect } from 'react'
import { BrowserRouter, Link, Route, Routes, useLocation } from 'react-router-dom'
import { ToastBar } from './components/ToastBar'
import { useSettings } from './hooks'
import { useApplyBackground } from './lib/background'
import { useNotificationSync } from './push/useNotificationSync'
import { useSyncRunner } from './sync/useSyncRunner'
import { syncConfigured, useSession } from './sync/supabase'
import { LoginScreen } from './sync/LoginForm'
import { useGoogleAutoSync } from './google/google'
import { CalendarPage } from './pages/Calendar'
import { ChatPage } from './pages/Chat'
import { ImportSchedulePage } from './pages/ImportSchedule'
import { FoodPage } from './pages/Food'
import { Home } from './pages/Home'
import { RemindersPage } from './pages/Reminders'
import { ScanFoodPage } from './pages/ScanFood'
import { SchedulePage } from './pages/Schedule'
import { SettingsPage } from './pages/Settings'
import { StudyPlanPage } from './pages/StudyPlan'
import { SubjectsPage } from './pages/Subjects'
import { TasksPage } from './pages/Tasks'
import { TrainingPage } from './pages/Training'

/** Undersidor som hör till en flik markerar den fliken i menyn. */
const TABS = [
  { to: '/', label: 'Hem', also: ['/uppgifter', '/paminnelser', '/installningar', '/traning'] as string[] },
  { to: '/schema', label: 'Schema', also: ['/amnen'] },
  { to: '/kalender', label: 'Kalender', also: ['/plugg'] },
  { to: '/mat', label: 'Mat', also: [] },
  { to: '/chatt', label: 'Chatt', also: [] },
]

/** Varje ny sida börjar högst upp (annars följer scrollpositionen med mellan flikar). */
function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])
  return null
}

function Nav() {
  const { pathname } = useLocation()
  return (
    <nav className="nav" aria-label="Huvudmeny">
      {TABS.map((t) => {
        const active = [t.to, ...t.also].some((p) => pathname === p || (p !== '/' && pathname.startsWith(p + '/')))
        return (
          <Link key={t.to} to={t.to} aria-current={active ? 'page' : undefined}>
            {t.label}
          </Link>
        )
      })}
    </nav>
  )
}

export function App() {
  useSyncRunner()
  useApplyBackground()
  useNotificationSync()
  useGoogleAutoSync()
  const settings = useSettings()
  const session = useSession()
  const theme = settings?.theme

  useEffect(() => {
    const root = document.documentElement
    if (!theme || theme === 'system') delete root.dataset.theme
    else root.dataset.theme = theme
  }, [theme])

  return (
    <BrowserRouter>
      <ScrollToTop />
      <main className="shell">
        {!settings || session === undefined ? (
          <p className="loading" role="status" aria-busy="true">Laddar…</p>
        ) : syncConfigured && !session ? (
          <LoginScreen />
        ) : (
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/schema" element={<SchedulePage />} />
            <Route path="/schema/importera" element={<ImportSchedulePage />} />
            <Route path="/kalender" element={<CalendarPage />} />
            <Route path="/plugg" element={<StudyPlanPage />} />
            <Route path="/chatt" element={<ChatPage />} />
            <Route path="/amnen" element={<SubjectsPage />} />
            <Route path="/uppgifter" element={<TasksPage />} />
            <Route path="/traning" element={<TrainingPage />} />
            <Route path="/mat" element={<FoodPage />} />
            <Route path="/mat/skanna" element={<ScanFoodPage />} />
            <Route path="/paminnelser" element={<RemindersPage />} />
            <Route path="/installningar" element={<SettingsPage />} />
            <Route path="/installningar/:del" element={<SettingsPage />} />
          </Routes>
        )}
      </main>
      <ToastBar />
      {(!syncConfigured || session) && <Nav />}
    </BrowserRouter>
  )
}
