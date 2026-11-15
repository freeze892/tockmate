import { todayISO, addDaysISO, nextWeekday, nextMonday, fromISO, toISODate, pad2, weekdayCN, shortDate } from './date'
import { PRO, applyProSyntax } from '../pro'

const WEEKDAY_MAP = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 日: 0, 天: 0 }

/**
 * 快速添加自然语言解析（滴答清单式）
 * 返回 { title, dueDate: 'YYYY-MM-DD'|null, dueTime: 'HH:mm'|null, parsedLabel, tags?, listName?, repeat? }
 * 支持日期：今天/明天/后天/大后天/昨天/周X/下周X/X月X日(号)/X号
 * 支持时间：HH:mm、HH：mm、X点半、[下午|晚上|上午|中午]X点[半]
 * Pro 扩展（完整版启用）：#标签 / /清单名 / *重复（每天|每周X|每月N日|每N天|每年）
 */
export function parseQuickAdd (raw, today = todayISO()) {
  let text = String(raw || '')

  // Pro 语法扩展（完整版）：必须先于日期解析——*每周一 中的「周一」会被日期规则误吞
  let pro = {}
  if (PRO && /\s[#/*]/.test(' ' + text)) {
    const extracted = applyProSyntax(text)
    if (extracted.text.trim() || !text.trim()) {
      text = extracted.text
      pro = { tags: extracted.tags, listName: extracted.listName, repeat: extracted.repeat }
    }
  }
  let dueDate = null
  let dueTime = null

  const eat = (re, fn) => {
    const m = text.match(re)
    if (!m) return false
    if (fn) fn(m)
    text = text.slice(0, m.index) + text.slice(m.index + m[0].length)
    return true
  }

  // 时间（先吃时间，避免 18:00 被“X点”规则误拆）
  eat(/([01]?\d|2[0-3])\s*[:：]\s*([0-5]\d)/, m => { dueTime = `${pad2(+m[1])}:${m[2]}` })
    || eat(/(上午|早上|中午|下午|晚上)?\s*([01]?\d|2[0-3])点半?/, m => {
      let h = +m[2]
      const half = m[0].endsWith('半')
      const pm = m[1] === '下午' || m[1] === '晚上'
      const am = m[1] === '上午' || m[1] === '早上'
      if (pm && h < 12) h += 12
      if (am && h === 12) h = 0
      dueTime = `${pad2(h)}:${half ? '30' : '00'}`
    })

  // 日期
  eat(/大后天/, () => { dueDate = addDaysISO(today, 3) })
    || eat(/后天/, () => { dueDate = addDaysISO(today, 2) })
    || eat(/明天/, () => { dueDate = addDaysISO(today, 1) })
    || eat(/今天/, () => { dueDate = today })
    || eat(/昨天/, () => { dueDate = addDaysISO(today, -1) })
    || eat(/下周[一二三四五六日天]/, m => {
      // 下周X：从下周一（offset 0）起算
      dueDate = addDaysISO(nextMonday(today), (WEEKDAY_MAP[m[0].slice(2)] + 6) % 7)
    })
    || eat(/周[一二三四五六日天]/, m => { dueDate = nextWeekday(today, WEEKDAY_MAP[m[0][1]]) })
    || eat(/(\d{1,2})月(\d{1,2})[日号]/, m => {
      const d = fromISO(today)
      d.setMonth(+m[1] - 1, +m[2])
      if (d < fromISO(today)) d.setFullYear(d.getFullYear() + 1) // 已过期则顺延一年
      dueDate = toISODate(d)
    })
    || eat(/(\d{1,2})[日号]/, m => {
      const d = fromISO(today)
      d.setDate(+m[1])
      if (d < fromISO(today)) d.setMonth(d.getMonth() + 1) // 本月已过则下月
      dueDate = toISODate(d)
    })

  const title = text.replace(/[\s,，。;；、]+/g, ' ').replace(/^\s+|\s+$/g, '')
  let parsedLabel = null
  if (dueDate) {
    parsedLabel = `${shortDate(dueDate)} ${weekdayCN(dueDate)}${dueTime ? ' ' + dueTime : ''}`
  } else if (dueTime) {
    parsedLabel = dueTime
  }
  return { title, dueDate, dueTime, parsedLabel, ...pro }
}
