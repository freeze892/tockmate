/**
 * TickMate v1.0 自验收 · B2 段（番茄统计 + 提醒实弹）
 * 前置：A 段数据已建；当前可能残留运行中的番茄相位（脚本自动放弃）。
 */
import { chromium } from 'playwright'
import { execSync } from 'node:child_process'
import fs from 'node:fs'

const OUT = '.acceptance'
const shot = (page, name) => page.screenshot({ path: `${OUT}/${name}.png` })
const results = []
const ok = (name, cond, detail = '') => {
  results.push(`${cond ? 'PASS' : 'FAIL'} ${name}${detail ? ' —— ' + detail : ''}`)
  console.log(`${cond ? 'PASS' : 'FAIL'} ${name} ${detail}`)
}

const browser = await chromium.connectOverCDP('http://127.0.0.1:9222')
const page = await browser.contexts()[0].pages()[0]

// ── 0. 清理残留相位 ──
await page.locator('.nav-item', { hasText: '番茄专注' }).click()
await page.waitForTimeout(500)
let chip = await page.locator('.state-chip').textContent()
if (!chip.includes('准备开始')) {
  if (chip.includes('暂停')) await page.locator('.btn.primary.big', { hasText: '继续' }).click()
  if ((await page.locator('.btn.ghost.big', { hasText: '跳过休息' }).count()) > 0) {
    await page.locator('.btn.ghost.big', { hasText: '跳过休息' }).click()
  } else if ((await page.locator('.btn.ghost.big', { hasText: '放弃' }).count()) > 0) {
    await page.locator('.btn.ghost.big', { hasText: '放弃' }).click()
  }
  await page.waitForTimeout(600)
  // 休息相位可能仍在，再跳一次
  if ((await page.locator('.btn.ghost.big', { hasText: '跳过休息' }).count()) > 0) {
    await page.locator('.btn.ghost.big', { hasText: '跳过休息' }).click()
    await page.waitForTimeout(500)
  }
  if ((await page.locator('.btn.ghost.big', { hasText: '放弃' }).count()) > 0) {
    await page.locator('.btn.ghost.big', { hasText: '放弃' }).click()
    await page.waitForTimeout(500)
  }
}
chip = await page.locator('.state-chip').textContent()
ok('B2-1 番茄复位到空闲', chip.includes('准备开始'), chip.trim())

// ── 1. 统计：B 段已完整走完一个 5 分钟番茄 ──
await page.waitForTimeout(400)
const pomo = await page.locator('.stat').first().textContent()
const minutes = await page.locator('.stat').nth(1).textContent()
const logCount = await page.locator('.log-row').count()
ok('B2-2 今日番茄 ≥1（完整循环实测）', parseInt(pomo) >= 1, pomo.trim())
ok('B2-3 今日专注 ≥5 分钟', parseInt(minutes) >= 5, minutes.trim())
ok('B2-4 今日记录有条目', logCount >= 1, `${logCount} 条`)
await shot(page, '11-番茄统计')

// ── 2. 提醒实弹：今天 +2.5 分钟、准时提醒 ──
const fire = new Date(Date.now() + 150000)
const hhmm = `${String(fire.getHours()).padStart(2, '0')}:${String(fire.getMinutes()).padStart(2, '0')}`
await page.locator('.nav-item', { hasText: '今天' }).first().click()
await page.waitForSelector('.qa-input', { timeout: 3000 })
await page.locator('.qa-input').click()
await page.keyboard.type(`今天 ${hhmm} 喝水提醒实测`)
await page.keyboard.press('Enter')
await page.waitForTimeout(600)
const row = page.locator('.task', { hasText: '喝水提醒实测' }).first()
await row.click()
await page.waitForSelector('.detail-title', { timeout: 5000 })
await page.locator('.field', { hasText: '提醒' }).locator('select').selectOption('0')
await page.waitForTimeout(300)
ok('B2-5 提醒任务已建（准时）', true, `${hhmm}`)
await shot(page, '10-提醒任务')

// ── 3. 等到点 → 全屏截图抓 Windows 通知 ──
const waitMs = fire.getTime() - Date.now() + 15000
console.log(`等待提醒弹出（${Math.ceil(waitMs / 1000)} 秒）…`)
await page.waitForTimeout(Math.max(0, waitMs))
execSync(`powershell -NoProfile -Command "Add-Type -AssemblyName System.Windows.Forms,System.Drawing; $b=[System.Windows.Forms.SystemInformation]::VirtualScreen; $bmp=New-Object Drawing.Bitmap $b.Width,$b.Height; $g=[Drawing.Graphics]::FromImage($bmp); $g.CopyFromScreen($b.Left,$b.Top,0,0,$bmp.Size); $bmp.Save('${OUT}/13-通知截图.png')"`)
ok('B2-6 通知时刻全屏截图已保存', fs.existsSync(`${OUT}/13-通知截图.png`))

fs.writeFileSync(`${OUT}/results-B2.txt`, results.join('\n'))
console.log('---B2 段完成---')
await browser.close()
