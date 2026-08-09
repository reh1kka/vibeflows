/**
 * Multilingual genre blurbs from Wikipedia (and a translation fallback for seeds).
 *
 *   node scripts/fetch-wiki-multilang.mjs
 *   node scripts/fetch-wiki-multilang.mjs --limit=400 --retry
 */
import { readFile, writeFile, mkdir, rename, open } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '../..')
const GENRES = path.join(ROOT, 'public', 'genres.json')
const OUT = path.join(ROOT, 'public', 'genre-descriptions.json')
const CACHE = path.join(ROOT, 'data', 'wiki-multilang-cache.json')
const LOCK = path.join(ROOT, 'data', 'wiki-multilang.lock')

const LOCALES = ['en', 'uk', 'ru', 'pl', 'th', 'zh']
const WIKI_LANG = {
  en: 'en',
  uk: 'uk',
  ru: 'ru',
  pl: 'pl',
  th: 'th',
  zh: 'zh',
}

const UA =
  'vibeflows/1.0 (genre catalog; multilingual Wikipedia summaries)'
const CONCURRENCY = 2
const DELAY = 400
const LIMIT = Number(
  process.argv.find((a) => a.startsWith('--limit='))?.split('=')[1] ?? 500,
)
const RETRY = process.argv.includes('--retry')

// Hand Russian seeds (source of truth for common tags)
const SEED_RU = {
  pop: 'Поп — массовая популярная музыка с цепкими мелодиями, куплет‑припевной формой и продакшном, рассчитанным на радио и стриминг.',
  anime:
    'Как ярлык Spotify, «anime» обычно указывает на саундтреки и тематические песни японской анимации, а также смежные J‑pop/рок‑кроссоверы.',
  vaporwave:
    'Vaporwave — интернет‑микрожанр начала 2010‑х: нарезанные и замедленные сэмплы лаунжа, «лифтового» попа и корпоративной музыки 1980–90‑х.',
  hyperpop:
    'Hyperpop — электронно‑поп направление 2010‑х: максимализм, глянцевые и питч‑сдвинутые вокалы, хаотичный интернет‑продакшн.',
  'black metal':
    'Блэк‑метал — экстремальный метал с быстрыми темпами, скримом, сильно искажёнными гитарами и сырым атмосферным звучанием.',
  dubstep:
    'Дабстеп — британский электронный танцевальный стиль начала 2000‑х: разреженный ритм, тяжёлый бас и характерный wobble‑bass.',
  shoegaze:
    'Шугейз — альтернативный рок конца 1980‑х / начала 1990‑х с размытым вокалом, стенами гитарных эффектов и погружающей фактурой.',
  synthwave:
    'Синтвейв — ретро‑электроника в духе саундтреков фильмов и игр 1980‑х: аналоговые синтезаторы, неон и драйвовый бит.',
  phonk:
    'Фонк смешивает хип‑хоп с сэмплами мемфис‑рэпа 1990‑х — ковбеллы, искажённый бас и лоу‑фай‑шершавость.',
  'k-pop':
    'K‑pop — южнокорейская популярная музыка: полированный поп, хип‑хоп и электроника плюс жёсткая хореография айдол‑групп.',
  'hip hop':
    'Хип‑хоп — культура и музыка 1970‑х Нью‑Йорка вокруг рэпа, диджеинга, брейков, а позже студийного продакшна и сэмплирования.',
  drill:
    'Дрилл — хип‑хоп с тёмными скользящими 808 и жёсткой подачей; начался в Чикаго и позже разветвился в UK и другие сцены.',
  ambient:
    'Эмбиент делает ставку на атмосферу и тон, а не на привычную песенную форму — просторно и погружающе.',
  techno:
    'Техно — электронная танцевальная музыка из Детройта: повторяющиеся машинные ритмы и длинный клубный драйв.',
  house:
    'Хаус родился в Чикаго 1980‑х: бит four‑on‑the‑floor, соул/вокальные хуки и клубный грув.',
  jazz:
    'Джаз вырос из афроамериканских традиций: свинг, импровизация, блю‑ноты и эволюция стилей.',
  reggae:
    'Регги сложился на Ямайке в конце 1960‑х: акценты на слабые доли, бас впереди и культура саунд‑систем.',
  trap:
    'Трэп — хип‑хоп с чёткими хэтами, грохочущими 808 и южными корнями США.',
  punk:
    'Панк — быстрый сырой рок и культура 1970‑х: короткие песни, DIY и антисистемный настрой.',
  'post-punk':
    'Постпанк пошёл дальше панка: угловатый бас, атмосфера и art‑school края. Постсоветская волна добавила холодные синтезаторы и ночной городской вайб. Это любимый жанр создателя приложения.',
  'dream pop':
    'Dream pop любит туманный вокал, гитары в ревербе и мягкий фокус — больше настроения и фактуры, чем острых хуков.',
  grime:
    'Грайм — британский электронный/рэп стиль начала 2000‑х из Восточного Лондона: рваная синкопа, MC и агрессивные биты.',
  'lo-fi':
    'Лоу‑фай как ярлык — тёплая «неидеальная» музыка: шипение ленты, мягкий бит и намеренная шероховатость.',
  afrobeats:
    'Afrobeats — современный западноафриканский поп‑континуум: хайлайф, хип‑хоп и танцевальные ритмы.',
  amapiano:
    'Amapiano — южноафриканский стиль из хауса: пышные log‑drums, широкий бас и расслабленные аранжировки.',
  reggaeton:
    'Реггетон соединяет латинские ритмы с влиянием хип‑хопа и дэнсхолла вокруг dembow‑бита.',
  'drum and bass':
    'Drum and bass — британская электроника на быстрых брейкбитах, тяжёлом басе и клубной энергии.',
  'new wave':
    'New wave — поп‑рок конца 1970‑х / начала 1980‑х после панка: синтезаторы, угловатые гитары и стильный продакшн.',
  industrial:
    'Индастриал использует абразивный шум, механические ритмы и конфронтационную эстетику.',
  breakcore:
    'Breakcore — экстремальная электроника на нарезанных Amen‑брейках, хаотичных эдитах и высоком BPM.',
  rage:
    'Rage — trap‑смежный интернет‑стиль с искажёнными 808, кричащими хуками и гипер‑агрессивной энергией.',
  classical:
    'Классическая музыка — академическая традиция западного искусства: оркестровка, форма и долгие развития тем, в отличие от поп‑ и фолк‑музыки. На Spotify ярлык «classical» охватывает барокко, классицизм, романтизм и современную академическую музыку.',
  rock: 'Рок — направление популярной музыки с характерным ритмом и гитарным драйвом, выросшее из рок‑н‑ролла.',
  rap: 'Рэп — вокальная подача с рифмой и ритмичной речью, обычно поверх бита; ключевая часть хип‑хоп культуры.',
}

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
    if (e?.code === 'EEXIST') {
      console.error('Lock held:', LOCK)
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
  const clean = String(text || '')
    .replace(/\s+/g, ' ')
    .trim()
  if (clean.length <= max) return clean
  const cut = clean.slice(0, max)
  const lastStop = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('! '))
  if (lastStop > 100) return cut.slice(0, lastStop + 1).trim()
  return `${cut.trim()}…`
}

