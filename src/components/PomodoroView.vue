<template>
  <section class="main">
    <div class="focus-wrap">
      <span class="state-chip" :class="phaseClass">
        <span class="pulse"></span>{{ phaseText }}
      </span>

      <div class="linked">
        <select v-if="idle" class="task-select" v-model="selectedTaskId">
          <option :value="null">不关联任务</option>
          <option v-for="t in activeTasks" :key="t.id" :value="t.id">
            {{ t.title }}{{ listName(t.listId) ? ' · ' + listName(t.listId) : '' }}
          </option>
        </select>
        <span v-else class="linked-task">
          <span v-if="linkedDot" class="ldot" :style="{ background: linkedDot }"></span>
          {{ linkedTitle || '自由专注' }}
        </span>
      </div>

      <div class="ring-wrap">
        <svg width="190" height="190" viewBox="0 0 190 190">
          <circle class="ring-bg" cx="95" cy="95" r="85" fill="none" stroke-width="10" />
          <circle class="ring-fg" :class="ringClass" cx="95" cy="95" r="85" fill="none" stroke-width="10"
                  stroke-linecap="round" :stroke-dasharray="CIRC" :stroke-dashoffset="offset" />
        </svg>
        <div class="ring-center">
          <div class="timer">{{ timeText }}</div>
          <div class="phase">{{ phaseHint }}</div>
        </div>
      </div>

      <div class="pomo-dots">
        <span v-for="i in settings.interval" :key="i" :class="{ on: dotOn(i) }"></span>
      </div>

      <div class="controls">
        <template v-if="st.phase === 'idle'">
          <button class="btn primary big" @click="start"><Icon name="play" :size="16" />开始专注</button>
        </template>
        <template v-else-if="st.paused">
          <button class="btn primary big" @click="resume"><Icon name="play" :size="16" />继续</button>
          <button class="btn ghost big" @click="reset">放弃</button>
        </template>
        <template v-else-if="st.phase === 'focus'">
          <button class="btn primary big" @click="pause"><Icon name="pause" :size="16" />暂停</button>
          <button class="btn ghost big" @click="reset">放弃</button>
        </template>
        <template v-else>
          <button class="btn primary big" @click="pause"><Icon name="pause" :size="16" />暂停</button>
          <button class="btn ghost big" @click="skip">跳过休息</button>
        </template>
      </div>
    </div>

    <div class="stats">
      <div class="stat"><div class="num">{{ todayPomos }}<em>个</em></div><div class="lab">今日番茄</div></div>
      <div class="stat"><div class="num">{{ todayMinutes }}<em>分钟</em></div><div class="lab">今日专注</div></div>
      <div class="stat"><div class="num">{{ streakDays }}<em>天</em></div><div class="lab">连续专注</div></div>
    </div>

    <div class="today-log">
      <div class="log-head">今日专注记录<span>共 {{ todayLogs.length }} 次番茄</span></div>
      <div v-if="!todayLogs.length" class="log-empty">今天还没有专注记录</div>
      <div v-for="(l, i) in todayLogs" :key="i" class="log-row">
        <span class="time">{{ logTime(l) }}</span>
        <span class="ltask">
          <span v-if="listColor(l.taskId)" class="ldot" :style="{ background: listColor(l.taskId), width: '6px', height: '6px', margin: '0 6px 0 0' }"></span>
          {{ taskTitle(l.taskId) }}
        </span>
        <span class="len">{{ l.minutes }} 分钟</span>
        <Icon name="check" class="ok" :size="15" />
      </div>
    </div>
  </section>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import Icon from './Icon.vue'
import { useDataStore } from '../stores/data'
import { todayISO, toISODate, localDateStr } from '../utils/date'

const CIRC = 2 * Math.PI * 85
const store = useDataStore()
const settings = computed(() => store.settings.pomodoro)
const st = ref({ phase: 'idle', paused: false, remainingMs: 0, totalMs: 0, taskId: null, focusStreak: 0 })
const selectedTaskId = ref(null)
let offState = null

