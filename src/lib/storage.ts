import type { Preferences } from '../types'
import {
  DEFAULT_LOCALE,
  detectBrowserLocale,
  type Locale,
} from '../i18n/types'

const PREFS_KEY = 'weirdnoise-prefs-v1'
const SETTINGS_KEY = 'weirdnoise-settings-v1'
const FIRST_DECK_KEY = 'weirdnoise-first-deck-v2'
const HISTORY_KEY = 'weirdnoise-genre-history-v2'
const HISTORY_KEY_LEGACY = 'weirdnoise-genre-history-v1'
const ONBOARDING_KEY = 'weirdnoise-onboarding-v2'
const INSTALL_GUIDE_KEY = 'weirdnoise-install-guide-v2'
const SWIPE_COUNT_KEY = 'weirdnoise-swipe-count-v1'
const LIKED_AT_KEY = 'weirdnoise-liked-at-v1'
/** Max genre history entries (settings UI must use the same value). */
export const HISTORY_LIMIT = 8

export type GenreHistoryAction = 'like' | 'skip' | 'dislike'

export type GenreHistoryEntry = {
  id: string
  action: GenreHistoryAction
}

/** Cards that must pass before a liked genre can show again */
export const LIKED_REAPPEAR_AFTER = 300

/** True until the very first genre card has been shown. */
export function isFirstDeckLaunch(): boolean {
  try {
    return !localStorage.getItem(FIRST_DECK_KEY)
  } catch {
    return true
  }
}

export function markFirstDeckLaunchDone() {
  try {
    localStorage.setItem(FIRST_DECK_KEY, '1')
  } catch {
    /* ignore */
  }
}

export function isOnboardingDone(): boolean {
  try {
    return localStorage.getItem(ONBOARDING_KEY) === '1'
  } catch {
    return false
  }
}

export function markOnboardingDone() {
  try {
    localStorage.setItem(ONBOARDING_KEY, '1')
  } catch {
    /* ignore */
  }
}

export function isInstallGuideDone(): boolean {
  try {
    return localStorage.getItem(INSTALL_GUIDE_KEY) === '1'
  } catch {
    return false
  }
}

export function markInstallGuideDone() {
  try {
    localStorage.setItem(INSTALL_GUIDE_KEY, '1')
  } catch {
    /* ignore */
  }
}

export function shouldShowInstallGuide(): boolean {
  if (isInstallGuideDone()) return false
  try {
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      // @ts-expect-error iOS Safari
      navigator.standalone === true
    if (standalone) return false
    return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
  } catch {
    return false
  }
}

/** Last swiped genres, newest first. */
export function loadGenreHistory(): GenreHistoryEntry[] {
  try {
    const raw =
      localStorage.getItem(HISTORY_KEY) ??
      localStorage.getItem(HISTORY_KEY_LEGACY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    const out: GenreHistoryEntry[] = []
    for (const item of parsed) {
      if (typeof item === 'string') {
        out.push({ id: item, action: 'skip' })
        continue
      }
      if (
        item &&
        typeof item === 'object' &&
        typeof (item as GenreHistoryEntry).id === 'string'
      ) {
        const action = (item as GenreHistoryEntry).action
        out.push({
          id: (item as GenreHistoryEntry).id,
          action:
            action === 'like' || action === 'dislike' || action === 'skip'
              ? action
              : 'skip',
        })
      }
    }
    return out.slice(0, HISTORY_LIMIT)
  } catch {
    return []
  }
}

export function pushGenreHistory(
  genreId: string,
  action: GenreHistoryAction = 'skip',
): GenreHistoryEntry[] {
  if (!genreId) return loadGenreHistory()
  const prev = loadGenreHistory().filter((e) => e.id !== genreId)
  const next = [{ id: genreId, action }, ...prev].slice(0, HISTORY_LIMIT)
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(next))
    localStorage.removeItem(HISTORY_KEY_LEGACY)
  } catch {
    /* ignore */
  }
  return next
}

export function loadSwipeCount(): number {
  try {
    const n = Number(localStorage.getItem(SWIPE_COUNT_KEY) ?? '0')
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0
  } catch {
    return 0
  }
}

export function bumpSwipeCount(): number {
  const next = loadSwipeCount() + 1
  try {
    localStorage.setItem(SWIPE_COUNT_KEY, String(next))
  } catch {
    /* ignore */
  }
  return next
}

/** swipeCount when each liked genre was last locked (like / re-show) */
export function loadLikedAt(): Record<string, number> {
  try {
    const raw = localStorage.getItem(LIKED_AT_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as Record<string, unknown>
    const out: Record<string, number> = {}
    for (const [id, v] of Object.entries(parsed)) {
      if (typeof v === 'number' && Number.isFinite(v)) out[id] = v
    }
    return out
  } catch {
    return {}
  }
}

export function saveLikedAt(map: Record<string, number>) {
  try {
    localStorage.setItem(LIKED_AT_KEY, JSON.stringify(map))
  } catch {
    /* ignore */
  }
}

export function markLikedGenresAt(
  genreIds: string[],
  swipeCount: number,
): Record<string, number> {
  if (!genreIds.length) return loadLikedAt()
  const next = { ...loadLikedAt() }
  for (const id of genreIds) {
    if (id) next[id] = swipeCount
  }
  saveLikedAt(next)
  return next
}

export type TasteMode = 'off' | 'taste' | 'anti'

export type AppSettings = {
  tasteMode: TasteMode
  locale: Locale
}

const LOCALES: Locale[] = [
  'en',
  'uk',
  'ru',
  'pl',
  'th',
  'zh',
  'es',
  'pt',
  'de',
  'ja',
]

function parseLocale(v: unknown): Locale | null {
  return LOCALES.includes(v as Locale) ? (v as Locale) : null
}

function defaultSettings(): AppSettings {
  return {
    tasteMode: 'off',
    locale: detectBrowserLocale(),
  }
}

export function loadPrefs(): Preferences {
  try {
    const raw = localStorage.getItem(PREFS_KEY)
    if (!raw) return { liked: [], disliked: [] }
    const parsed = JSON.parse(raw) as Preferences
    return {
      liked: Array.isArray(parsed.liked) ? parsed.liked : [],
      disliked: Array.isArray(parsed.disliked) ? parsed.disliked : [],
      likedArtistIds: Array.isArray(parsed.likedArtistIds)
        ? parsed.likedArtistIds.filter((x) => typeof x === 'string')
        : [],
      likedArtistNames: Array.isArray(parsed.likedArtistNames)
        ? parsed.likedArtistNames.filter((x) => typeof x === 'string')
        : [],
    }
  } catch {
    return { liked: [], disliked: [] }
  }
}

export function savePrefs(prefs: Preferences) {
  localStorage.setItem(PREFS_KEY, JSON.stringify(prefs))
}

export function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    if (!raw) return defaultSettings()
    const parsed = JSON.parse(raw) as Partial<AppSettings>
    const mode = parsed.tasteMode
    const savedLocale = parseLocale(parsed.locale)
    return {
      tasteMode:
        mode === 'taste' || mode === 'anti' || mode === 'off' ? mode : 'off',
      // Only fall back to browser when locale was never saved
      locale: savedLocale ?? detectBrowserLocale(undefined, DEFAULT_LOCALE),
    }
  } catch {
    return defaultSettings()
  }
}

export function saveSettings(settings: AppSettings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
}
