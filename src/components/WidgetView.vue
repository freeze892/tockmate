<template>
  <!-- 贴边收起条：5px 细条，整条即悬停热区 -->
  <div v-if="docked && !expanded" class="w-strip" :class="dockSide" @mouseenter="onStripEnter" @mousemove="onStripMove"></div>
  <!-- 锁定遮罩：应用锁开启期间悬浮窗不显示任何任务内容（锁的主目的就是防人偷看） -->
  <div v-else-if="locked" class="widget w-locked">
    <div class="wl-icon"><Icon name="lock" :size="18" /></div>
    <div class="wl-text">已锁定</div>
    <div class="wl-sub">解锁主界面后查看今日事项</div>
  </div>
  <!-- 完整视图 -->
  <div v-else class="widget" @mouseenter="onEnter" @mouseleave="onLeave" @dblclick="openMain">
    <div class="w-head">
      <span class="w-title">{{ todayLabel }}</span>
      <span class="w-count">{{ doneCount }}/{{ total }}</span>
      <button class="w-btn" :class="{ on: pinned }" :title="pinned ? '取消置顶' : '固定在最前'" @click="togglePin"><Icon name="pin" :size="12" /></button>
      <button class="w-btn" :class="{ on: docked }" :title="docked ? '取消贴边' : '贴边收进'" @click="toggleDock"><Icon name="dock" :size="12" /></button>
      <button class="w-btn" title="打开主界面" @click="openMain"><Icon name="max" :size="12" /></button>
      <button class="w-btn" title="隐藏悬浮窗" @click="hide"><Icon name="x" :size="12" /></button>
    </div>
    <div class="w-quick">
      <span class="wq-plus"><Icon name="plus" :size="10" :sw="2.5" /></span>
      <input ref="inputEl" v-model="raw" class="wq-input" placeholder="添加今天的事项，回车保存"
             @keydown.enter="quickSave" @keydown.esc="quickClear" />
    </div>
    <div class="w-parse" v-if="parsed.parsedLabel">将创建：{{ parsed.parsedLabel }}</div>
    <div class="w-list">
      <div v-for="t in tasks" :key="t.id" class="w-task" :class="{ done: t.completed, overdue: isOverdue(t) }"
           @click="toggleTask(t)">
        <span class="w-cb" :class="{ done: t.completed }"></span>
        <span class="w-title-t">{{ t.title }}</span>
        <span class="w-time" v-if="t.dueTime">{{ t.dueTime }}</span>
      </div>
      <div v-if="!tasks.length" class="w-empty">今天没有任务</div>
    </div>
    <div class="w-foot">双击打开主界面 · 拖动标题栏移动</div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount, nextTick } from 'vue'
import Icon from './Icon.vue'
import { useDataStore } from '../stores/data'
import { todayISO, diffDays, weekdayCN, shortDate } from '../utils/date'
import { parseQuickAdd } from '../utils/parseQuickAdd'

const store = useDataStore()
const today = todayISO()
const todayLabel = `${shortDate(today)} 周${weekdayCN(today).slice(1)}`

const tasks = computed(() => {
  return store.tasks
    .filter(t => !t.deletedAt && !t.completed && t.dueDate && diffDays(t.dueDate, today) <= 0)
    .sort((a, b) => {
      if (a.dueDate !== b.dueDate) return a.dueDate < b.dueDate ? -1 : 1
      if (a.dueTime !== b.dueTime) {
        if (!a.dueTime) return 1
        if (!b.dueTime) return -1
        return a.dueTime < b.dueTime ? -1 : 1
      }
      return b.priority - a.priority
    })
})
const total = computed(() => tasks.value.length + store.tasks.filter(t => !t.deletedAt && t.completed && t.completedAt && new Date(t.completedAt).toISOString().slice(0, 10) === today).length)
const doneCount = computed(() => store.tasks.filter(t => !t.deletedAt && t.completed && t.completedAt && new Date(t.completedAt).toISOString().slice(0, 10) === today).length)

// ── 快速添加（自然语言，无日期词默认今天）────────────────────────
const raw = ref('')
const inputEl = ref(null)
const parsed = computed(() => parseQuickAdd(raw.value, today))

async function quickSave () {
  const p = parsed.value
  const title = (p.title || '').trim()
  if (!title) return
  store.addTask({ title, dueDate: p.dueDate || today, dueTime: p.dueTime, priority: 0 })
  raw.value = ''
  await nextTick()
  inputEl.value && inputEl.value.focus()
}
function quickClear () { raw.value = '' }

function isOverdue (t) { return t.dueDate && diffDays(t.dueDate, today) < 0 }
function toggleTask (t) { store.toggleTask(t.id) }
function openMain () { window.api?.widget?.openMain() }
function hide () { window.api?.widget?.hide() }

// ── 应用锁感知：锁定期间不显示任何任务内容 ──────────────────────
const locked = ref(false)
function applyLockState (s) { if (s && typeof s.locked === 'boolean') locked.value = s.locked }

// ── 置顶 / 贴边 ─────────────────────────────────────────────────
const pinned = ref(true)
const dockSide = ref(null) // null | 'left' | 'right'
const docked = computed(() => !!dockSide.value)
const expanded = ref(true)

// 悬停展开用「真实移动门控」：收起条挂载瞬间 Chrome 会对静止光标补发 mouseenter（幻影事件），
// 若据此立即展开会造成「点贴边秒回弹」。只有近期发生过真实 mousemove 的进入才算悬停意图。
let lastRealMove = 0
function onGlobalMove () { lastRealMove = Date.now() }
const MOVE_FRESH_MS = 400

