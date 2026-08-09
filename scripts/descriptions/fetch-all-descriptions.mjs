/**
 * Fetch and merge genre descriptions for the full catalog.
 * Phase A: local blurbs for every genre
 * Phase B: Wikipedia (ru/en) + Last.fm, then other locales
 *
 * node scripts/fetch-all-descriptions.mjs
 * node scripts/fetch-all-descriptions.mjs --wiki-only
 * node scripts/fetch-all-descriptions.mjs --limit=100
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
const CACHE = path.join(ROOT, 'data', 'desc-fetch-cache.json')
const LOCK = path.join(ROOT, 'data', 'desc-fetch.lock')
const LOG = path.join(ROOT, 'data', 'desc-fetch.log')

const LOCALES = ['ru', 'en', 'uk', 'pl', 'th', 'zh']
const WIKI = { ru: 'ru', en: 'en', uk: 'uk', pl: 'pl', th: 'th', zh: 'zh' }
const PRIMARY = ['ru', 'en']
const SECONDARY = ['uk', 'pl', 'th', 'zh']
const UA = 'vibeflows/1.2 (genre catalog descriptions)'
const DELAY = 220
const CONCURRENCY = 4
const LIMIT = Number(
  process.argv.find((a) => a.startsWith('--limit='))?.split('=')[1] ?? 0,
)
const RETRY = process.argv.includes('--retry')
const WIKI_ONLY = process.argv.includes('--wiki-only')

const SEED_RU = {
  pop: 'Поп — массовая популярная музыка с цепкими мелодиями, куплет‑припевной формой и продакшном, рассчитанным на радио и стриминг.',
  'post-punk':
    'Постпанк пошёл дальше панка: угловатый бас, атмосфера и art‑school края. Постсоветская волна добавила холодные синтезаторы и ночной городской вайб. Это любимый жанр создателя приложения.',
  vaporwave:
    'Vaporwave — интернет‑микрожанр начала 2010‑х: нарезанные и замедленные сэмплы лаунжа и корпоративной музыки 1980–90‑х.',
  hyperpop:
    'Hyperpop — электронно‑поп направление 2010‑х: максимализм, глянцевые и питч‑сдвинутые вокалы, хаотичный интернет‑продакшн.',
  phonk:
    'Фонк смешивает хип‑хоп с сэмплами мемфис‑рэпа 1990‑х — ковбеллы, искажённый бас и лоу‑фай‑шершавость.',
  shoegaze:
    'Шугейз — альтернативный рок с размытым вокалом, стенами гитарных эффектов и погружающей фактурой.',
  synthwave:
    'Синтвейв — ретро‑электроника в духе саундтреков 1980‑х: синтезаторы, неон и драйвовый бит.',
  rock: 'Рок — направление популярной музыки с характерным ритмом и гитарным драйвом, выросшее из рок‑н‑ролла.',
  rap: 'Рэп — вокальная подача с рифмой и ритмичной речью, обычно поверх бита; ключевая часть хип‑хоп культуры.',
  'hip hop':
    'Хип‑хоп — культура и музыка 1970‑х Нью‑Йорка вокруг рэпа, диджеинга, брейков и позже студийного продакшна.',
  techno:
    'Техно — электронная танцевальная музыка из Детройта: повторяющиеся машинные ритмы и длинный клубный драйв.',
  house:
    'Хаус родился в Чикаго 1980‑х: бит four‑on‑the‑floor, соул/вокальные хуки и клубный грув.',
  jazz:
    'Джаз вырос из афроамериканских традиций: свинг, импровизация, блю‑ноты и эволюция стилей.',
  punk:
    'Панк — быстрый сырой рок и культура 1970‑х: короткие песни, DIY и антисистемный настрой.',
  trap:
    'Трэп — хип‑хоп с чёткими хэтами, грохочущими 808 и южными корнями США.',
  drill:
    'Дрилл — хип‑хоп с тёмными скользящими 808 и жёсткой подачей; начался в Чикаго и позже разветвился в UK.',
  ambient:
    'Эмбиент делает ставку на атмосферу и тон, а не на привычную песенную форму.',
  dubstep:
    'Дабстеп — британский электронный танцевальный стиль начала 2000‑х: разреженный ритм и тяжёлый бас.',
  'k-pop':
    'K‑pop — южнокорейская популярная музыка: полированный поп, хип‑хоп и электроника плюс хореография айдол‑групп.',
  reggae:
    'Регги сложился на Ямайке в конце 1960‑х: акценты на слабые доли, бас впереди и культура саунд‑систем.',
  'dream pop':
    'Dream pop любит туманный вокал, гитары в ревербе и мягкий фокус — больше настроения, чем острых хуков.',
  'new wave':
    'New wave — поп‑рок конца 1970‑х / начала 1980‑х после панка: синтезаторы и угловатые гитары.',
  industrial:
    'Индастриал использует абразивный шум, механические ритмы и конфронтационную эстетику.',
  grime:
    'Грайм — британский электронный/рэп стиль начала 2000‑х из Восточного Лондона.',
  'lo-fi':
    'Лоу‑фай как ярлык — тёплая «неидеальная» музыка: шипение ленты, мягкий бит и шероховатость.',
  afrobeats:
    'Afrobeats — современный западноафриканский поп‑континуум: хайлайф, хип‑хоп и танцевальные ритмы.',
  amapiano:
    'Amapiano — южноафриканский стиль из хауса: пышные log‑drums и широкий бас.',
  reggaeton:
    'Реггетон соединяет латинские ритмы с влиянием хип‑хопа и дэнсхолла вокруг dembow‑бита.',
  'drum and bass':
    'Drum and bass — британская электроника на быстрых брейкбитах и тяжёлом басе.',
  'black metal':
    'Блэк‑метал — экстремальный метал с быстрыми темпами, скримом и сырым атмосферным звучанием.',
  breakcore:
    'Breakcore — экстремальная электроника на нарезанных Amen‑брейках, хаотичных эдитах и высоком BPM.',
  rage:
    'Rage — trap‑смежный интернет‑стиль с искажёнными 808, кричащими хуками и гипер‑агрессивной энергией.',
}

const SEED_EN = {
  pop: 'Pop is mainstream popular music with catchy melodies, verse–chorus forms and production aimed at radio and streaming.',
  'post-punk':
    'Post-punk pushed past punk with angular bass, atmosphere and art-school edges. The postsoviet wave added cold synths and late-night city mood. This is the app creator’s favorite genre.',
  vaporwave:
    'Vaporwave is an early-2010s internet microgenre of chopped, slowed lounge and 1980s–90s corporate mood samples.',
  hyperpop:
    'Hyperpop is a 2010s electronic-pop movement: maximalist, glossy, pitch-shifted vocals and chaotic internet-native production.',
  phonk:
    'Phonk blends hip-hop with 1990s Memphis rap samples—cowbells, distorted bass and lo-fi grit.',
  shoegaze:
    'Shoegaze is alternative rock with washed-out vocals, walls of guitar effects and immersive texture.',
  synthwave:
    'Synthwave is retro electronic music evoking 1980s film and game scores.',
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

function hash(s) {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
  return h
}

function pick(arr, seed) {
  if (!arr?.length) return ''
  // >>> 0: arithmetic >> on large hashes can go negative → arr[-n] === undefined
  return arr[(Number(seed) >>> 0) % arr.length]
}

function shorten(text, max = 340) {
  const clean = String(text || '')
    .replace(/\s+/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .trim()
  if (clean.length <= max) return clean
  const cut = clean.slice(0, max)
  const lastStop = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('! '))
  if (lastStop > 100) return cut.slice(0, lastStop + 1).trim()
  return `${cut.trim()}…`
}

function titleCase(name) {
  return name
    .split(/[\s/-]+/)
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(' ')
}

function tokens(name) {
  return String(name)
    .toLowerCase()
    .split(/[\s/_-]+/)
    .filter((t) => t.length > 1)
}

function artistLine(genre, seed, lang) {
  const artists = (genre?.artists || [])
    .map((a) => (typeof a === 'string' ? a : a?.name))
    .map((n) => (n == null ? '' : String(n).trim()))
    .filter((n) => n && n !== 'undefined')
  const exRaw = genre?.exampleArtist
  const ex =
    exRaw == null || String(exRaw).trim() === 'undefined'
      ? ''
      : String(exRaw).trim()
  const pool = [...new Set([ex, ...artists].filter(Boolean))]
  if (!pool.length) return ''
  const a = pick(pool, seed)
  const b = pool.length > 1 ? pick(pool, seed >> 2) : null
  if (!a) return ''
  if (lang === 'ru') {
    if (b && b !== a)
      return pick(
        [`В ориентирах — ${a} и ${b}.`, `Часто рядом звучат ${a}, ${b}.`],
        seed >> 4,
      )
    return pick(
      [`Характерный ориентир — ${a}.`, `С этой сцены часто всплывает ${a}.`],
      seed >> 4,
    )
  }
  if (b && b !== a)
    return pick(
      [
        `Landmarks include ${a} and ${b}.`,
        `You’ll often hear ${a} beside ${b}.`,
      ],
      seed >> 4,
    )
  return pick(
    [
      `A useful landmark is ${a}.`,
      `${a} often shows up as a scene entry point.`,
    ],
    seed >> 4,
  )
}

function familyCue(name, seed, lang) {
  const t = tokens(name)
  const joined = t.join(' ')
  const has = (...xs) =>
    xs.some((x) => {
      if (!x) return false
      if (t.includes(x)) return true
      if (joined.includes(x)) return true
      // compound tokens: hyperpop contains pop only if token equals or starts with key-
      return t.some(
        (w) =>
          w === x ||
          w.startsWith(`${x}-`) ||
          w.endsWith(`-${x}`) ||
          (x.length >= 4 && (w.startsWith(x) || w.endsWith(x))),
      )
    })
  const ru = {
    drill: ['тёмные скользящие 808 и жёсткая подача', 'уличный дрилл‑бит и холодный флоу'],
    phonk: ['мемфис‑сэмплы, ковбеллы и искажённый бас', 'лоу‑фай шероховатость и агрессивный бас'],
    hyperpop: ['максимализм, питч‑вокал и интернет‑глянец', 'хаотичный поп‑продакшн на максимуме'],
    shoegaze: ['стены гитар и размытый вокал', 'шум, реверб и погружение'],
    metal: ['тяжёлые гитары и агрессивный драйв', 'экстремальный гитарный напор и тёмная эстетика'],
    punk: ['короткие резкие песни и DIY‑энергия', 'сырой темп и антигламурный настрой'],
    jazz: ['импровизация, свинг и живой ансамбль', 'гармония и соло как разговор между инструментами'],
    house: ['four‑on‑the‑floor и клубный грув', 'повторяющийся бит под танцпол'],
    techno: ['машинный пульс и длинные клубные волны', 'повторяющиеся ритмы без поп‑хуков'],
    hiphop: ['бит, флоу и культура сцены', 'ритмичная речь поверх ударных'],
    rap: ['рифмы, флоу и характерный бит', 'вокальная подача поверх грува'],
    trap: ['808, хэты и южный хип‑хоп вайб', 'тяжёлый бас и скользящие хэты'],
    ambient: ['атмосфера важнее куплета', 'пространство, тон и медленное развитие'],
    folk: ['акустика, традиции и рассказ', 'живые тембры и песенная простота'],
    classical: ['академическая форма и оркестровка', 'партитура, динамика и долгая форма'],
    pop: ['цепкие мелодии и радиоформат', 'хуки, куплет‑припев и полированный продакшн'],
    rock: ['гитарный драйв и песенный каркас', 'ритм‑секция и энергичная подача'],
    wave: ['атмосфера, синтез и ночной вайб', 'эхо 80‑х и мелодичная электроника'],
    soul: ['тёплый вокал и грув', 'эмоция в центре аранжировки'],
    blues: ['блю‑ноты и сторителлинг', 'гитара, боль и свингующий пульс'],
    latin: ['латинский ритм и танцевальный огонь', 'перкуссия и солнечный грув'],
    country: ['истории, гитара и Americana‑корни', 'нарратив и акустический каркас'],
    indie: ['независимая сцена и свой почерк', 'меньше глянца, больше характера'],
    electronic: ['синтез, бит и студийная фактура', 'электронные тембры вместо «живой» стены'],
    gospel: ['хор, вера и мощный вокал', 'духовный подъём в аранжировке'],
    reggae: ['offbeat, бас и ямайский пульс', 'скианк‑акценты и глубокий бас'],
    funk: ['синкопы, бас и танцевальный groove', 'ритм‑секция в центре внимания'],
    disco: ['четыре четверти, струны и танцпол', 'блеск 70‑х и бас‑линия'],
    emo: ['исповедальный вокал и резкие динамики', 'эмоция и гитарная исповедь'],
    ska: ['offbeat‑гитара и духовая энергия', 'прыгучий ритм и духовая секция'],
  }
  const en = {
    drill: ['dark sliding 808s and hard delivery', 'street drill beat and cold flow'],
    phonk: ['Memphis samples, cowbells and distorted bass', 'lo-fi grit and aggressive low end'],
    hyperpop: ['maximalism, pitch-shifted vocals and internet gloss', 'chaotic pop production at full blast'],
    shoegaze: ['walls of guitar and washed-out vocals', 'noise, reverb and immersion'],
    metal: ['heavy guitars and aggressive drive', 'extreme guitar pressure and dark aesthetics'],
    punk: ['short sharp songs and DIY energy', 'raw tempo and anti-glamour attitude'],
    jazz: ['improvisation, swing and live interplay', 'harmony and solos as a conversation'],
    house: ['four-on-the-floor and club groove', 'looping beat built for the floor'],
    techno: ['machine pulse and long club waves', 'repeating rhythms without pop hooks'],
    hiphop: ['beats, flow and scene culture', 'rhythmic speech over drums'],
    rap: ['rhyme, flow and a signature beat', 'vocal delivery riding the groove'],
    trap: ['808s, hats and southern hip-hop mood', 'heavy bass and sliding hats'],
    ambient: ['atmosphere over verse–chorus', 'space, tone and slow evolution'],
    folk: ['acoustic timbres, tradition and story', 'plain songcraft and live texture'],
    classical: ['scored form and orchestration', 'dynamics and long-form writing'],
    pop: ['catchy melodies and radio shapes', 'hooks, verse–chorus and polish'],
    rock: ['guitar drive and song backbone', 'rhythm section energy up front'],
    wave: ['atmosphere, synths and night mood', '80s echo and melodic electronics'],
    soul: ['warm vocals and groove', 'emotion at the center of the arrangement'],
    blues: ['blue notes and storytelling', 'guitar, ache and swinging pulse'],
    latin: ['Latin rhythm and dance heat', 'percussion and sunny groove'],
    country: ['stories, guitar and Americana roots', 'narrative and acoustic framing'],
    indie: ['independent scenes and a personal stamp', 'less gloss, more character'],
    electronic: ['synthesis, beat and studio texture', 'electronic timbres over live walls'],
    gospel: ['choir, faith and powerful vocals', 'spiritual lift in the arrangement'],
    reggae: ['offbeat, bass and Jamaican pulse', 'skank accents and deep bass'],
    funk: ['syncopation, bass and dance groove', 'rhythm section front and center'],
    disco: ['four-on-the-floor, strings and the dancefloor', '70s shine and basslines'],
    emo: ['confessional vocals and sharp dynamics', 'emotion and guitar confession'],
    ska: ['offbeat guitar and horn energy', 'bouncy rhythm and brass'],
  }
  const table = lang === 'ru' ? ru : en
  // prefer longer keys first (hyperpop before pop)
  const keys = Object.keys(table).sort((a, b) => b.length - a.length)
  for (const key of keys) {
    if (has(key) || (key === 'hiphop' && (has('hip', 'hop') || joined.includes('hip hop') || joined.includes('hip-hop')))) {
      const line = pick(table[key], seed)
      if (line) return line
    }
  }
  if (has('brazilian', 'brasil', 'samba', 'bossa')) {
    return lang === 'ru'
      ? pick(['бразильский ритм и тёплый swing', 'южноамериканский пульс и мелодия'], seed)
      : pick(['Brazilian rhythm and warm swing', 'South American pulse and melody'], seed)
  }
  if (
    has('japanese', 'korean', 'chinese', 'thai', 'indian', 'african', 'nigerian', 'ghanaian') ||
    t.some((w) => w.startsWith('j-') || w.startsWith('k-'))
  ) {
    return lang === 'ru'
      ? pick(
          [
            'локальная сцена со своим акцентом внутри глобального языка',
            'региональный колорит поверх знакомых жанровых приёмов',
          ],
          seed,
        )
      : pick(
          [
            'a local scene with its own accent inside a global language',
            'regional color over familiar genre moves',
          ],
          seed,
        )
  }
  const fallback =
    lang === 'ru'
      ? pick(
          [
            'свой тембр, темп и привычки слушателей',
            'узнаваемый вайб, даже если границы жанра размыты',
            'характерный звуковой код в каталоге Spotify',
          ],
          seed,
        )
      : pick(
          [
            'its own timbre, tempo and listener habits',
            'a recognizable vibe even when genre borders blur',
            'a distinct sonic code in the Spotify catalog',
          ],
          seed,
        )
  return fallback || (lang === 'ru' ? 'свой узнаваемый звуковой код' : 'its own recognizable sonic code')
}

function mapMood(genre, seed, lang) {
  const x = Number(genre?.x) || 0
  const y = Number(genre?.y) || 0
  // Every Noise-ish: higher y often “organic/atmospheric”, x “mechanic/band”
  const dark = y > 7000
  const bright = y < 3500
  const dense = x > 6000
  const sparse = x < 2500
  if (lang === 'ru') {
    if (dark && dense) return pick(['По карте звучит плотнее и темнее среднего.', 'На карте жанров это скорее тёмная, насыщенная зона.'], seed)
    if (dark) return pick(['На карте ближе к атмосферной, «ночной» стороне.', 'Звучит скорее как настроение, чем как стадионный хук.'], seed)
    if (bright && sparse) return pick(['На карте — светлее и просторнее.', 'Чаще звучит открыто и «воздушно».'], seed)
    if (bright) return pick(['По расположению ближе к яркой, доступной зоне каталога.', 'Скорее про энергию и ясность, чем про мрак.'], seed)
    if (dense) return pick(['Плотная фактура: много слоёв и мало «тишины».', 'Звук обычно густой, без редких пауз.'], seed)
    return pick(['Жанр сидит в своей нише карты Every Noise.', 'У ярлыка своё место на большой карте сцен.'], seed)
  }
  if (dark && dense) return pick(['On the map it sits denser and darker than average.', 'It leans toward a thick, shadowy zone of the catalog.'], seed)
  if (dark) return pick(['It maps closer to the atmospheric, late-night side.', 'More mood than stadium hooks.'], seed)
  if (bright && sparse) return pick(['On the map it feels brighter and more open.', 'It often sounds airy and spacious.'], seed)
  if (bright) return pick(['It sits nearer the bright, approachable part of the map.', 'More energy and clarity than gloom.'], seed)
  if (dense) return pick(['Dense texture: lots of layers, little empty space.', 'The sound is usually thick rather than sparse.'], seed)
  return pick(['It occupies its own niche on the Every Noise map.', 'The tag has a clear shelf on the big scene map.'], seed)
}

/** Russian blurb from genre metadata. */
function generatedRu(genreOrName) {
  const genre = typeof genreOrName === 'string' ? { name: genreOrName } : genreOrName || {}
  const name = genre.name || String(genreOrName)
  const seed = hash(name)
  const cue = familyCue(name, seed >> 1, 'ru')
  const mood = mapMood(genre, seed >> 5, 'ru')
  const who = artistLine(genre, seed >> 7, 'ru')

  const opens = [
    `«${name}» в Spotify — отдельный ярлык: ${cue}.`,
    `Жанр «${name}» держится на своём коде: ${cue}.`,
    `Если коротко про «${name}»: ${cue}.`,
    `«${name}» выделяют не ради галочки — у сцены ${cue}.`,
    `В каталоге «${name}» звучит так: ${cue}.`,
  ]
  const extras = [
    'Слушатели обычно узнают его по первым тактам тембра и ритма.',
    'Плейлисты собирают треки вокруг одного вайба, а не строгой теории.',
    'Границы с соседями бывают мягкими, но у ярлыка свой центр тяжести.',
    'Это скорее про привычки записи и подачи, чем про жёсткие правила гармонии.',
  ]
  const parts = [pick(opens, seed), mood]
  if (seed % 2 === 0) parts.push(pick(extras, seed >> 9))
  if (who && seed % 3 !== 0) parts.push(who)
  else if (!who && seed % 5 === 0) {
    parts.push(
      pick(
        [
          'Удобная точка входа — официальный плейлист жанра на Spotify.',
          'Дальше проще углубляться через похожие ярлыки на карте.',
        ],
        seed >> 13,
      ),
    )
  }
  return parts.filter(Boolean).join(' ')
}