function titleCase(name) {
  return name
    .split(' ')
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(' ')
}

function isUseful(genreName, page) {
  if (!page?.extract || page.extract.length < 60) return false
  if (page.type === 'disambiguation') return false
  const title = (page.title || '').toLowerCase()
  const extract = page.extract.toLowerCase()
  const g = genreName.toLowerCase()
  if (/music in |list of |automation/.test(title) && !g.includes(' ')) return false
  if (/pop music automation/.test(extract)) return false
  if (/animation originating from japan/.test(extract) && g === 'anime') return false
  // Reject album / single / tour pages mistaken for genre names
  if (
    /\b(studio album|debut album|live album|compilation album|single by|song by|concert tour)\b/.test(
      extract,
    ) ||
    /(студийный|сольный студийный|дебютный|концертный)\s+альбом|сингл (группы|певца|певицы|с альбома)|концертный тур|песня (американск|британск|группы)/.test(
      extract,
    )
  ) {
    return false
  }
  const musicCue =
    /music|genre|style|hip-?hop|metal|jazz|techno|house|rap|rock|pop|punk|folk|ambient|wave|synth|electronic|musica|музыка|жанр|стиль|muzyka|gatunek|ดนตรี|音乐|流派/.test(
      `${title} ${extract}`,
    )
  return musicCue
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
    source:
      j.content_urls?.desktop?.page ||
      `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(j.title)}`,
  }
}

async function openSearch(lang, q) {
  const url = `https://${lang}.wikipedia.org/w/api.php?action=opensearch&search=${encodeURIComponent(q)}&limit=5&namespace=0&format=json`
  const res = await fetch(url, {
    headers: { 'Api-User-Agent': UA, 'User-Agent': UA },
  })
  if (res.status === 429) {
    await sleep(5000)
    return openSearch(lang, q)
  }
  if (!res.ok) return []
  const j = await res.json()
  return Array.isArray(j?.[1]) ? j[1] : []
}

async function describeLang(name, locale, cacheEntry) {
  if (cacheEntry?.byLang?.[locale]?.text) return cacheEntry.byLang[locale]
  const lang = WIKI_LANG[locale]
  const titles = new Set()
  for (const q of [`${name} music`, `${titleCase(name)} (music)`, name, titleCase(name)]) {
    for (const t of await openSearch(lang, q)) titles.add(t)
    await sleep(DELAY)
  }
  titles.add(name)
  titles.add(titleCase(name))
  titles.add(`${titleCase(name)} (music)`)
  for (const title of titles) {
    const page = await wikiSummary(lang, title)
    await sleep(DELAY)
    if (!page || !isUseful(name, page)) continue
    return { text: shorten(page.extract), source: page.source }
  }
  return null
}

