type Translate = (key: string, vars?: Record<string, string | number>) => string

/** Compact follower/listener count: 1.2M, 340K, 512. */
export function formatListeners(n: number, t: Translate): string {
  if (n >= 1_000_000) return t('listenersM', { n: (n / 1_000_000).toFixed(1) })
  if (n >= 1_000) return t('listenersK', { n: Math.round(n / 1_000) })
  return String(n)
}