function generatedEn(genreOrName) {
  const genre = typeof genreOrName === 'string' ? { name: genreOrName } : genreOrName || {}
  const name = genre.name || String(genreOrName)
  const seed = hash(name + 'en')
  const cue = familyCue(name, seed >> 1, 'en')
  const mood = mapMood(genre, seed >> 5, 'en')
  const who = artistLine(genre, seed >> 7, 'en')

  const opens = [
    `“${name}” on Spotify is its own tag: ${cue}.`,
    `The “${name}” genre holds a clear code: ${cue}.`,
    `In short, “${name}” is about ${cue}.`,
    `“${name}” isn’t a duplicate label—the scene leans on ${cue}.`,
    `In the catalog, “${name}” usually means ${cue}.`,
  ]
  const extras = [
    'Listeners often spot it in the first bars of timbre and rhythm.',
    'Playlists gather tracks around one vibe more than a theory textbook.',
    'Borders with neighbors can be soft, but the tag still has a center of gravity.',
    'It’s more about recording habits and delivery than rigid harmony rules.',
  ]
  const parts = [pick(opens, seed), mood]
  if (seed % 2 === 0) parts.push(pick(extras, seed >> 9))
  if (who && seed % 3 !== 0) parts.push(who)
  else if (!who && seed % 5 === 0) {
    parts.push(
      pick(
        [
          'A handy entry point is the genre’s Spotify playlist.',
          'From there it’s easy to branch into nearby tags on the map.',
        ],
        seed >> 13,
      ),
    )
  }
  return parts.filter(Boolean).join(' ')
}

