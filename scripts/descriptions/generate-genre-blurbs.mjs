/**
 * Build catalog blurbs from genre metadata (map, artists, related tags).
 * Keeps Wikipedia / hand-written seed / Last.fm entries intact.
 *
 * node scripts/generate-genre-blurbs.mjs --force-generated
 */
import { readFile, writeFile, mkdir, rename, unlink, copyFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '../..')
const GENRES = path.join(ROOT, 'public', 'genres.json')
const SIM = path.join(ROOT, 'public', 'similarity.json')
const OUT = path.join(ROOT, 'public', 'genre-descriptions.json')
const FORCE = process.argv.includes('--force-generated')

function hash(s) {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
  return h
}
function pick(arr, seed) {
  if (!arr?.length) return ''
  return arr[(Number(seed) >>> 0) % arr.length]
}
function tokens(name) {
  return String(name)
    .toLowerCase()
    .split(/[\s/_-]+/)
    .filter((t) => t.length > 1)
}
function titleish(name) {
  return String(name)
    .split(/([\s/_-]+)/)
    .map((w) =>
      /^[a-zа-яё]/i.test(w) ? w[0].toUpperCase() + w.slice(1) : w,
    )
    .join('')
}
function cap(s) {
  const t = String(s || '').trim()
  if (!t) return ''
  return t[0].toUpperCase() + t.slice(1)
}

