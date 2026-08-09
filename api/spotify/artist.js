/**
 * Artist bundle for production. Mirrors the Vite dev plugin route so the app
 * behaves the same locally and on Vercel.
 *
 * Credentials stay on the server: only SPOTIFY_CLIENT_ID/SECRET are read here,
 * never a VITE_* variable that would be inlined into the browser bundle.
 */
import { resolveArtistPayload } from '../../vite/plugins/spotifyArtist.mjs'

const cache = { t: null }

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'method not allowed' })
    return
  }

  const id = typeof req.query?.id === 'string' ? req.query.id : ''
  if (!id) {
    res.status(400).json({ error: 'id required' })
    return
  }

  const auth = req.headers.authorization
  const bearer = auth?.startsWith('Bearer ') ? auth.slice(7) : null

  try {
    const payload = await resolveArtistPayload(id, process.env, cache, bearer)
    // Personal tokens must not land in the shared CDN cache
    res.setHeader(
      'Cache-Control',
      bearer ? 'private, no-store' : 's-maxage=86400, stale-while-revalidate=604800',
    )
    res.status(200).json(payload)
  } catch (e) {
    res.status(502).json({ error: String(e?.message || e) })
  }
}
