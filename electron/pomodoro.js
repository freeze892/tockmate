/**
 * 番茄钟状态机（纯逻辑，可注入时钟以便测试）
 *
 * 相位：idle → focus →(到时)→ break/longBreak →(到时)→ focus → …
 * 计时基于绝对时间戳 endsAt（而非累加 tick），休眠/挂起后按真实时间一次性补齐，不漂移。
 * 长休息：连续完成 interval 个专注后进入 longBreak，否则 break。
 */
const TICK_MS = 500

class PomodoroMachine {
  /**
   * @param {() => number} clock 返回当前毫秒时间戳
   * @param {(evt) => void} onEvent 事件回调：{type: 'phase-start'|'phase-end'|'tick', phase, ...}
   */
  constructor (clock, onEvent = () => {}) {
    this.clock = clock
    this.onEvent = onEvent
    this.reset()
  }

  reset () {
    this.phase = 'idle' // idle | focus | break | longBreak
    this.endsAt = 0
    this.remainingMs = 0 // 暂停时暂存
    this.paused = false
    this.taskId = null
    this.focusStreak = 0 // 本次会话已连续完成的专注数
    this.durations = { focus: 25, shortBreak: 5, longBreak: 15, interval: 4 }
    this.sessionStartedAt = 0
    this._timer = null
    this._clearTimer()
  }

  _clearTimer () {
    if (this._timer) { clearInterval(this._timer); this._timer = null }
  }

  _armTimer () {
    this._clearTimer()
    // 500ms 自查到期 + 广播 tick 事件（UI 倒计时靠它走动）
    this._timer = setInterval(() => {
      this.tick()
      if (this.phase !== 'idle' && !this.paused) this.onEvent({ type: 'tick', phase: this.phase })
    }, TICK_MS)
  }

  /** 配置时长（分钟），运行中修改对下一相位生效 */
  configure ({ focus, shortBreak, longBreak, interval } = {}) {
    if (focus) this.durations.focus = focus
    if (shortBreak) this.durations.shortBreak = shortBreak
    if (longBreak) this.durations.longBreak = longBreak
    if (interval) this.durations.interval = interval
  }

  /** 开始专注。返回 false 表示已在进行中 */
  startFocus (taskId = null) {
    if (this.phase !== 'idle') return false
    this.taskId = taskId
    this.focusStreak = 0
    this.sessionStartedAt = this.clock()
    this._enter('focus')
    return true
  }

  pause () {
    if (this.phase === 'idle' || this.paused) return false
    this.remainingMs = Math.max(0, this.endsAt - this.clock())
    this.paused = true
    this._clearTimer()
    this.onEvent({ type: 'paused', phase: this.phase, remainingMs: this.remainingMs })
    return true
  }

  resume () {
    if (this.phase === 'idle' || !this.paused) return false
    this.endsAt = this.clock() + this.remainingMs
    this.paused = false
    this._armTimer()
    this.onEvent({ type: 'resumed', phase: this.phase, endsAt: this.endsAt })
    return true
  }

  /** 中止当前相位回到 idle（不计入完成） */
  abort () {
    const had = this.phase !== 'idle'
    this._clearTimer()
    this.phase = 'idle'
    this.endsAt = 0
    this.remainingMs = 0
    this.paused = false
    this.focusStreak = 0
    if (had) this.onEvent({ type: 'aborted' })
    return had
  }

  /** 跳过当前休息直接进入下一专注 */
  skipBreak () {
    if (this.phase !== 'break' && this.phase !== 'longBreak') return false
    this._clearTimer()
    this._enter('focus')
    return true
  }

  setTask (taskId) { this.taskId = taskId }

  /** 周期检查相位到期；休眠唤醒后也会立即补齐判定 */
  tick () {
    if (this.phase === 'idle' || this.paused) return
    const now = this.clock()
    if (now >= this.endsAt) this._completePhase()
  }

  /** 快进用于测试：直接推进时钟后调用 tick */
  _completePhase () {
    this._clearTimer()
    const endedPhase = this.phase
    const durationMin = this.durations[endedPhase === 'focus' ? 'focus' : (endedPhase === 'longBreak' ? 'longBreak' : 'shortBreak')]
    if (endedPhase === 'focus') {
      this.focusStreak += 1
      const isLong = this.durations.interval > 0 && this.focusStreak % this.durations.interval === 0
      this.onEvent({ type: 'phase-end', phase: 'focus', minutes: durationMin, taskId: this.taskId, focusStreak: this.focusStreak })
      this._enter(isLong ? 'longBreak' : 'break')
    } else {
      this.onEvent({ type: 'phase-end', phase: endedPhase, minutes: durationMin })
      this._enter('focus')
    }
  }

  _enter (phase) {
    this.phase = phase
    const minutes = phase === 'focus' ? this.durations.focus
      : phase === 'longBreak' ? this.durations.longBreak : this.durations.shortBreak
    this.endsAt = this.clock() + minutes * 60000
    this.remainingMs = 0
    this.paused = false
    this._armTimer()
    this.onEvent({ type: 'phase-start', phase, endsAt: this.endsAt, minutes })
  }

  /** UI 快照 */
  snapshot () {
    const remainingMs = this.phase === 'idle' ? 0
      : this.paused ? this.remainingMs
        : Math.max(0, this.endsAt - this.clock())
    return {
      phase: this.phase,
      paused: this.paused,
      remainingMs,
      totalMs: this.phase === 'idle' ? 0
        : (this.phase === 'focus' ? this.durations.focus
          : this.phase === 'longBreak' ? this.durations.longBreak : this.durations.shortBreak) * 60000,
      taskId: this.taskId,
      focusStreak: this.focusStreak
    }
  }
}

module.exports = { PomodoroMachine }