/** Core family cues — longer keys first via sort at use site */
const FAMILY = {
  hyperpop: {
    ru: ['питч‑вокал, глянец и интернет‑хаос', 'ломаный поп‑максимализм'],
    en: ['pitch vocals, gloss and internet chaos', 'fractured pop maximalism'],
  },
  shoegaze: {
    ru: ['стены гитар и размытый вокал', 'реверб, шум и погружение'],
    en: ['guitar walls and washed vocals', 'reverb, noise and immersion'],
  },
  vaporwave: {
    ru: ['замедленные ретро‑сэмплы и ностальгия', 'лоунж 80–90‑х в slow‑motion'],
    en: ['slowed retro samples and nostalgia', '80s–90s lounge in slow-motion'],
  },
  synthwave: {
    ru: ['ретро‑синтез и саундтрек‑драйв 80‑х', 'неон, арпеджио, кинематографичный бит'],
    en: ['retro synths and 80s score drive', 'neon, arpeggios, cinematic beat'],
  },
  dubstep: {
    ru: ['разреженный ритм и тяжёлый дроп', 'UK‑клубный бас нулевых'],
    en: ['sparse rhythm and heavy drops', '2000s UK club bass'],
  },
  breakcore: {
    ru: ['нарезанные Amen‑брейки и высокий BPM', 'хаотичные эдиты и шум'],
    en: ['chopped Amen breaks and high BPM', 'chaotic edits and noise'],
  },
  amapiano: {
    ru: ['log‑drums, широкий бас и южноафриканский хаус', 'просторные аккорды и глубокий грув'],
    en: ['log drums, wide bass, South African house', 'spacious chords and deep groove'],
  },
  afrobeats: {
    ru: ['западноафриканский поп‑континуум', 'хайлайф, хип‑хоп и танцевальный пульс'],
    en: ['West African pop continuum', 'highlife, hip-hop and dance pulse'],
  },
  afrobeat: {
    ru: ['полиритмия, перкуссия, западноафриканский грув', 'танцевальная энергия с африканским корнем'],
    en: ['polyrhythm, percussion, West African groove', 'dance energy with African roots'],
  },
  reggaeton: {
    ru: ['dembow‑бит и латинский танцпол', 'хип‑хоп/дэнсхолл вокруг dembow'],
    en: ['dembow beat and Latin dancefloor', 'hip-hop/dancehall around dembow'],
  },
  hardcore: {
    ru: ['скорость, агрессия, без сглаживания', 'экстремальный напор и прямота'],
    en: ['speed, aggression, no polish', 'extreme pressure and directness'],
  },
  industrial: {
    ru: ['абразивный шум и машинные ритмы', 'механика и конфронтация'],
    en: ['abrasive noise and machine rhythms', 'mechanics and confrontation'],
  },
  drill: {
    ru: ['скользящие 808, рваный хэт, уличный флоу', 'холодный дрилл‑бит и плотная подача'],
    en: ['sliding 808s, stutter hats, street flow', 'cold drill beat and tight delivery'],
  },
  phonk: {
    ru: ['мемфис‑сэмплы, ковбеллы, грязный бас', 'лоу‑фай шероховатость и агрессивный низ'],
    en: ['Memphis samples, cowbells, dirty bass', 'lo-fi grit and aggressive low end'],
  },
  garage: {
    ru: ['ломаный UK‑ритм и вокальные хуки', 'угловатый бит между хаусом и брейкбитом'],
    en: ['broken UK rhythm and vocal hooks', 'angular beat between house and breakbeat'],
  },
  grime: {
    ru: ['восточнолондонский электронный/рэп пульс', 'быстрые биты и резкая атака'],
    en: ['East London electronic/rap pulse', 'fast beats and sharp attack'],
  },
  techno: {
    ru: ['машинный пульс и длинные клубные волны', 'повторяющиеся ритмы без поп‑сюжета'],
    en: ['machine pulse and long club waves', 'looping rhythms without pop plot'],
  },
  house: {
    ru: ['four‑on‑the‑floor и клубный грув', 'соул‑хуки поверх танцевального бита'],
    en: ['four-on-the-floor and club groove', 'soul hooks over dance beat'],
  },
  trance: {
    ru: ['длинные билды, эйфория и синтезаторные линии', 'клубный подъём и гипнотический повтор'],
    en: ['long builds, euphoria and synth lines', 'club lift and hypnotic loops'],
  },
  ambient: {
    ru: ['атмосфера важнее куплета', 'пространство, тон, медленное развитие'],
    en: ['atmosphere over verse–chorus', 'space, tone, slow evolution'],
  },
  classical: {
    ru: ['академическая форма и оркестровка', 'динамика, тема, долгая форма'],
    en: ['scored form and orchestration', 'dynamics, theme, long form'],
  },
  electronic: {
    ru: ['синтез, бит и студийная фактура', 'электронные тембры вместо «живой» стены'],
    en: ['synthesis, beat and studio texture', 'electronic timbres over live walls'],
  },
  metal: {
    ru: ['тяжёлые гитары и экстремальная энергия', 'гитарный напор и тёмная эстетика'],
    en: ['heavy guitars and extreme energy', 'guitar pressure and dark aesthetics'],
  },
  punk: {
    ru: ['короткие резкие песни и DIY', 'сырой темп и антигламур'],
    en: ['short sharp songs and DIY', 'raw tempo and anti-glamour'],
  },
  jazz: {
    ru: ['импровизация, свинг, диалог инструментов', 'гармония и соло как разговор'],
    en: ['improvisation, swing, instrumental dialogue', 'harmony and solos as talk'],
  },
  blues: {
    ru: ['блю‑ноты и сторителлинг', 'гитара, надрыв, свингующий пульс'],
    en: ['blue notes and storytelling', 'guitar, ache, swinging pulse'],
  },
  soul: {
    ru: ['тёплый вокал и грув', 'эмоция в центре аранжировки'],
    en: ['warm vocals and groove', 'emotion at the arrangement’s center'],
  },
  funk: {
    ru: ['синкопы, бас и танцевальный groove', 'ритм‑секция впереди'],
    en: ['syncopation, bass and dance groove', 'rhythm section up front'],
  },
  disco: {
    ru: ['четыре четверти, струны, танцпол', 'блеск 70‑х и бас‑линия'],
    en: ['four-on-the-floor, strings, dancefloor', '70s shine and basslines'],
  },
  reggae: {
    ru: ['offbeat, бас, ямайский пульс', 'скианк‑акценты и глубокий бас'],
    en: ['offbeat, bass, Jamaican pulse', 'skank accents and deep bass'],
  },
  gospel: {
    ru: ['хор, вера, мощный вокал', 'духовный подъём в аранжировке'],
    en: ['choir, faith, powerful vocals', 'spiritual lift in the arrangement'],
  },
  country: {
    ru: ['истории, гитара, Americana‑корни', 'нарратив и акустический каркас'],
    en: ['stories, guitar, Americana roots', 'narrative and acoustic frame'],
  },
  folk: {
    ru: ['акустика, традиции, рассказ', 'живые тембры и песенная простота'],
    en: ['acoustic timbres, tradition, story', 'live texture and plain songcraft'],
  },
  latin: {
    ru: ['латинский ритм и танцевальный огонь', 'перкуссия и солнечный грув'],
    en: ['Latin rhythm and dance heat', 'percussion and sunny groove'],
  },
  samba: {
    ru: ['бразильская перкуссия и карнавал', 'полиритмия и солнечная энергия'],
    en: ['Brazilian percussion and carnival', 'polyrhythm and sunny energy'],
  },
  bossa: {
    ru: ['мягкий бразильский swing и камерная гармония', 'акустика, шепот, джазовый оттенок'],
    en: ['soft Brazilian swing and intimate harmony', 'acoustic hush with a jazz tint'],
  },
  brazilian: {
    ru: ['бразильский ритм, тепло и swing', 'южноамериканский пульс'],
    en: ['Brazilian rhythm, warmth and swing', 'South American pulse'],
  },
  trap: {
    ru: ['808, дробные хэты, южный вайб', 'тяжёлый бас и мелодичные хуки'],
    en: ['808s, rolling hats, southern mood', 'heavy bass and melodic hooks'],
  },
  rage: {
    ru: ['искажённые 808 и гипер‑энергия', 'кричащие хуки поверх trap‑каркаса'],
    en: ['distorted 808s and hyper energy', 'yelling hooks over a trap frame'],
  },
  rap: {
    ru: ['рифмы, флоу и характерный бит', 'ритмичная речь как главный инструмент'],
    en: ['rhyme, flow and a signature beat', 'rhythmic speech as the lead'],
  },
  hiphop: {
    ru: ['бит, флоу и культура сцены', 'ударные, семплы, характерная подача'],
    en: ['beats, flow and scene culture', 'drums, samples, signature delivery'],
  },
  emo: {
    ru: ['исповедальный вокал и резкие динамики', 'эмоция и гитарная исповедь'],
    en: ['confessional vocals and sharp dynamics', 'emotion and guitar confession'],
  },
  ska: {
    ru: ['offbeat‑гитара и духовая энергия', 'прыгучий ритм и brass'],
    en: ['offbeat guitar and horn energy', 'bouncy rhythm and brass'],
  },
  indie: {
    ru: ['независимая сцена и свой почерк', 'меньше глянца, больше характера'],
    en: ['independent scenes and a personal stamp', 'less gloss, more character'],
  },
  rock: {
    ru: ['гитарный драйв и песенный каркас', 'ритм‑секция и энергичная подача'],
    en: ['guitar drive and song backbone', 'rhythm-section energy up front'],
  },
  pop: {
    ru: ['цепкие мелодии и радиоформат', 'хуки, куплет‑припев, полированный продакшн'],
    en: ['catchy melodies and radio shapes', 'hooks, verse–chorus, polished production'],
  },
  wave: {
    ru: ['синтез, атмосфера, ночной вайб', 'эхо 80‑х и мелодичная электроника'],
    en: ['synths, atmosphere, night mood', '80s echo and melodic electronics'],
  },
  dream: {
    ru: ['туманный вокал и гитары в ревербе', 'настроение важнее острых хуков'],
    en: ['hazy vocals and reverbed guitars', 'mood over sharp hooks'],
  },
  kpop: {
    ru: ['полированный айдол‑поп и хореография', 'хуки, хип‑хоп и студийный блеск'],
    en: ['polished idol pop and choreography', 'hooks, hip-hop and studio gloss'],
  },
  jpop: {
    ru: ['японский поп с яркими хуками', 'аниме‑/айдол‑эстетика и глянец'],
    en: ['Japanese pop with bright hooks', 'idol/anime aesthetics and gloss'],
  },
  lofi: {
    ru: ['тёплая «неидеальная» фактура и мягкий бит', 'шипение, комнатность, уютная шероховатость'],
    en: ['warm imperfect texture and soft beat', 'hiss, room tone, cozy grit'],
  },
  lullaby: {
    ru: ['мягкие тембры и успокаивающий темп', 'инструментальная тишина для сна'],
    en: ['soft timbres and a calming tempo', 'instrumental hush meant for sleep'],
  },
  score: {
    ru: ['кинематографичные темы и лейтмотивы', 'музыка под картинку, а не под радио'],
    en: ['cinematic themes and leitmotifs', 'music for picture, not radio'],
  },
  soundtrack: {
    ru: ['темы из фильмов/игр и саундтрек‑форма', 'атмосфера сцены важнее куплета'],
    en: ['film/game themes and soundtrack form', 'scene atmosphere over verse'],
  },
  choir: {
    ru: ['хоровые голоса и гармонии', 'коллективный вокал в центре'],
    en: ['choral voices and harmonies', 'collective vocals at the center'],
  },
  orchestra: {
    ru: ['оркестровая палитра и крупные формы', 'струны, духовые, динамика'],
    en: ['orchestral palette and large forms', 'strings, winds, dynamics'],
  },
  piano: {
    ru: ['фортепиано как главный тембр', 'клавишная фактура и мелодия'],
    en: ['piano as the lead timbre', 'keyboard texture and melody'],
  },
  guitar: {
    ru: ['гитара в центре аранжировки', 'струнный драйв или акустический рисунок'],
    en: ['guitar at the arrangement’s center', 'string drive or acoustic figure'],
  },
  bass: {
    ru: ['бас ведёт гармонию и грув', 'низ как главный персонаж'],
    en: ['bass leading harmony and groove', 'the low end as the main character'],
  },
  instrumental: {
    ru: ['без ведущего вокала — тембр и форма', 'инструменты держат внимание сами'],
    en: ['no lead vocal—timbre and form', 'instruments hold attention alone'],
  },
  acoustic: {
    ru: ['живые струны и «комнатный» звук', 'акустика без тяжёлого продакшна'],
    en: ['live strings and room sound', 'acoustic without heavy production'],
  },
  progressive: {
    ru: ['сложные формы и смена размеров', 'длинные построения и техника'],
    en: ['complex forms and shifting meters', 'long builds and technique'],
  },
  experimental: {
    ru: ['сломаные ожидания и поиск тембра', 'эксперимент важнее привычной песни'],
    en: ['broken expectations and timbre search', 'experiment over familiar song'],
  },
  alternative: {
    ru: ['альтернатива мейнстриму: свой угол', 'нестандартный почерк внутри рока/попа'],
    en: ['an alternative angle to the mainstream', 'an off-center stamp inside rock/pop'],
  },
  christian: {
    ru: ['вера и духовный текст в современной обёртке', 'поклонение через привычные жанровые формы'],
    en: ['faith and spiritual text in modern wrappers', 'worship through familiar genre forms'],
  },
  kids: {
    ru: ['простые мелодии и детская аудитория', 'лёгкий темп и понятные хуки'],
    en: ['simple melodies for a kids audience', 'easy tempo and clear hooks'],
  },
  children: {
    ru: ['музыка для детей: ясность и игра', 'короткие формы и мягкая динамика'],
    en: ['music for children: clarity and play', 'short forms and soft dynamics'],
  },
}

