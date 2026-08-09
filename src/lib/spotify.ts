import { PRIMARY_HOST } from './canonicalHost'

const AUTH_KEY = 'weirdnoise-spotify-auth-v1'
const VERIFIER_KEY = 'weirdnoise-spotify-verifier'

export type SpotifyArtist = {
  id: string
  name: string
  images: Array<{ url: string; width?: number; height?: number }>
  genres: string[]
  followers?: { total: number }
  external_urls?: { spotify: string }
}

export type SpotifyTrack = {
  id: string
  name: string
  preview_url: string | null
  duration_ms: number
  external_urls?: { spotify: string }
  album?: { images?: Array<{ url: string }> }
  artists: Array<{ id: string; name: string }>
}

export type ArtistPayload = {
  artist: SpotifyArtist | null
  topTracks: SpotifyTrack[]
  relatedArtists: SpotifyArtist[]
  about?: string
  listeners?: number
  demo?: boolean
  error?: string
  hint?: string
}

export type UserAuth = {
  accessToken: string
  refreshToken: string
  expiresAt: number
  displayName?: string
  userId?: string
}

export type TasteProfile = {
  genreLabels: string[]
  artistIds: string[]
  artistNames: string[]
  trackIds: string[]
  /** Higher = stronger listening signal */
  artistWeights: Record<string, number>
  genreLabelWeights: Record<string, number>
  fetchedAt: number
}

function clientId() {
  return import.meta.env.VITE_SPOTIFY_CLIENT_ID as string | undefined
}

function redirectUri() {
  const host = window.location.hostname
  // Always use the canonical prod host so Spotify Dashboard only needs one URI
  if (host === PRIMARY_HOST || host.endsWith('.vercel.app')) {
    return `https://${PRIMARY_HOST}/`
  }
  // Local / LAN: exact current origin (must be listed in Spotify Dashboard)
  return `${window.location.origin}/`
}

export function loadUserAuth(): UserAuth | null {
  try {
    const raw = localStorage.getItem(AUTH_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<UserAuth> & { isDemo?: boolean }
    // Drop legacy fake sessions from older builds
    if (parsed?.isDemo || parsed?.accessToken === 'demo') {
      clearUserAuth()
      return null
    }
    // Reject tampered / non-shape payloads (XSS stash)
    if (
      typeof parsed?.accessToken !== 'string' ||
      !parsed.accessToken ||
      typeof parsed?.refreshToken !== 'string' ||
      typeof parsed?.expiresAt !== 'number' ||
      !Number.isFinite(parsed.expiresAt)
    ) {
      clearUserAuth()
      return null
    }
    return {
      accessToken: parsed.accessToken,
      refreshToken: parsed.refreshToken,
      expiresAt: parsed.expiresAt,
      userId: typeof parsed.userId === 'string' ? parsed.userId : undefined,
      displayName:
        typeof parsed.displayName === 'string' ? parsed.displayName : undefined,
    }
  } catch {
    clearUserAuth()
    return null
  }
}

export function saveUserAuth(auth: UserAuth | null) {
  if (!auth) localStorage.removeItem(AUTH_KEY)
  else localStorage.setItem(AUTH_KEY, JSON.stringify(auth))
}

export function clearUserAuth() {
  localStorage.removeItem(AUTH_KEY)
  localStorage.removeItem(VERIFIER_KEY)
}

async function sha256(plain: string) {
  const data = new TextEncoder().encode(plain)
  const hash = await crypto.subtle.digest('SHA-256', data)
  return btoa(String.fromCharCode(...new Uint8Array(hash)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

function randomString(len = 64) {
  const chars =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  const arr = crypto.getRandomValues(new Uint8Array(len))
  return [...arr].map((x) => chars[x % chars.length]).join('')
}

export async function beginSpotifyLogin() {
  const id = clientId()
  if (!id) throw new Error('Нет VITE_SPOTIFY_CLIENT_ID в .env')
  const verifier = randomString(64)
  localStorage.setItem(VERIFIER_KEY, verifier)
  const challenge = await sha256(verifier)
  const scope = [
    'user-read-private',
    'user-top-read',
    'user-library-read',
    'user-follow-read',
    'playlist-modify-public',
    'playlist-modify-private',
    'playlist-read-private',
  ].join(' ')
  const params = new URLSearchParams({
    client_id: id,
    response_type: 'code',
    redirect_uri: redirectUri(),
    scope,
    code_challenge_method: 'S256',
    code_challenge: challenge,
  })
  window.location.href = `https://accounts.spotify.com/authorize?${params}`
}

export async function completeSpotifyLoginIfNeeded(): Promise<UserAuth | null> {
  const params = new URLSearchParams(window.location.search)
  const code = params.get('code')
  if (!code) return loadUserAuth()
  const id = clientId()
  const verifier = localStorage.getItem(VERIFIER_KEY)
  if (!id || !verifier) return loadUserAuth()

  const tokenBody = new URLSearchParams({
    client_id: id,
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri(),
    code_verifier: verifier,
  })

  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: tokenBody,
  })
  window.history.replaceState({}, '', '/')
  localStorage.removeItem(VERIFIER_KEY)
  if (!res.ok) return loadUserAuth()
  const data = (await res.json()) as {
    access_token: string
    refresh_token: string
    expires_in: number
  }
  const auth: UserAuth = {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  }
  try {
    const me = await fetch('https://api.spotify.com/v1/me', {
      headers: { Authorization: `Bearer ${auth.accessToken}` },
    })
    if (me.ok) {
      const profile = (await me.json()) as {
        display_name?: string
        id?: string
      }
      auth.displayName = profile.display_name
      auth.userId = profile.id
    }
  } catch {
    // ignore
  }
  saveUserAuth(auth)
  return auth
}

export async function refreshUserAuth(
  auth: UserAuth,
): Promise<UserAuth | null> {
  const id = clientId()
  if (!id) return null
  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: id,
      grant_type: 'refresh_token',
      refresh_token: auth.refreshToken,
    }),
  })
  if (!res.ok) {
    clearUserAuth()
    return null
  }
  const data = (await res.json()) as {
    access_token: string
    refresh_token?: string
    expires_in: number
  }
  const next: UserAuth = {
    ...auth,
    accessToken: data.access_token,
    refreshToken: data.refresh_token || auth.refreshToken,
    expiresAt: Date.now() + data.expires_in * 1000,
  }
  saveUserAuth(next)
  return next
}

