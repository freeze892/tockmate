import { describe, it, expect } from 'vitest'
import { sectionedTasks, viewCounts, sortTasks, todayProgress } from '../src/utils/smartViews'

const TODAY = '2026-10-25' // 周日
const lists = [
  { id: 'l-work', name: '工作', color: '#4772FA', order: 0 },
  { id: 'l-life', name: '生活', color: '#64B94C', order: 1 }
]

function t (id, { dueDate = null, dueTime = null, priority = 0, completed = false, listId = 'l-work', title = id, deletedAt = null } = {}) {
  return { id, title, listId, dueDate, dueTime, priority, completed, deletedAt, note: '', createdAt: 1, updatedAt: 1, subtasks: [] }
}

const tasks = [
  t('overdue', { dueDate: '2026-10-24' }),
  t('today-am', { dueDate: TODAY, dueTime: '09:00' }),
  t('today-pm', { dueDate: TODAY, dueTime: '14:00', priority: 3 }),
  t('today-nodate-time', { dueDate: TODAY, priority: 3 }),
  t('tomorrow', { dueDate: '2026-10-26' }),
  t('in7', { dueDate: '2026-10-31' }),
  t('in8', { dueDate: '2026-11-02' }),
  t('nodate', {}),
  t('done-today', { dueDate: TODAY, completed: true, listId: 'l-life' }),
  t('deleted', { dueDate: TODAY, deletedAt: 1 })
]

describe('viewCounts', () => {
  it('counts overdue+today in today, excludes deleted', () => {
    const c = viewCounts(tasks, TODAY)
    expect(c.today).toBe(4) // overdue + today-am + today-pm + today-nodate-time
    expect(c.tomorrow).toBe(1)
    expect(c.next7).toBe(5) // 今天3(不含逾期) + 明天1 + 10-31(第7天)1
  })
})

describe('sectionedTasks · today', () => {
  it('splits overdue and today, excludes completed/deleted', () => {
    const secs = sectionedTasks({ type: 'smart', id: 'today' }, tasks, lists, '', TODAY)
    const overdue = secs.find(s => s.key === 'overdue')
    const today = secs.find(s => s.key === 'today')
    expect(overdue.tasks.map(x => x.id)).toEqual(['overdue'])
    expect(today.tasks.map(x => x.id)).toEqual(['today-am', 'today-pm', 'today-nodate-time'])
  })
  it('sorts today: time first, then priority', () => {
    const secs = sectionedTasks({ type: 'smart', id: 'today' }, tasks, lists, '', TODAY)
    const ids = secs.find(s => s.key === 'today').tasks.map(x => x.id)
    expect(ids).toEqual(['today-am', 'today-pm', 'today-nodate-time'])
  })
})

describe('sectionedTasks · next7', () => {
  it('includes today..+6, excludes day+8, groups by date', () => {
    const secs = sectionedTasks({ type: 'smart', id: 'next7' }, tasks, lists, '', TODAY)
    const keys = secs.map(s => s.key)
    expect(keys).toContain(TODAY)
    expect(keys).toContain('2026-10-26')
    expect(keys).toContain('2026-10-31')
    expect(keys).not.toContain('2026-11-02')
  })
})

describe('sectionedTasks · all', () => {
  it('groups by list with done section, hides lists with no active tasks', () => {
    const ls = [...lists, { id: 'l-empty', name: '空', color: '#333', order: 2 }]
    const secs = sectionedTasks({ type: 'smart', id: 'all' }, tasks, ls, '', TODAY)
    // l-life 只有已完成任务 → active 节被过滤，只剩 l-work 与 done 节
    expect(secs.map(s => s.key)).toEqual(['l-work', 'done'])
  })
  it('list view with only completed → done section only', () => {
    const secs = sectionedTasks({ type: 'list', id: 'l-life' }, tasks, lists, '', TODAY)
    expect(secs.length).toBe(1)
    expect(secs[0].key).toBe('done')
    expect(secs[0].tasks.map(x => x.id)).toEqual(['done-today'])
  })
})

describe('search', () => {
  it('filters by title', () => {
    const withKw = tasks.map(x => x.id === 'today-am' ? { ...x, title: '写周报' } : x)
    const secs = sectionedTasks({ type: 'smart', id: 'today' }, withKw, lists, '周报', TODAY)
    expect(secs.find(s => s.key === 'today').tasks.map(x => x.id)).toEqual(['today-am'])
  })
})

describe('todayProgress', () => {
  it('counts overdue+today including completed', () => {
    const p = todayProgress(tasks, TODAY)
    expect(p.total).toBe(5) // 4 active + done-today
    expect(p.done).toBe(1)
  })
})

describe('sortTasks', () => {
  it('null dates last, priority desc fallback', () => {
    const sorted = sortTasks([t('a', {}), t('b', { priority: 3 }), t('c', { dueDate: '2026-10-26' })])
    expect(sorted.map(x => x.id)).toEqual(['c', 'b', 'a'])
  })
})
