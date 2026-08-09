import type { Genre } from '../types'
import type { Locale } from '../i18n'
import {
  ARTIST_ABOUT,
  FALLBACKS,
  type WikiBlurb,
} from './describeFallbacks'

let wikiMap: Record<string, WikiBlurb> = {}
let activeLocale: Locale = 'ru'

export function setGenreWikiBlurbs(map: Record<string, WikiBlurb>) {
  wikiMap = normalizeBlurbs(map)
}

export function setDescribeLocale(locale: Locale) {
  activeLocale = locale
}

function normalizeBlurbs(
  map: Record<string, WikiBlurb>,
): Record<string, WikiBlurb> {
  const out: Record<string, WikiBlurb> = {}
  for (const [k, v] of Object.entries(map || {})) {
    if (!v) continue
    if (v.byLang && Object.keys(v.byLang).length) {
      out[k] = v
      continue
    }
    if (v.text) {
      const lang = (v.lang as Locale) || 'ru'
      out[k] = {
        byLang: {
          [lang]: { text: v.text, source: v.source },
        },
      }
    }
  }
  return out
}

function hash(s: string) {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
  return h
}

function pick<T>(arr: T[], seed: number) {
  return arr[seed % arr.length]
}

function blurbFor(genreName: string, locale: Locale): string | null {
  const entry = wikiMap[genreName]
  if (!entry?.byLang) return null
  // Prefer exact locale only — never show another language's prose as "translation"
  const exact = entry.byLang[locale]?.text
  if (exact && exact.length > 40) return exact
  return null
}

function fallbackDescribe(genre: Genre, locale: Locale): string {
  const fb = FALLBACKS[locale] ?? FALLBACKS.en
  const seed = hash(genre.id + genre.name)
  const name = genre.name
  const artists = (genre.artists ?? []).filter((a) => a.name).slice(0, 3)
  const open = pick(fb.open, seed).replaceAll('{name}', name)
  const vibe = pick(fb.vibe, seed >> 3)
  const people =
    artists.length >= 2
      ? fb.peopleMany(artists.map((a) => a.name).join(', '))
      : genre.exampleArtist
        ? fb.peopleOne(genre.exampleArtist, genre.exampleTrack)
        : fb.peopleNone
  return `${open} ${vibe} ${people}`
}

export function describeGenre(genre: Genre, _all: Genre[], locale?: Locale): string {
  const loc = locale ?? activeLocale
  const fb = FALLBACKS[loc] ?? FALLBACKS.en
  const isPostPunk = genre.id === 'post-punk' || genre.name === 'post-punk'
  const text = blurbFor(genre.name, loc)
  const favorite =
    isPostPunk && !(text || '').toLowerCase().includes('favorite') &&
    !(text || '').includes('любимый жанр') &&
    !(text || '').includes('улюблений жанр') &&
    !(text || '').includes('ulubiony gatunek') &&
    !(text || '').includes('แนวโปรด') &&
    !(text || '').includes('最爱的流派') &&
    !(text || '').toLowerCase().includes('género favorito') &&
    !(text || '').toLowerCase().includes('gênero favorito') &&
    !(text || '').includes('Lieblingsgenre') &&
    !(text || '').includes('お気に入りのジャンル')
      ? fb.favorite
      : ''

  if (text) {
    const artists = (genre.artists ?? []).filter((a) => a.name).slice(0, 2)
    const tail =
      artists.length >= 1
        ? fb.nearMany(artists.map((a) => a.name).join(', '))
        : genre.exampleArtist
          ? fb.nearOne(genre.exampleArtist)
          : ''
    const base = text.length > 360 ? `${text.slice(0, 357).trim()}…` : text
    return `${base}${favorite}${tail}`
  }
  return `${fallbackDescribe(genre, loc)}${favorite}`
}

export function artistAboutBlurb(
  name: string,
  genres: string[],
  seed: number,
  locale?: Locale,
): string {
  const loc = locale ?? activeLocale
  const g =
    genres.slice(0, 2).join(' / ') ||
    pick(['indie', 'electronic', 'alt'], seed)
  const variants = ARTIST_ABOUT[loc] ?? ARTIST_ABOUT.en
  return pick(variants, seed)(name, g)
}
