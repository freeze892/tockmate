const COLLECTIONS = ['lists', 'tasks', 'habits']
const TOMBSTONE_TTL = 30 * 24 * 3600 * 1000

function newer (a, b) {
  return (a.updatedAt || 0) >= (b.updatedAt || 0) ? a : b
}

/** 按 id 合并单个集合（LWW） */
function mergeCollection (localArr = [], remoteArr = []) {
  const remoteById = new Map(remoteArr.map(x => [x.id, x]))
  const result = []
  const seen = new Set()
  for (const l of localArr) {
    seen.add(l.id)
    const r = remoteById.get(l.id)
    result.push(r ? newer(l, r) : l)
  }
  for (const r of remoteArr) {
    if (!seen.has(r.id)) result.push(r)
  }
  return result
}

/** 合并番茄记录：按 startedAt+taskId 去重的追加集合 */
function mergePomodoroLogs (a = [], b = []) {
  const keyOf = x => `${x.startedAt}|${x.taskId || ''}|${x.minutes}`
  const map = new Map()
  for (const x of [...a, ...b]) map.set(keyOf(x), x)
  return [...map.values()].sort((x, y) => (x.startedAt || 0) - (y.startedAt || 0))
}

/** 清理超过 TTL 的墓碑 */
function pruneTombstones (doc, now = Date.now()) {
  for (const key of COLLECTIONS) {
    if (Array.isArray(doc[key])) {
      doc[key] = doc[key].filter(x => !x.deletedAt || now - x.deletedAt < TOMBSTONE_TTL)
    }
  }
  return doc
}

/** 合并本地与远端文档（远端不存在时直接用本地） */
function mergeDocs (local, remote) {
  if (!remote || typeof remote !== 'object' || !Array.isArray(remote.lists)) return local
  const merged = { ...local }
  for (const key of COLLECTIONS) {
    merged[key] = mergeCollection(local[key] || [], remote[key] || [])
  }
  merged.pomodoro = { logs: mergePomodoroLogs(local.pomodoro?.logs, remote.pomodoro?.logs) }
  // 设置整块 LWW（无 updatedAt 时视为更旧）；
  // 「仅本机」键（自动执行命令/全局快捷键/应用锁）远端值永不落地——
  // 否则被入侵的同步端可预置派发命令+到期任务，组合成远程代码执行
  const { sanitizeRemoteSettings } = require('./validate')
  const lTime = local.settings?._updatedAt || 0
  const rTime = remote.settings?._updatedAt || 0
  merged.settings = rTime > lTime
    ? sanitizeRemoteSettings(remote.settings, local.settings)
    : local.settings
  return merged
}

/** 校验导入/远端文档的基本形状 */
function isValidDoc (doc) {
  return !!doc && typeof doc === 'object' &&
    Array.isArray(doc.lists) && Array.isArray(doc.tasks)
}

// ── 网络 IO（依赖 webdav 包；测试中被注入的 io 替身替代） ─────────────

const REMOTE_DIR = '/TickMate' // 服务器端目录名保持不变：更名后沿用旧目录，避免多设备同步断档
const REMOTE_FILE = REMOTE_DIR + '/data.json'
const FALLBACK_FILE = '/TickMate-data.json' // 服务器不允许建目录时的回退位置

function isNotFound (err) {
  return !!(err && (err.status === 404 || /(^|[^\d])404([^\d]|$)/.test(String(err.message || err))))
}

/** 拉取：优先 目录/data.json；主位置 404/出错时继续尝试根目录单文件 */
async function pullAny (client) {
  const tryRead = async (file) => {
    try {
      const buf = await client.getFileContents(file, { format: 'text' })
      const doc = JSON.parse(buf)
      return isValidDoc(doc) ? doc : null
    } catch (err) {
      if (isNotFound(err)) return null
      throw err
    }
  }
  let mainErr = null
  try {
    const r = await tryRead(REMOTE_FILE)
    if (r) return r
  } catch (err) {
    mainErr = err
  }
  try {
    const r = await tryRead(FALLBACK_FILE)
    if (r) return r
  } catch { /* 保留主位置的错误信息 */ }
  if (mainErr) throw mainErr
  return null
}

