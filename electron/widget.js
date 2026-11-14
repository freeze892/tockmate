/**
 * 桌面迷你悬浮窗（今日待办）
 * 无边框 / 可切换置顶 / 可拖动 / 记住位置
 * 贴边收进：开启后吸附屏幕左/右缘只留导航条，悬停展开，移开收回；拖离边缘自动取消贴边
 */
const { BrowserWindow, screen, ipcMain } = require('electron')
const path = require('path')
const fs = require('fs')
const geo = require('./widget-geometry')

let widgetWin = null
// state 持久化字段：x/y（自由位置）、pinned、dock（null|'left'|'right'）、fullW/fullH（展开尺寸）
let state = { x: null, y: null, pinned: true, dock: null, expanded: false, fullW: 300, fullH: 420 }
let selfMoveUntil = 0 // 程序化动画期间忽略 moved 事件
let animating = false
let openMainHandler = null
let userDataDir = null

function stateFile () { return path.join(userDataDir, 'widget-pos.json') }

function loadState () {
  try {
    const p = JSON.parse(fs.readFileSync(stateFile(), 'utf8'))
    if (typeof p.x === 'number' && typeof p.y === 'number') return p
  } catch { /* 首次无文件 */ }
  return null
}

function persistState () {
  if (!userDataDir) return
  try {
    fs.writeFileSync(stateFile(), JSON.stringify(state))
  } catch (err) {
    console.error('[widget] 状态落盘失败:', String(err && err.message || err))
  }
}

function getWidget () { return widgetWin && !widgetWin.isDestroyed() ? widgetWin : null }

function workArea () { return screen.getPrimaryDisplay().workArea }

function notifyDock () {
  const w = getWidget()
  if (w) w.webContents.send('widget:dock-state', { dock: state.dock, expanded: state.expanded, pinned: state.pinned })
}

function targetBounds () {
  const w = getWidget()
  if (!w) return null
  const wa = workArea()
  if (!state.dock) return geo.freeBounds(state.x, state.y, state.fullW, state.fullH)
  const cur = w.getBounds()
  return geo.dockBounds(state.dock, wa, cur.y, state.expanded, state.fullW, state.fullH)
}

const ANIM_MS = 120
// 缓动滑动到目标 bounds（时间驱动，抗定时器节流；防护窗覆盖到防抖结束）
function animateTo (target, done) {
  const w = getWidget()
  if (!w || !target) { if (done) done(); return }
  const from = w.getBounds()
  const same = from.x === target.x && from.y === target.y && from.width === target.width && from.height === target.height
  if (same) { if (done) done(); return }
  animating = true
  const start = Date.now()
  selfMoveUntil = start + ANIM_MS + 600 // 覆盖动画全程 + 'moved' 防抖 220ms + 余量
  const timer = setInterval(() => {
    const win2 = getWidget()
    if (!win2) { clearInterval(timer); animating = false; return }
    const t = Math.min((Date.now() - start) / ANIM_MS, 1)
    const ease = 1 - Math.pow(1 - t, 2)
    win2.setBounds({
      x: Math.round(from.x + (target.x - from.x) * ease),
      y: Math.round(from.y + (target.y - from.y) * ease),
      width: Math.round(from.width + (target.width - from.width) * ease),
      height: Math.round(from.height + (target.height - from.height) * ease)
    })
    if (t >= 1) { clearInterval(timer); animating = false; if (done) done() }
  }, 16)
}

// 收起条细边摆位：Windows 会把窄窗口钳制到更大宽度且保持中心，
// 直接以「可见宽 = STRIP_VISIBLE」+ 实测宽度重新定 x，把多余部分移出屏幕外
function correctStripPosition () {
  const w = getWidget()
  if (!w || !state.dock || state.expanded) return
  const wa = workArea()
  let b = w.getBounds()
  w.setBounds({ x: geo.stripTargetX(state.dock, wa, b.width), y: b.y, width: b.width, height: b.height })
  b = w.getBounds()
  const vis = geo.visibleWidth(state.dock, wa, b)
  if (Math.abs(vis - geo.STRIP_VISIBLE) > 2) {
    // 钳制方向异常时按实测差值二次微调
    const delta = vis - geo.STRIP_VISIBLE
    w.setBounds({ x: state.dock === 'right' ? b.x - delta : b.x + delta, y: b.y, width: b.width, height: b.height })
  }
}

