import { describe, it, expect } from 'vitest'
import { scopeForExport, applyImport } from '../electron/backup'

function doc () {
  return {
    version: 1,
    lists: [
      { id: 'l1', name: '工作', updatedAt: 100, deletedAt: null },
      { id: 'l2', name: '旧清单', updatedAt: 100, deletedAt: 200 }
    ],
    tasks: [
      { id: 't1', title: '未完成', updatedAt: 100, completed: false, deletedAt: null, listId: 'l1' },
      { id: 't2', title: '已完成', updatedAt: 100, completed: true, deletedAt: null, listId: 'l1' },
      { id: 't3', title: '已删除', updatedAt: 100, completed: false, deletedAt: 300, listId: 'l1' }
    ],
    habits: [
      { id: 'h1', name: '喝水', records: ['2026-10-29'], deletedAt: null },
      { id: 'h2', name: '旧习惯', records: [], deletedAt: 300 }
    ],
    pomodoro: { logs: [{ startedAt: 1, minutes: 25 }] },
    settings: { theme: 'light', webdav: { enabled: true, passwordEnc: 'enc:x' } },
    syncState: { lastSyncAt: 42 }
  }
}

describe('scopeForExport', () => {
  it('active：只留未完成任务与未删除清单/习惯，番茄与设置随附', () => {
    const out = scopeForExport(doc(), 'active')
    expect(out.tasks.map(t => t.id)).toEqual(['t1'])
    expect(out.lists.map(l => l.id)).toEqual(['l1'])
    expect(out.habits.map(h => h.id)).toEqual(['h1'])
    expect(out.pomodoro.logs.length).toBe(1)
    expect(out.settings.theme).toBe('light')
  })

  it('all：原样返回（含已完成与已删除，便于完整备份）', () => {
    const d = doc()
    const out = scopeForExport(d, 'all')
    expect(out.tasks.length).toBe(3)
    expect(out).toEqual(d)
  })
})

describe('applyImport', () => {
  it('replace：整库覆盖，但保留当前设置与同步状态', () => {
    const cur = doc()
    cur.settings = { theme: 'dark', webdav: { enabled: true, passwordEnc: 'enc:keep' } }
    const staged = { lists: [{ id: 'lx', name: '导入清单', updatedAt: 1 }], tasks: [], habits: [] }
    const out = applyImport(cur, staged, 'replace')
    expect(out.lists[0].id).toBe('lx')
    expect(out.settings.theme).toBe('dark')
    expect(out.settings.webdav.passwordEnc).toBe('enc:keep')
    expect(out.syncState.lastSyncAt).toBe(42)
  })

  it('merge：同 id 取较新者，新 id 追加（智能合并不丢数据）', () => {
    const cur = doc()
    const staged = {
      lists: [],
      tasks: [
        { id: 't1', title: '远端改过', updatedAt: 999, completed: false, deletedAt: null, listId: 'l1' },
        { id: 't9', title: '另一台设备的新任务', updatedAt: 500, completed: false, deletedAt: null, listId: 'l1' }
      ],
      habits: []
    }
    const out = applyImport(cur, staged, 'merge')
    const t1 = out.tasks.find(t => t.id === 't1')
    const ids = out.tasks.map(t => t.id)
    expect(t1.title).toBe('远端改过') // staged 的 updatedAt 更新 → 采纳
    expect(ids).toContain('t9')
    expect(ids).toContain('t2')   // 本地独有的已完成任务保留
    expect(out.settings.theme).toBe('light')
  })

  it('形状不合法抛错', () => {
    expect(() => applyImport(doc(), { lists: 'x' }, 'merge')).toThrow()
  })
})
