<template>
  <WidgetView v-if="isWidgetWindow" />
  <QuickCaptureView v-else-if="isQuickWindow" />
  <div v-else class="shell" :style="{ gridTemplateRows: shellRows }">
    <div v-if="!hasApi" class="no-api">
      当前运行在浏览器中，数据无法保存——请关闭此页面，改用「npm run dev」在 TockMate 应用窗口中使用
    </div>
    <TitleBar />
    <LockView v-if="showLock" />
    <div v-else class="body" :style="store.view.type === 'page' ? { gridTemplateColumns: '240px minmax(0,1fr)' } : null">
      <SideBar />
      <template v-if="store.view.type !== 'page'">
        <CalendarView v-if="store.viewMode === 'calendar'" />
        <TaskList v-else />
        <DetailPanel />
      </template>
      <component v-else :is="pageComponent" />
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import TitleBar from './components/TitleBar.vue'
import SideBar from './components/SideBar.vue'
import TaskList from './components/TaskList.vue'
import CalendarView from './components/CalendarView.vue'
import DetailPanel from './components/DetailPanel.vue'
import PomodoroView from './components/PomodoroView.vue'
import HabitView from './components/HabitView.vue'
import SettingsView from './components/SettingsView.vue'
import StatsView from './components/StatsView.vue'
import LockView from './components/LockView.vue'
import QuickCaptureView from './components/QuickCaptureView.vue'
import WidgetView from './components/WidgetView.vue'
import { useDataStore } from './stores/data'

const store = useDataStore()
store.setView('smart', 'today')

// 迷你快速捕捉窗（独立窗口，hash=#quick）
const isWidgetWindow = window.location.hash === '#widget'
const isQuickWindow = window.location.hash === '#quick'

const locked = ref(false)
const lockEnabled = ref(false)
const lockReady = ref(false)

onMounted(() => {
  if (!window.api) {
    if (!isQuickWindow) return
    return
  }
  if (isQuickWindow) {
    window.api.quick.onShow(() => {})
    return
  }
  store.init()
  window.api.lock.status().then(s => {
    lockEnabled.value = s.enabled
    locked.value = s.locked
    lockReady.value = true
  })
  window.api.lock.onChanged(s => { locked.value = s.locked })
  window.api.onLockUi(() => { window.api.lock.lockNow() })
  // 主进程推送：同步/导入后的合并数据、任务提醒聚焦、习惯提醒跳转打卡页
  window.api.onDataChanged(doc => store.applyRemote(doc))
  window.api.onFocusTask(({ taskId }) => {
    store.setViewMode('list')
    store.setView('smart', 'today')
    store.selectTask(taskId)
  })
  window.api.onFocusHabit(() => store.setView('smart', 'habit'))
})

// 主题：auto 交给 CSS 媒体查询，light/dark 显式覆盖
watch(() => store.settings.theme, theme => {
  if (theme === 'auto') delete document.documentElement.dataset.theme
  else document.documentElement.dataset.theme = theme
}, { immediate: true })

const hasApi = !!window.api
// 网格行数必须与实际子元素数匹配，否则主体会掉进错误的行（曾致整页内容压进 36px）
const shellRows = computed(() => hasApi ? '36px minmax(0,1fr)' : 'auto 36px minmax(0,1fr)')
const pageComponent = computed(() =>
  ({ pomodoro: PomodoroView, habit: HabitView, settings: SettingsView, stats: StatsView,  })[store.view.id] || StatsView)

// 锁定期间只渲染锁屏（任务数据不可见）
const showLock = computed(() => hasApi && lockReady.value && lockEnabled.value && locked.value)
</script>

<style scoped>
.shell{display:grid;height:100vh}
.no-api{background:#E5484D;color:#fff;font-size:13px;padding:8px 16px;text-align:center}
.body{display:grid;grid-template-columns:240px minmax(0,1fr) 320px;min-height:0}
@media (max-width: 1080px) {
  .body{grid-template-columns:200px minmax(0,1fr) 280px}
}
</style>
