import type { Genre } from '../types'
import type { TasteMode } from './storage'

export type SimilarityIndex = Record<string, string[]>

function normName(s: string): string {
  return s.toLowerCase().trim().replace(/\s+/g, ' ')
}

/** Map Spotify genre labels → our genre ids */
export function matchTasteGenreIds(
  spotifyGenres: string[],
  catalog: Genre[],
): string[] {
  return [...matchTasteGenreScores(spotifyGenres, catalog).keys()]
}

/** Weighted label → catalog genre id scores */
export function matchTasteGenreScores(
  spotifyGenres: string[],
  catalog: Genre[],
  labelWeights?: Record<string, number>,
): Map<string, number> {
  const byName = new Map(catalog.map((g) => [g.name.toLowerCase(), g.id]))
  const out = new Map<string, number>()
  const bump = (id: string, v: number) => {
    out.set(id, Math.max(out.get(id) ?? 0, v))
  }

  for (const raw of spotifyGenres) {
    const name = normName(raw)
    if (!name) continue
    const lw = labelWeights?.[name] ?? labelWeights?.[raw.toLowerCase()] ?? 1
    const strength = Math.min(1.4, 0.55 + lw * 0.35)

    const exact = byName.get(name)
    if (exact) {
      bump(exact, strength)
      continue
    }
    for (const g of catalog) {
      const n = g.name.toLowerCase()
      if (n === name) {
        bump(g.id, strength)
        continue
      }
      if (n.includes(name) || name.includes(n)) {
        if (Math.abs(n.length - name.length) <= 10) {
          const ratio =
            Math.min(n.length, name.length) /
            Math.max(n.length, name.length)
          bump(g.id, strength * (0.55 + ratio * 0.4))
        }
      }
    }
  }
  return out
}

/** Genres in our catalog that list any of these Spotify artist ids */
export function matchArtistGenreIds(
  artistIds: string[],
  catalog: Genre[],
): string[] {
  return [...matchArtistGenreScores(artistIds, catalog).keys()]
}

export function matchArtistGenreScores(
  artistIds: string[],
  catalog: Genre[],
  artistWeights?: Record<string, number>,
): Map<string, number> {
  if (!artistIds.length) return new Map()
  const wanted = new Set(artistIds)
  const out = new Map<string, number>()
  for (const g of catalog) {
    let hits = 0
    let weightSum = 0
    for (const a of g.artists ?? []) {
      if (a.id && wanted.has(a.id)) {
        hits++
        weightSum += artistWeights?.[a.id] ?? 1
      }
    }
    if (!hits) continue
    out.set(
      g.id,
      Math.min(1.5, 0.4 + hits * 0.28 + Math.min(0.5, weightSum * 0.08)),
    )
  }
  return out
}

/** Match artists by display name when Spotify id is missing in catalog */
export function matchArtistNameGenreScores(
  artistNames: string[],
  catalog: Genre[],
): Map<string, number> {
  if (!artistNames.length) return new Map()
  const wanted = new Set(artistNames.map(normName).filter(Boolean))
  const out = new Map<string, number>()
  for (const g of catalog) {
    let hits = 0
    for (const a of g.artists ?? []) {
      if (a.name && wanted.has(normName(a.name))) hits++
    }
    if (!hits) continue
    out.set(g.id, Math.min(1.2, 0.38 + hits * 0.26))
  }
  return out
}

export function combineTasteGenreIds(
  genreLabels: string[],
  artistIds: string[],
  catalog: Genre[],
  artistNames: string[] = [],
): string[] {
  const out = new Set<string>([
    ...matchTasteGenreIds(genreLabels, catalog),
    ...matchArtistGenreIds(artistIds, catalog),
    ...matchArtistNameGenreScores(artistNames, catalog).keys(),
  ])
  return [...out]
}

export type CatalogTasteSignals = {
  genreLabels?: string[]
  genreLabelWeights?: Record<string, number>
  artistIds?: string[]
  artistWeights?: Record<string, number>
  artistNames?: string[]
  likedGenreIds?: string[]
  likedArtistIds?: string[]
  likedArtistNames?: string[]
}

/**
 * Direct catalog scores from Spotify listening + onboarding picks.
 * Values roughly in 0…1.6 before seed-graph expansion.
 */
