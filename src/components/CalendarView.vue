<template>
  <section class="main">
    <div class="cal-head">
      <h1>{{ store.viewTitle }}</h1>
      <div class="seg" style="margin-left:8px">
        <button @click="store.setViewMode('list')">列表</button>
        <button class="on">日历</button>
      </div>
      <div class="month-nav">
        <button class="iconbtn" title="上一月" @click="navMonth(-1)"><Icon name="chev-l" /></button>
        <span class="label">{{ year }}年{{ month + 1 }}月</span>
        <button class="iconbtn" title="下一月" @click="navMonth(1)"><Icon name="chev-r" /></button>
      </div>
      <button class="btn ghost" @click="goToday">今天</button>
    </div>

    <div class="cal">
      <div class="week-head">
        <div v-for="w in WEEKS" :key="w">{{ w }}</div>
      </div>
      <div class="grid" :style="{ gridTemplateRows: `repeat(${weeks.length}, minmax(0,1fr))` }">
        <div v-for="iso in allDays" :key="iso" class="cell"
             :class="{ dim: !inMonth(iso), today: iso === today, dropTarget: dragOverIso === iso }"
             @click="openNewTask(iso)"
             @dragover.prevent="dragOverIso = iso"
             @drop.prevent="onDropToDate(iso)">
          <span class="dnum">{{ dayNum(iso) }}</span>

          <div v-for="t in visibleTasks(iso)" :key="t.id" class="pill"
               :class="{ done: t.completed }" draggable="true"
               @dragstart="onDragStart($event, t)" @dragend="dragTask = null"
               @click.stop="store.selectTask(t.id)">
            <button class="pcheck" :class="{ on: t.completed }" :title="t.completed ? '标记未完成' : '标记完成'"
                    @click.stop="store.toggleTask(t.id)"></button>
            <span class="bar" :style="{ background: listColor(t) }"></span>
            <span v-if="t.dueTime" class="t">{{ t.dueTime }}</span>
            <span class="n">{{ t.title }}</span>
          </div>
          <button v-if="moreCount(iso) > 0" class="more" @click.stop="dayPopIso = dayPopIso === iso ? null : iso">
            还有 {{ moreCount(iso) }} 项
          </button>

          <!-- 单日全部任务浮层 -->
          <div v-if="dayPopIso === iso" class="popover day-pop" @click.stop>
            <div class="day-pop-title">{{ friendlyDate(iso) }}</div>
            <div class="day-pop-list">
              <div v-for="t in allTasks(iso)" :key="t.id" class="day-pop-row">
                <button class="cb" :class="{ done: t.completed }" @click="store.toggleTask(t.id)"></button>
                <span class="dp-title" :class="{ strike: t.completed }" @click="openDetail(t)">{{ t.title }}</span>
                <button class="op" title="删除" @click="removeTask(t)"><Icon name="trash" :size="13" /></button>
              </div>
            </div>
            <button class="pop-item add-in-day" @mousedown.prevent @click="openNewTask(iso, true)">
              <Icon name="plus" :size="13" />新建任务
            </button>
          </div>

          <!-- 格子内快速新建 -->
          <div v-if="newTaskIso === iso" class="popover new-pop" @click.stop>
            <div class="new-pop-title">{{ friendlyDate(iso) }} 新建任务</div>
            <input ref="newInput" v-model="newTitle" class="pop-input" placeholder="标题，回车保存"
                   @keydown.enter="saveNew(iso)" @keydown.esc="closeNewTask" />
            <button class="pop-item" @mousedown.prevent @click="saveNew(iso)"><Icon name="check" :size="13" />保存</button>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup>
import { ref, computed, nextTick, onMounted, onBeforeUnmount } from 'vue'
import Icon from './Icon.vue'
import { useDataStore } from '../stores/data'
import { monthMatrix, isoMonthDay, sameMonth } from '../utils/calendar'
import { todayISO, friendlyDate, diffDays } from '../utils/date'
import { sortTasks, isActive } from '../utils/smartViews'

