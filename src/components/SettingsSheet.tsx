import { useState, useEffect } from 'react'
import type { AppSettings, TasteMode } from '../lib/storage'
import { HISTORY_LIMIT } from '../lib/storage'
import type { GenreHistoryAction } from '../lib/storage'
import type { UserAuth } from '../lib/spotify'
import { useI18n } from '../i18n'
import { useNeonTheme } from '../lib/useNeonTheme'

const LIKED_PAGE = 4
const HISTORY_PAGE = HISTORY_LIMIT

type HistoryItem = {
  id: string
  label: string
  action: GenreHistoryAction
}

type Props = {
  open: boolean
  onClose: () => void
  settings: AppSettings
  onChangeSettings: (next: AppSettings) => void
  auth: UserAuth | null
  onConnect: () => void
  onLogout: () => void
  tasteReady: boolean
  tasteMissing?: boolean
  tasteCount: number
  onRefreshTaste: () => void
  banCount: number
  onResetBan: () => void
  history: HistoryItem[]
  likedIds: string[]
  likedLabels: string[]
  onOpenHistoryGenre: (genreId: string) => void
}

export function SettingsSheet({
  open,
  onClose,
  settings,
  onChangeSettings,
  auth,
  onConnect,
  onLogout,
  tasteReady,
  tasteMissing = false,
  tasteCount,
  onRefreshTaste,
  banCount,
  onResetBan,
  history,
  likedIds,
  likedLabels,
  onOpenHistoryGenre,
}: Props) {
  const { t, locales, locale, setLocale } = useI18n()
  const neon = useNeonTheme()
  const [langOpen, setLangOpen] = useState(false)
  const [likedVisible, setLikedVisible] = useState(LIKED_PAGE)

  useEffect(() => {
    if (open) setLikedVisible(LIKED_PAGE)
  }, [open])

  if (!open) return null

  const modes: Array<{ id: TasteMode; title: string; desc: string }> = [
    { id: 'off', title: t('modeOff'), desc: t('modeOffDesc') },
    { id: 'taste', title: t('modeTaste'), desc: t('modeTasteDesc') },
    { id: 'anti', title: t('modeAnti'), desc: t('modeAntiDesc') },
  ]
  const activeMode = modes.find((m) => m.id === settings.tasteMode) ?? modes[0]
  const currentLang = locales.find((l) => l.id === locale) ?? locales[0]
  const likedShown = Math.min(likedVisible, likedIds.length)
  const likedHasMore = likedIds.length > likedShown
  const historyShown = history.slice(0, HISTORY_PAGE)

  return (
    <div
      className={`settings-overlay${neon ? ' settings-overlay-neon' : ''}`}
      role="dialog"
      aria-label={t('settings')}
    >
      <button type="button" className="settings-backdrop" onClick={onClose} />
      <div className={`settings-sheet${neon ? ' settings-sheet-neon' : ''}`}>
        {!neon && <div className="sheet-handle" />}
        <div className="settings-head">
          <h2>{t('settings')}</h2>
          <button type="button" className="sheet-close" onClick={onClose}>
            ✕
          </button>
        </div>

        <section className="settings-block">
          <h3>{t('spotify')}</h3>
          {!neon && <p className="muted tiny">{t('spotifyHint')}</p>}
          {auth ? (
            <div className="settings-row">
              <span className="settings-inline-value">
                {t('loggedInAs', {
                  name: auth.displayName || 'Spotify',
                })}
              </span>
              <button type="button" className="text-btn" onClick={onLogout}>
                {t('logout')}
              </button>
            </div>
          ) : (
            <button
              type="button"
              className={neon ? 'settings-primary-btn' : 'playlist-btn'}
              onClick={onConnect}
            >
              {t('loginSpotify')}
            </button>
          )}
        </section>

        <section className="settings-block">
          <h3>{t('matchMode')}</h3>
          <div className="mode-seg">
            {modes.map((m) => (
              <button
                key={m.id}
                type="button"
                className={`mode-seg-btn ${
                  settings.tasteMode === m.id ? 'active' : ''
                }`}
                onClick={() =>
                  onChangeSettings({ ...settings, tasteMode: m.id })
                }
              >
                <strong>{m.title}</strong>
              </button>
            ))}
          </div>
          <p className="mode-seg-desc muted tiny">{activeMode.desc}</p>
          {settings.tasteMode !== 'off' && (
            <div className="settings-row wrap">
              <span className="muted tiny">
                {tasteReady
                  ? t('tasteLoaded', { count: tasteCount })
                  : tasteMissing
                    ? auth
                      ? t('tasteUnavailable')
                      : t('tasteNeedLogin')
                    : t('tasteLoading')}
              </span>
              <button
                type="button"
                className="text-btn"
                onClick={onRefreshTaste}
              >
                {t('refreshTaste')}
              </button>
            </div>
          )}
        </section>

        <section className="settings-block">
          <h3>{t('likedHistory')}</h3>
          {likedIds.length === 0 ? (
            <p className="muted tiny settings-empty-hint">
              {t('likedHistoryEmpty')}
            </p>
          ) : (
            <div className="liked-chip-rail">
              {likedIds.slice(0, likedShown).map((id, i) => (
                <button
                  key={id}
                  type="button"
                  className="liked-chip"
                  onClick={() => onOpenHistoryGenre(id)}
                >
                  <span className="liked-chip-heart" aria-hidden />
                  <span className="liked-chip-name">
                    {likedLabels[i] ?? id}
                  </span>
                </button>
              ))}
              {likedHasMore && (
                <button
                  type="button"
                  className="liked-chip liked-chip-more"
                  onClick={() =>
                    setLikedVisible((n) =>
                      Math.min(n + LIKED_PAGE, likedIds.length),
                    )
                  }
                  aria-label="+"
                >
                  <span className="liked-chip-plus" aria-hidden>
                    +
                  </span>
                </button>
              )}
            </div>
          )}
        </section>

        <section className="settings-block">
          <h3>{t('history')}</h3>
          {history.length === 0 ? (
            <p className="muted tiny settings-empty-hint">
              {t('historyEmptyHint')}
            </p>
          ) : (
            <div className="liked-chip-rail history-chip-rail">
              {historyShown.map((item) => (
                <button
                  key={`${item.id}-${item.action}`}
                  type="button"
                  className={`liked-chip history-chip history-chip-${item.action}`}
                  onClick={() => onOpenHistoryGenre(item.id)}
                >
                  <span className={`history-chip-ico history-chip-ico-${item.action}`} aria-hidden>
                    {item.action === 'skip' ? (
                      <svg viewBox="0 0 24 24" width="14" height="14">
                        <path
                          d="M12 5.5v13M6.5 11L12 5.5 17.5 11"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.4"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    ) : item.action === 'dislike' ? (
                      <svg viewBox="0 0 24 24" width="14" height="14">
                        <path
                          d="M6.2 6.2l11.6 11.6M17.8 6.2L6.2 17.8"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.6"
                          strokeLinecap="round"
                        />
                      </svg>
                    ) : null}
                  </span>
                  <span className="liked-chip-name">{item.label}</span>
                </button>
              ))}
            </div>
          )}
        </section>

        <section className="settings-block settings-block-ban">
          <h3>{t('bans')}</h3>
          <p className="muted tiny settings-empty-hint">{t('bansHint')}</p>
          <p className="ban-count">
            {banCount > 0
              ? t('bannedCount', { count: banCount })
              : t('banEmpty')}
          </p>
          <button
            type="button"
            className="ban-reset-btn ban-reset-btn-compact"
            disabled={banCount === 0}
            onClick={onResetBan}
          >
            {t('resetBan')}
          </button>
        </section>

        <section className="settings-block">
          <h3>{t('language')}</h3>
          <div className="lang-accordion">
            <button
              type="button"
              className={`lang-summary ${langOpen ? 'open' : ''}`}
              aria-expanded={langOpen}
              onClick={() => setLangOpen((v) => !v)}
            >
              <span className="lang-native">{currentLang.native}</span>
              <span className="muted tiny">{currentLang.label}</span>
              <span className="lang-caret" aria-hidden>
                {langOpen ? '▴' : '▾'}
              </span>
            </button>
            {langOpen && (
              <ul className="lang-list">
                {locales.map((l) => (
                  <li key={l.id}>
                    <button
                      type="button"
                      className={`lang-row ${locale === l.id ? 'active' : ''}`}
                      onClick={() => {
                        setLocale(l.id)
                        onChangeSettings({ ...settings, locale: l.id })
                        setLangOpen(false)
                      }}
                    >
                      <span className="lang-native">{l.native}</span>
                      <span className="muted tiny">{l.label}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        <a
          className="settings-creator-link"
          href={
            import.meta.env.VITE_CREATOR_SPOTIFY_URL?.trim() ||
            'https://open.spotify.com/user/31c3v5g5lffwmflw2rulxblu2dhu'
          }
          target="_blank"
          rel="noreferrer"
        >
          {t('creatorSpotify')}
        </a>

        <p className="settings-data-source muted tiny">
          {t('dataSourceBefore')}
          <a href="https://everynoise.com/" target="_blank" rel="noreferrer">
            Every Noise at Once
          </a>
          {t('dataSourceAfter')}
        </p>
        <p className="settings-version muted tiny">
          VibeFlows v{import.meta.env.VITE_APP_VERSION ?? '0.0.0'}
        </p>
      </div>
    </div>
  )
}
