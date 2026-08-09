import type { Genre } from '../types'
import type {
  ArtistPayload,
  SpotifyArtist,
  SpotifyTrack,
} from './spotify'
import { artistAboutBlurb } from './describe'

function hash(s: string) {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 33 + s.charCodeAt(i)) >>> 0
  return h
}

function pick<T>(arr: T[], seed: number) {
  return arr[seed % arr.length]
}

const topTracksCache = new Map<string, SpotifyTrack[]>()

function normName(s: string) {
  return s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, '')
}

async function deezerFetch(path: string) {
  const clean = path.startsWith('/') ? path : `/${path}`
  const urls = [
    `/api/deezer?p=${encodeURIComponent(clean)}`,
    `/deezer${clean}`,
    `https://api.deezer.com${clean}`,
  ]
  for (const url of urls) {
    try {
      const res = await fetch(url)
      if (!res.ok) continue
      return await res.json()
    } catch {
      /* try next */
    }
  }
  return null
}

type DeezerArtist = { id: number; name: string }
type DeezerTrack = {
  id: number
  title: string
  preview?: string
  duration?: number
  link?: string
  album?: { cover_medium?: string; cover_big?: string }
  artist?: { name?: string }
}

function scoreArtistMatch(query: string, candidate: string) {
  const q = normName(query)
  const c = normName(candidate)
  if (!q || !c) return 0
  if (q === c) return 100
  if (c.includes(q) || q.includes(c)) return 80
  // token overlap for multi-word names
  const qt = q.length >= 4 ? q : ''
  if (qt && c.includes(qt.slice(0, Math.min(6, qt.length)))) return 40
  return 0
}

/** Real popular tracks via Deezer (no Spotify keys needed). */
export async function fetchRealTopTracks(
  artistId: string,
  artistName: string,
): Promise<SpotifyTrack[] | null> {
  const cacheKey = normName(artistName) || artistId
  const cached = topTracksCache.get(cacheKey)
  if (cached?.length) return cached

  const search = (await deezerFetch(
    `/search/artist?q=${encodeURIComponent(artistName)}&limit=8`,
  )) as { data?: DeezerArtist[] } | null
  const items = search?.data ?? []

  let best: DeezerArtist | null = null
  let bestScore = 0
  for (const a of items) {
    const s = scoreArtistMatch(artistName, a.name)
    if (s > bestScore) {
      best = a
      bestScore = s
    }
  }
  if (!best || bestScore < 40) return null

  const list: DeezerTrack[] = []
  const seen = new Set<number>()

  const push = (tracks: DeezerTrack[] | undefined) => {
    for (const t of tracks ?? []) {
      if (!t?.id || seen.has(t.id)) continue
      seen.add(t.id)
      list.push(t)
    }
  }

  {
    const top = (await deezerFetch(
      `/artist/${best.id}/top?limit=5`,
    )) as { data?: DeezerTrack[] } | null
    push(top?.data)
  }

  if (list.length < 5) {
    const q = encodeURIComponent(`artist:"${artistName}"`)
    const byArtist = (await deezerFetch(
      `/search/track?q=${q}&limit=10`,
    )) as { data?: DeezerTrack[] } | null
    push(byArtist?.data)
  }

  if (list.length < 5) {
    const loose = (await deezerFetch(
      `/search/track?q=${encodeURIComponent(artistName)}&limit=10`,
    )) as { data?: DeezerTrack[] } | null
    // only keep tracks whose artist name matches reasonably
    push(
      (loose?.data ?? []).filter((t) => {
        const an = t.artist?.name || ''
        return scoreArtistMatch(artistName, an) >= 40
      }),
    )
  }

  if (!list.length) return null

  const tracks: SpotifyTrack[] = list.slice(0, 5).map((t) => {
    const title = t.title
    const spotifySearch = `https://open.spotify.com/search/${encodeURIComponent(
      `track:${title} artist:${artistName}`,
    )}`
    return {
      id: `dz-${t.id}`,
      name: title,
      preview_url: t.preview || null,
      duration_ms: (t.duration ?? 180) * 1000,
      external_urls: { spotify: spotifySearch },
      artists: [{ id: artistId, name: artistName }],
      album: {
        images: t.album?.cover_medium
          ? [{ url: t.album.cover_big || t.album.cover_medium }]
          : [],
      },
    }
  })

  topTracksCache.set(cacheKey, tracks)
  return tracks
}