async function atomicWrite(file, data) {
  const { unlink, copyFile } = await import('node:fs/promises')
  const tmp = `${file}.${process.pid}.${Date.now()}.tmp`
  await writeFile(tmp, data)
  for (let i = 0; i < 8; i++) {
    try {
      await rename(tmp, file)
      return
    } catch (e) {
      if (e?.code === 'EPERM' || e?.code === 'EACCES' || e?.code === 'EBUSY') {
        await sleep(150 * (i + 1))
        continue
      }
      try {
        await unlink(tmp)
      } catch {
        /* ignore */
      }
      throw e
    }
  }
  // Windows fallback when rename stays locked (Vite/PWA often holds the file)
  try {
    await writeFile(file, data)
  } catch {
    await copyFile(tmp, file)
  }
  try {
    await unlink(tmp)
  } catch {
    /* ignore */
  }
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
      console.error('Lock held at', LOCK)
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

function log(...args) {
  const line = args.map(String).join(' ')
  console.log(line)
  writeFile(LOG, `${new Date().toISOString()} ${line}\n`, { flag: 'a' }).catch(
    () => {},
  )
}

function isUseful(genreName, page) {
  if (!page?.extract || page.extract.length < 55) return false
  if (page.type === 'disambiguation') return false
  const title = (page.title || '').toLowerCase()
  const extract = page.extract.toLowerCase()
  const g = genreName.toLowerCase()
  if (/automation|list of |music in /.test(title) && !g.includes(' ')) return false
  if (/pop music automation/.test(extract)) return false
  if (/animation originating from japan/.test(extract) && g === 'anime')
    return false
  return /music|genre|style|hip-?hop|metal|jazz|techno|house|rap|rock|pop|punk|folk|ambient|wave|synth|electronic|musica|музыка|жанр|стиль|muzyka|gatunek|ดนตรี|音乐|流派|tag/.test(
    `${title} ${extract}`,
  )
}

async function fetchJson(url, retries = 4) {
  try {
    const res = await fetch(url, {
      headers: {
        'Api-User-Agent': UA,
        'User-Agent': UA,
        Accept: 'application/json',
      },
      signal: AbortSignal.timeout(15000),
    })
    if (res.status === 429 && retries > 0) {
      const wait = 8000 + (4 - retries) * 6000
      await sleep(wait)
      return fetchJson(url, retries - 1)
    }
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}

async function wikiSummary(lang, title) {
  const url = `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`
  const j = await fetchJson(url)
  if (!j || j.type === 'disambiguation' || !j.extract) return null
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
  const url = `https://${lang}.wikipedia.org/w/api.php?action=opensearch&search=${encodeURIComponent(q)}&limit=4&namespace=0&format=json`
  const j = await fetchJson(url)
  return Array.isArray(j?.[1]) ? j[1] : []
}

async function wikiFor(name, locale) {
  const lang = WIKI[locale]
  const titles = new Set([
    name,
    titleCase(name),
    `${titleCase(name)} (music)`,
    `${name} (music)`,
  ])
  // One opensearch query (fast path) — no long sequential delays
  try {
    for (const t of await openSearch(lang, `${name} music`)) titles.add(t)
  } catch {
    /* ignore */
  }
  await sleep(DELAY)

  const list = [...titles].slice(0, 6)
  const pages = await Promise.all(list.map((title) => wikiSummary(lang, title)))
  for (const page of pages) {
    if (!page || !isUseful(name, page)) continue
    return { text: shorten(page.extract), source: page.source }
  }
  return null
}

function sourceRank(src = '') {
  const s = String(src)
  if (/wikipedia\.org|\/wiki\//i.test(s)) return 4
  if (s.startsWith('seed/')) return 3
  if (/last\.fm/i.test(s)) return 2
  if (s.includes('generated')) return 0
  return 1
}

function shouldTake(cur, next) {
  if (!next?.text) return false
  if (!cur?.text || isGenerated(cur.source)) return true
  if (RETRY && sourceRank(next.source) >= sourceRank(cur.source)) return true
  return sourceRank(next.source) > sourceRank(cur.source)
}

async function lastFmTag(name) {
  const slug = encodeURIComponent(name.replace(/\s+/g, '+'))
  const url = `https://www.last.fm/tag/${slug}`
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': UA, Accept: 'text/html' },
      signal: AbortSignal.timeout(10000),
    })
    if (!res.ok) return null
    const html = await res.text()
    const m =
      html.match(/class="wiki-content"[^>]*>[\s\S]*?<p>([\s\S]*?)<\/p>/i) ||
      html.match(/property="og:description" content="([^"]+)"/i)
    if (!m?.[1]) return null
    const text = shorten(
      m[1]
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&quot;/g, '"')
        .replace(/\s+/g, ' ')
        .trim(),
    )
    if (text.length < 60) return null
    return { text, source: url }
  } catch {
    return null
  }
}

