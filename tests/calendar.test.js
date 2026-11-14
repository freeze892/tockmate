import { describe, it, expect } from 'vitest'
import { monthMatrix, locateInMatrix } from '../src/utils/calendar'
import { fromISO } from '../src/utils/date'

describe('monthMatrix', () => {
  it('2026年10月：5 行、周一起始、含今天 10-25 在第 4 行最后列', () => {
    const m = monthMatrix(2026, 9) // 0-11 → 9 = 10月
    expect(m.length).toBe(5)
    expect(m[0][0]).toBe('2026-09-28')
    expect(m[0][3]).toBe('2026-10-01')
    expect(locateInMatrix('2026-10-25', m)).toEqual({ row: 3, col: 6 })
    expect(m[4][6]).toBe('2026-11-01')
  })

  it('每行 7 天、首列都是周一、日期连续', () => {
    const m = monthMatrix(2026, 9)
    m.forEach(week => {
      expect(week.length).toBe(7)
      expect(fromISO(week[0]).getDay()).toBe(1)
      week.forEach((iso, i) => {
        if (i > 0) {
          const prev = fromISO(week[i - 1])
          const cur = fromISO(iso)
          expect(cur.getTime() - prev.getTime()).toBe(86400000)
        }
      })
    })
  })

  it('恰好 4 行的月份（2027年2月，1日恰为周一）', () => {
    const m = monthMatrix(2027, 1)
    expect(m.length).toBe(4)
    expect(m[0][0]).toBe('2027-02-01')
    expect(m[3][6]).toBe('2027-02-28')
  })

  it('需要 6 行的月份（首日为周日）', () => {
    const m = monthMatrix(2027, 7) // 2027-08-01 是周日
    expect(m.length).toBe(6)
    expect(m[0][0]).toBe('2027-07-26')
  })

  it('跨年（2026年12月 → 2027年1月补齐）', () => {
    const m = monthMatrix(2026, 11)
    const flat = m.flat()
    expect(flat).toContain('2026-12-01')
    expect(flat).toContain('2027-01-03')
  })
})
