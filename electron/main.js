const { app, BrowserWindow, ipcMain, Tray, Menu, Notification, dialog, nativeImage, globalShortcut, shell, net } = require('electron')
const path = require('path')
const fs = require('fs')
const DataStore = require('./store')
const { PomodoroMachine } = require('./pomodoro')
const { ReminderScheduler } = require('./scheduler')
const syncLib = require('./sync')
const backup = require('./backup')
const { hashPassword, verifyPassword } = require('./lock-crypto')
const { isSafeId } = require('./validate')
const widget = require('./widget')
const licenseLib = require('./license-crypto')

// 完整版开关：授权/试用与 Pro 门控仅完整版构建生效；公开核心版由 publish-public 精确串变换置为 false
const LICENSE_PRO = false

// 品牌名由 electron-builder.yml 的 productName 驱动（朋友体验版 TickList / 正式版 TockMate）
// 本应用为纯 2D 界面：禁用 GPU 硬件加速，规避部分显卡驱动下"首帧之后
// DOM 更新不再上屏"的合成器帧冻结问题（软件渲染性能足够）
app.disableHardwareAcceleration()
app.setAppUserModelId('com.tockmate.app') // 与 electron-builder.yml appId 保持一致（通知横幅 AUMID）

// 冒烟模式使用隔离的临时数据目录，不污染真实用户数据（ELECTRON_SMOKE_REAL=1 时跳过，用于诊断真实目录）
if (process.env.ELECTRON_SMOKE && !process.env.ELECTRON_SMOKE_REAL) {
  const os = require('os')
  app.setPath('userData', path.join(os.tmpdir(), 'tockmate-smoke'))
}

// 更名迁移：productName TickMate→TockMate 后 userData 目录随之改变。
// 只搬数据文件（data.json/.bak/widget-pos.json/attachments/dispatch），逐项「源存在且目标缺失才拷」——
// 整目录拷贝会把 Chromium 缓存卷进来，而缓存文件正被本进程 GPU 子进程锁定（首启动即 EACCES，实测踩坑）
function migrateLegacyData () {
  if (process.env.ELECTRON_SMOKE && !process.env.ELECTRON_SMOKE_REAL) return
  const cur = app.getPath('userData')
  const oldDir = path.join(path.dirname(cur), 'TickMate') // Windows 大小写不敏感，dev(tickmate)/安装版(TickMate) 同目录
  if (path.basename(cur).toLowerCase() === 'tickmate' || !fs.existsSync(path.join(oldDir, 'data.json'))) return
  try {
    let moved = 0
    for (const name of ['data.json', 'data.json.bak', 'widget-pos.json']) {
      const src = path.join(oldDir, name)
      const dst = path.join(cur, name)
      if (fs.existsSync(src) && !fs.existsSync(dst)) { fs.copyFileSync(src, dst); moved++ }
    }
    for (const dir of ['attachments', 'dispatch']) {
      const src = path.join(oldDir, dir)
      const dst = path.join(cur, dir)
      if (fs.existsSync(src) && !fs.existsSync(dst)) { fs.cpSync(src, dst, { recursive: true }); moved++ }
    }
    if (moved) console.log('[migrate] 旧目录数据已迁移 ' + moved + ' 项: ' + oldDir + ' → ' + cur + '（旧目录保留作备份）')
  } catch (err) {
    console.error('[migrate] 迁移失败，旧目录原样保留可手动拷贝:', String(err && err.message || err))
  }
}

let win = null
let tray = null
let quitting = false
let appLocked = false
let extChannel = null // 可选扩展模块（完整版构建注入后非空）
const store = new DataStore(app)