function migrate(descriptions) {
  const next = {}
  for (const [k, v] of Object.entries(descriptions || {})) {
    if (v?.byLang) {
      next[k] = { byLang: { ...v.byLang } }
      continue
    }
    if (v?.text) {
      const lang = LOCALES.includes(v.lang) ? v.lang : 'ru'
      next[k] = {
        byLang: { [lang]: { text: v.text, source: v.source || 'legacy' } },
      }
    }
  }
  return next
}

function isGenerated(src = '') {
  return String(src).startsWith('generated/')
}

function isWikiOrSeed(src = '') {
  const s = String(src)
  return (
    s.includes('wikipedia') ||
    s.startsWith('seed/') ||
    s.includes('last.fm')
  )
}

function langCount(entry, onlyReal = false) {
  return Object.keys(entry?.byLang || {}).filter((l) => {
    const b = entry.byLang[l]
    if (!b?.text) return false
    if (onlyReal && isGenerated(b.source)) return false
    return true
  }).length
}

async function flush(cache, allNames) {
  let disk = { descriptions: {} }
  if (existsSync(OUT)) {
    try {
      disk = JSON.parse(await readFile(OUT, 'utf8'))
    } catch {
      disk = { descriptions: {} }
    }
  }
  const descriptions = migrate(disk.descriptions)
  for (const name of allNames) {
    const e = cache[name]
    if (!e?.byLang) continue
    descriptions[name] = descriptions[name] || { byLang: {} }
    const merged = { ...(descriptions[name].byLang || {}) }
    for (const [lang, blurb] of Object.entries(e.byLang)) {
      const prev = merged[lang]
      // never let generated overwrite wiki/seed
      if (prev && isWikiOrSeed(prev.source) && isGenerated(blurb.source)) continue
      merged[lang] = blurb
    }
    descriptions[name].byLang = merged
  }
  for (const [name, text] of Object.entries(SEED_RU)) {
    descriptions[name] = descriptions[name] || { byLang: {} }
    descriptions[name].byLang.ru = { text, source: 'seed/ru' }
  }
  for (const [name, text] of Object.entries(SEED_EN)) {
    descriptions[name] = descriptions[name] || { byLang: {} }
    descriptions[name].byLang.en = { text, source: 'seed/en' }
  }
  const ok = Object.keys(descriptions).length
  let langs = 0
  let real = 0
  for (const v of Object.values(descriptions)) {
    langs += langCount(v)
    real += langCount(v, true)
  }
  await atomicWrite(CACHE, JSON.stringify(cache))
  try {
    await atomicWrite(
      OUT,
      JSON.stringify({
        updatedAt: new Date().toISOString(),
        count: ok,
        langEntries: langs,
        realEntries: real,
        descriptions,
      }),
    )
  } catch (e) {
    // Keep going even if public/ is locked — cache still has progress
    log(`flush public failed: ${e?.message || e}`)
  }
  return { ok, langs, real }
}

