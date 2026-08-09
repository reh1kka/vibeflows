import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import type { Genre } from '../types'
import {
  fetchArtistBundle,
  type SpotifyArtist,
  type SpotifyTrack,
  type UserAuth,
} from '../lib/spotify'
import { enrichSpotifyTrackPreviews } from '../lib/artistDemo'
import { formatListeners } from '../lib/formatCount'
import { useI18n } from '../i18n'
import { openInSpotify } from '../lib/spotifyOpen'
import {
  bumpPreviewGeneration,
  getPreviewAudio,
  previewGeneration,
  stopPreviewAudio,
} from '../lib/previewAudio'
import { useNeonTheme } from '../lib/useNeonTheme'

type Props = {
  artistId: string
  artistName?: string
  catalog: Genre[]
  connected: UserAuth | null
  onBack: () => void
  onOpenArtist: (id: string, name: string) => void
  onOpenGenre: (genreId: string) => void
  onConnect: () => void
}

export function ArtistView({
  artistId,
  artistName,
  catalog,
  connected,
  onBack,
  onOpenArtist,
  onOpenGenre,
  onConnect,
}: Props) {
  const { t, locale } = useI18n()
  const neon = useNeonTheme()
  const [loading, setLoading] = useState(true)
  const [artist, setArtist] = useState<SpotifyArtist | null>(null)
  const [tracks, setTracks] = useState<SpotifyTrack[]>([])
  const [related, setRelated] = useState<SpotifyArtist[]>([])
  const [about, setAbout] = useState('')
  const [listeners, setListeners] = useState(0)
  const [playingId, setPlayingId] = useState<string | null>(null)
  const [relatedCount, setRelatedCount] = useState(4)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setPlayingId(null)
    setRelatedCount(4)
    stopPreviewAudio()

    void fetchArtistBundle(artistId, { name: artistName, catalog }).then(
      async (data) => {
        if (cancelled) return
        setArtist(data.artist)
        let top = (data.topTracks ?? []).slice(0, 5)
        const artistLabel = data.artist?.name || artistName || ''
        // Replace placeholder demo tracks with Deezer tops when possible
        if (
          artistLabel &&
          (!top.length || top.every((tr) => tr.id.startsWith('demo-')))
        ) {
          try {
            const { fetchRealTopTracks } = await import('../lib/artistDemo')
            if (cancelled) return
            const real = await fetchRealTopTracks(artistId, artistLabel)
            if (cancelled) return
            if (real?.length) top = real.slice(0, 5)
          } catch {
            /* keep top */
          }
        }
        top = top.filter((tr) => !tr.id.startsWith('demo-'))
        if (cancelled) return
        setTracks(top)
        void enrichSpotifyTrackPreviews(top, artistLabel).then((enriched) => {
          if (cancelled) return
          setTracks(enriched.filter((tr) => !tr.id.startsWith('demo-')))
        })
        const rel = (data.relatedArtists ?? []).slice(0, 8)
        setRelated(rel)
        setAbout(
          data.about ||
            (data.artist
              ? `${data.artist.name} — ${t('aboutArtist')}.`
              : ''),
        )
        const spotifyListeners =
          data.listeners || data.artist?.followers?.total || 0
        setListeners(spotifyListeners)
        setLoading(false)

        // Prefer Deezer fan counts (no Spotify quota / works without login)
        if (artistLabel) {
          try {
            const { fetchDeezerFansByName } = await import('../lib/deezerFans')
            if (cancelled) return
            const fans = await fetchDeezerFansByName(artistLabel)
            if (cancelled) return
            if (typeof fans === 'number' && fans > 0) {
              setListeners(fans)
            }
          } catch {
            /* keep Spotify / demo figure */
          }
        }

        // Fill missing avatars via Spotify oEmbed
        const needCovers = rel.filter((a) => !a.images?.[0]?.url)
        if (needCovers.length) {
          const filled = await Promise.all(
            rel.map(async (a) => {
              if (a.images?.[0]?.url) return a
              try {
                const r = await fetch(
                  `https://open.spotify.com/oembed?url=${encodeURIComponent(`spotify:artist:${a.id}`)}`,
                )
                if (!r.ok) return a
                const j = (await r.json()) as { thumbnail_url?: string }
                return j.thumbnail_url
                  ? { ...a, images: [{ url: j.thumbnail_url }] }
                  : a
              } catch {
                return a
              }
            }),
          )
          if (cancelled) return
          setRelated(filled)
        }
      },
    )

    return () => {
      cancelled = true
      stopPreviewAudio()
      setPlayingId(null)
    }
  }, [artistId, artistName, catalog, locale, t])

  function togglePreview(track: SpotifyTrack) {
    if (!track.preview_url) {
      openInSpotify(
        track.external_urls?.spotify ??
          `https://open.spotify.com/track/${track.id}`,
      )
      return
    }
    const a = getPreviewAudio()
    if (playingId === track.id && !a.paused) {
      stopPreviewAudio()
      setPlayingId(null)
      return
    }
    const gen = bumpPreviewGeneration()
    a.onended = () => {
      if (previewGeneration() === gen) setPlayingId(null)
    }
    a.onpause = null
    a.src = track.preview_url
    void a
      .play()
      .then(() => {
        if (previewGeneration() !== gen) {
          stopPreviewAudio()
          return
        }
        setPlayingId(track.id)
      })
      .catch(() => {
        if (previewGeneration() === gen) setPlayingId(null)
        openInSpotify(
          track.external_urls?.spotify ??
            `https://open.spotify.com/track/${track.id}`,
        )
      })
  }

  // Only Molchat Doma (and similar) keep a custom override avatar
  const catalogImage = catalog
    .flatMap((g) => g.artists ?? [])
    .find((a) => a.id === artistId && a.image)?.image

  const cover =
    catalogImage ||
    artist?.images?.[0]?.url ||
    tracks[0]?.album?.images?.[0]?.url ||
    null
  const title = artist?.name || artistName || t('artistFallback')
  const genres = artist?.genres ?? []

  return (
    <motion.div
      className={`artist-view ${neon ? 'artist-view-neon' : ''}`}
      initial={{ opacity: 0, x: 40 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 40 }}
      transition={{ type: 'spring', stiffness: 380, damping: 32 }}
    >
      <div className={`artist-topbar ${neon ? 'artist-topbar-neon' : ''}`}>
        <button
          type="button"
          className={neon ? 'artist-back-neon' : 'text-btn'}
          onClick={onBack}
          aria-label={t('back')}
        >
          {neon ? (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path
                d="M15 6l-6 6 6 6"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          ) : (
            t('back')
          )}
        </button>
        {!neon &&
          (connected ? (
            <span className="muted">
              {connected.displayName || 'Spotify'}
            </span>
          ) : (
            <button type="button" className="text-btn" onClick={onConnect}>
              {t('loginSpotify')}
            </button>
          ))}
      </div>

      <div className={`artist-hero ${neon ? 'artist-hero-neon' : ''}`}>
        <div className="artist-cover-wrap">
          {cover ? (
            <img src={cover} alt="" className="artist-cover artist-cover-glow" />
          ) : (
            <div className="artist-cover artist-cover-glow placeholder" />
          )}
        </div>
        <div className="artist-hero-copy">
          {!neon && <p className="eyebrow">{t('artistEyebrow')}</p>}
          <h1>{title}</h1>
          {listeners > 0 && (
            <p className={`listeners ${neon ? 'listeners-neon' : ''}`}>
              {t('monthlyListeners', {
                count: formatListeners(listeners, t),
              })}
            </p>
          )}
          {neon && (
            <a
              className="playlist-btn artist-open-spotify-neon"
              href={
                artist?.external_urls?.spotify ??
                `https://open.spotify.com/artist/${artistId}`
              }
              target="_blank"
              rel="noreferrer"
              onClick={(e) =>
                openInSpotify(
                  artist?.external_urls?.spotify ??
                    `https://open.spotify.com/artist/${artistId}`,
                  e,
                )
              }
            >
              {t('openInSpotify')}
            </a>
          )}
          {neon && genres[0] && (
            <button
              type="button"
              className="similar-chip neon-genre-pill"
              onClick={() => {
                const match = catalog.find(
                  (x) => x.name.toLowerCase() === genres[0].toLowerCase(),
                )
                if (match) onOpenGenre(match.id)
              }}
            >
              {genres[0]}
            </button>
          )}
          {!neon && (
          <div className="artist-actions">
            {artist?.external_urls?.spotify && (
              <a
                className="chip"
                href={artist.external_urls.spotify}
                target="_blank"
                rel="noreferrer"
                onClick={(e) =>
                  openInSpotify(artist.external_urls!.spotify, e)
                }
              >
                {t('openInSpotify')}
              </a>
            )}
          </div>
          )}
        </div>
      </div>

      {loading ? (
        <p className="muted pad">{t('loadingCard')}</p>
      ) : (
        <div className="pad">
          {!neon && (
            <>
              <h3>{t('aboutArtist')}</h3>
              <p className="sheet-desc">{about}</p>
            </>
          )}

          {!neon && genres.length > 0 && (
            <>
              <h3>{t('genres')}</h3>
              <div className="similar-row">
                {genres.map((g) => {
                  const match = catalog.find(
                    (x) => x.name.toLowerCase() === g.toLowerCase(),
                  )
                  return (
                    <button
                      key={g}
                      type="button"
                      className={`similar-chip ${match ? 'clickable' : ''}`}
                      style={{ color: match?.color ?? '#1db954' }}
                      disabled={!match}
                      onClick={() => {
                        if (match) onOpenGenre(match.id)
                      }}
                    >
                      {g}
                    </button>
                  )
                })}
              </div>
            </>
          )}

          <div className="neon-tracks-head">
            <h3>{t('topTracks')}</h3>
            {neon && <span className="neon-see-all">{t('more')}</span>}
          </div>
          <ul className={`track-list ${neon ? 'track-list-neon' : ''}`}>
            {tracks.map((tTrack, i) => (
              <li key={tTrack.id}>
                {neon ? (
                  <div className="track-main">
                    <button
                      type="button"
                      className="track-neon-hit"
                      onClick={() => togglePreview(tTrack)}
                      aria-label={tTrack.name}
                    >
                      <img
                        className="track-thumb-neon"
                        src={
                          tTrack.album?.images?.[0]?.url || cover || ''
                        }
                        alt=""
                        draggable={false}
                      />
                    </button>
                    <div className="track-neon-text">
                      <button
                        type="button"
                        className="track-neon-title"
                        onClick={() => togglePreview(tTrack)}
                      >
                        {tTrack.name}
                      </button>
                      {tTrack.external_urls?.spotify ? (
                        <a
                          className="muted track-spotify-link"
                          href={tTrack.external_urls.spotify}
                          target="_blank"
                          rel="noreferrer"
                          onClick={(e) =>
                            openInSpotify(tTrack.external_urls!.spotify!, e)
                          }
                        >
                          {t('openInSpotify')}
                        </a>
                      ) : (
                        <span className="muted track-spotify-link">
                          {t('openInSpotify')}
                        </span>
                      )}
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    className="track-main"
                    onClick={() => togglePreview(tTrack)}
                  >
                    <span
                      className={`track-media-ico ${
                        playingId === tTrack.id ? 'pause' : 'play'
                      }`}
                      aria-hidden
                    />
                    <span className="track-num">{i + 1}</span>
                    <span className="track-meta">
                      <strong>{tTrack.name}</strong>
                      <span className="muted">
                        {tTrack.preview_url
                          ? playingId === tTrack.id
                            ? t('pausePreview')
                            : t('play30')
                          : t('openSpotifyShort')}
                      </span>
                    </span>
                  </button>
                )}
                {neon && (
                  <button
                    type="button"
                    className="track-play-neon"
                    aria-label={t('play30')}
                    onClick={() => togglePreview(tTrack)}
                  >
                    <span
                      className={`track-media-ico ${
                        playingId === tTrack.id ? 'pause' : 'play'
                      }`}
                      aria-hidden
                    />
                  </button>
                )}
              </li>
            ))}
          </ul>

          {related.length > 0 && (
            <>
              <h3>{t('similarArtists')}</h3>
              <div className="related-artists">
                {related.slice(0, relatedCount).map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    className="related-artist"
                    onClick={() => onOpenArtist(a.id, a.name)}
                  >
                    {a.images?.[0]?.url ? (
                      <img src={a.images[0].url} alt="" />
                    ) : (
                      <span className="related-ph" />
                    )}
                    <span>{a.name}</span>
                  </button>
                ))}
              </div>
              {relatedCount < related.length && (
                <button
                  type="button"
                  className="more-btn"
                  onClick={() =>
                    setRelatedCount((n) => Math.min(n + 4, related.length))
                  }
                >
                  {t('more')}
                </button>
              )}
            </>
          )}
        </div>
      )}
    </motion.div>
  )
}
