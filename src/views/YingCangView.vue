<template>
  <div class="yc-root">
    <!-- 顶部：品牌 + 新闻聚合入口 + 北京时间 -->
    <header class="yc-top">
      <div class="yc-brand">
        <span class="yc-logo">影仓智核</span>
        <span class="yc-tag">免费实时行情工作台</span>
      </div>

      <nav class="yc-entries">
        <router-link
          v-for="e in entries"
          :key="e.to"
          :to="e.to"
          class="yc-entry"
          :class="e.accent"
        >
          <span class="yc-entry-ico">{{ e.icon }}</span>
          <span class="yc-entry-txt">
            <b>{{ e.label }}</b>
            <i>{{ e.desc }}</i>
          </span>
        </router-link>
      </nav>

      <div class="yc-clock-box" :title="'北京时间'">
        <span class="yc-dot"></span>
        <span class="yc-clock">{{ nowText }}</span>
        <span class="yc-clock-hint">北京时间</span>
      </div>
    </header>

    <!-- 功能 Tab：移到顶部入口下方，横向可滚动，移动端不换行错乱 -->
    <div class="yc-tabbar">
      <div class="yc-tabs">
        <button
          v-for="t in tabs"
          :key="t.key"
          type="button"
          :class="['yc-tab', active === t.key ? 'on' : '']"
          @click="active = t.key"
        >
          <span class="yc-tab-ico">{{ t.icon }}</span>{{ t.label }}
        </button>
      </div>
      <span class="yc-tab-hint">{{ currentTab.hint }}</span>
    </div>

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
import { computed, onMounted, onUnmounted, ref } from 'vue'
import YcQuotes from '../components/finance/YcQuotes.vue'
import YcWatchlist from '../components/finance/YcWatchlist.vue'
import YcAi from '../components/finance/YcAi.vue'
import YcLearn from '../components/finance/YcLearn.vue'
import YcHotEvents from '../components/finance/YcHotEvents.vue'
import YcSimTrade from '../components/finance/YcSimTrade.vue'

/** 顶部快捷入口（与新闻聚合页保持一致的跳转能力） */
const entries = [
  { to: '/news', icon: '📰', label: '新闻聚合', desc: '全域实时头条', accent: 'e-news' },
  { to: '/automation', icon: '⚡', label: '沸爻机', desc: '自动化情报', accent: 'e-fx' },
  { to: '/xingyu', icon: '🚗', label: '星舆识途', desc: '汽车行业情报', accent: 'e-car' }
]

const tabs = [
  { key: 'quotes', label: '行情', icon: '📊', hint: 'A股指数 · 贵金属能源 · 全球股指 · 热门个股，3 秒自动刷新' },
  { key: 'watch', label: '自选股', icon: '⭐', hint: '自定义关注标的，实时跟踪涨跌' },
  { key: 'ai', label: 'AI 分析', icon: '🤖', hint: '结合实时行情做趋势解读（免费模型）' },
  { key: 'learn', label: '学习中心', icon: '📚', hint: '投资基础知识与实操要点' },
  { key: 'hot', label: '热点事件', icon: '🔥', hint: '财经热点与市场情绪追踪' },
  { key: 'sim', label: '模拟炒股', icon: '💰', hint: '零风险练手，账本存本地' }
]
const active = ref('quotes')
const currentTab = computed(() => tabs.find((t) => t.key === active.value) ?? tabs[0]!)
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
  padding: 0 18px 10px;
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
/* 顶部快捷入口 */
.yc-entries {
  display: flex;
  gap: 10px;
  flex: 1;
  flex-wrap: wrap;
  min-width: 0;
}
.yc-entry {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  border-radius: 10px;
  border: 1px solid var(--border);
  background: var(--surface-soft);
  text-decoration: none;
  color: var(--text);
  transition: transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease;
}
.yc-entry:hover {
  transform: translateY(-1px);
  box-shadow: var(--shadow-card);
}
.yc-entry-ico { font-size: 16px; line-height: 1; }
.yc-entry-txt { display: flex; flex-direction: column; line-height: 1.25; }
.yc-entry-txt b { font-size: 13px; font-weight: 600; color: var(--text-strong); }
.yc-entry-txt i { font-style: normal; font-size: 11px; color: var(--text-faint); }
.yc-entry.e-news:hover { border-color: #2f6bff; }
.yc-entry.e-news .yc-entry-txt b { color: #2f6bff; }
.yc-entry.e-fx:hover { border-color: #f59e0b; }
.yc-entry.e-fx .yc-entry-txt b { color: #d97706; }
.yc-entry.e-car:hover { border-color: #16a34a; }
.yc-entry.e-car .yc-entry-txt b { color: #16a34a; }

/* 功能 Tab 条（位于顶部入口下方） */
.yc-tabbar {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 18px 0;
  flex-wrap: wrap;
}
.yc-tabs {
  display: flex;
  gap: 6px;
  flex-wrap: nowrap;
  overflow-x: auto;
  scrollbar-width: none;
  padding-bottom: 2px;
  max-width: 100%;
}
.yc-tabs::-webkit-scrollbar { display: none; }
.yc-tab {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 13px;
  padding: 7px 14px;
  border-radius: 999px;
  color: var(--text-muted);
  cursor: pointer;
  border: 1px solid var(--border);
  background: var(--surface);
  white-space: nowrap;
  flex-shrink: 0;
  transition: all 0.15s ease;
}
.yc-tab-ico { font-size: 13px; }
.yc-tab:hover {
  background: var(--surface-soft);
  border-color: var(--brand, #378add);
}
.yc-tab.on {
  color: #fff;
  background: var(--brand, #378add);
  border-color: var(--brand, #378add);
  font-weight: 600;
}
.yc-tab-hint {
  font-size: 12px;
  color: var(--text-faint);
  flex: 1;
  min-width: 0;
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
    padding: 0 14px 8px;
    gap: 10px;
  }
  .yc-clock-hint {
    display: none;
  }
  .yc-entries {
    order: 3;
    width: 100%;
    flex-wrap: nowrap;
    overflow-x: auto;
    scrollbar-width: none;
  }
  .yc-entries::-webkit-scrollbar { display: none; }
  .yc-entry { flex-shrink: 0; }
  .yc-tabbar { padding: 10px 14px 0; }
  .yc-tab-hint { width: 100%; flex: none; }
}
</style>