// ── 授权（License）：ed25519 离线激活 + 机器码绑定 + 14 天试用 ──
// 试用锚点独立于 data.json（不随同步/导入流转）；数据文件内 _trialStartedAt 作第二见证，
// 二者取更早者——单独删掉任一处都无法重置试用期。lastSeen 单调推进防回拨时钟
let machineCode = null
let licenseGate = { activated: false, trialActive: true } // 主进程侧 Pro 门控（派发通道等使用）
function trialAnchorPath () { return path.join(app.getPath('userData'), 'trial-anchor.json') }
function loadTrialAnchor () {
  try {
    const a = JSON.parse(fs.readFileSync(trialAnchorPath(), 'utf8'))
    if (a && Number(a.startedAt) > 0) return { startedAt: Number(a.startedAt), lastSeen: Number(a.lastSeen) || 0 }
  } catch { /* 首启或损坏 → 按全新试用重建 */ }
  return null
}
function saveTrialAnchor (a) {
  try { fs.writeFileSync(trialAnchorPath(), JSON.stringify(a)) } catch (err) { console.warn('[license] 锚点写入失败:', String(err && err.message || err)) }
}
async function ensureMachineCode () {
  if (!machineCode) {
    machineCode = licenseLib.formatMachineCode(licenseLib.digestMachineCode(await licenseLib.readMachineGuid()))
    console.log('[license] 本机机器码:', machineCode)
  }
  return machineCode
}
/** 读取试用状态并推进 lastSeen（锚点缺失则按现在落盘；激活状态由 settings.license 驱动） */
function advanceTrial () {
  const now = Date.now()
  const existed = loadTrialAnchor()
  const a = existed || { startedAt: now, lastSeen: now }
  const witnessed = Number(store.getData().settings?._trialStartedAt)
  if (witnessed > 0 && witnessed < a.startedAt) a.startedAt = witnessed
  const trial = licenseLib.computeTrial(a, now)
  a.lastSeen = Math.max(a.lastSeen, now)
  if (!existed || a.lastSeen !== existed.lastSeen || a.startedAt !== existed.startedAt) {
    saveTrialAnchor({ startedAt: a.startedAt, lastSeen: a.lastSeen })
  }
  if (witnessed <= 0 || witnessed > a.startedAt) {
    const doc = store.getData()
    doc.settings = doc.settings || {}
    doc.settings._trialStartedAt = a.startedAt
    doc.settings._updatedAt = now
    store.setData(doc)
    store.saveNow(doc)
  }
  return trial
}
function applyLicenseGate (info) {
  licenseGate = { activated: !!info.activated, trialActive: !!(info.trial && info.trial.active) }
}
/** 主进程侧 Pro 是否解锁（试用期内或已激活；公开核心版恒 false 但其本就无 Pro 代码） */
function proUnlocked () {
  return LICENSE_PRO && (licenseGate.activated || licenseGate.trialActive)
}
async function licenseInfo () {
  const mc = await ensureMachineCode()
  const trial = advanceTrial()
  const code = store.getData().settings?.license?.code
  const v = code ? licenseLib.verifyLicenseCode(code, licenseLib.parseMachineCode(mc)) : null
  return {
    machineCode: mc,
    activated: !!(v && v.ok),
    name: v && v.ok ? (v.payload.n || '') : '',
    expiresAt: v && v.ok ? (v.payload.e || null) : null,
    trial
  }
}

// ── 任务图片附件 ─────────────────────────────────────────────────
// taskId 拼路径前必须过白名单：导入/同步的文档可携带任意 id，防路径穿越
function attachmentsDir () {
  const dir = path.join(app.getPath('userData'), 'attachments')
  fs.mkdirSync(dir, { recursive: true })
  return dir
}
function attachmentPath (taskId) {
  if (!isSafeId(taskId)) return null
  return path.join(attachmentsDir(), `${taskId}.jpg`)
}
async function saveAttachment (taskId, dataUrl) {
  const m = /^data:image\/(png|jpeg|jpg|webp);base64,(.+)$/.exec(String(dataUrl || ''))
  if (!m) return { ok: false, error: '不支持的数据格式' }
  const file = attachmentPath(taskId)
  if (!file) return { ok: false, error: '非法的任务 id' }
  fs.writeFileSync(file, Buffer.from(m[2], 'base64'))
  // 清理可能的其它扩展名残留（每任务只保留一张）
  for (const ext of ['png', 'webp']) {
    const alt = path.join(attachmentsDir(), `${taskId}.${ext}`)
    if (ext !== 'jpg' && fs.existsSync(alt)) fs.rmSync(alt)
  }
  return { ok: true }
}
function readAttachment (taskId) {
  const file = attachmentPath(taskId)
  if (!file || !fs.existsSync(file)) return null
  return 'data:image/jpeg;base64,' + fs.readFileSync(file).toString('base64')
}
function deleteAttachment (taskId) {
  const file = attachmentPath(taskId)
  if (file && fs.existsSync(file)) fs.rmSync(file)
  return { ok: true }
}

// ── 广播 ─────────────────────────────────────────────────────────
// 发给全部窗口（主窗/悬浮窗/快速捕捉），可排除发起方避免回环
function broadcast (channel, payload, excludeSender = null) {
  for (const w of BrowserWindow.getAllWindows()) {
    if (w.isDestroyed()) continue
    if (excludeSender && w.webContents === excludeSender) continue
    w.webContents.send(channel, payload)
  }
}

// ── 导航锁：渲染层只允许停留在自有页面，禁止导航到任意外部内容 ──
function lockNavigation (wc, allowPrefix) {
  wc.on('will-navigate', (e, url) => {
    if (!url.startsWith(allowPrefix)) e.preventDefault()
  })
  wc.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://')) shell.openExternal(url) // 外链交给系统浏览器
    return { action: 'deny' }
  })
}

function showWindow () {
  if (!win || win.isDestroyed()) { createWindow(); return }
  if (win.isMinimized()) win.restore()
  win.show()
  win.focus()
}

// ── 番茄钟 ───────────────────────────────────────────────────────
const pomo = new PomodoroMachine(() => Date.now(), evt => {
  if (evt.type === 'phase-end' && evt.phase === 'focus') {
    const doc = store.getData()
    doc.pomodoro = doc.pomodoro || { logs: [] }
    doc.pomodoro.logs.push({
      startedAt: Date.now() - evt.minutes * 60000,
      minutes: evt.minutes,
      taskId: evt.taskId || null
    })
    store.setData(doc)
    store.saveNow(doc)
    broadcast('data:changed', doc)
    notify('专注完成', `本次专注 ${evt.minutes} 分钟${evt.taskId ? '' : ''}，休息一下吧`)
  }
  if (evt.type === 'phase-start' && evt.phase === 'focus') {
    notify('休息结束', '开始新的专注时段')
  }
  broadcast('pomodoro:state', pomo.snapshot())
})

