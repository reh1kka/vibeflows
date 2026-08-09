import type { Genre, Preferences } from '../types'
import {
  LIKED_REAPPEAR_AFTER,
  type TasteMode,
} from './storage'
import {
  buildCatalogLinkScores,
  buildTasteSeedScores,
  tasteWeightMultiplier,
  type CatalogTasteSignals,
  type SimilarityIndex,
} from './taste'

export type { SimilarityIndex }

/** Build reverse lookup: genreId -> set of genres that list it as related / are related */
export function buildRelatedSets(
  index: SimilarityIndex,
): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>()
  const ensure = (id: string) => {
    let s = map.get(id)
    if (!s) {
      s = new Set()
      map.set(id, s)
    }
    return s
  }
  for (const [id, related] of Object.entries(index)) {
    const set = ensure(id)
    for (const r of related) {
      set.add(r)
      ensure(r).add(id)
    }
  }
  return map
}

function relatedBoost(
  genreId: string,
  likedIds: string[],
  related: Map<string, Set<string>>,
  simIndex: SimilarityIndex,
  seedScores: Map<string, number>,
): number {
  if (!likedIds.length && seedScores.size === 0) return 0

  const seed = seedScores.get(genreId) ?? 0
  if (seed >= 0.75) return 6 + seed * 8
  if (seed >= 0.4) return 3 + seed * 5

  let hits = 0
  let direct = 0
  const mine = related.get(genreId)
  for (const liked of likedIds) {
    if (genreId === liked) continue
    const list = simIndex[liked] ?? []
    if (list.includes(genreId)) direct++
    const theirs = related.get(liked)
    if (theirs?.has(genreId) || mine?.has(liked)) hits++
  }
  if (direct > 0) return Math.min(14, 8 + direct * 3)
  if (!hits) return 0
  return Math.min(8, 3 + hits * 2.5)
}

export type PickOptions = {
  tasteMode?: TasteMode
  tasteGenreIds?: string[]
  tasteArtistIds?: string[]
  tasteArtistNames?: string[]
  tasteArtistWeights?: Record<string, number>
  tasteSignals?: CatalogTasteSignals
  simIndex?: SimilarityIndex
  /** How many cards already shown this session — early = stay near taste */
  seenCount?: number
  /** Lifetime swipe counter (persisted) */
  swipeCount?: number
  /** swipeCount when liked genre was last locked out */
  likedAt?: Record<string, number>
}

function likedOnCooldown(
  genreId: string,
  likedSet: Set<string>,
  likedAt: Record<string, number>,
  swipeCount: number,
): boolean {
  if (!likedSet.has(genreId)) return false
  // Missing timestamp → treat as liked at deck start
  const at = likedAt[genreId] ?? 0
  return swipeCount - at < LIKED_REAPPEAR_AFTER
}

