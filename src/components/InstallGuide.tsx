import { useState } from 'react'
import { useI18n } from '../i18n'

type BrowserId = 'chrome' | 'safari' | 'yandex' | 'edge'

const BROWSERS: Array<{ id: BrowserId; label: string }> = [
  { id: 'chrome', label: 'Chrome' },
  { id: 'safari', label: 'Safari' },
  { id: 'yandex', label: 'Yandex' },
  { id: 'edge', label: 'Edge' },
]

type Props = {
  onDone: () => void
}

export function InstallGuide({ onDone }: Props) {
  const { t } = useI18n()
  const [browser, setBrowser] = useState<BrowserId | null>(null)

  return (
    <div className="gate-overlay">
      <div className="gate-card">
        <p className="eyebrow">{t('installGuideEyebrow')}</p>
        <h2>{t('installGuideTitle')}</h2>
        <p className="sheet-desc">{t('installGuideLead')}</p>

        <div className="install-browsers">
          {BROWSERS.map((b) => (
            <button
              key={b.id}
              type="button"
              className={`chip ${browser === b.id ? 'on' : ''}`}
              onClick={() => setBrowser(b.id)}
            >
              {b.label}
            </button>
          ))}
        </div>

        {browser && (
          <ol className="install-steps">
            <li>{t(`installStep_${browser}_1`)}</li>
            <li>{t(`installStep_${browser}_2`)}</li>
            <li>{t(`installStep_${browser}_3`)}</li>
          </ol>
        )}

        <button type="button" className="playlist-btn gate-primary" onClick={onDone}>
          {t('installGuideContinue')}
        </button>
        <button type="button" className="text-btn gate-skip" onClick={onDone}>
          {t('installGuideSkip')}
        </button>
      </div>
    </div>
  )
}
