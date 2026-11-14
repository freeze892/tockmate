<template>
  <section class="main">
    <div class="main-head">
      <h1>{{ store.viewTitle }}</h1>
      <span v-if="store.view.id === 'today'" class="sub">{{ todayLabel }}</span>
      <span v-else-if="store.view.type === 'all'" class="sub">{{ activeCount }} 个未完成任务</span>
      <button class="btn ghost" :class="{ primary: batchMode }" style="margin-left:auto" @click="toggleBatch">
        {{ batchMode ? '退出批量' : '批量管理' }}
      </button>
      <div class="seg" v-if="!batchMode">
        <button class="on">列表</button>
        <button @click="store.setViewMode('calendar')">日历</button>
      </div>
      <button class="btn primary" style="margin-left:12px" v-if="!batchMode" @click="focusQuickAdd">
        <Icon name="plus" />添加任务
      </button>
    </div>

    <QuickAdd v-if="showQuickAdd" ref="quickAdd" />

    <div class="tasks">
      <template v-if="sections.length">
        <div v-for="sec in sections" :key="sec.key">
          <!-- 普通分节 -->
          <div v-if="sec.variant !== 'done-collapse'" class="sec" :class="{ overdue: sec.variant === 'overdue' }">
            <Icon v-if="sec.variant === 'overdue'" name="flag" :size="12" />
            <span v-if="sec.color" class="ldot" :style="{ background: sec.color, width: '6px', height: '6px', margin: 0 }"></span>
            {{ sec.label }}<template v-if="sec.variant !== 'overdue' && sec.label !== '今天'"> · {{ sec.tasks.length }}</template>
          </div>
          <!-- 已完成折叠节 -->
          <div v-else class="sec done-head" @click="doneOpen = !doneOpen">
            <Icon :name="doneOpen ? 'chev-d' : 'chev-r'" :size="12" />已完成 · {{ sec.tasks.length }}
          </div>
          <template v-if="sec.variant !== 'done-collapse' || doneOpen">
            <TaskRow v-for="t in sec.tasks" :key="t.id" :task="t" :show-list="showListChips"
                     :batch-mode="batchMode" :batch-selected="batchSet.has(t.id)"
                     @toggle="batchMode ? toggleSelect(t.id) : store.toggleTask($event)"
                     @select="batchMode ? toggleSelect(t.id) : store.selectTask($event)"
                     @batch-toggle="toggleSelect($event)"
                     @remove="onRemove" />
          </template>
        </div>
      </template>

      <!-- 批量操作栏 -->
      <div class="batch-bar" v-if="batchMode">
        <span class="bb-count">已选 {{ batchIds.length }} 项</span>
        <button class="btn ghost" :disabled="!batchIds.length" @click="store.batchComplete(batchIds)">设为完成</button>
        <select class="bb-select" :disabled="!batchIds.length" @change="batchMoveList($event)">
          <option value="">移动到清单…</option>
          <option v-for="l in store.activeLists" :key="l.id" :value="l.id">{{ l.name }}</option>
        </select>
        <select class="bb-select" :disabled="!batchIds.length" @change="batchMoveDate($event)">
          <option value="">移动到日期…</option>
          <option :value="todayISO()">今天</option>
          <option :value="addDaysISO(todayISO(), 2)">后天</option>
          <option :value="addDaysISO(todayISO(), 7)">下周</option>
        </select>
        <button class="btn ghost bb-del" :disabled="!batchIds.length" @click="batchDelete">删除</button>
        <button class="btn ghost" @click="toggleBatch">完成批量</button>
      </div>

      <div v-if="!sections.length && !batchMode" class="empty-tip">
        <Icon name="done" />
        <template v-if="store.search">没有匹配「{{ store.search }}」的任务</template>
        <template v-else-if="store.view.id === 'today'">今天没有任务，享受当下吧</template>
        <template v-else>这里还没有任务</template>
      </div>
    </div>
  </section>
</template>

