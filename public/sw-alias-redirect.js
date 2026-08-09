/* Runs inside the generated service worker (importScripts).
 * Alias hosts must leave for the canonical origin so localStorage/PWA stay shared.
 */
/* eslint-disable no-restricted-globals */
;(() => {
  const PRIMARY = 'https://vibe-flows.vercel.app'
  const ALIASES = {
    'vibeflowe.vercel.app': 1,
    'vibeflows-app.vercel.app': 1,
    'vibeflowapp.vercel.app': 1,
    'vibeflowsapp.vercel.app': 1,
    'vibeflowsweb.vercel.app': 1,
  }

  self.addEventListener('fetch', (event) => {
    try {
      const url = new URL(event.request.url)
      if (!ALIASES[url.hostname]) return
      // Navigations + HTML document requests
      const mode = event.request.mode
      const dest = event.request.destination
      if (mode !== 'navigate' && dest !== 'document') return
      const target = PRIMARY + url.pathname + url.search + url.hash
      event.respondWith(Response.redirect(target, 302))
    } catch {
      /* ignore — let Workbox handle */
    }
  })
})()
