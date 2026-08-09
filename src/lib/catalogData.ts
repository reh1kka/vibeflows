/** Local first, then CDN if Vercel challenge/blocks large JSON */

const GH_CDN = 'https://cdn.jsdelivr.net/gh/reh1kka/vibeflows@main/public'

/** When true, prefer Neon-backed /api/catalog/* (still falls back to JSON). */
export function useDbCatalog(): boolean {
  const v = import.meta.env.VITE_USE_DB_CATALOG
  return v === '1' || v === 'true'
}

const API_BY_STATIC: Record<string, string> = {
  '/genres.json': '/api/catalog/genres',
  '/similarity.json': '/api/catalog/similarity',
  '/genre-descriptions.json': '/api/catalog/descriptions',
  '/genre-overrides.json': '/api/catalog/overrides',
}

export function catalogUrls(path: string, bustCache = false): string[] {
  const local = bustCache ? `${path}?v=${Date.now()}` : path
  const staticUrls = [local, `${GH_CDN}${path}`]
  if (!useDbCatalog()) return staticUrls
  const api = API_BY_STATIC[path]
  if (!api) return staticUrls
  // API first, then static JSON / CDN (graceful fallback)
  return [api, ...staticUrls]
}

export async function loadCatalogJson<T>(
  urls: string[],
  failMessage: string,
): Promise<T> {
  let last: unknown
  for (const url of urls) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const res = await fetch(url, { cache: 'no-cache' })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const type = res.headers.get('content-type') ?? ''
        // Vercel bot challenge returns HTML
        if (type.includes('text/html')) throw new Error('blocked html')
        return (await res.json()) as T
      } catch (e) {
        last = e
        await new Promise((r) => setTimeout(r, 350 * (attempt + 1)))
      }
    }
  }
  console.warn('catalog load failed', urls, last)
  throw new Error(failMessage)
}
