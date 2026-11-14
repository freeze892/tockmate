/**
 * 悬浮窗贴边几何（纯函数，无 electron 依赖，可单测）
 * bounds/workArea 均为 { x, y, width, height }
 */

const STRIP_W = 16 // 贴边收起条窗口请求宽度（Windows 可能钳制到更大，需按实际宽度重新摆位）
const STRIP_VISIBLE = 3 // 收起条目标可见宽度（发丝线级；窗口其余部分移出屏幕外）
const SNAP_PX = 56 // 距屏幕边缘多少像素内算「贴边」

/**
 * 依据窗口中心判定应吸附的屏幕边缘
 */
function nearestDockSide (bounds, wa) {
  const cx = bounds.x + bounds.width / 2
  const mid = wa.x + wa.width / 2
  return cx - wa.x < wa.x + wa.width - cx ? 'left' : 'right'
}

/**
 * 贴边模式下的目标 bounds
 * @param {'left'|'right'} side
 * @param {boolean} expanded true=完整展开宽度 false=只露导航条
 */
function dockBounds (side, wa, y, expanded, fullW, fullH, stripW = STRIP_W) {
  const width = expanded ? fullW : stripW
  const x = side === 'right' ? wa.x + wa.width - width : wa.x
  return { x, y, width, height: fullH }
}

/**
 * 自由模式目标 bounds（展开尺寸 + 记忆位置）
 */
function freeBounds (x, y, fullW, fullH) {
  return { x, y, width: fullW, height: fullH }
}

/**
 * 贴边状态下用户拖动后的裁决
 * 返回 { undock: boolean, side: 'left'|'right' }：远离双边缘→取消贴边，否则吸附到更近一侧
 */
function decideAfterMove (bounds, wa, snapPx = SNAP_PX) {
  const distRight = Math.abs((bounds.x + bounds.width) - (wa.x + wa.width))
  const distLeft = Math.abs(bounds.x - wa.x)
  if (Math.min(distLeft, distRight) > snapPx) return { undock: true, side: null }
  return { undock: false, side: distLeft <= distRight ? 'left' : 'right' }
}

/**
 * 位置越界修复：完全看不见窗口时返回安全默认位置，否则原样返回
 */
function clampPosition (x, y, w, wa, margin = 60) {
  const visible = x + w > wa.x + margin && x < wa.x + wa.width - margin &&
    y + 40 > wa.y && y < wa.y + wa.height - margin
  if (visible) return { x, y, clamped: false }
  return { x: wa.x + wa.width - 320, y: wa.y + 120, clamped: true }
}

/**
 * 收起条摆位：以「可见宽 = visibleW」为目标，窗口多出的部分移出屏幕外
 * Windows 对窄窗口有最小宽度钳制（实测 16px 会被钳到 32px 且保持中心），
 * 因此用钳制后的实际宽度直接定 x，绕开钳制
 * @returns {number} 目标 x
 */
function stripTargetX (side, wa, actualW, visibleW = STRIP_VISIBLE) {
  return side === 'right' ? wa.x + wa.width - visibleW : wa.x - (actualW - visibleW)
}

/**
 * 当前收起条可见宽度（正值=贴边侧可见多少像素）
 */
function visibleWidth (side, wa, bounds) {
  return side === 'right' ? (wa.x + wa.width) - bounds.x : (bounds.x + bounds.width) - wa.x
}

module.exports = { STRIP_W, STRIP_VISIBLE, SNAP_PX, nearestDockSide, dockBounds, freeBounds, decideAfterMove, clampPosition, stripTargetX, visibleWidth }
