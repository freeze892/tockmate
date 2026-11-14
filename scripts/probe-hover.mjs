import { chromium } from 'playwright'
const b = await chromium.connectOverCDP('http://127.0.0.1:9222', { timeout: 8000 })
const w = b.contexts()[0].pages().find(p => p.url().includes('#widget'))
w.setDefaultTimeout(5000)

// 1) 直接调主进程 dockExpand —— 验证主进程链路
const direct = await w.evaluate(async () => {
  window.api.widget.dockExpand()
  await new Promise(r => setTimeout(r, 400))
  const st = await window.api.widget.getState()
  return JSON.stringify(st)
})
console.log('DIRECT_EXPAND ' + direct)

// 2) 若展开成功，手动收回，再测 hoverBlocked 逻辑（dispatch mouseenter 前 mouseleave）
const back = await w.evaluate(async () => {
  window.api.widget.dockCollapse()
  await new Promise(r => setTimeout(r, 400))
  const st = await window.api.widget.getState()
  return JSON.stringify(st)
})
console.log('DIRECT_COLLAPSE ' + back)

// 3) mouseenter 合成事件 + 读取 hover 状态与匹配情况
const evTest = await w.evaluate(async () => {
  const el = document.querySelector('.w-strip')
  if (!el) return 'NO_STRIP'
  const before = { hover: el.matches(':hover') }
  el.dispatchEvent(new MouseEvent('mouseenter', { bubbles: false }))
  await new Promise(r => setTimeout(r, 400))
  const st = await window.api.widget.getState()
  return JSON.stringify({ before, after: st })
})
console.log('EV_TEST ' + evTest)
process.exit(0)
