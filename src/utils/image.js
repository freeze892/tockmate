/**
 * 图片压缩：最长边缩到 maxEdge，转 JPEG dataURL
 */
export async function toResizedDataUrl (source, maxEdge = 1600, quality = 0.85) {
  let blob = source
  if (!(source instanceof Blob)) blob = new Blob([source])
  const bitmap = await createImageBitmap(blob)
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height))
  const w = Math.max(1, Math.round(bitmap.width * scale))
  const h = Math.max(1, Math.round(bitmap.height * scale))
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  canvas.getContext('2d').drawImage(bitmap, 0, 0, w, h)
  bitmap.close()
  return canvas.toDataURL('image/jpeg', quality)
}

/** 从粘贴事件中取第一个图片 File/Blob；没有返回 null */
export function imageFromClipboard (e) {
  const items = e.clipboardData?.items
  if (!items) return null
  for (const item of items) {
    if (item.type && item.type.startsWith('image/')) return item.getAsFile()
  }
  return null
}
