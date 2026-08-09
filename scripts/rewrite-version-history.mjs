/**
 * Rebuild main as 3 version eras × 5 patch releases (force-push).
 * Run from repo root: node scripts/rewrite-version-history.mjs
 */
import { execSync } from 'node:child_process'
import { readFileSync, writeFileSync, existsSync } from 'node:fs'

const versions = [
  // 1.0 Foundation
  ['1.0.0', 'v1.0.0 — Initial release: swipe Every Noise genres.'],
  ['1.0.1', 'v1.0.1 — Spotify login and taste-weighted deck.'],
  ['1.0.2', 'v1.0.2 — Taste onboarding (genres → artists).'],
  ['1.0.3', 'v1.0.3 — VibeFlows branding and canonical multi-domain host.'],
  ['1.0.4', 'v1.0.4 — PWA shell, install guide, analytics.'],
  // 1.1 Reliability
  ['1.1.0', 'v1.1.0 — iPhone safe-area and preview audio hard-stop.'],
  ['1.1.1', 'v1.1.1 — Cache bust, VF favicons, bundled logo.'],
  ['1.1.2', 'v1.1.2 — Wikipedia genre-description pipeline.'],
  ['1.1.3', 'v1.1.3 — Multi-source blurbs (wiki / seed / Last.fm).'],
  ['1.1.4', 'v1.1.4 — Spotify OAuth redirect on canonical host.'],
  // 1.2 Neon product
  ['1.2.0', 'v1.2.0 — Neon UI and OmniSearch.'],
  ['1.2.1', 'v1.2.1 — Sentry SDK and optional Prisma catalog API.'],
  ['1.2.2', 'v1.2.2 — Desktop layout polish.'],
  ['1.2.3', 'v1.2.3 — Alias SW redirect and forced client cache refresh.'],
  ['1.2.4', 'v1.2.4 — Creator attribution and public repo hygiene.'],
]

function run(cmd, opts = {}) {
  execSync(cmd, { stdio: 'inherit', ...opts })
}

function setVersion(v) {
  const pkg = JSON.parse(readFileSync('package.json', 'utf8'))
  pkg.version = v
  writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n')
}

// Ensure changelog present
if (!existsSync('CHANGELOG.md')) {
  console.error('CHANGELOG.md missing')
  process.exit(1)
}

// Start orphan history from current working tree
run('git checkout --orphan version-history')
run('git reset')
run('git add -A')
// Keep local-only paths out if present
try {
  run('git reset HEAD -- branding content/genre-descriptions.json scripts/branding/_old-logo-check.bin', {
    stdio: 'pipe',
  })
} catch {
  /* ignore */
}

// First commit with full tree at 1.0.0
setVersion(versions[0][0])
run('git add -A')
run(`git commit -m "${versions[0][1]}"`)
try {
  run(`git tag -f v${versions[0][0]}`)
} catch {
  /* ignore */
}

// Subsequent: version bump only
for (let i = 1; i < versions.length; i++) {
  const [v, msg] = versions[i]
  setVersion(v)
  run('git add package.json CHANGELOG.md')
  run(`git commit -m "${msg}"`)
  try {
    run(`git tag -f v${v}`)
  } catch {
    /* ignore */
  }
}

run('git branch -M main')
console.log('Rewrote history. Review with: git log --oneline')
console.log('Then: git push --force origin main --tags')
