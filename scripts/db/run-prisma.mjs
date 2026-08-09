/**
 * Run Prisma CLI with DATABASE_URL from .env then .env.local (local wins).
 * Usage: node scripts/db/run-prisma.mjs migrate dev --name init
 */
import { spawnSync } from 'node:child_process'
import { readFileSync, existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..')

function loadEnvFile(file) {
  const p = path.join(ROOT, file)
  if (!existsSync(p)) return
  for (const line of readFileSync(p, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i)
    if (!m) continue
    const value = m[2].replace(/^["']|["']$/g, '').trim()
    if (value) process.env[m[1]] = value
  }
}

loadEnvFile('.env')
loadEnvFile('.env.local')

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL missing — set it in .env.local')
  process.exit(1)
}

const args = process.argv.slice(2)
if (!args.length) {
  console.error('Usage: node scripts/db/run-prisma.mjs <prisma-args…>')
  process.exit(1)
}

const result = spawnSync('npx', ['prisma', ...args], {
  cwd: ROOT,
  stdio: 'inherit',
  env: process.env,
  shell: true,
})

process.exit(result.status ?? 1)