const MOD = {
  melodic: { ru: 'мелодия выходит вперёд', en: 'melody steps forward' },
  dark: { ru: 'тёмный, «ночной» окрас', en: 'a dark, late-night tint' },
  deep: { ru: 'глубокий низ и простор', en: 'deep low end and space' },
  chill: { ru: 'расслабленный темп без резких углов', en: 'a relaxed tempo without sharp edges' },
  sad: { ru: 'меланхоличный наклон', en: 'a melancholy lean' },
  progressive: { ru: 'более сложные формы', en: 'more complex forms' },
  atmospheric: { ru: 'атмосфера важнее удара', en: 'atmosphere over punch' },
  classic: { ru: 'отсылка к «классике» стиля', en: 'a nod to the style’s classics' },
  modern: { ru: 'современная продюсерская обёртка', en: 'a modern producer wrapper' },
  traditional: { ru: 'ближе к традиционному ядру', en: 'closer to the traditional core' },
  experimental: { ru: 'склонность ломать шаблон', en: 'a habit of breaking the template' },
  indie: { ru: 'независимый, менее глянцевый угол', en: 'an independent, less glossy angle' },
  instrumental: { ru: 'без ведущего вокала', en: 'without a lead vocal' },
  vocal: { ru: 'голос в центре внимания', en: 'voice front and center' },
  acoustic: { ru: 'акустический каркас', en: 'an acoustic frame' },
  electric: { ru: 'электрический драйв', en: 'electric drive' },
  heavy: { ru: 'утяжелённая подача', en: 'a heavier delivery' },
  soft: { ru: 'мягкая динамика', en: 'soft dynamics' },
  funky: { ru: 'фанковый акцент в ритме', en: 'a funky rhythmic accent' },
  psychedelic: { ru: 'психоделический размытый край', en: 'a psychedelic blurred edge' },
  tropical: { ru: 'тропический, солнечный окрас', en: 'a tropical, sunny tint' },
  gothic: { ru: 'готическая тень в эстетике', en: 'a gothic shadow in the aesthetic' },
  raw: { ru: 'сырой, почти «живой» звук', en: 'a raw, nearly live sound' },
  polish: { ru: 'полированный студийный блеск', en: 'polished studio gloss' },
  future: { ru: 'футуристичный цифровой оттенок', en: 'a futuristic digital tint' },
  vintage: { ru: 'винтажная фактура', en: 'vintage texture' },
  urban: { ru: 'городской уличный вайб', en: 'an urban street vibe' },
  rural: { ru: 'провинциальный, «земной» тон', en: 'a rural, earthy tone' },
  comic: { ru: 'игровой, почти шуточный угол', en: 'a playful, almost comic angle' },
  horror: { ru: 'тревожная, horror‑эстетика', en: 'uneasy horror aesthetics' },
  game: { ru: 'игровой/саундтрековый контекст', en: 'a game/soundtrack context' },
  anime: { ru: 'аниме‑эстетика и OST‑логика', en: 'anime aesthetics and OST logic' },
  lounge: { ru: 'лаунж‑расслабленность', en: 'lounge ease' },
  club: { ru: 'клубная функция важнее альбома', en: 'club function over album story' },
  dance: { ru: 'танцпол как главная цель', en: 'the dancefloor as the goal' },
  sleep: { ru: 'музыка для сна и фона', en: 'music for sleep and background' },
  study: { ru: 'фон для учёбы/фокуса', en: 'background for study/focus' },
  workout: { ru: 'темп под движение и тренировку', en: 'tempo built for movement' },
  christmas: { ru: 'праздничный сезонный окрас', en: 'a festive seasonal tint' },
  christian: { ru: 'духовный/христианский текст', en: 'spiritual/Christian text' },
}

