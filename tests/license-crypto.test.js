import { describe, it, expect } from 'vitest'
import crypto from 'node:crypto'
import {
  LICENSE_PUB_KEY_HEX, TRIAL_DAYS,
  digestMachineCode, formatMachineCode, parseMachineCode,
  signLicenseCode, verifyLicenseCode, computeTrial
} from '../electron/license-crypto'

// 单测专用临时密钥对（与正式签发密钥无关，正式私钥在仓库外）
const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519')
const TEST_PUB_HEX = publicKey.export({ type: 'spki', format: 'der' }).toString('hex')

// 正式签发端产出的固定样本（私钥若重置，此用例失败属预期——需重新签发并更新）
const FIXTURE = {
  machine: '0000-0000-0000-0000',
  code: 'eyJ2IjoxLCJtIjoiMDAwMC0wMDAwLTAwMDAtMDAwMCIsIm4iOiLljZXmtYvlm7rlrprmoLfmnKwiLCJlIjpudWxsLCJpYXQiOiIyMDI2LTExLTE3VDE1OjI3OjEzLjIzN1oifQ.JTDcMiKYltNNi_TDqtKljkrAYd7V7bsUycImh07qKBgoTnIWN7ddDo2UPn1_iBs9e61SxErML6h7kVMeyYYTAg'
}

describe('机器码', () => {
  it('摘要确定性：同输入同输出，不同输入不同输出', () => {
    expect(digestMachineCode('guid-a')).toBe(digestMachineCode('guid-a'))
    expect(digestMachineCode('guid-a')).not.toBe(digestMachineCode('guid-b'))
    expect(digestMachineCode('guid-a')).toMatch(/^[0-9a-f]{16}$/)
  })
  it('格式化与解析往返（大小写/连字符宽容）', () => {
    const hex = digestMachineCode('guid-a')
    const fmt = formatMachineCode(hex)
    expect(fmt).toMatch(/^[0-9A-F]{4}(-[0-9A-F]{4}){3}$/)
    expect(parseMachineCode(fmt)).toBe(hex)
    expect(parseMachineCode(fmt.toLowerCase())).toBe(hex)
    expect(parseMachineCode(fmt.replace(/-/g, ' '))).toBe(hex)
    expect(parseMachineCode('abc')).toBe(null)
    expect(parseMachineCode('')).toBe(null)
    expect(parseMachineCode(null)).toBe(null)
  })
})

