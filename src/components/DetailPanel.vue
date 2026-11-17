<template>
  <aside class="detail">
    <template v-if="task">
      <div class="detail-head">
        <span class="crumb">
          <span class="ldot" :style="{ background: listColor, width: '6px', height: '6px', margin: 0 }"></span>{{ listName }}
        </span>
        <div class="actions">
          <button class="iconbtn" title="删除任务" @click="store.deleteTask(task.id)"><Icon name="trash" /></button>
          <button class="iconbtn" title="关闭" @click="store.selectTask(null)"><Icon name="x" /></button>
        </div>
      </div>
      <div class="detail-body" @paste="onPaste">
        <input class="detail-title" v-model="title" @change="save({ title })" placeholder="任务标题" />
        <div class="detail-list">创建于 {{ createdLabel }}</div>

        <div class="fields">
          <div class="field">
            <Icon name="cal" /><span class="flabel">日期</span>
            <input type="date" class="finput" :value="task.dueDate || ''" @change="save({ dueDate: $event.target.value || null })" />
            <button v-if="task.dueDate" class="mini" @click="save({ dueDate: null, dueTime: null })">清除</button>
          </div>
          <div class="field">
            <Icon name="clock" /><span class="flabel">时间</span>
            <input type="time" class="finput" :value="task.dueTime || ''" @change="save({ dueTime: $event.target.value || null })" />
          </div>
          <div class="field">
            <Icon name="bell" /><span class="flabel">提醒</span>
            <select class="finput" :value="task.reminderMinutes ?? ''" @change="save({ reminderMinutes: $event.target.value === '' ? null : +$event.target.value })">
              <option value="">不提醒</option>
              <option :value="0">准时提醒</option>
              <option :value="5">提前 5 分钟</option>
              <option :value="15">提前 15 分钟</option>
              <option :value="30">提前 30 分钟</option>
              <option :value="60">提前 1 小时</option>
              <option :value="1440">提前 1 天</option>
            </select>
          </div>
          <div class="field">
            <Icon name="repeat" /><span class="flabel">重复</span>
            <select class="finput" :value="task.repeat?.type || ''" @change="onRepeatType($event.target.value)">
              <option value="">不重复</option>
              <option value="daily">每天</option>
              <option value="weekly">每周</option>
              <option value="monthly">每月</option>
              <option value="yearly">每年</option>
            </select>
          </div>
          <div class="field">
            <Icon name="flag" /><span class="flabel">优先级</span>
            <select class="finput" :value="task.priority" @change="save({ priority: +$event.target.value })">
              <option :value="0">无</option><option :value="1">低</option>
              <option :value="2">中</option><option :value="3">高</option>
            </select>
          </div>
          <div class="field">
            <Icon name="flag" /><span class="flabel">优先级</span>
            <select class="finput" :value="task.priority" @change="save({ priority: +$event.target.value })">
              <option :value="0">无</option><option :value="1">低</option>
              <option :value="2">中</option><option :value="3">高</option>
            </select>
          </div>
          <div class="field">
            <Icon name="tag" /><span class="flabel">标签</span>
            <div class="tagwrap">
              <span v-for="tag in task.tags || []" :key="tag" class="tagchip">
                #{{ tag }}<button class="tagx" title="移除标签" @click="store.removeTaskTag(task.id, tag)"><Icon name="x" :size="10" :sw="2" /></button>
              </span>
              <input v-model="tagInput" class="tag-input" list="taglist" placeholder="+ 标签"
                     @keydown.enter="addTag" @blur="addTag" />
              <datalist id="taglist"><option v-for="t in store.tagList()" :key="t.name" :value="t.name" /></datalist>
            </div>
          </div>
          <div class="field">
            <Icon name="list" /><span class="flabel">清单</span>
            <select class="finput" :value="task.listId" @change="save({ listId: $event.target.value })">
              <option v-for="l in store.activeLists" :key="l.id" :value="l.id">{{ l.name }}</option>
            </select>
          </div>
        </div>

        <!-- 图片区（每任务 1 张，粘贴或选文件，重复即替换） -->
        <div class="img-section">
          <div class="img-head">
            <Icon name="img" :size="15" />图片
            <span class="cnt">{{ task.hasImage ? '1/1' : '0/1' }}</span>
          </div>
          <div v-if="imgLoading" class="img-empty">图片加载中…</div>
          <div v-else-if="imageDataUrl" class="img-frame">
            <img :src="imageDataUrl" alt="任务图片">
            <div class="img-ops">
              <button title="替换（粘贴或选文件）" @click="pickFile"><Icon name="reset" :size="14" /></button>
              <button title="保存到本地" @click="saveToLocal"><Icon name="down" :size="14" /></button>
              <button class="del" title="删除图片" @click="removeImage"><Icon name="trash" :size="14" /></button>
            </div>
          </div>
          <div v-else class="img-empty" @click="pickFile">
            <Icon name="img" />
            点击选择或 <span class="kbd">Ctrl+V</span> 粘贴图片<br>每任务 1 张，最长边压缩至 1600px
          </div>
          <input ref="fileEl" type="file" accept="image/*" style="display:none" @change="onFileChange" />
          <div class="img-msg" v-if="imgMsg">{{ imgMsg }}</div>
        </div>

        <div class="subtasks" v-if="task">
          <div class="sub-head">
            <Icon name="subtask" />子任务
            <span class="pct" v-if="task.subtasks.length">{{ subDone }}/{{ task.subtasks.length }}</span>
          </div>
          <div class="sub-track" v-if="task.subtasks.length"><div class="sub-fill" :style="{ width: subPct + '%' }"></div></div>
          <div v-for="st in task.subtasks" :key="st.id" class="subtask" :class="{ done: st.completed }">
            <button class="cb" :class="{ done: st.completed }" @click="store.toggleSubtask(task.id, st.id)"></button>
            <span class="st-title">{{ st.title }}</span>
            <button class="st-del" title="删除子任务" @click="store.removeSubtask(task.id, st.id)"><Icon name="x" :size="12" /></button>
          </div>
          <div class="add-sub">
            <Icon name="plus" :size="14" />
            <input v-model="subTitle" class="sub-input" placeholder="添加子任务，回车保存"
                   @keydown.enter="addSub" />
          </div>
        </div>

        <div class="note-wrap">
          <textarea class="note" v-model="note" @change="save({ note })" placeholder="添加备注…"></textarea>
        </div>
      </div>
    </template>

    <div v-else class="detail-guide">
      <Icon name="list" :size="40" :sw="1.2" />
      <p>点任务行在这里查看与编辑详情<br>标题直接写「明天 09:00 开会」可自动识别日期<br>选中任务后可粘贴一张图片作为附件</p>
    </div>
  </aside>
