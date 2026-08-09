import {
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
} from 'react'
import { AnimatePresence, LayoutGroup, motion } from 'framer-motion'
import type { Genre } from '../types'
import { useI18n } from '../i18n'
import { ONBOARDING_GENRE_SUGGESTIONS } from '../lib/taste'
import { spotifyConfigured } from '../lib/spotify'
import {
  fetchArtistAvatar,
  fetchGenrePopularCover,
  vibeArtUrl,
} from '../lib/cover'
import type { SimilarityIndex } from '../lib/deck'
import { useNeonTheme } from '../lib/useNeonTheme'

type ArtistPick = {
  key: string
  name: string
  id?: string
  image?: string | null
  genreIds: string[]
}

type Props = {
  genres: Genre[]
  simIndex: SimilarityIndex
  related: Map<string, Set<string>>
  connected: boolean
  connecting?: boolean
  onConnectSpotify: () => void
  onFinish: (
    selectedGenreIds: string[],
    artists: { ids: string[]; names: string[] },
    enableTasteMode: boolean,
  ) => void
}

const popIn = {
  initial: { opacity: 0, scale: 0.72 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.72 },
  transition: { type: 'spring' as const, stiffness: 480, damping: 28, mass: 0.7 },
}

function collectArtistsFromGenres(
  source: Genre[],
  query: string,
  limit: number,
): ArtistPick[] {
  const q = query.trim().toLowerCase()
  const map = new Map<string, ArtistPick>()
  for (const g of source) {
    for (const a of g.artists ?? []) {
      if (!a.name) continue
      if (q && !a.name.toLowerCase().includes(q)) continue
      const key = a.id || a.name.toLowerCase()
      const prev = map.get(key)
      if (prev) {
        if (!prev.genreIds.includes(g.id)) prev.genreIds.push(g.id)
        if (!prev.image && a.image) prev.image = a.image
      } else {
        map.set(key, {
          key,
          name: a.name,
          id: a.id ?? undefined,
          image: a.image ?? null,
          genreIds: [g.id],
        })
      }
      if (map.size >= limit) return [...map.values()]
    }
  }
  return [...map.values()]
}

function insertAfterNew<T>(
  list: T[],
  anchorKey: string,
  items: T[],
  keyOf: (item: T) => string,
): T[] {
  const existing = new Set(list.map(keyOf))
  const fresh: T[] = []
  const seen = new Set<string>()
  for (const item of items) {
    const k = keyOf(item)
    if (!k || k === anchorKey || existing.has(k) || seen.has(k)) continue
    seen.add(k)
    fresh.push(item)
  }
  if (!fresh.length) return list
  let idx = list.findIndex((x) => keyOf(x) === anchorKey)
  let base = list
  if (idx < 0) {
    const anchor = items.find((x) => keyOf(x) === anchorKey)
    if (anchor) {
      base = [...list, anchor]
      idx = base.length - 1
    } else {
      return list
    }
  }
  return [...base.slice(0, idx + 1), ...fresh, ...base.slice(idx + 1)]
}

