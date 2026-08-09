import { prisma, rowToGenre } from '../../lib/prisma.js'

/**
 * GET /api/catalog/genres — same shape as public/genres.json
 */
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS')
  res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=3600')
  if (req.method === 'OPTIONS') {
    res.status(204).end()
    return
  }
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'method not allowed' })
    return
  }

  try {
    const [rows, meta] = await Promise.all([
      prisma.genre.findMany({ orderBy: { id: 'asc' } }),
      prisma.catalogMeta.findUnique({ where: { key: 'genres' } }),
    ])
    if (!rows.length) {
      res.status(503).json({
        error: 'catalog empty — run npm run db:seed',
      })
      return
    }
    const genres = rows.map(rowToGenre)
    res.status(200).json({
      updatedAt: meta?.catalogUpdatedAt ?? new Date().toISOString(),
      source: meta?.source ?? 'neon',
      count: meta?.count ?? genres.length,
      genres,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'error'
    res.status(500).json({ error: msg })
  }
}
