import { pad2, toISODate, fromISO, addDaysISO } from './date'

/**
 * 重复任务规则（任务上的 repeat 字段）：
 * { type: 'daily'|'weekly'|'monthly'|'yearly', interval?: number, weekdays?: number[] }
 * - weekdays: 周日=0…周六=6（仅 weekly 用）
 * - interval: 每 N 天/周（默认 1）
 */

/** 某月天数 */
function daysInMonth (y, m /* 0-11 */) {
  return new Date(y, m + 1, 0).getDate()
}

/** 用钳制构造日期（1月31日 → 2月按 28/29 处理） */
function clampDate (y, m, day) {
  return new Date(y, m, Math.min(day, daysInMonth(y, m)))
}

/**
 * 计算下一次到期日：严格晚于 anchor 的第一个符合规则的日期
 * @param {string} anchorISO 锚点（通常 = 当前到期日；若已逾期完成则为今天，与滴答清单一致）
 * @param {object} rule repeat 规则
 */
export function nextOccurrence (anchorISO, rule) {
  if (!rule || !rule.type) return null
  const interval = Math.max(1, rule.interval || 1)
  const d = fromISO(anchorISO)

  if (rule.type === 'daily') {
    return addDaysISO(anchorISO, interval)
  }

  if (rule.type === 'weekly') {
    const wds = (rule.weekdays && rule.weekdays.length ? rule.weekdays : [d.getDay()]).slice().sort((a, b) => a - b)
    for (let i = 1; i <= 7 * interval + 7; i++) {
      const iso = addDaysISO(anchorISO, i)
      if (wds.includes(fromISO(iso).getDay())) return iso
    }
    return addDaysISO(anchorISO, 7 * interval)
  }

  if (rule.type === 'monthly') {
    for (let i = 0; i < 48; i++) {
      const m = d.getMonth() + interval * (i + 1)
      const y = d.getFullYear() + Math.floor(m / 12)
      const mm = m % 12
      const iso = toISODate(clampDate(y, mm, d.getDate()))
      if (iso > anchorISO) return iso
    }
    return addDaysISO(anchorISO, 30 * interval)
  }

  if (rule.type === 'yearly') {
    for (let i = 1; i <= 8; i++) {
      const y = d.getFullYear() + i
      const iso = toISODate(clampDate(y, d.getMonth(), d.getDate()))
      if (iso > anchorISO) return iso
    }
    return addDaysISO(anchorISO, 365)
  }

  return null
}

/** 完成重复任务时的锚点：未逾期用当前到期日，已逾期用今天（跳过错过的次数，与滴答清单一致） */
export function repeatAnchor (dueDate, today = todayStr()) {
  if (!dueDate) return null
  const t = today
  return dueDate >= t ? dueDate : t
}

function todayStr () {
  const d = new Date()
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

/** 规则的中文摘要（列表/详情显示用） */
export function repeatLabel (rule) {
  if (!rule || !rule.type) return ''
  const interval = rule.interval || 1
  const WEEK = ['日', '一', '二', '三', '四', '五', '六']
  switch (rule.type) {
    case 'daily':
      return interval === 1 ? '每天' : `每 ${interval} 天`
    case 'weekly': {
      const wds = rule.weekdays && rule.weekdays.length
        ? rule.weekdays.slice().sort((a, b) => (a === 0 ? 7 : a) - (b === 0 ? 7 : b)).map(w => '周' + WEEK[w]).join('、')
        : '每周'
      return interval === 1 ? wds : `每 ${interval} 周 · ${wds}`
    }
    case 'monthly':
      return interval === 1 ? '每月' : `每 ${interval} 个月`
    case 'yearly':
      return '每年'
    default:
      return ''
  }
}
