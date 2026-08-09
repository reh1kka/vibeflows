import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '../..')
const OUT = path.join(ROOT, 'public', 'genre-descriptions.json')
const CACHE = path.join(ROOT, 'data', 'wiki-cache.json')

// Hand-checked short extracts (Wikipedia / common refs), kept brief
const SEED = {
  pop: 'Pop is mainstream popular music with catchy melodies, verse–chorus forms and production aimed at broad radio and streaming audiences.',
  anime:
    'As a Spotify genre tag, anime usually points to Japanese anime theme songs, OSTs and related J-pop/rock crossovers rather than animation as a medium.',
  'anime score':
    'Anime score covers original soundtracks written for Japanese animation—leitmotifs, dramatic cues and album versions of series themes.',
  vaporwave:
    'Vaporwave is an internet music microgenre and aesthetic that emerged in the early 2010s, built on chopped, slowed samples of lounge, elevatorsmooth pop and 1980s–90s corporate mood music.',
  hyperpop:
    'Hyperpop is a loosely defined electronic pop movement from the 2010s: maximalist, glossy, pitch-shifted vocals and chaotic internet-native production.',
  'black metal':
    'Black metal is an extreme heavy metal style known for fast tempos, shrieked vocals, heavily distorted guitars and a raw, atmospheric sound.',
  'bossa nova':
    'Bossa nova is a relaxed samba style that developed in late-1950s Rio de Janeiro, mixing Brazilian rhythm with cool jazz harmony.',
  dubstep:
    'Dubstep is a UK electronic dance style from the early 2000s, marked by sparse rhythm, heavy bass weight and distinctive wobble-bass textures.',
  shoegaze:
    'Shoegaze is an alternative rock style of the late 1980s/early 1990s with washed-out vocals, walls of guitar effects and immersive texture.',
  synthwave:
    'Synthwave is a retro-electronic style that evokes 1980s film and game soundtracks through analog-style synths, neon nostalgia and driving beats.',
  phonk:
    'Phonk blends hip-hop with samples from 1990s Memphis rap—cowbells, distorted bass and lo-fi grit—later crossing into internet and drift-culture edits.',
  'k-pop':
    'K-pop is South Korean popular music that mixes polished pop, hip-hop and electronic production with tightly choreographed idol-group performance culture.',
  'hip hop':
    'Hip hop is a cultural and musical form born in 1970s New York, built around rapping, DJing, breaks and later studio production and sampling.',
  drill:
    'Drill is a hip-hop style with dark sliding 808s and stark delivery; it began in Chicago and later branched into UK and other local scenes.',
  'city pop':
    'City pop is a Japanese pop style of the late 1970s–80s with glossy Western-influenced grooves, urban leisure imagery and soft-rock/funk sheen.',
  ambient:
    'Ambient music emphasizes atmosphere and tone over traditional song structure—often spacious, immersive and designed for environment as much as attention.',
  techno:
    'Techno is electronic dance music that emerged in Detroit, built on repetitive machine rhythms, synthetic timbres and long-form club energy.',
  house:
    'House is a dance music style born in 1980s Chicago, with four-on-the-floor beats, soulful or vocal hooks and club-centered groove.',
  jazz:
    'Jazz is a music rooted in African American traditions, known for swing, improvisation, blue notes and evolving styles from early New Orleans to modern forms.',
  reggae:
    'Reggae developed in Jamaica in the late 1960s, with offbeat accents, bass-forward grooves and strong ties to sound-system culture.',
  'dream pop':
    'Dream pop favors hazy vocals, reverb-heavy guitars and soft-focus atmosphere—more mood and texture than sharp hooks.',
  grime:
    'Grime is a UK electronic/rap style from early-2000s East London: jagged syncopation, MC delivery and sparse, aggressive beats.',
  'lo-fi':
    'Lo-fi (as a listening tag) points to warm, imperfect, often bedroom-made music—tape hiss, soft beats and intentionally unpolished charm.',
  afrobeats:
    'Afrobeats is a contemporary West African pop continuum mixing highlife, hip-hop and dance rhythms into globally exported club and radio hits.',
  amapiano:
    'Amapiano is a South African house-derived style with lush log drums, wide bass and relaxed, groove-first arrangements.',
  reggaeton:
    'Reggaeton fuses Latin rhythms with hip-hop and dancehall influence, centered on the dembow beat and Spanish-language vocals.',
  'drum and bass':
    'Drum and bass is a UK electronic style built on breakbeats at high tempo, heavy basslines and energetic club dynamics.',
  garage:
    'UK garage is a late-1990s British club style with shuffled rhythms, warm bass and often MC or vocal hooks.',
  trap:
    'Trap is a hip-hop style marked by crisp hi-hats, booming 808s and Southern US roots that later shaped global pop and electronic crossovers.',
  punk:
    'Punk is a fast, raw rock style and culture of the 1970s that prized short songs, DIY ethics and anti-establishment attitude.',
  'heavy metal':
    'Heavy metal grew from late-1960s hard rock into a louder, riff-driven style with powerful vocals and virtuosic or aggressive guitar work.',
  soul:
    'Soul music combines rhythm and blues with gospel feeling—emotive vocals, strong grooves and a central place in African American popular music.',
  funk:
    'Funk emphasizes interlocking rhythm, syncopated bass and groove as the main event, often with horns and rhythmic guitar chops.',
  samba:
    'Samba is a Brazilian musical tradition with syncopated percussion, carnival roots and many urban and ballroom offshoots.',
  flamenco:
    'Flamenco is an Andalusian art of song, dance and guitar—intense vocal cante, rhythmic palmas and expressive movement.',
  'new wave':
    'New wave was a late-1970s/early-1980s pop-rock movement after punk, often with synths, angular guitars and stylish modern production.',
  industrial:
    'Industrial music uses abrasive noise, mechanical rhythms and confrontational aesthetics, from early experiments to later metal/electronic hybrids.',
  'post-punk':
    'Post-punk followed punk with angular basslines, atmosphere and art-school edges—urgent and DIY, but more experimental than three-chord thrash. The Russian/postsoviet wave adds cold synths, deadpan vocals and late-night city mood.',
  'math rock':
    'Math rock features complex rhythms, odd time signatures and precise guitar interplay—technical but often melodic.',
  'post-rock':
    'Post-rock builds rock instrumentation into expansive, often instrumental arcs—dynamics and texture over verse-chorus pop form.',
  'blackgaze':
    'Blackgaze blends black metal intensity with shoegaze haze—blast beats and screams wrapped in luminous guitar wash.',
  'witch house':
    'Witch house is an occult-tinged electronic microgenre with chopped vocals, horror aesthetics and slowed, haunted club textures.',
  seapunk:
    'Seapunk was an early-2010s internet aesthetic/microgenre mixing aquatic rave imagery with retro web and dance-pop fragments.',
  'chillwave':
    'Chillwave is a late-2000s lo-fi electronic pop style with washed synths, nostalgia and summer-haze atmosphere.',
  'future funk':
    'Future funk is a vaporwave-adjacent dance style that loops and brightens 1980s funk/city-pop samples into upbeat edits.',
  mallsoft:
    'Mallsoft, a vaporwave offshoot, evokes empty shopping-mall ambience—muzak, reverb and late-capitalist quiet.',
  breakcore:
    'Breakcore is an extreme electronic style built on chopped Amen breaks, chaotic edits and high-BPM intensity—closer to jungle/IDM aggression than club polish.',
  rage:
    'Rage (sometimes tagged with related internet styles) points to distorted 808s, shouting hooks and hyper-aggressive beat music adjacent to trap.',
}

function shorten(text, max = 340) {
  const clean = text.replace(/\s+/g, ' ').trim()
  if (clean.length <= max) return clean
  const cut = clean.slice(0, max)
  const lastStop = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('! '))
  if (lastStop > 100) return cut.slice(0, lastStop + 1).trim()
  return `${cut.trim()}…`
}

const cache = existsSync(CACHE) ? JSON.parse(await readFile(CACHE, 'utf8')) : {}
const existing = existsSync(OUT)
  ? JSON.parse(await readFile(OUT, 'utf8'))
  : { descriptions: {} }

for (const [name, text] of Object.entries(SEED)) {
  const entry = {
    text: shorten(text),
    lang: 'en',
    source: 'seed/wikipedia-style short blurb',
    wikiTitle: name,
  }
  cache[name] = entry
  existing.descriptions[name] = {
    text: entry.text,
    lang: entry.lang,
    source: entry.source,
  }
}

await mkdir(path.dirname(CACHE), { recursive: true })
await writeFile(CACHE, JSON.stringify(cache))
existing.updatedAt = new Date().toISOString()
existing.count = Object.keys(existing.descriptions).length
await writeFile(OUT, JSON.stringify(existing))
console.log('seeded', Object.keys(SEED).length, 'total', existing.count)
