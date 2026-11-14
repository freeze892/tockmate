const fs = require('fs')
const path = require('path')

const SAVE_DEBOUNCE_MS = 500

class DataStore {
  constructor (app) {
    this.dir = app.getPath('userData')
    this.file = path.join(this.dir, 'data.json')
    this.bakFile = this.file + '.bak'
    this.tmpFile = this.file + '.tmp'
    this._timer = null
    this._pending = null
    this._data = null
  }

  seed () {
    const now = Date.now()
    return {
      version: 1,
      lists: [
        { id: 'l-work', name: '工作', color: '#4772FA', order: 0, createdAt: now, updatedAt: now, deletedAt: null },
        { id: 'l-life', name: '生活', color: '#64B94C', order: 1, createdAt: now, updatedAt: now, deletedAt: null },
        { id: 'l-shop', name: '购物', color: '#F5A623', order: 2, createdAt: now, updatedAt: now, deletedAt: null }
      ],
      tasks: [
        sampleTask('t-1', '欢迎使用 TockMate', 'l-life', addDaysISO(0), '14:00', 0, '点右上角「添加任务」或按 Enter 快速新建任务；标题里直接写「明天 09:00 开会」可以自动识别日期。', now),
        sampleTask('t-2', '体验一下日历视图', 'l-work', addDaysISO(1), null, 1, '左侧点击清单名可切换视图；点任务行打开右侧详情面板。', now),
        sampleTask('t-3', '试试无日期任务（想删就删）', 'l-shop', null, null, 0, '没有日期的任务只出现在清单和「全部」里，不会进入今天或日历。', now)
      ],
      habits: [],
      pomodoro: { logs: [] },
      settings: {
        theme: 'auto',
        pomodoro: { focus: 25, shortBreak: 5, longBreak: 15, longBreakInterval: 4 },
        webdav: { enabled: false, url: '', username: '', encPassword: '' }
      }
    }
  }

  load () {
    let data = this._tryRead(this.file)
    if (!data) {
      data = this._tryRead(this.bakFile)
      if (data) this._writeAtomic(data)
    }
    if (!data) {
      data = this.seed()
      this._writeAtomic(data)
    }
    this._data = data
    return data
  }

  /** 主进程当前数据快照（load 后有效；主进程写入请用 setData + saveNow） */
  getData () {
    if (!this._data) this.load()
    return this._data
  }

  setData (data) {
    this._data = data
    return data
  }

  _tryRead (file) {
    try {
      const raw = fs.readFileSync(file, 'utf8')
      const data = JSON.parse(raw)
      if (!data || typeof data !== 'object' || !Array.isArray(data.lists)) return null
      return data
    } catch {
      return null
    }
  }

  save (data) {
    // 内存副本必须即时同步：调度器读取 getData()、番茄日志追加基于 getData()，
    // 若只写盘不更新 _data，主进程会拿启动时的旧数据（甚至覆盖渲染层的新数据）
    this._data = data
    this._pending = data
    if (this._timer) return
    this._timer = setTimeout(() => {
      this._timer = null
      if (this._pending) this.saveNow(this._pending)
    }, SAVE_DEBOUNCE_MS)
  }

  /** 退出前冲刷未落盘的挂起数据 */
  flush () {
    if (this._timer) { clearTimeout(this._timer); this._timer = null }
    if (this._pending) { this.saveNow(this._pending); this._pending = null }
  }

  saveNow (data) {
    try {
      if (fs.existsSync(this.file)) fs.copyFileSync(this.file, this.bakFile)
    } catch { /* 备份失败不阻塞主写 */ }
    this._writeAtomic(data)
  }

  _writeAtomic (data) {
    fs.mkdirSync(this.dir, { recursive: true })
    fs.writeFileSync(this.tmpFile, JSON.stringify(data, null, 2), 'utf8')
    fs.renameSync(this.tmpFile, this.file)
  }
}

function addDaysISO (n) {
  const d = new Date()
  d.setDate(d.getDate() + n)
  return d.toISOString().slice(0, 10)
}

function sampleTask (id, title, listId, dueDate, dueTime, priority, note, now) {
  return {
    id, title, note, listId, dueDate, dueTime,
    priority, completed: false, completedAt: null,
    reminderMinutes: null,
    subtasks: [],
    createdAt: now, updatedAt: now, deletedAt: null
  }
}

module.exports = DataStore