async function translate(text, from, to) {
  if (from === to) return text
  const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text.slice(0, 450))}&langpair=${from}|${to}`
  try {
    const res = await fetch(url, { headers: { 'User-Agent': UA } })
    if (!res.ok) return null
    const j = await res.json()
    const out = j?.responseData?.translatedText
    if (!out || /INVALID|QUERY LENGTH|MYMEMORY WARNING/i.test(out)) return null
    return shorten(out)
  } catch {
    return null
  }
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

function migrateOld(descriptions) {
  const next = {}
  for (const [k, v] of Object.entries(descriptions || {})) {
    if (v?.byLang) {
      next[k] = v
      continue
    }
    if (v?.text) {
      const lang = v.lang && LOCALES.includes(v.lang) ? v.lang : 'ru'
      next[k] = {
        byLang: {
          [lang]: { text: v.text, source: v.source },
        },
      }
    }
  }
  return next
}

async function flush(cache, allNames) {
  let existing = { descriptions: {} }
  if (existsSync(OUT)) {
    try {
      existing = JSON.parse(await readFile(OUT, 'utf8'))
    } catch {
      existing = { descriptions: {} }
    }
  }
  const descriptions = migrateOld(existing.descriptions)
  for (const name of allNames) {
    const e = cache[name]
    if (!e?.byLang) continue
    descriptions[name] = {
      byLang: { ...(descriptions[name]?.byLang || {}), ...e.byLang },
    }
  }
  // ensure seeds
  for (const [name, ru] of Object.entries(SEED_RU)) {
    descriptions[name] = descriptions[name] || { byLang: {} }
    descriptions[name].byLang = descriptions[name].byLang || {}
    descriptions[name].byLang.ru = {
      text: ru,
      source: 'seed/ru',
    }
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

async function fillSeeds(cache) {
  for (const [name, ru] of Object.entries(SEED_RU)) {
    cache[name] = cache[name] || { byLang: {} }
    cache[name].byLang = cache[name].byLang || {}
    cache[name].byLang.ru = { text: ru, source: 'seed/ru' }
    for (const locale of LOCALES) {
      if (locale === 'ru') continue
      if (cache[name].byLang[locale]?.text) continue
      // try wiki first
      const wiki = await describeLang(name, locale, { byLang: {} })
      if (wiki?.text) {
        cache[name].byLang[locale] = wiki
        continue
      }
      const translated = await translate(ru, 'ru', locale === 'zh' ? 'zh-CN' : locale)
      await sleep(300)
      if (translated) {
        cache[name].byLang[locale] = {
          text: translated,
          source: 'seed/translate',
        }
      }
    }
  }
}

async function main() {
  if (!(await acquireLock())) process.exit(1)
  try {
    await mkdir(path.dirname(CACHE), { recursive: true })
    const payload = JSON.parse(await readFile(GENRES, 'utf8'))
    const allNames = payload.genres.map((g) => g.name)
    const names = LIMIT > 0 ? allNames.slice(0, LIMIT) : allNames
    const cache = existsSync(CACHE)
      ? JSON.parse(await readFile(CACHE, 'utf8'))
      : {}

    // migrate any old OUT into cache
    if (existsSync(OUT)) {
      const old = JSON.parse(await readFile(OUT, 'utf8'))
      const migrated = migrateOld(old.descriptions)
      for (const [k, v] of Object.entries(migrated)) {
        cache[k] = cache[k] || { byLang: {} }
        cache[k].byLang = { ...(cache[k].byLang || {}), ...(v.byLang || {}) }
      }
    }

    console.log('Seeding multilingual blurbs…')
    await fillSeeds(cache)
    await flush(cache, allNames)

    const pending = names.filter((n) => {
      const e = cache[n]
      const have = LOCALES.filter((l) => e?.byLang?.[l]?.text).length
      if (have >= 3 && !RETRY) return false
      if (have >= LOCALES.length) return false
      return true
    })
    console.log(`Wiki pass: ${pending.length}/${names.length}`)

    let done = 0
    let hits = 0
    await mapPool(pending, CONCURRENCY, async (name) => {
      cache[name] = cache[name] || { byLang: {} }
      cache[name].byLang = cache[name].byLang || {}
      for (const locale of LOCALES) {
        if (cache[name].byLang[locale]?.text && !RETRY) continue
        const blurb = await describeLang(name, locale, cache[name])
        if (blurb?.text) {
          cache[name].byLang[locale] = blurb
          hits++
        }
      }
      done++
      if (done % 10 === 0 || done === pending.length) {
        const ok = await flush(cache, allNames)
        console.log(`${done}/${pending.length} runHits=${hits} total=${ok}`)
      }
    })

    const ok = await flush(cache, allNames)
    console.log(`Done. Wrote ${OUT} with ${ok} genres`)
  } finally {
    await releaseLock()
  }
}

main().catch(async (e) => {
  console.error(e)
  await releaseLock()
  process.exit(1)
})
