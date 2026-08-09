import { useEffect, useMemo, useRef, useState } from 'react'
import {
  motion,
  useMotionValue,
  useTransform,
  animate,
  useDragControls,
  type PanInfo,
} from 'framer-motion'
import type { Genre, Preferences } from '../types'
import { describeGenre } from '../lib/describe'
import { useI18n } from '../i18n'
import { artistUrl, enrichGenre } from '../lib/enrich'
import { similarGenres, type SimilarityIndex } from '../lib/deck'
import { fetchArtistAvatar, fetchTrackCover, vibeArtUrl } from '../lib/cover'
import { fetchArtistFans } from '../lib/deezerFans'
import { formatListeners } from '../lib/formatCount'
import {
  extractPlaylistId,
  followPlaylist,
  isPlaylistFollowed,
} from '../lib/spotify'
import { openInSpotify } from '../lib/spotifyOpen'
import {
  bumpPreviewGeneration,
  getPreviewAudio,
  previewGeneration,
  stopPreviewAudio,
} from '../lib/previewAudio'
import { useNeonTheme } from '../lib/useNeonTheme'

type Props = {
  genre: Genre
  all: Genre[]
  prefs: Preferences
  related: Map<string, Set<string>>
  simIndex: SimilarityIndex
  connected: boolean
  onLike: () => void
  onDislike: () => void
  onSkip: () => void
  onOpenArtist: (id: string, name: string) => void
  onOpenGenre: (genreId: string) => void
  onConnectSpotify: () => void
}

const SWIPE_X = 110
const SWIPE_UP = -130

