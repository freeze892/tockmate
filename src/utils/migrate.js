/**
 * 迁移导入（免费）：把滴答清单 CSV 导出 / 带表头通用 CSV（Todoist 等）映射为任务草稿
 * 策略：自动识别「有无表头」与列映射；日期多格式容错；优先级 v1 不映射（默认无）
 */
const TITLE_RE = /^(标题|任务|主题|事项|待办|title|task|content)$/i
const DATE_RE = /^(日期|截止|到期|截止日期|到期日期|due.?date|date)$/i
const LIST_RE = /^(清单|列表|项目|清单名|list|project)$/i
const NOTE_RE = /^(备注|描述|说明|笔记|note|description|desc)$/i
const DONE_RE = /^(状态|已完成|是否完成|status|done|completed)$/i

/** 多格式日期 → 'YYYY-MM-DD' | null（无法解析返回 null，调用方决定降级策略） */
export function parseAnyDate (s) {
  const str = String(s || '').trim()
  if (!str) return null
  let m = str.match(/^(\d{4})[-/年.](\d{1,2})[-/月.](\d{1,2})[日]?$/)
  if (m) return iso(+m[1], +m[2], +m[3])
  m = str.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/) // MM/DD/YYYY 或 M/D/YYYY
  if (m) return iso(+m[3], +m[1], +m[2])
  return null
}
function iso (y, mo, d) {
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null
  const dt = new Date(y, mo - 1, d)
  if (dt.getMonth() !== mo - 1 || dt.getDate() !== d) return null
  const p = (n) => String(n).padStart(2, '0')
  return `${y}-${p(mo)}-${p(d)}`
}

/** 判定 CSV 是否带表头：首行任一单元格命中已知列名 */
export function detectHeader (rows) {
  if (!rows.length) return false
  return rows[0].some(c => TITLE_RE.test(c.trim()) || DATE_RE.test(c.trim()) || LIST_RE.test(c.trim()))
}

/**
 * 行 → 任务草稿
 * 无表头（滴答清单导出式）：列序 [清单, 标题, 日期, 状态, 备注]
 * 有表头：按表头正则映射；缺标题列抛错
 * 返回 { source, count, tasks: [{ title, dueDate, listName, note }] }
 */
export function mapRows (rows) {
  const hasHeader = detectHeader(rows)
  const tasks = []
  let skipped = 0
  const body = hasHeader ? rows.slice(1) : rows
  for (const r of body) {
    const cells = r.map(c => (c || '').trim())
    if (!cells.some(c => c)) { skipped++; continue }
    let title, dateStr, listName, note, doneCell
    if (hasHeader) {
      const head = rows[0].map(c => c.trim())
      const idx = (re) => head.findIndex(h => re.test(h))
      const iT = idx(TITLE_RE), iD = idx(DATE_RE), iL = idx(LIST_RE), iN = idx(NOTE_RE)
      if (iT < 0) throw new Error('CSV 缺少标题列（表头需含「标题/任务/title」等）')
      title = cells[iT]
      dateStr = iD >= 0 ? cells[iD] : ''
      listName = iL >= 0 ? cells[iL] : ''
      note = iN >= 0 ? cells[iN] : ''
    } else {
      listName = cells[0] || ''
      title = cells[1] || ''
      dateStr = cells[2] || ''
      doneCell = cells[3] || ''
      note = cells[4] || ''
      if (!title) { skipped++; continue }
      if (/^(1|完成|已完成|done|true)$/i.test(doneCell)) { skipped++; continue }
    }
    if (!title.trim()) { skipped++; continue }
    const dueDate = parseAnyDate(dateStr)
    tasks.push({ title: title.trim().slice(0, 200), dueDate, listName: (listName || '').trim().slice(0, 50) || null, note: (note || '').slice(0, 2000) })
  }
  return { source: hasHeader ? '带表头 CSV' : '滴答清单 CSV（无表头）', count: tasks.length, skipped, tasks }
}
