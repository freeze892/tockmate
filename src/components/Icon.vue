<template>
  <svg class="icon" :style="{ width: size + 'px', height: size + 'px', strokeWidth: sw || 1.5 }"
       viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"
       v-html="body"></svg>
</template>

<script setup>
import { computed } from 'vue'

const ICONS = {
  logo: '<path d="M6.5 12.5l3.5 3.5 7.5-8"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.2-4.2"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M19.1 4.9l-1.8 1.8M6.7 17.3l-1.8 1.8"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  week: '<rect x="3.5" y="5" width="17" height="15.5" rx="2"/><path d="M3.5 9.5h17M8 3v3.5M16 3v3.5"/>',
  inbox: '<path d="M3.5 13.5V17a2 2 0 0 0 2 2h13a2 2 0 0 0 2-2v-3.5"/><path d="M3.5 13.5h4.6l1.4 2.3h5l1.4-2.3h4.6"/><path d="M5.3 13.5L8 6.2A1.6 1.6 0 0 1 9.5 5h5a1.6 1.6 0 0 1 1.5 1.2l2.7 7.3"/>',
  done: '<circle cx="12" cy="12" r="8.5"/><path d="M8.5 12.3l2.4 2.4 4.6-5"/>',
  plus: '<path d="M12 5.5v13M5.5 12h13"/>',
  timer: '<circle cx="12" cy="13.5" r="7.5"/><path d="M12 10v3.5l2.5 1.5M9.5 2.5h5M12 2.5V6"/>',
  flame: '<path d="M12 3s5.5 4.2 5.5 9a5.5 5.5 0 0 1-11 0c0-2 1-3.8 2-5 .3 1.2 1 2.3 2 2.5-.5-2.5.5-5 1.5-6.5z"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1 1.55V21a2 2 0 1 1-4 0v-.09a1.7 1.7 0 0 0-1-1.55 1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.7 1.7 0 0 0 .34-1.87 1.7 1.7 0 0 0-1.55-1H3a2 2 0 1 1 0-4h.09a1.7 1.7 0 0 0 1.55-1 1.7 1.7 0 0 0-.34-1.87l-.06-.06A2 2 0 1 1 7.07 4.2l.06.06a1.7 1.7 0 0 0 1.87.34h.09a1.7 1.7 0 0 0 1-1.55V3a2 2 0 1 1 4 0v.09a1.7 1.7 0 0 0 1 1.55 1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.7 1.7 0 0 0-.34 1.87v.09a1.7 1.7 0 0 0 1.55 1H21a2 2 0 1 1 0 4h-.09a1.7 1.7 0 0 0-1.55 1z"/>',
  'chev-l': '<path d="M14.5 6l-6 6 6 6"/>',
  'chev-r': '<path d="M9.5 6l6 6-6 6"/>',
  'chev-d': '<path d="M6 9.5l6 6 6-6"/>',
  'chev-u': '<path d="M6 14.5l6-6 6 6"/>',
  flag: '<path d="M5.5 21V4.2c0-.4.3-.7.7-.7 4.6-1.4 6.9 2.3 11.6.8.5-.2 1 .2 1 .7v8.4c0 .3-.2.6-.5.7-4.7 1.5-7-2.2-11.6-.8"/><path d="M5.5 21v-8"/>',
  bell: '<path d="M18 9.5a6 6 0 1 0-12 0c0 5-2 6-2 6h16s-2-1-2-6"/><path d="M10 19.5a2.2 2.2 0 0 0 4 0"/>',
  cal: '<rect x="3.5" y="5" width="17" height="15.5" rx="2"/><path d="M3.5 9.5h17M8 3v3.5M16 3v3.5"/>',
  note: '<path d="M19.5 14v4.5a1.5 1.5 0 0 1-1.5 1.5H6a1.5 1.5 0 0 1-1.5-1.5v-13A1.5 1.5 0 0 1 6 4h7"/><path d="M19.7 8.1l-4-4L9 10.8 8.5 14l3.2-.5z"/>',
  subtask: '<path d="M9 6.5h11M9 12h11M9 17.5h11"/><path d="M4 6.5h.01M4 12h.01M4 17.5h.01" stroke-width="2.5"/>',
  trash: '<path d="M4.5 6.5h15M9.5 6V4.5a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1V6M6.5 6.5l.8 12a1.5 1.5 0 0 0 1.5 1.4h6.4a1.5 1.5 0 0 0 1.5-1.4l.8-12"/>',
  more: '<circle cx="5.5" cy="12" r=".8" fill="currentColor"/><circle cx="12" cy="12" r=".8" fill="currentColor"/><circle cx="18.5" cy="12" r=".8" fill="currentColor"/>',
  min: '<path d="M5.5 12h13"/>',
  max: '<rect x="6" y="6" width="12" height="12" rx="1"/>',
  x: '<path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/>',
  send: '<path d="M20.5 3.5L3.5 10.3l7.2 2.6 2.6 7.2z"/><path d="M20.5 3.5L10.7 12.9"/>',
  list: '<path d="M8.5 6.5h11M8.5 12h11M8.5 17.5h11"/><path d="M4 6.5h.01M4 12h.01M4 17.5h.01" stroke-width="2.5"/>',
  edit: '<path d="M12.8 5.7l5.5 5.5M4 20l1.3-4.3L16.9 4.1a2 2 0 0 1 2.9 0l.1.1a2 2 0 0 1 0 2.9L8.3 18.7 4 20z"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  drop: '<path d="M12 3.5s6.5 6.6 6.5 11a6.5 6.5 0 0 1-13 0c0-4.4 6.5-11 6.5-11z"/>',
  dumbbell: '<path d="M9.5 8.5l-3 10M14.5 8.5l3 10M4 8.5h16M6 8.5l1-3.2M18 8.5l-1-3.2M4 8.5v1.8M20 8.5v1.8"/>',
  book: '<path d="M12 6.5c-1.8-1.6-4.4-2-8-2v13c3.6 0 6.2.4 8 2 1.8-1.6 4.4-2 8-2v-13c-3.6 0-6.2.4-8 2z"/><path d="M12 6.5v13"/>',
  moon: '<path d="M20 14.5A8.5 8.5 0 0 1 9.5 4 8.5 8.5 0 1 0 20 14.5z"/>',
  heart: '<path d="M12 20s-7.5-4.8-7.5-10A4.3 4.3 0 0 1 12 7a4.3 4.3 0 0 1 7.5 3c0 5.2-7.5 10-7.5 10z"/>',
  play: '<path d="M8 5.5v13l10-6.5z"/>',
  tag: '<path d="M4 4.5h7l9 9-7 7-9-9v-7z"/><circle cx="8" cy="9" r="1.5"/>',
  bot: '<rect x="4.5" y="7.5" width="15" height="12" rx="2"/><circle cx="9.5" cy="12.5" r="1.5" fill="currentColor" stroke="none"/><circle cx="14.5" cy="12.5" r="1.5" fill="currentColor" stroke="none"/><path d="M12 7.5V4.5M8 4.5h8"/>',
  repeat: '<path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3"/><path d="M19.5 3.5v4h-4"/>',
  img: '<rect x="3.5" y="4.5" width="17" height="15" rx="2"/><circle cx="9" cy="9.5" r="1.8"/><path d="M4.5 17l4.8-4.8 3.4 3.4 3.5-3.5 3.3 3.3"/>',
  down: '<path d="M12 4.5v11M7 11l5 5 5-5M5 20h14"/>',
  up: '<path d="M12 19.5v-11M7 13l5-5 5 5M5 4h14"/>',
  lock: '<rect x="5.5" y="10.5" width="13" height="9.5" rx="2"/><path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5"/><path d="M12 14.5v2"/>',
  key: '<circle cx="8" cy="14" r="4"/><path d="M11 11l8-8M17 7l2.5 2.5M14.5 9.5L17 12"/>',
  pin: '<path d="M12 21.5v-6"/><circle cx="12" cy="9.5" r="5"/><circle cx="12" cy="9.5" r="1.6" fill="currentColor" stroke="none"/>',
  dock: '<rect x="14" y="4.5" width="6.5" height="15" rx="1.5"/><path d="M4 7h7M4 12h7M4 17h7"/>',
}

const props = defineProps({
  name: { type: String, required: true },
  size: { type: Number, default: 16 },
  sw: { type: Number, default: 0 }
})

const body = computed(() => ICONS[props.name] || '')
</script>