async function withUserToken(): Promise<string | null> {
  let auth = loadUserAuth()
  if (!auth) return null
  if (Date.now() > auth.expiresAt - 30_000) {
    auth = (await refreshUserAuth(auth)) || null
  }
  return auth?.accessToken ?? null
}

function withListeners(data: ArtistPayload, demo: boolean): ArtistPayload {
  const listeners =
    data.listeners || data.artist?.followers?.total || 0
  return { ...data, listeners, demo }
}

export async function fetchArtistBundle(
  id: string,
  opts?: { name?: string; catalog?: import('../types').Genre[] },
): Promise<ArtistPayload> {
  const userToken = await withUserToken()

  // 1) Official Spotify Web API with the user's token
  if (userToken) {
    try {
      const data = await fetchArtistFromSpotifyApi(id, userToken)
      if (data.artist && data.topTracks.length) return withListeners(data, false)
    } catch {
      /* try proxy */
    }
  }

  // 2) App proxy: client credentials or Spotify embed
  let proxy: ArtistPayload | null = null
  try {
    const headers: HeadersInit = {}
    if (userToken) headers.Authorization = `Bearer ${userToken}`
    const res = await fetch(`/api/spotify/artist?id=${encodeURIComponent(id)}`, {
      headers,
    })
    const data = (await res.json()) as ArtistPayload & { hint?: string }
    if (res.ok && data.artist) {
      proxy = withListeners(data, false)
      // Real Spotify followers — done
      if (proxy.listeners && proxy.topTracks?.length) return proxy
    }
  } catch {
    // fall through
  }

  // 3) Local card (catalog + oEmbed) — fills listeners when API/embed omitted them
  const { buildLocalArtistBundle } = await import('./artistDemo')
  const local = await buildLocalArtistBundle(id, opts?.name, opts?.catalog ?? [])

  if (proxy?.artist) {
    return {
      ...local,
      ...proxy,
      artist: proxy.artist || local.artist,
      topTracks: proxy.topTracks?.length ? proxy.topTracks : local.topTracks,
      relatedArtists: proxy.relatedArtists?.length
        ? proxy.relatedArtists
        : local.relatedArtists,
      listeners: proxy.listeners || local.listeners || 0,
      demo: false,
    }
  }

  try {
    const res = await fetch(`/api/spotify/artist?id=${encodeURIComponent(id)}`)
    if (res.ok) {
      const data = (await res.json()) as ArtistPayload
      if (data.topTracks?.length) {
        const artist = data.artist || local.artist
        const fromApi =
          data.listeners || artist?.followers?.total || 0
        return {
          ...local,
          artist,
          topTracks: data.topTracks,
          listeners: fromApi || local.listeners || 0,
          demo: false,
        }
      }
    }
  } catch {
    /* keep local */
  }

  return { ...local, demo: false }
}

