import { prisma } from '../../lib/prisma.js'

/**
 * GET /api/catalog/overrides — same shape as public/genre-overrides.json
 */
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS')
  res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=600')
  if (req.method === 'OPTIONS') {
    res.status(204).end()
    return
  }
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'method not allowed' })
    return
  }

  try {
    const meta = await prisma.catalogMeta.findUnique({
      where: { key: 'overrides' },
    })
    const payload =
      meta?.payload && typeof meta.payload === 'object' ? meta.payload : {}
    res.status(200).json(payload)
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'error'
    res.status(500).json({ error: msg })
  }
}
