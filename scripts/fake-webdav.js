/**
 * 极简 WebDAV 服务器（仅用于本地端到端测试 TickMate 同步）
 * 支持：PROPFIND / MKCOL / GET / PUT / HEAD，文件落在 --dir 指定目录。
 * 用法：node scripts/fake-webdav.js [port] [dir]
 */
const http = require('http')
const fs = require('fs')
const path = require('path')

const port = Number(process.argv[2] || 5176)
const root = path.resolve(process.argv[3] || path.join(__dirname, '..', '.webdav-fs'))
fs.mkdirSync(root, { recursive: true })

const PROPFIND_XML = `<?xml version="1.0" encoding="utf-8"?>
<d:multistatus xmlns:d="DAV:">
  <d:response><d:href>/</d:href><d:propstat><d:prop><d:resourcetype><d:collection/></d:resourcetype></d:prop><d:status>HTTP/1.1 200 OK</d:status></d:propstat></d:response>
</d:multistatus>`

const server = http.createServer((req, res) => {
  const urlPath = decodeURIComponent(req.url.split('?')[0])
  const filePath = path.join(root, urlPath.replace(/^\/+/, ''))
  console.log('[webdav]', req.method, urlPath)

  if (req.method === 'PROPFIND') {
    res.writeHead(207, { 'Content-Type': 'application/xml', DAV: '1' })
    res.end(PROPFIND_XML)
    return
  }
  if (req.method === 'MKCOL') {
    try {
      fs.mkdirSync(filePath, { recursive: true })
      res.writeHead(201)
    } catch {
      res.writeHead(405)
    }
    res.end()
    return
  }
  if (req.method === 'HEAD') {
    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      res.writeHead(200, { 'Content-Length': fs.statSync(filePath).size })
    } else res.writeHead(404)
    res.end()
    return
  }
  if (req.method === 'GET') {
    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      const body = fs.readFileSync(filePath)
      res.writeHead(200, { 'Content-Type': 'application/json', 'Content-Length': body.length })
      res.end(body)
    } else {
      res.writeHead(404)
      res.end('not found')
    }
    return
  }
  if (req.method === 'PUT') {
    const chunks = []
    req.on('data', c => chunks.push(c))
    req.on('end', () => {
      fs.mkdirSync(path.dirname(filePath), { recursive: true })
      fs.writeFileSync(filePath, Buffer.concat(chunks))
      res.writeHead(201)
      res.end()
    })
    return
  }
  res.writeHead(405)
  res.end()
})

server.listen(port, '127.0.0.1', () => console.log(`[webdav] fake server on http://127.0.0.1:${port} → ${root}`))
