/**
 * TickMate v1.0 自验收 · A 段（快速操作）
 * 通过 CDP 连接正在运行的 Electron 应用，页面级真实点击/键盘操作 + 截图存证。
 */
import { chromium } from 'playwright'
import fs from 'node:fs'

const OUT = '.acceptance'
fs.mkdirSync(OUT, { recursive: true })
const shot = (page, name) => page.screenshot({ path: `${OUT}/${name}.png` })

const browser = await chromium.connectOverCDP('http://127.0.0.1:9222')
const page = await browser.contexts()[0].pages()[0]
await page.setViewportSize?.({}).catch(() => {})
const results = []
const ok = (name, cond, detail = '') => {
  results.push(`${cond ? 'PASS' : 'FAIL'} ${name}${detail ? ' —— ' + detail : ''}`)
  console.log(`${cond ? 'PASS' : 'FAIL'} ${name} ${detail}`)
}

// ── 1. 初始界面 ──
await page.waitForSelector('.sidebar', { timeout: 10000 })
ok('A1 主界面加载（侧栏+快速添加+任务列表）',
  await page.locator('.qa-input').isVisible() && await page.locator('.nav-item').count() >= 8)
await shot(page, '01-初始界面')

// ── 2. 快速添加：自然语言 → 明天视图 ──
await page.locator('.qa-input').click()
await page.keyboard.type('明天 10:00 交方案')
await page.waitForSelector('.qa-parse .tag', { timeout: 3000 })
const parsed = await page.locator('.qa-parse .tag').textContent()
ok('A2 自然语言识别日期时间', /10月29日.*10:00/.test(parsed), parsed.trim())
await shot(page, '02-快速添加识别')
await page.keyboard.press('Enter')
await page.locator('.nav-item', { hasText: '明天' }).first().click()
await page.waitForTimeout(300)
ok('A3 任务落在明天视图', await page.locator('.task .ttitle', { hasText: '交方案' }).isVisible())
await shot(page, '03-明天视图')

// ── 3. 日历：格子新建 + 胶囊 ──
await page.locator('.seg button', { hasText: '日历' }).click()
await page.waitForSelector('.grid .cell', { timeout: 3000 })
const cells = page.locator('.grid .cell:not(.dim)')
await cells.last().click() // 本月最后一个格子
await page.waitForSelector('.new-pop input', { timeout: 3000 })
await page.keyboard.type('体检')
await page.keyboard.press('Enter')
await page.waitForTimeout(300)
ok('A4 点格子新建任务 → 胶囊出现', await page.locator('.pill .n', { hasText: '体检' }).first().isVisible())
await shot(page, '04-日历格子新建')

// 胶囊勾选完成
const pill = page.locator('.pill', { hasText: '体检' }).first()
await pill.locator('.pcheck').click()
await page.waitForTimeout(200)
ok('A5 胶囊勾选完成（删除线+降透明）', await pill.evaluate(el => el.classList.contains('done')))
await shot(page, '05-胶囊勾选')

// ── 4. 详情面板：子任务/备注/优先级 ──
await page.locator('.seg button', { hasText: '列表' }).click()
await page.locator('.task .ttitle', { hasText: '交方案' }).first().click()
await page.waitForSelector('.detail-title', { timeout: 3000 })
ok('A6 点行打开详情面板', (await page.locator('.detail-title').inputValue()).includes('交方案'))

// 子任务 ×2
const subInput = page.locator('.sub-input')
await subInput.fill('收集数据')
await subInput.press('Enter')
await subInput.fill('写初稿')
await subInput.press('Enter')
await page.waitForTimeout(200)
await page.locator('.subtask', { hasText: '收集数据' }).locator('.cb').click()
await page.waitForTimeout(200)
ok('A7 子任务 1/2 + 进度条', await page.locator('.sub-head .pct', { hasText: '1/2' }).isVisible())

// 备注
await page.locator('.note').fill('周五前发给组长审')
await page.locator('.note').blur?.()
await page.keyboard.press('Tab')
await page.waitForTimeout(300)

// 优先级 高
await page.locator('.field', { hasText: '优先级' }).locator('select').selectOption('3')
await page.waitForTimeout(200)
ok('A8 优先级设为高（列表出现红旗）', await page.locator('.task', { hasText: '交方案' }).first().locator('.flag.p3').isVisible())
await shot(page, '06-详情面板')

// ── 5. 习惯：新建 ×2 + 打卡 ──
await page.locator('.nav-item', { hasText: '习惯打卡' }).click()
await page.locator('button', { hasText: '新建习惯' }).click()
await page.locator('.name-input').fill('喝水 8 杯')
await page.locator('.ichoice').first().click()
await page.locator('.add-form .dot').first().click()
await page.locator('button', { hasText: '保存' }).last().click()
await page.waitForTimeout(200)
await page.locator('button', { hasText: '新建习惯' }).click()
await page.locator('.name-input').fill('晨跑 30 分钟')
await page.locator('.ichoice').nth(1).click()
await page.locator('.add-form .dot').nth(1).click()
await page.locator('button', { hasText: '保存' }).last().click()
await page.waitForTimeout(300)
ok('A9 新建 2 个习惯', await page.locator('.hname', { hasText: '喝水 8 杯' }).isVisible() &&
  await page.locator('.hname', { hasText: '晨跑 30 分钟' }).isVisible())

// 打卡第一个
await page.locator('.habit', { hasText: '喝水 8 杯' }).locator('.checkbtn').click()
await page.waitForTimeout(200)
ok('A10 今日打卡 + 汇总 1/2', await page.locator('.summary .big', { hasText: '1' }).isVisible() &&
  await page.locator('.habit', { hasText: '喝水 8 杯' }).locator('.checkbtn.done').isVisible())
await shot(page, '07-习惯打卡')

// ── 6. 主题：深色即时切换 ──
await page.locator('.nav-item', { hasText: '设置' }).click()
await page.waitForSelector('.theme-opt', { timeout: 3000 })
await page.locator('.theme-opt', { hasText: '深色' }).click()
await page.waitForTimeout(300)
const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor)
ok('A11 深色主题即时生效', bg === 'rgb(30, 31, 35)', bg)
await shot(page, '08-深色主题')
await page.locator('.theme-opt', { hasText: '浅色' }).click()
await page.waitForTimeout(300)
ok('A12 切回浅色', (await page.evaluate(() => getComputedStyle(document.body).backgroundColor)) === 'rgb(255, 255, 255)')

fs.writeFileSync(`${OUT}/results-A.txt`, results.join('\n'))
console.log('---A 段完成---')
await browser.close()