const PLACE = [
  [['uk', 'british', 'london', 'manchester', 'bristol'], { ru: 'британский', en: 'British' }],
  [['german', 'deutsch', 'berlin'], { ru: 'немецкий', en: 'German' }],
  [['french', 'paris', 'francais'], { ru: 'французский', en: 'French' }],
  [['japanese', 'jpop', 'tokyo'], { ru: 'японский', en: 'Japanese' }],
  [['korean', 'kpop', 'seoul'], { ru: 'корейский', en: 'Korean' }],
  [['brazilian', 'brasil', 'samba', 'bossa'], { ru: 'бразильский', en: 'Brazilian' }],
  [['mexican', 'corrido', 'banda', 'norteno', 'sierreno'], { ru: 'мексиканский', en: 'Mexican' }],
  [['nigerian', 'ghana', 'african', 'afro'], { ru: 'африканский', en: 'African' }],
  [['swedish', 'norwegian', 'finnish', 'danish', 'nordic'], { ru: 'скандинавский', en: 'Nordic' }],
  [['russian', 'soviet', 'ukraine', 'polish', 'czech'], { ru: 'восточноевропейский', en: 'Eastern European' }],
  [['canadian', 'toronto', 'montreal'], { ru: 'канадский', en: 'Canadian' }],
  [['australian', 'aussie'], { ru: 'австралийский', en: 'Australian' }],
  [['italian', 'rome'], { ru: 'итальянский', en: 'Italian' }],
  [['spanish', 'madrid'], { ru: 'испанский', en: 'Spanish' }],
  [['dutch', 'netherlands', 'belgian'], { ru: 'нидерландский/бельгийский', en: 'Dutch/Belgian' }],
  [['chicago', 'detroit', 'atlanta', 'houston', 'memphis', 'nashville', 'tennessee', 'texas', 'nyc', 'brooklyn', 'bronx', 'philly', 'pittsburgh', 'miami', 'la', 'bay'], { ru: 'локальный американский', en: 'local American' }],
  [['latin', 'latino', 'urbano'], { ru: 'латиноамериканский', en: 'Latin American' }],
]

const SEED_RU = {
  pop: 'Поп — массовая популярная музыка с цепкими мелодиями, куплет‑припевной формой и продакшном под радио и стриминг.',
  'post-punk':
    'Постпанк пошёл дальше панка: угловатый бас, атмосфера и art‑school края. Постсоветская волна добавила холодные синтезаторы и ночной городской вайб. Это любимый жанр создателя приложения.',
  metal:
    'Метал — тяжёлый гитарный стиль с мощным звучанием, выросший из хард‑рока и развившийся во множество поджанров.',
  rock: 'Рок — направление популярной музыки с характерным ритмом и гитарным драйвом, выросшее из рок‑н‑ролла.',
  jazz: 'Джаз вырос из афроамериканских традиций: свинг, импровизация, блю‑ноты и эволюция стилей.',
  techno:
    'Техно — электронная танцевальная музыка из Детройта: повторяющиеся машинные ритмы и длинный клубный драйв.',
  house:
    'Хаус родился в Чикаго 1980‑х: бит four‑on‑the‑floor, соул/вокальные хуки и клубный грув.',
  ambient: 'Эмбиент делает ставку на атмосферу и тон, а не на привычную песенную форму.',
  'hip hop':
    'Хип‑хоп — культура и музыка 1970‑х Нью‑Йорка вокруг рэпа, диджеинга, брейков и студийного продакшна.',
  rap: 'Рэп — вокальная подача с рифмой и ритмичной речью, обычно поверх бита; ключевая часть хип‑хоп культуры.',
  punk: 'Панк — быстрый сырой рок и культура 1970‑х: короткие песни, DIY и антисистемный настрой.',
  phonk:
    'Фонк смешивает хип‑хоп с сэмплами мемфис‑рэпа 1990‑х — ковбеллы, искажённый бас и лоу‑фай‑шершавость.',
  hyperpop:
    'Hyperpop — электронно‑поп направление 2010‑х: максимализм, глянцевые и питч‑сдвинутые вокалы, хаотичный интернет‑продакшн.',
  vaporwave:
    'Vaporwave — интернет‑микрожанр начала 2010‑х: нарезанные и замедленные сэмплы лаунжа и корпоративной музыки 1980–90‑х.',
  shoegaze:
    'Шугейз — альтернативный рок с размытым вокалом, стенами гитарных эффектов и погружающей фактурой.',
  synthwave:
    'Синтвейв — ретро‑электроника в духе саундтреков 1980‑х: синтезаторы, неон и драйвовый бит.',
  trap: 'Трэп — хип‑хоп с чёткими хэтами, грохочущими 808 и южными корнями США.',
  drill:
    'Дрилл — хип‑хоп с тёмными скользящими 808 и жёсткой подачей; начался в Чикаго и позже разветвился в UK.',
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
  grime: 'Грайм — британский электронный/рэп стиль начала 2000‑х из Восточного Лондона.',
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
  rage: 'Rage — trap‑смежный интернет‑стиль с искажёнными 808, кричащими хуками и гипер‑агрессивной энергией.',
  classical:
    'Классическая музыка — академическая традиция западного искусства: оркестровка, форма и долгие развития тем, в отличие от поп‑ и фолк‑музыки. На Spotify ярлык «classical» охватывает барокко, классицизм, романтизм и современную академическую музыку.',
}

