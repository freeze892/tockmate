import { describe, it, expect } from 'vitest'
import { parseAnyDate, detectHeader, mapRows } from '../src/utils/migrate'

describe('parseAnyDate 多格式日期', () => {
  it('ISO 与斜杠年月日', () => {
    expect(parseAnyDate('2026-11-15')).toBe('2026-11-15')
    expect(parseAnyDate('2026/11/5')).toBe('2026-11-05')
    expect(parseAnyDate('2026年11月15日')).toBe('2026-11-15')
  })
  it('美式 M/D/YYYY', () => {
    expect(parseAnyDate('11/5/2026')).toBe('2026-11-05')
    expect(parseAnyDate('1/3/2027')).toBe('2027-01-03')
  })
  it('非法/空 → null', () => {
    expect(parseAnyDate('')).toBe(null)
    expect(parseAnyDate('13/45/2026')).toBe(null)
    expect(parseAnyDate('随便写的')).toBe(null)
  })
})

describe('detectHeader 表头识别', () => {
  it('滴答无表头（首行是数据）→ false', () => {
    expect(detectHeader([['购物', '买牛奶', '2026/11/15']])).toBe(false)
  })
  it('带表头 → true', () => {
    expect(detectHeader([['标题', '日期'], ['x', 'y']])).toBe(true)
  })
})

describe('mapRows 行映射', () => {
  it('滴答位置式：清单/标题/日期/状态/备注，已完成跳过', () => {
    const rows = [
      ['购物', '买牛奶', '2026/11/15', '0', ''],
      ['工作', '交周报', '', '1', '周五前'],
      ['', '', '', '', '']
    ]
    const r = mapRows(rows)
    expect(r.source).toContain('无表头')
    expect(r.count).toBe(1)
    expect(r.tasks[0]).toEqual({ title: '买牛奶', dueDate: '2026-11-15', listName: '购物', note: '' })
  })
  it('带表头：按表头映射 + 容错日期降级 null', () => {
    const rows = [
      ['Title', 'Due Date', 'Project', 'Description'],
      ['写周报', '11/20/2026', '工作', '含数据图表'],
      ['随手记', '随便写的', '', '']
    ]
    const r = mapRows(rows)
    expect(r.count).toBe(2)
    expect(r.tasks[0].title).toBe('写周报')
    expect(r.tasks[0].dueDate).toBe('2026-11-20')
    expect(r.tasks[1].dueDate).toBe(null)
  })
  it('缺标题列抛错', () => {
    expect(() => mapRows([['名称', '日期'], ['x', 'y']])).toThrow(/标题/)
  })
})