/** Weighted pick — never talks to Spotify; only local prefs + optional taste ids */
export function pickNextGenre(
  genres: Genre[],
  prefs: Preferences,
  excludeIds: Set<string>,
  related: Map<string, Set<string>>,
  options: PickOptions = {},
): Genre | null {
  const disliked = new Set(prefs.disliked)
  const likedSet = new Set(prefs.liked)
  const likedIds = prefs.liked.filter((id) => !disliked.has(id))
  const tasteMode = options.tasteMode ?? 'off'
  const tasteIds = [
    ...new Set([...(options.tasteGenreIds ?? []), ...likedIds]),
  ]
  const tasteArtistIds = [
    ...new Set([
      ...(options.tasteArtistIds ?? []),
      ...(prefs.likedArtistIds ?? []),
    ]),
  ]
  const tasteArtistNames = [
    ...new Set([
      ...(options.tasteArtistNames ?? []),
      ...(prefs.likedArtistNames ?? []),
    ]),
  ]
  const tasteArtistWeights = options.tasteArtistWeights ?? {}
  const simIndex = options.simIndex ?? {}
  const catalogById = new Map(genres.map((g) => [g.id, g]))
  const swipeCount = options.swipeCount ?? 0
  const likedAt = options.likedAt ?? {}

  const linkScores = buildCatalogLinkScores(genres, {
    ...(options.tasteSignals ?? {}),
    likedGenreIds: [
      ...new Set([
        ...(options.tasteSignals?.likedGenreIds ?? []),
        ...likedIds,
      ]),
    ],
    likedArtistIds: [
      ...new Set([
        ...(options.tasteSignals?.likedArtistIds ?? []),
        ...(prefs.likedArtistIds ?? []),
      ]),
    ],
    likedArtistNames: [
      ...new Set([
        ...(options.tasteSignals?.likedArtistNames ?? []),
        ...(prefs.likedArtistNames ?? []),
      ]),
    ],
    artistIds: [
      ...new Set([
        ...(options.tasteSignals?.artistIds ?? []),
        ...tasteArtistIds,
      ]),
    ],
    artistNames: [
      ...new Set([
        ...(options.tasteSignals?.artistNames ?? []),
        ...tasteArtistNames,
      ]),
    ],
  })

  const seedScores = buildTasteSeedScores(
    tasteIds,
    related,
    simIndex,
    linkScores,
  )
  const seedNames = [
    ...new Set(
      [...tasteIds, ...linkScores.keys()]
        .map((id) => catalogById.get(id)?.name)
        .filter((n): n is string => Boolean(n)),
    ),
  ]

  const seen = options.seenCount ?? 0
  // First ~12 cards stay tight on subgenres / neighbors of chosen taste
  const focus = Math.max(0.15, 1 - seen / 18)

  const pool = genres.filter(
    (g) =>
      !disliked.has(g.id) &&
      !excludeIds.has(g.id) &&
      !likedOnCooldown(g.id, likedSet, likedAt, swipeCount),
  )
  if (!pool.length) return null

  const useTasteCurve = tasteMode === 'taste' || tasteMode === 'anti'
  const useSeedBoost =
    likedIds.length > 0 ||
    seedScores.size > 0 ||
    tasteIds.length > 0 ||
    linkScores.size > 0

  const weightOpts = {
    artistIds: tasteArtistIds,
    artistWeights: tasteArtistWeights,
    artistNames: tasteArtistNames,
    catalogById,
    seedScores,
    seedNames,
  }

  const weights: number[] = []
  let total = 0
  for (const g of pool) {
    let w = 1

    if (useSeedBoost) {
      const boost = relatedBoost(
        g.id,
        likedIds,
        related,
        simIndex,
        seedScores,
      )
      if (likedSet.has(g.id)) {
        // Cooldown over — welcome back with a modest boost
        w = 2.2 + boost * 0.35
      } else {
        w = 1 + boost
      }
    }

    if (useTasteCurve) {
      w *= tasteWeightMultiplier(g.id, tasteMode, tasteIds, related, {
        ...weightOpts,
        focus: tasteMode === 'anti' ? 1 - focus * 0.5 : focus,
      })
    } else if (seedScores.size > 0) {
      // Mode off but onboarding likes exist: still prefer neighbors first
      w *= tasteWeightMultiplier(g.id, 'taste', tasteIds, related, {
        ...weightOpts,
        focus,
      })
    }

    // Liked returns: don't let seed-dampen crush them again
    if (likedSet.has(g.id)) {
      w = Math.max(w, 2)
    }

    weights.push(w)
    total += w
  }

  if (total <= 0) return pool[Math.floor(Math.random() * pool.length)]

  let r = Math.random() * total
  for (let i = 0; i < pool.length; i++) {
    r -= weights[i]
    if (r <= 0) return pool[i]
  }
  return pool[pool.length - 1]
}

export function similarGenres(
  genre: Genre,
  all: Genre[],
  prefs: Preferences,
  related: Map<string, Set<string>>,
  index: SimilarityIndex,
  limit = 5,
): Genre[] {
  const disliked = new Set(prefs.disliked)
  const byId = new Map(all.map((g) => [g.id, g]))
  const ordered = index[genre.id] ?? [...(related.get(genre.id) ?? [])]

  const out: Genre[] = []
  for (const id of ordered) {
    if (disliked.has(id)) continue
    const g = byId.get(id)
    if (!g) continue
    out.push(g)
    if (out.length >= limit) break
  }
  return out
}
