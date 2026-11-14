import { describe, it, expect } from 'vitest'
import { pomodoroHeatmap, completionTrend, listDistribution, periodKpis, onTimeRate } from '../src/utils/stats'

const TODAY = '2026-10-31' // 周六
const ts = (iso, h = 10) => new Date(`${iso}T${String(h).padStart(2, '0')}:00:00`).getTime()

describe('pomodoroHeatmap', () => {
  it('生成 weeks*7 天、今天收尾于本周周日', () => {
    const logs = [{ startedAt: ts('2026-10-31'), minutes: 25 }]
    const days = pomodoroHeatmap(logs, 12, TODAY)
    expect(days.length).toBe(84)
    expect(days[days.length - 1].iso).toBe('2026-11-01') // 本周周日
    expect(days[days.length - 2].iso).toBe('2026-10-31')
  })

  it('档位映射：0/低/中/高', () => {
    const logs = [
      { startedAt: ts('2026-10-31'), minutes: 10 },
      { startedAt: ts('2026-10-30'), minutes: 40 },
      { startedAt: ts('2026-10-29'), minutes: 80 },
      { startedAt: ts('2026-10-28'), minutes: 150 }
    ]
    const days = pomodoroHeatmap(logs, 12, TODAY)
    const get = iso => days.find(d => d.iso === iso).level
    expect(get('2026-10-31')).toBe(1)
    expect(get('2026-10-30')).toBe(2)
    expect(get('2026-10-29')).toBe(3)
    expect(get('2026-10-28')).toBe(4)
    expect(get('2026-10-27')).toBe(0)
  })
})

describe('completionTrend', () => {
  it('最近 n 天每日完成数，按日期升序', () => {
    const tasks = [
      { completed: true, deletedAt: null, completedAt: ts('2026-10-30') },
      { completed: true, deletedAt: null, completedAt: ts('2026-10-30', 15) },
      { completed: true, deletedAt: null, completedAt: ts('2026-10-29') },
      { completed: true, deletedAt: null, completedAt: ts('2026-10-20') },
      { completed: true, deletedAt: null, completedAt: ts('2026-10-31') }
    ]
    const trend = completionTrend(tasks, 3, TODAY)
    expect(trend.map(x => x.iso)).toEqual(['2026-10-29', '2026-10-30', '2026-10-31'])
    expect(trend[0].count).toBe(1)
    expect(trend[1].count).toBe(2)
    expect(trend[2].count).toBe(1)
  })

  it('排除已删除', () => {
    const tasks = [{ completed: true, deletedAt: 5, completedAt: ts('2026-10-30') }]
    expect(completionTrend(tasks, 3, TODAY).reduce((a, x) => a + x.count, 0)).toBe(0)
  })
})

describe('listDistribution', () => {
  it('只含有任务的清单，等数量按清单顺序稳定排列', () => {
    const tasks = [
      { listId: 'l1', completed: false, deletedAt: null },
      { listId: 'l1', completed: true, deletedAt: null },
      { listId: 'l2', completed: false, deletedAt: null },
      { listId: 'l3', completed: false, deletedAt: null }
    ]
    const lists = [
      { id: 'l1', name: '工作', color: '#4772FA', deletedAt: null },
      { id: 'l2', name: '生活', color: '#64B94C', deletedAt: null },
      { id: 'l3', name: '购物', color: '#F5A623', deletedAt: null },
      { id: 'l4', name: '空', color: '#333', deletedAt: null }
    ]
    const dist = listDistribution(tasks, lists)
    expect(dist.map(d => d.id)).toEqual(['l1', 'l2', 'l3'])
    expect(dist[0].count).toBe(1)
  })
})

describe('periodKpis / onTimeRate', () => {
  const tasks = [
    { completed: true, deletedAt: null, completedAt: ts('2026-10-31'), dueDate: '2026-10-31' },
    { completed: true, deletedAt: null, completedAt: ts('2026-10-20'), dueDate: '2026-10-18' }, // 逾期
    { completed: true, deletedAt: null, completedAt: ts('2026-10-15'), dueDate: '2026-10-20' }
  ]
  const logs = [{ startedAt: ts('2026-10-31'), minutes: 25 }]

  it('近 30 天 KPI', () => {
    const k = periodKpis(tasks, logs, TODAY, 30)
    expect(k.doneTasks).toBe(3)
    expect(k.pomodoros).toBe(1)
    expect(k.focusMinutes).toBe(25)
    expect(k.onTimeRate).toBe(67)
  })

  it('无完成样本时准时完成率为 null', () => {
    expect(onTimeRate([], TODAY, 30)).toBe(null)
  })
})
