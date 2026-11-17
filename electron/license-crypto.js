/**
 * 授权纯函数（无 electron 依赖：主进程 / 签发 CLI / 单测共用）
 *
 * 方案（Sprint 10 / 方案 A）：离线 ed25519 签名激活码 + 机器码绑定，无服务器、离线可用。
 * - 机器码：sha256(种子 + 本机唯一标识) 取 16 位 hex，展示为 XXXX-XXXX-XXXX-XXXX
 * - 激活码：base64url(payload JSON 字节) + '.' + base64url(签名 64B)
 *   payload: { v:1, m:机器码, n:买家备注, e:到期 ISO|null(null=永久), iat:签发时间 }
 * - 验签公钥内嵌于此；签发私钥只存在签发者本机目录（不进任何仓库）
 * - 试用期：首启锚点（trial-anchor.json）+ 14 天判定；lastSeen 单调防回拨时钟
 */
const crypto = require('crypto')
const { execFile } = require('child_process')
const os = require('os')

// 签发端公钥（由签发端工具生成后回填；签发私钥只存在签发者本机的仓外目录，不进任何仓库）
const LICENSE_PUB_KEY_HEX = '302a300506032b6570032100b5b7c704226e6b1a5ea00ced2438570428e93618cf52a75cafc31fb17fc21026'

const TRIAL_DAYS = 14
const LICENSE_SEED = 'tockmate-license-v1'
const DAY_MS = 24 * 60 * 60 * 1000

// ── 机器码 ───────────────────────────────────────────────────────
function digestMachineCode (raw) {
  const hex = crypto.createHash('sha256').update(LICENSE_SEED + '|' + String(raw)).digest('hex')
  return hex.slice(0, 16)
}

/** 16 位 hex 摘要 → XXXX-XXXX-XXXX-XXXX（大写展示） */
function formatMachineCode (hex16) {
  const h = String(hex16 || '').replace(/[^0-9a-fA-F]/g, '').toLowerCase()
  if (h.length !== 16) throw new Error('机器码摘要必须为 16 位 hex')
  return h.match(/.{4}/g).join('-').toUpperCase()
}

/** 宽容解析用户粘贴的机器码（忽略大小写/连字符/空格），非 16 位 hex 返回 null */
function parseMachineCode (input) {
  const h = String(input || '').replace(/[^0-9a-fA-F]/g, '').toLowerCase()
  return h.length === 16 ? h : null
}

/**
 * 读取本机唯一标识（Windows：注册表 MachineGuid，重装系统才变；其它平台退回 主机名+用户名）
 * 返回原始字符串，需经 digestMachineCode 摘要后再展示
 */
function readMachineGuid () {
  return new Promise(resolve => {
    if (process.platform !== 'win32') return resolve(os.hostname() + '|' + (os.userInfo().username || ''))
    execFile('reg', ['query', 'HKLM\\SOFTWARE\\Microsoft\\Cryptography', '/v', 'MachineGuid'],
      { timeout: 5000 }, (err, stdout) => {
        if (err) {
          console.warn('[license] MachineGuid 读取失败，退回主机名标识:', String(err && err.message || err))
          return resolve(os.hostname() + '|' + (os.userInfo().username || ''))
        }
        const m = /MachineGuid\s+REG_SZ\s+(\S+)/.exec(String(stdout || ''))
        if (!m) {
          console.warn('[license] MachineGuid 输出解析失败，退回主机名标识')
          return resolve(os.hostname() + '|' + (os.userInfo().username || ''))
        }
        resolve(m[1])
      })
  })
}

// ── 签发 / 验签 ──────────────────────────────────────────────────
/** 签发端：payload 签名生成激活码（payload 传入前须已含 v/m/n/e/iat 全字段） */
function signLicenseCode (payload, privateKey) {
  const json = Buffer.from(JSON.stringify(payload), 'utf8')
  const sig = crypto.sign(null, json, privateKey)
  return json.toString('base64url') + '.' + sig.toString('base64url')
}

function pubKeyObject (pubKeyHex) {
  if (!pubKeyHex) return null
  try {
    return crypto.createPublicKey({ key: Buffer.from(pubKeyHex, 'hex'), format: 'der', type: 'spki' })
  } catch {
    return null
  }
}

/**
 * 验证激活码：签名 → 机器码绑定 → 有效期。
 * 返回 { ok:true, payload } 或 { ok:false, reason }
 */
function verifyLicenseCode (code, machineCodeHex16, pubKeyHex = LICENSE_PUB_KEY_HEX) {
  const clean = String(code || '').replace(/\s+/g, '')
  const parts = clean.split('.')
  if (parts.length !== 2 || !parts[0] || !parts[1]) return { ok: false, reason: '激活码格式不正确' }
  let payloadBytes, sig
  try {
    payloadBytes = Buffer.from(parts[0], 'base64url')
    sig = Buffer.from(parts[1], 'base64url')
  } catch {
    return { ok: false, reason: '激活码格式不正确' }
  }
  let payload
  try {
    payload = JSON.parse(payloadBytes.toString('utf8'))
  } catch {
    return { ok: false, reason: '激活码格式不正确' }
  }
  if (!payload || typeof payload !== 'object' || payload.v !== 1 || typeof payload.m !== 'string') {
    return { ok: false, reason: '激活码格式不正确' }
  }
  const key = pubKeyObject(pubKeyHex)
  if (!key) return { ok: false, reason: '授权模块未配置公钥' }
  let signed
  try {
    signed = crypto.verify(null, payloadBytes, key, sig)
  } catch {
    return { ok: false, reason: '激活码无效（签名校验失败）' }
  }
  if (!signed) return { ok: false, reason: '激活码无效（签名校验失败）' }
  const mine = parseMachineCode(machineCodeHex16)
  const theirs = parseMachineCode(payload.m)
  if (!mine || !theirs || mine !== theirs) {
    return { ok: false, reason: '机器码不匹配——本机机器码为 ' + (machineCodeHex16 ? formatMachineCode(machineCodeHex16) : '(未知)') }
  }
  if (payload.e && new Date(payload.e).getTime() < Date.now()) {
    return { ok: false, reason: '激活码已于 ' + payload.e.slice(0, 10) + ' 过期' }
  }
  return { ok: true, payload }
}

// ── 试用期（纯函数） ─────────────────────────────────────────────
/**
 * anchor: { startedAt, lastSeen }（毫秒时间戳）；lastSeen 单调取 max——
 * 用户回拨系统时钟时，试用期以「见过的最大时间」计算，不因回拨延长
 */
function computeTrial (anchor, nowMs) {
  const startedAt = anchor && Number(anchor.startedAt) > 0 ? Number(anchor.startedAt) : nowMs
  const effNow = Math.max(Number(nowMs) || 0, (anchor && Number(anchor.lastSeen)) || 0)
  const elapsed = Math.max(0, effNow - startedAt)
  const daysLeft = Math.max(0, TRIAL_DAYS - Math.floor(elapsed / DAY_MS))
  return { active: daysLeft > 0, daysLeft }
}

module.exports = {
  LICENSE_PUB_KEY_HEX,
  TRIAL_DAYS,
  digestMachineCode,
  formatMachineCode,
  parseMachineCode,
  readMachineGuid,
  signLicenseCode,
  verifyLicenseCode,
  computeTrial
}