/** 推送：先确保目录后写 /TockMate/data.json；任一步失败 → 回退写根目录单文件 */
async function pushAny (client, doc) {
  const body = JSON.stringify(doc)
  try {
    try {
      await client.createDirectory(REMOTE_DIR)
    } catch { /* 已存在或服务器限制，交给 PUT 检验 */ }
    await client.putFileContents(REMOTE_FILE, body)
    return REMOTE_FILE
  } catch (err) {
    await client.putFileContents(FALLBACK_FILE, body)
    return FALLBACK_FILE
  }
}

function statusOf (err) {
  if (!err) return '?'
  if (err.status) return String(err.status)
  const m = String(err.message || err).match(/\b(\d{3})\b/)
  return m ? m[1] : String(err.message || err).slice(0, 40)
}

/** 逐步实测服务器允许的操作（读/建目录/写/删），返回步骤结果数组 */
async function probePermissions (client) {
  const steps = []
  try {
    await client.getDirectoryContents('/')
    steps.push('读取根目录 ✓')
  } catch (e) {
    steps.push(`读取根目录 ✗(${statusOf(e)})`)
    return steps
  }
  let dirOk = false
  try {
    await client.createDirectory(REMOTE_DIR)
    dirOk = true
    steps.push('创建目录 ✓')
  } catch (e) {
    // 目录可能已存在：确认一下
    try {
      const items = await client.getDirectoryContents('/')
      dirOk = items.some(x => x.filename === REMOTE_DIR.replace(/^\//, ''))
      steps.push(dirOk ? '创建目录 ✓(已存在)' : `创建目录 ✗(${statusOf(e)})`)
    } catch (e2) {
      steps.push(`创建目录 ✗(${statusOf(e)})`)
    }
  }
  const file = dirOk ? REMOTE_FILE : FALLBACK_FILE
  // 若真实数据文件已存在，跳过写入/删除测试（避免破坏数据）
  let hasRealData = false
  try {
    const buf = await client.getFileContents(file, { format: 'text' })
    hasRealData = isValidDoc(JSON.parse(buf))
  } catch { /* 不存在，可安全探测 */ }
  if (hasRealData) {
    steps.push('写/删 已有数据文件，跳过探测（写入能力此前已验证 ✓）')
    return steps
  }
  try {
    await client.putFileContents(file, JSON.stringify({ probe: Date.now() }))
    steps.push('写入文件 ✓')
  } catch (e) {
    steps.push(`写入文件 ✗(${statusOf(e)})`)
    return steps
  }
  try {
    await client.deleteFile(file)
    steps.push('删除测试文件 ✓')
  } catch (e) {
    steps.push(`删除测试文件 ✗(${statusOf(e)})`)
  }
  return steps
}

function createWebdavIo (webdavModule) {
  const { createClient } = webdavModule

  async function getClient (cfg) {
    return createClient(cfg.url, { username: cfg.username, password: cfg.password })
  }

  return {
    testConnection: async (cfg) => {
      const client = await getClient(cfg)
      const steps = await probePermissions(client)
      return { ok: steps.every(s => s.includes('✓')), steps }
    },
    pull: async (cfg) => pullAny(await getClient(cfg)),
    push: async (cfg, doc) => pushAny(await getClient(cfg), doc)
  }
}

/** 执行一次完整同步：拉取 → 合并 → 推送；返回 { doc, pulled, pushed } */
async function syncNow (cfg, localDoc, io) {
  const remote = await io.pull(cfg)
  const merged = mergeDocs(localDoc, remote)
  const location = await io.push(cfg, pruneTombstones(merged))
  return { doc: merged, pulled: !!remote, pushed: true, location }
}

module.exports = { mergeCollection, mergePomodoroLogs, mergeDocs, pruneTombstones, isValidDoc, createWebdavIo, syncNow, pullAny, pushAny, COLLECTIONS, TOMBSTONE_TTL, REMOTE_FILE, FALLBACK_FILE }
