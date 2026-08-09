/**
 * Gentle Wikipedia fetch with opensearch + cache resume.
 * Usage: node scripts/fetch-wiki-descriptions.mjs
 */
import { readFile, writeFile, mkdir, rename, open } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '../..')
const GENRES = path.join(ROOT, 'public', 'genres.json')
const outArg = process.argv
  .find((a) => a.startsWith('--out='))
  ?.slice('--out='.length)
const OUT = path.join(
  ROOT,
  outArg || path.join('public', 'genre-descriptions.json'),
)
const CACHE = path.join(ROOT, 'data', 'wiki-cache.json')
const LOCK = path.join(ROOT, 'data', 'wiki-fetch.lock')

const UA =
  'vibeflows/1.0 (genre catalog; Wikipedia summaries)'
const CONCURRENCY = 2
const DELAY = 350
const LIMIT = Number(
  process.argv.find((a) => a.startsWith('--limit='))?.split('=')[1] ?? 0,
)

async function atomicWrite(file, data) {
  const tmp = `${file}.${process.pid}.tmp`
  await writeFile(tmp, data)
  await rename(tmp, file)
}

async function acquireLock() {
  await mkdir(path.dirname(LOCK), { recursive: true })
  try {
    const fh = await open(LOCK, 'wx')
    await fh.writeFile(String(process.pid))
    await fh.close()
    return true
  } catch (e) {
    if (e && e.code === 'EEXIST') {
      const holder = existsSync(LOCK) ? (await readFile(LOCK, 'utf8')).trim() : '?'
      console.error(
        `Another wiki fetch holds ${LOCK} (pid ${holder}). Stop it first, or delete the lock if stale.`,
      )
      return false
    }
    throw e
  }
}