const WEEKS = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']
const MAX_PILLS = 3

const store = useDataStore()
const now = new Date()
const year = ref(now.getFullYear())
const month = ref(now.getMonth())
const today = todayISO()

const dayPopIso = ref(null)
const dragTask = ref(null)
const dragOverIso = ref(null)
const newTaskIso = ref(null)
const newTitle = ref('')
const newInput = ref(null)

const weeks = computed(() => monthMatrix(year.value, month.value))
const allDays = computed(() => weeks.value.flat())

// 日历范围：选中清单 → 该清单任务；智能视图 → 全部任务（按日期落格）
const scopedTasks = computed(() => {
  const base = store.tasks.filter(t => !t.deletedAt && t.dueDate)
  if (store.view.type === 'list') return base.filter(t => t.listId === store.view.id)
  return base
})
const byDate = computed(() => {
  const map = {}
  for (const t of scopedTasks.value) (map[t.dueDate] = map[t.dueDate] || []).push(t)
  for (const k in map) map[k] = sortTasks(map[k])
  return map
})

function inMonth (iso) { return sameMonth(iso, year.value, month.value) }
function dayNum (iso) { return isoMonthDay(iso) }
function visibleTasks (iso) { return (byDate.value[iso] || []).slice(0, MAX_PILLS) }
function allTasks (iso) { return byDate.value[iso] || [] }
function moreCount (iso) { return Math.max(0, allTasks(iso).length - MAX_PILLS) }
function listColor (t) {
  const l = store.lists.find(x => x.id === t.listId)
  return l ? l.color : 'var(--text-tertiary)'
}

function onDragStart (e, t) {
  dragTask.value = t
  e.dataTransfer.effectAllowed = 'move'
  e.dataTransfer.setData('text/plain', t.id)
}
function onDropToDate (iso) {
  const t = dragTask.value
  dragOverIso.value = null
  if (!t || t.dueDate === iso) return
  store.updateTask(t.id, { dueDate: iso })
}
function navMonth (n) {
  const d = new Date(year.value, month.value + n, 1)
  year.value = d.getFullYear()
  month.value = d.getMonth()
  dayPopIso.value = null
  newTaskIso.value = null
}
function goToday () {
  const d = new Date()
  year.value = d.getFullYear()
  month.value = d.getMonth()
  dayPopIso.value = null
  newTaskIso.value = null
}

function openNewTask (iso, keepPop) {
  if (!keepPop) dayPopIso.value = null
  newTaskIso.value = iso
  newTitle.value = ''
  store.selectTask(null) // 开始新建即关闭右侧旧详情
  // v-for 内的 ref 是数组，取第一个元素再聚焦
  nextTick(() => {
    const el = Array.isArray(newInput.value) ? newInput.value[0] : newInput.value
    el && el.focus()
  })
}
function closeNewTask () { newTaskIso.value = null; newTitle.value = '' }
function saveNew (iso) {
  const title = newTitle.value.trim()
  if (!title) { closeNewTask(); return }
  store.addTask({ title, listId: store.view.type === 'list' ? store.view.id : store.activeLists[0]?.id, dueDate: iso })
  closeNewTask()
}
function openDetail (t) {
  dayPopIso.value = null
  store.selectTask(t.id)
}
function removeTask (t) {
  if (window.confirm(`删除任务「${t.title}」？`)) store.deleteTask(t.id)
}

function onOutside () { dayPopIso.value = null }
onMounted(() => window.addEventListener('click', onOutside))
onBeforeUnmount(() => window.removeEventListener('click', onOutside))

// diffDays 引用保留用于逾期着色（未来扩展）
void diffDays; void isActive
</script>

<style scoped>
.main{display:flex;flex-direction:column;min-width:0;min-height:0}
.cal-head{display:flex;align-items:center;gap:12px;padding:16px 24px 14px}
.cal-head h1{font-size:20px;font-weight:600;letter-spacing:-.01em}
.month-nav{margin-left:auto;display:flex;align-items:center;gap:2px}
.month-nav .label{font-size:14px;font-weight:600;padding:0 10px;min-width:104px;text-align:center}
.iconbtn{width:30px;height:30px;border-radius:6px;display:grid;place-items:center;color:var(--text-secondary);border:0;background:transparent;cursor:default}
.iconbtn:hover{background:var(--surface-hover)}