const SEED_EN = {
  pop: 'Pop is mainstream popular music with catchy melodies, verse–chorus forms and production aimed at radio and streaming.',
  'post-punk':
    'Post-punk pushed past punk with angular bass, atmosphere and art-school edges. The postsoviet wave added cold synths and late-night city mood. This is the app creator’s favorite genre.',
  metal:
    'Metal is a heavy guitar-driven style that grew out of hard rock and split into many subgenres.',
  rock: 'Rock is popular music built on rhythmic drive and guitar energy, descended from rock and roll.',
  jazz: 'Jazz grew from African American traditions: swing, improvisation, blue notes and evolving styles.',
  techno:
    'Techno is Detroit-born electronic dance music: looping machine rhythms and long club drive.',
  house:
    'House was born in 1980s Chicago: four-on-the-floor beat, soul/vocal hooks and club groove.',
  ambient: 'Ambient privileges atmosphere and tone over familiar song form.',
  'hip hop':
    'Hip-hop is the 1970s New York culture and music around rapping, DJing, breaks and later studio production.',
  rap: 'Rap is rhythmic rhymed speech over a beat—central to hip-hop culture.',
  punk: 'Punk is fast raw 1970s rock and culture: short songs, DIY and anti-establishment attitude.',
  phonk:
    'Phonk blends hip-hop with 1990s Memphis rap samples—cowbells, distorted bass and lo-fi grit.',
  hyperpop:
    'Hyperpop is a 2010s electronic-pop movement: maximalist, glossy, pitch-shifted vocals and chaotic internet-native production.',
  vaporwave:
    'Vaporwave is an early-2010s internet microgenre of chopped, slowed lounge and 1980s–90s corporate mood samples.',
  shoegaze:
    'Shoegaze is alternative rock with washed-out vocals, walls of guitar effects and immersive texture.',
  synthwave:
    'Synthwave is retro electronic music evocative of 1980s film and game scores.',
}

function isProtected(src = '') {
  const s = String(src)
  return (
    s.includes('wikipedia') ||
    s.startsWith('seed/') ||
    s.includes('last.fm') ||
    s.startsWith('llm/')
  )
}

function hitKey(t, joined, key) {
  if (key === 'hiphop')
    return (
      joined.includes('hip hop') ||
      joined.includes('hip-hop') ||
      (t.includes('hip') && t.includes('hop')) ||
      t.includes('hiphop')
    )
  if (key === 'kpop') return joined.includes('k-pop') || t.includes('kpop') || t.includes('k-pop')
  if (key === 'jpop') return joined.includes('j-pop') || t.includes('jpop')
  if (key === 'lofi') return joined.includes('lo-fi') || joined.includes('lofi') || t.includes('lofi')
  if (key === 'bossa') return joined.includes('bossa') || t.includes('bossa')
  return (
    t.includes(key) ||
    joined.includes(key) ||
    t.some(
      (w) =>
        w === key ||
        w.startsWith(`${key}-`) ||
        w.endsWith(`-${key}`) ||
        (key.length >= 5 && (w.startsWith(key) || w.endsWith(key))),
    )
  )
}

function familyHits(name) {
  const t = tokens(name)
  const joined = t.join(' ')
  const keys = Object.keys(FAMILY).sort((a, b) => b.length - a.length)
  const hits = []
  for (const key of keys) {
    if (hitKey(t, joined, key)) hits.push(key)
  }
  return { t, joined, hits }
}

function familyCue(name, seed, lang) {
  const { hits } = familyHits(name)
  if (hits.length) {
    const key = hits[0]
    return pick(FAMILY[key][lang] || FAMILY[key].en, seed)
  }
  return lang === 'ru'
    ? pick(
        [
          'свой тембр и привычки слушателей этой ниши',
          'узнаваемый вайб, даже если границы размыты',
          'отдельный звуковой угол в каталоге Spotify',
        ],
        seed,
      )
    : pick(
        [
          'its own timbre and listener habits',
          'a recognizable vibe even when borders blur',
          'a distinct angle in the Spotify catalog',
        ],
        seed,
      )
}

function modBits(name, seed, lang, skip = new Set()) {
  const t = tokens(name)
  const bits = []
  for (const [k, v] of Object.entries(MOD)) {
    if (skip.has(k)) continue
    if (t.includes(k) || t.some((w) => w.includes(k) && k.length >= 4)) bits.push(v[lang])
  }
  if (!bits.length) return ''
  return pick(bits, seed)
}

function placeBit(name, lang) {
  const t = tokens(name)
  const joined = t.join(' ')
  for (const [keys, lab] of PLACE) {
    if (
      keys.some((k) => {
        if (t.includes(k)) return true
        // only allow substring for longer keys (avoid "la" inside "lullaby")
        if (k.length >= 5 && joined.includes(k)) return true
        return false
      })
    )
      return lab[lang]
  }
  if (t.length >= 2 && t[0].length >= 4 && !FAMILY[t[0]] && !MOD[t[0]]) {
    return lang === 'ru' ? `локальный (${t[0]})` : `local (${t[0]})`
  }
  return ''
}

function artists(genre) {
  const names = (genre.artists || [])
    .map((a) => (typeof a === 'string' ? a : a?.name))
    .map((n) => String(n || '').trim())
    .filter((n) => n && n !== 'undefined')
  const ex = String(genre.exampleArtist || '').trim()
  if (ex && ex !== 'undefined') names.unshift(ex)
  return [...new Set(names)].slice(0, 8)
}

