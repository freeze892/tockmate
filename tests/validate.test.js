import { describe, it, expect } from 'vitest'
import { isSafeId, cmdQuote, LOCAL_ONLY_SETTINGS, sanitizeRemoteSettings } from '../electron/validate'

describe('isSafeId 路径穿越防护', () => {
  it('合法 id（genId 产出格式）放行', () => {
    expect(isSafeId('t-m1abc2xyz3')).toBe(true)
    expect(isSafeId('l-0')).toBe(true)
    expect(isSafeId('Task_1-2')).toBe(true)
  })
  it('穿越/特殊字符/空值拒绝', () => {
    expect(isSafeId('../../evil')).toBe(false)
    expect(isSafeId('..\\..\\evil')).toBe(false)
    expect(isSafeId('a/b')).toBe(false)
    expect(isSafeId('a b')).toBe(false)
    expect(isSafeId('')).toBe(false)
    expect(isSafeId(null)).toBe(false)
    expect(isSafeId(undefined)).toBe(false)
    expect(isSafeId(123)).toBe(false)
    expect(isSafeId('.hidden')).toBe(false)
    expect(isSafeId('a'.repeat(65))).toBe(false)
  })
})

describe('cmdQuote 命令注入防护', () => {
  it('普通标题输出与 JSON.stringify 等价（不改变既有行为）', () => {
    expect(cmdQuote('买牛奶')).toBe('"买牛奶"')
    expect(cmdQuote('plain title')).toBe('"plain title"')
  })
  it('含双引号的标题不再逃逸命令', () => {
    const evil = 'x" & calc & "y'
    const out = cmdQuote(evil)
    // 全部内部引号加倍，cmd 解析时 & 处于引号内，为字面量
    expect(out).toBe('"x"" & calc & ""y"')
    expect(out.startsWith('"') && out.endsWith('"')).toBe(true)
    // 模拟 cmd 解析（对完整输出，引号逐个开关）：& 必须始终处于引号内
    let inQuote = false
    for (const ch of out) {
      if (ch === '"') inQuote = !inQuote
      else if (ch === '&' && !inQuote) throw new Error('未引用的 & 存活')
    }
    expect(inQuote).toBe(false) // 引号成对闭合（末态与起始一致）
  })
  it('空值/非字符串安全', () => {
    expect(cmdQuote(undefined)).toBe('""')
    expect(cmdQuote(null)).toBe('""')
    expect(cmdQuote(123)).toBe('"123"')
  })
})

describe('sanitizeRemoteSettings 仅本机键', () => {
  it('远端命令/快捷键/锁配置不落地，其余字段远端优先', () => {
    const local = { autoRunCommand: 'my.cmd {file}', quickShortcut: 'Control+Shift+Space', appLock: { enabled: true }, theme: 'light' }
    const remote = { autoRunCommand: 'evil.exe', quickShortcut: 'F12', appLock: { enabled: false }, theme: 'dark', pomodoro: { focus: 25 } }
    const out = sanitizeRemoteSettings(remote, local)
    expect(out.autoRunCommand).toBe('my.cmd {file}')
    expect(out.quickShortcut).toBe('Control+Shift+Space')
    expect(out.appLock).toEqual({ enabled: true })
    expect(out.theme).toBe('dark')
    expect(out.pomodoro).toEqual({ focus: 25 })
  })
  it('本地无值时删除该键（不透传远端值）', () => {
    const out = sanitizeRemoteSettings({ autoRunCommand: 'evil.exe', theme: 'dark' }, {})
    expect(out.autoRunCommand).toBeUndefined()
    expect('autoRunCommand' in out).toBe(false)
    expect(out.theme).toBe('dark')
  })
  it('空入参安全', () => {
    expect(sanitizeRemoteSettings(undefined, undefined)).toEqual({})
    expect(LOCAL_ONLY_SETTINGS).toContain('autoRunCommand')
  })
  it('授权与试用见证仅本机（license/_trialStartedAt 远端值不落地）', () => {
    const local = { license: { code: 'LOCAL-CODE' }, _trialStartedAt: 111, theme: 'light' }
    const remote = { license: { code: 'REMOTE-CODE' }, _trialStartedAt: 222, theme: 'dark' }
    const out = sanitizeRemoteSettings(remote, local)
    expect(out.license).toEqual({ code: 'LOCAL-CODE' })
    expect(out._trialStartedAt).toBe(111)
    expect(out.theme).toBe('dark')
    const out2 = sanitizeRemoteSettings({ license: { code: 'REMOTE-CODE' } }, {})
    expect(out2.license).toBeUndefined()
  })
})
