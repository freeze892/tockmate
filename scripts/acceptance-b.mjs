/**
 * TickMate v1.0 自验收 · B 段（番茄钟完整循环 + 到期提醒实弹）
 */
import { chromium } from 'playwright'
import { execSync } from 'node:child_process'
import fs from 'node:fs'

const OUT = '.acceptance'
fs.mkdirSync(OUT, { recursive: true })
const shot = (page, name) => page.screenshot({ path: `${OUT}/${name}.png` })
const results = []
const ok = (name, cond, detail = '') => {
  results.push(`${cond ? 'PASS' : 'FAIL'} ${name}${detail ? ' —— ' + detail : ''}`)
  console.log(`${cond ? 'PASS' : 'FAIL'} ${name} ${detail}`)
}

const browser = await chromium.connectOverCDP('http://127.0.0.1:9222')
const page = await browser.contexts()[0].pages()[0]

// ── 1. 设置专注时长 25 → 5 分钟 ──
await page.locator('.nav-item', { hasText: '设置' }).click()
await page.waitForSelector('.stepper', { timeout: 3000 })
const focusRow = page.locator('.card', { hasText: '专注时长' }).first().locator('.row').first()
for (let i = 0; i < 20; i++) {
  await focusRow.locator('.ud').nth(1).click()
}
await page.waitForTimeout(200)
const focusVal = await focusRow.locator('.val').textContent()
ok('B1 专注时长调至 5 分钟', focusVal.trim().startsWith('5'), focusVal.trim())

// ── 2. 开始专注 / 暂停 / 继续 ──
await page.locator('.nav-item', { hasText: '番茄专注' }).click()
await page.waitForSelector('.btn.primary.big', { timeout: 3000 })
await page.locator('.btn.primary.big', { hasText: '开始专注' }).click()
await page.waitForTimeout(1500)
let chip = await page.locator('.state-chip').textContent()
let timer = await page.locator('.timer').textContent()
ok('B2 开始专注（专注中 + 计时走动）', chip.includes('专注中') && timer !== '05:00', `chip=${chip.trim()} timer=${timer}`)

await page.locator('.btn.primary.big', { hasText: '暂停' }).click()
await page.waitForTimeout(600)
chip = await page.locator('.state-chip').textContent()
ok('B3 暂停 → 已暂停', chip.includes('已暂停'))
const pausedTimer = await page.locator('.timer').textContent()
await page.waitForTimeout(1200)
ok('B4 暂停时计时冻结', (await page.locator('.timer').textContent()) === pausedTimer)

await page.locator('.btn.primary.big', { hasText: '继续' }).click()
await page.waitForTimeout(600)
ok('B5 继续 → 专注中', (await page.locator('.state-chip').textContent()).includes('专注中'))
await shot(page, '09-番茄运行中')

// ── 3. 到期提醒：今天 +3 分钟、准时提醒 ──
const fire = new Date(Date.now() + 3 * 60000)
const hhmm = `${String(fire.getHours()).padStart(2, '0')}:${String(fire.getMinutes()).padStart(2, '0')}`
await page.locator('.nav-item', { hasText: '今天' }).first().click()
await page.waitForSelector('.qa-input', { timeout: 3000 })
await page.locator('.qa-input').click()
await page.keyboard.type(`今天 ${hhmm} 喝水提醒测试`)
await page.keyboard.press('Enter')
await page.waitForTimeout(400)
const row = page.locator('.task', { hasText: '喝水提醒测试' })
await row.click()
await page.waitForSelector('.detail-title', { timeout: 3000 })
await page.locator('.field', { hasText: '提醒' }).locator('select').selectOption('0')
await page.waitForTimeout(300)
const chipText = await page.locator('.field', { hasText: '提醒' }).locator('select option:checked').textContent()
ok('B6 提醒任务已建（准时提醒）', chipText.includes('准时'), `${hhmm} · ${chipText}`)
await shot(page, '10-提醒任务')

// ── 4. 等待番茄走完（约 5 分钟）→ 自动进入短休息 ──
console.log('等待番茄完成（约 5 分钟）…')
await page.waitForTimeout(315000)
chip = await page.locator('.state-chip').textContent()
ok('B7 专注完成自动进入短休息', chip.includes('短休息'), chip.trim())
await shot(page, '11-短休息')

// 今日统计 +1
await page.locator('.nav-item', { hasText: '今天' }).first().click()
await page.locator('.nav-item', { hasText: '番茄专注' }).click()
await page.waitForTimeout(500)
const pomo = await page.locator('.stat').first().textContent()
const minutes = await page.locator('.stat').nth(1).textContent()
ok('B8 今日番茄 1 个 / 专注 5 分钟', pomo.includes('1') && minutes.includes('5'), `${pomo} ${minutes}`)
ok('B9 今日记录新增一条', (await page.locator('.log-row').count()) >= 1)
await shot(page, '12-番茄完成统计')

// 跳过休息 → 放弃
await page.locator('.btn.ghost.big', { hasText: '跳过休息' }).click()
await page.waitForTimeout(500)
await page.locator('.btn.ghost.big', { hasText: '放弃' }).click()
await page.waitForTimeout(500)
ok('B10 跳过休息+放弃 → 空闲', (await page.locator('.state-chip').textContent()).includes('准备开始'))

// ── 5. 提醒通知实弹：到点全屏截图抓 Windows 通知 ──
const waitMs = fire.getTime() - Date.now() + 12000
if (waitMs > 0) {
  console.log(`等待提醒到点（${Math.ceil(waitMs / 1000)} 秒）…`)
  await page.waitForTimeout(waitMs)
}
execSync(`powershell -NoProfile -Command "Add-Type -AssemblyName System.Windows.Forms,System.Drawing; $b=[System.Windows.Forms.SystemInformation]::VirtualScreen; $bmp=New-Object Drawing.Bitmap $b.Width,$b.Height; $g=[Drawing.Graphics]::FromImage($bmp); $g.CopyFromScreen($b.Left,$b.Top,0,0,$bmp.Size); $bmp.Save('${OUT}/13-通知截图.png')"`)
ok('B11 通知时刻全屏截图已保存', fs.existsSync(`${OUT}/13-通知截图.png`))

fs.writeFileSync(`${OUT}/results-B.txt`, results.join('\n'))
console.log('---B 段完成---')
await browser.close()
