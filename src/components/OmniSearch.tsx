import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import type { Genre } from '../types'
import { useI18n } from '../i18n'

type Props = {
  genres: Genre[]
  onSelectGenre: (genreId: string) => void
  onSelectArtist: (artistId: string, artistName: string) => void
}

type ArtistEntry = { id: string; name: string; genreName: string }
type Hit =
  | { kind: 'genre'; id: string; name: string; subtitle: string }
  | { kind: 'artist'; id: string; name: string; subtitle: string }

const PER_GROUP = 6

function score(name: string, q: string): number {
  const lower = name.toLowerCase()
  const at = lower.indexOf(q)
  if (at < 0) return -1
  // Prefix beats mid-word, shorter names beat longer ones
  return (at === 0 ? 0 : 1000) + at * 10 + lower.length
}

export function OmniSearch({ genres, onSelectGenre, onSelectArtist }: Props) {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [cursor, setCursor] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  const artistIndex = useMemo(() => {
    const byId = new Map<string, ArtistEntry>()
    for (const g of genres) {
      for (const a of g.artists ?? []) {
        if (!a.id || !a.name || byId.has(a.id)) continue
        byId.set(a.id, { id: a.id, name: a.name, genreName: g.name })
      }
    }
    return [...byId.values()]
  }, [genres])

  const { genreHits, artistHits } = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return { genreHits: [] as Hit[], artistHits: [] as Hit[] }

    const rank = <T,>(items: T[], name: (x: T) => string) =>
      items
        .map((item) => ({ item, s: score(name(item), q) }))
        .filter((x) => x.s >= 0)
        .sort((a, b) => a.s - b.s)
        .slice(0, PER_GROUP)
        .map((x) => x.item)

    return {
      genreHits: rank(genres, (g) => g.name).map<Hit>((g) => ({
        kind: 'genre',
        id: g.id,
        name: g.name,
        subtitle: g.artists?.[0]?.name ?? '',
      })),
      artistHits: rank(artistIndex, (a) => a.name).map<Hit>((a) => ({
        kind: 'artist',
        id: a.id,
        name: a.name,
        subtitle: a.genreName,
      })),
    }
  }, [genres, artistIndex, query])

  const flat = useMemo(
    () => [...genreHits, ...artistHits],
    [genreHits, artistHits],
  )

  useEffect(() => {
    setCursor(0)
  }, [query])

  useEffect(() => {
    if (!open) return
    inputRef.current?.focus()
    function onDocPointer(e: MouseEvent | TouchEvent) {
      const el = panelRef.current
      if (!el || !(e.target instanceof Node) || el.contains(e.target)) return
      close()
    }
    document.addEventListener('mousedown', onDocPointer)
    document.addEventListener('touchstart', onDocPointer)
    return () => {
      document.removeEventListener('mousedown', onDocPointer)
      document.removeEventListener('touchstart', onDocPointer)
    }
  }, [open])

  function close() {
    setOpen(false)
    setQuery('')
    setCursor(0)
  }

  function pick(hit: Hit) {
    if (hit.kind === 'genre') onSelectGenre(hit.id)
    else onSelectArtist(hit.id, hit.name)
    close()
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Escape') {
      e.preventDefault()
      close()
      return
    }
    if (!flat.length) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setCursor((c) => (c + 1) % flat.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setCursor((c) => (c - 1 + flat.length) % flat.length)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      pick(flat[cursor] ?? flat[0])
    }
  }

  function renderGroup(label: string, hits: Hit[], offset: number) {
    if (!hits.length) return null
    return (
      <div className="omni-group">
        <p className="omni-group-label">{label}</p>
        <ul role="group" aria-label={label}>
          {hits.map((hit, i) => (
            <li key={`${hit.kind}-${hit.id}`}>
              <button
                type="button"
                role="option"
                aria-selected={offset + i === cursor}
                className={`omni-item ${offset + i === cursor ? 'is-active' : ''}`}
                onMouseEnter={() => setCursor(offset + i)}
                onClick={() => pick(hit)}
              >
                <span className={`omni-icon omni-icon--${hit.kind}`} aria-hidden />
                <span className="omni-text">
                  <span className="omni-name">{hit.name}</span>
                  {hit.subtitle && (
                    <span className="omni-sub">{hit.subtitle}</span>
                  )}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    )
  }

  return (
    <div className="omni" ref={panelRef}>
      <button
        type="button"
        className="omni-trigger"
        aria-label={open ? t('searchCloseAria') : t('searchOpenAria')}
        aria-expanded={open}
        onClick={() => (open ? close() : setOpen(true))}
      >
        <span className="omni-trigger-icon" aria-hidden />
        <span className="omni-trigger-label">{t('searchChip')}</span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            className="omni-panel"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.16, ease: 'easeOut' }}
          >
            <input
              ref={inputRef}
              type="search"
              className="omni-input"
              placeholder={t('searchPlaceholder')}
              aria-label={t('searchAria')}
              autoComplete="off"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={onKeyDown}
            />
            <div className="omni-results" role="listbox">
              {!query.trim() ? (
                <p className="omni-hint">{t('searchHint')}</p>
              ) : flat.length === 0 ? (
                <p className="omni-hint">{t('searchEmpty')}</p>
              ) : (
                <>
                  {renderGroup(t('searchGenresGroup'), genreHits, 0)}
                  {renderGroup(
                    t('searchArtistsGroup'),
                    artistHits,
                    genreHits.length,
                  )}
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
