/**
 * TickMate v1.6 悬浮窗增强 · GUI 自验收（dev 版）
 * 前置：vite(5173) + electron(--remote-debugging-port=9222) 已启动
 * 覆盖：渲染 / 快加(今天+自然语言) / 双窗同步 / 置顶 / 贴边收进+悬停展开+移开收回 / 取消贴边 / 双击开主界面 / 持久化
 */
import { chromium } from 'playwright'
import fs from 'node:fs'

const OUT = '.acceptance'
fs.mkdirSync(OUT, { recursive: true })
const results = []
const ok = (name, cond, detail = '') => {
  results.push({ name, pass: !!cond, detail })
  console.log(`${cond ? 'PASS' : 'FAIL'} ${name}${detail ? ' —— ' + detail : ''}`)
}
const errors = []
const benign = /favicon|Autofill|DevTools|extensions/i

const browser = await chromium.connectOverCDP('http://127.0.0.1:9222')
const ctx = browser.contexts()[0]

let pages = []
for (let i = 0; i < 60; i++) {
  pages = ctx.pages()
  const hasW = pages.some(p => p.url().includes('#widget'))
  const hasM = pages.some(p => !p.url().includes('#widget') && !p.url().includes('#quick'))
  if (hasW && hasM) break
  await new Promise(r => setTimeout(r, 250))
}
const widget = pages.find(p => p.url().includes('#widget'))
const main = pages.find(p => !p.url().includes('#widget') && !p.url().includes('#quick'))
if (!widget || !main) {
  console.log('FAIL 未找到窗口目标 pages=' + pages.map(p => p.url()).join(' | '))
  process.exit(1)
}
for (const p of [widget, main]) {
  p.on('pageerror', e => errors.push(`pageerror: ${e.message}`))
  p.on('console', m => { if (m.type() === 'error' && !benign.test(m.text())) errors.push(`console.error: ${m.text().slice(0, 200)}`) })
}

// 前置复位：若上次会话留下贴边态，先取消贴边回到自由窗口
{
  const st0 = await widget.evaluate(() => window.api.widget.getState())
  if (st0.dock) {
    await widget.evaluate(() => window.api.widget.setDock(false))
    await new Promise(r => setTimeout(r, 700))
    console.log('(前置) 已从贴边态复位为自由窗口')
  }
}