describe('签发与验签', () => {
  const machine = digestMachineCode('guid-a')
  const payload = { v: 1, m: formatMachineCode(machine), n: '测试', e: null, iat: '2026-01-01T00:00:00Z' }
  const code = signLicenseCode(payload, privateKey)

  it('本机正确机器码 → 通过，payload 原样返回', () => {
    const r = verifyLicenseCode(code, machine, TEST_PUB_HEX)
    expect(r.ok).toBe(true)
    expect(r.payload).toEqual(payload)
  })
  it('粘贴时夹带空格换行不影响验证', () => {
    const messy = '  ' + code.slice(0, 40) + '\n' + code.slice(40) + '  '
    expect(verifyLicenseCode(messy, machine, TEST_PUB_HEX).ok).toBe(true)
  })
  it('他人机器码 → 拒绝并给出本机机器码', () => {
    const other = digestMachineCode('other-machine')
    const r = verifyLicenseCode(code, other, TEST_PUB_HEX)
    expect(r.ok).toBe(false)
    expect(r.reason).toContain('机器码不匹配')
    expect(r.reason).toContain(formatMachineCode(other))
  })
  it('篡改 payload 任一字节 → 拒绝', () => {
    const [p, s] = code.split('.')
    const obj = JSON.parse(Buffer.from(p, 'base64url').toString('utf8'))
    obj.m = formatMachineCode(digestMachineCode('other-machine'))
    const forged = Buffer.from(JSON.stringify(obj), 'utf8').toString('base64url')
    expect(verifyLicenseCode(forged + '.' + s, machine, TEST_PUB_HEX).ok).toBe(false)
  })
  it('篡改签名 → 拒绝', () => {
    const [p] = code.split('.')
    const badSig = Buffer.from('0'.repeat(64)).toString('base64url')
    expect(verifyLicenseCode(p + '.' + badSig, machine, TEST_PUB_HEX).ok).toBe(false)
  })
  it('限期激活码：未到期通过 / 已过期拒绝', () => {
    const future = { ...payload, e: new Date(Date.now() + 86400000).toISOString() }
    expect(verifyLicenseCode(signLicenseCode(future, privateKey), machine, TEST_PUB_HEX).ok).toBe(true)
    const past = { ...payload, e: new Date(Date.now() - 86400000).toISOString() }
    const r = verifyLicenseCode(signLicenseCode(past, privateKey), machine, TEST_PUB_HEX)
    expect(r.ok).toBe(false)
    expect(r.reason).toContain('过期')
  })
  it('畸形输入一律拒绝（不抛异常）', () => {
    for (const bad of ['', 'xxx', 'a.b', '!!!.???', code + '.extra', null, undefined, 123]) {
      const r = verifyLicenseCode(bad, machine, TEST_PUB_HEX)
      expect(r.ok).toBe(false)
      expect(typeof r.reason).toBe('string')
    }
  })
  it('正式签发密钥样本：内嵌公钥可验、绑定机器码可验、换机拒绝', () => {
    expect(LICENSE_PUB_KEY_HEX).toMatch(/^[0-9a-f]{88}$/)
    expect(verifyLicenseCode(FIXTURE.code, parseMachineCode(FIXTURE.machine)).ok).toBe(true)
    expect(verifyLicenseCode(FIXTURE.code, digestMachineCode('another-machine')).ok).toBe(false)
    // 测试密钥签的码在正式公钥下必须失败（两套密钥互不通用）
    expect(verifyLicenseCode(code, machine).ok).toBe(false)
  })
})

describe('试用期 computeTrial', () => {
  const DAY = 24 * 60 * 60 * 1000
  it('首启当天：满 14 天', () => {
    const now = Date.now()
    expect(computeTrial({ startedAt: now, lastSeen: now }, now)).toEqual({ active: true, daysLeft: TRIAL_DAYS })
  })
  it('第 5 天 → 剩 9 天；恰满 14 天 → 0 天且不活跃', () => {
    const start = Date.now() - 5 * DAY
    expect(computeTrial({ startedAt: start, lastSeen: start }, Date.now()).daysLeft).toBe(9)
    const start14 = Date.now() - 14 * DAY
    expect(computeTrial({ startedAt: start14, lastSeen: start14 }, Date.now())).toEqual({ active: false, daysLeft: 0 })
    // 14 天边界：13 天 23h59m 仍活跃
    const almost = Date.now() - (14 * DAY - 60 * 1000)
    expect(computeTrial({ startedAt: almost, lastSeen: almost }, Date.now()).active).toBe(true)
  })
  it('回拨时钟：lastSeen 单调，试用期不延长', () => {
    const start = Date.now() - 15 * DAY // 试用期本应已结束
    const seen = Date.now() // 之前已见过「今天」
    const rolledBack = seen - 10 * DAY // 用户把时钟回拨 10 天
    expect(computeTrial({ startedAt: start, lastSeen: seen }, rolledBack).active).toBe(false)
  })
  it('startedAt 在未来（时钟大幅回拨过安装点）→ 按剩余窗口计', () => {
    const start = Date.now() + 3 * DAY
    const r = computeTrial({ startedAt: start, lastSeen: start }, Date.now())
    expect(r.active).toBe(true)
    expect(r.daysLeft).toBe(TRIAL_DAYS)
  })
  it('锚点缺失/损坏 → 视为全新试用', () => {
    expect(computeTrial(null, Date.now())).toEqual({ active: true, daysLeft: TRIAL_DAYS })
    expect(computeTrial({}, Date.now())).toEqual({ active: true, daysLeft: TRIAL_DAYS })
    expect(computeTrial({ startedAt: 'garbage', lastSeen: NaN }, Date.now())).toEqual({ active: true, daysLeft: TRIAL_DAYS })
  })
})
