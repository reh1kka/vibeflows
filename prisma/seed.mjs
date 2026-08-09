/**
 * Seed Neon from public/*.json (recreates catalog tables; safe for catalog only).
 * Usage: npm run db:seed
 */
import { readFileSync, existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { PrismaClient } from '@prisma/client'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')
const PUBLIC = path.join(ROOT, 'public')

function loadEnvLocal() {
  for (const file of ['.env', '.env.local']) {
    const p = path.join(ROOT, file)
    if (!existsSync(p)) continue
    for (const line of readFileSync(p, 'utf8').split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i)
      if (!m) continue
      const value = m[2].replace(/^["']|["']$/g, '').trim()
      if (value) process.env[m[1]] = value
    }
  }
}
loadEnvLocal()

const prisma = new PrismaClient()

function readJson(name) {
  return JSON.parse(readFileSync(path.join(PUBLIC, name), 'utf8'))
}

async function createManyBatches(label, rows, batchSize, insert) {
  console.log(`Seeding ${rows.length} ${label}…`)
  for (let i = 0; i < rows.length; i += batchSize) {
    const slice = rows.slice(i, i + batchSize)
    await insert(slice)
    if (i === 0 || (i / batchSize) % 5 === 0 || i + batchSize >= rows.length) {
      console.log(`  …${Math.min(i + batchSize, rows.length)}/${rows.length}`)
    }
  }
}

async function seedGenres() {
  const genresPayload = readJson('genres.json')
  const sim = readJson('similarity.json')
  let descriptions = { descriptions: {} }
  try {
    descriptions = readJson('genre-descriptions.json')
  } catch {
    /* optional */
  }
  const relatedMap = sim.related ?? {}
  const descMap = descriptions.descriptions ?? {}
  const genres = genresPayload.genres ?? []

  const rows = genres.map((g) => ({
    id: g.id,
    name: g.name,
    x: g.x ?? 0,
    y: g.y ?? 0,
    color: g.color ?? '#888888',
    previewUrl: g.previewUrl ?? null,
    trackId: g.trackId ?? '',
    exampleArtist: g.exampleArtist ?? null,
    exampleTrack: g.exampleTrack ?? null,
    engemap: g.engemap ?? '',
    playlistUrl: g.playlistUrl ?? '',
    artists: g.artists ?? [],
    artistsPinned: Boolean(g.artistsPinned),
    coverUrl: g.coverUrl ?? null,
    related: relatedMap[g.id] ?? [],
    description: descMap[g.id] ?? null,
  }))

  // Catalog-only recreate (no schema drop)
  await prisma.genre.deleteMany()
  await createManyBatches('genres', rows, 200, (slice) =>
    prisma.genre.createMany({ data: slice }),
  )

  await prisma.catalogMeta.upsert({
    where: { key: 'genres' },
    create: {
      key: 'genres',
      catalogUpdatedAt: genresPayload.updatedAt ?? null,
      source: genresPayload.source ?? null,
      count: genresPayload.count ?? genres.length,
    },
    update: {
      catalogUpdatedAt: genresPayload.updatedAt ?? null,
      source: genresPayload.source ?? null,
      count: genresPayload.count ?? genres.length,
    },
  })

  await prisma.catalogMeta.upsert({
    where: { key: 'similarity' },
    create: {
      key: 'similarity',
      catalogUpdatedAt: sim.updatedAt ?? null,
      method: sim.method ?? null,
      count: Object.keys(relatedMap).length,
    },
    update: {
      catalogUpdatedAt: sim.updatedAt ?? null,
      method: sim.method ?? null,
      count: Object.keys(relatedMap).length,
    },
  })

  await prisma.catalogMeta.upsert({
    where: { key: 'descriptions' },
    create: {
      key: 'descriptions',
      catalogUpdatedAt: descriptions.updatedAt ?? null,
      count: descriptions.count ?? Object.keys(descMap).length,
      payload: {
        langEntries: descriptions.langEntries ?? null,
        realEntries: descriptions.realEntries ?? null,
      },
    },
    update: {
      catalogUpdatedAt: descriptions.updatedAt ?? null,
      count: descriptions.count ?? Object.keys(descMap).length,
      payload: {
        langEntries: descriptions.langEntries ?? null,
        realEntries: descriptions.realEntries ?? null,
      },
    },
  })
}

async function seedArtistFans() {
  const fans = readJson('artist-fans.json')
  const rows = Object.entries(fans).map(([artistId, n]) => ({
    artistId,
    fans: Number(n) || 0,
  }))
  await prisma.artistFan.deleteMany()
  await createManyBatches('artist fans', rows, 1000, (slice) =>
    prisma.artistFan.createMany({ data: slice, skipDuplicates: true }),
  )
}

async function seedOverrides() {
  let overrides = {}
  try {
    overrides = readJson('genre-overrides.json')
  } catch {
    overrides = {}
  }
  await prisma.catalogMeta.upsert({
    where: { key: 'overrides' },
    create: {
      key: 'overrides',
      payload: overrides,
      count: Object.keys(overrides).length,
    },
    update: {
      payload: overrides,
      count: Object.keys(overrides).length,
    },
  })
}

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL missing — set it in .env.local')
  }
  await seedGenres()
  await seedArtistFans()
  await seedOverrides()
  console.log('Seed complete.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
