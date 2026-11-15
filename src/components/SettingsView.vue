<template>
  <section class="main">
    <div class="main-head"><h1>设置</h1></div>
    <div class="content"><div class="col">
      <div class="colL">
        <div class="sec-title" style="margin-top:4px">外 观</div>
        <div class="card">
          <div class="row">
            <div class="rlab">主题</div>
            <div class="rctrl" style="margin-left:0;gap:10px">
              <button v-for="t in THEMES" :key="t.value" class="theme-opt" :class="{ sel: store.settings.theme === t.value }"
                      @click="setTheme(t.value)">
                <span class="sw" :class="t.value"><span v-if="t.value==='light'" class="sw-bar"></span><span v-if="t.value==='dark'" class="sw-bar dark-bar"></span></span>
                <span class="tname">{{ t.label }}</span>
              </button>
            </div>
          </div>
        </div>

        <div class="sec-title">番 茄 钟</div>
        <div class="card">
          <div class="row" v-for="f in POMO_FIELDS" :key="f.key">
            <div><div class="rlab">{{ f.label }}</div><div class="rdesc">{{ f.desc }}</div></div>
            <div class="rctrl">
              <div class="stepper">
                <span class="val">{{ store.settings.pomodoro[f.key] }}<em>{{ f.unit }}</em></span>
                <span class="updown">
                  <button class="ud" @click="step(f.key, 1)"><Icon name="chev-u" :size="10" :sw="2" /></button>
                  <button class="ud" @click="step(f.key, -1)"><Icon name="chev-d" :size="10" :sw="2" /></button>
                </span>
              </div>
            </div>
          </div>
        </div>

        <div class="sec-title">应 用 锁</div>
        <div class="card">
          <div class="row" style="align-items:flex-start">
            <div>
              <div class="rlab" style="width:auto">启动时需要输入密码
                <span v-if="appLockEnabled" class="statusText" style="color:var(--success);margin-left:6px">● 已启用</span>
                <span v-else class="statusText" style="margin-left:6px">· 未启用</span>
              </div>
              <div class="rdesc">纯本地验证，密码经 scrypt 加盐哈希存储；托盘菜单可随时手动锁定</div>
              <div v-if="lockMsg" class="rdesc" :style="{ color: lockOk ? 'var(--success)' : 'var(--p-high)' }">{{ lockMsg }}</div>
            </div>
            <div class="rctrl">
              <button v-if="!appLockEnabled && lockMode === ''" class="btn primary" @click="lockMode = 'set'">启用应用锁</button>
              <template v-if="appLockEnabled && lockMode === ''">
                <button class="btn ghost" @click="lockMode = 'change'">修改密码</button>
                <button class="btn ghost lock-off-btn" @click="lockMode = 'remove'">关闭应用锁</button>
              </template>
            </div>
          </div>
          <template v-if="lockMode !== ''">
            <div class="row" v-if="lockMode !== 'set'">
              <div class="rlab">当前密码</div>
              <div class="rctrl" style="margin-left:0"><input v-model="lockCur" type="password" class="input wide" placeholder="验证身份" /></div>
            </div>
            <div class="row" v-if="lockMode !== 'remove'">
              <div class="rlab">新密码</div>
              <div class="rctrl" style="margin-left:0"><input v-model="lockNew" type="password" class="input wide" placeholder="至少 4 位" /></div>
            </div>
            <div class="row" v-if="lockMode !== 'remove'">
              <div class="rlab">确认密码</div>
              <div class="rctrl" style="margin-left:0"><input v-model="lockConfirm" type="password" class="input wide" placeholder="再次输入" /></div>
            </div>
            <div class="row">
              <div class="rctrl" style="margin-left:0">
                <button class="btn primary" @click="saveLock">{{ lockConfirmLabel }}</button>
                <button class="btn ghost" @click="cancelLockMode">取消</button>
              </div>
            </div>
          </template>
        </div>

        <div class="sec-title">快 速 捕 捉</div>
        <div class="card">
          <div class="row">
            <div><div class="rlab">全局快捷键</div><div class="rdesc">任何界面按下即弹出快速记录条（Esc 收起）</div></div>
            <div class="rctrl">
              <select class="finput" style="flex:none;width:190px" :value="store.settings.quickShortcut || 'Control+Shift+Space'"
                      @change="saveQuickShortcut($event.target.value)">
                <option value="Control+Shift+Space">Ctrl+Shift+Space</option>
                <option value="Control+Alt+T">Ctrl+Alt+T</option>
                <option value="Alt+Q">Alt+Q</option>
              </select>
            </div>
          </div>
        </div>

        <div class="sec-title">关 于</div>
        <div class="card">
          <div class="row">
            <div><div class="rlab" style="width:auto">{{ brand }}</div><div class="rdesc">版本 v{{ version }} · 本地优先的待办与专注工具</div></div>
            <div class="rctrl">
              <button class="btn ghost" @click="checkUpdate" :disabled="checking">{{ checking ? '检查中…' : '检查更新' }}</button>
            </div>
          </div>
          <div class="row" v-if="updateMsg">
            <div class="rctrl" style="margin-left:0">
              <span class="statusText" :class="{ err: !!updateMsg && !updateAvailable }" style="white-space:normal">{{ updateMsg }}</span>
              <button v-if="updateAvailable && updateUrl" class="btn primary" @click="openDownload">前往下载</button>
            </div>
          </div>
        </div>
      </div>

      <div class="colR">
        <div class="sec-title">迁 移 导 入</div>
        <div class="card">
          <div class="row" style="align-items:flex-start">
            <div>
              <div class="rlab" style="width:auto">从 CSV 导入任务</div>
              <div class="rdesc">支持滴答清单 CSV 导出（无表头）与带表头通用 CSV（Todoist 等）。仅新增任务，不改现有数据。</div>
              <input ref="migFileEl" type="file" accept=".csv,text/csv" style="display:none" @change="onMigFile" />
              <button class="btn ghost" style="margin-top:6px" @click="migFileEl && migFileEl.click()">选择 CSV 文件</button>
            </div>
          </div>
          <div class="row" style="align-items:flex-start" v-if="migInfo">
            <div>
              <div class="rdesc">来源：{{ migInfo.source }} · 识别 {{ migInfo.count }} 条任务 · 跳过 {{ migInfo.skipped }} 行</div>
              <div class="rdesc" v-for="(t, i) in migInfo.tasks.slice(0, 3)" :key="i">
                示例：{{ t.title }}{{ t.dueDate ? '（' + t.dueDate + '）' : '' }}{{ t.listName ? ' → ' + t.listName : '' }}
              </div>
            </div>
          </div>
          <div class="row" v-if="migInfo">
            <div class="rctrl"><button class="btn primary" @click="doMigrate">导入 {{ migInfo.count }} 条任务</button></div>
          </div>
          <div class="row" v-if="migMsg">
            <div class="rdesc">{{ migMsg }}</div>
          </div>
        </div>

        <div class="sec-title" style="margin-top:4px">数 据 与 同 步</div>
        <div class="card">
          <div class="row" style="align-items:flex-start">
            <div>
              <div class="rlab" style="width:auto">WebDAV 同步</div>
              <div class="rdesc">通过 WebDAV 在多台设备间同步数据，支持坚果云、Nextcloud 等</div>
            </div>
            <div class="rctrl"><button class="toggle" :class="{ off: !webdav.enabled }" @click="webdav.enabled = !webdav.enabled; saveWebdav()"></button></div>
          </div>
          <div class="row">
            <div class="rlab">服务器</div>
            <div class="rctrl"><input v-model.trim="webdav.url" class="input wide" placeholder="https://dav.jianguoyun.com/dav/" /></div>
          </div>
          <div class="row">
            <div class="rlab">账号</div>
            <div class="rctrl"><input v-model.trim="webdav.username" class="input wide" placeholder="you@example.com" /></div>
          </div>
          <div class="row">
            <div class="rlab">应用密码</div>
            <div class="rctrl">
              <input v-model="webdav.password" type="password" class="input wide mono" :placeholder="savedPassword ? '已加密保存，重填可更新' : '••••••••'" />
              <button class="btn ghost" @click="testConn" :disabled="testing">{{ testing ? '测试中…' : '测试连接' }}</button>
            </div>
          </div>
          <div class="row" v-if="testResult">
            <div class="rlab"></div>
            <div class="rctrl" style="margin-left:0">
              <span style="display:inline-flex;align-items:center;gap:6px">
                <span class="status-dot" :class="testResult.ok ? 'ok' : 'err'"></span>
                <span class="statusText" :class="{ err: !testResult.ok }" style="white-space:normal">{{ testResult.detail || (testResult.ok ? '连接成功' : '连接失败：' + testResult.error) }}</span>
              </span>
            </div>
          </div>
          <div class="row">
            <div class="rlab">保存配置</div>
            <div class="rctrl" style="margin-left:0">
              <button class="btn primary" @click="saveWebdav" :disabled="saving">{{ saving ? '保存中…' : '保存并启用' }}</button>
              <span v-if="savedPassword" class="statusText">密码已用系统加密存储</span>
            </div>
          </div>
          <div class="row">
            <div class="rlab">同步状态</div>
            <div class="rctrl" style="margin-left:0">
              <span class="statusText">{{ syncText }}</span>
              <button class="btn primary" @click="syncNow" :disabled="syncing">{{ syncing ? '同步中…' : '立即同步' }}</button>
            </div>
          </div>
          <div class="hint">
            自动同步：启动时拉取一次，本地修改后约 5 秒自动推送。
            坚果云用户请使用「应用密码」而非登录密码：网页端 → 账户信息 → 安全选项 → 添加应用密码。
          </div>
        </div>

        <div class="sec-title">备 份 与 迁 移</div>
        <div class="card">
          <div class="row">
            <div><div class="rlab" style="width:auto">备份与迁移</div><div class="rdesc">导出全部或仅未完成任务为 JSON 备份；导入支持覆盖或智能合并</div></div>
            <div class="rctrl">
              <div class="opt-wrap">
                <button class="btn ghost" @click.stop="exportPop = !exportPop; importPop = false">导出数据</button>
                <div v-if="exportPop" class="popover pop-right pop-up" @click.stop>
                  <button class="pop-item" @mousedown.prevent @click="doExport('all')"><Icon name="check" :size="13" />全部数据<span class="pop-sub">含已完成与已删除</span></button>
                  <button class="pop-item" @mousedown.prevent @click="doExport('active')"><Icon name="check" :size="13" />仅未完成任务<span class="pop-sub">干净的任务清单</span></button>
                </div>
              </div>
              <div class="opt-wrap">
                <button class="btn ghost" @click.stop="startImport">导入数据</button>
                <div v-if="importPop" class="popover pop-right pop-up" @click.stop>
                  <div class="pop-sub" style="padding:6px 10px 2px">{{ stagedInfo }}</div>
                  <button class="pop-item pop-warn" @mousedown.prevent @click="applyImport('replace')">覆盖导入<span class="pop-sub">替换当前全部任务</span></button>
                  <button class="pop-item" @mousedown.prevent @click="applyImport('merge')">追加合并<span class="pop-sub">同 id 取较新，不丢数据</span></button>
                  <button class="pop-item" @mousedown.prevent @click="importPop = false">取消</button>
                </div>
              </div>
            </div>
          </div>
          <div class="row" v-if="importMsg">
            <div class="rctrl" style="margin-left:0"><span class="statusText">{{ importMsg }}</span></div>
          </div>
        </div>
      </div>
    </div></div>
  </section>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue'