// ── 任务到期提醒 ─────────────────────────────────────────────────
const scheduler = new ReminderScheduler(
  () => (store.getData().tasks || []),
  task => {
    console.log('[scheduler] 触发提醒:', task.title)
    if (!Notification.isSupported()) return
    const n = new Notification({
      title: '任务提醒',
      body: task.title + (task.reminderMinutes > 0 ? `（${formatLead(task.reminderMinutes)}）` : '（已到时间）')
    })
    n.on('click', () => {
      showWindow()
      broadcast('ui:focus-task', { taskId: task.id })
    })
    n.show()
  },
  () => Date.now(),
  // 习惯打卡提醒（Sprint 17）：每天定时 / 间隔循环（喝水类）
  () => (store.getData().habits || []),
  habit => {
    console.log('[scheduler] 习惯提醒:', habit.name)
    if (!Notification.isSupported()) return
    const interval = habit.reminder && habit.reminder.mode === 'interval'
    const n = new Notification({
      title: '习惯提醒',
      body: habit.name + (interval ? ' · 到点了，记一下' : ' · 今天还没打卡')
    })
    n.on('click', () => {
      showWindow()
      broadcast('ui:focus-habit', { habitId: habit.id })
    })
    n.show()
  }
)
scheduler.start()

function formatLead (min) {
  if (min >= 1440) return '提前 1 天提醒'
  if (min >= 60) return `提前 ${min / 60} 小时提醒`
  return `提前 ${min} 分钟提醒`
}

function notify (title, body) {
  if (!Notification.isSupported()) { console.log('[notify] 系统不支持通知'); return }
  const n = new Notification({ title, body })
  n.on('click', () => showWindow())
  n.on('show', () => console.log('[notify] 已显示:', title, '-', body))
  n.on('failed', (_e, err) => console.log('[notify] 显示失败:', String(err)))
  n.show()
}

// ── WebDAV 同步 ──────────────────────────────────────────────────
let webdavIo = null
function getIo () {
  if (!webdavIo) webdavIo = syncLib.createWebdavIo(require('webdav'))
  return webdavIo
}

function encryptPassword (plain) {
  try {
    if (app.isReady && safeStorageAvailable()) {
      return 'enc:' + require('electron').safeStorage.encryptString(plain).toString('base64')
    }
  } catch { /* fall through */ }
  return 'plain:' + Buffer.from(plain, 'utf8').toString('base64')
}

function safeStorageAvailable () {
  try { return require('electron').safeStorage.isEncryptionAvailable() } catch { return false }
}

function decryptPassword (enc) {
  if (!enc) return ''
  if (enc.startsWith('enc:')) {
    return require('electron').safeStorage.decryptString(Buffer.from(enc.slice(4), 'base64'))
  }
  if (enc.startsWith('plain:')) return Buffer.from(enc.slice(6), 'base64').toString('utf8')
  return ''
}

let syncTimer = null
async function doSync (reason = 'manual') {
  const doc = store.getData()
  const cfg = doc.settings?.webdav
  if (!cfg || !cfg.enabled || !cfg.url || !cfg.username) return { ok: false, error: '未启用或配置不完整' }
  try {
    const password = decryptPassword(cfg.passwordEnc)
    const { doc: merged } = await syncLib.syncNow({ url: cfg.url, username: cfg.username, password }, doc, getIo())
    merged.syncState = { lastSyncAt: Date.now(), lastError: null }
    store.setData(merged)
    store.saveNow(merged)
    broadcast('data:changed', merged)
    return { ok: true }
  } catch (err) {
    const d2 = store.getData()
    d2.syncState = { lastSyncAt: d2.syncState?.lastSyncAt || null, lastError: String(err && err.message || err) }
    store.setData(d2)
    store.saveNow(d2)
    broadcast('data:changed', d2)
    return { ok: false, error: String(err && err.message || err) }
  }
}

// ── 同步调度（Sprint 17 治理）：不再「数据变更即同步」——
// 启动 1 次 + 运行中每 2 小时 1 次 + 退出时 1 次；手动「立即同步」随时可用
function syncEnabled () {
  const cfg = store.getData().settings?.webdav
  return !!(cfg && cfg.enabled && cfg.url && cfg.username)
}
function scheduleSyncAfterChange () {
  // 保留函数名以兼容既有调用点：改为不做自动同步（见 startSyncLoop / before-quit）
}

// ── 窗口 ─────────────────────────────────────────────────────────
function findAsset (name) {
  // 打包版在 process.resourcesPath，开发版在项目根的对应目录
  const candidates = [
    path.join(process.resourcesPath || '', name),
    path.join(__dirname, '..', name),
    path.join(__dirname, '..', 'resources', name)
  ]
  for (const p of candidates) {
    try { if (p && fs.existsSync(p)) return p } catch { /* 忽略 */ }
  }
  return null
}

