/**
 * Spotify artist fetch for the local Vite API plugin.
 */
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'

export async function getAppToken(env, cache) {
  const id = env.SPOTIFY_CLIENT_ID || env.VITE_SPOTIFY_CLIENT_ID
  const secret = env.SPOTIFY_CLIENT_SECRET
  if (!id || !secret) throw new Error('NO_CREDENTIALS')
  if (cache.t && Date.now() < cache.t.expires - 30_000) return cache.t.access

  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString('base64')}`,
    },
    body: 'grant_type=client_credentials',
  })
  if (!res.ok) throw new Error(`token ${res.status}`)
  const data = await res.json()
  cache.t = {
    access: data.access_token,
    expires: Date.now() + data.expires_in * 1000,
  }
  return cache.t.access
}

async function spotifyGet(token, apiPath) {
  const res = await fetch(`https://api.spotify.com/v1${apiPath}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  const text = await res.text()
  return { status: res.status, text }
}

function decodeJsonString(s) {
  return s
    .replace(/\\u([0-9a-fA-F]{4})/g, (_, h) =>
      String.fromCharCode(parseInt(h, 16)),
    )
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, '\\')
}

export async function fetchArtistFromEmbed(artistId) {
  const res = await fetch(
    `https://open.spotify.com/embed/artist/${encodeURIComponent(artistId)}`,
    {
      headers: {
        'User-Agent': UA,
        Accept: 'text/html',
      },
    },
  )
  if (!res.ok) throw new Error(`embed ${res.status}`)
  const html = await res.text()

  const titleMatch = html.match(/title="Spotify Embed:\s*([^"]+)"/i)
  let name = titleMatch?.[1]?.trim() || ''

  const tracks = []
  const re =
    /spotify:track:([a-zA-Z0-9]+)[\s\S]{0,280}?"title":"((?:\\.|[^"\\])*)"/g
  let m
  while ((m = re.exec(html)) && tracks.length < 5) {
    if (tracks.some((t) => t.id === m[1])) continue
    tracks.push({
      id: m[1],
      name: decodeJsonString(m[2]),
      preview_url: null,
      duration_ms: 0,
      external_urls: {
        spotify: `https://open.spotify.com/track/${m[1]}`,
      },
      artists: [{ id: artistId, name: name || 'Artist' }],
      album: { images: [] },
    })
  }

  let image = null
  try {
    const oe = await fetch(
      `https://open.spotify.com/oembed?url=${encodeURIComponent(`spotify:artist:${artistId}`)}`,
      { headers: { 'User-Agent': UA, Accept: 'application/json' } },
    )
    if (oe.ok) {
      const j = await oe.json()
      image = j.thumbnail_url ?? null
      if (!name && j.title) name = j.title.replace(/^Spotify Embed:\s*/i, '').trim()
    }
  } catch {
    /* ignore */
  }
  if (!name) name = 'Artist'
  for (const t of tracks) t.artists = [{ id: artistId, name }]

  return {
    artist: {
      id: artistId,
      name,
      images: image ? [{ url: image }] : [],
      genres: [],
      followers: { total: 0 },
      external_urls: {
        spotify: `https://open.spotify.com/artist/${artistId}`,
      },
    },
    topTracks: tracks,
    relatedArtists: [],
    listeners: 0,
    demo: false,
    source: 'embed',
  }
}

export async function fetchArtistFromApi(token, id) {
  const markets = ['RU', 'US', 'GB']
  const artist = await spotifyGet(token, `/artists/${id}`)
  let topTracks = []
  for (const market of markets) {
    const top = await spotifyGet(
      token,
      `/artists/${id}/top-tracks?market=${market}`,
    )
    if (top.status === 200) {
      topTracks = JSON.parse(top.text).tracks ?? []
      if (topTracks.length) break
    }
  }

  const related = await spotifyGet(token, `/artists/${id}/related-artists`)
  let relatedArtists = []
  if (related.status === 200) {
    relatedArtists = JSON.parse(related.text).artists
  } else if (artist.status === 200) {
    const a = JSON.parse(artist.text)
    const q = a.genres?.[0] || a.name
    const search = await spotifyGet(
      token,
      `/search?type=artist&limit=8&q=${encodeURIComponent(`genre:"${q}"`)}`,
    )
    if (search.status === 200) {
      const parsed = JSON.parse(search.text)
      relatedArtists = parsed.artists.items.filter((x) => x.id !== id)
    }
  }

  const parsedArtist = artist.status === 200 ? JSON.parse(artist.text) : null
  return {
    artist: parsedArtist,
    topTracks: topTracks.slice(0, 5),
    relatedArtists,
    listeners: parsedArtist?.followers?.total ?? 0,
    artistError: artist.status !== 200 ? artist.text : null,
    demo: false,
    source: 'api',
  }
}

export async function resolveArtistPayload(id, env, cache, bearerToken) {
  let token = bearerToken || null
  if (!token) {
    try {
      token = await getAppToken(env, cache)
    } catch {
      token = null
    }
  }

  let payload = null
  if (token) {
    try {
      payload = await fetchArtistFromApi(token, id)
      if (!payload.artist || !payload.topTracks?.length) payload = null
    } catch {
      payload = null
    }
  }

  if (!payload?.artist || !payload.topTracks?.length) {
    payload = await fetchArtistFromEmbed(id)
  }
  if (payload && payload.listeners == null) {
    payload.listeners = payload.artist?.followers?.total ?? 0
  }
  return payload
}
