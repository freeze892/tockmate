<template>
  <section class="main">
    <div class="main-head">
      <h1>习惯打卡</h1><span class="sub">{{ todayLabel }}</span>
      <button class="btn primary" style="margin-left:auto" @click="startAdd" v-if="!adding">
        <Icon name="plus" />新建习惯
      </button>
    </div>

    <div class="content">
      <div class="summary" v-if="habits.length">
        <div><div class="big">{{ doneTodayCount }} <em>/ {{ habits.length }}</em></div><div class="lab">今日已完成</div></div>
        <div class="track"><div class="fill" :style="{ width: pct + '%' }"></div></div>
        <div class="msg">{{ doneTodayCount === habits.length ? '今日全部完成，漂亮' : `还差 ${habits.length - doneTodayCount} 个习惯，加油` }}</div>
      </div>

      <!-- 新建表单 -->
      <div class="habit add-form" v-if="adding">
        <div class="form-row">
          <input ref="nameInput" v-model="newName" class="name-input" placeholder="习惯名称，如：喝水 8 杯"
                 @keydown.enter="saveAdd" @keydown.esc="adding = false" />
        </div>
        <div class="form-row icons">
          <button v-for="ic in ICON_CHOICES" :key="ic" class="ichoice" :class="{ on: ic === newIcon }"
                  @mousedown.prevent @click="newIcon = ic">
            <Icon :name="ic" :size="18" />
          </button>
        </div>
        <div class="form-row">
          <button v-for="c in PALETTE" :key="c" class="dot" :class="{ on: c === newColor }"
                  :style="{ background: c }" @mousedown.prevent @click="newColor = c"></button>
          <span class="form-actions">
            <button class="btn primary" @click="saveAdd">保存</button>
            <button class="btn ghost" @click="adding = false">取消</button>
          </span>
        </div>
      </div>

      <div v-if="!habits.length && !adding" class="empty-tip">
        <Icon name="flame" />
        还没有习惯，点「新建习惯」开始第一个
      </div>

      <template v-for="h in habits" :key="h.id">
        <div class="habit">
        <span class="hicon" :style="{ background: softColor(h.color), color: h.color }">
          <Icon :name="h.icon || 'check'" :size="20" :sw="1.75" />
        </span>
        <div class="hinfo">
          <div class="hname">{{ h.name }}</div>
          <div class="hstreak"><Icon name="flame" :size="13" />连续 {{ streakOf(h) }} 天</div>
        </div>
        <div class="week">
          <div v-for="d in weekOf(h)" :key="d.iso" class="wday">
            <span class="l">{{ dayLabel(d.iso) }}</span>
            <span class="wdot" :class="{ hit: d.done, today: d.iso === today && !d.done }">
              <Icon v-if="d.done" name="check" :size="12" :sw="2.5" />
            </span>
          </div>
        </div>
        <button class="bellbtn" :class="{ on: h.reminder && h.reminder.mode !== 'off' }" title="提醒设置"
                @click="remOpen = remOpen === h.id ? '' : h.id">
          <Icon name="bell" :size="14" />
        </button>
        <button class="checkbtn" :class="{ done: doneToday(h) }" :title="doneToday(h) ? '取消今日打卡' : '今日打卡'"
                @click="toggleToday(h)">
          <Icon name="check" :size="20" />
        </button>
        <button class="del-btn" title="删除习惯" @click="removeHabit(h)">
          <Icon name="trash" :size="15" />
        </button>
        </div>
        <div class="remcfg" v-if="remOpen === h.id">
          <span class="rlab2">提醒</span>
          <select class="rin" :value="remMode(h)" @change="setRem(h, { mode: $event.target.value })">
            <option value="off">关闭</option>
            <option value="daily">每天定时</option>
            <option value="interval">间隔循环</option>
          </select>
          <template v-if="remMode(h) === 'daily'">
            <input type="time" class="rin" :value="(h.reminder && h.reminder.time) || '09:00'"
                   @change="setRem(h, { mode: 'daily', time: $event.target.value })" />
            <span class="rhint">当天已打卡则不再提醒</span>
          </template>
          <template v-if="remMode(h) === 'interval'">
            <span class="rlab2">每</span>
            <input type="number" min="5" step="5" class="rin num" :value="(h.reminder && h.reminder.minutes) || 60"
                   @change="setRem(h, { mode: 'interval', minutes: $event.target.value })" />
            <span class="rlab2">分钟</span>
            <input type="time" class="rin" :value="(h.reminder && h.reminder.from) || '09:00'"
                   @change="setRem(h, { mode: 'interval', minutes: (h.reminder && h.reminder.minutes) || 60, from: $event.target.value, to: (h.reminder && h.reminder.to) || '22:00' })" />
            <span class="rlab2">至</span>
            <input type="time" class="rin" :value="(h.reminder && h.reminder.to) || '22:00'"
                   @change="setRem(h, { mode: 'interval', minutes: (h.reminder && h.reminder.minutes) || 60, from: (h.reminder && h.reminder.from) || '09:00', to: $event.target.value })" />
            <span class="rhint">时段内循环提醒（适合喝水这类一天多次的）</span>
          </template>
        </div>
      </template>
    </div>
  </section>
