import { prisma } from '../../lib/prisma.js'

/**
 * GET /api/catalog/descriptions — same shape as public/genre-descriptions.json
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
      prisma.genre.findMany({
        select: { id: true, description: true },
        where: { description: { not: null } },
      }),
      prisma.catalogMeta.findUnique({ where: { key: 'descriptions' } }),
    ])
    /** @type {Record<string, unknown>} */
    const descriptions = {}
    for (const row of rows) {
      if (row.description) descriptions[row.id] = row.description
    }
    const payload =
      meta?.payload && typeof meta.payload === 'object' ? meta.payload : {}
    res.status(200).json({
      updatedAt: meta?.catalogUpdatedAt ?? new Date().toISOString(),
      count: meta?.count ?? Object.keys(descriptions).length,
      langEntries: payload.langEntries ?? null,
      realEntries: payload.realEntries ?? null,
      descriptions,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'error'
    res.status(500).json({ error: msg })
  }
}