async function mapPool(items, concurrency, fn) {
  let i = 0
  async function worker() {
    while (i < items.length) {
      const idx = i++
      await fn(items[idx], idx)
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, () => worker()),
  )
}

async function enrichPrimary(name, cache) {
  cache[name] = cache[name] || { byLang: {} }
  cache[name].byLang = cache[name].byLang || {}
  const by = cache[name].byLang

  // Seed first (instant)
  if (SEED_RU[name] && shouldTake(by.ru, { text: SEED_RU[name], source: 'seed/ru' })) {
    by.ru = { text: SEED_RU[name], source: 'seed/ru' }
  }
  if (SEED_EN[name] && shouldTake(by.en, { text: SEED_EN[name], source: 'seed/en' })) {
    by.en = { text: SEED_EN[name], source: 'seed/en' }
  }

  const needRu = !by.ru?.text || isGenerated(by.ru.source) || RETRY
  const needEn = !by.en?.text || isGenerated(by.en.source) || RETRY

  // Race Wikipedia + Last.fm at once — keep the best source per locale
  const [wikiRu, wikiEn, lastFm] = await Promise.all([
    needRu ? wikiFor(name, 'ru') : Promise.resolve(null),
    needEn ? wikiFor(name, 'en') : Promise.resolve(null),
    needEn ? lastFmTag(name) : Promise.resolve(null),
  ])

  if (shouldTake(by.ru, wikiRu)) by.ru = wikiRu
  if (shouldTake(by.en, wikiEn)) by.en = wikiEn
  if (shouldTake(by.en, lastFm)) by.en = lastFm

  cache[name].triedPrimaryAt = new Date().toISOString()
  return langCount(cache[name], true)
}

