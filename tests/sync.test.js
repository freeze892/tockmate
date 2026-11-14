import { describe, it, expect } from 'vitest'
import { mergeDocs, mergePomodoroLogs, pruneTombstones, isValidDoc, syncNow } from '../electron/sync'

function task (id, updatedAt, extra = {}) {
  return { id, title: `t-${id}`, updatedAt, deletedAt: null, ...extra }
}

describe('mergeDocs', () => {
  it('两端各改不同任务 → 自动合并不互踩', () => {
    const local = { lists: [], tasks: [task('a', 100), task('b', 100)], habits: [] }
    const remote = { lists: [], tasks: [task('a', 100), task('c', 200)], habits: [] }
    const m = mergeDocs(local, remote)
    expect(m.tasks.map(t => t.id).sort()).toEqual(['a', 'b', 'c'])
  })

  it('同一任务两端都改 → updatedAt 新者胜（与哪端无关）', () => {
    const newer = { lists: [], tasks: [task('a', 500, { title: '较新' })], habits: [] }
    const older = { lists: [], tasks: [task('a', 300, { title: '较旧' })], habits: [] }
    expect(mergeDocs(newer, older).tasks[0].title).toBe('较新')
    expect(mergeDocs(older, newer).tasks[0].title).toBe('较新')
  })

  it('删除以 tombstone 传播（新墓碑战胜旧修改）', () => {
    const local = { lists: [], tasks: [task('a', 100)], habits: [] }
    const remote = { lists: [], tasks: [task('a', 200, { deletedAt: 200 })], habits: [] }
    expect(mergeDocs(local, remote).tasks[0].deletedAt).toBe(200)
  })

  it('远端不存在 → 原样返回本地', () => {
    const local = { lists: [1], tasks: [], habits: [] }
    expect(mergeDocs(local, null)).toBe(local)
  })

  it('番茄记录合并去重且按时间排序', () => {
    const a = { logs: [{ startedAt: 100, taskId: 'x', minutes: 25 }] }
    const b = { logs: [{ startedAt: 50, taskId: 'y', minutes: 25 }, { startedAt: 100, taskId: 'x', minutes: 25 }] }
    const merged = mergePomodoroLogs(a.logs, b.logs)
    expect(merged.length).toBe(2)
    expect(merged[0].startedAt).toBe(50)
  })

  it('设置块 LWW（_updatedAt 新者胜）', () => {
    const local = { lists: [], tasks: [], habits: [], settings: { _updatedAt: 100, theme: 'light' } }
    const remote = { lists: [], tasks: [], habits: [], settings: { _updatedAt: 200, theme: 'dark' } }
    expect(mergeDocs(local, remote).settings.theme).toBe('dark')
  })

  it('墓碑超过 30 天被清理', () => {
    const doc = { lists: [], tasks: [task('a', 0, { deletedAt: 1 })], habits: [] }
    const pruned = pruneTombstones(doc, Date.now())
    expect(pruned.tasks.length).toBe(0)
  })

  it('isValidDoc 校验形状', () => {
    expect(isValidDoc({ lists: [], tasks: [] })).toBe(true)
    expect(isValidDoc(null)).toBe(false)
    expect(isValidDoc({ lists: 'x', tasks: [] })).toBe(false)
  })

  it('syncNow：pull 合并 push 全链路（io 替身）', async () => {
    const local = { lists: [], tasks: [task('a', 300)], habits: [], pomodoro: { logs: [] } }
    const remote = { lists: [], tasks: [task('b', 100)], habits: [], pomodoro: { logs: [] } }
    let pushed = null
    const io = {
      pull: async () => remote,
      push: async (_cfg, doc) => { pushed = doc }
    }
    const { doc, pulled } = await syncNow({}, local, io)
    expect(pulled).toBe(true)
    expect(doc.tasks.map(t => t.id).sort()).toEqual(['a', 'b'])
    expect(pushed).toBe(doc)
  })
})
