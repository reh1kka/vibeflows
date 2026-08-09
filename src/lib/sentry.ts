import * as Sentry from '@sentry/react'

const dsn = (import.meta.env.VITE_SENTRY_DSN as string | undefined)?.trim()

/** True when a DSN is configured (events may be sent). */
export function isSentryEnabled(): boolean {
  return Boolean(dsn)
}

/**
 * Minimal browser Sentry setup. No-op without VITE_SENTRY_DSN.
 * Avoids PII/noise; low tracing sample for SPA.
 */
export function initSentry(): void {
  if (!dsn) return

  Sentry.init({
    dsn,
    environment:
      (import.meta.env.VITE_SENTRY_ENV as string | undefined)?.trim() ||
      (import.meta.env.DEV ? 'development' : 'production'),
    sendDefaultPii: false,
    // Keep noise low — errors first; light performance sampling
    tracesSampleRate: import.meta.env.DEV ? 0 : 0.05,
    integrations: [Sentry.browserTracingIntegration()],
    ignoreErrors: [
      'ResizeObserver loop',
      'Non-Error promise rejection captured',
      /^AbortError/,
      /Loading chunk [\d]+ failed/,
      /Failed to fetch dynamically imported module/,
    ],
    denyUrls: [
      /extensions\//i,
      /^chrome:\/\//i,
      /^chrome-extension:\/\//i,
      /^moz-extension:\/\//i,
    ],
    beforeSend(event) {
      if (event.user) {
        delete event.user.email
        delete event.user.ip_address
        delete event.user.username
      }
      // Strip Spotify tokens / query secrets from URLs if present
      if (event.request?.url) {
        try {
          const u = new URL(event.request.url)
          for (const key of [
            'access_token',
            'refresh_token',
            'code',
            'state',
            'token',
          ]) {
            if (u.searchParams.has(key)) u.searchParams.set(key, '[filtered]')
          }
          event.request.url = u.toString()
        } catch {
          /* ignore */
        }
      }
      return event
    },
  })
}

/** Dev/test helper: throw a controlled error for Sentry verification. */
export function triggerSentryTestError(): void {
  if (!dsn) {
    console.warn('[sentry] VITE_SENTRY_DSN not set — test error not sent')
    return
  }
  Sentry.captureException(
    new Error('VibeFlows Sentry test error (safe to resolve)'),
  )
}