async function releaseLock() {
  try {
    const { unlink } = await import('node:fs/promises')
    await unlink(LOCK)
  } catch {
    /* ignore */
  }
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

function shorten(text, max = 340) {
  const clean = text.replace(/\s+/g, ' ').trim()
  if (clean.length <= max) return clean
  const cut = clean.slice(0, max)
  const lastStop = Math.max(
    cut.lastIndexOf('. '),
    cut.lastIndexOf('! '),
    cut.lastIndexOf('? '),
  )
  if (lastStop > 120) return cut.slice(0, lastStop + 1).trim()
  return `${cut.trim()}…`
}

function isUseful(genreName, page) {
  if (!page?.extract || page.extract.length < 60) return false
  if (page.type === 'disambiguation') return false
  const title = (page.title || '').toLowerCase()
  const extract = page.extract.toLowerCase()
  const g = genreName.toLowerCase()

  const generic = new Set([
    'music',
    'electronic music',
    'popular music',
    'rock music',
    'pop music',
    'anime',
    'japan',
    'hip hop',
    'rock (disambiguation)',
  ])
  // allow exact genre match even if also a broad term
  if (generic.has(title) && title !== g && !g.includes(title)) return false

  // avoid "Pop music in Ukraine" style pages for bare "pop"
  if (/music in |music of |list of /.test(title) && !g.includes(' ')) {
    const base = title.split(' music')[0]
    if (base && !g.includes(base) && !title.startsWith(g)) return false
  }
  if (/^pop music in /.test(title) && g === 'pop') return false
  if (/automation|algorithm/.test(title) && g === 'pop') return false
  if (/animation originating/.test(extract) && !g.includes('anime')) return false
  if (g === 'anime' && /animation originating from japan|japanese animation/.test(extract) && !/theme|ost|soundtrack|j-?pop/.test(extract)) {
    return false
  }

  const tokens = g.split(/[\s/:_-]+/).filter((t) => t.length > 2)
  const hit =
    tokens.some((t) => title.includes(t) || extract.startsWith(t) || extract.includes(` ${t}`)) ||
    title.includes(g) ||
    extract.includes(g)

  const musicCue =
    /music|genre|style|subgenre|hip-?hop|metal|jazz|techno|house|rap|rock|pop|punk|folk|ambient|wave|synth|electronic|musica|музыка|жанр|стиль|поджанр/.test(
      `${title} ${extract}`,
    )

  if (title === 'anime' && g !== 'anime') return false
  return hit && musicCue
}

async function wikiSummary(lang, title) {
  const url = `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`
  const res = await fetch(url, {
    headers: { 'Api-User-Agent': UA, 'User-Agent': UA, Accept: 'application/json' },
  })
  if (res.status === 429) {
    await sleep(5000)
    return wikiSummary(lang, title)
  }
  if (!res.ok) return null
  const j = await res.json()
  if (j.type === 'disambiguation' || !j.extract) return null
  return {
    title: j.title,
    extract: j.extract,
    type: j.type,
    lang,
    source:
      j.content_urls?.desktop?.page ||
      `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(j.title)}`,
  }
}

async function openSearch(lang, q) {
  const url = `https://${lang}.wikipedia.org/w/api.php?action=opensearch&search=${encodeURIComponent(q)}&limit=6&namespace=0&format=json`
  const res = await fetch(url, {
    headers: { 'Api-User-Agent': UA, 'User-Agent': UA, Accept: 'application/json' },
  })
  if (res.status === 429) {
    await sleep(5000)
    return openSearch(lang, q)
  }
  if (!res.ok) return []
  const j = await res.json()
  return Array.isArray(j?.[1]) ? j[1] : []
}

function titleCase(name) {
  return name
    .split(' ')
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(' ')
}

async function describeOne(name, cache) {
  // Caller already decided this name needs a fetch.
  for (const lang of ['ru', 'en']) {
    const queries = [
      `${name} music`,
      `${titleCase(name)} (music)`,
      name,
      titleCase(name),
    ]
    const titles = new Set()
    for (const q of queries) {
      for (const t of await openSearch(lang, q)) titles.add(t)
      await sleep(DELAY)
    }
    // also try direct
    titles.add(name)
    titles.add(titleCase(name))
    titles.add(`${titleCase(name)} (music genre)`)

    for (const title of titles) {
      const page = await wikiSummary(lang, title)
      await sleep(DELAY)
      if (!page || !isUseful(name, page)) continue
      const entry = {
        text: shorten(page.extract),
        lang: page.lang,
        wikiTitle: page.title,
        source: page.source,
      }
      cache[name] = entry
      return entry
    }
  }

  cache[name] = { text: null }
  return cache[name]
}

async function mapPool(items, concurrency, fn) {
  const out = new Array(items.length)
  let i = 0
  async function worker() {
    while (i < items.length) {
      const idx = i++
      out[idx] = await fn(items[idx], idx)
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, () => worker()),
  )
  return out
}

async function flush(cache, allNames) {
  // Merge disk cache so concurrent/stale writers cannot wipe seed/wiki hits
  let diskCache = {}
  if (existsSync(CACHE)) {
    try {
      diskCache = JSON.parse(await readFile(CACHE, 'utf8'))
    } catch {
      diskCache = {}
    }
  }
  for (const [k, v] of Object.entries(diskCache)) {
    if (!cache[k]?.text && v?.text) cache[k] = v
    else if (!cache[k]) cache[k] = v
  }

  let existingOut = { descriptions: {} }
  if (existsSync(OUT)) {
    try {
      existingOut = JSON.parse(await readFile(OUT, 'utf8'))
    } catch {
      existingOut = { descriptions: {} }
    }
  }

  const isSeed = (src = '') => String(src).startsWith('seed')
  const looksRu = (t = '') => /[А-Яа-яЁё]/.test(t)
  const descriptions = { ...(existingOut.descriptions || {}) }
  for (const name of allNames) {
    const e = cache[name]
    if (!e?.text) continue
    const prev = descriptions[name]
    // Never let a wiki hit overwrite a hand seed
    if (prev && isSeed(prev.source) && !isSeed(e.source)) continue
    // Prefer Russian blurbs in the public file
    if (prev && looksRu(prev.text) && !looksRu(e.text)) continue
    if (!looksRu(e.text) && !isSeed(e.source)) continue
    descriptions[name] = {
      text: e.text,
      lang: e.lang,
      source: e.source,
    }
  }

  // Drop known bad Wikipedia mismatches
  const bad = (t = '') => {
    const s = t.toLowerCase()
    return (
      s.includes('popes of the catholic') ||
      s.includes('pop music in ukraine') ||
      s.includes('22-volume series issued by time-life') ||
      s.includes('animation originating from japan') ||
      s.includes('pop music automation')
    )
  }
  for (const [k, v] of Object.entries(descriptions)) {
    if (bad(v?.text) && !isSeed(v?.source)) delete descriptions[k]
    // UI expects Russian descriptions
    if (v?.text && !looksRu(v.text) && !isSeed(v?.source)) delete descriptions[k]
  }

  const ok = Object.keys(descriptions).length
  await atomicWrite(CACHE, JSON.stringify(cache))
  await atomicWrite(
    OUT,
    JSON.stringify({
      updatedAt: new Date().toISOString(),
      count: ok,
      descriptions,
    }),
  )
  return ok
}

async function main() {
  if (!(await acquireLock())) process.exit(1)
  try {
    await mkdir(path.dirname(CACHE), { recursive: true })
    const payload = JSON.parse(await readFile(GENRES, 'utf8'))
    const allNames = payload.genres.map((g) => g.name)
    let names = allNames
    if (LIMIT > 0) names = names.slice(0, LIMIT)

    const cache = existsSync(CACHE)
      ? JSON.parse(await readFile(CACHE, 'utf8'))
      : {}

    const retry = process.argv.includes('--retry')
    // Prefer Russian: retry missing and English-only cache hits
    const hasRu = (e) =>
      Boolean(e?.text) &&
      (e.lang === 'ru' || /[А-Яа-яЁё]/.test(String(e.text)))
    const pending = names.filter((n) => {
      const e = cache[n]
      if (hasRu(e)) return false
      if (retry) return true
      return e === undefined
    })
    console.log(
      `Total ${names.length}, pending ${pending.length}, already good ${Object.values(cache).filter((x) => x?.text).length}`,
    )

    let done = 0
    let hits = 0
    await mapPool(pending, CONCURRENCY, async (name) => {
      const entry = await describeOne(name, cache)
      if (entry.text) hits++
      done++
      if (done % 25 === 0 || done === pending.length) {
        const ok = await flush(cache, allNames)
        console.log(`${done}/${pending.length} runHits=${hits} totalWiki=${ok}`)
      }
    })

    const ok = await flush(cache, allNames)
    console.log(`Done. Wrote ${OUT} with ${ok} descriptions`)
  } finally {
    await releaseLock()
  }
}

main().catch(async (e) => {
  console.error(e)
  await releaseLock()
  process.exit(1)
})
