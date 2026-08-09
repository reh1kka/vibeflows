import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import {
  HISTORY_LIMIT,
  loadGenreHistory,
  loadPrefs,
  pushGenreHistory,
  savePrefs,
} from './storage'
import { catalogUrls, useDbCatalog } from './catalogData'
import { formatListeners } from './formatCount'

const mem = new Map<string, string>()

beforeEach(() => {
  mem.clear()
  globalThis.localStorage = {
    getItem: (k: string) => (mem.has(k) ? mem.get(k)! : null),
    setItem: (k: string, v: string) => {
      mem.set(k, v)
    },
    removeItem: (k: string) => {
      mem.delete(k)
    },
    clear: () => mem.clear(),
    key: () => null,
    length: 0,
  }
})

afterEach(() => {
  mem.clear()
})

describe('HISTORY_LIMIT', () => {
  it('is 8', () => {
    expect(HISTORY_LIMIT).toBe(8)
  })

  it('caps history at 8 and survives reload from storage', () => {
    for (let i = 0; i < 12; i++) {
      pushGenreHistory(`g${i}`, i % 2 === 0 ? 'like' : 'skip')
    }
    const hist = loadGenreHistory()
    expect(hist).toHaveLength(8)
    expect(hist[0].id).toBe('g11')
    const again = loadGenreHistory()
    expect(again).toEqual(hist)
  })
})

describe('prefs localStorage', () => {
  it('persists liked genres across reload', () => {
    savePrefs({ liked: ['pop', 'rap'], disliked: ['jazz'] })
    expect(loadPrefs().liked).toEqual(['pop', 'rap'])
    expect(loadPrefs().disliked).toEqual(['jazz'])
  })
})

describe('catalogUrls / useDbCatalog', () => {
  it('defaults to JSON paths when flag off', () => {
    expect(useDbCatalog()).toBe(false)
    const urls = catalogUrls('/genres.json')
    expect(urls[0]).toMatch(/\/genres\.json/)
    expect(urls.some((u) => u.includes('/api/catalog/'))).toBe(false)
  })
})

describe('formatListeners', () => {
  const t = (key: string, vars?: Record<string, string | number>) =>
    key === 'listenersM'
      ? `${vars?.n}M`
      : key === 'listenersK'
        ? `${vars?.n}K`
        : String(vars?.n ?? '')

  it('formats listener counts without crashing', () => {
    expect(formatListeners(0, t)).toBe('0')
    expect(formatListeners(1500, t)).toBe('2K')
    expect(formatListeners(2_500_000, t)).toBe('2.5M')
  })
})