function neighbors(name, related) {
  const ids = related?.[name] || related?.[name.replace(/\s+/g, '-')] || []
  return ids.filter((x) => x && x !== name).slice(0, 10)
}

function mapAxis(genre) {
  const x = Number(genre?.x) || 0
  const y = Number(genre?.y) || 0
  return {
    dark: y > 7000,
    bright: y < 3500,
    dense: x > 6000,
    sparse: x < 2500,
    x,
    y,
  }
}

function buildContext(genre, related, lang) {
  const name = genre.name
  const seed = hash(name + (lang === 'en' ? ':en' : ''))
  const { hits } = familyHits(name)
  const cue = familyCue(name, seed >> 1, lang)
  const cue2 =
    hits.length > 1
      ? pick(FAMILY[hits[1]][lang] || FAMILY[hits[1]].en, seed >> 3)
      : ''
  const skipMods = new Set(hits)
  const mod = modBits(name, seed >> 5, lang, skipMods)
  const place = placeBit(name, lang)
  const arts = artists(genre)
  const a1 = arts[0] || ''
  const a2 = arts.length > 1 ? pick(arts.slice(1), seed >> 7) : ''
  const neigh = neighbors(name, related)
  const n1 = neigh[0] || ''
  const n2 = neigh.length > 1 ? pick(neigh.slice(1), seed >> 9) : ''
  const axis = mapAxis(genre)
  const disp = titleish(name)
  return { name, disp, seed, cue, cue2, mod, place, a1, a2, n1, n2, axis, hits }
}

function blurbRu(genre, related) {
  const c = buildContext(genre, related, 'ru')
  const { name, disp, seed, cue, cue2, mod, place, a1, a2, n1, n2, axis } = c
  const mode = (seed >>> 0) % 12

  const mood =
    axis.dark && axis.dense
      ? pick(['звучит плотно и темно', 'мало «воздуха», много тени'], seed >> 11)
      : axis.dark
        ? pick(['скорее ночное настроение', 'атмосфера важнее стадионного хука'], seed >> 11)
        : axis.bright
          ? pick(['звучит открыто и энергично', 'ярче и доступнее среднего'], seed >> 11)
          : axis.dense
            ? pick(['фактура густая', 'слоёв много, пауз мало'], seed >> 11)
            : pick(['своя ниша среди соседей', 'не стремится быть «всем сразу»'], seed >> 11)

  const who =
    a1 && a2 && a1 !== a2
      ? pick(
          [
            `Ориентиры — ${a1} и ${a2}`,
            `Часто всплывают ${a1}, ${a2}`,
            `Проще познакомиться через ${a1} или ${a2}`,
          ],
          seed >> 13,
        )
      : a1
        ? pick([`Характерный ориентир — ${a1}`, `Удобная точка входа — ${a1}`], seed >> 13)
        : ''

  const near =
    n1 && n2 && n1 !== n2
      ? pick(
          [
            `Рядом по вкусу — «${n1}» и «${n2}»`,
            `Если зайдёт, дальше слушайте «${n1}» или «${n2}»`,
            `Соседние ярлыки: «${n1}», «${n2}»`,
          ],
          seed >> 15,
        )
      : ''

  const placeLine = place
    ? pick(
        [
          `Чувствуется ${place} акцент.`,
          `В звуке есть ${place} колорит.`,
          `Это ${place} угол большого жанрового языка.`,
        ],
        seed >> 17,
      )
    : ''

  const modLine = mod
    ? pick([`Плюс ${mod}.`, `Оттенок: ${mod}.`, `Здесь важнее ${mod}.`], seed >> 19)
    : ''

  const mix = cue2
    ? pick(
        [`Смесь: ${cue} + ${cue2}.`, `База — ${cue}; сверху ${cue2}.`],
        seed >> 21,
      )
    : ''

  /** 12 distinct paragraph shapes */
  const shapes = [
    () =>
      [
        `${disp} — это про ${cue}.`,
        placeLine || modLine,
        who || near,
        pick(
          [
            'Не учебник гармонии, а привычный вайб плейлистов.',
            'Слушают ради тембра и ритма с первых тактов.',
            'Границы мягкие, но центр тяжести свой.',
          ],
          seed >> 23,
        ),
      ],
    () =>
      [
        `В Spotify ярлык «${name}» собирает треки вокруг идеи: ${cue}.`,
        modLine || (axis.dark ? `Настроение: ${mood}.` : `По ощущению ${mood}.`),
        who,
        near && seed % 2 === 0 ? near : '',
      ],
    () =>
      [
        who
          ? `Если ${a1} вам близок, «${name}» — логичный следующий ярлык.`
          : `«${name}» стоит слушать как самостоятельную сцену, а не как «почти соседний жанр».`,
        `В центре — ${cue}.`,
        placeLine || modLine,
        near,
      ],
    () =>
      [
        mix || `Код жанра: ${cue}.`,
        `«${name}» — ${mood}.`,
        who || placeLine,
        pick(
          [
            'Плейлисты важнее энциклопедических определений.',
            'Лучше один сильный трек, чем длинная теория.',
          ],
          seed >> 25,
        ),
      ],
    () =>
      [
        near
          ? `Между «${n1}» и остальным каталогом лежит «${name}»: ${cue}.`
          : `«${name}» сидит особняком: ${cue}.`,
        modLine || placeLine,
        who,
        `В целом ${mood}.`,
      ],
    () =>
      [
        `Коротко про ${disp}: ${cue}${mod ? `; ещё ${mod}` : ''}.`,
        placeLine,
        who
          ? `${who}.`
          : pick(
              [
                'Точка входа — официальный жанровый плейлист.',
                'Дальше проще идти по похожим ярлыкам на карте.',
              ],
              seed >> 27,
            ),
      ],
    () =>
      [
        `Сцена «${name}» держится на идее: ${cue}.`,
        axis.bright
          ? 'Чаще это дневная/энергичная подача.'
          : axis.dark
            ? 'Чаще это ночной, камерный или мрачный угол.'
            : 'Темп и плотность зависят от конкретного релиза.',
        who || near,
        placeLine,
      ],
    () =>
      [
        a1
          ? `${a1}${a2 && a2 !== a1 ? ` и ${a2}` : ''} часто ставят ориентиром для «${name}».`
          : `У «${name}» нет одного «лица», зато есть общий код: ${cue}.`,
        a1 ? `Общий код сцены: ${cue}.` : modLine || placeLine,
        near,
        pick(['Слушать лучше целиком плейлист, а не один сингл.', 'Важнее вайб, чем жёсткие правила.'], seed >> 29),
      ],
    () =>
      [
        `Не путайте «${name}» с соседями — здесь важнее ${cue}.`,
        placeLine || modLine,
        near
          ? `Да, рядом «${n1}», но центр другой.`
          : `Жанр ${mood}.`,
        who,
      ],
    () =>
      [
        `Это для тех, кому откликается: ${cue}.`,
        place ? `${cap(place)} колорит здесь не декорация.` : modLine,
        who || near,
        `Итог — ${mood}.`,
      ],
    () =>
      [
        `«${name}» в каталоге — микросцена. Суть: ${cue}.`,
        mix || modLine,
        who,
        near ||
          pick(
            [
              'Карта Every Noise ставит его рядом с родственными тегами.',
              'На стриминге это скорее полка плейлистов, чем «школа».',
            ],
            seed >> 31,
          ),
      ],
    () =>
      [
        place
          ? `${disp} — ${place} взгляд на сцену, где ${cue}.`
          : `${disp}: ${cue}.`,
        modLine,
        who
          ? `${who} — хороший старт.`
          : near
            ? `${near}.`
            : 'Старт — любой свежий плейлист с этим тегом.',
        pick(
          [
            'Дальше ухо само отделит своих от чужих.',
            'Через 3–4 трека ярлык обычно «схватывается».',
          ],
          seed,
        ),
      ],
  ]

  const parts = shapes[mode]()
    .flat()
    .map((s) => String(s || '').trim())
    .filter(Boolean)
    .map((s) => cap(s))
    .map((s) => (/[.!?…]$/.test(s) ? s : `${s}.`))

  let text = parts.join(' ')
  if (text.length < 90 && near) text = `${text} ${cap(near)}.`
  return text.replace(/\s+/g, ' ').replace(/\.\s*\./g, '.').trim()
}

