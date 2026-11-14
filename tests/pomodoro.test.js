import { describe, it, expect, vi } from 'vitest'
import { PomodoroMachine } from '../electron/pomodoro'

function makeMachine () {
  let now = 1_000_000
  const events = []
  const m = new PomodoroMachine(() => now, e => events.push(e))
  return { m, events, advance: ms => { now += ms; m.tick() }, now: () => now, setNow: t => { now = t } }
}

describe('PomodoroMachine', () => {
  it('运行中持续广播 tick 事件（UI 倒计时数据源），暂停后停止', () => {
    vi.useFakeTimers()
    let now = 1_000_000
    const events = []
    const m = new PomodoroMachine(() => now, e => events.push(e))
    m.startFocus()
    events.length = 0
    vi.advanceTimersByTime(2100)
    const ticks = events.filter(e => e.type === 'tick')
    expect(ticks.length).toBeGreaterThanOrEqual(3)
    expect(ticks.every(e => e.phase === 'focus')).toBe(true)
    m.pause()
    events.length = 0
    vi.advanceTimersByTime(2100)
    expect(events.filter(e => e.type === 'tick').length).toBe(0)
    vi.useRealTimers()
    m.abort()
  })

  it('idle → focus，到时自动进入短休息并回调完成事件', () => {
    const { m, events, advance } = makeMachine()
    expect(m.snapshot().phase).toBe('idle')
    expect(m.startFocus('t-1')).toBe(true)
    expect(m.snapshot()).toMatchObject({ phase: 'focus', paused: false, taskId: 't-1' })

    advance(25 * 60000 + 1)
    expect(m.snapshot().phase).toBe('break')
    const end = events.find(e => e.type === 'phase-end' && e.phase === 'focus')
    expect(end).toMatchObject({ minutes: 25, taskId: 't-1', focusStreak: 1 })
  })

  it('经典 25/5 循环：第 4 个专注后进入长休息', () => {
    const { m, advance } = makeMachine()
    m.startFocus()
    for (let i = 0; i < 3; i++) {
      advance(25 * 60000 + 1) // focus → break
      expect(['break', 'longBreak']).toContain(m.snapshot().phase)
      advance(5 * 60000 + 1) // break → focus
    }
    expect(m.snapshot().phase).toBe('focus')
    advance(25 * 60000 + 1)
    expect(m.snapshot().phase).toBe('longBreak') // 第 4 个 → 长休
    advance(15 * 60000 + 1)
    expect(m.snapshot().phase).toBe('focus')
  })

  it('暂停/恢复基于绝对时间，不丢不漂', () => {
    const { m, advance, setNow } = makeMachine()
    m.startFocus()
    advance(10 * 60000)
    expect(m.pause()).toBe(true)
    const remaining = m.snapshot().remainingMs
    expect(remaining).toBeCloseTo(15 * 60000, -1)
    setNow(Date.now() + 3600_000) // 挂起一小时
    expect(m.resume()).toBe(true)
    expect(m.snapshot().remainingMs).toBe(remaining) // 恢复后剩余不变
    advance(remaining)
    expect(m.snapshot().phase).toBe('break') // 精准到时
  })

  it('休眠唤醒：时钟跳变后 tick 一次性补齐判定', () => {
    const { m, advance } = makeMachine()
    m.startFocus()
    advance(24 * 60000)
    advance(10 * 60000) // 跨过 endsAt（模拟休眠）
    expect(m.snapshot().phase).toBe('break')
  })

  it('skipBreak 跳过休息；abort 回 idle 不计完成', () => {
    const { m, events, advance } = makeMachine()
    m.startFocus()
    advance(25 * 60000 + 1)
    expect(m.skipBreak()).toBe(true)
    expect(m.snapshot().phase).toBe('focus')
    expect(m.abort()).toBe(true)
    expect(m.snapshot().phase).toBe('idle')
    expect(events.filter(e => e.type === 'phase-end').length).toBe(1) // 只有第一次专注计入
  })

  it('运行中不能重复 startFocus；configure 影响下一相位', () => {
    const { m, advance } = makeMachine()
    m.configure({ focus: 10 })
    m.startFocus()
    expect(m.startFocus()).toBe(false)
    advance(10 * 60000 + 1)
    expect(m.snapshot().phase).toBe('break')
  })
})
