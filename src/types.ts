export type Artist = {
  name: string
  id: string | null
  /** Optional local/custom avatar URL */
  image?: string | null
}

export type Genre = {
  id: string
  name: string
  x: number
  y: number
  color: string
  previewUrl: string | null
  trackId: string
  exampleArtist: string | null
  exampleTrack: string | null
  engemap: string
  playlistUrl: string
  artists: Artist[]
  /** When true, UI must not replace artists via Every Noise enrich */
  artistsPinned?: boolean
  /** Optional custom hero cover for the genre card */
  coverUrl?: string | null
}

export type GenresPayload = {
  updatedAt: string
  source?: string
  count: number
  genres: Genre[]
}

export type Preferences = {
  liked: string[]
  disliked: string[]
  /** Spotify artist ids picked during onboarding (when known) */
  likedArtistIds?: string[]
  /** Artist names from onboarding (fallback matching) */
  likedArtistNames?: string[]
}
