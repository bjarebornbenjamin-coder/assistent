import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import { App } from './App'
import { purgeLegacyApiKey } from './db/repo'
import './styles.css'

registerSW({ immediate: true })
void purgeLegacyApiKey()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
