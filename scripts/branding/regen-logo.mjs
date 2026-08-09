import sharp from 'sharp'
import fs from 'fs'

const src = 'C:/Users/Ilyaz/OneDrive/Desktop/05-vf-outline.png'
const meta = await sharp(src).metadata()
console.log('src meta', meta.width, meta.height, meta.hasAlpha)

async function fitTransparent(size, out, { pad = 0.12, bg = null } = {}) {
  const inner = Math.round(size * (1 - pad * 2))
  const resized = await sharp(src)
    .ensureAlpha()
    .resize(inner, inner, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer()
  const base = bg
    ? { r: bg[0], g: bg[1], b: bg[2], alpha: 1 }
    : { r: 0, g: 0, b: 0, alpha: 0 }
  await sharp({
    create: { width: size, height: size, channels: 4, background: base },
  })
    .composite([{ input: resized, gravity: 'centre' }])
    .png()
    .toFile(out)
  console.log('wrote', out)
}

await fitTransparent(512, 'public/logo.png', { pad: 0.08 })
await fitTransparent(32, 'public/favicon.png', { pad: 0.1 })
await fitTransparent(48, 'public/favicon-48.png', { pad: 0.1 })
await fitTransparent(64, 'public/favicon-64.png', { pad: 0.1 })
await fitTransparent(180, 'public/apple-touch-icon.png', {
  pad: 0.14,
  bg: [18, 18, 18],
})
await fitTransparent(192, 'public/pwa-192.png', { pad: 0.14, bg: [18, 18, 18] })
await fitTransparent(512, 'public/pwa-512.png', { pad: 0.14, bg: [18, 18, 18] })

fs.writeFileSync(
  'public/favicon.svg',
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <image href="/favicon-64.png" width="64" height="64"/>
</svg>
`,
)
console.log('done')
