import { describe, it, expect } from 'vitest'
import { ReminderScheduler, habitReminderCheck } from '../electron/scheduler'

const TODAY = '2026-10-25'

function task (id, { dueDate = TODAY, dueTime = '14:00', reminderMinutes = 30, completed = false } = {}) {
  return { id, title: id, dueDate, dueTime, reminderMinutes, completed, deletedAt: null }
}

describe('ReminderScheduler', () => {
  const at = (date, time) => new Date(`2026-10-25T${time}:00`).getTime()

  it('到达触发时刻（截止前 30 分钟）弹通知且去重', () => {
    const fired = []
    const s = new ReminderScheduler(
      () => [task('a')],
      t => fired.push(t.id),
      () => at(TODAY, '13:30') // 14:00 - 30min
    )
    s.scan()
    expect(fired).toEqual(['a'])
    s.scan()
    s.scan()
    expect(fired.length).toBe(1) // 去重
  })

  it('提前量 0 = 准时；提前 1 天在昨天触发', () => {
    const fired = []
    const s = new ReminderScheduler(
      () => [task('b', { reminderMinutes: 0 }), task('c', { reminderMinutes: 1440 })],
      t => fired.push(t.id),
      () => at(TODAY, '14:00')
    )
    s.scan()
    expect(fired).toEqual(['b'])
  })

  it('未到时间、已过期超 90s、已完成、缺字段 → 不触发', () => {
    const fired = []
    const s = new ReminderScheduler(
      () => [
        task('early', { dueTime: '18:00' }),
        task('ancient', { dueTime: '08:00' }),
        task('done', { completed: true }),
        task('nodate', { dueDate: null })
      ],
      t => fired.push(t.id),
      () => at(TODAY, '14:00')
    )
    s.scan()
    expect(fired).toEqual([])
  })

  it('同一任务改提醒设置后视为新的触发', () => {
    let t = task('d')
    let now = at(TODAY, '13:30')
    const fired = []
    const s = new ReminderScheduler(
      () => [t],
      x => fired.push(x.reminderMinutes),
      () => now
    )
    s.scan()
    t = task('d', { reminderMinutes: 45 }) // 触发时刻变为 13:15
    now = at(TODAY, '13:16') // 时钟推进到新触发窗口内
    s.scan()
    expect(fired).toEqual([30, 45])
  })
})

describe('habitReminderCheck 习惯提醒判定', () => {
  const at = (h, m) => new Date(2026, 9, 25, h, m).getTime()
  const D = (h, m) => new Date(2026, 9, 25, h, m)

  it('daily：整点触发、当天已打卡跳过、差一分钟不触发、配置缺失不触发', () => {
    const r = { mode: 'daily', time: '08:30' }
    expect(habitReminderCheck(r, false, D(8, 30))).toEqual({ due: true, dedup: 'daily' })
    expect(habitReminderCheck(r, true, D(8, 30)).due).toBe(false)
    expect(habitReminderCheck(r, false, D(8, 29)).due).toBe(false)
    expect(habitReminderCheck(r, false, D(8, 31)).due).toBe(false)
    expect(habitReminderCheck(null, false, D(8, 30)).due).toBe(false)
    expect(habitReminderCheck({ mode: 'daily' }, false, D(8, 30)).due).toBe(false)
  })

  it('interval：时段内按周期触发、打卡不影响（喝水类）、窗外不触发', () => {
    const r = { mode: 'interval', minutes: 60, from: '09:00', to: '21:00' }
    expect(habitReminderCheck(r, false, D(9, 0))).toEqual({ due: true, dedup: 'slot-540' })
    expect(habitReminderCheck(r, true, D(10, 0)).due).toBe(true)
    expect(habitReminderCheck(r, false, D(10, 30)).due).toBe(false)
    expect(habitReminderCheck(r, false, D(8, 0)).due).toBe(false)
    expect(habitReminderCheck(r, false, D(21, 30)).due).toBe(false)
  })

  it('interval：最小间隔 5 分钟、非法时间不触发', () => {
    expect(habitReminderCheck({ mode: 'interval', minutes: 1, from: '09:00', to: '21:00' }, false, D(9, 0)).due).toBe(false)
    expect(habitReminderCheck({ mode: 'interval', minutes: 60, from: 'xx', to: '21:00' }, false, D(9, 0)).due).toBe(false)
  })
})

describe('scan 习惯通道', () => {
  const at = (h, m) => new Date(2026, 9, 25, h, m).getTime()
  it('到点习惯触发 fireHabit 且去重', () => {
    const fired = []
    const s = new ReminderScheduler(
      () => [], () => {}, () => at(8, 30),
      () => [{ id: 'h1', name: '喝水', records: [], reminder: { mode: 'daily', time: '08:30' } }],
      h => fired.push(h.id)
    )
    s.scan()
    s.scan()
    s.scan()
    expect(fired).toEqual(['h1'])
  })

  it('当天已打卡：daily 不提醒；已删除习惯不提醒', () => {
    const fired = []
    const s = new ReminderScheduler(
      () => [], () => {}, () => at(8, 30),
      () => [{ id: 'h1', records: ['2026-10-25'], reminder: { mode: 'daily', time: '08:30' } }, { id: 'h2', deletedAt: 1, reminder: { mode: 'daily', time: '08:30' } }],
      h => fired.push(h.id)
    )
    s.scan()
    expect(fired).toEqual([])
  })
})
