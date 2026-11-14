import { pad2, toISODate, addDaysISO, fromISO, diffDays } from './date'

function localISO (ts) { return toISODate(new Date(ts)) }

/** 番茄热力图：最近 weeks 周（周一收尾于今天所在周），每格当日专注分钟数 → 档位 0-4 */
export function pomodoroHeatmap (logs = [], weeks = 12, today = todayStr()) {
  const byDay = new Map()
  for (const l of logs) {
    const d = localDate(l.startedAt)
    byDay.set(d, (byDay.get(d) || 0) + (l.minutes || 0))
  }
  // 今天所在周的周一为网格末列起点：从今天往回推 weeks*7-1 天
  const todayIdx = (fromISO(today).getDay() + 6) % 7
  const end = addDaysISO(today, 6 - todayIdx) // 本周周日
  const days = []
  for (let i = weeks * 7 - 1; i >= 0; i--) {
    const iso = addDaysISO(end, -i)
    const minutes = byDay.get(iso) || 0
    days.push({ iso, minutes, level: minutes === 0 ? 0 : minutes < 30 ? 1 : minutes < 60 ? 2 : minutes < 120 ? 3 : 4 })
  }
  return days
}

/** 每日完成任务数（最近 n 天，含今天） */
export function completionTrend (tasks = [], n = 14, today = todayStr()) {
  const out = []
  for (let i = n - 1; i >= 0; i--) {
    const iso = addDaysISO(today, -i)
    const count = tasks.filter(t => t.completed && !t.deletedAt && t.completedAt && localDate(t.completedAt) === iso).length
    out.push({ iso, count })
  }
  return out
}

/** 进行中任务按清单分布（含清单名与颜色） */
export function listDistribution (tasks = [], lists = []) {
  const active = tasks.filter(t => !t.completed && !t.deletedAt)
  return lists
    .filter(l => !l.deletedAt)
    .map(l => ({
      id: l.id, name: l.name, color: l.color,
      count: active.filter(t => t.listId === l.id).length
    }))
    .filter(x => x.count > 0)
    .sort((a, b) => b.count - a.count)
}

/** 区间 KPI：完成任务数、番茄次数、专注分钟（与上一等长区间环比） */
export function periodKpis (tasks = [], logs = [], today = todayStr(), days = 30) {
  const start = addDaysISO(today, -(days - 1))
  const prevStart = addDaysISO(start, -days)
  const inRange = (iso) => iso >= start && iso <= today
  const doneIn = (from) => tasks.filter(t => t.completed && !t.deletedAt && t.completedAt &&
    localDate(t.completedAt) >= from && localDate(t.completedAt) <= today).length
  const pomoIn = (from) => logs.filter(l => localDate(l.startedAt) >= from && localDate(l.startedAt) <= today)
  const curTasks = doneIn(start)
  const prevTasks = doneIn(prevStart)
  const curLogs = pomoIn(start)
  const prevLogs = pomoIn(prevStart)
  const curFocus = curLogs.reduce((a, l) => a + (l.minutes || 0), 0)
  const prevFocus = prevLogs.reduce((a, l) => a + (l.minutes || 0), 0)
  return {
    doneTasks: curTasks,
    doneDelta: curTasks - prevTasks,
    pomodoros: curLogs.length,
    pomodoroDelta: curLogs.length - prevLogs.length,
    focusMinutes: curFocus,
    focusDelta: curFocus - prevFocus,
    onTimeRate: onTimeRate(tasks, today, days)
  }
}

/** 准时完成率：有到期日+完成时间的任务中，completedAt 当天 <= dueDate 的比例（近 days 天完成的部分） */
export function onTimeRate (tasks = [], today = todayStr(), days = 30) {
  const start = addDaysISO(today, -(days - 1))
  const done = tasks.filter(t => t.completed && !t.deletedAt && t.completedAt && t.dueDate &&
    localDate(t.completedAt) >= start && localDate(t.completedAt) <= today)
  if (!done.length) return null
  const onTime = done.filter(t => localDate(t.completedAt) <= t.dueDate).length
  return Math.round(onTime / done.length * 100)
}

function localDate (ts) { return localISO(ts) }
function todayStr () { return toISODate(new Date()) }
export { diffDays }