export function TasteOnboarding({
  genres,
  simIndex,
  related,
  connected,
  connecting,
  onConnectSpotify,
  onFinish,
}: Props) {
  const { t } = useI18n()
  const neon = useNeonTheme()
  const [step, setStep] = useState<'genres' | 'artists'>('genres')
  const [selectedGenres, setSelectedGenres] = useState<Set<string>>(
    () => new Set(),
  )
  const [pickedArtists, setPickedArtists] = useState<ArtistPick[]>([])
  const [genreQuery, setGenreQuery] = useState('')
  const [artistQuery, setArtistQuery] = useState('')
  const [genreOrder, setGenreOrder] = useState<string[]>([])
  const [artistOrder, setArtistOrder] = useState<ArtistPick[]>([])
  /** childId -> parent ids that auto-injected this tile */
  const [, setGenreInjectedBy] = useState<Map<string, Set<string>>>(
    () => new Map(),
  )
  const [, setArtistInjectedBy] = useState<Map<string, Set<string>>>(
    () => new Map(),
  )
  const [genreCovers, setGenreCovers] = useState<Record<string, string>>({})
  const [artistCovers, setArtistCovers] = useState<Record<string, string>>({})

  const byId = useMemo(() => new Map(genres.map((g) => [g.id, g])), [genres])
  const byName = useMemo(
    () => new Map(genres.map((g) => [g.name.toLowerCase(), g])),
    [genres],
  )

  const genreSuggestions = useMemo(() => {
    const out: Genre[] = []
    for (const name of ONBOARDING_GENRE_SUGGESTIONS) {
      const g = byName.get(name) || byId.get(name)
      if (g) out.push(g)
    }
    return out
  }, [byId, byName])

  useEffect(() => {
    if (genreOrder.length || !genreSuggestions.length) return
    setGenreOrder(genreSuggestions.map((g) => g.id))
  }, [genreSuggestions, genreOrder.length])

  const genreQueryTrim = genreQuery.trim().toLowerCase()
  const genreSearching = genreQueryTrim.length >= 1

  const genreMatches = useMemo(() => {
    if (!genreSearching) return [] as Genre[]
    const q = genreQueryTrim
    return genres
      .map((g) => {
        const n = g.name.toLowerCase()
        let score = 0
        if (n === q) score = 300
        else if (n.startsWith(q)) score = 200
        else if (n.includes(q)) score = 100
        else if (q.length >= 3 && n.split(/\s+/).some((w) => w.startsWith(q)))
          score = 80
        else return null
        return { g, score: score - Math.min(n.length, 40) }
      })
      .filter((x): x is { g: Genre; score: number } => Boolean(x))
      .sort((a, b) => b.score - a.score)
      .map((x) => x.g)
  }, [genres, genreSearching, genreQueryTrim])

  const genreHints = useMemo(() => genreMatches.slice(0, 8), [genreMatches])

  function relatedGenreIds(id: string, limit = 4): string[] {
    const ordered: string[] = []
    const seen = new Set<string>()
    const push = (rid: string) => {
      if (!rid || rid === id || seen.has(rid) || !byId.has(rid)) return
      seen.add(rid)
      ordered.push(rid)
    }
    for (const rid of simIndex[id] ?? []) push(rid)
    for (const rid of related.get(id) ?? []) push(rid)
    return ordered.slice(0, limit)
  }

  const visibleGenres = useMemo(() => {
    const ids = genreSearching
      ? genreMatches.slice(0, 24).map((g) => g.id)
      : genreOrder
    return ids
      .map((id) => byId.get(id))
      .filter((g): g is Genre => Boolean(g))
  }, [genreSearching, genreMatches, genreOrder, byId])

  const selectedGenreObjects = useMemo(
    () =>
      [...selectedGenres]
        .map((id) => byId.get(id))
        .filter((g): g is Genre => Boolean(g)),
    [selectedGenres, byId],
  )

  const artistQueryTrim = artistQuery.trim().toLowerCase()
  const artistSearching = artistQueryTrim.length >= 1

  const artistsPool = useMemo(
    () => collectArtistsFromGenres(selectedGenreObjects, '', 280),
    [selectedGenreObjects],
  )

  useEffect(() => {
    if (step !== 'artists') return
    setArtistOrder((prev) => {
      if (prev.length) {
        const poolKeys = new Set(artistsPool.map((a) => a.key))
        const kept = prev.filter((a) => poolKeys.has(a.key))
        if (kept.length) return kept
      }
      return artistsPool.slice(0, 36)
    })
  }, [step, artistsPool])

  function relatedArtistPicks(a: ArtistPick, limit = 5): ArtistPick[] {
    const deep = collectArtistsFromGenres(selectedGenreObjects, '', 500)
    const byKey = new Map<string, ArtistPick>()
    for (const x of artistsPool) byKey.set(x.key, x)
    for (const x of deep) if (!byKey.has(x.key)) byKey.set(x.key, x)

    const relatedGenreSet = new Set<string>()
    for (const gid of a.genreIds) {
      for (const rid of relatedGenreIds(gid, 10)) relatedGenreSet.add(rid)
    }

    const scored: Array<{ a: ArtistPick; score: number }> = []
    for (const o of byKey.values()) {
      if (o.key === a.key) continue
      const shared = o.genreIds.filter((g) => a.genreIds.includes(g)).length
      let score = shared * 12
      for (const g of o.genreIds) {
        if (relatedGenreSet.has(g)) score += 4
      }
      if (score <= 0) continue
      scored.push({ a: o, score })
    }
    scored.sort((x, y) => y.score - x.score)
    return scored.slice(0, limit).map((x) => x.a)
  }

  function artistAccent(a: ArtistPick): string {
    for (const gid of a.genreIds) {
      if (selectedGenres.has(gid)) {
        const g = byId.get(gid)
        if (g?.color) return g.color
      }
    }
    for (const gid of a.genreIds) {
      const g = byId.get(gid)
      if (g?.color) return g.color
    }
    return '#1db954'
  }

  const artistMatches = useMemo(() => {
    if (!artistSearching) return artistOrder
    const q = artistQueryTrim
    return artistsPool
      .map((a) => {
        const n = a.name.toLowerCase()
        let score = 0
        if (n === q) score = 300
        else if (n.startsWith(q)) score = 200
        else if (n.includes(q)) score = 100
        else return null
        return { a, score: score - Math.min(n.length, 40) }
      })
      .filter((x): x is { a: ArtistPick; score: number } => Boolean(x))
      .sort((x, y) => y.score - x.score)
      .map((x) => x.a)
      .slice(0, 36)
  }, [artistSearching, artistQueryTrim, artistOrder, artistsPool])

  const artistHints = useMemo(
    () => (artistSearching ? artistMatches.slice(0, 8) : []),
    [artistSearching, artistMatches],
  )

  const artistsVisible = artistMatches

  const pickedKeys = useMemo(
    () => new Set(pickedArtists.map((a) => a.key)),
    [pickedArtists],
  )

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      const next: Record<string, string> = {}
      await Promise.all(
        visibleGenres.map(async (g) => {
          const url = await fetchGenrePopularCover(g)
          next[g.id] = url || vibeArtUrl(g.name, g.color)
        }),
      )
      if (!cancelled) setGenreCovers((prev) => ({ ...prev, ...next }))
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [visibleGenres])

  useEffect(() => {
    if (step !== 'artists') return
    let cancelled = false
    const load = async () => {
      const next: Record<string, string> = {}
      await Promise.all(
        artistsVisible.slice(0, 40).map(async (a) => {
          if (a.image) {
            next[a.key] = a.image
            return
          }
          if (a.id) {
            const url = await fetchArtistAvatar(a.id)
            if (url) next[a.key] = url
          }
        }),
      )
      if (!cancelled) setArtistCovers((prev) => ({ ...prev, ...next }))
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [step, artistsVisible])

  function expandGenresAround(id: string) {
    const extras = relatedGenreIds(id, 5)
    if (!extras.length) return
    setGenreOrder((order) => {
      const base = order.includes(id) ? order : [...order, id]
      const existing = new Set(base)
      const newlyAdded = extras.filter((x) => !existing.has(x))
      if (newlyAdded.length) {
        setGenreInjectedBy((prev) => {
          const next = new Map(prev)
          for (const child of newlyAdded) {
            const parents = new Set(next.get(child) ?? [])
            parents.add(id)
            next.set(child, parents)
          }
          return next
        })
      }
      return insertAfterNew(base, id, extras, (x) => x)
    })
  }

  function collapseGenresAround(id: string, stillSelected: Set<string>) {
    setGenreInjectedBy((prev) => {
      const next = new Map(prev)
      const removeIds: string[] = []
      for (const [child, parents] of prev) {
        if (!parents.has(id)) continue
        const p = new Set(parents)
        p.delete(id)
        if (p.size === 0) {
          next.delete(child)
          if (!stillSelected.has(child)) removeIds.push(child)
        } else {
          next.set(child, p)
        }
      }
      if (removeIds.length) {
        const drop = new Set(removeIds)
        setGenreOrder((order) => order.filter((x) => !drop.has(x)))
      }
      return next
    })
  }

  function toggleGenre(id: string) {
    setSelectedGenres((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
        collapseGenresAround(id, next)
      } else {
        next.add(id)
        expandGenresAround(id)
        setGenreQuery('')
      }
      return next
    })
  }

  function expandArtistsAround(a: ArtistPick) {
    const extras = relatedArtistPicks(a, 5)
    if (!extras.length) return
    setArtistOrder((order) => {
      const has = order.some((x) => x.key === a.key)
      const base = has ? order : [...order, a]
      const existing = new Set(base.map((x) => x.key))
      const newlyAdded = extras.filter((x) => !existing.has(x.key))
      if (newlyAdded.length) {
        setArtistInjectedBy((prev) => {
          const next = new Map(prev)
          for (const child of newlyAdded) {
            const parents = new Set(next.get(child.key) ?? [])
            parents.add(a.key)
            next.set(child.key, parents)
          }
          return next
        })
      }
      return insertAfterNew(base, a.key, extras, (x) => x.key)
    })
  }

  function collapseArtistsAround(parentKey: string, stillPicked: Set<string>) {
    setArtistInjectedBy((prev) => {
      const next = new Map(prev)
      const removeKeys: string[] = []
      for (const [child, parents] of prev) {
        if (!parents.has(parentKey)) continue
        const p = new Set(parents)
        p.delete(parentKey)
        if (p.size === 0) {
          next.delete(child)
          if (!stillPicked.has(child)) removeKeys.push(child)
        } else {
          next.set(child, p)
        }
      }
      if (removeKeys.length) {
        const drop = new Set(removeKeys)
        setArtistOrder((order) => order.filter((x) => !drop.has(x.key)))
      }
      return next
    })
  }

  function toggleArtist(a: ArtistPick) {
    setPickedArtists((prev) => {
      if (prev.some((x) => x.key === a.key)) {
        const next = prev.filter((x) => x.key !== a.key)
        collapseArtistsAround(a.key, new Set(next.map((x) => x.key)))
        return next
      }
      expandArtistsAround(a)
      setArtistQuery('')
      return [...prev, a]
    })
  }

  function allLikedGenreIds() {
    const ids = new Set(selectedGenres)
    for (const a of pickedArtists) {
      for (const id of a.genreIds) ids.add(id)
    }
    return [...ids]
  }

  function goArtists() {
    if (selectedGenres.size === 0) return
    setPickedArtists((prev) =>
      prev.filter((a) => a.genreIds.some((id) => selectedGenres.has(id))),
    )
    setArtistOrder([])
    setArtistQuery('')
    setStep('artists')
  }

  function finish(skipArtists = false) {
    const artistsFromPicks = (list: ArtistPick[]) => ({
      ids: list.map((a) => a.id).filter((id): id is string => Boolean(id)),
      names: list.map((a) => a.name).filter(Boolean),
    })

    if (skipArtists && step === 'artists') {
      const ids = [...selectedGenres]
      onFinish(ids, { ids: [], names: [] }, ids.length > 0 || connected)
      return
    }
    const genreIds = allLikedGenreIds()
    onFinish(
      genreIds,
      artistsFromPicks(pickedArtists),
      genreIds.length > 0 || connected,
    )
  }

  function skipAll() {
    onFinish([], { ids: [], names: [] }, false)
  }

  return (
    <div className={`gate-overlay ${neon ? 'gate-overlay-neon' : ''}`}>
      <div className={`gate-card gate-card-tall ${neon ? 'gate-card-neon' : ''}`}>
        {!neon && <p className="eyebrow">{t('onboardEyebrow')}</p>}
        {neon && step === 'genres' && (
          <div className="neon-onboard-brand">
            <img src="/logo.png" alt="" className="neon-onboard-logo" draggable={false} />
          </div>
        )}
        <h2>
          {neon && step === 'genres'
            ? 'What do you listen to?'
            : step === 'genres'
              ? t('onboardTitleGenres')
              : t('onboardTitleArtists')}
        </h2>
        <p className="sheet-desc">
          {neon && step === 'genres'
            ? 'Pick genres you vibe with. We’ll refine your recommendations.'
            : step === 'genres'
              ? t('onboardLeadGenres')
              : t('onboardLeadArtists')}
        </p>
        {step === 'artists' && (
          <p className="muted tiny">
            {t('onboardStep', { step: 2, total: 2 })}
          </p>
        )}

        {spotifyConfigured() && (
          <div className="onboard-spotify">
            {connected ? (
              <p className="muted">{t('onboardSpotifyOk')}</p>
            ) : (
              <button
                type="button"
                className="chip"
                disabled={connecting}
                onClick={onConnectSpotify}
              >
                {connecting ? t('tasteLoading') : t('onboardSpotifyBtn')}
              </button>
            )}
            <p className="tiny muted">{t('onboardSpotifyHint')}</p>
          </div>
        )}

        {step === 'genres' ? (
          <section className="onboard-section">
            <div className="onboard-search">
              <span className="muted">{t('onboardSearchGenres')}</span>
              <div className="onboard-search-box">
                <input
                  value={genreQuery}
                  onChange={(e) => setGenreQuery(e.target.value)}
                  placeholder={t('onboardSearchGenresPh')}
                  autoCapitalize="off"
                  autoCorrect="off"
                  autoComplete="off"
                  spellCheck={false}
                />
                {genreSearching && (
                  <ul className="onboard-hints" role="listbox">
                    {genreHints.length === 0 ? (
                      <li className="onboard-hint-empty">{t('searchEmpty')}</li>
                    ) : (
                      genreHints.map((g) => (
                        <li key={g.id}>
                          <button
                            type="button"
                            className={`onboard-hint ${selectedGenres.has(g.id) ? 'on' : ''}`}
                            style={{ color: g.color }}
                            onClick={() => {
                              if (!selectedGenres.has(g.id)) toggleGenre(g.id)
                              setGenreQuery('')
                            }}
                          >
                            {g.name}
                          </button>
                        </li>
                      ))
                    )}
                  </ul>
                )}
              </div>
            </div>
            {genreSearching && genreMatches.length === 0 ? (
              <p className="muted">{t('searchEmpty')}</p>
            ) : neon ? (
              <div className="neon-chip-cloud">
                {visibleGenres.map((g) => {
                  const on = selectedGenres.has(g.id)
                  return (
                    <button
                      key={g.id}
                      type="button"
                      className={`neon-genre-chip ${on ? 'selected' : ''}`}
                      onClick={() => toggleGenre(g.id)}
                    >
                      {!on && <span className="neon-chip-plus">+</span>}
                      <span>{g.name}</span>
                      {on && <span className="neon-chip-check">✓</span>}
                    </button>
                  )
                })}
              </div>
            ) : (
              <LayoutGroup>
                <motion.div className="onboard-grid" layout>
                  <AnimatePresence initial={false} mode="popLayout">
                    {visibleGenres.map((g) => {
                      const cover =
                        genreCovers[g.id] || vibeArtUrl(g.name, g.color)
                      const on = selectedGenres.has(g.id)
                      return (
                        <motion.button
                          key={g.id}
                          type="button"
                          layout
                          {...popIn}
                          className={`onboard-tile onboard-tile-genre ${on ? 'selected' : ''}`}
                          style={
                            {
                              '--genre-color': on ? '#1db954' : g.color,
                            } as CSSProperties
                          }
                          onClick={() => toggleGenre(g.id)}
                        >
                          <span className="onboard-tile-media">
                            <img src={cover} alt="" draggable={false} />
                            <span className="onboard-tile-wash" aria-hidden />
                          </span>
                          <span className="onboard-tile-name">{g.name}</span>
                        </motion.button>
                      )
                    })}
                  </AnimatePresence>
                </motion.div>
              </LayoutGroup>
            )}
            {!neon && (
            <p className="muted tiny">
              {t('onboardSelectedGenres', { count: selectedGenres.size })}
            </p>
            )}
            <button
              type="button"
              className={`playlist-btn gate-primary ${neon ? 'neon-continue' : ''}`}
              onClick={goArtists}
              disabled={selectedGenres.size === 0}
            >
              {neon ? (
                <>
                  Continue <span aria-hidden>→</span>
                </>
              ) : (
                t('onboardNextArtists')
              )}
            </button>
            {neon && (
              <p className="muted tiny neon-onboard-foot">
                You can change this anytime.
              </p>
            )}
          </section>
        ) : (
          <section className="onboard-section">
            <p className="tiny muted">
              {t('onboardArtistsFrom', {
                genres: selectedGenreObjects
                  .slice(0, 4)
                  .map((g) => g.name)
                  .join(', '),
              })}
            </p>
            <div className="onboard-search">
              <span className="muted">{t('onboardSearchArtists')}</span>
              <div className="onboard-search-box">
                <input
                  value={artistQuery}
                  onChange={(e) => setArtistQuery(e.target.value)}
                  placeholder={t('onboardSearchArtistsPh')}
                  autoCapitalize="off"
                  autoCorrect="off"
                  autoComplete="off"
                  spellCheck={false}
                />
                {artistSearching && (
                  <ul className="onboard-hints" role="listbox">
                    {artistHints.length === 0 ? (
                      <li className="onboard-hint-empty">{t('searchEmpty')}</li>
                    ) : (
                      artistHints.map((a) => (
                        <li key={a.key}>
                          <button
                            type="button"
                            className={`onboard-hint ${pickedKeys.has(a.key) ? 'on' : ''}`}
                            onClick={() => {
                              if (!pickedKeys.has(a.key)) toggleArtist(a)
                              setArtistQuery('')
                            }}
                          >
                            {a.name}
                          </button>
                        </li>
                      ))
                    )}
                  </ul>
                )}
              </div>
            </div>
            {artistsVisible.length === 0 ? (
              <p className="muted">
                {artistSearching ? t('searchEmpty') : t('onboardNoArtists')}
              </p>
            ) : (
              <LayoutGroup>
                <motion.div className="onboard-grid" layout>
                  <AnimatePresence initial={false} mode="popLayout">
                    {artistsVisible.map((a) => {
                      const accent = artistAccent(a)
                      const cover =
                        artistCovers[a.key] ||
                        a.image ||
                        vibeArtUrl(a.name, accent)
                      const on = pickedKeys.has(a.key)
                      return (
                        <motion.button
                          key={a.key}
                          type="button"
                          layout
                          {...popIn}
                          className={`onboard-tile onboard-tile-genre ${on ? 'selected' : ''}`}
                          style={
                            {
                              '--genre-color': on ? '#1db954' : accent,
                            } as CSSProperties
                          }
                          onClick={() => toggleArtist(a)}
                        >
                          <span className="onboard-tile-media">
                            <img src={cover} alt="" draggable={false} />
                            <span className="onboard-tile-wash" aria-hidden />
                          </span>
                          <span className="onboard-tile-name">{a.name}</span>
                        </motion.button>
                      )
                    })}
                  </AnimatePresence>
                </motion.div>
              </LayoutGroup>
            )}
            <p className="muted tiny">
              {t('onboardSelectedArtists', { count: pickedArtists.length })}
            </p>
            <button
              type="button"
              className="playlist-btn gate-primary"
              onClick={() => finish(false)}
            >
              {t('onboardStart')}
            </button>
            <button
              type="button"
              className="text-btn gate-skip"
              onClick={() => finish(true)}
            >
              {t('onboardSkipArtists')}
            </button>
            <button
              type="button"
              className="text-btn gate-skip"
              onClick={() => setStep('genres')}
            >
              {t('onboardBackGenres')}
            </button>
          </section>
        )}

        <button type="button" className="text-btn gate-skip" onClick={skipAll}>
          {t('onboardSkip')}
        </button>
      </div>
    </div>
  )
}
