/**
 * 备份导入导出的纯逻辑
 * - 导出范围：all=原样；active=仅未完成任务 + 未删除的清单/习惯（番茄记录与设置随附）
 * - 导入模式：replace=整库覆盖；merge=按 updatedAt 逐条智能合并（复用同步的 LWW）
 * - 任务图片：导出时嵌入 _images（taskId→dataURL），导入时由主进程还原为本地文件
 */
const { mergeDocs, isValidDoc } = require('./sync')

function scopeForExport (doc, scope) {
  const out = scope !== 'active' ? doc : {
    ...doc,
    tasks: (doc.tasks || []).filter(t => !t.completed && !t.deletedAt),
    lists: (doc.lists || []).filter(l => !l.deletedAt),
    habits: (doc.habits || []).filter(h => !h.deletedAt)
  }
  // 导出剥离授权与试用见证：激活码仅对签发机器有意义，落进可分享的备份文件只有泄露风险
  const settings = { ...(out.settings || {}) }
  delete settings.license
  delete settings._trialStartedAt
  return { ...out, settings }
}

/** 将范围内任务的图片读出并嵌入文档（readFn(taskId) → dataURL|null） */
async function embedImages (doc, readFn) {
  const images = {}
  for (const t of doc.tasks || []) {
    if (t.hasImage) {
      const data = await readFn(t.id)
      if (data) images[t.id] = data
    }
  }
  doc._images = images
  return doc
}

/**
 * 导入后还原图片（writeFn(taskId, dataURL)）；merge 模式只还原导入方带来的图，
 * 返回需要标记 hasImage 的任务 id 集合
 */
async function restoreImages (next, staged, writeFn) {
  const restored = new Set()
  const images = staged._images || {}
  for (const t of next.tasks || []) {
    const data = images[t.id]
    if (t.hasImage && data) {
      await writeFn(t.id, data)
      restored.add(t.id)
    } else if (t.hasImage && !data) {
      // 导入方没有该图的文件（如从「仅未完成」导出的子集），保守置回 false
      t.hasImage = false
    }
  }
  delete next._images
  return restored
}

/**
 * @param {object} current 当前数据
 * @param {object} staged  待导入文档（已校验形状）
 * @param {'replace'|'merge'} mode
 * 设置与同步状态永远保留当前值（导入的是任务数据，不是应用配置）
 */
function applyImport (current, staged, mode) {
  if (!isValidDoc(staged)) throw new Error('文件格式不正确')
  let next
  if (mode === 'merge') next = mergeDocs(current, staged)
  else next = JSON.parse(JSON.stringify(staged))
  next.settings = current.settings
  next.syncState = current.syncState
  return next
}

module.exports = { scopeForExport, applyImport, embedImages, restoreImages }