export function buildCatalogLinkScores(
  catalog: Genre[],
  signals: CatalogTasteSignals,
): Map<string, number> {
  const scores = new Map<string, number>()
  const bump = (id: string, v: number) => {
    scores.set(id, Math.max(scores.get(id) ?? 0, v))
  }

  const labels =
    signals.genreLabels ??
    Object.keys(signals.genreLabelWeights ?? {})
  for (const [id, v] of matchTasteGenreScores(
    labels,
    catalog,
    signals.genreLabelWeights,
  )) {
    bump(id, v)
  }

  const artistIds = [
    ...new Set([
      ...(signals.artistIds ?? []),
      ...(signals.likedArtistIds ?? []),
      ...Object.keys(signals.artistWeights ?? {}),
    ]),
  ]
  for (const [id, v] of matchArtistGenreScores(
    artistIds,
    catalog,
    signals.artistWeights,
  )) {
    bump(id, v * 1.05)
  }

  const names = [
    ...new Set([
      ...(signals.artistNames ?? []),
      ...(signals.likedArtistNames ?? []),
    ]),
  ]
  for (const [id, v] of matchArtistNameGenreScores(names, catalog)) {
    bump(id, v * 0.95)
  }

  // Onboarding / saved genre likes are hard seeds
  for (const id of signals.likedGenreIds ?? []) {
    bump(id, 1.15)
  }

  return scores
}

/** How strongly a catalog genre overlaps Spotify / onboarding artists */
export function artistOverlapScore(
  genreId: string,
  artistIds: string[],
  catalogById: Map<string, Genre>,
  artistWeights?: Record<string, number>,
  artistNames?: string[],
): number {
  const g = catalogById.get(genreId)
  if (!g?.artists?.length) return 0

  const wanted = new Set(artistIds)
  const wantedNames = new Set((artistNames ?? []).map(normName).filter(Boolean))
  let hits = 0
  let weightSum = 0
  for (const a of g.artists) {
    if (a.id && wanted.has(a.id)) {
      hits++
      weightSum += artistWeights?.[a.id] ?? 1
    } else if (a.name && wantedNames.has(normName(a.name))) {
      hits++
      weightSum += 0.7
    }
  }
  if (!hits) return 0
  return Math.min(
    1,
    0.4 + hits * 0.22 + Math.min(0.35, weightSum * 0.06),
  )
}

/**
 * Seed graph: core likes / Spotify taste → direct neighbors (subgenres) → 2nd hop.
 * Strength: seed=1, neighbor≈0.82, hop2≈0.45
 * Optional `linkScores` (Spotify/onboarding → catalog) raise seed strength + expand graph.
 */
export function buildTasteSeedScores(
  seedIds: string[],
  related: Map<string, Set<string>>,
  simIndex: SimilarityIndex = {},
  linkScores: Map<string, number> = new Map(),
): Map<string, number> {
  const scores = new Map<string, number>()
  const seeds = new Set(seedIds)

  // Strong link hits become seeds even if not in prefs.liked
  for (const [id, v] of linkScores) {
    if (v >= 0.45) seeds.add(id)
  }

  if (!seeds.size && !linkScores.size) return scores

  const bump = (id: string, v: number) => {
    scores.set(id, Math.max(scores.get(id) ?? 0, v))
  }

  for (const id of seeds) {
    const link = linkScores.get(id) ?? 0
    bump(id, Math.min(1.2, 1 + Math.max(0, link - 0.5) * 0.25))
  }

  // Non-seed link hits still get a direct affinity score
  for (const [id, v] of linkScores) {
    if (seeds.has(id)) continue
    bump(id, Math.min(0.92, 0.35 + v * 0.45))
  }

  const seedList = [...seeds]
  for (const seed of seedList) {
    const seedStrength = scores.get(seed) ?? 1
    const ordered = simIndex[seed] ?? []
    ordered.slice(0, 16).forEach((id, i) => {
      // Earlier in Every Noise related list = closer / more “subgenre-like”
      bump(id, (0.88 - Math.min(0.28, i * 0.028)) * Math.min(1, seedStrength))
    })
    for (const id of related.get(seed) ?? []) {
      bump(id, 0.72 * Math.min(1, seedStrength))
    }
  }

  // Second hop from strong neighbors (not from seeds again)
  const firstRing = [...scores.entries()]
    .filter(([id, s]) => s >= 0.7 && s < 1 && !seeds.has(id))
    .map(([id]) => id)
  for (const n of firstRing.slice(0, 48)) {
    for (const id of (simIndex[n] ?? []).slice(0, 6)) {
      if (seeds.has(id)) continue
      bump(id, 0.42)
    }
    for (const id of related.get(n) ?? []) {
      if (seeds.has(id)) continue
      bump(id, 0.36)
    }
  }

  return scores
}