import Icon from './Icon.vue'
import { BRAND as brand } from '../brand'
import { useDataStore } from '../stores/data'
import { parseCSV } from '../utils/csv'
import { mapRows } from '../utils/migrate'

const store = useDataStore()
const THEMES = [
  { value: 'auto', label: '跟随系统' },
  { value: 'light', label: '浅色' },
  { value: 'dark', label: '深色' }
]
const POMO_FIELDS = [
  { key: 'focus', label: '专注时长', desc: '每个番茄的专注时间', unit: '分钟' },
  { key: 'shortBreak', label: '短休息', desc: '每个番茄后的休息时间', unit: '分钟' },
  { key: 'longBreak', label: '长休息', desc: '连续完成多个番茄后的长休息', unit: '分钟' },
  { key: 'interval', label: '长休息间隔', desc: '每完成几个番茄进入长休息', unit: '个' }
]
const LIMITS = { focus: [1, 120], shortBreak: [1, 30], longBreak: [1, 60], interval: [2, 8] }

function setTheme (v) { store.updateSettings({ theme: v }) }
function saveQuickShortcut (v) { store.updateSettings({ quickShortcut: v }) }
function step (key, dir) {
  const [min, max] = LIMITS[key]
  const v = Math.min(max, Math.max(min, store.settings.pomodoro[key] + dir))
  if (v !== store.settings.pomodoro[key]) store.updateSettings({ pomodoro: { ...store.settings.pomodoro, [key]: v } })
}

