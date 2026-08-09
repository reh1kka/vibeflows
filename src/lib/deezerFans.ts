/**
 * Artist fan counts from Deezer (nb_fan).
 * Prefers the precomputed /artist-fans.json catalog, then live search.
 */

type ArtistRef = { id: string | null; name: string }

const CATALOG_URL = '/artist-fans.json'
const FANS_TTL = 7 * 24 * 60 * 60 * 1000
const FANS_KEY = 'vf_deezer_fans_v1'

const mem = new Map<string, number>()
const pending = new Map<string, Promise<number | null>>()
let catalogLoaded: Promise<void> | null = null
let localLoaded = false

function loadLocal() {
  if (localLoaded) return
  localLoaded = true
  try {
    const raw = localStorage.getItem(FANS_KEY)
    if (!raw) return
    const parsed = JSON.parse(raw) as {
      at?: number
      data?: Record<string, number>
    }
    if (!parsed.at || Date.now() - parsed.at > FANS_TTL) return
    for (const [id, n] of Object.entries(parsed.data ?? {})) {
      if (typeof n === 'number') mem.set(id, n)
    }
  } catch {
    /* ignore */
  }
}

function saveLocal() {
  try {
    localStorage.setItem(
      FANS_KEY,
      JSON.stringify({ at: Date.now(), data: Object.fromEntries(mem) }),
    )
  } catch {
    /* quota */
  }
}

async function ensureCatalog() {
  if (!catalogLoaded) {
    catalogLoaded = (async () => {
      try {
        const res = await fetch(CATALOG_URL)
        if (!res.ok) return
        const data = (await res.json()) as Record<string, number>
        for (const [id, n] of Object.entries(data)) {
          if (typeof n === 'number' && !mem.has(id)) mem.set(id, n)
        }
      } catch {
        /* optional asset */
      }
    })()
  }
  await catalogLoaded
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
      const data = await res.json()
      // Deezer returns HTTP 200 + { error: { code: 4 } } on quota
      if (data?.error) continue
      return data
    } catch {
      /* try next */
    }
  }
  return null
}

function normName(s: string) {
  return s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, '')
}

function scoreArtistMatch(query: string, candidate: string) {
  const q = normName(query)
  const c = normName(candidate)
  if (!q || !c) return 0
  if (q === c) return 100
  if (c.includes(q) || q.includes(c)) return 80
  if (q.length >= 4 && c.includes(q.slice(0, Math.min(6, q.length)))) return 40
  return 0
}

/** Live Deezer lookup by artist name → nb_fan */
export async function fetchDeezerFansByName(
  artistName: string,
): Promise<number | null> {
  if (!artistName.trim()) return null
  const search = (await deezerFetch(
    `/search/artist?q=${encodeURIComponent(artistName)}&limit=8`,
  )) as { data?: Array<{ id: number; name: string; nb_fan?: number }> } | null

  const items = search?.data ?? []
  let best: (typeof items)[number] | null = null
  let bestScore = -1
  let bestFans = -1
  for (const a of items) {
    const s = scoreArtistMatch(artistName, a.name)
    const fans = Number(a.nb_fan) || 0
    if (s > bestScore || (s === bestScore && fans > bestFans)) {
      best = a
      bestScore = s
      bestFans = fans
    }
  }
  if (!best || bestScore < 40) return null

  if (typeof best.nb_fan === 'number') return best.nb_fan

  const full = (await deezerFetch(`/artist/${best.id}`)) as {
    nb_fan?: number
  } | null
  return typeof full?.nb_fan === 'number' ? full.nb_fan : null
}

async function resolveOne(artist: ArtistRef): Promise<number | null> {
  if (!artist.id) return null
  if (mem.has(artist.id)) return mem.get(artist.id)!

  const existing = pending.get(artist.id)
  if (existing) return existing

  const job = (async () => {
    const fans = artist.name
      ? await fetchDeezerFansByName(artist.name)
      : null
    if (typeof fans === 'number') {
      mem.set(artist.id!, fans)
      return fans
    }
    return null
  })().finally(() => {
    pending.delete(artist.id!)
  })

  pending.set(artist.id, job)
  return job
}

/**
 * Fan counts keyed by Spotify artist id.
 * Catalog first, then live Deezer for anything still missing.
 */
export async function fetchArtistFans(
  artists: ArtistRef[],
): Promise<Record<string, number>> {
  loadLocal()
  await ensureCatalog()

  const list = artists.filter((a) => a.id && a.name)
  const missing = list.filter((a) => !mem.has(a.id!))

  if (missing.length) {
    // Cap concurrent live lookups so a genre card doesn't hammer Deezer
    const CONCURRENCY = 3
    let i = 0
    async function worker() {
      while (i < missing.length) {
        const a = missing[i++]
        await resolveOne(a)
      }
    }
    await Promise.all(
      Array.from({ length: Math.min(CONCURRENCY, missing.length) }, () =>
        worker(),
      ),
    )
    saveLocal()
  }

  const out: Record<string, number> = {}
  for (const a of list) {
    const n = mem.get(a.id!)
    if (typeof n === 'number' && n > 0) out[a.id!] = n
  }
  return out
}
