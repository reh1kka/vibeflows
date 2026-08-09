import type { Artist, Genre } from '../types'

export type GenreOverride = {
  exampleArtist?: string | null
  artistsPinned?: boolean
  artists?: Artist[]
  coverUrl?: string | null
}

export type OverridesMap = Record<string, GenreOverride>

export function applyGenreOverrides(
  genres: Genre[],
  overrides: OverridesMap,
): Genre[] {
  if (!overrides || !Object.keys(overrides).length) return genres
  return genres.map((g) => {
    const o = overrides[g.id] || overrides[g.name]
    if (!o) return g
    return {
      ...g,
      exampleArtist:
        o.exampleArtist !== undefined ? o.exampleArtist : g.exampleArtist,
      artists: o.artists?.length ? o.artists : g.artists,
      artistsPinned: Boolean(o.artistsPinned || o.artists?.length),
      coverUrl: o.coverUrl !== undefined ? o.coverUrl : g.coverUrl,
    }
  })
}
