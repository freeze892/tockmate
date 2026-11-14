<template>
  <aside class="sidebar">
    <div class="search">
      <Icon name="search" />
      <input v-model="store.search" placeholder="搜索" @input="store.setSearch($event.target.value)" />
    </div>
    <nav class="nav">
      <div class="group-label">智能清单</div>
      <div v-for="v in smartItems" :key="v.id" class="nav-item"
           :class="{ selected: store.view.type === 'smart' && store.view.id === v.id }"
           @click="store.setView('smart', v.id)">
        <Icon :name="v.icon" />
        <span>{{ v.label }}</span>
        <span class="count" :class="{ badge: v.id === 'today' && counts.today > 0 }" v-if="v.count !== null">{{ v.count }}</span>
      </div>

      <div class="group-label" style="margin-top:8px">清单</div>
      <template v-for="l in store.activeLists" :key="l.id">
        <div v-if="renamingId === l.id" class="add-form">
          <div class="dots">
            <button v-for="c in PALETTE" :key="c" class="dot" :class="{ on: c === renameColor }"
                    :style="{ background: c }" @mousedown.prevent @click="renameColor = c"></button>
          </div>
          <div class="row">
            <input ref="renameInput" v-model="renameName" @keydown.enter="saveRename(l.id)"
                   @keydown.esc="renamingId = null" @blur="saveRename(l.id)" />
          </div>
        </div>
        <div v-else class="nav-item" :class="{ selected: store.view.type === 'list' && store.view.id === l.id }"
             @click="store.setView('list', l.id)">
          <span class="ldot" :style="{ background: l.color, margin: 0 }"></span>
          <span class="lname">{{ l.name }}</span>
          <span class="count">{{ listCount(l.id) }}</span>
          <span class="ops">
            <button class="op" title="重命名与颜色" @click.stop="startRename(l)"><Icon name="edit" :size="13" /></button>
            <button class="op" title="删除清单" @click.stop="removeList(l)"><Icon name="trash" :size="13" /></button>
          </span>
        </div>
      </template>

<div v-if="!adding" class="add-list" @click="startAdd">
        <Icon name="plus" />添加清单
      </div>
      <div v-else class="add-form">
        <div class="dots">
          <button v-for="c in PALETTE" :key="c" class="dot" :class="{ on: c === newColor }"
                  :style="{ background: c }" @mousedown.prevent @click="newColor = c"></button>
        </div>
        <div class="row">
          <input ref="addInput" v-model="newName" placeholder="清单名称，回车保存"
                 @keydown.enter="saveAdd" @keydown.esc="cancelAdd" @blur="saveAdd" />
        </div>
      </div>

      <div class="group-label" style="margin-top:8px">标签</div>
      <div v-for="t in topTags" :key="t.name" class="nav-item"
           :class="{ selected: store.view.type === 'tag' && store.view.id === t.name }"
           @click="store.setView('tag', t.name)">
        <Icon name="tag" :size="16" />
        <span class="lname">#{{ t.name }}</span>
        <span class="count">{{ t.count }}</span>
      </div>
      <div v-if="!topTags.length" class="tag-empty">任务打上标签后会出现在这里</div>

            <div class="side-foot">
        <div class="nav-item" :class="{ selected: store.view.type === 'stats' }" @click="store.setView('stats', 'report')">
          <svg class="icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20V9M10 20V4M16 20v-8M22 20H2"/></svg>
          <span>统计报表</span>
        </div>
        <div v-for="p in pageItems" :key="p.id" class="nav-item"
             :class="{ selected: store.view.type === 'page' && store.view.id === p.id }"
             @click="store.setView('page', p.id)">
          <Icon :name="p.icon" /><span>{{ p.label }}</span>
          <span class="count" v-if="p.id === 'pomodoro'">{{ todayPomos }}</span>
          <span class="count" v-else-if="p.id === 'habit' && habits.length">{{ habitDone }}/{{ habits.length }}</span>
        </div>
      </div>
    </nav>
  </aside>
</template>

<script setup>
import { ref, computed, nextTick } from 'vue'
import Icon from './Icon.vue'
import { useDataStore } from '../stores/data'
import { viewCounts } from '../utils/smartViews'
import { todayDoneCount } from '../utils/habits'
import { todayISO, localDateStr } from '../utils/date'

const store = useDataStore()
const topTags = computed(() => store.tagList().slice(0, 8))
const PALETTE = ['#4772FA', '#2EA7E0', '#22A88E', '#64B94C', '#F5A623', '#E5484D', '#9A6BF2', '#E065A6']

const counts = computed(() => viewCounts(store.tasks))
const listCount = (id) => store.tasks.filter(t => !t.completed && !t.deletedAt && t.listId === id).length
const todayPomos = computed(() =>
  (store.pomodoro.logs || []).filter(l => localDateStr(l.startedAt) === todayISO()).length)
const habits = computed(() => store.habits.filter(h => !h.deletedAt))
const habitDone = computed(() => todayDoneCount(store.habits, todayISO()))

