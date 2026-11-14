/**
 * 贴边状态持久化重启恢复测试
 * 前置：electron 已带 CDP 启动。步骤：贴边 → 读到 dock=right → 由外部重启 electron → 复验贴边条恢复 + 悬停展开
 */
import { chromium } from 'playwright'

const phase = process.argv[2] // 'dock' | 'verify'
const b = await chromium.connectOverCDP('http://127.0.0.1:9222', { timeout: 8000 })
const w = b.contexts()[0].pages().find(p => p.url().includes('#widget'))
w.setDefaultTimeout(6000)

if (phase === 'dock') {
  const st0 = await w.evaluate(() => window.api.widget.getState())
  await w.evaluate(() => window.api.widget.setDock(true))
  await w.waitForSelector('.w-strip', { timeout: 3000 })
  const st = await w.evaluate(() => window.api.widget.getState())
  console.log(`DOCK_OK before=${JSON.stringify(st0)} after=${JSON.stringify(st)}`)
  process.exit(st.dock === 'right' && st.expanded === false ? 0 : 1)
}

if (phase === 'verify') {
  // 重启后：应直接以收起条启动（createWidget 贴边分支）
  for (let i = 0; i < 40; i++) {
    const has = await w.locator('.w-strip').count().catch(() => 0)
    if (has) break
    await new Promise(r => setTimeout(r, 250))
  }
  const hasStrip = await w.locator('.w-strip').count()
  const st = await w.evaluate(() => window.api.widget.getState())
  console.log(`RESTART_STRIP hasStrip=${hasStrip} state=${JSON.stringify(st)}`)
  if (!hasStrip || st.dock !== 'right' || st.expanded !== false) process.exit(1)
  // 悬停展开仍可用
  await w.mouse.move(4, 200)
  await w.waitForTimeout(500)
  const st2 = await w.evaluate(() => window.api.widget.getState())
  console.log(`RESTART_HOVER ${JSON.stringify(st2)}`)
  // 收回 + 取消贴边，恢复自由态收尾
  await w.evaluate(() => document.querySelector('.widget').dispatchEvent(new MouseEvent('mouseleave')))
  await w.waitForSelector('.w-strip', { timeout: 5000 })
  await w.evaluate(() => window.api.widget.setDock(false))
  await w.waitForTimeout(500)
  const st3 = await w.evaluate(() => window.api.widget.getState())
  console.log(`RESTART_UNDOCK ${JSON.stringify(st3)}`)
  process.exit(st2.expanded === true && st3.dock === null ? 0 : 1)
}
console.log('usage: node restart-dock-test.mjs dock|verify')
process.exit(1)
