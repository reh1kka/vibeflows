/** Canonical production host — other aliases redirect here */
export const PRIMARY_HOST = 'vibe-flows.vercel.app'

export const ALIAS_HOSTS = [
  'vibeflowe.vercel.app',
  'vibeflows-app.vercel.app',
  'vibeflowapp.vercel.app',
  'vibeflowsapp.vercel.app',
  'vibeflowsweb.vercel.app',
] as const

/** If opened on an alias domain, jump to the primary (shared localStorage). */
export function redirectAliasHostToPrimary(): boolean {
  if (typeof window === 'undefined') return false
  const host = window.location.hostname
  if (!(ALIAS_HOSTS as readonly string[]).includes(host)) return false
  const { pathname, search, hash } = window.location
  window.location.replace(
    `https://${PRIMARY_HOST}${pathname}${search}${hash}`,
  )
  return true
}
