import {
  hash,
  pick,
  titleish,
  cap,
  familyHits,
  artists,
  neighbors,
  mapAxis,
} from './genre-blurb-shared.mjs'
import { FAMILY, MOD, PLACE } from './genre-blurb-data-base.mjs'
import {
  FAMILY_EXTRA as FAMILY_EXTRA_SECONDARY,
  MOD_EXTRA as MOD_EXTRA_SECONDARY,
  PLACE_EXTRA as PLACE_EXTRA_SECONDARY,
  PHRASES as PHRASES_SECONDARY,
  MODE_OFFSET as MODE_OFFSET_SECONDARY,
} from './genre-blurb-i18n-secondary.mjs'
import {
  FAMILY_EXTRA as FAMILY_EXTRA_EXTRA,
  MOD_EXTRA as MOD_EXTRA_EXTRA,
  PLACE_EXTRA as PLACE_EXTRA_EXTRA,
  PHRASES as PHRASES_EXTRA,
  MODE_OFFSET as MODE_OFFSET_EXTRA,
} from './genre-blurb-i18n-extra.mjs'

const PHRASES = { ...PHRASES_SECONDARY, ...PHRASES_EXTRA }
const MODE_OFFSET = { ...MODE_OFFSET_SECONDARY, ...MODE_OFFSET_EXTRA }

const FAMILY_FULL = mergeDeep(mergeDeep(FAMILY, FAMILY_EXTRA_SECONDARY), FAMILY_EXTRA_EXTRA)
const MOD_FULL = mergeDeep(mergeDeep(MOD, MOD_EXTRA_SECONDARY), MOD_EXTRA_EXTRA)
const PLACE_FULL = PLACE.map(([keys, labels], i) => [
  keys,
  { ...labels, ...(PLACE_EXTRA_SECONDARY[i] || {}), ...(PLACE_EXTRA_EXTRA[i] || {}) },
])

function mergeDeep(base, extra) {
  const out = { ...base }
  for (const [k, v] of Object.entries(extra || {})) {
    out[k] = { ...(out[k] || {}), ...v }
  }
  return out
}

function familyKeys() {
  return Object.keys(FAMILY_FULL)
}

function familyCue(name, seed, lang) {
  const { hits } = familyHits(name, familyKeys())
  if (hits.length) {
    const key = hits[0]
    const arr = FAMILY_FULL[key][lang] || FAMILY_FULL[key].en || FAMILY_FULL[key].ru
    return pick(arr, seed)
  }
  const p = PHRASES[lang]
  return pick(p.fallbackCue, seed)
}

function modBits(name, seed, lang, skip = new Set()) {
  const t = tokens(name)
  const bits = []
  for (const [k, v] of Object.entries(MOD_FULL)) {
    if (skip.has(k)) continue
    if (t.includes(k) || t.some((w) => w.includes(k) && k.length >= 4)) {
      const text = v[lang] || v.en
      if (text) bits.push(text)
    }
  }
  if (!bits.length) return ''
  return pick(bits, seed)
}

function tokens(name) {
  return String(name)
    .toLowerCase()
    .split(/[\s/_-]+/)
    .filter((t) => t.length > 1)
}

function placeBit(name, lang) {
  const t = tokens(name)
  const joined = t.join(' ')
  for (const [keys, lab] of PLACE_FULL) {
    if (
      keys.some((k) => {
        if (t.includes(k)) return true
        if (k.length >= 5 && joined.includes(k)) return true
        return false
      })
    )
      return lab[lang] || lab.en
  }
  if (t.length >= 2 && t[0].length >= 4 && !FAMILY_FULL[t[0]] && !MOD_FULL[t[0]]) {
    const p = PHRASES[lang]
    return p.localPlace(t[0])
  }
  return ''
}

function buildContext(genre, related, lang) {
  const name = genre.name
  const seed = hash(`${name}:${lang}`)
  const { hits } = familyHits(name, familyKeys())
  const cue = familyCue(name, seed >> 1, lang)
  const cue2 =
    hits.length > 1
      ? pick(
          FAMILY_FULL[hits[1]][lang] || FAMILY_FULL[hits[1]].en || FAMILY_FULL[hits[1]].ru,
          seed >> 3,
        )
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

export function blurbForLang(genre, related, lang) {
  const c = buildContext(genre, related, lang)
  const p = PHRASES[lang]
  const { name, disp, seed, cue, cue2, mod, place, a1, a2, n1, n2, axis } = c
  const offset = MODE_OFFSET[lang] ?? 0
  const mode = ((seed >>> 0) + offset) % 12

  const mood =
    axis.dark && axis.dense
      ? pick(p.mood.darkDense, seed >> 11)
      : axis.dark
        ? pick(p.mood.dark, seed >> 11)
        : axis.bright
          ? pick(p.mood.bright, seed >> 11)
          : axis.dense
            ? pick(p.mood.dense, seed >> 11)
            : pick(p.mood.default, seed >> 11)

  const who =
    a1 && a2 && a1 !== a2
      ? pick(
          p.whoTwo.map((fn) => fn(a1, a2)),
          seed >> 13,
        )
      : a1
        ? pick(
            p.whoOne.map((fn) => fn(a1)),
            seed >> 13,
          )
        : ''

  const near =
    n1 && n2 && n1 !== n2
      ? pick(
          p.nearTwo.map((fn) => fn(n1, n2)),
          seed >> 15,
        )
      : ''

  const placeLine = place
    ? pick(
        p.placeLine.map((fn) => fn(place)),
        seed >> 17,
      )
    : ''

  const modLine = mod
    ? pick(
        p.modLine.map((fn) => fn(mod)),
        seed >> 19,
      )
    : ''

  const mix = cue2
    ? pick(
        p.mix.map((fn) => fn(cue, cue2)),
        seed >> 21,
      )
    : ''

  const shapes = p.shapes(c, { mood, who, near, placeLine, modLine, mix })
  const parts = shapes[mode]()
    .flat()
    .map((s) => String(s || '').trim())
    .filter(Boolean)
    .map((s) => cap(s))
    .map((s) => (p.endsSentence(s) ? s : `${s}.`))

  let text = parts.join(' ')
  if (text.length < 90 && near) text = `${text} ${cap(near)}.`
  return text.replace(/\s+/g, ' ').replace(/\.\s*\./g, '.').trim()
}
