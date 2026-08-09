/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  readonly VITE_SPOTIFY_CLIENT_ID?: string
  readonly VITE_USE_DB_CATALOG?: string
  readonly VITE_SENTRY_DSN?: string
  readonly VITE_SENTRY_ENV?: string
  readonly VITE_APP_VERSION?: string
  readonly VITE_CREATOR_SPOTIFY_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