/** Name-based subgenre hint: seed "metal" ↔ "power metal", "black metal" */
export function nameSubgenreScore(
  genreName: string,
  seedNames: string[],
): number {
  if (!seedNames.length) return 0
  const n = genreName.toLowerCase()
  let best = 0
  for (const raw of seedNames) {
    const s = raw.toLowerCase()
    if (!s || s === n) continue
    if (n.includes(s) || s.includes(n)) {
      const ratio =
        Math.min(s.length, n.length) / Math.max(s.length, n.length)
      best = Math.max(best, 0.55 + ratio * 0.35)
    } else {
      const sw = new Set(s.split(/[\s-]+/).filter((w) => w.length > 2))
      const nw = n.split(/[\s-]+/).filter((w) => w.length > 2)
      let hits = 0
      for (const w of nw) if (sw.has(w)) hits++
      if (hits > 0) best = Math.max(best, 0.35 + hits * 0.15)
    }
  }
  return Math.min(1, best)
}

export function tasteAffinity(
  genreId: string,
  tasteIds: string[],
  related: Map<string, Set<string>>,
): number {
  if (!tasteIds.length) return 0
  if (tasteIds.includes(genreId)) return 1
  const mine = related.get(genreId)
  let hits = 0
  for (const t of tasteIds) {
    if (mine?.has(t) || related.get(t)?.has(genreId)) hits++
  }
  if (!hits) return 0
  return Math.min(1, 0.35 + hits * 0.2)
}

export type TasteWeightOptions = {
  artistIds?: string[]
  artistWeights?: Record<string, number>
  artistNames?: string[]
  catalogById?: Map<string, Genre>
  seedScores?: Map<string, number>
  seedNames?: string[]
  /** Prefer exploring near taste early (0…1), then widen */
  focus?: number
}

export function tasteWeightMultiplier(
  genreId: string,
  mode: TasteMode,
  tasteIds: string[],
  related: Map<string, Set<string>>,
  options: TasteWeightOptions = {},
): number {
  const seedScores = options.seedScores
  const hasSeeds =
    (seedScores && seedScores.size > 0) ||
    tasteIds.length > 0 ||
    (options.artistIds?.length ?? 0) > 0 ||
    (options.artistNames?.length ?? 0) > 0

  if (!hasSeeds) return 1
  // Callers that want off+seeds pass mode 'taste' from deck; pure off stays neutral
  if (mode === 'off') return 1

  const genre = options.catalogById?.get(genreId)
  const seedScore = seedScores?.get(genreId) ?? 0
  const labelA = tasteAffinity(genreId, tasteIds, related)
  const nameA = genre
    ? nameSubgenreScore(genre.name, options.seedNames ?? [])
    : 0
  const artistA =
    options.catalogById &&
    ((options.artistIds?.length ?? 0) > 0 ||
      (options.artistNames?.length ?? 0) > 0)
      ? artistOverlapScore(
          genreId,
          options.artistIds ?? [],
          options.catalogById,
          options.artistWeights,
          options.artistNames,
        )
      : 0

  const a = Math.max(seedScore, labelA, nameA * 0.9, artistA * 1.15)
  const focus = options.focus ?? 0.65

  if (mode === 'anti') {
    if (artistA >= 0.5 || seedScore >= 0.85) return 0.1
    if (a > 0.35) return Math.max(0.12, 1 - a * 0.95)
    return 4.8 + (1 - focus) * 1.2
  }

  // taste mode: push subgenres / neighbors first
  if (seedScore >= 0.95) return 0.55 // already picked seed — de-emphasize exact repeats
  if (artistA >= 0.6) return 11 * (0.7 + focus * 0.5)
  if (seedScore >= 0.75) return (7.5 + seedScore * 6) * (0.75 + focus * 0.45)
  if (seedScore >= 0.4 || nameA >= 0.55) {
    return (2.4 + a * 5.2) * (0.7 + focus * 0.5)
  }
  if (a > 0) return (1.25 + a * 3.6) * (0.55 + focus * 0.3)
  // Far from taste: damp hard while focused, loosen later
  return Math.max(0.08, 0.32 - focus * 0.22)
}

/** Curated starter chips that usually exist in the Every Noise catalog */
export const ONBOARDING_GENRE_SUGGESTIONS = [
  'pop',
  'rock',
  'hip hop',
  'rap',
  'electronic',
  'classical',
  'jazz',
  'metal',
  'indie',
  'r&b',
  'soul',
  'folk',
  'country',
  'punk',
  'techno',
  'house',
  'ambient',
  'k-pop',
  'latin',
  'blues',
  'reggae',
  'alternative',
  'post-punk',
  'synthwave',
  'hyperpop',
]
