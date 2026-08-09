/**
 * One-time hard reset of SW + Cache Storage so clients pick up a new deploy.
 * Does NOT touch localStorage prefs (liked/disliked genres, onboarding artists,
 * settings, Spotify session) — only asset caches and service workers.
 */

export const APP_CACHE_BUST = 'vf-2026-08-09-ui-deploy'

const STORAGE_KEY = 'vf-cache-bust'

/**
 * Clears service workers and caches once per bust token, then reloads.
 * Returns true if a reload was triggered (caller should stop bootstrapping).
 */
export async function forceCacheBustOnce(): Promise<boolean> {
  try {
    if (typeof window === 'undefined') return false
    if (localStorage.getItem(STORAGE_KEY) === APP_CACHE_BUST) return false

    // Mark first so a failed clear still won't loop forever
    localStorage.setItem(STORAGE_KEY, APP_CACHE_BUST)

    if ('caches' in window) {
      const keys = await caches.keys()
      await Promise.all(keys.map((key) => caches.delete(key)))
    }

    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations()
      await Promise.all(regs.map((reg) => reg.unregister()))
    }
  } catch {
    // Still reload so the user lands on the new deploy
  }

  const url = new URL(window.location.href)
  url.searchParams.set('_vf', APP_CACHE_BUST)
  window.location.replace(url.toString())
  return true
}

/** Strip the temporary bust query after a successful reload. */
export function stripCacheBustQuery(): void {
  try {
    const url = new URL(window.location.href)
    if (!url.searchParams.has('_vf')) return
    url.searchParams.delete('_vf')
    const next = `${url.pathname}${url.search}${url.hash}`
    window.history.replaceState(null, '', next || '/')
  } catch {
    /* ignore */
  }
}
