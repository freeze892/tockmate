import { defineStore } from 'pinia'
import { nextOccurrence, repeatAnchor } from '../utils/repeat'
import { todayISO } from '../utils/date'

let seq = 0
function genId (prefix) {
  return `${prefix}-${Date.now().toString(36)}${(seq++).toString(36)}`
}

const DEFAULT_SETTINGS = {
  theme: 'auto',
  pomodoro: { focus: 25, shortBreak: 5, longBreak: 15, longBreakInterval: 4 },
  webdav: { enabled: false, url: '', username: '', encPassword: '' }
}

export const useDataStore = defineStore('data', {
  state: () => ({
    loaded: false,
    lists: [],
    tasks: [],
    habits: [],
    pomodoro: { logs: [] },
    settings: JSON.parse(JSON.stringify(DEFAULT_SETTINGS)),
    view: { type: 'smart', id: 'today' },
    viewMode: 'list', // 'list' | 'calendar'
    selectedTaskId: null,
    search: '',
    syncState: null
  }),

  getters: {
    activeLists: s => s.lists.filter(l => !l.deletedAt).sort((a, b) => a.order - b.order),
    selectedTask: s => s.tasks.find(t => t.id === s.selectedTaskId) || null,
    viewTitle (s) {
      if (s.view.type === 'list') {
        const l = s.lists.find(x => x.id === s.view.id)
        return l ? l.name : '清单'
      }
      if (s.view.type === 'tag') return '#' + s.view.id
      return { today: '今天', tomorrow: '明天', next7: '最近 7 天', all: '全部', completed: '已完成' }[s.view.id] || ''
    }
  },

  actions: {
    async init () {
      const doc = await window.api.load()
      this.lists = doc.lists || []
      this.tasks = doc.tasks || []
      this.habits = doc.habits || []
      this.pomodoro = doc.pomodoro || { logs: [] }
      this.settings = Object.assign(JSON.parse(JSON.stringify(DEFAULT_SETTINGS)), doc.settings || {})
      this.settings.pomodoro = this.mergePomodoroSettings(doc.settings?.pomodoro)
      this.syncState = doc.syncState || null
      this.loaded = true
    },

    persist () {
      if (!this.loaded) return
      this.settings = { ...this.settings, _updatedAt: Date.now() }
      // Pinia 响应式 Proxy 不能直接走 IPC 结构化克隆，必须先深拷贝成纯对象
      const payload = JSON.parse(JSON.stringify({
        version: 1,
        lists: this.lists,
        tasks: this.tasks,
        habits: this.habits,
        pomodoro: this.pomodoro,
        settings: this.settings
      }))
      window.api.save(payload).catch(err => console.error('[TockMate] 保存失败:', err))
    },

    /** 主进程推送的合并结果（同步/导入后），直接替换且不再回写 */
    /** 番茄设置深层合并默认值，并兼容旧键名 longBreakInterval */
    mergePomodoroSettings (pomodoro) {
      const legacy = pomodoro || {}
      return {
        focus: legacy.focus ?? DEFAULT_SETTINGS.pomodoro.focus,
        shortBreak: legacy.shortBreak ?? DEFAULT_SETTINGS.pomodoro.shortBreak,
        longBreak: legacy.longBreak ?? DEFAULT_SETTINGS.pomodoro.longBreak,
        interval: legacy.interval ?? legacy.longBreakInterval ?? DEFAULT_SETTINGS.pomodoro.interval
      }
    },

    applyRemote (doc) {
      if (!doc || typeof doc !== 'object') return
      this.lists = doc.lists || []
      this.tasks = doc.tasks || []
      this.habits = doc.habits || []
      this.pomodoro = doc.pomodoro || { logs: [] }
      this.settings = Object.assign(JSON.parse(JSON.stringify(DEFAULT_SETTINGS)), doc.settings || {})
      this.settings.pomodoro = this.mergePomodoroSettings(doc.settings?.pomodoro)
      this.syncState = doc.syncState || null
    },

    updateSettings (patch) {
      this.settings = { ...this.settings, ...patch, _updatedAt: Date.now() }
      this.persist()
    },

    setView (type, id) {
      this.view = { type, id }
      this.selectedTaskId = null
    },

    setViewMode (mode) {
      this.viewMode = mode
    },

    setSearch (q) { this.search = q },
    selectTask (id) { this.selectedTaskId = id },

    addList (name, color) {
      const now = Date.now()
      this.lists.push({
        id: genId('l'), name, color,
        order: this.lists.length,
        createdAt: now, updatedAt: now, deletedAt: null
      })
      this.persist()
    },

    updateList (id, patch) {
      const l = this.lists.find(x => x.id === id)
      if (!l) return
      Object.assign(l, patch, { updatedAt: Date.now() })
      this.persist()
    },

    deleteList (id) {
      const l = this.lists.find(x => x.id === id)
      if (!l) return
      l.deletedAt = Date.now()
      l.updatedAt = Date.now()
      this.tasks.forEach(t => { if (t.listId === id && !t.deletedAt) { t.deletedAt = Date.now(); t.updatedAt = Date.now() } })
      if (this.view.type === 'list' && this.view.id === id) this.setView('smart', 'today')
      this.persist()
    },

    addTask ({ title, listId, dueDate = null, dueTime = null, priority = 0, note = '', tags = [], repeat = null,  }) {
      const now = Date.now()
      const task = {
        id: genId('t'),
        title, note,
        listId: listId || (this.view.type === 'list' ? this.view.id : this.activeLists[0]?.id),
        dueDate, dueTime,
        priority,
        tags: (tags || []).map(t => String(t).trim()).filter(Boolean),
        repeat: repeat ? JSON.parse(JSON.stringify(repeat)) : null,
        completed: false, completedAt: null,
        reminderMinutes: null,
        subtasks: [],
        hasImage: false,
        createdAt: now, updatedAt: now, deletedAt: null
      }
      this.tasks.push(task)
      this.persist()
      return task
    },

    updateTask (id, patch) {
      const t = this.tasks.find(x => x.id === id)
      if (!t) return
      Object.assign(t, patch, { updatedAt: Date.now() })
      this.persist()
    },

    toggleTask (id) {
      const t = this.tasks.find(x => x.id === id)
      if (!t) return
      if (!t.completed) {
        t.completed = true
        t.completedAt = Date.now()
        t.updatedAt = Date.now()
        // 重复任务：完成后按规则克隆下一次到期（历史保留在已完成）
        if (t.repeat && t.repeat.type && t.dueDate) {
          const anchor = repeatAnchor(t.dueDate, todayISO())
          const next = anchor && nextOccurrence(anchor, t.repeat)
          if (next) {
            const now = Date.now()
            this.tasks.push({
              ...JSON.parse(JSON.stringify(t)),
              id: genId('t'),
              dueDate: next,
              completed: false,
              completedAt: null,
              hasImage: false,
              subtasks: (t.subtasks || []).map(st => ({ ...st, completed: false })),
              createdAt: now,
              updatedAt: now
            })
          }
        }
      } else {
        t.completed = false
        t.completedAt = null
        t.updatedAt = Date.now()
      }
      this.persist()
    },

    deleteTask (id) {
      const t = this.tasks.find(x => x.id === id)
      if (!t) return
      t.deletedAt = Date.now()
      t.updatedAt = Date.now()
      if (this.selectedTaskId === id) this.selectedTaskId = null
      this.persist()
    },

    addSubtask (taskId, title) {
      const t = this.tasks.find(x => x.id === taskId)
      if (!t || !title.trim()) return
      t.subtasks.push({ id: genId('s'), title: title.trim(), completed: false })
      t.updatedAt = Date.now()
      this.persist()
    },

    toggleSubtask (taskId, subId) {
      const t = this.tasks.find(x => x.id === taskId)
      const st = t && t.subtasks.find(x => x.id === subId)
      if (!st) return
      st.completed = !st.completed
      t.updatedAt = Date.now()
      this.persist()
    },

    removeSubtask (taskId, subId) {
      const t = this.tasks.find(x => x.id === taskId)
      if (!t) return
      t.subtasks = t.subtasks.filter(x => x.id !== subId)
      t.updatedAt = Date.now()
      this.persist()
    },

    addHabit (name, { icon = 'check', color = '#2EA7E0' } = {}) {
      const now = Date.now()
      this.habits.push({
        id: genId('h'), name, icon, color,
        records: [],
        createdAt: now, updatedAt: now, deletedAt: null
      })
      this.persist()
    },

    updateHabit (id, patch) {
      const h = this.habits.find(x => x.id === id)
      if (!h) return
      Object.assign(h, patch, { updatedAt: Date.now() })
      this.persist()
    },

    deleteHabit (id) {
      const h = this.habits.find(x => x.id === id)
      if (!h) return
      h.deletedAt = Date.now()
      h.updatedAt = Date.now()
      this.persist()
    },

    // ── 批量操作 ──
    batchComplete (ids) {
      for (const id of ids) {
        const t = this.tasks.find(x => x.id === id)
        if (t && !t.completed) { t.completed = true; t.completedAt = Date.now(); t.updatedAt = Date.now() }
      }
      this.persist()
    },
    batchMoveList (ids, listId) {
      for (const id of ids) {
        const t = this.tasks.find(x => x.id === id)
        if (t) { t.listId = listId; t.updatedAt = Date.now() }
      }
      this.persist()
    },
    batchMoveDate (ids, dueDate) {
      for (const id of ids) {
        const t = this.tasks.find(x => x.id === id)
        if (t) { t.dueDate = dueDate; t.updatedAt = Date.now() }
      }
      this.persist()
    },
    batchDelete (ids) {
      for (const id of ids) {
        const t = this.tasks.find(x => x.id === id)
        if (t) { t.deletedAt = Date.now(); t.updatedAt = Date.now() }
      }
      if (ids.includes(this.selectedTaskId)) this.selectedTaskId = null
      this.persist()
    },

    // ── 标签 ──
    tagList () {
      const counts = new Map()
      for (const t of this.tasks) {
        if (t.deletedAt) continue
        for (const tag of t.tags || []) counts.set(tag, (counts.get(tag) || 0) + 1)
      }
      return [...counts.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count)
    },

    addTaskTag (id, tag) {
      const t = this.tasks.find(x => x.id === id)
      const name = String(tag || '').trim()
      if (!t || !name || (t.tags || []).includes(name)) return
      t.tags = [...(t.tags || []), name]
      t.updatedAt = Date.now()
      this.persist()
    },

    removeTaskTag (id, tag) {
      const t = this.tasks.find(x => x.id === id)
      if (!t) return
      t.tags = (t.tags || []).filter(x => x !== tag)
      t.updatedAt = Date.now()
      this.persist()
    }
  }
})
