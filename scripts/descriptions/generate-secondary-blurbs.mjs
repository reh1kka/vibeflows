/**
 * Localized catalog blurbs for secondary UI languages.
 * Does not replace Wikipedia or seed texts already stored for a locale.
 *
 * node scripts/generate-secondary-blurbs.mjs
 * node scripts/generate-secondary-blurbs.mjs --force-generated
 */
import { readFile, writeFile, mkdir, rename, unlink, copyFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { isProtected } from '../lib/genre-blurb-shared.mjs'
import { blurbForLang } from '../lib/genre-blurb-engine.mjs'
import { SEED_SECONDARY as SEED_SECONDARY_1 } from '../lib/genre-blurb-i18n-secondary.mjs'
import { SEED_SECONDARY as SEED_SECONDARY_2 } from '../lib/genre-blurb-i18n-extra.mjs'

const SEED_SECONDARY = { ...SEED_SECONDARY_1, ...SEED_SECONDARY_2 }

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '../..')
const GENRES = path.join(ROOT, 'public', 'genres.json')
const SIM = path.join(ROOT, 'public', 'similarity.json')
const OUT = path.join(ROOT, 'public', 'genre-descriptions.json')
const FORCE = process.argv.includes('--force-generated')
const SECONDARY_LANGS = ['uk', 'pl', 'th', 'zh', 'es', 'pt', 'de', 'ja']

async function atomicWrite(file, data) {
  const tmp = `${file}.${process.pid}.${Date.now()}.tmp`
  await writeFile(tmp, data)
  for (let i = 0; i < 6; i++) {
    try {
      await rename(tmp, file)
      return
    } catch (e) {
      if (['EPERM', 'EACCES', 'EBUSY'].includes(e?.code)) {
        await new Promise((r) => setTimeout(r, 120 * (i + 1)))
        continue
      }
      throw e
    }
  }
  try {
    await writeFile(file, data)
  } catch {
    await copyFile(tmp, file)
  }
  try {
    await unlink(tmp)
  } catch {
    /* ignore */
  }
}

function shouldWrite(prev, lang) {
  if (!prev?.text) return true
  const src = String(prev.source || '')
  if (isProtected(src)) return false
  if (FORCE) return src.startsWith('generated/') || src.startsWith('seed/')
  return src.startsWith('generated/') || src.startsWith('seed/')
}

async function main() {
  const payload = JSON.parse(await readFile(GENRES, 'utf8'))
  const sim = existsSync(SIM)
    ? JSON.parse(await readFile(SIM, 'utf8'))
    : { related: {} }
  const related = sim.related || {}

  let disk = { descriptions: {} }
  if (existsSync(OUT)) {
    try {
      disk = JSON.parse(await readFile(OUT, 'utf8'))
    } catch {
      disk = { descriptions: {} }
    }
  }

  const descriptions = { ...(disk.descriptions || {}) }
  const stats = { filled: 0, kept: 0, seeded: 0, byLang: Object.fromEntries(SECONDARY_LANGS.map((l) => [l, 0])) }

  for (const g of payload.genres) {
    const name = g.name
    descriptions[name] = descriptions[name] || { byLang: {} }
    const byLang = { ...(descriptions[name].byLang || {}) }

    for (const lang of SECONDARY_LANGS) {
      const prev = byLang[lang]
      const seedText = SEED_SECONDARY[lang]?.[name]

      if (seedText) {
        byLang[lang] = { text: seedText, source: `seed/${lang}` }
        stats.seeded++
        stats.byLang[lang]++
        continue
      }

      if (!shouldWrite(prev, lang)) {
        stats.kept++
        continue
      }

      const text = blurbForLang(g, related, lang)
      if (!text || text.includes('undefined')) {
        console.warn(`WARN empty/undefined blurb: ${name} [${lang}]`)
        continue
      }
      byLang[lang] = { text, source: `generated/${lang}` }
      stats.filled++
      stats.byLang[lang]++
    }

    descriptions[name].byLang = byLang
  }

  // Orphan keys in descriptions but absent from genres.json
  const genreNames = new Set(payload.genres.map((g) => g.name))
  for (const name of Object.keys(descriptions)) {
    if (genreNames.has(name)) continue
    const byLang = { ...(descriptions[name].byLang || {}) }
    const stub = { name }
    for (const lang of SECONDARY_LANGS) {
      const prev = byLang[lang]
      const seedText = SEED_SECONDARY[lang]?.[name]
      if (seedText) {
        byLang[lang] = { text: seedText, source: `seed/${lang}` }
        continue
      }
      if (!shouldWrite(prev, lang)) continue
      const text = blurbForLang(stub, related, lang)
      if (!text || text.includes('undefined')) continue
      byLang[lang] = { text, source: `generated/${lang}` }
      stats.filled++
    }
    descriptions[name].byLang = byLang
  }

  // Ensure seed entries exist even if genre missing from genres.json
  for (const lang of SECONDARY_LANGS) {
    for (const [name, text] of Object.entries(SEED_SECONDARY[lang] || {})) {
      descriptions[name] = descriptions[name] || { byLang: {} }
      descriptions[name].byLang[lang] = { text, source: `seed/${lang}` }
    }
  }

  const langCounts = { ru: 0, en: 0, uk: 0, pl: 0, th: 0, zh: 0, es: 0, pt: 0, de: 0, ja: 0 }
  let undefinedTexts = 0
  for (const v of Object.values(descriptions)) {
    for (const [lang, b] of Object.entries(v.byLang || {})) {
      if (!b?.text) continue
      if (langCounts[lang] !== undefined) langCounts[lang]++
      if (String(b.text).includes('undefined')) undefinedTexts++
    }
  }

  await mkdir(path.dirname(OUT), { recursive: true })
  await atomicWrite(
    OUT,
    JSON.stringify(
      {
        updatedAt: new Date().toISOString(),
        count: Object.keys(descriptions).length,
        langEntries: Object.values(langCounts).reduce((a, b) => a + b, 0),
        descriptions,
      },
      null,
      0,
    ),
  )

  console.log(
    JSON.stringify(
      {
        count: Object.keys(descriptions).length,
        langCounts,
        filledGenerated: stats.filled,
        seeded: stats.seeded,
        protectedKept: stats.kept,
        undefinedTexts,
        out: OUT,
      },
      null,
      2,
    ),
  )
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