function applyDockUI () {
  const w = getWidget()
  if (!w) return
  w.setResizable(!state.dock || state.expanded) // 收起条状态禁止用户拉伸
  notifyDock()
  animateTo(targetBounds(), () => {
    if (state.dock && !state.expanded) correctStripPosition()
  })
  persistState()
}

function setPinned (flag) {
  state.pinned = !!flag
  const w = getWidget()
  if (w) state.pinned ? w.setAlwaysOnTop(true, 'screen-saver') : w.setAlwaysOnTop(false)
  persistState()
  return state.pinned
}

function setDock (on) {
  const w = getWidget()
  if (!w) return state
  if (on && !state.dock) {
    const b = w.getBounds()
    state.fullW = b.width
    state.fullH = b.height
    state.dock = geo.nearestDockSide(b, workArea())
    state.expanded = false
  } else if (!on && state.dock) {
    // 取消贴边：在当前贴边处展开为自由窗口
    const wa = workArea()
    state.x = state.dock === 'right' ? wa.x + wa.width - state.fullW : wa.x
    state.y = w.getBounds().y
    state.dock = null
    state.expanded = false
  }
  applyDockUI()
  return { dock: state.dock, expanded: state.expanded }
}

function dockExpand () {
  if (!state.dock || state.expanded) return
  state.expanded = true
  applyDockUI()
}

function dockCollapse () {
  if (!state.dock || !state.expanded) return
  state.expanded = false
  applyDockUI()
}

// 用户拖动/缩放结束（防抖后）：自由模式记忆位置；贴边模式换边吸附或拖离取消
function onMovedOrResized () {
  const w = getWidget()
  if (!w || animating || Date.now() < selfMoveUntil) return
  const b = w.getBounds()
  if (!state.dock) {
    if (b.width >= 240) { state.fullW = b.width; state.fullH = b.height } // 自由窗口缩放记忆
    state.x = b.x
    state.y = b.y
    persistState()
    return
  }
  const verdict = geo.decideAfterMove(b, workArea())
  if (verdict.undock) {
    const wa = workArea()
    console.log('[widget] ' + new Date().toISOString().slice(11, 19) + ' 拖离边缘取消贴边 ' +
      JSON.stringify({ b: { x: b.x, y: b.y, w: b.width }, distL: b.x - wa.x, distR: wa.x + wa.width - (b.x + b.width) }))
    state.dock = null
    state.expanded = false
    state.x = b.x
    state.y = b.y
    w.setResizable(true)
    notifyDock()
    persistState()
  } else {
    const changed = verdict.side !== state.dock
    state.dock = verdict.side
    if (b.width >= 240) { state.fullW = b.width; state.fullH = b.height } // 防止把钳制后的 32px 收起条误记为展开尺寸
    state.y = b.y
    persistState()
    if (changed) { notifyDock(); animateTo(targetBounds()) }
  }
}