function createWindow () {
  win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 600,
    frame: false,
    backgroundColor: '#F7F7F8',
    show: false,
    icon: findAsset('icon.png') ? nativeImage.createFromPath(findAsset('icon.png')) : undefined,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })
  win.once('ready-to-show', () => win.show())
  // 程序化切页/无输入时避免合成器节流导致画面停滞（也影响截图取帧）
  win.webContents.setBackgroundThrottling(false)
  // 导航锁：渲染层只允许停留在自有页面（dev 允许 dev server）
  lockNavigation(win.webContents, process.env.VITE_DEV_SERVER_URL || 'file://')
  // 兜底：页面加载异常导致 ready-to-show 不触发时，8 秒后强制显示窗口（可见空白 > 隐形僵尸进程）
  setTimeout(() => {
    if (win && !win.isDestroyed() && !win.isVisible()) {
      win.show()
      console.error('[TockMate] 窗口 8 秒未就绪，已强制显示——若内容空白请把终端输出发给开发者')
    }
  }, 8000)

  const devUrl = process.env.VITE_DEV_SERVER_URL
  if (devUrl) {
    // 渲染进程报错转发到终端，便于诊断
    win.webContents.on('console-message', (_e, level, message, line, sourceId) => {
      if (level >= 2) console.log(`[renderer] ${message} (${sourceId}:${line})`)
    })
    // dev server 偶发慢于窗口启动，失败重试
    const tryLoad = (n) => win.loadURL(devUrl).catch(err => {
      if (n > 0 && !win.isDestroyed()) setTimeout(() => tryLoad(n - 1), 1000)
      else console.error('加载开发服务器失败:', err.message)
    })
    tryLoad(5)
  } else {
    win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'))
  }

  // 关窗最小化到托盘（退出走托盘菜单）
  let balloonShown = false
  win.on('close', e => {
    if (!quitting && !process.env.ELECTRON_SMOKE) {
      e.preventDefault()
      // 应用锁启用时：关闭 = 锁定 + 隐藏（重进必见锁屏，符合"我开了锁"的隐私预期）
      if (store.getData().settings?.appLock?.enabled) {
        appLocked = true
        broadcast('lock:changed', { locked: true })
      } else if (!balloonShown && tray) {
        // 一次性教学：托盘常驻不是退出
        try {
          tray.displayBalloon({ title: 'TockMate 仍在运行', content: '已最小化到托盘。退出请右键托盘图标 → 退出' })
        } catch { /* 忽略气泡失败 */ }
        balloonShown = true
      }
      win.hide()
    }
  })
  win.on('closed', () => { win = null })
}

// ── 托盘 ─────────────────────────────────────────────────────────

// ── 全局快捷键快速捕捉 ────────────────────────────────────────
let quickWin = null
let currentQuickShortcut = null

function applyGlobalShortcut (shortcut) {
  try { globalShortcut.unregister(currentQuickShortcut || shortcut) } catch { /* 首次无注册 */ }
  try { globalShortcut.unregisterAll() } catch { /* 忽略 */ }
  if (!shortcut) { currentQuickShortcut = null; return true }
  const ok = globalShortcut.register(shortcut, () => toggleQuickCapture())
  currentQuickShortcut = ok ? shortcut : null
  if (!ok) console.error('[TockMate] 全局快捷键注册失败（可能被其他应用占用）:', shortcut)
  return ok
}

function toggleQuickCapture () {
  if (quickWin && !quickWin.isDestroyed()) {
    if (quickWin.isVisible()) { quickWin.hide(); return }
    quickWin.show(); quickWin.focus()
    quickWin.webContents.send('quick:show')
    return
  }
  quickWin = new BrowserWindow({
    width: 560, height: 128,
    frame: false, alwaysOnTop: true, skipTaskbar: true,
    resizable: false, fullscreenable: false, show: false,
    backgroundColor: '#FFFFFF',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true, nodeIntegration: false, sandbox: false
    }
  })
  lockNavigation(quickWin.webContents, process.env.VITE_DEV_SERVER_URL || 'file://')
  const devUrl = process.env.VITE_DEV_SERVER_URL
  if (devUrl) quickWin.loadURL(devUrl + '#quick')
  else quickWin.loadFile(path.join(__dirname, '..', 'dist', 'index.html'), { hash: 'quick' })
  quickWin.once('ready-to-show', () => { quickWin.show(); quickWin.focus() })
  quickWin.on('blur', () => { if (quickWin && !quickWin.isDestroyed() && quickWin.isVisible()) quickWin.hide() })
  quickWin.on('closed', () => { quickWin = null })
}

function createTray () {
  const trayPath = findAsset('tray.png')
  if (!trayPath) {
    console.log('[TockMate] 未找到 tray.png，托盘未创建')
    return
  }
  tray = new Tray(nativeImage.createFromPath(trayPath))
  console.log('[TockMate] 托盘已创建:', trayPath)
  tray.setToolTip('TockMate')
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: '显示主界面', click: () => showWindow() },
    { label: '悬浮窗', type: 'checkbox', checked: !!widget.getWidget(), click: (mi) => { if (mi.checked) widget.showWidget(); else widget.hideWidget() } },
    {
      label: '锁定',
      click: () => {
        if (store.getData().settings?.appLock?.enabled) {
          appLocked = true
          broadcast('lock:changed', { locked: true })
        }
        showWindow()
      }
    },
    { type: 'separator' },
    {
      label: '退出',
      click: () => {
        quitting = true
        try { if (win && !win.isDestroyed()) win.destroy() } catch { /* 已销毁 */ }
        app.quit()
        setTimeout(() => app.exit(0), 2000)
      }
    }
  ]))
  tray.on('click', () => {
    if (win && win.isVisible() && win.isFocused()) win.hide()
    else showWindow()
  })
}

