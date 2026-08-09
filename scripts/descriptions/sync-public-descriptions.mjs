/**
 * Copy staged wiki blurbs into the file the app actually loads.
 * Usage: node scripts/descriptions/sync-public-descriptions.mjs
 */
import { copyFile, access } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..')
const src = path.join(root, 'content', 'genre-descriptions.json')
const dest = path.join(root, 'public', 'genre-descriptions.json')

try {
  await access(src)
} catch {
  console.error('Missing', src, '— run npm run wiki:collect first')
  process.exit(1)
}

await copyFile(src, dest)
console.log('Synced', path.relative(root, src), '→', path.relative(root, dest))
