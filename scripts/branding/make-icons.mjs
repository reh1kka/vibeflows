import { writeFileSync } from 'node:fs'
import { deflateSync } from 'node:zlib'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const publicDir = path.join(__dirname, '../..', 'public')

function crc32(buf) {
  let c = ~0
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i]
    for (let k = 0; k < 8; k++) c = c & 1 ? (0xedb88320 ^ (c >>> 1)) : c >>> 1
  }
  return ~c >>> 0
}

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const typeBuf = Buffer.from(type)
  const crcBuf = Buffer.alloc(4)
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])))
  return Buffer.concat([len, typeBuf, data, crcBuf])
}

function png(size, rgb) {
  const [r, g, b] = rgb
  const row = Buffer.alloc(1 + size * 4)
  const rows = []
  for (let y = 0; y < size; y++) {
    const line = Buffer.alloc(1 + size * 4)
    line[0] = 0
    for (let x = 0; x < size; x++) {
      const cx = x - size / 2
      const cy = y - size / 2
      const inCircle = cx * cx + cy * cy <= (size * 0.34) ** 2
      const i = 1 + x * 4
      if (inCircle) {
        line[i] = r
        line[i + 1] = g
        line[i + 2] = b
        line[i + 3] = 255
      } else {
        line[i] = 18
        line[i + 1] = 18
        line[i + 2] = 18
        line[i + 3] = 255
      }
    }
    rows.push(line)
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8
  ihdr[9] = 6
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(Buffer.concat(rows))),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

const green = [29, 185, 84]
writeFileSync(path.join(publicDir, 'pwa-192.png'), png(192, green))
writeFileSync(path.join(publicDir, 'pwa-512.png'), png(512, green))
writeFileSync(path.join(publicDir, 'apple-touch-icon.png'), png(180, green))
console.log('icons written')