const smartItems = computed(() => [
  { id: 'today', label: '今天', icon: 'sun', count: counts.value.today },
  { id: 'tomorrow', label: '明天', icon: 'clock', count: counts.value.tomorrow },
  { id: 'next7', label: '最近 7 天', icon: 'week', count: counts.value.next7 },
  { id: 'all', label: '全部', icon: 'inbox', count: counts.value.all },
  { id: 'completed', label: '已完成', icon: 'done', count: null }
])
const pageItems = [
  { id: 'pomodoro', label: '番茄专注', icon: 'timer' },
  { id: 'habit', label: '习惯打卡', icon: 'flame' },
  { id: 'settings', label: '设置', icon: 'gear' }
]

const adding = ref(false)
const newName = ref('')
const newColor = ref(PALETTE[0])
const addInput = ref(null)
function startAdd () {
  adding.value = true
  newColor.value = PALETTE[store.activeLists.length % PALETTE.length]
  nextTick(() => addInput.value && addInput.value.focus())
}
function saveAdd () {
  const name = newName.value.trim()
  if (name) store.addList(name, newColor.value)
  newName.value = ''
  adding.value = false
}
function cancelAdd () { newName.value = ''; adding.value = false }

const renamingId = ref(null)
const renameName = ref('')
const renameColor = ref(PALETTE[0])
const renameInput = ref(null)
function startRename (l) {
  renamingId.value = l.id
  renameName.value = l.name
  renameColor.value = l.color
  nextTick(() => {
    const el = Array.isArray(renameInput.value) ? renameInput.value[0] : renameInput.value
    el && el.focus()
  })
}
function saveRename (id) {
  if (renamingId.value !== id) return
  const name = renameName.value.trim()
  const patch = { color: renameColor.value }
  if (name) patch.name = name
  store.updateList(id, patch)
  renamingId.value = null
}
function removeList (l) {
  const n = listCount(l.id)
  if (window.confirm(`删除清单「${l.name}」？其中 ${n} 个任务将一并删除。`)) {
    store.deleteList(l.id)
  }
}
</script>

<style scoped>
.sidebar{background:var(--surface-sidebar);border-right:1px solid var(--border-subtle);display:flex;flex-direction:column;min-height:0;padding:12px 8px 8px}
.search{display:flex;align-items:center;gap:8px;height:32px;margin:0 4px 12px;padding:0 10px;border-radius:6px;background:var(--surface-hover);color:var(--text-tertiary)}
.search input{flex:1;border:0;background:transparent;font-size:13px;color:var(--text-primary);outline:none;min-width:0}
.search input::placeholder{color:var(--text-tertiary)}
.nav{flex:1;overflow:auto;min-height:0}
.group-label{padding:8px 12px 4px;font-size:11px;font-weight:600;color:var(--text-tertiary);letter-spacing:.05em}
.nav-item{display:flex;align-items:center;gap:10px;height:32px;padding:0 12px;border-radius:6px;color:var(--text-primary);cursor:default;font-size:14px}
.nav-item :deep(.icon){color:var(--text-secondary)}
.nav-item:hover{background:var(--surface-hover)}
.nav-item.selected{background:var(--surface-selected);color:var(--accent);font-weight:500}
.nav-item.selected :deep(.icon){color:var(--accent)}
.count{margin-left:auto;font-size:12px;color:var(--text-tertiary)}
.count.badge{color:var(--accent);font-weight:600}
.lname{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;flex:1}
.nav-item .ops{display:none;align-items:center;gap:1px}
.nav-item:hover .ops{display:inline-flex}
.nav-item:hover .count{display:none}
.op{width:20px;height:20px;border:0;border-radius:4px;background:transparent;color:var(--text-tertiary);display:grid;place-items:center;cursor:default;padding:0}
.op:hover{background:var(--border-subtle);color:var(--text-primary)}
.rename-form{margin:2px 4px;padding:4px 8px}
.add-form .dots{display:flex;gap:6px;margin-bottom:8px;flex-wrap:wrap}
.rename-form input{width:100%;height:26px;border:1px solid var(--accent);border-radius:5px;background:var(--surface-elevated);color:var(--text-primary);font-size:13px;outline:none;padding:0 6px}
.add-list{display:flex;align-items:center;gap:10px;height:32px;padding:0 12px;border-radius:6px;color:var(--text-secondary);font-size:13px;margin-top:2px}
.add-list:hover{background:var(--surface-hover)}
.add-form{margin:2px 4px 0;padding:8px;border:1px solid var(--border-default);border-radius:8px;background:var(--surface-elevated)}
.dots{display:flex;gap:6px;margin-bottom:8px;flex-wrap:wrap}
.dot{width:16px;height:16px;border-radius:50%;border:2px solid transparent;cursor:default}
.dot.on{border-color:var(--text-primary)}
.row input{width:100%;height:28px;border:0;border-bottom:1px solid var(--border-default);background:transparent;font-size:13px;color:var(--text-primary);outline:none}
.side-foot{border-top:1px solid var(--border-subtle);padding-top:6px;margin-top:6px;display:flex;flex-direction:column}
.tag-empty{padding:4px 12px 8px;font-size:12px;color:var(--text-tertiary);line-height:1.6}
</style>