function createWidget (parentApp, devUrl, handlers = {}) {
  userDataDir = parentApp.getPath('userData')
  openMainHandler = handlers.onOpenMain || null
  const saved = loadState()
  const wa = workArea()
  if (saved) {
    state = {
      x: saved.x, y: saved.y,
      pinned: saved.pinned !== false,
      dock: (saved.dock === 'left' || saved.dock === 'right') ? saved.dock : null,
      expanded: false,
      fullW: typeof saved.fullW === 'number' && saved.fullW >= 240 ? saved.fullW : 300,
      fullH: typeof saved.fullH === 'number' && saved.fullH >= 260 ? saved.fullH : 420
    }
  } else {
    state = { x: wa.x + wa.width - 320, y: wa.y + 120, pinned: true, dock: null, expanded: false, fullW: 300, fullH: 420 }
  }

  const opts = {
    width: state.fullW,
    height: state.fullH,
    minWidth: 240,
    minHeight: 260,
    frame: false,
    transparent: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: true,
    show: false,
    backgroundColor: '#F7F7F8',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  }
  if (state.dock) {
    // 以收起条尺寸贴边启动（y 钳制在可视区内，防换分辨率后丢失）
    opts.width = geo.STRIP_W
    opts.resizable = false
    opts.x = state.dock === 'right' ? wa.x + wa.width - geo.STRIP_W : wa.x
    opts.y = Math.min(Math.max(state.y, wa.y), wa.y + wa.height - 120)
  } else {
    const c = geo.clampPosition(state.x, state.y, state.fullW, wa)
    if (c.clamped) console.log('[widget] 位置越界，已复位')
    state.x = c.x
    state.y = c.y
    opts.x = state.x
    opts.y = state.y
  }
  widgetWin = new BrowserWindow(opts)
  // 导航锁：悬浮窗只允许自有页面；新窗口一律拒绝（外链不属于悬浮窗场景）
  {
    const allowPrefix = devUrl || 'file://'
    widgetWin.webContents.on('will-navigate', (e, url) => {
      if (!url.startsWith(allowPrefix)) e.preventDefault()
    })
    widgetWin.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  }

  const load = devUrl ? widgetWin.loadURL(devUrl + '#widget') : widgetWin.loadFile(path.join(__dirname, '..', 'dist', 'index.html'), { hash: 'widget' })
  load.then(() => {
    widgetWin.show()
    if (state.pinned) widgetWin.setAlwaysOnTop(true, 'screen-saver')
    if (state.dock) correctStripPosition() // 启动即贴边：按钳制后实际宽度摆位
    notifyDock()
    console.log('[widget] 已创建 dock=' + (state.dock || '无') + ' pinned=' + state.pinned)
  }).catch(() => {})

  let moveTimer = null
  const trackMoved = () => {
    if (moveTimer) clearTimeout(moveTimer)
    moveTimer = setTimeout(onMovedOrResized, 220)
  }
  widgetWin.on('moved', trackMoved)
  widgetWin.on('resize', trackMoved)
  widgetWin.on('closed', () => { widgetWin = null })

  // 显示器变化（拔显示器/改分辨率）：贴边重新吸附，自由位置越界复位
  screen.on('display-metrics-changed', () => {
    const win2 = getWidget()
    if (!win2) return
    if (state.dock) applyDockUI()
    else {
      const b = win2.getBounds()
      const c = geo.clampPosition(b.x, b.y, b.width, workArea())
      if (c.clamped) { state.x = c.x; state.y = c.y; animateTo(targetBounds()) }
    }
  })
  return widgetWin
}

function showWidget () {
  const w = getWidget()
  if (!w) return false
  if (w.isMinimized()) w.restore()
  w.show()
  return true
}

function hideWidget () {
  const w = getWidget()
  if (w && w.isVisible()) { w.hide(); return true }
  return false
}

function toggleWidget () {
  const w = getWidget()
  if (!w) return false
  return w.isVisible() ? hideWidget() : showWidget()
}

function closeWidget () {
  const w = getWidget()
  if (w) w.close()
}

// ── IPC ──────────────────────────────────────────────────────────
ipcMain.handle('widget:toggle', () => toggleWidget())
ipcMain.handle('widget:show', () => showWidget())
ipcMain.on('widget:hide', () => hideWidget())
ipcMain.on('widget:open-main', () => {
  if (openMainHandler) openMainHandler()
  else console.log('[widget] open-main 未绑定（应由 main.js 注入）')
})
ipcMain.handle('widget:get-state', () => ({ dock: state.dock, expanded: state.expanded, pinned: state.pinned }))
ipcMain.handle('widget:set-pin', (_e, flag) => setPinned(flag))
ipcMain.handle('widget:set-dock', (_e, on) => setDock(!!on))
ipcMain.on('widget:dock-expand', () => dockExpand())
ipcMain.on('widget:dock-collapse', () => dockCollapse())

module.exports = { createWidget, getWidget, showWidget, hideWidget, toggleWidget, closeWidget }
