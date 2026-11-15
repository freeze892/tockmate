/**
 * Pro 能力开关：完整版构建 PRO = true；公开核心版由静态变体覆盖为 PRO = false
 * 判定入口收敛在此文件，其他模块只 import PRO，不自行判断
 */
export const PRO = false

/**
 * 核心版占位：语法扩展整体静默，保持调用方接口不变
 */
export function applyProSyntax (text) {
  return { text }
}
