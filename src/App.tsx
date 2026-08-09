import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import type { Genre, GenresPayload, Preferences } from './types'
import {
  bumpSwipeCount,
  isFirstDeckLaunch,
  isOnboardingDone,
  loadGenreHistory,
  loadLikedAt,
  loadPrefs,
  loadSettings,
  loadSwipeCount,
  markFirstDeckLaunchDone,
  markInstallGuideDone,
  markLikedGenresAt,
  markOnboardingDone,
  pushGenreHistory,
  savePrefs,
  saveSettings,
  shouldShowInstallGuide,
  type AppSettings,
  type GenreHistoryEntry,
} from './lib/storage'
import {
  buildRelatedSets,
  pickNextGenre,
  type SimilarityIndex,
} from './lib/deck'
import { catalogUrls, loadCatalogJson } from './lib/catalogData'
import { combineTasteGenreIds } from './lib/taste'
import { setDescribeLocale, setGenreWikiBlurbs } from './lib/describe'
import type { WikiBlurb } from './lib/describeFallbacks'
import { applyGenreOverrides, type OverridesMap } from './lib/overrides'
import {
  beginSpotifyLogin,
  clearUserAuth,
  completeSpotifyLoginIfNeeded,
  fetchTasteProfile,
  loadUserAuth,
  type TasteProfile,
  type UserAuth,
} from './lib/spotify'
import { GenreCard } from './components/GenreCard'
import { ArtistView } from './components/ArtistView'
import { OmniSearch } from './components/OmniSearch'
import { SettingsSheet } from './components/SettingsSheet'
import { InstallGuide } from './components/InstallGuide'
import { TasteOnboarding } from './components/TasteOnboarding'
import { I18nProvider, useI18n, type Locale } from './i18n'
import { stopPreviewAudio } from './lib/previewAudio'
import { useNeonTheme } from './lib/useNeonTheme'
import brandLogo from './assets/logo.png'
import splashCover from './assets/splash-cover.png'
import './styles/App.css'

type SimPayload = {
  related: SimilarityIndex
}

type ArtistRoute = { id: string; name: string }

