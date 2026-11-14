import { todayISO, addDaysISO, diffDays, friendlyDate } from './date'

const PRIORITY_WEIGHT = { 3: 0, 2: 1, 1: 2, 0: 3 } // 高→无

export function isActive (t) { return !t.completed && !t.deletedAt }

/** 通用排序：有日期在前→有时间在前→优先级高在前→创建早在前 */
export function sortTasks (tasks) {
  return [...tasks].sort((a, b) => {
    if (a.dueDate !== b.dueDate) {
      if (!a.dueDate) return 1
      if (!b.dueDate) return -1
      return a.dueDate < b.dueDate ? -1 : 1
    }
    if (a.dueTime !== b.dueTime) {
      if (!a.dueTime) return 1
      if (!b.dueTime) return -1
      return a.dueTime < b.dueTime ? -1 : 1
    }
    if (a.priority !== b.priority) return PRIORITY_WEIGHT[a.priority] - PRIORITY_WEIGHT[b.priority]
    return a.createdAt - b.createdAt
  })
}

export function matchSearch (t, q) {
  if (!q) return true
  const kw = q.trim().toLowerCase()
  return t.title.toLowerCase().includes(kw) ||
    (t.note || '').toLowerCase().includes(kw) ||
    (t.tags || []).some(tag => tag.toLowerCase().includes(kw))
}

/** 侧栏计数（不含搜索过滤） */
export function viewCounts (tasks, today = todayISO()) {
  const active = tasks.filter(isActive)
  return {
    today: active.filter(t => t.dueDate && diffDays(t.dueDate, today) <= 0).length,
    tomorrow: active.filter(t => t.dueDate === addDaysISO(today, 1)).length,
    next7: active.filter(t => t.dueDate && diffDays(t.dueDate, today) >= 0 && diffDays(t.dueDate, today) <= 6).length,
    all: active.length
  }
}

/**
 * 视图分节
 * 返回 [{ key, label, color?, tasks, done?: 已完成节, variant }]
 */
export function sectionedTasks (view, tasks, lists, search = '', today = todayISO()) {
  const doneAll = tasks.filter(t => t.completed && !t.deletedAt)
  let sections = []

  if (view.type === 'smart') {
    const active = tasks.filter(isActive).filter(t => matchSearch(t, search))
    if (view.id === 'today') {
      sections = [
        { key: 'overdue', label: '逾期', variant: 'overdue', tasks: sortTasks(active.filter(t => t.dueDate && diffDays(t.dueDate, today) < 0)) },
        { key: 'today', label: '今天', tasks: sortTasks(active.filter(t => t.dueDate === today)) }
      ]
    } else if (view.id === 'tomorrow') {
      sections = [{ key: 'tomorrow', label: '明天', tasks: sortTasks(active.filter(t => t.dueDate === addDaysISO(today, 1))) }]
    } else if (view.id === 'next7') {
      for (let i = 0; i < 7; i++) {
        const iso = addDaysISO(today, i)
        const ts = sortTasks(active.filter(t => t.dueDate === iso))
        if (ts.length) sections.push({ key: iso, label: friendlyDate(iso, today), tasks: ts })
      }
    } else if (view.id === 'all') {
      sections = lists.map(l => ({
        key: l.id, label: l.name, color: l.color,
        tasks: sortTasks(active.filter(t => t.listId === l.id))
      })).filter(s => s.tasks.length)
      sections.push(doneSection(doneAll, search))
    } else if (view.id === 'completed') {
      sections = [{ key: 'completed', label: '已完成', tasks: [...doneAll].filter(t => matchSearch(t, search)).sort((a, b) => (b.completedAt || 0) - (a.completedAt || 0)) }]
    }
  } else if (view.type === 'tag') {
    const active = tasks.filter(isActive).filter(t => (t.tags || []).includes(view.id) && matchSearch(t, search))
    sections = [{ key: 'tag', label: '#' + view.id, tasks: sortTasks(active) }]
    sections.push(doneSection(doneAll.filter(t => (t.tags || []).includes(view.id)), search))
  } else if (view.type === 'list') {
    const list = lists.find(l => l.id === view.id)
    const active = tasks.filter(isActive).filter(t => t.listId === view.id && matchSearch(t, search))
    sections = [{ key: 'list', label: list ? list.name : '清单', color: list ? list.color : null, tasks: sortTasks(active) }]
    sections.push(doneSection(doneAll.filter(t => t.listId === view.id), search))
  }
  return sections.filter(s => s.tasks.length || s.variant === 'done-collapse')
}

function doneSection (done, search) {
  return {
    key: 'done', label: '已完成', variant: 'done-collapse',
    tasks: [...done].filter(t => matchSearch(t, search)).sort((a, b) => (b.completedAt || 0) - (a.completedAt || 0))
  }
}

/** 今天视图顶部进度 */
export function todayProgress (tasks, today = todayISO()) {
  const dated = tasks.filter(t => !t.deletedAt && t.dueDate && diffDays(t.dueDate, today) <= 0)
  const done = dated.filter(t => t.completed).length
  return { done, total: dated.length }
}