function onStripEnter () { /* 幻影/真实进入都先不展开，统一交给 mousemove 判定 */ }
function onStripMove () {
  if (!docked.value || expanded.value) return
  if (Date.now() - lastRealMove > MOVE_FRESH_MS) return // 静止光标（挂载期补发），不算悬停意图
  window.api?.widget?.dockExpand()
}

function togglePin () {
  window.api?.widget?.setPinned(!pinned.value).then(v => { if (typeof v === 'boolean') pinned.value = v })
}
function toggleDock () {
  window.api?.widget?.setDock(!docked.value)
}

let leaveTimer = null
function onEnter () {
  if (leaveTimer) { clearTimeout(leaveTimer); leaveTimer = null }
  if (docked.value && !expanded.value) window.api?.widget?.dockExpand()
}
function onLeave () {
  if (!docked.value || !expanded.value) return
  if (leaveTimer) clearTimeout(leaveTimer)
  leaveTimer = setTimeout(() => {
    leaveTimer = null
    window.api?.widget?.dockCollapse()
  }, 900)
}

function applyDockState (s) {
  if (!s) return
  dockSide.value = s.dock || null
  expanded.value = !!s.expanded
  if (typeof s.pinned === 'boolean') pinned.value = s.pinned
}

let keepAlive = null
onMounted(() => {
  if (!window.api) return
  window.addEventListener('mousemove', onGlobalMove, { passive: true, capture: true }) // 捕获期先于 strip 自身 handler 刷新时间戳
  window.api.widget.getState().then(applyDockState).catch(() => {})
  window.api.widget.onDockState(applyDockState)
  window.api.lock.status().then(applyLockState).catch(() => {})
  window.api.lock.onChanged(applyLockState)
  keepAlive = setInterval(() => {}, 100000) // 保持组件活跃
})
onBeforeUnmount(() => {
  if (keepAlive) clearInterval(keepAlive)
  if (leaveTimer) clearTimeout(leaveTimer)
  window.removeEventListener('mousemove', onGlobalMove, { capture: true })
})
</script>

<style scoped>
.widget{height:100vh;display:flex;flex-direction:column;background:var(--surface-elevated);border:1px solid var(--border-default);border-radius:12px;overflow:hidden;user-select:none}
.w-head{display:flex;align-items:center;gap:6px;padding:10px 12px;background:var(--surface-sidebar);border-bottom:1px solid var(--border-subtle);cursor:move;-webkit-app-region:drag}
.w-title{font-size:12.5px;font-weight:600;color:var(--text-primary);white-space:nowrap}
.w-count{margin-left:auto;font-size:11px;color:var(--text-tertiary);flex:none}
.w-btn{width:22px;height:22px;border:0;border-radius:5px;background:transparent;color:var(--text-tertiary);display:grid;place-items:center;cursor:default;padding:0;-webkit-app-region:no-drag;flex:none}
.w-btn:hover{background:var(--surface-hover);color:var(--text-primary)}
.w-btn.on{color:var(--accent);background:var(--accent-soft)}
.w-quick{display:flex;align-items:center;gap:8px;margin:8px 10px 0;padding:6px 8px;border-radius:7px;background:var(--surface-hover);border:1px solid var(--border-subtle)}
.wq-plus{width:16px;height:16px;border-radius:50%;background:var(--accent);color:#fff;display:grid;place-items:center;flex:none}
.wq-input{flex:1;border:0;background:transparent;font-size:12.5px;color:var(--text-primary);outline:none;min-width:0}
.wq-input::placeholder{color:var(--text-tertiary)}
.w-parse{padding:4px 14px 0;font-size:11px;color:var(--accent)}
.w-list{flex:1;overflow:auto;padding:6px 8px}
.w-task{display:flex;align-items:center;gap:8px;padding:7px 6px;border-radius:6px;font-size:13px;cursor:default}
.w-task:hover{background:var(--surface-hover)}
.w-task.overdue .w-title-t{color:var(--p-high)}
.w-cb{width:15px;height:15px;border-radius:50%;border:1.5px solid var(--text-tertiary);flex:none;cursor:default}
.w-cb.done{background:var(--success);border-color:var(--success);position:relative}
.w-cb.done::after{content:"";position:absolute;left:4px;top:1px;width:4px;height:8px;border:solid #fff;border-width:0 1.5px 1.5px 0;transform:rotate(45deg)}
.w-title-t{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--text-primary)}
.w-time{font-size:11px;color:var(--text-tertiary);flex:none}
.w-empty{text-align:center;padding:30px 0;font-size:12.5px;color:var(--text-tertiary)}
.w-foot{padding:6px 12px;font-size:10.5px;color:var(--text-tertiary);border-top:1px solid var(--border-subtle);background:var(--surface-sidebar)}
/* 贴边收起条：可见宽仅 5px（窗口其余部分移出屏幕外） */
.w-strip{height:100vh;width:100%;background:var(--accent);border-radius:0;user-select:none;cursor:default}
/* 锁定遮罩：不显示任何任务内容 */
.w-locked{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;background:var(--surface-elevated)}
.wl-icon{width:36px;height:36px;border-radius:50%;background:var(--surface-hover);color:var(--text-tertiary);display:grid;place-items:center}
.wl-text{font-size:12.5px;font-weight:600;color:var(--text-primary)}
.wl-sub{font-size:10.5px;color:var(--text-tertiary);text-align:center;padding:0 12px}
</style>
