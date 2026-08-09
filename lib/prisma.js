import { PrismaClient } from '@prisma/client'

/** @type {PrismaClient | undefined} */
const globalForPrisma = globalThis

export const prisma =
  globalForPrisma.__vibeflowsPrisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  })

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.__vibeflowsPrisma = prisma
}

export function rowToGenre(row) {
  return {
    id: row.id,
    name: row.name,
    x: row.x,
    y: row.y,
    color: row.color,
    previewUrl: row.previewUrl,
    trackId: row.trackId,
    exampleArtist: row.exampleArtist,
    exampleTrack: row.exampleTrack,
    engemap: row.engemap,
    playlistUrl: row.playlistUrl,
    artists: row.artists ?? [],
    ...(row.artistsPinned ? { artistsPinned: true } : {}),
    ...(row.coverUrl ? { coverUrl: row.coverUrl } : {}),
  }
}