// ── IPC ──────────────────────────────────────────────────────────
ipcMain.handle('store:load', () => store.load())
ipcMain.handle('store:save', (_e, data) => {
    const prevShortcut = store.getData().settings?.quickShortcut
    store.save(data)
    const nextShortcut = data && data.settings && data.settings.quickShortcut
    if (nextShortcut !== undefined && nextShortcut !== prevShortcut) applyGlobalShortcut(nextShortcut || null)
    // 多窗口数据同步：发起方本地已是最新，推给其余窗口（接收方 applyRemote 不回写，无回环）
    broadcast('data:changed', data, _e.sender)
  })

ipcMain.on('win:minimize', () => win && win.minimize())
ipcMain.on('win:maximize', () => { if (!win) return; win.isMaximized() ? win.unmaximize() : win.maximize() })
ipcMain.on('win:close', () => win && win.close())

ipcMain.handle('pomodoro:get', () => pomo.snapshot())
ipcMain.handle('pomodoro:start', (_e, { taskId, durations } = {}) => {
  if (durations) pomo.configure(durations)
  const ok = pomo.startFocus(taskId || null)
  broadcast('pomodoro:state', pomo.snapshot())
  return ok
})
ipcMain.handle('pomodoro:pause', () => pomo.pause())
ipcMain.handle('pomodoro:resume', () => pomo.resume())
ipcMain.handle('pomodoro:reset', () => pomo.abort())
ipcMain.handle('pomodoro:skip', () => pomo.skipBreak())
ipcMain.handle('pomodoro:set-task', (_e, taskId) => pomo.setTask(taskId))

ipcMain.handle('webdav:test', async (_e, cfg) => {
  try {
    const password = cfg.useSaved
      ? decryptPassword(store.getData().settings?.webdav?.passwordEnc)
      : (cfg.password || '')
    const r = await getIo().testConnection({ url: cfg.url, username: cfg.username, password })
    return { ok: r.ok, steps: r.steps || [] }
  } catch (err) {
    return { ok: false, error: String(err && err.message || err), steps: [] }
  }
})
ipcMain.handle('webdav:save', (_e, cfg) => {
  const doc = store.getData()
  const keepEnc = cfg.useSaved ? (doc.settings?.webdav?.passwordEnc || '') : encryptPassword(cfg.password || '')
  doc.settings = doc.settings || {}
  doc.settings.webdav = { enabled: !!cfg.enabled, url: cfg.url, username: cfg.username, passwordEnc: keepEnc }
  doc.settings._updatedAt = Date.now()
  store.setData(doc)
  store.saveNow(doc)
  broadcast('data:changed', doc)
  return true
})
ipcMain.handle('sync:now', () => doSync('manual'))

ipcMain.handle('data:export', async (_e, scope = 'all') => {
  const r = await dialog.showSaveDialog(win, {
    title: scope === 'active' ? '导出数据（仅未完成）' : '导出数据（全部）',
    defaultPath: `TockMate-备份-${new Date().toISOString().slice(0, 10)}.json`,
    filters: [{ name: 'JSON', extensions: ['json'] }]
  })
  if (r.canceled || !r.filePath) return { ok: false, canceled: true }
  const doc = await backup.embedImages(backup.scopeForExport(store.getData(), scope), readAttachment)
  fs.writeFileSync(r.filePath, JSON.stringify(doc, null, 2), 'utf8')
  return { ok: true, path: r.filePath }
})
let stagedImport = null
ipcMain.handle('data:import', async () => {
  const r = await dialog.showOpenDialog(win, {
    title: '导入数据',
    filters: [{ name: 'JSON', extensions: ['json'] }],
    properties: ['openFile']
  })
  if (r.canceled || !r.filePaths[0]) return { ok: false, canceled: true }
  try {
    const doc = JSON.parse(fs.readFileSync(r.filePaths[0], 'utf8'))
    if (!syncLib.isValidDoc(doc)) return { ok: false, error: '文件格式不正确' }
    stagedImport = doc
    return {
      ok: true,
      fileName: path.basename(r.filePaths[0]),
      counts: {
        lists: (doc.lists || []).length,
        tasks: (doc.tasks || []).length,
        habits: (doc.habits || []).length
      }
    }
  } catch (err) {
    return { ok: false, error: String(err && err.message || err) }
  }
})
ipcMain.handle('data:import-apply', (_e, mode) => {
  if (!stagedImport) return { ok: false, error: '无待导入数据' }
  try {
    const stagedDoc = stagedImport
    const next = backup.applyImport(store.getData(), stagedDoc, mode)
    store.setData(next)
    store.saveNow(next)
    broadcast('data:changed', next)
    stagedImport = null
    // 异步还原导入文件中的任务图片，完成后再次广播
    backup.restoreImages(next, stagedDoc, (id, data) => saveAttachment(id, data))
      .then(restored => {
        if (restored.size) {
          const doc = store.getData()
          for (const t of doc.tasks || []) { if (restored.has(t.id)) t.hasImage = true }
          store.setData(doc)
          store.saveNow(doc)
          broadcast('data:changed', doc)
        }
      })
      .catch(err => console.error('[TockMate] 图片还原失败:', err))
    return { ok: true }
  } catch (err) {
    return { ok: false, error: String(err && err.message || err) }
  }
})