async function fetchArtistFromSpotifyApi(
  id: string,
  token: string,
): Promise<ArtistPayload> {
  const markets = ['RU', 'US', 'GB']
  const artistRes = await fetch(`https://api.spotify.com/v1/artists/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!artistRes.ok) throw new Error(`artist ${artistRes.status}`)
  const artist = (await artistRes.json()) as SpotifyArtist

  let topTracks: SpotifyTrack[] = []
  for (const market of markets) {
    const topRes = await fetch(
      `https://api.spotify.com/v1/artists/${id}/top-tracks?market=${market}`,
      { headers: { Authorization: `Bearer ${token}` } },
    )
    if (!topRes.ok) continue
    const body = (await topRes.json()) as { tracks?: SpotifyTrack[] }
    topTracks = (body.tracks ?? []).slice(0, 5)
    if (topTracks.length) break
  }

  let relatedArtists: SpotifyArtist[] = []
  try {
    const relRes = await fetch(
      `https://api.spotify.com/v1/artists/${id}/related-artists`,
      { headers: { Authorization: `Bearer ${token}` } },
    )
    if (relRes.ok) {
      const body = (await relRes.json()) as { artists?: SpotifyArtist[] }
      relatedArtists = body.artists ?? []
    }
  } catch {
    /* optional */
  }

  return {
    artist,
    topTracks,
    relatedArtists,
    listeners: artist.followers?.total,
    demo: false,
  }
}

export type SpotifyWriteResult = {
  ok: boolean
  status?: number
  /** Development-mode app without this user in the allowlist, etc. */
  needsAllowlist?: boolean
  needsRelogin?: boolean
}


/** Manual only — follow/save playlist into library */
export async function followPlaylist(
  playlistId: string,
): Promise<SpotifyWriteResult> {
  const token = await withUserToken()
  if (!token) return { ok: false, needsRelogin: true }
  const res = await fetch(
    `https://api.spotify.com/v1/playlists/${playlistId}/followers`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ public: false }),
    },
  )
  if (res.ok || res.status === 200) return { ok: true, status: res.status }
  if (res.status === 403) return { ok: false, status: 403, needsAllowlist: true }
  if (res.status === 401) return { ok: false, status: 401, needsRelogin: true }
  return { ok: false, status: res.status }
}

export async function isPlaylistFollowed(
  playlistId: string,
): Promise<boolean | null> {
  const token = await withUserToken()
  if (!token) return null
  const auth = loadUserAuth()
  if (!auth?.userId) return null
  const res = await fetch(
    `https://api.spotify.com/v1/playlists/${playlistId}/followers/contains?ids=${encodeURIComponent(auth.userId)}`,
    { headers: { Authorization: `Bearer ${token}` } },
  )
  if (!res.ok) return null
  const data = (await res.json()) as boolean[]
  return Boolean(data[0])
}

