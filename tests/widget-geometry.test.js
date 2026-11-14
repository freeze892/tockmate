import { describe, it, expect } from 'vitest'
import { STRIP_W, STRIP_VISIBLE, SNAP_PX, nearestDockSide, dockBounds, freeBounds, decideAfterMove, clampPosition, stripTargetX, visibleWidth } from '../electron/widget-geometry'

// 1920×1040 工作区（1080p 减任务栏）
const wa = { x: 0, y: 0, width: 1920, height: 1040 }

describe('widget-geometry 贴边几何', () => {
  it('nearestDockSide：窗口中心偏左吸左缘，偏右吸右缘', () => {
    expect(nearestDockSide({ x: 100, y: 0, width: 300, height: 420 }, wa)).toBe('left')
    expect(nearestDockSide({ x: 1500, y: 0, width: 300, height: 420 }, wa)).toBe('right')
    // 恰好在正中也应有确定结果（< 为左，>= 为右）
    expect(nearestDockSide({ x: 810, y: 0, width: 300, height: 420 }, wa)).toBe('right')
  })

  it('dockBounds：右缘收起只露 16px，展开恢复全宽', () => {
    const strip = dockBounds('right', wa, 100, false, 300, 420)
    expect(strip).toEqual({ x: wa.width - STRIP_W, y: 100, width: STRIP_W, height: 420 })
    const full = dockBounds('right', wa, 100, true, 300, 420)
    expect(full).toEqual({ x: wa.width - 300, y: 100, width: 300, height: 420 })
  })

  it('dockBounds：左缘收起/展开都从 wa.x 起算（支持多显示器非零原点）', () => {
    const wa2 = { x: -1920, y: 0, width: 1920, height: 1040 }
    const strip = dockBounds('left', wa2, 50, false, 300, 420)
    expect(strip.x).toBe(-1920)
    expect(strip.width).toBe(STRIP_W)
    const full = dockBounds('left', wa2, 50, true, 300, 420)
    expect(full.x).toBe(-1920)
    expect(full.width).toBe(300)
  })

  it('decideAfterMove：贴近右缘→right；贴近左缘→left；拖离双缘→取消贴边', () => {
    // 右缘附近（窗口右沿距屏右 20px）
    expect(decideAfterMove({ x: 1600, y: 10, width: 300, height: 420 }, wa)).toEqual({ undock: false, side: 'right' })
    // 左缘附近
    expect(decideAfterMove({ x: 8, y: 10, width: 300, height: 420 }, wa)).toEqual({ undock: false, side: 'left' })
    // 拖到屏幕中间
    expect(decideAfterMove({ x: 800, y: 10, width: 300, height: 420 }, wa)).toEqual({ undock: true, side: null })
    // 恰好等于阈值 → 仍算贴边
    expect(decideAfterMove({ x: wa.width - 300 - SNAP_PX, y: 0, width: 300, height: 420 }, wa).undock).toBe(false)
    // 超过阈值 1px → 取消
    expect(decideAfterMove({ x: wa.width - 300 - SNAP_PX - 1, y: 0, width: 300, height: 420 }, wa).undock).toBe(true)
  })

  it('clampPosition：可见位置原样返回，完全出界复位到默认', () => {
    expect(clampPosition(100, 100, 300, wa)).toEqual({ x: 100, y: 100, clamped: false })
    const off = clampPosition(-5000, 100, 300, wa)
    expect(off.clamped).toBe(true)
    expect(off.x).toBe(wa.width - 320)
    const down = clampPosition(100, 5000, 300, wa)
    expect(down.clamped).toBe(true)
  })

  it('freeBounds：返回展开尺寸', () => {
    expect(freeBounds(10, 20, 320, 500)).toEqual({ x: 10, y: 20, width: 320, height: 500 })
  })

  it('stripTargetX：右贴边可见 10px，其余移出屏外', () => {
    // Windows 把 16px 钳到 32px 后，用实际宽度 32 摆位
    const x = stripTargetX('right', wa, 32, STRIP_VISIBLE)
    expect(x).toBe(wa.width - STRIP_VISIBLE)
    const bounds = { x, y: 0, width: 32, height: 420 }
    expect(visibleWidth('right', wa, bounds)).toBe(STRIP_VISIBLE)
  })

  it('stripTargetX：左贴边可见 10px，窗口左侧移出屏外', () => {
    const x = stripTargetX('left', wa, 32, STRIP_VISIBLE)
    expect(x).toBe(wa.x - (32 - STRIP_VISIBLE))
    const bounds = { x, y: 0, width: 32, height: 420 }
    expect(visibleWidth('left', wa, bounds)).toBe(STRIP_VISIBLE)
  })

  it('visibleWidth：非零原点多显示器工作区同样成立', () => {
    const wa2 = { x: -1920, y: 0, width: 1920, height: 1040 }
    const x = stripTargetX('left', wa2, 32)
    expect(visibleWidth('left', wa2, { x, y: 0, width: 32, height: 420 })).toBe(STRIP_VISIBLE)
  })
})
