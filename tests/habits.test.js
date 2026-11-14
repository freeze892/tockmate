import { describe, it, expect } from 'vitest'
import { streak, last7Days, todayDoneCount } from '../src/utils/habits'

const TODAY = '2026-10-25'

describe('habits', () => {
  it('连续打卡：今天已打卡，往前数', () => {
    const records = ['2026-10-25', '2026-10-24', '2026-10-23']
    expect(streak(records, TODAY)).toBe(3)
  })

  it('今天未打卡：从昨天起算（今日待打卡不清零）', () => {
    const records = ['2026-10-24', '2026-10-23']
    expect(streak(records, TODAY)).toBe(2)
  })

  it('昨天断签 → 连续 0 天', () => {
    expect(streak(['2026-10-25', '2026-10-22'], TODAY)).toBe(1)
    expect(streak(['2026-10-22'], TODAY)).toBe(0)
  })

  it('空记录 → 0', () => {
    expect(streak([], TODAY)).toBe(0)
  })

  it('last7Days 以今天收尾共 7 天', () => {
    const days = last7Days([], TODAY)
    expect(days.length).toBe(7)
    expect(days[6].iso).toBe(TODAY)
    expect(days[5].iso).toBe('2026-10-24')
  })

  it('todayDoneCount 忽略已删除', () => {
    const habits = [
      { records: [TODAY], deletedAt: null },
      { records: [TODAY], deletedAt: 1 },
      { records: [], deletedAt: null }
    ]
    expect(todayDoneCount(habits, TODAY)).toBe(1)
  })
})
