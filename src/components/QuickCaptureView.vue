<template>
  <div class="qc">
    <div class="qc-row">
      <span class="qc-plus"><Icon name="plus" :size="12" :sw="2.5" /></span>
      <input ref="inputEl" v-model="raw" class="qc-input" placeholder="快速记录，如「明天 09:00 交方案」"
             @keydown.enter="save" @keydown.esc="hide" />
    </div>
    <div class="qc-parse" v-if="parsed.parsedLabel">
      <span class="tag"><Icon name="cal" :size="11" />{{ parsed.parsedLabel }}</span>
      <span class="qc-list" v-if="listName">→ {{ listName }}</span>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import Icon from './Icon.vue'
import { parseQuickAdd } from '../utils/parseQuickAdd'

const raw = ref('')
const inputEl = ref(null)
const parsed = computed(() => parseQuickAdd(raw.value))

onMounted(() => {
  raw.value = ''
  inputEl.value && inputEl.value.focus()
  window.api?.quick?.onShow(() => {
    raw.value = ''
    inputEl.value && inputEl.value.focus()
  })
})

const listName = computed(() => '收件箱')

function save () {
  const p = parsed.value
  if (!p.title) { hide(); return }
  window.api.quick.add({
    title: p.title,
    dueDate: p.dueDate,
    dueTime: p.dueTime,
    listId: null // 快速捕捉统一进入第一个清单（主进程分配）
  })
  hide()
}
function hide () {
  window.api.quick.hide()
  raw.value = ''
}
</script>

<style scoped>
.qc{height:100vh;display:flex;flex-direction:column;justify-content:center;padding:0 16px;background:var(--surface-elevated);border:1px solid var(--accent);border-radius:10px}
.qc-row{display:flex;align-items:center;gap:10px}
.qc-plus{width:20px;height:20px;border-radius:50%;background:var(--accent);color:#fff;display:grid;place-items:center;flex:none}
.qc-input{flex:1;border:0;background:transparent;font-size:15px;color:var(--text-primary);outline:none;min-width:0}
.qc-input::placeholder{color:var(--text-tertiary)}
.qc-parse{display:flex;align-items:center;gap:8px;padding:4px 2px 0 30px;font-size:12px;color:var(--text-tertiary)}
.tag{display:inline-flex;align-items:center;gap:4px;padding:2px 8px;border-radius:4px;background:var(--accent-soft);color:var(--accent);font-weight:500}
.qc-list{color:var(--text-tertiary)}
</style>