function AppInner() {
  const { t, setLocale } = useI18n()
  const neon = useNeonTheme()
  const [genres, setGenres] = useState<Genre[]>([])
  const [simIndex, setSimIndex] = useState<SimilarityIndex>({})
  const [error, setError] = useState<string | null>(null)
  const [prefs, setPrefs] = useState<Preferences>(() => loadPrefs())
  const [settings, setSettings] = useState<AppSettings>(() => loadSettings())
  const [current, setCurrent] = useState<Genre | null>(null)
  const [recent, setRecent] = useState<string[]>([])
  const [artistStack, setArtistStack] = useState<ArtistRoute[]>([])
  const [auth, setAuth] = useState<UserAuth | null>(() => loadUserAuth())
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [taste, setTaste] = useState<TasteProfile | null>(null)
  const [tasteStatus, setTasteStatus] = useState<
    'idle' | 'loading' | 'ready' | 'missing'
  >('idle')
  const [showInstallGuide, setShowInstallGuide] = useState(() =>
    shouldShowInstallGuide(),
  )
  const [showOnboarding, setShowOnboarding] = useState(() => {
    // Existing users who already used the deck skip the new onboarding
    if (!isFirstDeckLaunch()) {
      markOnboardingDone()
      return false
    }
    return !isOnboardingDone()
  })
  const [genreHistory, setGenreHistory] = useState<GenreHistoryEntry[]>(() =>
    loadGenreHistory(),
  )
  const [swipeCount, setSwipeCount] = useState(() => loadSwipeCount())
  const [likedAt, setLikedAt] = useState<Record<string, number>>(() =>
    loadLikedAt(),
  )
  const [showSplash, setShowSplash] = useState(true)

  useEffect(() => {
    const id = window.setTimeout(() => setShowSplash(false), 1500)
    return () => window.clearTimeout(id)
  }, [])

  useEffect(() => {
    if (!neon) return
    const accent = current?.color || '#00e676'
    document.documentElement.style.setProperty('--vf-accent', accent)
    return () => {
      document.documentElement.style.removeProperty('--vf-accent')
    }
  }, [neon, current?.color])

  const related = useMemo(() => buildRelatedSets(simIndex), [simIndex])
  const activeArtist = artistStack[artistStack.length - 1] ?? null

  const tasteGenreIds = useMemo(() => {
    const fromSpotify =
      taste && genres.length
        ? combineTasteGenreIds(
            taste.genreLabels,
            taste.artistIds,
            genres,
            taste.artistNames,
          )
        : []
    return [...new Set([...fromSpotify, ...prefs.liked])]
  }, [taste, genres, prefs.liked])

  const tasteArtistIds = useMemo(
    () =>
      [
        ...new Set([
          ...(taste?.artistIds ?? []),
          ...(prefs.likedArtistIds ?? []),
        ]),
      ].slice(0, 80),
    [taste?.artistIds, prefs.likedArtistIds],
  )

  const tasteArtistNames = useMemo(
    () =>
      [
        ...new Set([
          ...(taste?.artistNames ?? []),
          ...(prefs.likedArtistNames ?? []),
        ]),
      ].slice(0, 80),
    [taste?.artistNames, prefs.likedArtistNames],
  )

  const tasteSignals = useMemo(
    () =>
      taste
        ? {
            genreLabels: taste.genreLabels,
            genreLabelWeights: taste.genreLabelWeights,
            artistIds: taste.artistIds,
            artistWeights: taste.artistWeights,
            artistNames: taste.artistNames,
            likedGenreIds: prefs.liked,
            likedArtistIds: prefs.likedArtistIds,
            likedArtistNames: prefs.likedArtistNames,
          }
        : {
            likedGenreIds: prefs.liked,
            likedArtistIds: prefs.likedArtistIds,
            likedArtistNames: prefs.likedArtistNames,
          },
    [taste, prefs.liked, prefs.likedArtistIds, prefs.likedArtistNames],
  )

  useEffect(() => {
    let cancelled = false

    Promise.all([
      loadCatalogJson<GenresPayload>(
        catalogUrls('/genres.json', true),
        t('loadGenresFail'),
      ),
      loadCatalogJson<SimPayload>(
        catalogUrls('/similarity.json'),
        t('loadSimFail'),
      ),
      loadCatalogJson<{ descriptions?: Record<string, WikiBlurb> }>(
        catalogUrls('/genre-descriptions.json'),
        t('loadGenresFail'),
      )
        .then((wiki) => wiki)
        .catch(() => null),
      loadCatalogJson<OverridesMap>(
        catalogUrls('/genre-overrides.json'),
        t('loadGenresFail'),
      ).catch(() => ({}) as OverridesMap),
    ])
      .then(([data, sim, wiki, overrides]) => {
        if (cancelled) return
        setGenres(applyGenreOverrides(data.genres, overrides || {}))
        setSimIndex(sim.related ?? {})
        if (wiki?.descriptions) setGenreWikiBlurbs(wiki.descriptions)
      })
      .catch((e: Error) => {
        if (cancelled) return
        const offline =
          typeof navigator !== 'undefined' && navigator.onLine === false
        setError(offline ? t('loadOfflineFail') : e.message)
      })
    return () => {
      cancelled = true
    }
  }, [t])

  useEffect(() => {
    void completeSpotifyLoginIfNeeded().then((a) => {
      if (a) setAuth(a)
    })
  }, [])

  const refreshTaste = useCallback(async () => {
    setTasteStatus('loading')
    const profile = await fetchTasteProfile()
    setTaste(profile)
    setTasteStatus(profile ? 'ready' : 'missing')
  }, [])

  useEffect(() => {
    if (settings.tasteMode !== 'off') {
      void refreshTaste()
    }
  }, [auth?.userId, settings.tasteMode, refreshTaste])

  useEffect(() => {
    setDescribeLocale(settings.locale)
    document.documentElement.lang = settings.locale
  }, [settings.locale])

  // Ensure locale applied on first paint
  useEffect(() => {
    setDescribeLocale(loadSettings().locale)
  }, [])

  const advance = useCallback(
    (
      nextPrefs: Preferences,
      justSeen?: string,
      action: 'like' | 'skip' | 'dislike' = 'skip',
    ) => {
      const exclude = new Set(recent)
      if (justSeen) exclude.add(justSeen)

      let nextSwipe = swipeCount
      let nextLikedAt = likedAt
      if (justSeen) {
        nextSwipe = bumpSwipeCount()
        setSwipeCount(nextSwipe)
        // Liked genres stay out for ~300 cards after each appearance / like
        if (nextPrefs.liked.includes(justSeen)) {
          nextLikedAt = markLikedGenresAt([justSeen], nextSwipe)
          setLikedAt(nextLikedAt)
        }
      }

      // First open without seeded likes: land on post-punk
      if (
        !justSeen &&
        recent.length === 0 &&
        isFirstDeckLaunch() &&
        nextPrefs.liked.length === 0 &&
        !nextPrefs.disliked.includes('post-punk')
      ) {
        const starter = genres.find((g) => g.id === 'post-punk')
        if (starter) {
          markFirstDeckLaunchDone()
          setCurrent(starter)
          return
        }
      }

      const picked = pickNextGenre(genres, nextPrefs, exclude, related, {
        tasteMode: settings.tasteMode,
        tasteGenreIds,
        tasteArtistIds,
        tasteArtistNames,
        tasteArtistWeights: taste?.artistWeights,
        tasteSignals,
        simIndex,
        seenCount: recent.length + (justSeen ? 1 : 0),
        swipeCount: nextSwipe,
        likedAt: nextLikedAt,
      })
      setCurrent(picked)
      setRecent((r) => {
        const n = justSeen ? [...r, justSeen] : r
        return n.slice(-8)
      })
      if (justSeen && action !== 'like') {
        setGenreHistory(pushGenreHistory(justSeen, action))
      }
    },
    [
      genres,
      recent,
      related,
      settings.tasteMode,
      tasteGenreIds,
      tasteArtistIds,
      tasteArtistNames,
      taste?.artistWeights,
      tasteSignals,
      simIndex,
      swipeCount,
      likedAt,
    ],
  )

  useEffect(() => {
    if (showInstallGuide || showOnboarding) return
    if (!genres.length || current) return
    advance(prefs)
  }, [
    genres,
    current,
    prefs,
    advance,
    showInstallGuide,
    showOnboarding,
  ])

  function onLike() {
    if (!current) return
    stopPreviewAudio()
    const id = current.id
    const nextPrefs: Preferences = {
      ...prefs,
      liked: prefs.liked.includes(id) ? prefs.liked : [...prefs.liked, id],
      disliked: prefs.disliked.filter((x) => x !== id),
    }
    savePrefs(nextPrefs)
    setPrefs(nextPrefs)
    advance(nextPrefs, id, 'like')
  }

  function onDislike() {
    if (!current) return
    stopPreviewAudio()
    const id = current.id
    const nextPrefs: Preferences = {
      ...prefs,
      liked: prefs.liked.filter((x) => x !== id),
      disliked: prefs.disliked.includes(id)
        ? prefs.disliked
        : [...prefs.disliked, id],
    }
    savePrefs(nextPrefs)
    setPrefs(nextPrefs)
    advance(nextPrefs, id, 'dislike')
  }

  function onSkip() {
    if (!current) return
    stopPreviewAudio()
    advance(prefs, current.id, 'skip')
  }

  function resetDislikes() {
    const nextPrefs = { ...prefs, disliked: [] }
    savePrefs(nextPrefs)
    setPrefs(nextPrefs)
  }

  function goHome() {
    stopPreviewAudio()
    setArtistStack([])
    setSettingsOpen(false)
  }

  function openGenre(genreId: string) {
    const g = genres.find((x) => x.id === genreId)
    if (!g) return
    stopPreviewAudio()
    setArtistStack([])
    setSettingsOpen(false)
    setCurrent(g)
    setRecent((r) => [...r, g.id].slice(-8))
  }

  function openArtist(id: string, name: string) {
    stopPreviewAudio()
    setArtistStack((s) => [...s, { id, name }])
  }

  async function connectSpotify() {
    try {
      await beginSpotifyLogin()
    } catch (e) {
      alert(e instanceof Error ? e.message : t('loginFail'))
    }
  }

  function logout() {
    clearUserAuth()
    setAuth(null)
    setTaste(null)
    setTasteStatus('missing')
  }

  function updateSettings(next: AppSettings) {
    saveSettings(next)
    setSettings(next)
    setLocale(next.locale)
  }

  function finishInstallGuide() {
    markInstallGuideDone()
    setShowInstallGuide(false)
  }

  function finishOnboarding(
    selectedGenreIds: string[],
    artists: { ids: string[]; names: string[] },
    enableTasteMode: boolean,
  ) {
    markOnboardingDone()
    markFirstDeckLaunchDone()
    setShowOnboarding(false)

    let nextPrefs = prefs
    if (selectedGenreIds.length || artists.ids.length || artists.names.length) {
      const liked = [...new Set([...prefs.liked, ...selectedGenreIds])]
      nextPrefs = {
        ...prefs,
        liked,
        disliked: prefs.disliked.filter((id) => !liked.includes(id)),
        likedArtistIds: [
          ...new Set([...(prefs.likedArtistIds ?? []), ...artists.ids]),
        ],
        likedArtistNames: [
          ...new Set([...(prefs.likedArtistNames ?? []), ...artists.names]),
        ],
      }
      savePrefs(nextPrefs)
      setPrefs(nextPrefs)
      if (selectedGenreIds.length) {
        setLikedAt(markLikedGenresAt(selectedGenreIds, loadSwipeCount()))
      }
    }

    if (enableTasteMode) {
      const nextSettings: AppSettings = {
        ...settings,
        tasteMode: 'taste',
      }
      saveSettings(nextSettings)
      setSettings(nextSettings)
      void refreshTaste()
    }

    setCurrent(null)
    // advance will run via effect when current is null
  }

  const modeLabel =
    settings.tasteMode === 'taste'
      ? t('modeLabelTaste')
      : settings.tasteMode === 'anti'
        ? t('modeLabelAnti')
        : t('modeLabelOff')

  if (error) {
    return (
      <div className="app shell">
        <p className="error">{error}</p>
      </div>
    )
  }

  const waitingForDeck =
    !genres.length || (!showInstallGuide && !showOnboarding && !current)

  let body: ReactNode = null

  if (showInstallGuide) {
    body = (
      <div className="app shell">
        <InstallGuide onDone={finishInstallGuide} />
      </div>
    )
  } else if (showOnboarding) {
    body = genres.length ? (
      <div className="app shell">
        <TasteOnboarding
          genres={genres}
          simIndex={simIndex}
          related={related}
          connected={Boolean(auth)}
          onConnectSpotify={() => void connectSpotify()}
          onFinish={finishOnboarding}
        />
      </div>
    ) : null
  } else if (current && genres.length) {
    const deckGenre = current
    body = (
      <div
        className={`app ${neon ? 'app-neon' : ''}`}
        style={
          neon
            ? { ['--vf-accent' as string]: deckGenre.color || '#00e676' }
            : undefined
        }
      >
      <header className={`top ${neon ? 'top-neon' : ''}`}>
        <div className="top-brand">
          <button
            type="button"
            className="brand"
            onClick={goHome}
            aria-label={t('homeAria')}
          >
            <img
              src={brandLogo}
              alt=""
              className="brand-logo"
              draggable={false}
            />
            <span>{neon ? 'VIBEFLOWS' : 'VibeFlows'}</span>
          </button>
          {!neon && <p className="sub">{modeLabel}</p>}
        </div>
        <OmniSearch
          genres={genres}
          onSelectGenre={openGenre}
          onSelectArtist={openArtist}
        />
        <button
          type="button"
          className="icon-btn"
          aria-label={t('settingsAria')}
          onClick={() => setSettingsOpen(true)}
        >
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9c.26.6.84 1 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
          </svg>
        </button>
      </header>

      <div className="card-stage">
        <AnimatePresence mode="wait">
          {activeArtist ? (
            <ArtistView
              key={activeArtist.id}
              artistId={activeArtist.id}
              artistName={activeArtist.name}
              catalog={genres}
              connected={auth}
              onBack={() => setArtistStack((s) => s.slice(0, -1))}
              onOpenArtist={openArtist}
              onOpenGenre={openGenre}
              onConnect={() => void connectSpotify()}
            />
          ) : (
            <GenreCard
              key={deckGenre.id}
              genre={deckGenre}
              all={genres}
              prefs={prefs}
              related={related}
              simIndex={simIndex}
              connected={Boolean(auth)}
              onLike={onLike}
              onDislike={onDislike}
              onSkip={onSkip}
              onOpenArtist={openArtist}
              onOpenGenre={openGenre}
              onConnectSpotify={() => void connectSpotify()}
            />
          )}
        </AnimatePresence>
      </div>

      {!activeArtist && (
        <div className={`dock ${neon ? 'dock-neon' : ''}`}>
          {(
            [
              ['dislike', t('dislike'), onDislike, 'nope-btn'] as const,
              ['skip', t('skip'), onSkip, 'skip-btn'] as const,
              ['like', t('like'), onLike, 'like-btn'] as const,
            ] as const
          ).map(([key, label, handler, btnClass]) => (
            <div className="dock-item" key={key}>
              <motion.button
                type="button"
                className={`round ${btnClass}`}
                aria-label={label}
                onClick={handler}
                whileTap={{ scale: 0.9 }}
              >
                {key === 'like' ? (
                  <span className="heart-icon" aria-hidden />
                ) : key === 'skip' ? (
                  <svg
                    className="skip-icon"
                    viewBox="0 0 24 24"
                    width="24"
                    height="24"
                    aria-hidden
                  >
                    <path
                      d="M12 5.5v13M6.5 11L12 5.5 17.5 11"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.4"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                ) : (
                  <svg
                    className="nope-icon"
                    viewBox="0 0 24 24"
                    width="28"
                    height="28"
                    aria-hidden
                  >
                    <path
                      d="M6.2 6.2l11.6 11.6M17.8 6.2L6.2 17.8"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.6"
                      strokeLinecap="round"
                    />
                  </svg>
                )}
              </motion.button>
              <span className="dock-label">{label}</span>
            </div>
          ))}
        </div>
      )}

      <SettingsSheet
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        settings={settings}
        onChangeSettings={updateSettings}
        auth={auth}
        onConnect={() => void connectSpotify()}
        onLogout={logout}
        tasteReady={tasteStatus === 'ready'}
        tasteMissing={tasteStatus === 'missing'}
        tasteCount={tasteGenreIds.length}
        onRefreshTaste={() => void refreshTaste()}
        banCount={prefs.disliked.length}
        onResetBan={resetDislikes}
        history={genreHistory.map((e) => ({
          id: e.id,
          action: e.action,
          label: genres.find((g) => g.id === e.id)?.name ?? e.id,
        }))}
        likedIds={[...prefs.liked].reverse()}
        likedLabels={[...prefs.liked]
          .reverse()
          .map((id) => genres.find((g) => g.id === id)?.name ?? id)}
        onOpenHistoryGenre={openGenre}
      />
    </div>
    )
  }

  return (
    <>
      {body}
      {!showSplash && waitingForDeck && !body && (
        <div className="app shell splash-screen" aria-busy="true">
          <div className="splash-stage">
            <img
              className="splash-cover"
              src={splashCover}
              alt="VibeFlows"
              draggable={false}
            />
          </div>
        </div>
      )}
      <AnimatePresence>
        {showSplash && (
          <motion.div
            key="brand-splash"
            className="splash-overlay"
            role="status"
            aria-busy="true"
            aria-label="VibeFlows"
            initial={{ opacity: 1 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.45, ease: 'easeOut' }}
          >
            <div className="splash-stage">
              <img
                className="splash-cover"
                src={splashCover}
                alt="VibeFlows"
                draggable={false}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}

export default function App() {
  const initial = loadSettings()
  const [locale, setLocale] = useState<Locale>(initial.locale)
  return (
    <I18nProvider locale={locale} onLocaleChange={setLocale}>
      <AppInner />
    </I18nProvider>
  )
}
