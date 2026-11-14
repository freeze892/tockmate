import { describe, it, expect } from 'vitest'
import { parseQuickAdd } from '../src/utils/parseQuickAdd'

const TODAY = '2026-10-25' // 周日

describe('parseQuickAdd', () => {
  it('no date/time → title only', () => {
    const r = parseQuickAdd('买牛奶', TODAY)
    expect(r).toEqual({ title: '买牛奶', dueDate: null, dueTime: null, parsedLabel: null })
  })

  it('今天 + HH:mm', () => {
    const r = parseQuickAdd('今天 14:30 开会', TODAY)
    expect(r.title).toBe('开会')
    expect(r.dueDate).toBe('2026-10-25')
    expect(r.dueTime).toBe('14:30')
  })

  it('明天 09:00', () => {
    const r = parseQuickAdd('明天 09:00 写周报', TODAY)
    expect(r.dueDate).toBe('2026-10-26')
    expect(r.dueTime).toBe('09:00')
    expect(r.title).toBe('写周报')
  })

  it('周五 → 下一个周五', () => {
    const r = parseQuickAdd('周五 18:00 团队聚餐', TODAY)
    expect(r.dueDate).toBe('2026-10-30')
    expect(r.dueTime).toBe('18:00')
  })

  it('下周三', () => {
    const r = parseQuickAdd('下周三 体检', TODAY)
    expect(r.dueDate).toBe('2026-10-28')
  })

  it('X月X日（未来）', () => {
    const r = parseQuickAdd('10月28日 买礼物', TODAY)
    expect(r.dueDate).toBe('2026-10-28')
  })

  it('X号（本月已过→下月）', () => {
    const r = parseQuickAdd('3号 交房租', TODAY)
    expect(r.dueDate).toBe('2026-11-03')
  })

  it('下午3点半 → 15:30', () => {
    const r = parseQuickAdd('明天下午3点半 拿快递', TODAY)
    expect(r.dueTime).toBe('15:30')
    expect(r.dueDate).toBe('2026-10-26')
  })

  it('大后天', () => {
    const r = parseQuickAdd('大后天 出差', TODAY)
    expect(r.dueDate).toBe('2026-10-28')
  })

  it('时间在中文冒号', () => {
    const r = parseQuickAdd('今天21：00 锻炼', TODAY)
    expect(r.dueTime).toBe('21:00')
  })

  it('无日期但有时间', () => {
    const r = parseQuickAdd('18:00 接孩子', TODAY)
    expect(r.dueDate).toBe(null)
    expect(r.dueTime).toBe('18:00')
    expect(r.parsedLabel).toBe('18:00')
  })
})
