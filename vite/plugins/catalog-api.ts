/**
 * Local Vite middleware for /api/catalog/* (mirrors Vercel api/catalog handlers).
 */
import type { Plugin } from 'vite'
import { readFileSync, existsSync } from 'node:fs'
import path from 'node:path'

function loadEnv(root: string) {
  const env: Record<string, string> = { ...process.env } as Record<
    string,
    string
  >
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

export function catalogApiPlugin(): Plugin {
  let root = process.cwd()

  async function handle(
    req: import('http').IncomingMessage,
    res: import('http').ServerResponse,
    next: () => void,
  ) {
    if (!req.url?.startsWith('/api/catalog/')) return next()
    const env = loadEnv(root)
    if (!env.DATABASE_URL) {
      res.statusCode = 503
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify({ error: 'DATABASE_URL not configured' }))
      return
    }
    process.env.DATABASE_URL = env.DATABASE_URL

    try {
      const url = new URL(req.url, 'http://localhost')
      const { prisma, rowToGenre } = await import('../../lib/prisma.js')

      if (url.pathname === '/api/catalog/genres') {
        const [rows, meta] = await Promise.all([
          prisma.genre.findMany({ orderBy: { id: 'asc' } }),
          prisma.catalogMeta.findUnique({ where: { key: 'genres' } }),
        ])
        if (!rows.length) {
          res.statusCode = 503
          res.setHeader('Content-Type', 'application/json')
          res.end(
            JSON.stringify({ error: 'catalog empty — run npm run db:seed' }),
          )
          return
        }
        const genres = rows.map(rowToGenre)
        res.setHeader('Content-Type', 'application/json')
        res.end(
          JSON.stringify({
            updatedAt: meta?.catalogUpdatedAt ?? new Date().toISOString(),
            source: meta?.source ?? 'neon',
            count: meta?.count ?? genres.length,
            genres,
          }),
        )
        return
      }

      if (url.pathname === '/api/catalog/similarity') {
        const [rows, meta] = await Promise.all([
          prisma.genre.findMany({
            select: { id: true, related: true },
            orderBy: { id: 'asc' },
          }),
          prisma.catalogMeta.findUnique({ where: { key: 'similarity' } }),
        ])
        const related: Record<string, string[]> = {}
        for (const row of rows) {
          if (row.related?.length) related[row.id] = row.related
        }
        res.setHeader('Content-Type', 'application/json')
        res.end(
          JSON.stringify({
            updatedAt: meta?.catalogUpdatedAt ?? new Date().toISOString(),
            method: meta?.method ?? 'neon',
            related,
          }),
        )
        return
      }

      if (url.pathname === '/api/catalog/descriptions') {
        const [rows, meta] = await Promise.all([
          prisma.genre.findMany({
            select: { id: true, description: true },
            where: { description: { not: null } },
          }),
          prisma.catalogMeta.findUnique({ where: { key: 'descriptions' } }),
        ])
        const descriptions: Record<string, unknown> = {}
        for (const row of rows) {
          if (row.description) descriptions[row.id] = row.description
        }
        const payload =
          meta?.payload && typeof meta.payload === 'object'
            ? (meta.payload as Record<string, unknown>)
            : {}
        res.setHeader('Content-Type', 'application/json')
        res.end(
          JSON.stringify({
            updatedAt: meta?.catalogUpdatedAt ?? new Date().toISOString(),
            count: meta?.count ?? Object.keys(descriptions).length,
            langEntries: payload.langEntries ?? null,
            realEntries: payload.realEntries ?? null,
            descriptions,
          }),
        )
        return
      }

      if (url.pathname === '/api/catalog/overrides') {
        const meta = await prisma.catalogMeta.findUnique({
          where: { key: 'overrides' },
        })
        const payload =
          meta?.payload && typeof meta.payload === 'object' ? meta.payload : {}
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
    name: 'vibeflows-catalog-api',
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
