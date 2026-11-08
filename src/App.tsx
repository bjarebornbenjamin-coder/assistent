import { useEffect } from 'react'
import { BrowserRouter, Link, Route, Routes, useLocation } from 'react-router-dom'
import { useSettings } from './hooks'
import { useNotificationSync } from './push/useNotificationSync'
import { useSyncRunner } from './sync/useSyncRunner'
import { CalendarPage } from './pages/Calendar'
import { ChatPage } from './pages/Chat'
import { ImportSchedulePage } from './pages/ImportSchedule'
import { Home } from './pages/Home'
import { SchedulePage } from './pages/Schedule'
import { SettingsPage } from './pages/Settings'
import { SubjectsPage } from './pages/Subjects'
import { TasksPage } from './pages/Tasks'

/** Undersidor som hör till en flik markerar den fliken i menyn. */
const TABS = [
  { to: '/', label: 'Hem', also: ['/uppgifter'] as string[] },
  { to: '/schema', label: 'Schema', also: ['/amnen'] },
  { to: '/kalender', label: 'Kalender', also: [] },
  { to: '/chatt', label: 'Chatt', also: [] },
  { to: '/installningar', label: 'Inställningar', also: [] },
]

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
  useNotificationSync()
  const settings = useSettings()
  const theme = settings?.theme

  useEffect(() => {
    const root = document.documentElement
    if (!theme || theme === 'system') delete root.dataset.theme
    else root.dataset.theme = theme
  }, [theme])

  return (
    <BrowserRouter>
      <main className="shell">
        {!settings ? null : (
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/schema" element={<SchedulePage />} />
            <Route path="/schema/importera" element={<ImportSchedulePage />} />
            <Route path="/kalender" element={<CalendarPage />} />
            <Route path="/chatt" element={<ChatPage />} />
            <Route path="/amnen" element={<SubjectsPage />} />
            <Route path="/uppgifter" element={<TasksPage />} />
            <Route path="/installningar" element={<SettingsPage />} />
          </Routes>
        )}
      </main>
      <Nav />
    </BrowserRouter>
  )
}