async function enrichSecondary(name, cache) {
  cache[name] = cache[name] || { byLang: {} }
  // only if we already have some real hit
  if (langCount(cache[name], true) < 1) {
    cache[name].triedSecondaryAt = new Date().toISOString()
    return 0
  }
  for (const locale of SECONDARY) {
    const cur = cache[name].byLang?.[locale]
    if (cur?.text && isWikiOrSeed(cur.source) && !RETRY) continue
    const hit = await wikiFor(name, locale)
    if (hit?.text) {
      cache[name].byLang = cache[name].byLang || {}
      cache[name].byLang[locale] = hit
    }
  }
  cache[name].triedSecondaryAt = new Date().toISOString()
  return langCount(cache[name], true)
}

async function main() {
  if (!(await acquireLock())) process.exit(1)
  try {
    await mkdir(path.dirname(CACHE), { recursive: true })
    await writeFile(LOG, '')
    const payload = JSON.parse(await readFile(GENRES, 'utf8'))
    const allNames = payload.genres.map((g) => g.name)
    const names = LIMIT > 0 ? allNames.slice(0, LIMIT) : allNames

    let cache = existsSync(CACHE)
      ? JSON.parse(await readFile(CACHE, 'utf8'))
      : {}
    if (existsSync(OUT)) {
      try {
        const old = JSON.parse(await readFile(OUT, 'utf8'))
        const migrated = migrate(old.descriptions)
        for (const [k, v] of Object.entries(migrated)) {
          cache[k] = cache[k] || { byLang: {} }
          cache[k].byLang = { ...(cache[k].byLang || {}), ...(v.byLang || {}) }
        }
      } catch {
        /* ignore */
      }
    }

    // Phase A: ensure every genre has RU (+ EN) — regenerate old templates with richer blurbs
    if (!WIKI_ONLY) {
      const byName = new Map(payload.genres.map((g) => [g.name, g]))
      let filled = 0
      for (const name of allNames) {
        const genre = byName.get(name) || { name }
        cache[name] = cache[name] || { byLang: {} }
        cache[name].byLang = cache[name].byLang || {}
        const ru = cache[name].byLang.ru
        if (!SEED_RU[name] && (!ru?.text || isGenerated(ru.source))) {
          cache[name].byLang.ru = {
            text: generatedRu(genre),
            source: 'generated/ru',
          }
          filled++
        }
        const en = cache[name].byLang.en
        if (!SEED_EN[name] && (!en?.text || isGenerated(en.source))) {
          cache[name].byLang.en = {
            text: generatedEn(genre),
            source: 'generated/en',
          }
        }
      }
      for (const [name, text] of Object.entries(SEED_RU)) {
        cache[name] = cache[name] || { byLang: {} }
        cache[name].byLang.ru = { text, source: 'seed/ru' }
      }
      for (const [name, text] of Object.entries(SEED_EN)) {
        cache[name] = cache[name] || { byLang: {} }
        cache[name].byLang.en = { text, source: 'seed/en' }
      }
      const statsA = await flush(cache, allNames)
      log(
        `Phase A done. genres=${statsA.ok} langEntries=${statsA.langs} real=${statsA.real} filledGenerated≈${filled}`,
      )
    }

    // Phase B: Wikipedia/Last.fm upgrade for catalog (primary ru/en)
    const pendingPrimary = names.filter((n) => {
      const real = langCount(cache[n], true)
      if (RETRY) return real < 2
      // Already attempted this pass — don't loop forever on misses
      if (cache[n]?.triedPrimaryAt) return false
      if (real >= 2) return false
      return true
    })
    log(`Phase B primary pending ${pendingPrimary.length}/${names.length}`)

    let done = 0
    let hits = 0
    let fromWiki = 0
    let fromLast = 0
    let fromSeed = 0
    await mapPool(pendingPrimary, CONCURRENCY, async (name) => {
      const before = { ...(cache[name]?.byLang || {}) }
      const n = await enrichPrimary(name, cache)
      if (n > 0) hits++
      for (const loc of PRIMARY) {
        const after = cache[name]?.byLang?.[loc]
        const prev = before[loc]
        if (after?.text && after.source !== prev?.source) {
          if (/wikipedia/i.test(after.source)) fromWiki++
          else if (/last\.fm/i.test(after.source)) fromLast++
          else if (String(after.source).startsWith('seed/')) fromSeed++
        }
      }
      done++
      if (done % 25 === 0 || done === pendingPrimary.length || done <= 3) {
        const s = await flush(cache, allNames)
        log(
          `B ${done}/${pendingPrimary.length} realHits=${hits} wiki=${fromWiki} lastfm=${fromLast} seed=${fromSeed} genres=${s.ok} real=${s.real} langs=${s.langs}`,
        )
      }
    })

    // Phase C: secondary locales for genres that already have real blurbs
    const pendingSecondary = names.filter((n) => {
      if (langCount(cache[n], true) < 1) return false
      if (cache[n]?.triedSecondaryAt && !RETRY) return false
      const haveSec = SECONDARY.filter(
        (l) =>
          cache[n]?.byLang?.[l]?.text &&
          isWikiOrSeed(cache[n].byLang[l].source),
      ).length
      return haveSec < SECONDARY.length
    })
    log(`Phase C secondary pending ${pendingSecondary.length}`)
    done = 0
    await mapPool(pendingSecondary, CONCURRENCY, async (name) => {
      await enrichSecondary(name, cache)
      done++
      if (done % 25 === 0 || done === pendingSecondary.length) {
        const s = await flush(cache, allNames)
        log(
          `C ${done}/${pendingSecondary.length} genres=${s.ok} real=${s.real} langs=${s.langs}`,
        )
      }
    })

    const final = await flush(cache, allNames)
    log(
      `Done. genres=${final.ok} real=${final.real} langEntries=${final.langs} -> ${OUT}`,
    )
  } finally {
    await releaseLock()
  }
}

main().catch(async (e) => {
  console.error(e)
  await releaseLock()
  process.exit(1)
})
