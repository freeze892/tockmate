/**
 * 提醒调度器（开源核心）：任务到期提醒 + 习惯打卡提醒
 * 每 30s 扫描；习惯提醒按 reminder 配置（每天定时 / 间隔循环）触发
 * （可选扩展通道由完整版构建注入，见 electron/extension.js）
 */
const SCAN_MS = 30 * 1000
const FIRE_WINDOW_MS = 90 * 1000

/**
 * 习惯提醒判定（纯函数）
 * @param {object|null} reminder null/{mode:'off'} = 关闭；
 *   { mode:'daily', time:'HH:mm' } 每天 time 整点提醒（当天已打卡则跳过）；
 *   { mode:'interval', minutes:N, from:'HH:mm', to:'HH:mm' } 时段内每 N 分钟提醒
 *     （不受打卡影响——喝水类周期提醒，打卡一次不代表今天喝够了）
 * @param {boolean} doneToday 今天是否已打卡
 * @param {Date} now
 * @returns {{ due: false } | { due: true, dedup: string }} dedup 供调度器去重
 */
function habitReminderCheck (reminder, doneToday, now = new Date()) {
  if (!reminder || !reminder.mode || reminder.mode === 'off') return { due: false }
  const cur = now.getHours() * 60 + now.getMinutes()
  const toMin = (s) => {
    if (!/^\d{1,2}:\d{2}$/.test(String(s || ''))) return NaN
    const [h, m] = s.split(':').map(Number)
    return h * 60 + m
  }
  if (reminder.mode === 'daily') {
    const t = toMin(reminder.time)
    if (Number.isNaN(t) || doneToday) return { due: false }
    return cur === t ? { due: true, dedup: 'daily' } : { due: false }
  }
  if (reminder.mode === 'interval') {
    const minutes = Number(reminder.minutes)
    if (!minutes || minutes < 5) return { due: false }
    const from = toMin(reminder.from || '09:00')
    const to = toMin(reminder.to || '22:00')
    if (Number.isNaN(from) || Number.isNaN(to) || cur < from || cur > to) return { due: false }
    const slot = from + Math.floor((cur - from) / minutes) * minutes
    return cur === slot ? { due: true, dedup: 'slot-' + slot } : { due: false }
  }
  return { due: false }
}

class ReminderScheduler {
  /**
   * @param {() => object[]} getTasks
   * @param {(task) => void} fire 任务到期提醒回调
   * @param {() => number} clock
   * @param {() => object[]} [getHabits]
   * @param {(habit) => void} [fireHabit] 习惯提醒回调
   */
  constructor (getTasks, fire, clock = () => Date.now(), getHabits = null, fireHabit = null) {
    this.getTasks = getTasks
    this.fire = fire
    this.clock = clock
    this.getHabits = getHabits
    this.fireHabit = fireHabit
    this.firedKeys = new Set()
    this._timer = null
  }

  start () {
    if (this._timer) return
    this._timer = setInterval(() => this.scan(), SCAN_MS)
  }

  stop () {
    if (this._timer) { clearInterval(this._timer); this._timer = null }
  }

  static triggerAt (t) {
    if (!t.dueDate || !t.dueTime || t.reminderMinutes == null || t.completed || t.deletedAt) return null
    const [h, m] = t.dueTime.split(':').map(Number)
    if (Number.isNaN(h) || Number.isNaN(m)) return null
    const [y, mo, d] = t.dueDate.split('-').map(Number)
    const due = new Date(y, mo - 1, d, h, m, 0, 0).getTime()
    return due - t.reminderMinutes * 60000
  }

  scan (now = this.clock()) {
    const tasks = this.getTasks() || []
    for (const t of tasks) {
      const at = ReminderScheduler.triggerAt(t)
      if (at != null && now >= at && now - at <= FIRE_WINDOW_MS) {
        const key = `remind|${t.id}|${t.dueDate}|${t.dueTime}|${t.reminderMinutes}`
        if (!this.firedKeys.has(key)) {
          this.firedKeys.add(key)
          this.fire(t)
        }
      }
    }
    if (this.getHabits && this.fireHabit) {
      const nd = new Date(now)
      const today = `${nd.getFullYear()}-${String(nd.getMonth() + 1).padStart(2, '0')}-${String(nd.getDate()).padStart(2, '0')}`
      for (const h of this.getHabits() || []) {
        if (h.deletedAt) continue
        const doneToday = new Set(h.records || []).has(today)
        const r = habitReminderCheck(h.reminder, doneToday, nd)
        if (!r.due) continue
        const key = `habit|${h.id}|${today}|${r.dedup}`
        if (!this.firedKeys.has(key)) {
          this.firedKeys.add(key)
          this.fireHabit(h)
        }
      }
    }
    if (this.firedKeys.size > 500) this.firedKeys = new Set([...this.firedKeys].slice(-250))
  }
}

module.exports = { ReminderScheduler, habitReminderCheck, SCAN_MS, FIRE_WINDOW_MS }