onMounted(async () => {
  st.value = await window.api.pomodoro.get()
  offState = window.api.pomodoro.onState(s => { st.value = s })
})
onBeforeUnmount(() => { if (offState) offState() })

const idle = computed(() => st.value.phase === 'idle')
const activeTasks = computed(() => store.tasks.filter(t => !t.completed && !t.deletedAt).slice(0, 50))
const linkedTitle = computed(() => {
  const t = store.tasks.find(x => x.id === st.value.taskId)
  return t ? t.title : ''
})
const linkedDot = computed(() => {
  const t = store.tasks.find(x => x.id === st.value.taskId)
  const l = t && store.lists.find(x => x.id === t.listId)
  return l ? l.color : null
})

const phaseText = computed(() => {
  if (st.value.phase === 'idle') return '准备开始'
  if (st.value.paused) return '已暂停'
  if (st.value.phase === 'focus') return '专注中'
  return st.value.phase === 'longBreak' ? '长休息' : '短休息'
})
const phaseHint = computed(() => {
  if (st.value.phase === 'idle') return `专注 ${settings.value.focus} 分钟 · 长休间隔 ${settings.value.interval} 个`
  const kind = st.value.phase === 'focus' ? '专注' : st.value.phase === 'longBreak' ? '长休息' : '短休息'
  return `第 ${st.value.focusStreak + (st.value.phase === 'focus' ? 1 : 0)} 个番茄 · ${kind}`
})
const ringClass = computed(() => {
  if (st.value.phase === 'focus') return 'is-focus'
  if (st.value.phase === 'idle') return 'is-idle'
  return 'is-break'
})
const phaseClass = computed(() => {
  if (st.value.phase === 'focus') return 'is-focus'
  if (st.value.phase === 'idle') return 'is-idle'
  return 'is-break'
})

const remainSec = computed(() => Math.ceil(st.value.remainingMs / 1000))
const timeText = computed(() => {
  const s = st.value.phase === 'idle' ? settings.value.focus * 60 : remainSec.value
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
})
const offset = computed(() => {
  if (st.value.phase === 'idle') return CIRC * (1 - (settings.value.focus * 60000) / (settings.value.focus * 60000 || 1)) * 0 // idle 满环
  const frac = st.value.totalMs ? st.value.remainingMs / st.value.totalMs : 1
  return CIRC * (1 - frac)
})

function dotOn (i) {
  const done = st.value.focusStreak % settings.value.interval
  return i <= (done === 0 && st.value.focusStreak > 0 ? settings.value.interval : done)
}

function start () {
  window.api.pomodoro.start({
    taskId: selectedTaskId.value,
    durations: {
      focus: settings.value.focus,
      shortBreak: settings.value.shortBreak,
      longBreak: settings.value.longBreak,
      interval: settings.value.interval
    }
  })
}
const pause = () => window.api.pomodoro.pause()
const resume = () => window.api.pomodoro.resume()
const reset = () => window.api.pomodoro.reset()
const skip = () => window.api.pomodoro.skip()

const todayLogs = computed(() => {
  const t = todayISO()
  return (store.pomodoro.logs || []).filter(l => localDateStr(l.startedAt) === t)
})
const todayPomos = computed(() => todayLogs.value.length)
const todayMinutes = computed(() => todayLogs.value.reduce((a, l) => a + (l.minutes || 0), 0))
const streakDays = computed(() => {
  const days = new Set((store.pomodoro.logs || []).map(l => localDateStr(l.startedAt)))
  let n = 0
  const d = new Date()
  for (;;) {
    const iso = toISODate(d)
    if (days.has(iso)) { n++; d.setDate(d.getDate() - 1) } else break
  }
  return n
})
function logTime (l) {
  const d = new Date(l.startedAt)
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  const end = new Date(l.startedAt + (l.minutes || 0) * 60000)
  return `${hh}:${mm} - ${String(end.getHours()).padStart(2, '0')}:${String(end.getMinutes()).padStart(2, '0')}`
}
function taskTitle (taskId) {
  if (!taskId) return '自由专注'
  return store.tasks.find(t => t.id === taskId)?.title || '已删除的任务'
}
function listName (listId) {
  return store.lists.find(l => l.id === listId)?.name || ''
}
function listColor (taskId) {
  const t = store.tasks.find(x => x.id === taskId)
  const l = t && store.lists.find(x => x.id === t.listId)
  return l ? l.color : null
}
</script>

