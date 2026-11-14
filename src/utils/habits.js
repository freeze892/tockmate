import { todayISO, addDaysISO } from './date'

/** 连续打卡天数：从今天（未打卡则从昨天）往回数连续记录 */
export function streak (records = [], today = todayISO()) {
  const set = new Set(records)
  let cursor = set.has(today) ? today : addDaysISO(today, -1)
  if (!set.has(cursor)) return 0
  let n = 0
  while (set.has(cursor)) {
    n++
    cursor = addDaysISO(cursor, -1)
  }
  return n
}

/** 最近 7 天（周一~周日或以今天收尾）打卡状态数组 [{iso, done}] */
export function last7Days (records = [], today = todayISO()) {
  const set = new Set(records)
  const out = []
  for (let i = 6; i >= 0; i--) {
    const iso = addDaysISO(today, -i)
    out.push({ iso, done: set.has(iso) })
  }
  return out
}

/** 今日已完成习惯数 */
export function todayDoneCount (habits = [], today = todayISO()) {
  return habits.filter(h => !h.deletedAt && new Set(h.records || []).has(today)).length
}

export function activeHabits (habits = []) {
  return habits.filter(h => !h.deletedAt)
}
