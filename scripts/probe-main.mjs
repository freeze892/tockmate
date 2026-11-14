import { chromium } from 'playwright'
const b = await chromium.connectOverCDP('http://127.0.0.1:9222', { timeout: 8000 })
const ctx = b.contexts()[0]
const pages = ctx.pages()
console.log('TARGETS ' + pages.map(p => p.url()).join(' | '))
const main = pages.find(p => !p.url().includes('#widget') && !p.url().includes('#quick'))
if (!main) process.exit(1)
main.setDefaultTimeout(5000)
const info = await main.evaluate(() => ({
  url: location.href,
  htmlLen: document.documentElement.outerHTML.length,
  appHtmlLen: document.querySelector('#app') ? document.querySelector('#app').innerHTML.length : -1,
  appExists: !!document.querySelector('#app'),
  bodyText: (document.body.innerText || '').slice(0, 120).replace(/\n/g, '⏎')
}))
console.log('DOM ' + JSON.stringify(info))
const errs = []
main.on('pageerror', e => errs.push('pageerror: ' + e.message))
await main.reload().catch(e => console.log('reload err ' + e))
await main.waitForTimeout(2500)
const after = await main.evaluate(() => {
  const appEl = document.querySelector('#app')
  const s = appEl && appEl.__vue_app__ && appEl.__vue_app__.config.globalProperties.$pinia._s.get('data')
  return {
    appHtmlLen: appEl ? appEl.innerHTML.length : -1,
    hasStore: !!s,
    taskRows: document.querySelectorAll('.task').length,
    hasMilk: s ? s.tasks.some(t => t.title === '买牛奶') : null,
    bodyText: (document.body.innerText || '').slice(0, 100).replace(/\n/g, '⏎')
  }
}).catch(e => ({ evalErr: String(e).slice(0, 200) }))
console.log('AFTER_RELOAD ' + JSON.stringify(after))
console.log('PAGE_ERRORS ' + (errs.length ? errs.join(' ;; ') : 'none'))
process.exit(0)
