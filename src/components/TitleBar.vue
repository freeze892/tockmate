<template>
  <div class="titlebar">
    <div class="brand">
      <span class="mark" :title="agent ? 'Agent 派发已启用' : ''">
        <Icon name="logo" :size="14" :sw="2.5" />
        <Icon v-if="agent" name="sparkle" :size="11" class="sparkle" />
      </span>{{ brand }}
    </div>
    <div class="win">
      <button @click="api.win.minimize()" title="最小化"><Icon name="min" /></button>
      <button @click="api.win.maximize()" title="最大化/还原"><Icon name="max" /></button>
      <button class="close" @click="api.win.close()" title="关闭"><Icon name="x" /></button>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import Icon from './Icon.vue'
import { BRAND } from '../brand'
const brand = BRAND
const api = window.api
// Agent 能力（open-core）：完整版标题栏 logo 带星芒角标，核心版无
const agent = ref(false)
onMounted(() => {
  api?.capabilities?.().then(c => { agent.value = !!c.extension }).catch(() => {})
})
</script>

<style scoped>
.titlebar{display:flex;align-items:center;height:36px;padding:0 8px;-webkit-app-region:drag;user-select:none}
.brand{display:flex;align-items:center;gap:7px;font-size:12.5px;font-weight:600;color:var(--text-primary)}
.mark{width:16px;height:16px;border-radius:5px;background:var(--accent);display:grid;place-items:center;color:#fff;position:relative}
.mark .sparkle{position:absolute;right:-1px;top:-1px;color:#fff}
.win{margin-left:auto;display:flex;height:100%;-webkit-app-region:no-drag}
.win button{width:44px;height:100%;border:0;background:transparent;color:var(--text-secondary);display:grid;place-items:center;cursor:default}
.win button:hover{background:var(--surface-hover)}
.win button.close:hover{background:#E5484D;color:#fff}
</style>
