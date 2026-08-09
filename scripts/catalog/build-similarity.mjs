/**
 * Analyze genre similarity signals and build relatedness index.
 * Signals: shared artists, name tokens, map distance (weak).
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '../..')
const GENRES = path.join(ROOT, 'public', 'genres.json')
const OUT = path.join(ROOT, 'public', 'similarity.json')

const STOP = new Set([
  'a',
  'an',
  'the',
  'of',
  'and',
  'in',
  'on',
  'for',
  'to',
  'de',
  'la',
  'el',
  'y',
  'e',
  'da',
  'do',
  'di',
  'du',
  'des',
  'les',
  'von',
  'van',
  'new',
  'old',
  'modern',
  'classic',
  'deep',
  'early',
  'late',
  'post',
  'neo',
  'nu',
  'alt',
  'indie',
  'pop', // too broad alone — still useful with other tokens
])

function tokens(name) {
  return name
    .toLowerCase()
    .replace(/[:/(),.+\-–—]/g, ' ')
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 1 && !STOP.has(t) && !/^\d+$/.test(t))
}

function jaccard(a, b) {
  if (!a.size || !b.size) return 0
  let inter = 0
  for (const x of a) if (b.has(x)) inter++
  return inter / (a.size + b.size - inter)
}

const payload = JSON.parse(await readFile(GENRES, 'utf8'))
const genres = payload.genres
const byId = new Map(genres.map((g) => [g.id, g]))

// artist -> genre ids
const artistIndex = new Map()
for (const g of genres) {
  for (const a of g.artists ?? []) {
    if (!a.id) continue
    if (!artistIndex.has(a.id)) artistIndex.set(a.id, [])
    artistIndex.get(a.id).push(g.id)
  }
}

const tokenSets = new Map(
  genres.map((g) => [g.id, new Set(tokens(g.name))]),
)

const xs = genres.map((g) => g.x)
const ys = genres.map((g) => g.y)
const minX = Math.min(...xs)
const maxX = Math.max(...xs)
const minY = Math.min(...ys)
const maxY = Math.max(...ys)
const spanX = Math.max(1, maxX - minX)
const spanY = Math.max(1, maxY - minY)

function mapDist(a, b) {
  const dx = (a.x - b.x) / spanX
  const dy = (a.y - b.y) / spanY
  return Math.hypot(dx, dy)
}

function scorePair(a, b) {
  // shared artists
  const aArt = new Set((a.artists ?? []).map((x) => x.id).filter(Boolean))
  const bArt = new Set((b.artists ?? []).map((x) => x.id).filter(Boolean))
  let shared = 0
  for (const id of aArt) if (bArt.has(id)) shared++
  const artistScore =
    shared === 0 ? 0 : Math.min(1, shared / 3) * 0.55 + (shared >= 1 ? 0.15 : 0)

  const tok = jaccard(tokenSets.get(a.id), tokenSets.get(b.id))
  const tokenScore = tok * 0.35

  // map is weak — only a small nudge when already somewhat related
  const md = mapDist(a, b)
  const mapScore = md < 0.08 ? (1 - md / 0.08) * 0.12 : 0

  // prefix / contains boost: "death metal" in both
  let contain = 0
  const an = a.name.toLowerCase()
  const bn = b.name.toLowerCase()
  if (an.includes(bn) || bn.includes(an)) contain = 0.25
  else {
    const longer = an.length >= bn.length ? an : bn
    const shorter = an.length >= bn.length ? bn : an
    if (shorter.length >= 5 && longer.includes(shorter)) contain = 0.2
  }

  return artistScore + tokenScore + mapScore + contain
}

// Build top-N related for each genre (candidate gen via inverted indexes)
const TOP = 12
const related = {}

let i = 0
for (const g of genres) {
  i++
  if (i % 500 === 0) console.log(`scoring ${i}/${genres.length}`)

  const candidates = new Map() // id -> reason bump

  // from shared artists
  for (const a of g.artists ?? []) {
    if (!a.id) continue
    for (const otherId of artistIndex.get(a.id) ?? []) {
      if (otherId === g.id) continue
      candidates.set(otherId, (candidates.get(otherId) ?? 0) + 1)
    }
  }

  // from shared tokens
  const toks = tokenSets.get(g.id)
  if (toks.size) {
    for (const other of genres) {
      if (other.id === g.id) continue
      const ot = tokenSets.get(other.id)
      let hit = false
      for (const t of toks) {
        if (ot.has(t)) {
          hit = true
          break
        }
      }
      if (hit) candidates.set(other.id, (candidates.get(other.id) ?? 0) + 0.01)
    }
  }

  // if too few candidates, add map neighbors
  if (candidates.size < 20) {
    const near = genres
      .filter((o) => o.id !== g.id)
      .map((o) => ({ id: o.id, d: mapDist(g, o) }))
      .sort((a, b) => a.d - b.d)
      .slice(0, 30)
    for (const n of near) candidates.set(n.id, candidates.get(n.id) ?? 0)
  }

  const scored = []
  for (const id of candidates.keys()) {
    const other = byId.get(id)
    if (!other) continue
    const s = scorePair(g, other)
    if (s <= 0.05) continue
    scored.push({ id, s })
  }
  scored.sort((a, b) => b.s - a.s)
  related[g.id] = scored.slice(0, TOP).map((x) => x.id)
}

// Demo print for a few genres
function show(name) {
  const g = genres.find((x) => x.name === name)
  if (!g) return
  console.log('\n', name, '→')
  for (const id of related[g.id] ?? []) {
    console.log('  ', byId.get(id)?.name)
  }
}

show('vaporwave')
show('black metal')
show('drill')
show('bossa nova')
show('hyperpop')

await mkdir(path.dirname(OUT), { recursive: true })
await writeFile(
  OUT,
  JSON.stringify({
    updatedAt: new Date().toISOString(),
    method: 'artists+name-tokens+weak-map',
    related,
  }),
)
console.log('\nWrote', OUT, 'keys', Object.keys(related).length)
