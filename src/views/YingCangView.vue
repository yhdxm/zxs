<template>
  <div class="yc-root">
    <header class="yc-top">
      <div class="yc-brand">
        <span class="yc-logo">影仓智核</span>
        <span class="yc-tag">免费实时行情工作台</span>
      </div>
      <div class="yc-tabs">
        <span
          v-for="t in tabs"
          :key="t.key"
          :class="['yc-tab', active === t.key ? 'on' : '']"
          @click="active = t.key"
          >{{ t.label }}</span
        >
      </div>
      <div class="yc-clock-box" :title="'北京时间'">
        <span class="yc-dot"></span>
        <span class="yc-clock">{{ nowText }}</span>
        <span class="yc-clock-hint">北京时间</span>
      </div>
    </header>

    <main class="yc-main">
      <YcQuotes v-if="active === 'quotes'" />
      <YcWatchlist v-if="active === 'watch'" />
      <YcAi v-if="active === 'ai'" />
      <YcLearn v-if="active === 'learn'" @open-sim="active = 'sim'" />
      <YcHotEvents v-if="active === 'hot'" />
      <YcSimTrade v-if="active === 'sim'" />
    </main>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import YcQuotes from '../components/finance/YcQuotes.vue'
import YcWatchlist from '../components/finance/YcWatchlist.vue'
import YcAi from '../components/finance/YcAi.vue'
import YcLearn from '../components/finance/YcLearn.vue'
import YcHotEvents from '../components/finance/YcHotEvents.vue'
import YcSimTrade from '../components/finance/YcSimTrade.vue'

const tabs = [
  { key: 'quotes', label: '行情' },
  { key: 'watch', label: '自选股' },
  { key: 'ai', label: 'AI 分析' },
  { key: 'learn', label: '学习中心' },
  { key: 'hot', label: '热点事件' },
  { key: 'sim', label: '模拟炒股' }
]
const active = ref('quotes')
const nowText = ref('')
let clockTimer: number | undefined

function pad(n: number): string {
  return String(n).padStart(2, '0')
}
function updateClock(): void {
  const d = new Date()
  nowText.value = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(
    d.getMinutes()
  )}:${pad(d.getSeconds())}`
}

onMounted(() => {
  updateClock()
  clockTimer = window.setInterval(updateClock, 1000)
})
onUnmounted(() => {
  if (clockTimer) window.clearInterval(clockTimer)
})
</script>

<style scoped>
.yc-root {
  min-height: 100%;
}
.yc-top {
  position: sticky;
  top: 0;
  z-index: 10;
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 0 24px 10px;
  background: var(--surface);
  border-bottom: 1px solid var(--border);
  flex-wrap: wrap;
}
.yc-brand {
  display: flex;
  align-items: baseline;
  gap: 8px;
}
.yc-logo {
  font-size: 18px;
  font-weight: 600;
  color: var(--text-strong);
}
.yc-tag {
  font-size: 11px;
  color: var(--text-faint);
}
.yc-tabs {
  display: flex;
  gap: 4px;
  flex: 1;
  flex-wrap: wrap;
}
.yc-tab {
  font-size: 13px;
  padding: 6px 14px;
  border-radius: 8px;
  color: var(--text-muted);
  cursor: pointer;
  border: 1px solid transparent;
}
.yc-tab:hover {
  background: var(--surface-soft);
}
.yc-tab.on {
  color: var(--brand, #378add);
  background: var(--surface-soft);
  border-color: var(--brand, #378add);
  font-weight: 600;
}
.yc-clock-box {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: var(--text-muted);
  background: var(--surface-soft);
  border: 1px solid var(--border);
  padding: 6px 10px;
  border-radius: 10px;
  font-variant-numeric: tabular-nums;
}
.yc-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #16a34a;
}
.yc-clock-hint {
  font-size: 11px;
  color: var(--text-faint);
}
@media (max-width: 768px) {
  .yc-top {
    padding: 0 14px 6px;
  }
  .yc-clock-hint {
    display: none;
  }
}
</style>