export function GenreCard({
  genre,
  all,
  prefs,
  related,
  simIndex,
  connected,
  onLike,
  onDislike,
  onSkip,
  onOpenArtist,
  onOpenGenre,
  onConnectSpotify,
}: Props) {
  const { t, locale } = useI18n()
  const neon = useNeonTheme()
  const [artistCount, setArtistCount] = useState(3)
  const [busy, setBusy] = useState(false)
  const [local, setLocal] = useState(genre)
  const [cover, setCover] = useState(() => vibeArtUrl(genre.name, genre.color))
  const [coverReady, setCoverReady] = useState(false)
  const [exiting, setExiting] = useState(false)
  const [inLibrary, setInLibrary] = useState(false)
  const [previewPlaying, setPreviewPlaying] = useState(false)
  const [savingPlaylist, setSavingPlaylist] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [artistAvatars, setArtistAvatars] = useState<Record<string, string>>({})
  const [artistFollowers, setArtistFollowers] = useState<Record<string, number>>(
    {},
  )
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const detailsRef = useRef<HTMLElement | null>(null)
  const artistViewportRef = useRef<HTMLDivElement | null>(null)
  const artistTrackRef = useRef<HTMLDivElement | null>(null)
  const [artistDragLeft, setArtistDragLeft] = useState(0)
  const artistRailX = useMotionValue(0)
  const artistRailDragged = useRef(false)
  const enriched = useRef(false)
  const enrichCancelled = useRef(false)
  const dragControls = useDragControls()

  const x = useMotionValue(0)
  const y = useMotionValue(0)
  const rotate = useTransform(x, [-220, 220], [-14, 14])
  const likeOpacity = useTransform(x, [36, 130], [0, 1])
  const nopeOpacity = useTransform(x, [-130, -36], [1, 0])
  const skipOpacity = useTransform(y, [-160, -50, 0], [1, 0.35, 0])
  const cardScale = useTransform(y, [-160, 0], [0.96, 1])

  useEffect(() => {
    setArtistCount(neon ? 12 : 3)
    setLocal(genre)
    setCover(vibeArtUrl(genre.name, genre.color))
    setCoverReady(false)
    setExiting(false)
    setInLibrary(false)
    setPreviewPlaying(false)
    setArtistAvatars({})
    setArtistFollowers({})
    enriched.current = false
    enrichCancelled.current = false
    x.set(0)
    y.set(0)
    artistRailX.set(0)
    setArtistDragLeft(0)
    scrollRef.current?.scrollTo({ top: 0 })
    stopPreview()

    let cancelled = false
    void (async () => {
      if (genre.coverUrl) {
        if (!cancelled) {
          setCover(genre.coverUrl)
          setCoverReady(true)
        }
      } else {
        const url = await fetchTrackCover(genre.trackId)
        if (!cancelled && url) {
          setCover(url)
          setCoverReady(true)
        }
      }
      if (!cancelled) await ensureEnriched(genre)

      const playlistId = extractPlaylistId(genre.playlistUrl)
      if (!cancelled && connected && playlistId) {
        const followed = await isPlaylistFollowed(playlistId)
        if (!cancelled && followed) setInLibrary(true)
      }
    })()

    return () => {
      cancelled = true
      enrichCancelled.current = true
      stopPreview()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [genre.id, connected])

  const description = useMemo(
    () => describeGenre(local, all, locale),
    [local, all, locale],
  )
  const similar = useMemo(
    () => similarGenres(local, all, prefs, related, simIndex, 8),
    [local, all, prefs, related, simIndex],
  )
  const artists = local.artists.filter((a) => a.name)

  useEffect(() => {
    let cancelled = false
    const visible = local.artists
      .filter((a) => a.name)
      .slice(0, artistCount)
    void (async () => {
      const entries = await Promise.all(
        visible.map(async (a) => {
          if (!a.id) return null
          // Custom override image (e.g. Molchat Doma) — skip Spotify
          if (a.image) return [a.id, a.image] as const
          const url = await fetchArtistAvatar(a.id)
          return url ? ([a.id, url] as const) : null
        }),
      )
      if (cancelled) return
      setArtistAvatars((prev) => {
        const next = { ...prev }
        for (const e of entries) {
          if (e) next[e[0]] = e[1]
        }
        return next
      })
    })()
    return () => {
      cancelled = true
    }
  }, [local.artists, artistCount, local.id])

  useEffect(() => {
    if (!neon) return
    const refs = local.artists
      .filter((a) => a.name && a.id)
      .slice(0, artistCount)
      .map((a) => ({ id: a.id, name: a.name }))
    if (!refs.length) return

    let cancelled = false
    void (async () => {
      const counts = await fetchArtistFans(refs)
      if (cancelled) return
      setArtistFollowers((prev) => ({ ...prev, ...counts }))
    })()
    return () => {
      cancelled = true
    }
  }, [local.artists, artistCount, local.id, neon])

  function stopPreview() {
    stopPreviewAudio()
    setPreviewPlaying(false)
  }

  async function ensureEnriched(g: Genre = local) {
    if (g.artistsPinned) {
      enriched.current = true
      return
    }
    if (
      enriched.current ||
      (g.artists.some((a) => a.id) && g.playlistUrl.includes('/playlist/'))
    ) {
      enriched.current = true
      return
    }
    const genreId = g.id
    setBusy(true)
    try {
      const extra = await enrichGenre(g)
      if (enrichCancelled.current) return
      setLocal((prev) => {
        if (prev.id !== genreId || prev.artistsPinned) return prev
        return {
          ...prev,
          ...extra,
          artists: extra.artists ?? prev.artists,
        }
      })
      enriched.current = true
    } finally {
      if (!enrichCancelled.current) setBusy(false)
    }
  }

  async function moreArtists() {
    if (!local.artistsPinned) await ensureEnriched()
    const total = local.artists.filter((a) => a.name).length
    setArtistCount((n) => Math.min(n + 6, Math.min(12, total || 12)))
  }

  useEffect(() => {
    const measure = () => {
      const viewport = artistViewportRef.current
      const track = artistTrackRef.current
      if (!viewport || !track) {
        setArtistDragLeft(0)
        return
      }
      const left = Math.min(0, viewport.clientWidth - track.scrollWidth)
      setArtistDragLeft(left)
      const x = artistRailX.get()
      if (x < left) artistRailX.set(left)
      if (x > 0) artistRailX.set(0)
    }
    measure()
    const ro = new ResizeObserver(measure)
    if (artistViewportRef.current) ro.observe(artistViewportRef.current)
    if (artistTrackRef.current) ro.observe(artistTrackRef.current)
    return () => ro.disconnect()
  }, [artists, artistAvatars, local.id, artistRailX])

  function scrollToDetails() {
    detailsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  function playPreview() {
    if (!local.previewUrl) return
    const a = getPreviewAudio()
    if (!a.paused && playingSame(a, local.previewUrl)) {
      stopPreview()
      return
    }
    const gen = bumpPreviewGeneration()
    a.onended = () => {
      if (previewGeneration() === gen) setPreviewPlaying(false)
    }
    a.src = local.previewUrl
    void a
      .play()
      .then(() => {
        if (previewGeneration() !== gen) {
          stopPreviewAudio()
          return
        }
        setPreviewPlaying(true)
      })
      .catch(() => {
        if (previewGeneration() === gen) setPreviewPlaying(false)
      })
  }

  function playingSame(a: HTMLAudioElement, url: string) {
    try {
      return a.src === new URL(url, window.location.href).href || a.src === url
    } catch {
      return a.src.includes(url) || a.src === url
    }
  }

  async function flyOut(axis: 'x' | 'y', to: number, then: () => void) {
    if (exiting) return
    setExiting(true)
    stopPreview()
    await animate(axis === 'x' ? x : y, to, {
      duration: 0.32,
      ease: [0.22, 1, 0.36, 1],
    })
    then()
  }

  async function onDragEnd(_: unknown, info: PanInfo) {
    if (exiting) return
    const dx = info.offset.x
    const dy = info.offset.y
    const vx = info.velocity.x
    const vy = info.velocity.y

    // Skip: sharp upward flick only (not gentle scroll-like drag)
    const goUp =
      (dy < SWIPE_UP && Math.abs(dy) > Math.abs(dx) * 1.2 && vy < -600) ||
      (vy < -1200 && Math.abs(vx) < 500)

    const goRight = dx > SWIPE_X || vx > 800
    const goLeft = dx < -SWIPE_X || vx < -800

    if (goUp) {
      await flyOut('y', -720, onSkip)
      return
    }
    if (goRight && Math.abs(dx) >= Math.abs(dy) * 0.7) {
      await flyOut('x', 520, onLike)
      return
    }
    if (goLeft && Math.abs(dx) >= Math.abs(dy) * 0.7) {
      await flyOut('x', -520, onDislike)
      return
    }
    void animate(x, 0, { type: 'spring', stiffness: 520, damping: 34 })
    void animate(y, 0, { type: 'spring', stiffness: 520, damping: 34 })
  }

  function openArtist(name: string, id: string | null) {
    if (id) onOpenArtist(id, name)
    else openInSpotify(artistUrl({ name, id }))
  }

  async function saveGenrePlaylist() {
    const playlistId = extractPlaylistId(local.playlistUrl)
    if (!playlistId) {
      openInSpotify(local.playlistUrl)
      return
    }
    if (!connected) {
      onConnectSpotify()
      return
    }
    setSavingPlaylist(true)
    const result = await followPlaylist(playlistId)
    setSavingPlaylist(false)
    if (result.needsRelogin) {
      onConnectSpotify()
      return
    }
    if (result.needsAllowlist) {
      setToast(t('spotifyAllowlist'))
    } else if (result.ok) {
      setInLibrary(true)
      setToast(t('playlistSaved'))
    } else {
      setToast(t('playlistSaveFail'))
    }
    window.setTimeout(() => setToast(null), 2000)
  }

  return (
    <motion.div
      className="card-frame"
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.18 } }}
      transition={{ type: 'spring', stiffness: 380, damping: 28 }}
    >
      <motion.article
        className="genre-card"
        style={{
          x,
          y,
          rotate,
          scale: cardScale,
          ['--vf-accent' as string]: local.color || '#00e676',
          ...(neon ? null : { borderColor: local.color }),
        }}
        drag={!exiting}
        dragControls={dragControls}
        dragListener={false}
        dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
        dragElastic={0.92}
        onDragEnd={onDragEnd}
      >
        <div className="card-scroll" ref={scrollRef}>
          <div
            className="hero"
            onPointerDown={(e) => {
              // Desktop mouse: use dock buttons; keep swipe for touch
              if (exiting || e.pointerType === 'mouse') return
              dragControls.start(e)
            }}
          >
            <motion.img
              className="hero-img"
              src={cover}
              alt=""
              initial={false}
              animate={{
                opacity: coverReady ? 1 : 0.85,
                scale: coverReady ? 1 : 1.04,
              }}
              transition={{ duration: 0.55 }}
              draggable={false}
            />
            <div
              className="hero-shade"
              style={
                neon
                  ? undefined
                  : {
                      background: `linear-gradient(180deg, transparent 20%, ${local.color}33 55%, #121212 100%)`,
                    }
              }
            />

            <motion.div className="stamp like" style={{ opacity: likeOpacity }}>
              LIKE
            </motion.div>
            <motion.div className="stamp nope" style={{ opacity: nopeOpacity }}>
              NOPE
            </motion.div>
            <motion.div className="stamp skip" style={{ opacity: skipOpacity }}>
              SKIP
            </motion.div>

            <div className={`hero-copy ${neon ? 'hero-copy-neon' : ''}`}>
              {neon ? (
                <>
                  <h1 className="genre-name">{local.name}</h1>
                  {local.previewUrl && (
                    <button
                      type="button"
                      className={`neon-hero-play${
                        previewPlaying ? ' is-playing' : ''
                      }`}
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={playPreview}
                      aria-label={
                        previewPlaying ? t('pausePreview') : t('preview')
                      }
                    >
                      <span
                        className={`track-media-ico ${
                          previewPlaying ? 'pause' : 'play'
                        }`}
                        aria-hidden
                      />
                    </button>
                  )}
                </>
              ) : (
                <>
                  <p className="eyebrow">{t('genreEyebrow')}</p>
                  <h1 className="genre-name">{local.name}</h1>
                  <p className="hint">{t('swipeHint')}</p>
                  <div className="card-actions-inline">
                    {local.previewUrl && (
                      <button
                        type="button"
                        className="chip"
                        onPointerDown={(e) => e.stopPropagation()}
                        onClick={playPreview}
                      >
                        <span
                          className={`track-media-ico ${
                            previewPlaying ? 'pause' : 'play'
                          }`}
                          aria-hidden
                        />
                        {previewPlaying ? t('pausePreview') : t('preview')}
                      </button>
                    )}
                    <button
                      type="button"
                      className="chip"
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={scrollToDetails}
                    >
                      {t('moreDetails')}
                    </button>
                  </div>
                </>
              )}
            </div>

            {!neon && (
            <button
              type="button"
              className="details-handle"
              style={{ borderColor: `${local.color}88` }}
              aria-label={t('moreDetailsAria')}
              onPointerDown={(e) => e.stopPropagation()}
              onClick={scrollToDetails}
              onTouchStart={(e) => {
                const t = e.touches[0]
                ;(e.currentTarget as HTMLButtonElement).dataset.y0 = String(
                  t.clientY,
                )
              }}
              onTouchEnd={(e) => {
                const y0 = Number(
                  (e.currentTarget as HTMLButtonElement).dataset.y0 || 0,
                )
                const y1 = e.changedTouches[0]?.clientY ?? y0
                if (y0 - y1 > 28) scrollToDetails()
              }}
            >
              <span className="details-handle-bar" style={{ background: local.color }} />
            </button>
            )}
          </div>

          <motion.section
            className={`details ${neon ? 'details-neon' : ''}`}
            ref={detailsRef}
            initial={false}
          >
            {neon ? (
              <>
                <p className="sheet-desc">{description}</p>
                <div className="genre-actions-neon">
                  <motion.a
                    className="playlist-btn genre-action-open"
                    href={local.playlistUrl}
                    target="_blank"
                    rel="noreferrer"
                    onClick={(e) => openInSpotify(local.playlistUrl, e)}
                    whileTap={{ scale: 0.97 }}
                  >
                    {t('openInSpotify')}
                  </motion.a>
                </div>
                <h3 className="neon-section-label">{t('topArtists')}</h3>
                {busy && artists.length < 3 && (
                  <p className="muted">{t('loadingArtists')}</p>
                )}
                <div
                  ref={artistViewportRef}
                  className="artist-rail-viewport"
                  onPointerDown={(e) => e.stopPropagation()}
                >
                  <motion.div
                    ref={artistTrackRef}
                    className="artist-list artist-list-neon"
                    style={{ x: artistRailX }}
                    drag="x"
                    dragConstraints={{ left: artistDragLeft, right: 0 }}
                    dragElastic={0.08}
                    dragTransition={{
                      power: 0.22,
                      timeConstant: 320,
                    }}
                    dragPropagation={false}
                    onDragStart={() => {
                      artistRailDragged.current = false
                    }}
                    onDrag={(_, info) => {
                      if (
                        Math.abs(info.offset.x) > 6 ||
                        Math.abs(info.velocity.x) > 40
                      ) {
                        artistRailDragged.current = true
                      }
                    }}
                    onDragEnd={() => {
                      if (!artistRailDragged.current) return
                      // Click fires after dragEnd — keep the flag until then
                      window.setTimeout(() => {
                        artistRailDragged.current = false
                      }, 120)
                    }}
                    onClickCapture={(e) => {
                      if (!artistRailDragged.current) return
                      e.preventDefault()
                      e.stopPropagation()
                      artistRailDragged.current = false
                    }}
                  >
                    {artists.slice(0, 12).map((a) => (
                      <div key={`${a.id ?? a.name}`} className="artist-rail-item">
                        <button
                          type="button"
                          className="artist-bubble"
                          onClick={(e) => {
                            if (artistRailDragged.current) {
                              e.preventDefault()
                              return
                            }
                            openArtist(a.name, a.id)
                          }}
                        >
                          {a.id && artistAvatars[a.id] ? (
                            <img
                              className="artist-bubble-avatar"
                              src={artistAvatars[a.id]}
                              alt=""
                              draggable={false}
                            />
                          ) : (
                            <span
                              className="artist-bubble-avatar ph"
                              style={{ background: `${local.color}44` }}
                              aria-hidden
                            />
                          )}
                          <span className="artist-bubble-name">{a.name}</span>
                          {a.id && artistFollowers[a.id] > 0 && (
                            <span
                              className="artist-bubble-followers"
                              title={t('monthlyListeners', {
                                count: formatListeners(
                                  artistFollowers[a.id],
                                  t,
                                ),
                              })}
                            >
                              {formatListeners(artistFollowers[a.id], t)}
                            </span>
                          )}
                        </button>
                      </div>
                    ))}
                  </motion.div>
                </div>
                {similar.length > 0 && (
                  <>
                    <h3 className="neon-section-label">{t('similarGenres')}</h3>
                    <div className="similar-row">
                      {similar.slice(0, 6).map((s, i) => (
                        <motion.button
                          key={s.id}
                          type="button"
                          className="similar-chip"
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ delay: 0.05 * i }}
                          onClick={() => onOpenGenre(s.id)}
                        >
                          {s.name}
                        </motion.button>
                      ))}
                    </div>
                  </>
                )}
              </>
            ) : (
              <>
            <div className="scroll-cue">{t('aboutGenre')}</div>
            {inLibrary && (
              <div className="library-badge">{t('inLibrary')}</div>
            )}
            <p className="sheet-desc">{description}</p>

            <motion.a
              className="playlist-btn"
              href={local.playlistUrl}
              target="_blank"
              rel="noreferrer"
              onClick={(e) => openInSpotify(local.playlistUrl, e)}
              whileTap={{ scale: 0.97 }}
            >
              {t('openPlaylist')}
            </motion.a>
            <motion.button
              type="button"
              className={`more-btn ${inLibrary ? 'saved' : ''}`}
              onClick={() => void saveGenrePlaylist()}
              disabled={savingPlaylist || inLibrary}
              whileTap={{ scale: 0.98 }}
            >
              {inLibrary
                ? t('savedLibrary')
                : savingPlaylist
                  ? t('saving')
                  : connected
                    ? t('savePlaylist')
                    : t('loginSavePlaylist')}
            </motion.button>

            <h3>{t('topArtists')}</h3>
            {busy && artists.length < 3 && (
              <p className="muted">{t('loadingArtists')}</p>
            )}
            <ul className="artist-list">
              {artists.slice(0, artistCount).map((a, i) => (
                <motion.li
                  key={`${a.id ?? a.name}`}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                >
                  <button
                    type="button"
                    className="artist-link"
                    onClick={() => openArtist(a.name, a.id)}
                  >
                    {a.id && artistAvatars[a.id] ? (
                      <img
                        className="artist-list-avatar"
                        src={artistAvatars[a.id]}
                        alt=""
                        draggable={false}
                      />
                    ) : (
                      <span
                        className="artist-list-avatar ph"
                        style={{ background: `${local.color}44` }}
                        aria-hidden
                      />
                    )}
                    <span className="artist-link-name">{a.name}</span>
                    <span className="muted">
                      {a.id ? t('cardArrow') : t('searchArrow')}
                    </span>
                  </button>
                </motion.li>
              ))}
            </ul>
            {artistCount < Math.min(12, artists.length) && (
              <motion.button
                type="button"
                className="more-btn"
                onClick={() => void moreArtists()}
                disabled={busy}
                whileTap={{ scale: 0.98 }}
              >
                {t('moreArtists')}
              </motion.button>
            )}

            {similar.length > 0 && (
              <>
                <h3>{t('similarGenres')}</h3>
                <div className="similar-row">
                  {similar.map((s, i) => (
                    <motion.button
                      key={s.id}
                      type="button"
                      className="similar-chip"
                      style={{ color: s.color }}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 0.05 * i }}
                      onClick={() => onOpenGenre(s.id)}
                    >
                      {s.name}
                    </motion.button>
                  ))}
                </div>
              </>
            )}
              </>
            )}
          </motion.section>
        </div>
      </motion.article>
      {toast && <div className="toast">{toast}</div>}
    </motion.div>
  )
}
