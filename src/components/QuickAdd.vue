<template>
  <div ref="rootEl" class="quickadd" :class="{ open: focused || text }">
    <div class="qa-row">
      <span class="qa-plus"><Icon name="plus" :size="12" :sw="2.5" /></span>
      <input ref="inputEl" v-model="text" class="qa-input" placeholder="添加任务，如「明天 09:00 写周报」"
             @focus="onFocus" @blur="onBlur($event)" @keydown.enter="save" @keydown.esc="reset" />
      <button v-if="text" class="qa-send" @mousedown.prevent @click="save"><Icon name="send" :size="14" :sw="1.8" /></button>
    </div>

    <div v-if="parsed.parsedLabel && text" class="qa-parse">
      <span class="tag"><Icon name="cal" :size="12" />{{ parsed.parsedLabel }}</span>
      已从标题识别，回车即保存
    </div>

    <div v-if="focused || text || pop" class="qa-opts">
      <div class="opt-wrap">
        <button class="qa-opt" :class="{ on: !!effDate }" @click.stop="togglePop('date')">
          <Icon name="cal" :size="15" />{{ effDate ? dateLabel(effDate) : '日期' }}
        </button>
        <div v-if="pop === 'date'" class="popover" @click.stop>
          <button class="pop-item" @mousedown.prevent @click="pickDate(todayISO())">今天</button>
          <button class="pop-item" @mousedown.prevent @click="pickDate(tomorrowISO())">明天</button>
          <button class="pop-item" @mousedown.prevent @click="pickDate(nextWeekISO())">下周</button>
          <button class="pop-item" @mousedown.prevent @click="pickDate(null)">清除日期</button>
          <div class="pop-field"><input type="date" class="pop-input" :value="manualDate" @change="pickDate($event.target.value || null)" /></div>
        </div>
      </div>

      <div class="opt-wrap">
        <button class="qa-opt" :class="{ on: !!effTime }" @click.stop="togglePop('time')">
          <Icon name="bell" :size="15" />{{ effTime || '时间' }}
        </button>
        <div v-if="pop === 'time'" class="popover" @click.stop>
          <div class="presets">
            <button v-for="tm in ['09:00', '12:00', '18:00', '21:00']" :key="tm" class="pop-item preset"
                    :class="{ sel: tm === effTime }" @mousedown.prevent @click="pickTime(tm)">{{ tm }}</button>
          </div>
          <div class="pop-field"><input type="time" class="pop-input" :value="manualTime" @change="pickTime($event.target.value || null)" /></div>
          <button class="pop-item" @mousedown.prevent @click="pickTime(null)">清除时间</button>
        </div>
      </div>

      <div class="opt-wrap">
        <button class="qa-opt" :class="{ on: effPriority > 0 }" @click.stop="togglePop('priority')">
          <Icon name="flag" :size="15" />{{ PRIORITY_NAMES[effPriority] }}
        </button>
        <div v-if="pop === 'priority'" class="popover" @click.stop>
          <button v-for="(n, v) in PRIORITY_NAMES" :key="v" class="pop-item" :class="{ sel: +v === effPriority }" @mousedown.prevent @click="pickPriority(+v)">
            <span v-if="+v > 0" class="ldot" :style="{ background: PRIORITY_COLORS[v], width: '8px', height: '8px', margin: 0 }"></span>{{ n }}
          </button>
        </div>
      </div>

      <div class="opt-wrap">
        <button class="qa-opt" :class="{ on: true }" @click.stop="togglePop('list')">
          <Icon name="list" :size="15" /><span class="ldot" :style="{ background: effListColor, width: '6px', height: '6px', margin: 0 }"></span>{{ effListName }}
        </button>
        <div v-if="pop === 'list'" class="popover" @click.stop>
          <button v-for="l in store.activeLists" :key="l.id" class="pop-item" :class="{ sel: l.id === effListId }" @mousedown.prevent @click="pickList(l.id)">
            <span class="ldot" :style="{ background: l.color, width: '8px', height: '8px', margin: 0 }"></span>{{ l.name }}
          </button>
        </div>
      </div>

      <span class="qa-hint"><kbd>Enter</kbd>保存 · <kbd>Esc</kbd>收起</span>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import Icon from './Icon.vue'
import { useDataStore } from '../stores/data'
import { parseQuickAdd } from '../utils/parseQuickAdd'
import { todayISO, addDaysISO, friendlyDate } from '../utils/date'

const store = useDataStore()
const PRIORITY_NAMES = { 0: '无', 1: '低', 2: '中', 3: '高' }
const PRIORITY_COLORS = { 1: 'var(--p-low)', 2: 'var(--p-medium)', 3: 'var(--p-high)' }

const text = ref('')
const focused = ref(false)
const pop = ref(null)
const inputEl = ref(null)
const rootEl = ref(null)

const manualDate = ref(null)
const manualTime = ref(null)
const manualPriority = ref(0)
const manualListId = ref(null)