// ── WebDAV ──
const version = ref('…')
const webdav = ref({ enabled: false, url: '', username: '', password: '' })
const savedPassword = ref(false)
const testing = ref(false)
const testResult = ref(null)
const saving = ref(false)
const syncing = ref(false)

const migFileEl = ref(null)
const migInfo = ref(null)
const migMsg = ref('')
async function onMigFile (e) {
  const f = e.target.files && e.target.files[0]
  e.target.value = ''
  if (!f) return
  try {
    const text = await f.text()
    const m = mapRows(parseCSV(text))
    if (!m.count) { migInfo.value = null; migMsg.value = '未解析出任务（请确认 CSV 格式）'; return }
    migInfo.value = m
    migMsg.value = ''
  } catch (err) {
    migInfo.value = null
    migMsg.value = '解析失败：' + String(err && err.message || err).slice(0, 80)
  }
}
function doMigrate () {
  if (!migInfo.value || !migInfo.value.count) return
  store.importMigrated(migInfo.value.tasks)
  migMsg.value = '已导入 ' + migInfo.value.count + ' 条任务'
  migInfo.value = null
}

onMounted(async () => {
  version.value = await window.api.version()
  const cfg = store.settings.webdav || {}
  webdav.value = { enabled: !!cfg.enabled, url: cfg.url || '', username: cfg.username || '', password: '' }
  savedPassword.value = !!cfg.passwordEnc
})

