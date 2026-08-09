import type { Plugin } from 'vite'
import { readFileSync, existsSync } from 'node:fs'
import path from 'node:path'
import { resolveArtistPayload } from './spotifyArtist.mjs'

type Token = { access: string; expires: number }

function loadEnv(root: string) {
  const env: Record<string, string> = { ...process.env } as Record<
    string,
    string
  >
  // .env first (lowest priority), .env.local last — and never let a blank
  // placeholder overwrite a real value
  for (const file of ['.env', '.env.local']) {
    const p = path.join(root, file)
    if (!existsSync(p)) continue
    for (const line of readFileSync(p, 'utf8').split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i)
      if (!m) continue
      const value = m[2].replace(/^["']|["']$/g, '').trim()
      if (!value) continue
      env[m[1]] = value
    }
  }
  return env
}

export function spotifyApiPlugin(): Plugin {
  const cache = { t: null as Token | null }
  let root = process.cwd()

  async function handle(
    req: import('http').IncomingMessage,
    res: import('http').ServerResponse,
    next: () => void,
  ) {
    if (!req.url?.startsWith('/api/spotify/')) return next()
    const env = loadEnv(root)
    try {
      const url = new URL(req.url, 'http://localhost')

      const headerAuth = req.headers.authorization
      const bearer = headerAuth?.startsWith('Bearer ')
        ? headerAuth.slice(7)
        : null

      if (url.pathname === '/api/spotify/artist') {
        const id = url.searchParams.get('id')
        if (!id) {
          res.statusCode = 400
          res.end(JSON.stringify({ error: 'id required' }))
          return
        }

        const payload = await resolveArtistPayload(id, env, cache, bearer)
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify(payload))
        return
      }

      res.statusCode = 404
      res.end(JSON.stringify({ error: 'not found' }))
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'error'
      res.statusCode = 500
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify({ error: msg }))
    }
  }

  return {
    name: 'vibeflows-spotify-api',
    configResolved(config) {
      root = config.root
    },
    configureServer(server) {
      server.middlewares.use(handle)
    },
    configurePreviewServer(server) {
      server.middlewares.use(handle)
    },
  }
}
