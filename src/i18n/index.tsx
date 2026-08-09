import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  type ReactNode,
} from 'react'
import { de, en, es, ja, pl, pt, ru, th, uk, zh } from './dictionaries'
import {
  DEFAULT_LOCALE,
  LOCALES,
  detectBrowserLocale,
  translate,
  type Dict,
  type Locale,
} from './types'

const DICTS: Record<Locale, Dict> = { en, uk, ru, pl, th, zh, es, pt, de, ja }

type I18nValue = {
  locale: Locale
  setLocale: (locale: Locale) => void
  t: (key: string, vars?: Record<string, string | number>) => string
  locales: typeof LOCALES
}

const I18nContext = createContext<I18nValue | null>(null)

export function I18nProvider({
  locale,
  onLocaleChange,
  children,
}: {
  locale: Locale
  onLocaleChange: (locale: Locale) => void
  children: ReactNode
}) {
  const dict = DICTS[locale] ?? DICTS[DEFAULT_LOCALE]
  const t = useCallback(
    (key: string, vars?: Record<string, string | number>) => {
      const template = dict[key] ?? DICTS.en[key] ?? DICTS.ru[key] ?? key
      return translate({ [key]: template }, key, vars)
    },
    [dict],
  )
  const value = useMemo(
    () => ({
      locale,
      setLocale: onLocaleChange,
      t,
      locales: LOCALES,
    }),
    [locale, onLocaleChange, t],
  )
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n() {
  const ctx = useContext(I18nContext)
  if (!ctx) throw new Error('useI18n outside I18nProvider')
  return ctx
}

export { LOCALES, DEFAULT_LOCALE, detectBrowserLocale, type Locale }