/** Fill missing Spotify preview_url via Deezer search (browser-safe). */
export async function enrichSpotifyTrackPreviews(
  tracks: SpotifyTrack[],
  artistName: string,
): Promise<SpotifyTrack[]> {
  if (!tracks.length) return tracks
  const out = await Promise.all(
    tracks.map(async (track) => {
      if (track.preview_url) return track
      try {
        const q = encodeURIComponent(
          `track:"${track.name}" artist:"${artistName}"`,
        )
        const data = (await deezerFetch(
          `/search/track?q=${q}&limit=3`,
        )) as { data?: DeezerTrack[] } | null
        const hit =
          data?.data?.find((t) => t.preview) ||
          (
            (await deezerFetch(
              `/search/track?q=${encodeURIComponent(`${track.name} ${artistName}`)}&limit=3`,
            )) as { data?: DeezerTrack[] } | null
          )?.data?.find((t) => t.preview)
        if (!hit?.preview) return track
        return { ...track, preview_url: hit.preview }
      } catch {
        return track
      }
    }),
  )
  return out
}

async function fetchArtistCover(artistId: string): Promise<string | null> {
  try {
    const res = await fetch(
      `https://open.spotify.com/oembed?url=${encodeURIComponent(`spotify:artist:${artistId}`)}`,
    )
    if (!res.ok) return null
    const data = (await res.json()) as { thumbnail_url?: string; title?: string }
    return data.thumbnail_url ?? null
  } catch {
    return null
  }
}

async function withCovers(artists: SpotifyArtist[]): Promise<SpotifyArtist[]> {
  return Promise.all(
    artists.map(async (a) => {
      if (a.images?.[0]?.url) return a
      const url = await fetchArtistCover(a.id)
      return url ? { ...a, images: [{ url }] } : a
    }),
  )
}

function genresForArtist(artistId: string, catalog: Genre[]) {
  return catalog.filter((g) => g.artists?.some((a) => a.id === artistId))
}

function relatedFromCatalog(
  artistId: string,
  genreHits: Genre[],
  catalog: Genre[],
): SpotifyArtist[] {
  const scores = new Map<string, { name: string; score: number }>()
  const pool = genreHits.length ? genreHits : catalog.slice(0, 40)
  for (const g of pool) {
    for (const a of g.artists ?? []) {
      if (!a.id || a.id === artistId || !a.name) continue
      const prev = scores.get(a.id)
      scores.set(a.id, {
        name: a.name,
        score: (prev?.score ?? 0) + 1,
      })
    }
  }
  return [...scores.entries()]
    .sort((a, b) => b[1].score - a[1].score)
    .slice(0, 8)
    .map(([id, v]) => ({
      id,
      name: v.name,
      images: [],
      genres: [],
      external_urls: { spotify: `https://open.spotify.com/artist/${id}` },
    }))
}

function aboutBlurb(name: string, genres: string[], seed: number) {
  return artistAboutBlurb(name, genres, seed)
}

/** Full artist card without Spotify API keys */
export async function buildLocalArtistBundle(
  artistId: string,
  artistName: string | undefined,
  catalog: Genre[],
): Promise<ArtistPayload & { about: string; listeners: number }> {
  const seed = hash(artistId)
  const hits = genresForArtist(artistId, catalog)
  const genreNames = [...new Set(hits.map((g) => g.name))].slice(0, 6)
  const cover = await fetchArtistCover(artistId)
  const name =
    artistName ||
    hits[0]?.artists?.find((a) => a.id === artistId)?.name ||
    'Artist'

  const { fetchDeezerFansByName } = await import('./deezerFans')
  const deezerFans = await fetchDeezerFansByName(name)
  const listeners = deezerFans ?? 0

  const artist: SpotifyArtist = {
    id: artistId,
    name,
    images: cover ? [{ url: cover }] : [],
    genres: genreNames.length
      ? genreNames
      : [pick(['indie', 'pop', 'electronic', 'alternative'], seed)],
    followers: { total: listeners },
    external_urls: { spotify: `https://open.spotify.com/artist/${artistId}` },
  }

  const relatedArtists = await withCovers(
    relatedFromCatalog(artistId, hits, catalog),
  )

  const deezerTop = await fetchRealTopTracks(artistId, name)
  const topTracks = deezerTop?.length ? deezerTop : []

  return {
    artist,
    topTracks,
    relatedArtists,
    about: aboutBlurb(name, genreNames, seed),
    listeners,
    demo: false,
  }
}