// ── 应用锁 ───────────────────────────────────────────────────────
// 解锁防爆破：连续失败 5 次起指数退避（30s 起，上限 10 分钟），内存态即可。
// 冷却期内所有验证一律拒绝（含正确密码）——否则攻击者冷却期内仍可全速跑 scrypt 猜测。
// lock:unlock 与 lock:set 共用同一节流器，避免改密码/关锁通道绕过爆破限制
let unlockFails = 0
let unlockLockoutUntil = 0
function verifyLockThrottled (password) {
  const cfg = store.getData().settings?.appLock
  const now = Date.now()
  if (now < unlockLockoutUntil) {
    return { ok: false, error: '尝试过于频繁，请 ' + Math.ceil((unlockLockoutUntil - now) / 1000) + ' 秒后再试' }
  }
  if (verifyPassword(password, cfg.salt, cfg.hash)) {
    unlockFails = 0
    unlockLockoutUntil = 0
    return { ok: true }
  }
  unlockFails++
  if (unlockFails >= 5) unlockLockoutUntil = now + Math.min(30 * 1000 * Math.pow(2, unlockFails - 5), 10 * 60 * 1000)
  return { ok: false }
}
ipcMain.handle('lock:status', () => ({ enabled: !!store.getData().settings?.appLock?.enabled, locked: appLocked }))
ipcMain.handle('lock:unlock', (_e, password) => {
  const cfg = store.getData().settings?.appLock
  if (!cfg?.enabled) { appLocked = false; unlockFails = 0; unlockLockoutUntil = 0; return { ok: true } }
  const r = verifyLockThrottled(password)
  if (r.ok) {
    appLocked = false
    broadcast('lock:changed', { locked: false })
  }
  return r
})
ipcMain.handle('lock:lock-now', () => {
  if (store.getData().settings?.appLock?.enabled) {
    appLocked = true
    broadcast('lock:changed', { locked: true })
  }
  return { ok: true, locked: appLocked }
})
ipcMain.handle('lock:set', (_e, { currentPassword, newPassword }) => {
  const doc = store.getData()
  const cfg = doc.settings?.appLock
  if (cfg?.enabled) {
    // 与解锁共用防爆破节流：改密码/关锁同样是爆破通道
    const v = verifyLockThrottled(currentPassword)
    if (!v.ok) return { ok: false, error: v.error || '当前密码不正确' }
  }
  if (!newPassword) {
    doc.settings.appLock = { enabled: false }
  } else {
    if (String(newPassword).length < 4) return { ok: false, error: '密码至少 4 位' }
    const { salt, hash } = hashPassword(newPassword)
    doc.settings.appLock = { enabled: true, salt, hash }
    appLocked = false
  }
  doc.settings._updatedAt = Date.now()
  store.setData(doc)
  store.saveNow(doc)
  broadcast('data:changed', doc)
  broadcast('lock:changed', { locked: appLocked })
  return { ok: true }
})

// ── 任务图片附件 ─────────────────────────────────────────────────
ipcMain.handle('attachment:save', (_e, { taskId, dataUrl }) => saveAttachment(taskId, dataUrl))
ipcMain.handle('attachment:read', (_e, { taskId }) => readAttachment(taskId))
ipcMain.handle('attachment:delete', (_e, { taskId }) => deleteAttachment(taskId))
ipcMain.handle('attachment:export', async (_e, { taskId }) => {
  const file = attachmentPath(taskId)
  if (!file || !fs.existsSync(file)) return { ok: false, error: '该任务没有图片' }
  const r = await dialog.showSaveDialog(win, {
    title: '保存图片',
    defaultPath: `TockMate-${taskId}.jpg`,
    filters: [{ name: 'JPEG', extensions: ['jpg'] }]
  })
  if (r.canceled || !r.filePath) return { ok: false, canceled: true }
  fs.copyFileSync(file, r.filePath)
  return { ok: true, path: r.filePath }
})

ipcMain.handle('app:version', () => app.getVersion())
// 能力标志：渲染层据此显隐可选能力（标准构建恒为 false）
ipcMain.handle('app:capabilities', async () => ({
  extension: !!extChannel,
  license: LICENSE_PRO ? await licenseInfo() : null
}))

