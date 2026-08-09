/**
 * Production deploy + keep ALL public domains on the new deployment.
 * Do not remove domains — only re-point aliases.
 *
 * Optional: VERCEL_SCOPE / VERCEL_TEAM_SLUG if your CLI needs an explicit team.
 */
import { execSync } from 'node:child_process'

const SCOPE =
  process.env.VERCEL_SCOPE?.trim() ||
  process.env.VERCEL_TEAM_SLUG?.trim() ||
  ''

/** All production hostnames — keep aliased; non-primary redirect to PRIMARY */
export const PRIMARY_DOMAIN = 'vibe-flows.vercel.app'

export const PRODUCTION_DOMAINS = [
  PRIMARY_DOMAIN,
  'vibeflowe.vercel.app',
  'vibeflows-app.vercel.app',
  'vibeflowapp.vercel.app',
  'vibeflowsapp.vercel.app',
  'vibeflowsweb.vercel.app',
]

function run(cmd) {
  return execSync(cmd, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  })
}

const scopeFlag = SCOPE ? ` --scope ${SCOPE}` : ''

// Avoid --format json: Vercel sometimes returns HTML challenge pages
const raw = run(`npx vercel --prod --yes${scopeFlag}`)
console.log(raw)

const match = raw.match(
  /https:\/\/(vibe-flows-[a-z0-9-]+\.vercel\.app)/i,
)
const deployment = match?.[1]
if (!deployment) {
  console.error('Could not parse deployment URL from Vercel output')
  process.exit(1)
}

console.log(`Deployed: https://${deployment}`)

for (const domain of PRODUCTION_DOMAINS) {
  console.log(`Alias → ${domain}`)
  try {
    console.log(
      run(
        `npx vercel alias set ${deployment} ${domain}${scopeFlag}`,
      ).trim(),
    )
  } catch (e) {
    console.error(`Alias failed for ${domain}:`, e.message)
  }
}

console.log('All production domains updated:')
for (const d of PRODUCTION_DOMAINS) console.log(`  https://${d}`)
