import { useEffect } from 'react'
import { BrowserRouter, NavLink, Route, Routes } from 'react-router-dom'
import { useSettings } from './hooks'
import { ChatPage } from './pages/Chat'
import { CalendarPage } from './pages/Calendar'
import { Home } from './pages/Home'
import { SchedulePage } from './pages/Schedule'
import { SettingsPage } from './pages/Settings'
import { SubjectsPage } from './pages/Subjects'

export function App() {
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
            <Route path="/kalender" element={<CalendarPage />} />
            <Route path="/chatt" element={<ChatPage />} />
            <Route path="/amnen" element={<SubjectsPage />} />
            <Route path="/installningar" element={<SettingsPage />} />
          </Routes>
        )}
      </main>
      <nav className="nav" aria-label="Huvudmeny">
        <NavLink to="/" end>Hem</NavLink>
        <NavLink to="/schema">Schema</NavLink>
        <NavLink to="/kalender">Kalender</NavLink>
        <NavLink to="/chatt">Chatt</NavLink>
        <NavLink to="/installningar">Inställningar</NavLink>
      </nav>
    </BrowserRouter>
  )
}