<script setup>
import { ref, computed } from 'vue'
import Icon from './Icon.vue'
import TaskRow from './TaskRow.vue'
import QuickAdd from './QuickAdd.vue'
import { useDataStore } from '../stores/data'
import { sectionedTasks, todayProgress } from '../utils/smartViews'
import { todayISO, addDaysISO, shortDate, weekdayCN } from '../utils/date'

const store = useDataStore()
const doneOpen = ref(false)
const batchMode = ref(false)
const batchIds = ref([])
const batchSet = computed(() => new Set(batchIds.value))

function toggleBatch () {
  batchMode.value = !batchMode.value
  batchIds.value = []
  if (batchMode.value) store.selectTask(null)
}
function toggleSelect (id) {
  const i = batchIds.value.indexOf(id)
  i === -1 ? batchIds.value.push(id) : batchIds.value.splice(i, 1)
}
function batchMoveList (e) {
  if (!e.target.value) return
  store.batchMoveList(batchIds.value, e.target.value)
  e.target.value = ''
}
function batchMoveDate (e) {
  if (!e.target.value) return
  store.batchMoveDate(batchIds.value, e.target.value)
  e.target.value = ''
}
function batchDelete () {
  if (batchIds.value.length && window.confirm('删除选中的 ' + batchIds.value.length + ' 个任务？')) {
    store.batchDelete(batchIds.value)
    batchIds.value = []
  }
}
const quickAdd = ref(null)

const todayLabel = `${shortDate(todayISO())} ${weekdayCN(todayISO())}`
const progress = computed(() => todayProgress(store.tasks))
const pct = computed(() => progress.value.total ? Math.round(progress.value.done / progress.value.total * 100) : 0)
const activeCount = computed(() => store.tasks.filter(t => !t.completed && !t.deletedAt).length)

const showQuickAdd = computed(() => store.view.type === 'list' || ['today', 'tomorrow', 'next7', 'all'].includes(store.view.id))
const showListChips = computed(() => ['today', 'tomorrow', 'next7'].includes(store.view.id))

const sections = computed(() =>
  sectionedTasks(store.view, store.tasks, store.activeLists, store.search)
)

function focusQuickAdd () {
  quickAdd.value && quickAdd.value.$el.querySelector('input').focus()
}

function onRemove (id) {
  const t = store.tasks.find(x => x.id === id)
  if (t && window.confirm(`删除任务「${t.title}」？`)) store.deleteTask(id)
}
</script>

<style scoped>
.main{display:flex;flex-direction:column;min-width:0;min-height:0}
.main-head{display:flex;align-items:flex-end;gap:16px;padding:20px 24px 10px}
.main-head h1{font-size:20px;font-weight:600;letter-spacing:-.01em}
.main-head .sub{font-size:13px;color:var(--text-secondary);padding-bottom:2px}
.progress-wrap{margin-left:16px;flex:1;max-width:220px;padding-bottom:5px}
.ptext{font-size:11px;color:var(--text-tertiary);margin-bottom:4px}
.progress-track{height:4px;border-radius:2px;background:var(--border-subtle);overflow:hidden}
.progress-fill{height:100%;border-radius:2px;background:var(--accent);transition:width .3s}
.tasks{flex:1;overflow:auto;min-height:0;padding:0 12px 24px}
.sec{display:flex;align-items:center;gap:6px;padding:10px 12px 4px;font-size:12px;color:var(--text-secondary);font-weight:500}
.sec.overdue{color:var(--p-high)}
.sec.done-head{cursor:default}
.done-head:hover{color:var(--text-primary)}
.batch-bar{position:sticky;bottom:0;display:flex;align-items:center;gap:10px;padding:10px 16px;background:var(--surface-elevated);border:1px solid var(--border-default);border-radius:10px;box-shadow:var(--shadow-pop);margin:0 12px 12px}
.bb-count{font-size:13px;color:var(--text-secondary);margin-right:4px}
.bb-select{height:30px;border:1px solid var(--border-default);border-radius:6px;background:var(--surface-app);color:var(--text-primary);font-size:12.5px;padding:0 8px;outline:none}
.bb-select:disabled{opacity:.5}
.bb-del:hover{color:var(--p-high);border-color:var(--p-high)}
</style>
