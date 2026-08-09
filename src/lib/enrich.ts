import type { Artist, Genre } from '../types'

function decodeEntities(s: string) {
  return s
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&raquo;/g, '')
}

/** Fetch artists + playlist from engemap (dev proxy or public CORS fallback) */
export async function enrichGenre(genre: Genre): Promise<Partial<Genre>> {
  const urls = [
    `/everynoise/${genre.engemap}`,
    `https://api.allorigins.win/raw?url=${encodeURIComponent(`https://everynoise.com/${genre.engemap}`)}`,
  ]

  let html = ''
  for (const url of urls) {
    try {
      const res = await fetch(url)
      if (!res.ok) continue
      html = await res.text()
      if (html.includes('artistprofile') || html.includes('spotify.com/playlist')) {
        break
      }
    } catch {
      // try next
    }
  }
  if (!html) return {}

  const playlistId =
    html.match(/https:\/\/open\.spotify\.com\/playlist\/([a-zA-Z0-9]+)/)?.[1] ??
    null

  const artists: Artist[] = []
  const seen = new Set<string>()
  const re =
    />([^<]{1,60})<a class=navlink href="artistprofile\.html\?id=([a-zA-Z0-9]+)"/g
  let m
  while ((m = re.exec(html))) {
    const name = decodeEntities(m[1].trim())
    const id = m[2]
    if (!name || seen.has(id) || name.includes('»')) continue
    seen.add(id)
    artists.push({ name, id })
    if (artists.length >= 12) break
  }

  return {
    playlistUrl: playlistId
      ? `https://open.spotify.com/playlist/${playlistId}`
      : genre.playlistUrl,
    artists: artists.length ? artists : genre.artists,
  }
}

export function artistUrl(artist: Artist) {
  if (artist.id) return `https://open.spotify.com/artist/${artist.id}`
  return `https://open.spotify.com/search/${encodeURIComponent(artist.name)}`
}
