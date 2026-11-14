<template>
  <div class="task" :class="{ done: task.completed, selected: batchSelected }"
       @mouseenter="hovered = true" @mouseleave="hovered = false"
       @click="batchMode ? $emit('batch-toggle', task.id) : $emit('select', task.id)">
    <button class="cb" :class="{ done: task.completed, batch: batchMode, picked: batchSelected }" @click.stop="batchMode ? $emit('batch-toggle', task.id) : $emit('toggle', task.id)"
            :aria-label="task.completed ? '标记未完成' : '标记完成'"></button>
    <div class="tbody">
      <div class="ttitle">{{ task.title }}</div>
      <div class="tmeta">
        <span v-if="dateChip" class="chip" :class="dateChip.cls">
          <Icon :name="task.dueTime ? 'clock' : 'cal'" :size="12" />{{ dateChip.text }}
        </span>
        <span v-if="task.repeat" class="chip repeat-chip" title="重复任务">
          <Icon name="repeat" :size="12" />{{ repeatLabel(task.repeat) }}
        </span>
        <span v-for="tag in task.tags || []" :key="tag" class="chip tagchip">#{{ tag }}</span>
        <span v-if="showList && list" class="chip listname">
          <span class="ldot" :style="{ background: list.color, width: '6px', height: '6px', margin: 0 }"></span>{{ list.name }}
        </span>
      </div>
    </div>
    <span class="right">
      <Icon v-if="task.priority > 0 && !hovered" name="flag" class="flag" :class="'p' + task.priority" :size="14" :sw="1.8" />
      <span class="ops">
        <button class="op" title="编辑详情" @click.stop="$emit('select', task.id)"><Icon name="edit" :size="13" /></button>
        <button class="op del" title="删除任务" @click.stop="$emit('remove', task.id)"><Icon name="trash" :size="13" /></button>
      </span>
    </span>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import Icon from './Icon.vue'
import { useDataStore } from '../stores/data'
import { todayISO, diffDays, friendlyDate } from '../utils/date'
import { repeatLabel } from '../utils/repeat'

const props = defineProps({
  task: { type: Object, required: true },
  showList: { type: Boolean, default: false },
  batchMode: { type: Boolean, default: false },
  batchSelected: { type: Boolean, default: false }
})
defineEmits(['toggle', 'select', 'remove', 'batch-toggle'])

const store = useDataStore()
const hovered = ref(false)
const list = computed(() => store.lists.find(l => l.id === props.task.listId))

const dateChip = computed(() => {
  const t = props.task
  if (t.completed) return null
  if (!t.dueDate) return null
  const diff = diffDays(t.dueDate, todayISO())
  const time = t.dueTime ? ' ' + t.dueTime : ''
  if (diff < 0) return { cls: 'overdue', text: `${friendlyDate(t.dueDate)}${time}` }
  if (diff === 0) return { cls: 'today', text: `今天${time}` }
  return { cls: 'future', text: `${friendlyDate(t.dueDate)}${time}` }
})
</script>

<style scoped>
.task{display:flex;align-items:flex-start;gap:12px;padding:11px 12px;border-radius:8px;cursor:default}
.task:hover{background:var(--surface-hover)}
.task.done{opacity:.6}
.tbody{flex:1;min-width:0}
.ttitle{font-size:14px;line-height:1.5;color:var(--text-primary);word-break:break-word}
.task.done .ttitle{color:var(--text-tertiary);text-decoration:line-through}
.tmeta{display:flex;align-items:center;gap:10px;margin-top:2px;font-size:12px;color:var(--text-tertiary);min-height:17px}
.tmeta .chip{display:inline-flex;align-items:center;gap:3px}
.chip.today{color:var(--accent)}
.chip.overdue{color:var(--p-high)}
.chip.future{color:var(--text-tertiary)}
.chip.listname{color:var(--text-tertiary)}
.chip.tagchip{color:var(--accent);background:var(--accent-soft);border-radius:4px;padding:0 5px}
.chip.repeat-chip{color:var(--text-secondary)}
.flag{margin-top:3px}
.right{margin-left:auto;display:inline-flex;align-items:center;gap:2px}
.ops{display:none;align-items:center;gap:1px}
.task:hover .ops{display:inline-flex}
.op{width:22px;height:22px;border:0;border-radius:4px;background:transparent;color:var(--text-tertiary);display:grid;place-items:center;cursor:default;padding:0}
.op:hover{background:var(--border-subtle);color:var(--text-primary)}
.op.del:hover{color:var(--p-high)}
</style>
