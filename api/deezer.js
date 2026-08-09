/**
 * Proxy Deezer API for production (browser CORS + no Vite /deezer rewrite).
 * Usage: /api/deezer?p=/search/artist?q=foo%26limit=5
 */

const RATE_LIMIT = 60
const RATE_WINDOW_MS = 60_000
/** @type {Map<string, number[]>} */
const hitsByIp = new Map()

function clientIp(req) {
  const xf = req.headers?.['x-forwarded-for']
  if (typeof xf === 'string' && xf.length) return xf.split(',')[0].trim()
  if (Array.isArray(xf) && xf[0]) return String(xf[0]).split(',')[0].trim()
  return req.socket?.remoteAddress || req.headers?.['x-real-ip'] || 'unknown'
}

function rateLimited(ip) {
  const now = Date.now()
  const cutoff = now - RATE_WINDOW_MS
  let hits = hitsByIp.get(ip) || []
  hits = hits.filter((t) => t > cutoff)
  if (hits.length >= RATE_LIMIT) {
    hitsByIp.set(ip, hits)
    return true
  }
  hits.push(now)
  hitsByIp.set(ip, hits)
  return false
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS')
  if (req.method === 'OPTIONS') {
    res.status(204).end()
    return
  }
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'method not allowed' })
    return
  }

  if (rateLimited(clientIp(req))) {
    res.status(429).json({ error: 'rate limit exceeded' })
    return
  }

  const raw = typeof req.query?.p === 'string' ? req.query.p : ''
  if (!raw.startsWith('/')) {
    res.status(400).json({ error: 'missing p' })
    return
  }

  try {
    const upstream = await fetch(`https://api.deezer.com${raw}`, {
      headers: { Accept: 'application/json' },
    })
    const text = await upstream.text()
    res
      .status(upstream.status)
      .setHeader('Content-Type', 'application/json; charset=utf-8')
      .send(text)
  } catch (e) {
    res.status(502).json({ error: String(e?.message || e) })
  }
}
