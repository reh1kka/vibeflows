import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Analytics } from '@vercel/analytics/react'
import { registerSW } from 'virtual:pwa-register'
import { forceCacheBustOnce, stripCacheBustQuery } from './lib/cacheBust'
import { redirectAliasHostToPrimary } from './lib/canonicalHost'
import { initSentry, triggerSentryTestError } from './lib/sentry'
import App from './App'
import './styles/index.css'

async function boot() {
  initSentry()

  // Neon Play-style theme (shipped to prod)
  const host = location.hostname
  document.documentElement.setAttribute('data-theme', 'neon')

  // Keep one origin so onboarding / prefs / Spotify session stay shared
  if (redirectAliasHostToPrimary()) return

  // One-time: drop old SW/caches so everyone gets the latest UI/assets
  if (await forceCacheBustOnce()) return
  stripCacheBustQuery()

  // Localhost-only: ?sentry_test=1 captures a test exception (needs DSN)
  if (
    (host === 'localhost' || host === '127.0.0.1') &&
    new URLSearchParams(location.search).get('sentry_test') === '1'
  ) {
    triggerSentryTestError()
  }

  const updateSW = registerSW({
    immediate: true,
    onRegisteredSW(_url, registration) {
      if (!registration) return
      const ping = () => {
        void registration.update()
      }
      // Push updates without asking the user to refresh manually
      window.setInterval(ping, 30_000)
      window.addEventListener('focus', ping)
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') ping()
      })
      window.addEventListener('online', ping)
      ping()
    },
    onNeedRefresh() {
      void updateSW(true)
    },
  })

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
      <Analytics />
    </StrictMode>,
  )
}

void boot()