</template>

<script setup>
import { ref, computed, nextTick } from 'vue'
import Icon from './Icon.vue'
import { useDataStore } from '../stores/data'
import { streak, last7Days } from '../utils/habits'
import { todayISO, weekdayCN, shortDate, diffDays } from '../utils/date'

const PALETTE = ['#2EA7E0', '#64B94C', '#9A6BF2', '#4772FA', '#F5A623', '#E5484D']
const ICON_CHOICES = ['drop', 'dumbbell', 'book', 'moon', 'heart', 'flame']

const store = useDataStore()
const today = todayISO()
const todayLabel = `${shortDate(today)} ${weekdayCN(today)}`

const habits = computed(() => store.habits.filter(h => !h.deletedAt))
const doneToday = h => (h.records || []).includes(today)
const doneTodayCount = computed(() => habits.value.filter(doneToday).length)
const pct = computed(() => habits.value.length ? Math.round(doneTodayCount.value / habits.value.length * 100) : 0)
const streakOf = h => streak(h.records || [], today)
const weekOf = h => last7Days(h.records || [], today)
function dayLabel (iso) {
  if (iso === today) return '日'
  return weekdayCN(iso).slice(1)
}
function softColor (c) {
  // 简易透明底：hex → rgba(.14)
  const n = parseInt(c.slice(1), 16)
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},.14)`
}
function toggleToday (h) {
  const set = new Set(h.records || [])
  if (set.has(today)) set.delete(today)
  else set.add(today)
  store.updateHabit(h.id, { records: [...set].sort() })
}
function removeHabit (h) {
  if (window.confirm(`删除习惯「${h.name}」？历史打卡记录将一并删除。`)) store.deleteHabit(h.id)
}

// ── 提醒配置（Sprint 17）──
const remOpen = ref('')
const remMode = h => (h.reminder && h.reminder.mode) || 'off'
function setRem (h, patch) {
  const mode = patch.mode
  const prev = h.reminder || {}
  const reminder = mode === 'off' ? null
    : mode === 'daily'
      ? { mode, time: patch.time || prev.time || '09:00' }
      : { mode, minutes: Math.max(5, Number(patch.minutes) || prev.minutes || 60), from: patch.from || prev.from || '09:00', to: patch.to || prev.to || '22:00' }
  store.updateHabit(h.id, { reminder })
}

const adding = ref(false)
const newName = ref('')
const newIcon = ref(ICON_CHOICES[0])
const newColor = ref(PALETTE[0])
const nameInput = ref(null)
function startAdd () {
  adding.value = true
  newIcon.value = ICON_CHOICES[habits.value.length % ICON_CHOICES.length]
  newColor.value = PALETTE[habits.value.length % PALETTE.length]
  nextTick(() => nameInput.value && nameInput.value.focus())
}
function saveAdd () {
  const name = newName.value.trim()
  if (!name) { adding.value = false; return }
  store.addHabit(name, { icon: newIcon.value, color: newColor.value })
  newName.value = ''
  adding.value = false
}
void diffDays
</script>

<style scoped>
.main{display:flex;flex-direction:column;min-width:0;min-height:0}
.main-head{display:flex;align-items:flex-end;gap:12px;padding:20px 24px 16px}
.main-head h1{font-size:20px;font-weight:600;letter-spacing:-.01em}
.main-head .sub{font-size:13px;color:var(--text-secondary);padding-bottom:2px}
.content{flex:1;overflow:auto;min-height:0;padding:0 24px 24px;max-width:900px}
.summary{display:flex;align-items:center;gap:16px;border:1px solid var(--border-default);border-radius:10px;padding:16px 20px;margin-bottom:20px;background:var(--surface-elevated)}
.summary .big{font-size:26px;font-weight:600;letter-spacing:-.01em}
.summary .big em{font-style:normal;font-size:14px;font-weight:400;color:var(--text-secondary)}
.summary .lab{font-size:12px;color:var(--text-tertiary);margin-top:2px}
.summary .track{flex:1;height:6px;border-radius:3px;background:var(--border-subtle);overflow:hidden}
.summary .fill{height:100%;background:var(--success);border-radius:3px;transition:width .2s}
.summary .msg{font-size:13px;color:var(--text-secondary)}

.habit{display:flex;align-items:center;gap:16px;border:1px solid var(--border-default);border-radius:10px;padding:16px 20px;margin-bottom:12px;background:var(--surface-elevated);position:relative}
.habit:hover{box-shadow:var(--shadow-soft)}
.hicon{width:40px;height:40px;border-radius:10px;display:grid;place-items:center;flex:none}
.hinfo{width:170px;min-width:0}
.hname{font-size:14px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.hstreak{display:flex;align-items:center;gap:4px;font-size:12px;color:var(--text-secondary);margin-top:3px}
.hstreak :deep(.icon){color:#F5A623}
.week{display:flex;gap:14px;margin-left:8px}
.wday{display:flex;flex-direction:column;align-items:center;gap:6px}
.wday .l{font-size:10px;color:var(--text-tertiary)}
.wdot{width:22px;height:22px;border-radius:50%;display:grid;place-items:center;background:var(--surface-hover);color:#fff}
.wdot.hit{background:var(--success)}
.wdot.today{border:1.5px dashed var(--accent);background:var(--surface-app)}
.checkbtn{margin-left:auto;width:44px;height:44px;border-radius:50%;border:1.5px solid var(--border-default);display:grid;place-items:center;flex:none;color:var(--text-tertiary);background:transparent;cursor:default}
.checkbtn .icon{width:20px;height:20px}
.checkbtn:hover{border-color:var(--accent);color:var(--accent)}
.checkbtn.done{background:var(--success);border-color:var(--success);color:#fff}
.del-btn{position:absolute;right:8px;top:8px;width:24px;height:24px;border:0;border-radius:6px;background:transparent;color:var(--text-tertiary);display:grid;place-items:center;cursor:default;padding:0;opacity:0}
.habit:hover .del-btn{opacity:1}
.bellbtn{position:absolute;right:64px;top:8px;width:24px;height:24px;border:0;border-radius:6px;background:transparent;color:var(--text-tertiary);display:grid;place-items:center;cursor:default;padding:0;opacity:0}
.habit:hover .bellbtn{opacity:1}
.bellbtn.on{color:var(--accent);opacity:1}
.remcfg{display:flex;align-items:center;gap:8px;padding:10px 14px;border-top:1px dashed var(--border-subtle);flex-wrap:wrap}
.rlab2{font-size:12px;color:var(--text-secondary)}
.rhint{font-size:11px;color:var(--text-tertiary)}
.rin{border:1px solid var(--border-default);border-radius:6px;background:var(--surface-elevated);color:var(--text-primary);padding:4px 6px;font-size:12.5px}
.rin.num{width:64px}
.del-btn:hover{color:var(--p-high)}

.add-form{flex-direction:column;align-items:stretch;gap:12px}
.form-row{display:flex;align-items:center;gap:8px}
.name-input{flex:1;height:32px;border:1px solid var(--border-default);border-radius:6px;background:var(--surface-app);color:var(--text-primary);font-size:14px;outline:none;padding:0 10px}
.name-input:focus{border-color:var(--accent)}
.icons .ichoice{width:34px;height:34px;border-radius:8px;border:1.5px solid var(--border-default);background:transparent;color:var(--text-secondary);display:grid;place-items:center;cursor:default}
.icons .ichoice.on{border-color:var(--accent);color:var(--accent);background:var(--accent-soft)}
.dot{width:16px;height:16px;border-radius:50%;border:2px solid transparent;cursor:default;padding:0}
.dot.on{border-color:var(--text-primary)}
.form-actions{margin-left:auto;display:flex;gap:8px}
</style>
