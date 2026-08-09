export function hash(s) {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
  return h
}

export function pick(arr, seed) {
  if (!arr?.length) return ''
  return arr[(Number(seed) >>> 0) % arr.length]
}

export function tokens(name) {
  return String(name)
    .toLowerCase()
    .split(/[\s/_-]+/)
    .filter((t) => t.length > 1)
}

export function titleish(name) {
  return String(name)
    .split(/([\s/_-]+)/)
    .map((w) => (/^[a-zа-яё\u0400-\u04FF\u4e00-\u9fff]/i.test(w) ? w[0].toUpperCase() + w.slice(1) : w))
    .join('')
}

export function cap(s) {
  const t = String(s || '').trim()
  if (!t) return ''
  return t[0].toUpperCase() + t.slice(1)
}

export function isProtected(src = '') {
  const s = String(src)
  return (
    s.includes('wikipedia') ||
    s.startsWith('seed/') ||
    s.includes('last.fm') ||
    s.startsWith('llm/')
  )
}

export function hitKey(t, joined, key) {
  if (key === 'hiphop')
    return (
      joined.includes('hip hop') ||
      joined.includes('hip-hop') ||
      (t.includes('hip') && t.includes('hop')) ||
      t.includes('hiphop')
    )
  if (key === 'kpop') return joined.includes('k-pop') || t.includes('kpop') || t.includes('k-pop')
  if (key === 'jpop') return joined.includes('j-pop') || t.includes('jpop')
  if (key === 'lofi') return joined.includes('lo-fi') || joined.includes('lofi') || t.includes('lofi')
  if (key === 'bossa') return joined.includes('bossa') || t.includes('bossa')
  return (
    t.includes(key) ||
    joined.includes(key) ||
    t.some(
      (w) =>
        w === key ||
        w.startsWith(`${key}-`) ||
        w.endsWith(`-${key}`) ||
        (key.length >= 5 && (w.startsWith(key) || w.endsWith(key))),
    )
  )
}

export function familyHits(name, familyKeys) {
  const t = tokens(name)
  const joined = t.join(' ')
  const keys = familyKeys.sort((a, b) => b.length - a.length)
  const hits = []
  for (const key of keys) {
    if (hitKey(t, joined, key)) hits.push(key)
  }
  return { t, joined, hits }
}

export function artists(genre) {
  const names = (genre.artists || [])
    .map((a) => (typeof a === 'string' ? a : a?.name))
    .map((n) => String(n || '').trim())
    .filter((n) => n && n !== 'undefined')
  const ex = String(genre.exampleArtist || '').trim()
  if (ex && ex !== 'undefined') names.unshift(ex)
  return [...new Set(names)].slice(0, 8)
}

export function neighbors(name, related) {
  const ids = related?.[name] || related?.[name.replace(/\s+/g, '-')] || []
  return ids.filter((x) => x && x !== name).slice(0, 10)
}

export function mapAxis(genre) {
  const x = Number(genre?.x) || 0
  const y = Number(genre?.y) || 0
  return {
    dark: y > 7000,
    bright: y < 3500,
    dense: x > 6000,
    sparse: x < 2500,
    x,
    y,
  }
}