function blurbEn(genre, related) {
  const c = buildContext(genre, related, 'en')
  const { name, disp, seed, cue, cue2, mod, place, a1, a2, n1, n2, axis } = c
  const mode = ((seed >>> 3) + 5) % 12

  const mood =
    axis.dark && axis.dense
      ? pick(['dense and dark', 'little air, plenty of shade'], seed >> 11)
      : axis.dark
        ? pick(['a late-night mood', 'atmosphere over stadium hooks'], seed >> 11)
        : axis.bright
          ? pick(['open and energetic', 'brighter than average'], seed >> 11)
          : axis.dense
            ? pick(['thick texture', 'lots of layers, few gaps'], seed >> 11)
            : pick(['its own niche among neighbors', 'not trying to be everything'], seed >> 11)

  const who =
    a1 && a2 && a1 !== a2
      ? pick(
          [`Landmarks: ${a1} and ${a2}`, `You’ll often hear ${a1} and ${a2}`, `Start with ${a1} or ${a2}`],
          seed >> 13,
        )
      : a1
        ? pick([`A useful landmark is ${a1}`, `${a1} is a solid entry point`], seed >> 13)
        : ''

  const near =
    n1 && n2 && n1 !== n2
      ? pick(
          [
            `Nearby tastes: “${n1}” and “${n2}”`,
            `If it clicks, try “${n1}” or “${n2}” next`,
            `Neighbor tags: “${n1}”, “${n2}”`,
          ],
          seed >> 15,
        )
      : ''

  const placeLine = place
    ? pick(
        [`You can hear a ${place} accent.`, `There’s ${place} color in the sound.`, `It’s a ${place} angle on a bigger genre language.`],
        seed >> 17,
      )
    : ''

  const modLine = mod
    ? pick([`Plus ${mod}.`, `Tint: ${mod}.`, `Here ${mod} matters more.`], seed >> 19)
    : ''

  const mix = cue2
    ? pick([`Blend: ${cue} + ${cue2}.`, `Base ${cue}; on top, ${cue2}.`], seed >> 21)
    : ''

  const shapes = [
    () => [
      `${disp} is about ${cue}.`,
      placeLine || modLine,
      who || near,
      pick(
        [
          'Playlists matter more than textbook definitions.',
          'You usually get it in the first bars of timbre and rhythm.',
          'Borders are soft, but the center of gravity is real.',
        ],
        seed >> 23,
      ),
    ],
    () => [
      `On Spotify, “${name}” gathers tracks around ${cue}.`,
      modLine || `Feel: ${mood}.`,
      who,
      near && seed % 2 === 0 ? near : '',
    ],
    () => [
      who
        ? `If you like ${a1}, “${name}” is a natural next tag.`
        : `Treat “${name}” as its own scene, not just a near-neighbor.`,
      `Here it’s ${cue}.`,
      placeLine || modLine,
      near,
    ],
    () => [
      mix || `Genre code: ${cue}.`,
      `“${name}” feels ${mood}.`,
      who || placeLine,
      pick(
        ['One strong track beats a long theory page.', 'Vibe first, taxonomy second.'],
        seed >> 25,
      ),
    ],
    () => [
      near
        ? `Between “${n1}” and the wider catalog sits “${name}”: ${cue}.`
        : `“${name}” stands a bit apart: ${cue}.`,
      modLine || placeLine,
      who,
      `Overall: ${mood}.`,
    ],
    () => [
      `Short version: ${disp} = ${cue}${mod ? `; ${mod}` : ''}.`,
      placeLine,
      who ||
        pick(
          ['Start with the official genre playlist.', 'Then hop through related tags on the map.'],
          seed >> 27,
        ),
    ],
    () => [
      `The “${name}” scene grew around ${cue}.`,
      axis.bright
        ? 'It often lands as daytime/energetic.'
        : axis.dark
          ? 'It often leans night, intimate, or gloomy.'
          : 'Tempo and density depend on the release.',
      who || near,
      placeLine,
    ],
    () => [
      a1
        ? `${a1}${a2 && a2 !== a1 ? ` and ${a2}` : ''} often get named as landmarks for “${name}”.`
        : `“${name}” has no single face, but a shared code: ${cue}.`,
      a1 ? `Shared scene code: ${cue}.` : modLine || placeLine,
      near,
      pick(['Better a whole playlist than one single.', 'Vibe over rigid rules.'], seed >> 29),
    ],
    () => [
      `Don’t confuse “${name}” with its neighbors: the accent is ${cue}.`,
      placeLine || modLine,
      near ? `Yes, “${n1}” is close—but the center differs.` : `It feels ${mood}.`,
      who,
    ],
    () => [
      `Who it’s for: anyone after ${cue}.`,
      place ? `The ${place} color isn’t decoration.` : modLine,
      who || near,
      `Bottom line: ${mood}.`,
    ],
    () => [
      `“${name}” is a micro-scene in the catalog. Core: ${cue}.`,
      mix || modLine,
      who,
      near ||
        pick(
          [
            'Every Noise parks it near related tags.',
            'On streaming it’s more a playlist shelf than a “school”.',
          ],
          seed >> 31,
        ),
    ],
    () => [
      place ? `${disp} is a ${place} take on ${cue}.` : `${disp}: ${cue}.`,
      modLine,
      who ? `${who}—good start.` : near ? `${near}.` : 'Any fresh playlist with the tag works as a start.',
      pick(
        ['After a few tracks the label usually “clicks”.', 'Your ear will sort the rest.'],
        seed,
      ),
    ],
  ]

  const parts = shapes[mode]()
    .flat()
    .map((s) => String(s || '').trim())
    .filter(Boolean)
    .map((s) => (/[.!?…]$/.test(s) ? s : `${s}.`))

  let text = parts.join(' ')
  if (text.length < 90 && near) text = `${text} ${near}.`.replace(/\.\./g, '.')
  return text.replace(/\s+/g, ' ').replace(/\.\s*\./g, '.').trim()
}

