<template>
  <section class="main">
    <div class="main-head">
      <h1>统计报表</h1><span class="sub">{{ rangeLabel }}</span>
      <div class="range">
        <button v-for="r in RANGES" :key="r.days" :class="{ on: rangeDays === r.days }"
                @click="rangeDays = r.days">{{ r.label }}</button>
      </div>
    </div>
    <div class="content">
      <div class="kpis">
        <div class="kpi"><div class="num">{{ kpis.doneTasks }}<em>个</em></div><div class="lab">完成任务</div>
          <div class="delta" :class="{ down: kpis.doneDelta < 0 }" v-if="kpis.doneDelta !== 0">{{ deltaText(kpis.doneDelta, '个') }}</div></div>
        <div class="kpi"><div class="num">{{ kpis.pomodoros }}<em>次</em></div><div class="lab">番茄专注</div>
          <div class="delta" :class="{ down: kpis.pomodoroDelta < 0 }" v-if="kpis.pomodoroDelta !== 0">{{ deltaText(kpis.pomodoroDelta, '次') }}</div></div>
        <div class="kpi"><div class="num">{{ focusHours }}<em>小时</em></div><div class="lab">累计专注</div>
          <div class="delta" :class="{ down: kpis.focusDelta < 0 }" v-if="kpis.focusDelta !== 0">{{ deltaText(kpis.focusDelta, '分钟') }}</div></div>
        <div class="kpi"><div class="num" v-if="kpis.onTimeRate !== null">{{ kpis.onTimeRate }}<em>%</em></div><div class="num" v-else>—</div><div class="lab">按期完成率</div></div>
      </div>

      <div class="card">
        <div class="card-head">番茄专注热力图<span class="sub">最近 12 周 · 每格一天 · 颜色越深专注越久</span></div>
        <div class="card-body">
          <div class="heat-months"><span>8月</span><span>9月</span><span>10月</span><span>11月</span></div>
          <div class="heat">
            <div v-for="d in heat" :key="d.iso" class="heat-cell" :class="d.level ? 'l' + d.level : ''"
                 :title="d.iso + (d.minutes ? ' · 专注 ' + d.minutes + ' 分钟' : '')"></div>
          </div>
          <div class="heat-legend">少 <span class="lg-cell"></span><span class="lg-cell l1"></span><span class="lg-cell l2"></span><span class="lg-cell l3"></span><span class="lg-cell l4"></span> 多</div>
        </div>
      </div>

      <div class="card">
        <div class="card-head">任务完成趋势<span class="sub">最近 14 天 · 每日完成数</span></div>
        <div class="card-body">
          <div class="trend">
            <div v-for="d in trend" :key="d.iso" class="bar" :class="{ today: d.iso === today }">
              <span class="v" v-if="d.count">{{ d.count }}</span>
              <div class="col" :style="{ height: barHeight(d.count) }"></div>
              <span class="d">{{ dayLabel(d.iso) }}</span>
            </div>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-head">清单任务分布<span class="sub">进行中任务 · 按清单</span></div>
        <div class="card-body dist">
          <div v-for="d in dist" :key="d.id" class="dist-row">
            <span class="name"><span class="ldot" :style="{ background: d.color }"></span>{{ d.name }}</span>
            <div class="track"><div class="fill" :style="{ width: distPct(d.count) + '%', background: d.color }"></div></div>
            <span class="num">{{ d.count }} 个</span>
          </div>
          <div v-if="!dist.length" class="dist-empty">暂无进行中任务</div>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup>
import { computed, ref } from 'vue'
import { useDataStore } from '../stores/data'
import { pomodoroHeatmap, completionTrend, listDistribution, periodKpis } from '../utils/stats'
import { todayISO, addDaysISO } from '../utils/date'

const store = useDataStore()
const today = todayISO()
const RANGES = [{ days: 7, label: '周' }, { days: 30, label: '月' }, { days: 365, label: '年' }]
const rangeDays = ref(30)
const rangeLabel = computed(() => (RANGES.find(r => r.days === rangeDays.value) || {}).label === '月' ? '10月' : '近期')

