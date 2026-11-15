/**
 * CSV 解析（RFC4180 容错）：引号包裹、双引号转义、跨行字段、CRLF
 * 返回 string[][]（每行为字符串数组）
 */
export function parseCSV (text) {
  const rows = []
  let row = []
  let field = ''
  let inQ = false
  const s = String(text || '')
  for (let i = 0; i < s.length; i++) {
    const ch = s[i]
    if (inQ) {
      if (ch === '"') {
        if (s[i + 1] === '"') { field += '"'; i++ } else inQ = false
      } else field += ch
    } else if (ch === '"') {
      inQ = true
    } else if (ch === ',') {
      row.push(field); field = ''
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && s[i + 1] === '\n') i++
      row.push(field); rows.push(row); row = []; field = ''
    } else field += ch
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row) }
  // 去掉尾部全空行，保留中间空行（语义上代表空记录）
  while (rows.length && rows[rows.length - 1].length === 1 && rows[rows.length - 1][0] === '') rows.pop()
  return rows
}