export async function fetchTasteProfile(): Promise<TasteProfile | null> {
  const token = await withUserToken()
  if (!token) return null

  const headers = { Authorization: `Bearer ${token}` }
  const ranges = ['short_term', 'medium_term', 'long_term'] as const
  const rangeWeight = { short_term: 1.35, medium_term: 1.1, long_term: 0.85 }

  const genreLabelWeights: Record<string, number> = {}
  const artistWeights: Record<string, number> = {}
  const artistNames: Record<string, string> = {}
  const trackIds: string[] = []
  const seenTracks = new Set<string>()

  const bumpArtist = (
    id: string,
    weight: number,
    genres?: string[],
    name?: string,
  ) => {
    if (!id) return
    artistWeights[id] = (artistWeights[id] ?? 0) + weight
    if (name) artistNames[id] = name
    for (const g of genres ?? []) {
      const key = g.toLowerCase()
      genreLabelWeights[key] = (genreLabelWeights[key] ?? 0) + weight * 0.85
    }
  }

  await Promise.all(
    ranges.flatMap((range) => {
      const w = rangeWeight[range]
      return [
        fetch(
          `https://api.spotify.com/v1/me/top/artists?limit=40&time_range=${range}`,
          { headers },
        ).then(async (res) => {
          if (!res.ok) return
          const data = (await res.json()) as {
            items: Array<{
              id: string
              name?: string
              genres?: string[]
            }>
          }
          ;(data.items ?? []).forEach((a, i) => {
            const rank = 1 - i / 50
            bumpArtist(a.id, w * (0.55 + rank), a.genres, a.name)
          })
        }),
        fetch(
          `https://api.spotify.com/v1/me/top/tracks?limit=40&time_range=${range}`,
          { headers },
        ).then(async (res) => {
          if (!res.ok) return
          const data = (await res.json()) as {
            items: Array<{
              id: string
              name?: string
              artists?: Array<{ id: string; name?: string }>
            }>
          }
          ;(data.items ?? []).forEach((t, i) => {
            if (t.id && !seenTracks.has(t.id)) {
              seenTracks.add(t.id)
              trackIds.push(t.id)
            }
            const rank = 1 - i / 50
            for (const a of t.artists ?? []) {
              bumpArtist(a.id, w * 0.45 * (0.5 + rank), undefined, a.name)
            }
          })
        }),
      ]
    }),
  )

  // Saved tracks
  try {
    const likedRes = await fetch(
      'https://api.spotify.com/v1/me/tracks?limit=50',
      { headers },
    )
    if (likedRes.ok) {
      const data = (await likedRes.json()) as {
        items: Array<{
          track?: {
            id?: string
            artists?: Array<{ id: string; name?: string }>
          }
        }>
      }
      for (const item of data.items ?? []) {
        const t = item.track
        if (t?.id && !seenTracks.has(t.id)) {
          seenTracks.add(t.id)
          trackIds.push(t.id)
        }
        for (const a of t?.artists ?? []) {
          bumpArtist(a.id, 0.55, undefined, a.name)
        }
      }
    }
  } catch {
    /* optional */
  }

  // Followed artists
  try {
    const fol = await fetch(
      'https://api.spotify.com/v1/me/following?type=artist&limit=50',
      { headers },
    )
    if (fol.ok) {
      const data = (await fol.json()) as {
        artists?: {
          items?: Array<{ id: string; name?: string; genres?: string[] }>
        }
      }
      for (const a of data.artists?.items ?? []) {
        bumpArtist(a.id, 0.7, a.genres, a.name)
      }
    }
  } catch {
    /* optional */
  }

  // Sort artists by weight and hydrate missing genres/names
  const artistIds = Object.keys(artistWeights).sort(
    (a, b) => (artistWeights[b] ?? 0) - (artistWeights[a] ?? 0),
  )

  for (let i = 0; i < Math.min(artistIds.length, 60); i += 50) {
    const batch = artistIds.slice(i, i + 50)
    if (!batch.length) break
    try {
      const r = await fetch(
        `https://api.spotify.com/v1/artists?ids=${batch.map(encodeURIComponent).join(',')}`,
        { headers },
      )
      if (!r.ok) continue
      const data = (await r.json()) as {
        artists: Array<{
          id: string
          name?: string
          genres?: string[]
        } | null>
      }
      for (const a of data.artists ?? []) {
        if (!a) continue
        if (a.name) artistNames[a.id] = a.name
        const w = artistWeights[a.id] ?? 0.4
        for (const g of a.genres ?? []) {
          const key = g.toLowerCase()
          genreLabelWeights[key] = (genreLabelWeights[key] ?? 0) + w * 0.9
        }
      }
    } catch {
      /* ignore batch */
    }
  }

  const genreLabels = Object.keys(genreLabelWeights).sort(
    (a, b) => (genreLabelWeights[b] ?? 0) - (genreLabelWeights[a] ?? 0),
  )

  return {
    genreLabels,
    artistIds,
    artistNames: artistIds.map((id) => artistNames[id]).filter(Boolean) as string[],
    trackIds,
    artistWeights,
    genreLabelWeights,
    fetchedAt: Date.now(),
  }
}

export function extractPlaylistId(url: string): string | null {
  const m = url.match(/playlist\/([a-zA-Z0-9]+)/)
  return m?.[1] ?? null
}

export function spotifyConfigured() {
  return Boolean(clientId())
}
