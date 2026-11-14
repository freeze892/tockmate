export function pad2 (n) { return String(n).padStart(2, '0') }
export function toISODate (d) { return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}` }
/** 本地时区的日期串（toISOString 是 UTC，跨午夜会算错日子） */
export function localDateStr (ts) { return toISODate(new Date(ts)) }
export function todayISO () { return toISODate(new Date()) }
export function fromISO (iso) { const [y, m, d] = iso.split('-').map(Number); return new Date(y, m - 1, d) }
export function addDaysISO (iso, n) { const d = fromISO(iso); d.setDate(d.getDate() + n); return toISODate(d) }
export function diffDays (isoA, isoB) { return Math.round((fromISO(isoA) - fromISO(isoB)) / 86400000) }

const WEEK = ['日', '一', '二', '三', '四', '五', '六']
export function weekdayCN (iso) { return '周' + WEEK[fromISO(iso).getDay()] }
export function shortDate (iso) { const d = fromISO(iso); return `${d.getMonth() + 1}月${d.getDate()}日` }

export function friendlyDate (iso, today = todayISO()) {
  const diff = diffDays(iso, today)
  if (diff === 0) return '今天'
  if (diff === 1) return '明天'
  if (diff === -1) return '昨天'
  return `${shortDate(iso)} ${weekdayCN(iso)}`
}

/** 下一个周X（今天之后；含今天则顺延到下周同一天） */
export function nextWeekday (baseISO, weekday /* 0=日..6=六 */) {
  const base = fromISO(baseISO)
  let delta = (weekday - base.getDay() + 7) % 7
  if (delta === 0) delta = 7
  return addDaysISO(baseISO, delta)
}

/** 下周一（用于「下周X」） */
export function nextMonday (baseISO) {
  const base = fromISO(baseISO)
  const delta = (8 - base.getDay()) % 7 || 7
  return addDaysISO(baseISO, delta)
}
