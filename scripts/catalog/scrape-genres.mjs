/**
 * Scrape Every Noise at Once → public/genres.json
 * Homepage: name, coords, color, example track/artist, engemap path
 * Engemap: playlist URL + artists (with Spotify IDs)
 */
import { writeFile, mkdir, readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const OUT = path.join(__dirname, '../..', 'public', 'genres.json')
const CACHE = path.join(__dirname, '../..', 'data', 'genres.cache.json')
const BASE = 'https://everynoise.com'
const CONCURRENCY = Number(
  process.argv.find((a) => a.startsWith('--concurrency='))?.split('=')[1] ?? 4,
)
const ENRICH = process.argv.includes('--enrich')
const ENRICH_LIMIT = Number(
  process.argv.find((a) => a.startsWith('--limit='))?.split('=')[1] ?? 0,
)
const DELAY_MS = Number(
  process.argv.find((a) => a.startsWith('--delay='))?.split('=')[1] ?? 120,
)

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

function decodeEntities(s) {
  return s
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&raquo;/g, '')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
}

function parseHomepage(html) {
  const re =
    /<div id=item\d+[^>]*preview_url="([^"]*)"[^>]*class="genre[^"]*"[^>]*style="color:\s*(#[0-9a-fA-F]+);\s*top:\s*(\d+)px;\s*left:\s*(\d+)px;[^"]*"[^>]*onclick="playx\(&quot;([^&]*)&quot;,\s*&quot;([^&]*)&quot;,\s*this\);"[^>]*title="([^"]*)"[^>]*>([\s\S]*?)<a class=navlink href="([^"]+)"/g

  const genres = []
  let m
  while ((m = re.exec(html))) {
    const [
      ,
      previewUrl,
      color,
      top,
      left,
      trackId,
      rawName,
      rawTitle,
      ,
      engemap,
    ] = m
    const name = decodeEntities(rawName)
    const title = decodeEntities(rawTitle)
    // title like: e.g. Demi Lovato "Heart Attack"
    let exampleArtist = null
    let exampleTrack = null
    const tm = title.match(/^e\.g\.\s+(.+?)\s+"([^"]+)"/)
    if (tm) {
      exampleArtist = tm[1]
      exampleTrack = tm[2]
    }

    genres.push({
      id: name.toLowerCase().replace(/\s+/g, '-'),
      name,
      x: Number(left),
      y: Number(top),
      color,
      previewUrl: previewUrl || null,
      trackId,
      exampleArtist,
      exampleTrack,
      engemap,
      playlistUrl: null,
      artists: exampleArtist
        ? [{ name: exampleArtist, id: null }]
        : [],
    })
  }
  return genres
}

function parseEngemap(html, genre) {
  const playlist =
    html.match(/https:\/\/open\.spotify\.com\/playlist\/([a-zA-Z0-9]+)/)?.[1] ??
    null

  const artists = []
  const seen = new Set()
  const artistRe =
    /title="e\.g\.\s+([^"]+?)\s+&quot;[^"]*&quot;"[^>]*>\s*([^<]+)<a class=navlink href="artistprofile\.html\?id=([a-zA-Z0-9]+)"/g
  let m
  while ((m = artistRe.exec(html))) {
    const name = decodeEntities(m[2].trim())
    const id = m[3]
    if (!name || seen.has(id)) continue
    seen.add(id)
    artists.push({ name, id })
    if (artists.length >= 12) break
  }

  // fallback: simpler artist links
  if (artists.length === 0) {
    const simple =
      />([A-Za-z0-9][^<]{0,60})<a class=navlink href="artistprofile\.html\?id=([a-zA-Z0-9]+)"/g
    while ((m = simple.exec(html))) {
      const name = decodeEntities(m[1].trim())
      const id = m[2]
      if (!name || name.length > 60 || seen.has(id)) continue
      seen.add(id)
      artists.push({ name, id })
      if (artists.length >= 12) break
    }
  }

  return {
    playlistUrl: playlist
      ? `https://open.spotify.com/playlist/${playlist}`
      : `https://open.spotify.com/search/${encodeURIComponent(`The Sound of ${genre.name}`)}`,
    artists: artists.length ? artists : genre.artists,
  }
}

async function fetchText(url) {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'vibeflows-scraper/1.0' },
  })
  if (!res.ok) throw new Error(`${res.status} ${url}`)
  return res.text()
}

async function mapPool(items, concurrency, fn) {
  const results = new Array(items.length)
  let i = 0
  async function worker() {
    while (i < items.length) {
      const idx = i++
      results[idx] = await fn(items[idx], idx)
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, () => worker()),
  )
  return results
}

async function main() {
  await mkdir(path.dirname(OUT), { recursive: true })

  let genres
  if (ENRICH && existsSync(OUT)) {
    const payload = JSON.parse(await readFile(OUT, 'utf8'))
    genres = payload.genres ?? payload
    console.log(`Loaded out: ${genres.length} genres`)
  } else if (existsSync(CACHE) && ENRICH) {
    genres = JSON.parse(await readFile(CACHE, 'utf8'))
    console.log(`Loaded cache: ${genres.length} genres`)
  } else {
    console.log('Fetching homepage…')
    const html = await fetchText(`${BASE}/`)
    genres = parseHomepage(html)
    console.log(`Parsed ${genres.length} genres`)
    await writeFile(CACHE, JSON.stringify(genres))
  }

  if (ENRICH) {
    const need = genres.filter(
      (g) => !g.playlistUrl || !g.playlistUrl.includes('/playlist/'),
    )
    const targets =
      ENRICH_LIMIT > 0 ? need.slice(0, ENRICH_LIMIT) : need
    console.log(
      `Enriching ${targets.length} engemap pages (skipping ${genres.length - need.length} done)…`,
    )
    let done = 0
    let fails = 0
    await mapPool(targets, CONCURRENCY, async (g) => {
      await sleep(DELAY_MS)
      try {
        const html = await fetchText(`${BASE}/${g.engemap}`)
        const extra = parseEngemap(html, g)
        g.playlistUrl = extra.playlistUrl
        g.artists = extra.artists
      } catch (e) {
        fails++
        g.playlistUrl =
          g.playlistUrl ||
          `https://open.spotify.com/search/${encodeURIComponent(`The Sound of ${g.name}`)}`
        if (fails <= 20) console.warn('fail', g.name, e.message)
      }
      done++
      if (done % 50 === 0 || done === targets.length) {
        console.log(`${done}/${targets.length} (fails ${fails})`)
        await writeFile(
          OUT,
          JSON.stringify({
            updatedAt: new Date().toISOString(),
            source: 'https://everynoise.com/',
            count: genres.length,
            genres,
          }),
        )
        await writeFile(CACHE, JSON.stringify(genres))
      }
    })
  } else {
    for (const g of genres) {
      g.playlistUrl = `https://open.spotify.com/search/${encodeURIComponent(`The Sound of ${g.name}`)}`
    }
  }

  const payload = {
    updatedAt: new Date().toISOString(),
    source: 'https://everynoise.com/',
    count: genres.length,
    genres,
  }
  await writeFile(OUT, JSON.stringify(payload))
  console.log(`Wrote ${OUT} (${genres.length} genres)`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
