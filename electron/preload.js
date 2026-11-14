const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('api', {
  // 数据
  load: () => ipcRenderer.invoke('store:load'),
  save: (data) => ipcRenderer.invoke('store:save', data),
  exportData: (scope) => ipcRenderer.invoke('data:export', scope),
  importData: () => ipcRenderer.invoke('data:import'),
  importApply: (mode) => ipcRenderer.invoke('data:import-apply', mode),

  // 窗口
  win: {
    minimize: () => ipcRenderer.send('win:minimize'),
    maximize: () => ipcRenderer.send('win:maximize'),
    close: () => ipcRenderer.send('win:close')
  },

  // 番茄钟
  pomodoro: {
    get: () => ipcRenderer.invoke('pomodoro:get'),
    start: (opts) => ipcRenderer.invoke('pomodoro:start', opts),
    pause: () => ipcRenderer.invoke('pomodoro:pause'),
    resume: () => ipcRenderer.invoke('pomodoro:resume'),
    reset: () => ipcRenderer.invoke('pomodoro:reset'),
    skip: () => ipcRenderer.invoke('pomodoro:skip'),
    setTask: (taskId) => ipcRenderer.invoke('pomodoro:set-task', taskId),
    onState: (cb) => ipcRenderer.on('pomodoro:state', (_e, s) => cb(s))
  },

  // 同步
  webdav: {
    test: (cfg) => ipcRenderer.invoke('webdav:test', cfg),
    save: (cfg) => ipcRenderer.invoke('webdav:save', cfg)
  },
  syncNow: () => ipcRenderer.invoke('sync:now'),

  // 版本与更新
  version: () => ipcRenderer.invoke('app:version'),
  checkUpdate: () => ipcRenderer.invoke('update:check'),
  openExternal: (url) => ipcRenderer.invoke('shell:open-external', url),

  // 应用锁
  lock: {
    status: () => ipcRenderer.invoke('lock:status'),
    unlock: (password) => ipcRenderer.invoke('lock:unlock', password),
    lockNow: () => ipcRenderer.invoke('lock:lock-now'),
    set: (opts) => ipcRenderer.invoke('lock:set', opts),
    onChanged: (cb) => ipcRenderer.on('lock:changed', (_e, s) => cb(s))
  },

  // 任务图片附件
  attachment: {
    save: (taskId, dataUrl) => ipcRenderer.invoke('attachment:save', { taskId, dataUrl }),
    read: (taskId) => ipcRenderer.invoke('attachment:read', { taskId }),
    delete: (taskId) => ipcRenderer.invoke('attachment:delete', { taskId }),
    export: (taskId) => ipcRenderer.invoke('attachment:export', { taskId })
  },

  // 快速捕捉
  quick: {
    add: (payload) => ipcRenderer.invoke('quick:add', payload),
    hide: () => ipcRenderer.send('quick:hide'),
    onShow: (cb) => ipcRenderer.on('quick:show', () => cb())
  },

  // 悬浮窗
  widget: {
    toggle: () => ipcRenderer.invoke('widget:toggle'),
    show: () => ipcRenderer.invoke('widget:show'),
    hide: () => ipcRenderer.send('widget:hide'),
    openMain: () => ipcRenderer.send('widget:open-main'),
    getState: () => ipcRenderer.invoke('widget:get-state'),
    setPinned: (flag) => ipcRenderer.invoke('widget:set-pin', !!flag),
    setDock: (on) => ipcRenderer.invoke('widget:set-dock', !!on),
    dockExpand: () => ipcRenderer.send('widget:dock-expand'),
    dockCollapse: () => ipcRenderer.send('widget:dock-collapse'),
    onDockState: (cb) => ipcRenderer.on('widget:dock-state', (_e, s) => cb(s))
  },

  // 主进程推送
  onDataChanged: (cb) => ipcRenderer.on('data:changed', (_e, doc) => cb(doc)),
  onFocusTask: (cb) => ipcRenderer.on('ui:focus-task', (_e, p) => cb(p)),
  onFocusHabit: (cb) => ipcRenderer.on('ui:focus-habit', (_e, p) => cb(p)),
  onLockUi: (cb) => ipcRenderer.on('ui:lock', () => cb())
})