// ── 授权激活 ─────────────────────────────────────────────────────
ipcMain.handle('license:activate', async (_e, code) => {
  if (!LICENSE_PRO) return { ok: false, reason: '本版本无需激活' }
  const clean = String(code || '').replace(/\s+/g, '')
  if (!clean) return { ok: false, reason: '请先粘贴激活码' }
  const mc = await ensureMachineCode()
  const v = licenseLib.verifyLicenseCode(clean, licenseLib.parseMachineCode(mc))
  if (!v.ok) return { ok: false, reason: v.reason }
  const doc = store.getData()
  doc.settings = doc.settings || {}
  doc.settings.license = { code: clean }
  doc.settings._updatedAt = Date.now()
  store.setData(doc)
  store.saveNow(doc)
  broadcast('data:changed', doc)
  applyLicenseGate(await licenseInfo())
  console.log('[license] 激活成功:', v.payload.m, v.payload.n || '')
  return { ok: true }
})
ipcMain.handle('license:status', async () => (LICENSE_PRO ? licenseInfo() : null))
ipcMain.handle('update:check', async () => {
  const manifestUrl = 'https://raw.githubusercontent.com/freeze892/tockmate/main/latest.json'
  try {
    const res = await net.fetch(manifestUrl, { signal: AbortSignal.timeout(10000) })
    if (!res.ok) return { ok: false, message: '更新服务器暂不可达（' + res.status + '）' }
    const manifest = await res.json()
    const latest = String(manifest.version || '')
    const cur = app.getVersion()
    if (!latest || latest <= cur) return { ok: true, update: false, message: '当前已是最新版本 v' + cur }
    return { ok: true, update: true, latest, url: manifest.downloadUrl || '', notes: manifest.notes || '' }
  } catch (err) {
    return { ok: false, message: '检查失败：' + String(err && err.message || err).slice(0, 60) }
  }
})

// 外链打开：仅允许 https，交给系统浏览器（渲染层不承载外部内容）
ipcMain.handle('shell:open-external', (_e, url) => {
  try {
    const u = new URL(String(url || ''))
    if (u.protocol !== 'https:') return { ok: false, error: '仅允许 https 链接' }
    shell.openExternal(u.toString())
    return { ok: true }
  } catch { return { ok: false, error: '无效链接' } }
})

// ── 生命周期 ──────────────────────────────────────────────────────
let quitSyncStarted = false
app.on('before-quit', (e) => {
  quitting = true
  try { store.flush() } catch (err) { console.error('[TockMate] flush 失败:', err) }
  // 退出前同步一次（15s 兜底，不阻塞退出；冒烟模式跳过）
  if (!quitSyncStarted && syncEnabled() && !process.env.ELECTRON_SMOKE) {
    quitSyncStarted = true
    e.preventDefault()
    Promise.race([doSync('quit'), new Promise(r => setTimeout(r, 15000))])
      .catch(() => {})
      .finally(() => app.quit())
  }
})
app.on('window-all-closed', () => {
  // 托盘常驻：只有显式退出才真正关闭（冒烟模式除外）
  if (process.env.ELECTRON_SMOKE || quitting) app.quit()
})