const syncText = computed(() => {
  const st = store.syncState
  if (!st || (!st.lastSyncAt && !st.lastError)) return '尚未同步'
  if (st.lastError) return `上次同步失败：${st.lastError.slice(0, 40)}`
  const d = new Date(st.lastSyncAt)
  return `上次同步 ${d.getMonth() + 1}月${d.getDate()}日 ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
})

async function testConn () {
  testing.value = true
  testResult.value = null
  const r = await window.api.webdav.test({
    url: webdav.value.url,
    username: webdav.value.username,
    password: webdav.value.password,
    useSaved: !webdav.value.password && savedPassword.value
  })
  // 主进程返回 { ok, steps: [...] } —— 权限探针的逐步结果
  if (r && r.steps) {
    testResult.value = { ok: r.ok, detail: r.steps.join('；') }
  } else {
    testResult.value = { ok: !!r.ok, detail: r.ok ? '连接成功' : '连接失败：' + (r.error || '') }
  }
  testing.value = false
}
async function saveWebdav () {
  saving.value = true
  await window.api.webdav.save({
    url: webdav.value.url,
    username: webdav.value.username,
    password: webdav.value.password,
    enabled: webdav.value.enabled,
    useSaved: !webdav.value.password && savedPassword.value
  })
  savedPassword.value = true
  saving.value = false
}
async function syncNow () {
  syncing.value = true
  await window.api.syncNow()
  syncing.value = false
}

// ── 应用锁（按钮式流程：启用/修改/关闭各自独立，状态即时显示） ──
const appLockEnabled = ref(false)
const lockMode = ref('') // '' | 'set' | 'change' | 'remove'
const lockCur = ref('')
const lockNew = ref('')
const lockConfirm = ref('')
const lockMsg = ref('')
const lockOk = ref(false)

const lockConfirmLabel = computed(() =>
  ({ set: '确认启用', change: '保存新密码', remove: '确认关闭' }[lockMode.value] || ''))

function loadLockState () {
  appLockEnabled.value = !!store.settings.appLock?.enabled
  lockCur.value = ''
  lockNew.value = ''
  lockConfirm.value = ''
}
loadLockState()
watch(() => store.settings.appLock?.enabled, () => {
  loadLockState()
  if (lockMode.value && appLockEnabled.value !== (lockMode.value !== 'remove' ? false : true)) {
    // 操作成功后的状态刷新：退出编辑模式
    lockMode.value = ''
  }
})

function cancelLockMode () {
  lockMode.value = ''
  lockCur.value = ''
  lockNew.value = ''
  lockConfirm.value = ''
  lockMsg.value = ''
}

async function saveLock () {
  if (lockMode.value === 'set') {
    if (!lockNew.value) { lockMsg.value = '请输入新密码'; lockOk.value = false; return }
    if (lockNew.value.length < 4) { lockMsg.value = '密码至少 4 位'; lockOk.value = false; return }
    if (lockNew.value !== lockConfirm.value) { lockMsg.value = '两次输入的密码不一致'; lockOk.value = false; return }
    const r = await window.api.lock.set({ currentPassword: '', newPassword: lockNew.value })
    if (!r.ok) { lockMsg.value = r.error; lockOk.value = false; return }
    loadLockState()
    lockMode.value = ''
    lockMsg.value = '应用锁已启用，下次启动生效'
    lockOk.value = true
  } else if (lockMode.value === 'change') {
    if (!lockCur.value) { lockMsg.value = '请输入当前密码'; lockOk.value = false; return }
    if (!lockNew.value) { lockMsg.value = '请输入新密码'; lockOk.value = false; return }
    if (lockNew.value !== lockConfirm.value) { lockMsg.value = '两次输入的密码不一致'; lockOk.value = false; return }
    const r = await window.api.lock.set({ currentPassword: lockCur.value, newPassword: lockNew.value })
    if (!r.ok) { lockMsg.value = r.error; lockOk.value = false; return }
    loadLockState()
    lockMode.value = ''
    lockMsg.value = '密码已修改'
    lockOk.value = true
  } else if (lockMode.value === 'remove') {
    if (!lockCur.value) { lockMsg.value = '请输入当前密码以关闭应用锁'; lockOk.value = false; return }
    const r = await window.api.lock.set({ currentPassword: lockCur.value, newPassword: '' })
    if (!r.ok) { lockMsg.value = r.error; lockOk.value = false; return }
    loadLockState()
    lockMode.value = ''
    lockMsg.value = '应用锁已关闭'
    lockOk.value = true
  }
}

async function checkUpdate () {
  checking.value = true
  const r = await window.api.checkUpdate()
  checking.value = false
  updateAvailable.value = !!r.ok && !!r.update
  updateUrl.value = r.url || ''
  if (r.update) updateMsg.value = '发现新版本 v' + r.latest + (r.notes ? ' · ' + r.notes : '')
  else updateMsg.value = r.message || (r.ok ? '当前已是最新版本' : '')
}

async function openDownload () {
  // url 由主进程二次校验（仅 https），外链交给系统浏览器
  await window.api.openExternal(updateUrl.value)
}

const updateMsg = ref('')
const updateAvailable = ref(false)
const updateUrl = ref('')

// ── 导入导出 ──
const importMsg = ref('')
const exportPop = ref(false)
const importPop = ref(false)
const stagedInfo = ref('')

async function doExport (scope) {
  exportPop.value = false
  const r = await window.api.exportData(scope)
  importMsg.value = r.ok ? `已导出到 ${r.path}` : (r.canceled ? '' : `导出失败：${r.error}`)
}
async function startImport () {
  exportPop.value = false
  const r = await window.api.importData()
  if (!r.ok) { importMsg.value = r.canceled ? '' : `导入失败：${r.error}`; return }
  stagedInfo.value = `${r.fileName}（任务 ${r.counts.tasks} · 清单 ${r.counts.lists} · 习惯 ${r.counts.habits}）`
  importPop.value = true
}
async function applyImport (mode) {
  importPop.value = false
  const r = await window.api.importApply(mode)
  importMsg.value = r.ok
    ? (mode === 'merge' ? '已按智能合并导入' : '已覆盖导入')
    : `导入失败：${r.error}`
}
function onOutsideClose () { exportPop.value = false; importPop.value = false }
onMounted(() => window.addEventListener('click', onOutsideClose))
onBeforeUnmount(() => window.removeEventListener('click', onOutsideClose))
</script>

<style scoped>
.main{display:flex;flex-direction:column;min-width:0;min-height:0}
.main-head{padding:20px 24px 4px}
.main-head h1{font-size:20px;font-weight:600;letter-spacing:-.01em}
.content{flex:1;overflow:auto;min-height:0;padding:4px 24px 20px}
.col{max-width:1040px;display:grid;grid-template-columns:440px minmax(0,1fr);gap:20px;align-items:start}
.sec-title{font-size:11px;font-weight:600;color:var(--text-tertiary);letter-spacing:.05em;margin:14px 0 8px}
.card{border:1px solid var(--border-default);border-radius:10px;background:var(--surface-elevated)}
.row{display:flex;align-items:center;gap:12px;padding:11px 14px;border-bottom:1px solid var(--border-subtle)}
.row:last-child{border-bottom:0}
.rlab{font-size:13px;color:var(--text-primary);font-weight:500;width:88px;flex:none}
.rdesc{font-size:12px;color:var(--text-tertiary);margin-top:2px;font-weight:400}
.rctrl{margin-left:auto;display:flex;align-items:center;gap:8px}

.theme-opt{display:flex;flex-direction:column;gap:6px;padding:9px;border:1.5px solid var(--border-default);border-radius:8px;width:90px;cursor:default;background:transparent}
.theme-opt.sel{border-color:var(--accent);background:var(--accent-soft)}
.theme-opt .sw{height:34px;border-radius:5px;border:1px solid var(--border-subtle);background:var(--surface-app);position:relative;display:block}
.theme-opt .sw.light{background:#fff}
.theme-opt .sw.auto{background:linear-gradient(105deg,#fff 50%,#1E1F23 50%)}
.theme-opt .sw.dark{background:#1E1F23}
.sw-bar{position:absolute;left:6px;top:6px;width:18px;height:4px;border-radius:2px;background:#4772FA}
.dark-bar{background:#5B84FF}
.theme-opt .tname{font-size:12px;text-align:center;color:var(--text-secondary)}
.theme-opt.sel .tname{color:var(--accent);font-weight:600}

.stepper{display:flex;align-items:center;border:1px solid var(--border-default);border-radius:6px;height:30px}
.stepper .val{width:56px;text-align:center;font-size:13px;border-right:1px solid var(--border-subtle)}
.stepper .val em{font-style:normal;font-size:11px;color:var(--text-tertiary);margin-left:2px}
.stepper .updown{display:flex;flex-direction:column}
.ud{width:26px;height:14.5px;display:grid;place-items:center;border:0;background:transparent;color:var(--text-secondary);cursor:default;padding:0}
.ud:hover{background:var(--surface-hover)}

.input{height:32px;border:1px solid var(--border-default);border-radius:6px;padding:0 10px;font-size:13px;color:var(--text-primary);background:var(--surface-app);outline:none;min-width:0}
.input.wide{width:280px}
.input:focus{border-color:var(--accent);outline:2px solid var(--accent-soft)}
.input.mono{font-family:"Cascadia Mono","Consolas",monospace}
.input:disabled{opacity:.6}
.btn{display:inline-flex;align-items:center;gap:6px;height:30px;padding:0 12px;border-radius:6px;font-size:12.5px;border:1px solid transparent;cursor:default;font-weight:500;white-space:nowrap}
.btn.primary{background:var(--accent);color:#fff}
.btn.primary:hover{background:var(--accent-hover)}
.btn.ghost{border-color:var(--border-default);color:var(--text-primary);background:transparent}
.btn.ghost:hover{background:var(--surface-hover)}
.lock-off-btn:hover{color:var(--p-high);border-color:var(--p-high)}
.btn:disabled{opacity:.5}
.btn:active{transform:scale(.98)}
.status-dot{width:7px;height:7px;border-radius:50%;flex:none}
.status-dot.ok{background:var(--success)}
.status-dot.err{background:var(--p-high)}
.statusText{font-size:12px;color:var(--text-secondary);white-space:nowrap}
.statusText.err{color:var(--p-high)}
.hint{font-size:12px;color:var(--text-tertiary);line-height:1.6;padding:8px 14px;background:var(--surface-sidebar);border-top:1px solid var(--border-subtle);border-radius:0 0 10px 10px}
.toggle{width:36px;height:20px;border-radius:10px;background:var(--accent);position:relative;border:0;cursor:default;padding:0}
.toggle::after{content:"";position:absolute;top:2px;right:2px;width:16px;height:16px;border-radius:50%;background:#fff}
.toggle.off{background:var(--border-default)}
.toggle.off::after{right:auto;left:2px}
</style>