</template>

<script setup>
import { computed, ref, watch, onMounted, onBeforeUnmount } from 'vue'
import Icon from './Icon.vue'
import { useDataStore } from '../stores/data'
import { friendlyDate, localDateStr } from '../utils/date'
import { repeatLabel } from '../utils/repeat'
import { toResizedDataUrl, imageFromClipboard } from '../utils/image'

const WEEK = ['日', '一', '二', '三', '四', '五', '六']

const store = useDataStore()
const task = computed(() => store.selectedTask)
const listName = computed(() => store.lists.find(l => l.id === task.value?.listId)?.name || '')
const listColor = computed(() => store.lists.find(l => l.id === task.value?.listId)?.color || 'var(--text-tertiary)')
const createdLabel = computed(() => {
  if (!task.value) return ''
  const d = new Date(task.value.createdAt)
  return `${friendlyDate(localDateStr(d.getTime()))} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
})

const title = ref('')
const note = ref('')
const subTitle = ref('')

const subDone = computed(() => (task.value?.subtasks || []).filter(s => s.completed).length)
const subPct = computed(() => {
  const list = task.value?.subtasks || []
  return list.length ? Math.round(subDone.value / list.length * 100) : 0
})

function addSub () {
  if (!task.value) return
  store.addSubtask(task.value.id, subTitle.value)
  subTitle.value = ''
}

function save (patch) {
  if (!task.value) return
  if (patch.title !== undefined && !patch.title.trim()) return
  store.updateTask(task.value.id, patch)
}

// ── 重复 ──
function onRepeatType (type) {
  if (!type) { save({ repeat: null }); return }
  const weekdays = type === 'weekly' ? [1] : undefined
  save({ repeat: { type, interval: 1, ...(weekdays ? { weekdays } : {}) } })
}
function setRepeatInterval (interval) {
  if (!task.value?.repeat) return
  save({ repeat: { ...task.value.repeat, interval } })
}
function toggleWeekday (w) {
  const r = task.value?.repeat
  if (!r) return
  const set = new Set(r.weekdays || [])
  set.has(w) ? set.delete(w) : set.add(w)
  if (!set.size) return // 至少保留一个星期
  save({ repeat: { ...r, weekdays: [...set].sort((a, b) => (a === 0 ? 7 : a) - (b === 0 ? 7 : b)) } })
}


// ── 标签 ──
const tagInput = ref('')
function addTag () {
  if (!task.value) return
  store.addTaskTag(task.value.id, tagInput.value)
  tagInput.value = ''
}

// ── 图片附件（每任务 1 张） ──
const imageDataUrl = ref(null)
const imgLoading = ref(false)
const imgMsg = ref('')
const fileEl = ref(null)
const imgCache = new Map()

async function loadImage () {
  const t = task.value
  if (!t || !t.hasImage) { imageDataUrl.value = null; return }
  if (imgCache.has(t.id)) { imageDataUrl.value = imgCache.get(t.id); return }
  imgLoading.value = true
  const data = await window.api.attachment.read(t.id)
  imgLoading.value = false
  if (task.value && task.value.id === t.id) imageDataUrl.value = data
  if (data) imgCache.set(t.id, data)
}

// 选中任务变化：回填标题/备注并刷新图片（必须在 imgMsg/loadImage 声明之后注册，否则 immediate 回调触发 TDZ 白屏）
watch(() => task.value && task.value.id, () => {
  title.value = task.value?.title || ''
  note.value = task.value?.note || ''
  subTitle.value = ''
  imgMsg.value = ''
  loadImage()
}, { immediate: true })

async function setImage (dataUrl) {
  const t = task.value
  if (!t) return
  imgMsg.value = '保存中…'
  const r = await window.api.attachment.save(t.id, dataUrl)
  if (!r.ok) { imgMsg.value = `保存失败：${r.error}`; return }
  imgCache.set(t.id, dataUrl)
  imageDataUrl.value = dataUrl
  store.updateTask(t.id, { hasImage: true })
  imgMsg.value = ''
}

async function onPaste (e) {
  if (!task.value) return
  const file = imageFromClipboard(e)
  if (!file) return
  e.preventDefault()
  imgMsg.value = '处理粘贴图片…'
  const dataUrl = await toResizedDataUrl(file)
  await setImage(dataUrl)
}

function pickFile () { fileEl.value && fileEl.value.click() }
async function onFileChange (e) {
  const file = e.target.files && e.target.files[0]
  e.target.value = ''
  if (!file || !task.value) return
  imgMsg.value = '处理图片…'
  const dataUrl = await toResizedDataUrl(file)
  await setImage(dataUrl)
}

async function removeImage () {
  const t = task.value
  if (!t) return
  await window.api.attachment.delete(t.id)
  imgCache.delete(t.id)
  imageDataUrl.value = null
  store.updateTask(t.id, { hasImage: false })
  imgMsg.value = ''
}

async function saveToLocal () {
  const t = task.value
  if (!t) return
  const r = await window.api.attachment.export(t.id)
  if (r.ok) imgMsg.value = `已保存到 ${r.path}`
}

// 粘贴监听挂在窗口：仅当选中任务存在时接管图片粘贴
function onWindowPaste (e) {
  if (!task.value) return
  if (imageFromClipboard(e)) onPaste(e)
}
onMounted(() => {
  window.addEventListener('paste', onWindowPaste)
})
onBeforeUnmount(() => window.removeEventListener('paste', onWindowPaste))
</script>

<style scoped>
.detail{border-left:1px solid var(--border-subtle);background:var(--surface-elevated);display:flex;flex-direction:column;min-height:0}
.detail-head{display:flex;align-items:center;gap:8px;padding:12px 16px;border-bottom:1px solid var(--border-subtle);color:var(--text-secondary)}
.crumb{display:flex;align-items:center;gap:6px;font-size:13px}
.actions{margin-left:auto;display:flex;gap:2px}
.detail-body{flex:1;overflow:auto;min-height:0;padding:16px 20px}
.detail-title{width:100%;font-size:16px;font-weight:600;line-height:1.4;color:var(--text-primary);border:0;background:transparent;outline:none;margin-bottom:4px}
.detail-list{display:flex;align-items:center;gap:5px;font-size:12px;color:var(--text-tertiary);margin-bottom:14px}
.fields{display:flex;flex-direction:column}
.field{display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--border-subtle);font-size:13px}
.field :deep(.icon){color:var(--text-tertiary)}
.flabel{color:var(--text-tertiary);width:40px;flex:none}
.finput{flex:1;min-width:0;height:28px;border:1px solid transparent;border-radius:6px;background:transparent;color:var(--text-primary);font-size:13px;padding:0 4px}
.finput:hover{border-color:var(--border-default);background:var(--surface-hover)}
.finput:focus{outline:none;border-color:var(--accent);background:var(--surface-app)}
.mini{border:0;background:transparent;color:var(--text-tertiary);font-size:12px;cursor:default}
.mini:hover{color:var(--accent)}
.field .funit{font-size:12px;color:var(--text-tertiary)}
.finput.num{flex:0 0 56px;text-align:center}
.rlabel-mini{font-size:12px;color:var(--text-tertiary)}
.wd-chips{display:flex;gap:6px;flex-wrap:wrap}
.wd-chip{width:30px;height:26px;border:1px solid var(--border-default);border-radius:6px;background:transparent;color:var(--text-secondary);font-size:12px;cursor:default;padding:0}
.wd-chip.on{border-color:var(--accent);color:var(--accent);background:var(--accent-soft);font-weight:500}
.tagwrap{flex:1;display:flex;align-items:center;gap:6px;flex-wrap:wrap;min-width:0}
.tagchip{display:inline-flex;align-items:center;gap:4px;font-size:12px;color:var(--accent);background:var(--accent-soft);border-radius:4px;padding:2px 6px}
.tagx{border:0;background:transparent;color:var(--accent);cursor:default;padding:0;display:grid;place-items:center}
.tagx:hover{color:var(--p-high)}
.tag-input{flex:1;min-width:70px;border:0;background:transparent;font-size:13px;color:var(--text-primary);outline:none;padding:2px 0}
.tag-input::placeholder{color:var(--text-tertiary)}

.img-section{padding:14px 0;border-bottom:1px solid var(--border-subtle)}
.img-head{display:flex;align-items:center;gap:8px;font-size:13px;margin-bottom:10px}
.img-head :deep(.icon){color:var(--text-tertiary)}
.img-head .cnt{margin-left:auto;font-size:12px;color:var(--text-tertiary)}
.img-frame{position:relative;border-radius:10px;overflow:hidden;border:1px solid var(--border-default);background:var(--surface-hover)}
.img-frame img{display:block;width:100%;max-height:220px;object-fit:cover}
.img-ops{position:absolute;top:8px;right:8px;display:flex;gap:6px;opacity:0;transition:opacity .15s}
.img-frame:hover .img-ops{opacity:1}
.img-ops button{width:28px;height:28px;border:0;border-radius:6px;background:rgba(0,0,0,.55);color:#fff;display:grid;place-items:center;cursor:default;padding:0}
.img-ops button:hover{background:rgba(0,0,0,.75)}
.img-ops button.del:hover{background:var(--p-high)}
.img-empty{border:1.5px dashed var(--border-default);border-radius:10px;padding:20px 14px;text-align:center;color:var(--text-tertiary);font-size:12.5px;line-height:1.9;cursor:default}
.img-empty:hover{border-color:var(--accent);background:var(--surface-hover)}
.img-empty :deep(.icon){width:26px;height:26px;display:block;margin:0 auto 6px}
.img-empty .kbd{font-family:"Cascadia Mono","Consolas",monospace;font-size:11px;border:1px solid var(--border-default);border-radius:4px;background:var(--surface-sidebar);padding:1px 5px;margin:0 2px;color:var(--text-secondary)}
.img-msg{margin-top:6px;font-size:11.5px;color:var(--text-tertiary)}

.subtasks{padding:12px 0;border-bottom:1px solid var(--border-subtle)}
.sub-head{display:flex;align-items:center;gap:8px;font-size:13px;color:var(--text-primary)}
.sub-head :deep(.icon){color:var(--text-tertiary)}
.sub-head .pct{margin-left:auto;font-size:12px;color:var(--text-tertiary)}
.sub-track{height:3px;border-radius:2px;background:var(--border-subtle);margin:8px 0 4px;overflow:hidden}
.sub-fill{height:100%;background:var(--success);border-radius:2px;transition:width .2s}
.subtask{display:flex;align-items:center;gap:10px;padding:7px 0;font-size:14px}
.subtask .cb{width:16px;height:16px}
.subtask.done .st-title{color:var(--text-tertiary);text-decoration:line-through}
.st-title{flex:1;min-width:0;word-break:break-word}
.st-del{width:20px;height:20px;border:0;border-radius:4px;background:transparent;color:var(--text-tertiary);display:grid;place-items:center;cursor:default;padding:0;opacity:0}
.subtask:hover .st-del{opacity:1}
.st-del:hover{color:var(--p-high)}
.add-sub{display:flex;align-items:center;gap:10px;padding:8px 0 0;font-size:13px;color:var(--text-tertiary)}
.sub-input{flex:1;min-width:0;border:0;border-bottom:1px solid transparent;background:transparent;font-size:13px;color:var(--text-primary);outline:none;padding:2px 0}
.sub-input:focus{border-bottom-color:var(--accent)}
.sub-input::placeholder{color:var(--text-tertiary)}

.note-wrap{padding:12px 0}
.note{width:100%;min-height:72px;border:0;background:transparent;resize:vertical;font-size:13px;line-height:1.6;color:var(--text-primary);outline:none;font-family:inherit}
.detail-guide{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;color:var(--text-tertiary);font-size:13px;text-align:center;line-height:1.8;padding:0 30px}
.detail-guide :deep(.icon){color:var(--border-default)}
</style>
