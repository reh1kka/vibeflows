export type Locale = 'en' | 'uk' | 'ru' | 'pl' | 'th' | 'zh' | 'es' | 'pt' | 'de' | 'ja'

export const LOCALES: Array<{ id: Locale; label: string; native: string }> = [
  { id: 'en', label: 'English', native: 'English' },
  { id: 'uk', label: 'Ukrainian', native: 'Українська' },
  { id: 'ru', label: 'Russian', native: 'Русский' },
  { id: 'pl', label: 'Polish', native: 'Polski' },
  { id: 'th', label: 'Thai', native: 'ไทย' },
  { id: 'zh', label: 'Chinese (Simplified)', native: '简体中文' },
  { id: 'es', label: 'Spanish', native: 'Español' },
  { id: 'pt', label: 'Portuguese (Brazil)', native: 'Português (Brasil)' },
  { id: 'de', label: 'German', native: 'Deutsch' },
  { id: 'ja', label: 'Japanese', native: '日本語' },
]

export const DEFAULT_LOCALE: Locale = 'en'

const LOCALE_IDS: Locale[] = LOCALES.map((l) => l.id)

/** Map browser language tags to a supported app locale. */
export function detectBrowserLocale(
  languages: readonly string[] = typeof navigator !== 'undefined'
    ? navigator.languages?.length
      ? [...navigator.languages]
      : navigator.language
        ? [navigator.language]
        : []
    : [],
  fallback: Locale = DEFAULT_LOCALE,
): Locale {
  const supported = new Set<string>(LOCALE_IDS)
  for (const raw of languages) {
    if (!raw) continue
    const tag = raw.trim().toLowerCase().replace(/_/g, '-')
    if (!tag) continue
    if (supported.has(tag)) return tag as Locale
    const base = tag.split('-')[0]
    if (supported.has(base)) return base as Locale
  }
  return fallback
}

export type Dict = Record<string, string>

function interpolate(template: string, vars?: Record<string, string | number>) {
  if (!vars) return template
  return template.replace(/\{(\w+)\}/g, (_, k: string) =>
    vars[k] !== undefined ? String(vars[k]) : `{${k}}`,
  )
}

export function translate(
  dict: Dict,
  key: string,
  vars?: Record<string, string | number>,
) {
  return interpolate(dict[key] ?? key, vars)
}
