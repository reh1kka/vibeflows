/** Open Spotify links in the desktop/mobile app when possible. */

export function toSpotifyUri(webUrl: string): string | null {
  try {
    const u = new URL(webUrl, 'https://open.spotify.com')
    if (!/spotify\.com$/i.test(u.hostname)) return null
    const parts = u.pathname.split('/').filter(Boolean)
    if (!parts.length) return null
    if (parts[0] === 'search') {
      const q = decodeURIComponent(parts.slice(1).join('/') || '')
      return q ? `spotify:search:${q}` : null
    }
    const type = parts[0]
    const id = (parts[1] || '').split('?')[0]
    if (
      id &&
      ['artist', 'track', 'playlist', 'album', 'show', 'episode', 'user'].includes(
        type,
      )
    ) {
      return `spotify:${type}:${id}`
    }
  } catch {
    /* ignore */
  }
  return null
}

export function openInSpotify(
  webUrl: string,
  event?: { preventDefault: () => void },
) {
  event?.preventDefault()
  const https = webUrl.startsWith('http')
    ? webUrl
    : `https://open.spotify.com/${webUrl.replace(/^\//, '')}`
  const uri = toSpotifyUri(https)
  if (!uri) {
    window.open(https, '_blank', 'noopener,noreferrer')
    return
  }

  const ua = navigator.userAgent || ''
  if (/Android/i.test(ua)) {
    const path = https.replace(/^https?:\/\//i, '')
    window.location.href = `intent://${path}#Intent;scheme=https;package=com.spotify.music;S.browser_fallback_url=${encodeURIComponent(https)};end`
    return
  }

  const started = Date.now()
  const onBlur = () => {
    window.removeEventListener('blur', onBlur)
    window.removeEventListener('visibilitychange', onVis)
  }
  const onVis = () => {
    if (document.visibilityState === 'hidden') onBlur()
  }
  window.addEventListener('blur', onBlur)
  window.addEventListener('visibilitychange', onVis)

  window.location.href = uri
  window.setTimeout(() => {
    window.removeEventListener('blur', onBlur)
    window.removeEventListener('visibilitychange', onVis)
    if (document.visibilityState === 'hidden') return
    if (Date.now() - started < 1600) {
      window.open(https, '_blank', 'noopener,noreferrer')
    }
  }, 1000)
}
