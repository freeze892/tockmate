/**
 * 生成 TockMate 核心版图标资产（纯 Node，无依赖）：
 * - build/icon.png      512×512（electron-builder 打包用，NSIS 自动转 ico）
 * - resources/tray.png  32×32 系统托盘
 * 图形：蓝色圆角方块 + 白色对勾。
 * 用法：node scripts/gen-icons.js
 */
const fs = require('fs')
const path = require('path')
const zlib = require('zlib')

function drawIcon (size) {
  const px = new Uint8Array(size * size * 4)
  const r = size * 0.22 // 圆角半径
  const margin = size * 0.06
  const bgR = 71, bgG = 114, bgB = 250

  const insideRounded = (x, y) => {
    const x0 = margin, y0 = margin, x1 = size - margin, y1 = size - margin
    if (x < x0 || x > x1 || y < y0 || y > y1) return false
    const cx = Math.max(x0 + r, Math.min(x, x1 - r))
    const cy = Math.max(y0 + r, Math.min(y, y1 - r))
    const dx = x - cx, dy = y - cy
    return dx * dx + dy * dy <= r * r || (x >= x0 + r && x <= x1 - r) || (y >= y0 + r && y <= y1 - r)
  }

  // 对勾几何：以画布中心为基准的两段线，宽度约 size*0.09
  const stroke = size * 0.085
  const midX = size / 2, midY = size / 2 + size * 0.02
  const p1 = [midX - size * 0.16, midY + size * 0.005]
  const p2 = [midX - size * 0.03, midY + size * 0.13]
  const p3 = [midX + size * 0.18, midY - size * 0.14]

  const distToSeg = (x, y, a, b) => {
    const vx = b[0] - a[0], vy = b[1] - a[1]
    const wx = x - a[0], wy = y - a[1]
    const t = Math.max(0, Math.min(1, (wx * vx + wy * vy) / (vx * vx + vy * vy)))
    return Math.sqrt((x - (a[0] + t * vx)) ** 2 + (y - (a[1] + t * vy)) ** 2)
  }

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4
      if (insideRounded(x, y)) {
        const d = Math.min(distToSeg(x, y, p1, p2), distToSeg(x, y, p2, p3))
        if (d <= stroke / 2) {
          px[i] = 255; px[i + 1] = 255; px[i + 2] = 255; px[i + 3] = 255
        } else {
          px[i] = bgR; px[i + 1] = bgG; px[i + 2] = bgB; px[i + 3] = 255
        }
      } else {
        px[i + 3] = 0
      }
    }
  }
  return px
}

function pngEncode (px, size) {
  const raw = Buffer.alloc((size * 4 + 1) * size)
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0 // filter none
    if (px.copy) px.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4)
    else raw.set(px.subarray(y * size * 4, (y + 1) * size * 4), y * (size * 4 + 1) + 1)
  }
  const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length)
    const body = Buffer.concat([Buffer.from(type), data])
    const crcTable = []
    for (let n = 0; n < 256; n++) {
      let c = n
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1
      crcTable[n] = c >>> 0
    }
    let crc = 0xFFFFFFFF
    for (const b of body) crc = crcTable[(crc ^ b) & 0xFF] ^ (crc >>> 8)
    crc = (crc ^ 0xFFFFFFFF) >>> 0
    const crcBuf = Buffer.alloc(4); crcBuf.writeUInt32BE(crc)
    return Buffer.concat([len, body, crcBuf])
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0))
  ])
}

const root = path.join(__dirname, '..')
fs.mkdirSync(path.join(root, 'build'), { recursive: true })
fs.mkdirSync(path.join(root, 'resources'), { recursive: true })
const writes = [
  ['build/icon.png', drawIcon(512), 512],
  ['resources/tray.png', drawIcon(32), 32]
]
for (const [file, px, size] of writes) {
  fs.writeFileSync(path.join(root, file), pngEncode(px, size))
  console.log('生成', file, size + 'x' + size)
}
