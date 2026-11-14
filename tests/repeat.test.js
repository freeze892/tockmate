import { describe, it, expect } from 'vitest'
import { nextOccurrence, repeatAnchor, repeatLabel } from '../src/utils/repeat'

// 2026-10-31 是周六
const SAT = '2026-10-31'

describe('nextOccurrence', () => {
  it('每天：+1 天', () => {
    expect(nextOccurrence(SAT, { type: 'daily' })).toBe('2026-11-01')
  })

  it('每 N 天', () => {
    expect(nextOccurrence(SAT, { type: 'daily', interval: 3 })).toBe('2026-11-03')
  })

  it('每周：单星期几', () => {
    // 周六完成 → 下一个周一是 11-02
    expect(nextOccurrence(SAT, { type: 'weekly', weekdays: [1] })).toBe('2026-11-02')
  })

  it('每周：多星期几取最近的（周日=0 也算下一轮）', () => {
    // 周六完成，每周日+周三 → 最近的是周日 11-01
    expect(nextOccurrence(SAT, { type: 'weekly', weekdays: [0, 3] })).toBe('2026-11-01')
  })

  it('每月：跨月 + 月末钳制（1月31日 → 2月28日）', () => {
    expect(nextOccurrence('2026-01-31', { type: 'monthly' })).toBe('2026-02-28')
    expect(nextOccurrence('2026-01-15', { type: 'monthly' })).toBe('2026-02-15')
  })

  it('每年：2月29日 → 闰年优先（2028 是闰年）', () => {
    expect(nextOccurrence('2024-02-29', { type: 'yearly' })).toBe('2025-02-28')
  })

  it('严格晚于锚点（锚点当天的不算）', () => {
    expect(nextOccurrence(SAT, { type: 'weekly', weekdays: [6] })).toBe('2026-11-07')
  })

  it('无规则/未知类型 → null', () => {
    expect(nextOccurrence(SAT, null)).toBe(null)
    expect(nextOccurrence(SAT, {})).toBe(null)
  })
})

describe('repeatAnchor', () => {
  it('未逾期：锚点=到期日', () => {
    expect(repeatAnchor('2026-11-05', '2026-10-31')).toBe('2026-11-05')
  })
  it('已逾期：锚点=今天（跳过错过的次数）', () => {
    expect(repeatAnchor('2026-10-20', '2026-10-31')).toBe('2026-10-31')
  })
  it('无到期日 → null', () => {
    expect(repeatAnchor(null, '2026-10-31')).toBe(null)
  })
})

describe('repeatLabel', () => {
  it('各类型中文摘要', () => {
    expect(repeatLabel({ type: 'daily' })).toBe('每天')
    expect(repeatLabel({ type: 'daily', interval: 3 })).toBe('每 3 天')
    expect(repeatLabel({ type: 'weekly', weekdays: [1, 5] })).toBe('周一、周五')
    expect(repeatLabel({ type: 'monthly' })).toBe('每月')
    expect(repeatLabel({ type: 'yearly' })).toBe('每年')
    expect(repeatLabel(null)).toBe('')
  })
})
