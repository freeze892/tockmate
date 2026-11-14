import { toISODate, fromISO } from './date'

/** 周一=0 … 周日=6 */
export function mondayIndex (d) { return (d.getDay() + 6) % 7 }

/**
 * 月视图矩阵（周一起始）
 * 返回 N 行 × 7 列的 ISO 日期字符串，覆盖整月（含首尾补齐的相邻月日期）。
 */
export function monthMatrix (year, month /* 0-11 */) {
  const first = new Date(year, month, 1)
  const lead = mondayIndex(first)
  const start = new Date(year, month, 1 - lead)
  const dayCount = new Date(year, month + 1, 0).getDate()
  const rows = Math.ceil((lead + dayCount) / 7)
  const weeks = []
  for (let w = 0; w < rows; w++) {
    const week = []
    for (let i = 0; i < 7; i++) {
      const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + w * 7 + i)
      week.push(toISODate(d))
    }
    weeks.push(week)
  }
  return weeks
}

/** 日期所属月视图矩阵中的行列号，找不到返回 null（不应发生） */
export function locateInMatrix (iso, weeks) {
  for (let w = 0; w < weeks.length; w++) {
    const c = weeks[w].indexOf(iso)
    if (c !== -1) return { row: w, col: c }
  }
  return null
}

export function isoMonthDay (iso) { return fromISO(iso).getDate() }
export function sameMonth (iso, year, month) { const d = fromISO(iso); return d.getFullYear() === year && d.getMonth() === month }