const getState = () => widget.evaluate(() => window.api.widget.getState())
const getTasks = (page) => page.evaluate(() => {
  const appEl = document.querySelector('#app')
  const s = appEl && appEl.__vue_app__ && appEl.__vue_app__.config.globalProperties.$pinia._s.get('data')
  return s ? s.tasks.filter(t => !t.deletedAt).map(t => ({ title: t.title, dueDate: t.dueDate, dueTime: t.dueTime })) : null
})
const localDate = (offset = 0) => {
  const d = new Date(); d.setDate(d.getDate() + offset)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// ── P1 悬浮窗渲染（无白板）────────────────────────────────────────
await widget.waitForSelector('.widget', { timeout: 6000 })
const headTitle = await widget.textContent('.w-title')
ok('P1a 悬浮窗渲染（标题含周几）', /周[一二三四五六日天]/.test(headTitle || ''), headTitle || '空')
const hasQuick = await widget.locator('.wq-input').count()
ok('P1b 快加输入行存在', hasQuick === 1)
const btnTitles = await widget.locator('.w-btn').evaluateAll(els => els.map(e => e.title))
ok('P1c 标题栏四按钮（置顶/贴边/主界面/隐藏）', ['取消置顶', '贴边收进', '打开主界面', '隐藏悬浮窗'].every(t => btnTitles.includes(t)), btnTitles.join(','))

// ── P2 快加今天事项 + 双窗同步 ───────────────────────────────────
await widget.fill('.wq-input', '买牛奶')
await widget.press('.wq-input', 'Enter')
await widget.waitForSelector('.w-task:has-text("买牛奶")', { timeout: 3000 })
ok('P2a 快加后出现在悬浮窗列表', true)
const wTasks = await getTasks(widget)
const milk = (wTasks || []).find(t => t.title === '买牛奶')
ok('P2b 入库 dueDate=今天', !!milk && milk.dueDate === localDate(0), JSON.stringify(milk))
try {
  await main.waitForFunction(() => {
    const appEl = document.querySelector('#app')
    const s = appEl && appEl.__vue_app__ && appEl.__vue_app__.config.globalProperties.$pinia._s.get('data')
    return s && s.tasks.some(t => t.title === '买牛奶' && !t.deletedAt)
  }, { timeout: 4000 })
  ok('P2c 主界面实时同步收到（broadcast 修复生效）', true)
} catch { ok('P2c 主界面实时同步收到（broadcast 修复生效）', false) }

// ── P3 自然语言解析（明天 09:00 → 不出现在今日列表）────────────────
await widget.fill('.wq-input', '明天 09:00 交周报')
const hint = await widget.textContent('.w-parse').catch(() => '')
ok('P3a 解析提示展示', /明天|周/.test(hint || ''), (hint || '').trim())
await widget.press('.wq-input', 'Enter')
await widget.waitForTimeout(300)
const wTasks2 = await getTasks(widget)
const weekly = (wTasks2 || []).find(t => t.title === '交周报')
ok('P3b 入库 dueDate=明天 09:00', !!weekly && weekly.dueDate === localDate(1) && weekly.dueTime === '09:00', JSON.stringify(weekly))
const inList = await widget.locator('.w-task:has-text("交周报")').count()
ok('P3c 明天任务不进今日列表', inList === 0)

// ── P4 置顶开关 ─────────────────────────────────────────────────
await widget.click('.w-btn[title="取消置顶"]')
await widget.waitForTimeout(250)
let st = await getState()
ok('P4a 取消置顶 → pinned=false', st.pinned === false, JSON.stringify(st))
await widget.click('.w-btn[title="固定在最前"]')
await widget.waitForTimeout(250)
st = await getState()
ok('P4b 重新置顶 → pinned=true', st.pinned === true, JSON.stringify(st))

// ── P5 贴边收进 → 悬停展开 → 移开收回 ────────────────────────────
await widget.click('.w-btn[title="贴边收进"]')
await widget.waitForSelector('.w-strip', { timeout: 3000 })
st = await getState()
ok('P5a 贴边后 dock=right expanded=false', st.dock === 'right' && st.expanded === false, JSON.stringify(st))
await widget.screenshot({ path: `${OUT}/w-strip.png` })

await widget.mouse.move(8, 210)
await widget.waitForTimeout(450)
st = await getState()
ok('P5b 悬停导航条 → 展开', st.expanded === true, JSON.stringify(st))
await widget.waitForSelector('.widget', { timeout: 2000 })
ok('P5c 展开后完整视图回归', true)

await widget.evaluate(() => document.querySelector('.widget').dispatchEvent(new MouseEvent('mouseleave')))
await widget.waitForSelector('.w-strip', { timeout: 5000 })
st = await getState()
ok('P5d 移开 0.9s 后收回导航条', st.expanded === false, JSON.stringify(st))

// 再次悬停可再展开（循环稳定性）
await widget.mouse.move(8, 210)
await widget.waitForTimeout(450)
st = await getState()
ok('P5e 再次悬停可再展开', st.expanded === true, JSON.stringify(st))

// ── P6 取消贴边 ────────────────────────────────────────────────
await widget.click('.w-btn[title="取消贴边"]')
await widget.waitForSelector('.widget', { timeout: 3000 })
await widget.waitForTimeout(400)
st = await getState()
ok('P6 取消贴边 → dock=null 完整视图', st.dock === null && st.expanded === false, JSON.stringify(st))

// ── P7 双击开主界面（绑定修复）──────────────────────────────────
await widget.locator('.w-head').dblclick()
await widget.waitForTimeout(400)
ok('P7 双击开主界面调用无异常', true, '真实窗口置前需人工确认')

// ── P8 状态持久化 ──────────────────────────────────────────────
await widget.waitForTimeout(600)
try {
  const saved = JSON.parse(fs.readFileSync(process.env.APPDATA + '/TockMate/widget-pos.json', 'utf8'))
  ok('P8 状态持久化（pinned/fullW 落盘）', saved.pinned === true && saved.fullW >= 240 && saved.dock === null, JSON.stringify(saved))
} catch (e) {
  ok('P8 状态持久化（pinned/fullW 落盘）', false, String(e).slice(0, 120))
}

// ── P9 主界面完好（无白板/无报错）───────────────────────────────
await main.waitForSelector('.shell, .body, .nav', { timeout: 4000 })
ok('P9 主界面结构完好', true)

await widget.screenshot({ path: `${OUT}/w-final.png` })
await main.screenshot({ path: `${OUT}/m-final.png` })

const fails = results.filter(r => !r.pass)
console.log(`\n===== 悬浮窗自验收：${results.length - fails.length}/${results.length} 通过 =====`)
if (errors.length) console.log('页面报错：\n' + errors.join('\n'))
process.exit(fails.length || errors.length ? 1 : 0)
