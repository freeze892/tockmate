import { describe, it, expect } from 'vitest'
import { hashPassword, verifyPassword } from '../electron/lock-crypto'
import { embedImages, restoreImages, applyImport } from '../electron/backup'

describe('lock-crypto', () => {
  it('哈希可验证正确密码', () => {
    const { salt, hash } = hashPassword('我的密码123')
    expect(verifyPassword('我的密码123', salt, hash)).toBe(true)
  })
  it('错误密码验证失败；不同盐产生不同哈希', () => {
    const { salt, hash } = hashPassword('abc')
    expect(verifyPassword('abd', salt, hash)).toBe(false)
    const again = hashPassword('abc')
    expect(again.hash).not.toBe(hash)
  })
  it('缺 salt/哈希时验证直接失败', () => {
    expect(verifyPassword('x', '', '')).toBe(false)
  })
})

describe('任务图片嵌入与还原', () => {
  it('embedImages 只读 hasImage 任务的图', async () => {
    const doc = { tasks: [
      { id: 'a', hasImage: true },
      { id: 'b', hasImage: false },
      { id: 'c' }
    ] }
    const read = async id => (id === 'a' ? 'data:image/jpeg;base64,AAA' : null)
    const out = await embedImages(doc, read)
    expect(out._images).toEqual({ a: 'data:image/jpeg;base64,AAA' })
  })

  it('restoreImages 写文件并返回还原集合；缺图时置 hasImage=false', async () => {
    const written = []
    const write = async (id, data) => { written.push([id, data]) }
    const next = { tasks: [
      { id: 'a', hasImage: true },
      { id: 'b', hasImage: true }, // 导入方没带图 → 置回 false
      { id: 'c', hasImage: false }
    ] }
    const staged = { _images: { a: 'data:image/jpeg;base64,AAA' } }
    const restored = await restoreImages(next, staged, write)
    expect(written).toEqual([['a', 'data:image/jpeg;base64,AAA']])
    expect(restored.has('a')).toBe(true)
    expect(next.tasks.find(t => t.id === 'b').hasImage).toBe(false)
    expect(next._images).toBeUndefined() // 用完即删，不落盘
  })

  it('导入链路：replace 后图片元数据保留、设置不被覆盖', async () => {
    const cur = {
      lists: [], tasks: [], habits: [],
      settings: { theme: 'dark' }, syncState: { lastSyncAt: 9 }
    }
    const staged = {
      lists: [], habits: [],
      tasks: [{ id: 'a', title: '带图任务', hasImage: true, updatedAt: 1 }],
      _images: { a: 'data:image/jpeg;base64,BBB' }
    }
    const next = applyImport(cur, staged, 'replace')
    expect(next.tasks[0].hasImage).toBe(true)
    expect(next.settings.theme).toBe('dark')
    expect(next.syncState.lastSyncAt).toBe(9)
    const written = []
    await restoreImages(next, staged, async (id, d) => { written.push([id, d]) })
    expect(written).toEqual([['a', 'data:image/jpeg;base64,BBB']])
  })
})