async function atomicWrite(file, data) {
  const tmp = `${file}.${process.pid}.${Date.now()}.tmp`
  await writeFile(tmp, data)
  for (let i = 0; i < 6; i++) {
    try {
      await rename(tmp, file)
      return
    } catch (e) {
      if (['EPERM', 'EACCES', 'EBUSY'].includes(e?.code)) {
        await new Promise((r) => setTimeout(r, 120 * (i + 1)))
        continue
      }
      throw e
    }
  }
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

async function main() {
  const payload = JSON.parse(await readFile(GENRES, 'utf8'))
  const sim = existsSync(SIM)
    ? JSON.parse(await readFile(SIM, 'utf8'))
    : { related: {} }
  const related = sim.related || {}
  let disk = { descriptions: {} }
  if (existsSync(OUT)) {
    try {
      disk = JSON.parse(await readFile(OUT, 'utf8'))
    } catch {
      disk = { descriptions: {} }
    }
  }
  const descriptions = { ...(disk.descriptions || {}) }
  let filled = 0
  let kept = 0

  for (const g of payload.genres) {
    const name = g.name
    descriptions[name] = descriptions[name] || { byLang: {} }
    const byLang = { ...(descriptions[name].byLang || {}) }

    const prevRu = byLang.ru
    if (SEED_RU[name]) {
      byLang.ru = { text: SEED_RU[name], source: 'seed/ru' }
    } else if (FORCE && (!prevRu?.text || String(prevRu.source).startsWith('generated/'))) {
      byLang.ru = { text: blurbRu(g, related), source: 'generated/ru' }
      filled++
    } else if (!prevRu?.text) {
      byLang.ru = { text: blurbRu(g, related), source: 'generated/ru' }
      filled++
    } else if (isProtected(prevRu.source)) {
      kept++
    } else if (FORCE || String(prevRu.source).startsWith('generated/')) {
      byLang.ru = { text: blurbRu(g, related), source: 'generated/ru' }
      filled++
    }

    const prevEn = byLang.en
    if (SEED_EN[name]) {
      byLang.en = { text: SEED_EN[name], source: 'seed/en' }
    } else if (FORCE && (!prevEn?.text || String(prevEn.source).startsWith('generated/'))) {
      byLang.en = { text: blurbEn(g, related), source: 'generated/en' }
    } else if (!prevEn?.text) {
      byLang.en = { text: blurbEn(g, related), source: 'generated/en' }
    } else if (!isProtected(prevEn.source) && (FORCE || String(prevEn.source).startsWith('generated/'))) {
      byLang.en = { text: blurbEn(g, related), source: 'generated/en' }
    }

    descriptions[name].byLang = byLang
  }

  for (const [name, text] of Object.entries(SEED_RU)) {
    descriptions[name] = descriptions[name] || { byLang: {} }
    descriptions[name].byLang.ru = { text, source: 'seed/ru' }
  }
  for (const [name, text] of Object.entries(SEED_EN)) {
    descriptions[name] = descriptions[name] || { byLang: {} }
    descriptions[name].byLang.en = { text, source: 'seed/en' }
  }

  let langs = 0
  let real = 0
  for (const v of Object.values(descriptions)) {
    for (const b of Object.values(v.byLang || {})) {
      if (!b?.text) continue
      langs++
      if (isProtected(b.source)) real++
    }
  }

  await mkdir(path.dirname(OUT), { recursive: true })
  await atomicWrite(
    OUT,
    JSON.stringify({
      updatedAt: new Date().toISOString(),
      count: Object.keys(descriptions).length,
      langEntries: langs,
      realEntries: real,
      descriptions,
    }),
  )
  console.log(
    JSON.stringify(
      {
        count: Object.keys(descriptions).length,
        filledGeneratedApprox: filled,
        protectedKept: kept,
        realEntries: real,
        langEntries: langs,
        out: OUT,
      },
      null,
      2,
    ),
  )
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