<style scoped>
.main{display:flex;flex-direction:column;min-width:0;min-height:0;overflow:auto}
.focus-wrap{display:flex;flex-direction:column;align-items:center;padding:16px 24px 8px}
.state-chip{display:inline-flex;align-items:center;gap:6px;padding:4px 12px;border-radius:999px;font-size:12px;font-weight:600}
.state-chip.is-focus{background:var(--accent-soft);color:var(--accent)}
.state-chip.is-break{background:rgba(59,165,93,.14);color:var(--success)}
.state-chip.is-idle{background:var(--surface-hover);color:var(--text-secondary)}
.state-chip .pulse{width:6px;height:6px;border-radius:50%;background:currentColor}
.linked{margin-top:10px}
.task-select{height:30px;border:1px solid var(--border-default);border-radius:6px;background:var(--surface-elevated);color:var(--text-primary);font-size:13px;padding:0 8px;outline:none}
.linked-task{display:inline-flex;align-items:center;gap:8px;padding:5px 12px;border-radius:6px;border:1px solid var(--border-default);font-size:13px}
.linked-task .ldot{margin:0}
.ring-wrap{position:relative;width:190px;height:190px;margin:14px 0 4px}
.ring-bg{stroke:var(--border-subtle)}
.ring-fg.is-focus{stroke:var(--accent)}
.ring-fg.is-break{stroke:var(--success)}
.ring-fg.is-idle{stroke:var(--border-default)}
.ring-center{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center}
.timer{font-family:"Cascadia Mono","Consolas",monospace;font-size:44px;font-weight:600;letter-spacing:-.01em;line-height:1;font-variant-numeric:tabular-nums}
.ring-center .phase{font-size:12px;color:var(--text-tertiary);margin-top:6px}
.pomo-dots{display:flex;gap:8px;margin-top:8px}
.pomo-dots span{width:8px;height:8px;border-radius:50%;background:var(--border-default)}
.pomo-dots span.on{background:var(--accent)}
.controls{display:flex;gap:12px;margin-top:14px}
.btn.big{height:36px;padding:0 20px;border-radius:8px;font-size:14px}

.stats{display:grid;grid-template-columns:repeat(3,200px);gap:14px;justify-content:center;margin:14px 0 4px}
.stat{border:1px solid var(--border-default);border-radius:10px;padding:12px 16px;text-align:center}
.stat .num{font-size:22px;font-weight:600;letter-spacing:-.01em}
.stat .num em{font-style:normal;font-size:13px;font-weight:400;color:var(--text-secondary);margin-left:3px}
.stat .lab{font-size:12px;color:var(--text-tertiary);margin-top:3px}

.today-log{width:640px;margin:10px auto 18px;border:1px solid var(--border-default);border-radius:10px;overflow:hidden}
.log-head{display:flex;align-items:center;padding:9px 16px;font-size:13px;font-weight:600;border-bottom:1px solid var(--border-subtle);background:var(--surface-sidebar)}
.log-head span{margin-left:auto;font-size:12px;font-weight:400;color:var(--text-tertiary)}
.log-empty{padding:16px;font-size:13px;color:var(--text-tertiary);text-align:center}
.log-row{display:flex;align-items:center;gap:12px;padding:8px 16px;border-bottom:1px solid var(--border-subtle);font-size:13px}
.log-row:last-child{border-bottom:0}
.log-row .time{font-family:"Cascadia Mono","Consolas",monospace;color:var(--text-secondary);font-size:12px;width:110px}
.log-row .ltask{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.log-row .len{color:var(--text-tertiary);font-size:12px}
.log-row .ok{color:var(--success)}
</style>