.cal{flex:1;min-height:0;display:grid;grid-template-rows:auto minmax(0,1fr);margin:0 24px 20px;border:1px solid var(--border-default);border-radius:10px;overflow:hidden;background:var(--surface-app)}
.week-head{display:grid;grid-template-columns:repeat(7,1fr);border-bottom:1px solid var(--border-default);background:var(--surface-sidebar)}
.week-head div{padding:8px 0;text-align:center;font-size:12px;color:var(--text-secondary);font-weight:500}
.grid{display:grid;grid-template-columns:repeat(7,1fr)}
.cell{border-right:1px solid var(--border-subtle);border-bottom:1px solid var(--border-subtle);padding:6px;display:flex;flex-direction:column;gap:3px;min-height:0;position:relative;cursor:default;overflow:visible}
.cell:nth-child(7n){border-right:0}
.cell:hover{background:var(--surface-hover)}
.cell .dnum{font-size:12px;color:var(--text-secondary);width:22px;height:22px;display:grid;place-items:center;border-radius:50%;font-weight:500;flex:none}
.cell.dim{background:var(--surface-sidebar)}
.cell.dim .dnum,.cell.dim .pill,.cell.dim .more{opacity:.45}
.cell.today{background:var(--surface-selected)}
.cell.dropTarget{outline:2px dashed var(--accent);outline-offset:-2px;background:var(--accent-soft)}
.cell.today .dnum{background:var(--accent);color:#fff;font-weight:600}
.more{margin-top:auto;font-size:11px;color:var(--text-tertiary);text-align:right;padding-right:2px;border:0;background:transparent;cursor:default;align-self:flex-end}
.more:hover{color:var(--accent)}

.pill{display:flex;align-items:center;gap:4px;height:20px;padding:0 4px 0 2px;border-radius:4px;font-size:11px;background:var(--surface-hover);min-width:0;cursor:default}
.pill:hover{background:var(--border-subtle)}
.pcheck{width:12px;height:12px;border-radius:50%;border:1.5px solid var(--text-tertiary);flex:none;padding:0;background:transparent;cursor:default;position:relative}
.pcheck:hover{border-color:var(--accent)}
.pcheck.on{background:var(--success);border-color:var(--success)}
.pcheck.on::after{content:"";position:absolute;left:3px;top:1px;width:3px;height:6px;border:solid #fff;border-width:0 1.5px 1.5px 0;transform:rotate(45deg)}
.pill .bar{width:3px;height:12px;border-radius:2px;flex:none}
.pill .t{color:var(--text-tertiary);flex:none}
.pill .n{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:var(--text-primary)}
.pill.done{opacity:.55}
.pill.done .n{text-decoration:line-through}

.day-pop{min-width:200px;max-width:240px}
.day-pop-title{font-size:12px;font-weight:600;color:var(--text-secondary);padding:6px 10px 2px}
.day-pop-list{max-height:220px;overflow:auto}
.day-pop-row{display:flex;align-items:center;gap:8px;padding:6px 10px;font-size:13px}
.day-pop-row .cb{width:14px;height:14px;margin:0;flex:none}
.dp-title{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;cursor:default}
.dp-title.strike{text-decoration:line-through;color:var(--text-tertiary)}
.day-pop-row .op{width:20px;height:20px;border:0;border-radius:4px;background:transparent;color:var(--text-tertiary);display:grid;place-items:center;cursor:default;padding:0}
.day-pop-row .op:hover{color:var(--p-high)}
.add-in-day{color:var(--accent);border-top:1px solid var(--border-subtle);border-radius:0 0 8px 8px}
.new-pop{min-width:180px;padding:6px}
.new-pop-title{font-size:12px;color:var(--text-tertiary);padding:2px 4px 6px}
</style>
