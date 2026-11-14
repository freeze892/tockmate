import { describe, it, expect } from 'vitest'
import { toISODate, fromISO, addDaysISO, diffDays, friendlyDate, nextWeekday, nextMonday } from '../src/utils/date'

describe('date utils', () => {
  it('toISODate / fromISO roundtrip', () => {
    expect(toISODate(new Date(2026, 9, 25))).toBe('2026-10-25')
    expect(fromISO('2026-10-25').getDate()).toBe(25)
    expect(fromISO('2026-10-25').getMonth()).toBe(9)
  })

  it('addDaysISO across month boundary', () => {
    expect(addDaysISO('2026-10-30', 3)).toBe('2026-11-02')
    expect(addDaysISO('2026-01-01', -1)).toBe('2025-12-31')
  })

  it('diffDays', () => {
    expect(diffDays('2026-10-25', '2026-10-25')).toBe(0)
    expect(diffDays('2026-10-26', '2026-10-25')).toBe(1)
    expect(diffDays('2026-10-24', '2026-10-25')).toBe(-1)
  })

  it('friendlyDate relative labels', () => {
    expect(friendlyDate('2026-10-25', '2026-10-25')).toBe('今天')
    expect(friendlyDate('2026-10-26', '2026-10-25')).toBe('明天')
    expect(friendlyDate('2026-10-24', '2026-10-25')).toBe('昨天')
    expect(friendlyDate('2026-10-27', '2026-10-25')).toBe('10月27日 周二')
  })

  it('nextWeekday skips to future occurrence', () => {
    // 2026-10-25 是周日
    expect(nextWeekday('2026-10-25', 0)).toBe('2026-11-01') // 周日→下周日
    expect(nextWeekday('2026-10-25', 1)).toBe('2026-10-26') // 周日→下周一
    expect(nextWeekday('2026-10-26', 1)).toBe('2026-11-02') // 周一→下下周? 不，周一遇到周一顺延一周
  })

  it('nextMonday', () => {
    expect(nextMonday('2026-10-25')).toBe('2026-10-26')
    expect(nextMonday('2026-10-26')).toBe('2026-11-02')
  })
})
