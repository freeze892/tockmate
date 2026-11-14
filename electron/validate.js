/**
 * 安全护栏纯函数（无 electron 依赖，可单测）
 */

/** 安全 id：仅字母数字下划线连字符，1-64 位（genId 产出均满足） */
function isSafeId (id) {
  return typeof id === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(id)
}

/**
 * Windows cmd.exe 参数安全引用：双引号包裹 + 内部引号加倍
 * JSON.stringify 不是 shell 转义——cmd 不认反斜杠转义，含 `"` 的任务标题
 * 会闭合引号并注入 `& 任意命令`。加倍写法是 cmd 下的标准转义。
 */
function cmdQuote (s) {
  return '"' + String(s ?? '').replace(/"/g, '""') + '"'
}

/** 同步远端 settings 中「仅本机」的键：远端值永远不落地，保留本地值 */
const LOCAL_ONLY_SETTINGS = ['autoRunCommand', 'agents', 'quickShortcut', 'appLock']

function sanitizeRemoteSettings (remoteSettings = {}, localSettings = {}) {
  const merged = { ...(remoteSettings || {}) }
  for (const key of LOCAL_ONLY_SETTINGS) {
    if (localSettings && localSettings[key] !== undefined) merged[key] = localSettings[key]
    else delete merged[key]
  }
  return merged
}

module.exports = { isSafeId, cmdQuote, LOCAL_ONLY_SETTINGS, sanitizeRemoteSettings }
