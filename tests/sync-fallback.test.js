import { describe, it, expect } from 'vitest'
import { pullAny, pushAny, REMOTE_FILE, FALLBACK_FILE } from '../electron/sync'

const DOC = { lists: [], tasks: [], habits: [] }

function stubClient ({ dirPutFails = false, files = {} } = {}) {
  return {
    async createDirectory () {
      if (dirPutFails) { const e = new Error('Invalid response: 409 Conflict'); throw e }
    },
    async putFileContents (file, body) {
      if (dirPutFails && file === REMOTE_FILE) { const e = new Error('Invalid response: 409 Conflict'); throw e }
      files[file] = body
    },
    async getFileContents (file) {
      if (!(file in files)) { const e = new Error(`Invalid response: 404 Not Found`); e.status = 404; throw e }
      return files[file]
    }
  }
}

describe('pushAny 回退', () => {
  it('正常服务器：写入 目录/data.json', async () => {
    const files = {}
    const loc = await pushAny(stubClient({ files }), DOC)
    expect(loc).toBe(REMOTE_FILE)
    expect(JSON.parse(files[REMOTE_FILE])).toEqual(DOC)
  })

  it('坚果云式限制：MKCOL/主位置 PUT 409 → 自动回退根目录单文件', async () => {
    const files = {}
    const loc = await pushAny(stubClient({ dirPutFails: true, files }), DOC)
    expect(loc).toBe(FALLBACK_FILE)
    expect(JSON.parse(files[FALLBACK_FILE])).toEqual(DOC)
  })
})

describe('pullAny 回退', () => {
  it('主位置 404 → null（无需回退）', async () => {
    expect(await pullAny(stubClient({ files: {} }))).toBe(null)
  })

  it('主位置不存在但回退位置有数据 → 读到', async () => {
    const client = stubClient({ files: {} })
    files_fix(client, { [FALLBACK_FILE]: JSON.stringify(DOC) })
    expect(await pullAny(client)).toEqual(DOC)
  })

  it('两处都 404 → null', async () => {
    expect(await pullAny(stubClient({ files: {} }))).toBe(null)
  })
})

function files_fix (client, map) {
  client.getFileContents = async file => {
    if (!(file in map)) { const e = new Error('Invalid response: 404 Not Found'); e.status = 404; throw e }
    return map[file]
  }
}