const kpis = computed(() => periodKpis(store.tasks, store.pomodoro.logs || [], today, rangeDays.value))
const focusHours = computed(() => (kpis.value.focusMinutes / 60).toFixed(1))
const heat = computed(() => pomodoroHeatmap(store.pomodoro.logs || [], 12, today))
const trend = computed(() => completionTrend(store.tasks, 14, today))
const dist = computed(() => listDistribution(store.tasks, store.activeLists))
const maxDist = computed(() => Math.max(1, ...dist.value.map(d => d.count)))
const distPct = c => Math.round(c / maxDist.value * 100)
const maxTrend = computed(() => Math.max(1, ...trend.value.map(d => d.count)))
const barHeight = c => Math.max(3, Math.round(c / maxTrend.value * 100)) + '%'
const deltaText = (v, unit) => (v > 0 ? '↑ 较上期 +' : '↓ 较上期 ') + Math.abs(v) + ' ' + unit
const dayLabel = iso => { const d = new Date(iso + 'T00:00:00'); return (d.getMonth() + 1) + '/' + d.getDate() }
</script>

<style scoped>
.main{display:flex;flex-direction:column;min-width:0;min-height:0;overflow:auto}
.main-head{display:flex;align-items:flex-end;gap:12px;padding:20px 24px 16px;position:sticky;top:0;background:var(--surface-app);z-index:2}
.main-head h1{font-size:20px;font-weight:600;letter-spacing:-.01em}
.main-head .sub{font-size:13px;color:var(--text-secondary);padding-bottom:2px}
.range{margin-left:auto;display:flex;background:var(--surface-hover);border-radius:6px;padding:2px}
.range button{padding:4px 14px;border-radius:4px;font-size:13px;color:var(--text-secondary);border:0;background:transparent;cursor:default}
.range button.on{background:var(--surface-app);color:var(--text-primary);font-weight:500;box-shadow:0 1px 2px rgba(0,0,0,.04)}
.content{padding:0 24px 28px;display:flex;flex-direction:column;gap:16px}

.kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:14px}
.kpi{border:1px solid var(--border-default);border-radius:10px;padding:16px 20px;background:var(--surface-elevated)}
.kpi .num{font-size:26px;font-weight:600;letter-spacing:-.01em}
.kpi .num em{font-style:normal;font-size:13px;font-weight:400;color:var(--text-secondary);margin-left:3px}
.kpi .lab{font-size:12px;color:var(--text-tertiary);margin-top:3px}
.kpi .delta{font-size:11.5px;margin-top:6px;color:var(--success)}
.kpi .delta.down{color:var(--p-high)}

.card{border:1px solid var(--border-default);border-radius:10px;background:var(--surface-elevated)}
.card-head{display:flex;align-items:center;padding:14px 20px 0;font-size:13px;font-weight:600}
.card-head .sub{margin-left:auto;font-size:12px;font-weight:400;color:var(--text-tertiary)}
.card-body{padding:14px 20px 18px}

.heat{display:grid;grid-template-rows:repeat(7,1fr);grid-auto-flow:column;grid-auto-columns:1fr;gap:4px;width:100%;height:154px}
.heat-cell{border-radius:3px;background:var(--border-subtle)}
.heat-cell.l1{background:#C7D7FE}.heat-cell.l2{background:#8FAEFC}.heat-cell.l3{background:#5B84FF}.heat-cell.l4{background:#2C56D6}
.heat-legend{display:flex;align-items:center;gap:4px;margin-top:10px;font-size:11px;color:var(--text-tertiary);justify-content:flex-end}
.lg-cell{width:12px;height:12px;border-radius:3px;background:var(--border-subtle)}
.lg-cell.l1{background:#C7D7FE}.lg-cell.l2{background:#8FAEFC}.lg-cell.l3{background:#5B84FF}.lg-cell.l4{background:#2C56D6}

.trend{display:flex;align-items:flex-end;gap:6px;height:150px;padding-top:6px}
.trend .bar{flex:1;display:flex;flex-direction:column;align-items:center;gap:5px;height:100%;justify-content:flex-end}
.trend .bar .col{width:100%;max-width:34px;border-radius:4px 4px 0 0;background:var(--accent);transition:height .2s}
.trend .bar.today .col{background:var(--accent-hover)}
.trend .bar .v{font-size:10.5px;color:var(--text-secondary)}
.trend .bar .d{font-size:10.5px;color:var(--text-tertiary);white-space:nowrap}

.dist{display:flex;flex-direction:column;gap:12px}
.dist-row{display:grid;grid-template-columns:80px 1fr 64px;align-items:center;gap:12px;font-size:13px}
.dist-row .name{display:flex;align-items:center;gap:6px}
.dist-row .ldot{margin:0}
.dist-row .track{height:8px;border-radius:4px;background:var(--border-subtle);overflow:hidden}
.dist-row .fill{height:100%;border-radius:4px;transition:width .2s}
.dist-row .num{text-align:right;color:var(--text-secondary);font-size:12.5px}
.dist-empty{font-size:12.5px;color:var(--text-tertiary);text-align:center;padding:8px 0}
</style>
