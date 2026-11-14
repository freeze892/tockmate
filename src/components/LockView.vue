<template>
  <div class="lock-wrap">
    <div class="lock-card" :class="{ shake: shaking }">
      <div class="lock-avatar"><Icon name="lock" :size="30" :sw="1.6" /></div>
      <h1>{{ brand }} 已锁定</h1>
      <div class="sub">输入密码解锁你的任务</div>
      <div class="pwd-row">
        <Icon name="key" :size="16" />
        <input ref="inputEl" v-model="password" type="password" placeholder="输入密码"
               @keydown.enter="unlock" autofocus>
      </div>
      <button class="unlock-btn" @click="unlock">解锁</button>
      <div class="error">
        <template v-if="error"><Icon name="x" :size="13" :sw="2" />{{ error }}</template>
      </div>
      <div class="hint">
        密码在 设置 → 应用锁 中管理<br>
        忘记密码：退出应用后删除 <kbd>%APPDATA%\TockMate</kbd> 下的 <kbd>data.json</kbd> 与 <kbd>data.json.bak</kbd> 重置
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import Icon from './Icon.vue'
import { BRAND as brand } from '../brand'

const password = ref('')
const error = ref('')
const shaking = ref(false)
const inputEl = ref(null)

onMounted(() => { inputEl.value && inputEl.value.focus() })

async function unlock () {
  if (!password.value) return
  const r = await window.api.lock.unlock(password.value)
  if (r.ok) { error.value = ''; password.value = ''; return }
  error.value = '密码不正确，请重试'
  password.value = ''
  shaking.value = true
  setTimeout(() => { shaking.value = false }, 400)
}
</script>

<style scoped>
.lock-wrap{display:flex;align-items:center;justify-content:center;min-height:0}
.lock-card{width:360px;text-align:center;padding:44px 40px 36px;border:1px solid var(--border-default);border-radius:14px;background:var(--surface-elevated);box-shadow:var(--shadow-pop)}
.lock-card.shake{animation:shake .35s}
@keyframes shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-8px)}50%{transform:translateX(8px)}75%{transform:translateX(-5px)}}
.lock-avatar{width:64px;height:64px;border-radius:50%;background:var(--accent-soft);color:var(--accent);display:grid;place-items:center;margin:0 auto 16px}
.lock-card h1{font-size:18px;font-weight:600;letter-spacing:-.01em}
.sub{font-size:13px;color:var(--text-secondary);margin-top:6px}
.pwd-row{display:flex;align-items:center;gap:10px;margin-top:26px;border:1px solid var(--border-default);border-radius:8px;padding:0 12px;height:44px;background:var(--surface-app)}
.pwd-row:focus-within{border-color:var(--accent);box-shadow:0 0 0 3px var(--accent-soft)}
.pwd-row :deep(.icon){color:var(--text-tertiary)}
.pwd-row input{flex:1;border:0;background:transparent;outline:none;font-size:14px;color:var(--text-primary);letter-spacing:.2em}
.pwd-row input::placeholder{letter-spacing:normal;color:var(--text-tertiary)}
.unlock-btn{margin-top:14px;width:100%;height:42px;border:0;border-radius:8px;background:var(--accent);color:#fff;font-size:14px;font-weight:500;cursor:default}
.unlock-btn:hover{background:var(--accent-hover)}
.unlock-btn:active{transform:scale(.98)}
.error{display:flex;align-items:center;justify-content:center;gap:6px;margin-top:12px;font-size:12.5px;color:var(--p-high);min-height:18px}
.hint{margin-top:22px;font-size:12px;color:var(--text-tertiary);line-height:1.7}
.hint kbd{font-family:"Cascadia Mono","Consolas",monospace;font-size:11px;border:1px solid var(--border-default);border-radius:4px;background:var(--surface-sidebar);padding:1px 5px}
</style>
