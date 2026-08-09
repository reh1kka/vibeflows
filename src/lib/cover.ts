const cache = new Map<string, string>()
const artistCache = new Map<string, string>()
const playlistCache = new Map<string, string>()
const genreCoverCache = new Map<string, string>()

async function oembedThumbnail(spotifyUrlOrUri: string): Promise<string | null> {
  try {
    const res = await fetch(
      `https://open.spotify.com/oembed?url=${encodeURIComponent(spotifyUrlOrUri)}`,
    )
    if (!res.ok) return null
    const data = (await res.json()) as { thumbnail_url?: string }
    return data.thumbnail_url ?? null
  } catch {
    return null
  }
}

export async function fetchTrackCover(trackId: string): Promise<string | null> {
  if (!trackId) return null
  if (cache.has(trackId)) return cache.get(trackId)!
  const url = await oembedThumbnail(`spotify:track:${trackId}`)
  if (url) cache.set(trackId, url)
  return url
}

export async function fetchPlaylistCover(
  playlistUrl: string,
): Promise<string | null> {
  if (!playlistUrl) return null
  if (playlistCache.has(playlistUrl)) return playlistCache.get(playlistUrl)!
  const url = await oembedThumbnail(playlistUrl)
  if (url) playlistCache.set(playlistUrl, url)
  return url
}

/**
 * Popular cover for a genre: Every Noise example track first,
 * then Spotify genre playlist art, then optional override.
 */
export async function fetchGenrePopularCover(genre: {
  id: string
  trackId?: string | null
  playlistUrl?: string | null
  coverUrl?: string | null
}): Promise<string | null> {
  if (genreCoverCache.has(genre.id)) return genreCoverCache.get(genre.id)!
  if (genre.coverUrl) {
    genreCoverCache.set(genre.id, genre.coverUrl)
    return genre.coverUrl
  }
  if (genre.trackId) {
    const track = await fetchTrackCover(genre.trackId)
    if (track) {
      genreCoverCache.set(genre.id, track)
      return track
    }
  }
  if (genre.playlistUrl) {
    const pl = await fetchPlaylistCover(genre.playlistUrl)
    if (pl) {
      genreCoverCache.set(genre.id, pl)
      return pl
    }
  }
  return null
}

/** Spotify artist avatar via public oEmbed (no API keys). */
export async function fetchArtistAvatar(
  artistId: string,
): Promise<string | null> {
  if (!artistId) return null
  if (artistCache.has(artistId)) return artistCache.get(artistId)!
  const url = await oembedThumbnail(`spotify:artist:${artistId}`)
  if (url) artistCache.set(artistId, url)
  return url
}

/** Deterministic vibe art when cover is missing */
export function vibeArtUrl(genreName: string, color: string): string {
  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 1000">
  <defs>
    <radialGradient id="g" cx="30%" cy="20%" r="80%">
      <stop offset="0%" stop-color="${color}"/>
      <stop offset="55%" stop-color="#121212"/>
      <stop offset="100%" stop-color="#000"/>
    </radialGradient>
    <linearGradient id="b" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${color}" stop-opacity="0.9"/>
      <stop offset="100%" stop-color="#1db954" stop-opacity="0.35"/>
    </linearGradient>
  </defs>
  <rect width="800" height="1000" fill="url(#g)"/>
  <circle cx="640" cy="220" r="180" fill="url(#b)" opacity="0.55"/>
  <circle cx="120" cy="780" r="260" fill="${color}" opacity="0.22"/>
  <text x="40" y="920" fill="#ffffff88" font-family="Space Grotesk, sans-serif" font-size="42">${escapeXml(genreName.slice(0, 28))}</text>
</svg>`.trim()
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

function escapeXml(s: string) {
  return s.replace(/[<>&'"]/g, (c) =>
    ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' })[c]!,
  )
}
