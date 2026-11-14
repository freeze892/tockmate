/**
 * TickMate dev 编排器
 * 取代 concurrently 链：Windows 下 concurrently -k 杀不干净子进程树，
 * 会孤儿化 vite（占住 5173 导致后续启动"窗口闪一下就没了"）。
 * 职责：先起 vite → 就绪后起 electron → 任一方退出/出错时按进程树整组清理。
 */
const { spawn, execSync } = require('child_process')
const path = require('path')

const isWin = process.platform === 'win32'
const PORT = 5173
const DEV_URL = `http://127.0.0.1:${PORT}`

let viteProc = null
let electronProc = null
let electronStarted = false
let shuttingDown = false

function treeKill (pid) {
  if (!pid) return
  try {
    if (isWin) execSync(`taskkill /pid ${pid} /T /F`, { stdio: 'ignore' })
    else process.kill(-pid, 'SIGKILL')
  } catch { /* 进程可能已退出 */ }
}

function shutdown (code, reason) {
  if (shuttingDown) return
  shuttingDown = true
  if (reason) console.error(`[TickMate] ${reason}`)
  treeKill(viteProc && viteProc.pid)
  treeKill(electronProc && electronProc.pid)
  process.exit(code || 0)
}

process.on('SIGINT', () => shutdown(0))
process.on('SIGTERM', () => shutdown(0))
process.on('exit', () => {
  treeKill(viteProc && viteProc.pid)
  treeKill(electronProc && electronProc.pid)
})

function startElectron () {
  if (electronStarted) return
  electronStarted = true
  console.log('[TickMate] vite 就绪，启动 Electron 窗口…')
  electronProc = spawn(process.execPath, [require.resolve('electron/cli.js'), '.'], {
    stdio: 'inherit',
    env: { ...process.env, VITE_DEV_SERVER_URL: DEV_URL }
  })
  electronProc.on('exit', code => {
    if (!shuttingDown) shutdown(0, `应用窗口已关闭（exit ${code}）`)
  })
}

console.log('[TickMate] 启动 vite 开发服务器…')
const viteBin = path.join(path.dirname(require.resolve('vite/package.json')), 'bin', 'vite.js')
viteProc = spawn(process.execPath, [viteBin], {
  stdio: ['ignore', 'pipe', 'pipe'],
  windowsHide: true
})
viteProc.stdout.on('data', d => process.stdout.write(d))
viteProc.stderr.on('data', d => {
  const s = d.toString()
  process.stderr.write(s)
  if (/Port \d+ is already in use/.test(s.replace(/\x1b\[[0-9;]*m/g, ''))) {
    shutdown(1, `端口 ${PORT} 被占用——通常是上次未完全退出的 vite 残留。\n  请关闭所有旧的 npm run dev 终端窗口后重试；仍不行则在任务管理器结束所有 node.exe，或重启电脑。`)
  }
})
viteProc.on('exit', code => {
  if (!shuttingDown && !electronStarted) shutdown(code || 1, `vite 未能启动（exit ${code}）`)
})

// 就绪探测：直接轮询 HTTP 端口（比解析带 ANSI 颜色码的 stdout 可靠）
const probe = setInterval(() => {
  if (shuttingDown || electronStarted) { clearInterval(probe); return }
  require('http').get(`${DEV_URL}/`, r => { r.resume(); clearInterval(probe); startElectron() }).on('error', () => {})
}, 400)

// 兜底：vite 15 秒仍未就绪则放弃
setTimeout(() => {
  clearInterval(probe)
  if (!electronStarted && !shuttingDown) shutdown(1, `vite 启动超时（15 秒内 ${DEV_URL} 不可达）`)
}, 15000)