const parsed = computed(() => parseQuickAdd(text.value))
const effDate = computed(() => manualDate.value || parsed.value.dueDate)
const effTime = computed(() => manualTime.value || parsed.value.dueTime)
const effPriority = computed(() => manualPriority.value)
const effListId = computed(() => manualListId.value || (store.view.type === 'list' ? store.view.id : store.activeLists[0]?.id))
const effListName = computed(() => store.lists.find(l => l.id === effListId.value)?.name || '清单')
const effListColor = computed(() => store.lists.find(l => l.id === effListId.value)?.color || 'var(--text-tertiary)')

function dateLabel (iso) {
  const d = friendlyDate(iso)
  return d.length <= 2 ? d : d
}
function togglePop (p) { pop.value = pop.value === p ? null : p }
function pickDate (v) { manualDate.value = v; pop.value = null }
function pickTime (v) { manualTime.value = v; pop.value = null }
function pickPriority (v) { manualPriority.value = v; pop.value = null }
function pickList (v) { manualListId.value = v; pop.value = null }

function save () {
  const p = parsed.value
  const title = (manualDate.value || manualTime.value ? text.value : p.title).trim() || (p.title || '').trim()
  if (!title) return
  let listId = effListId.value
  if (!listId && p.listName) {
    // /清单语法：按名匹配，不存在则新建
    const l = store.lists.find(x => !x.deletedAt && x.name === p.listName)
    listId = l ? l.id : (store.addList(p.listName), store.lists[store.lists.length - 1].id)
  }
  store.addTask({
    title,
    listId,
    dueDate: effDate.value,
    dueTime: effTime.value,
    priority: effPriority.value,
    tags: p.tags,
    repeat: p.repeat
  })
  reset()
  inputEl.value && inputEl.value.focus()
}
function reset () {
  text.value = ''
  manualDate.value = null
  manualTime.value = null
  manualPriority.value = 0
  manualListId.value = null
  pop.value = null
}
function onFocus () {
  focused.value = true
  // 开始快速录入的瞬间就关闭右侧旧详情（不遗留，不等回车）
  store.selectTask(null)
}

function onBlur (e) {
  // 点击仍在快速添加条内部（如弹层里的输入框、选项按钮）时不收起
  if (rootEl.value && e.relatedTarget && rootEl.value.contains(e.relatedTarget)) return
  // 延迟收起：立即收起会让列表上移，正好落在"按下-抬起"之间的点击会打偏
  setTimeout(() => {
    if (rootEl.value && !rootEl.value.contains(document.activeElement)) {
      focused.value = false
      pop.value = null
    }
  }, 180)
}
function onOutside () { pop.value = null }
onMounted(() => window.addEventListener('click', onOutside))
onBeforeUnmount(() => window.removeEventListener('click', onOutside))

function tomorrowISO () { return addDaysISO(todayISO(), 1) }
function nextWeekISO () { return addDaysISO(todayISO(), 7) }
</script>

<style scoped>
.quickadd{margin:4px 12px 10px;border:1px solid var(--border-default);border-radius:10px;background:var(--surface-elevated);transition:border-color .2s}
.quickadd.open{border-color:var(--accent);box-shadow:0 4px 12px rgba(71,114,250,.08),0 12px 32px rgba(0,0,0,.06)}
.qa-row{display:flex;align-items:center;gap:12px;padding:10px 14px 6px}
.qa-plus{width:20px;height:20px;border-radius:50%;background:var(--accent);color:#fff;display:grid;place-items:center;flex:none}
.qa-input{flex:1;border:0;background:transparent;font-size:14px;color:var(--text-primary);outline:none;min-width:0}
.qa-input::placeholder{color:var(--text-tertiary)}
.qa-send{width:26px;height:26px;border-radius:6px;background:var(--accent);color:#fff;display:grid;place-items:center;border:0;cursor:default}
.qa-send:hover{background:var(--accent-hover)}
.qa-parse{display:flex;align-items:center;gap:8px;padding:2px 14px 8px 46px;font-size:12px;color:var(--text-tertiary)}
.tag{display:inline-flex;align-items:center;gap:4px;padding:2px 8px;border-radius:4px;background:var(--accent-soft);color:var(--accent);font-weight:500}
.qa-opts{display:flex;align-items:center;gap:4px;padding:8px 10px;border-top:1px solid var(--border-subtle);background:var(--surface-sidebar);border-radius:0 0 10px 10px;position:relative}
.opt-wrap{position:relative}
.qa-opt{display:inline-flex;align-items:center;gap:6px;height:28px;padding:0 10px;border-radius:6px;font-size:12.5px;color:var(--text-secondary);border:0;background:transparent;cursor:default}
.qa-opt :deep(.icon){color:var(--text-tertiary)}
.qa-opt.on{color:var(--accent);background:var(--accent-soft)}
.qa-opt.on :deep(.icon){color:var(--accent)}
.qa-opt:hover{background:var(--surface-hover)}
.qa-hint{margin-left:auto;font-size:12px;color:var(--text-tertiary)}
.qa-hint kbd{font-family:"Cascadia Mono","Consolas",monospace;font-size:11px;border:1px solid var(--border-default);border-radius:4px;background:var(--surface-app);padding:1px 5px;margin:0 2px}
.pop-field{padding:4px}
.presets{display:flex;gap:2px;padding:4px 4px 2px}
.preset{flex:1;justify-content:center;padding:6px 4px;color:var(--text-primary)}
</style>