const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
} else {
  app.on('second-instance', () => showWindow())
  app.whenReady().then(async () => {
    migrateLegacyData()
    store.load()
    // 可选扩展模块：electron/extension.js 由完整版构建注入；标准检出无此文件
    try {
      const ext = require('./extension')
      extChannel = ext.mount({
        // 试用期结束且未激活时派发通道静默（Pro 门控）；任务数据原样保留
        getTasks: () => (proUnlocked() ? (store.getData().tasks || []) : []),
        userDataDir: app.getPath('userData'),
        getSetting: (k) => store.getData().settings?.[k]
      })
      console.log('[ext] 扩展模块已挂载')
    } catch {
      extChannel = null
      console.log('[ext] 标准模式')
    }
    // 应用锁：启用则启动即锁定（冒烟模式自动解锁以便探针验证）
    appLocked = !!store.getData().settings?.appLock?.enabled && !process.env.ELECTRON_SMOKE

    // 授权初始化（完整版）：落盘试用锚点 + 刷新 Pro 门控（公开核心版整体缺席）
    if (LICENSE_PRO) {
      try {
        applyLicenseGate(await licenseInfo())
        console.log('[license] Pro 门控:', licenseGate.activated ? '已激活' : (licenseGate.trialActive ? '试用中' : '试用已结束'))
      } catch (err) {
        console.warn('[license] 初始化失败:', String(err && err.message || err))
      }
    }

    // 同步诊断模式：TICKMATE_PROBE_SYNC=1 探测权限；=sync 执行完整同步并输出结果
    if (process.env.TICKMATE_PROBE_SYNC) {
      (async () => {
        try {
          if (process.env.TICKMATE_PROBE_SYNC === 'sync') {
            console.log('[probe] 执行完整同步…')
            const r = await doSync('probe')
            console.log('[probe] 同步结果:', JSON.stringify(r))
            console.log('[probe] syncState:', JSON.stringify(store.getData().syncState))
          } else {
            const cfgDoc = store.getData()
            const w = cfgDoc.settings?.webdav || {}
            const password = decryptPassword(w.passwordEnc)
            const io = getIo()
            console.log('[probe] 服务器:', w.url, '| 账号:', w.username, '| enabled:', w.enabled, '| 密码:', password ? '已存' : '无')
            const r = await io.testConnection({ url: w.url, username: w.username, password })
            console.log('[probe] 结论:', r.ok ? '全部允许' : '存在被拒操作')
            ;(r.steps || []).forEach(s => console.log('[probe]', s))
          }
        } catch (err) {
          console.log('[probe] 异常:', String(err && err.message || err))
        }
        app.exit(0)
      })()
      return // 诊断模式不进主流程
    }

    createWindow()
    widget.createWidget(app, process.env.VITE_DEV_SERVER_URL || null, { onOpenMain: () => showWindow() })
    createTray()
    // 全局快捷键（设置里可换）
    applyGlobalShortcut(store.getData().settings?.quickShortcut || 'Control+Shift+Space')
    ipcMain.handle('quick:add', (_e, payload) => {
      const doc = store.getData()
      const now = Date.now()
      // /清单语法：按名匹配，不存在则新建（渲染层传 listName；公开核心版不传该字段，逻辑惰性）
      let listId = payload.listId || (doc.lists.filter(l => !l.deletedAt).sort((a, b) => a.order - b.order)[0] || {}).id || null
      if (!payload.listId && payload.listName) {
        const l = doc.lists.find(l => !l.deletedAt && l.name === payload.listName)
        if (l) listId = l.id
        else {
          const nl = { id: 'l-' + now.toString(36) + Math.random().toString(36).slice(2, 6), name: String(payload.listName), color: '#2EA7E0', order: doc.lists.filter(x => !x.deletedAt).length, createdAt: now, updatedAt: now, deletedAt: null }
          doc.lists.push(nl)
          listId = nl.id
        }
      }
      const t = {
        id: 't-' + now.toString(36) + Math.random().toString(36).slice(2, 6),
        title: String(payload.title || '').trim(),
        note: '', listId,
        dueDate: payload.dueDate || null, dueTime: payload.dueTime || null,
        priority: 0,
        tags: (payload.tags || []).map(x => String(x).trim()).filter(Boolean),
        repeat: payload.repeat ? JSON.parse(JSON.stringify(payload.repeat)) : null,
        completed: false, completedAt: null, reminderMinutes: null, subtasks: [], hasImage: false,
        createdAt: now, updatedAt: now, deletedAt: null
      }
      if (!t.title) return { ok: false }
      doc.tasks.push(t)
      store.setData(doc)
      store.saveNow(doc)
      broadcast('data:changed', doc)
      return { ok: true }
    })
    ipcMain.on('quick:hide', () => { if (quickWin && !quickWin.isDestroyed()) quickWin.hide() })
    // 启动后 3 秒做一次启动同步
    setTimeout(() => doSync('startup'), 3000)
    // 运行中每 2 小时自动同步一次（Sprint 17 同步策略）
    setInterval(() => { if (syncEnabled() && !quitting) doSync('interval') }, 2 * 60 * 60 * 1000)

    if (process.env.ELECTRON_SMOKE) {
      setTimeout(async () => {
        const fsx = require('fs')
        try {
          const r = await win.webContents.executeJavaScript(`
            (async () => {
              const appEl = document.querySelector('#app')
              if (!appEl || !appEl.__vue_app__) return 'NO_VUE_APP'
              const s = appEl.__vue_app__.config.globalProperties.$pinia._s.get('data')
              if (!s) return 'NO_STORE'
              await s.init()
              const diag = {
                api: !!window.api,
                lists: s.lists.length,
                tasks: s.tasks.length,
                navChildren: document.querySelector('.sidebar .nav')?.children.length,
                taskRows: document.querySelectorAll('.task').length,
                view: s.viewMode
              }
              console.warn('DIAG ' + JSON.stringify(diag))
              // WebDAV 同步端到端：ELECTRON_SMOKE_SYNC_URL 提供本地伪服务器地址
              const syncUrl = ${JSON.stringify(process.env.ELECTRON_SMOKE_SYNC_URL || '')}
              if (syncUrl) {
                await window.api.webdav.save({
                  url: syncUrl,
                  username: 'tester', password: 'testpass', enabled: true
                })
                await window.api.syncNow()
                await new Promise(r2 => setTimeout(r2, 500))
                return 'SYNC=' + JSON.stringify(s.syncState)
              }
              return 'OK'
            })()
          `)
          console.log('PROBE', r)
          const img = await win.webContents.capturePage()
          fsx.writeFileSync(process.env.ELECTRON_SMOKE, img.toPNG())
          console.log('SMOKE_OK')
          // 托盘/后台定时器可能挂起退出流程，冒烟模式 3 秒后强制退出
          setTimeout(() => app.exit(0), 3000)
          // 多页面截图：ELECTRON_SMOKE_PAGES=输出目录（写标记+刷新，保证首帧即目标页）
          if (process.env.ELECTRON_SMOKE_PAGES) {
            const dir = process.env.ELECTRON_SMOKE_PAGES
            fsx.mkdirSync(dir, { recursive: true })
            for (const page of ['pomodoro', 'habit', 'settings']) {
              await win.webContents.executeJavaScript(`localStorage.setItem('tm.page', '${page}')`)
              await new Promise(r2 => setTimeout(r2, 150))
              win.webContents.reload()
              await new Promise(r2 => setTimeout(r2, 1500))
              const img2 = await win.webContents.capturePage()
              fsx.writeFileSync(path.join(dir, page + '.png'), img2.toPNG())
              console.log('PAGE_SHOT', page)
            }
            await win.webContents.executeJavaScript(`localStorage.removeItem('tm.page')`)
          }
        } catch (err) {
          console.error('SMOKE_FAIL', err.message)
        }
        app.quit()
      }, 2500)
    }
  })
}
