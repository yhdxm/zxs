<template>
  <div class="yc-root">
    <!-- 顶部：与新闻聚合一致的 PageHeader（左侧模块名+免责声明，右侧时钟+自动刷新+刷新按钮） -->
    <PageHeader title="影仓智核" :subtitle="disclaimer" :icon="Money">
      <template #actions>
        <span class="yc-live"><i class="yc-live-dot"></i>实时</span>
        <span class="yc-clock-box" :title="'北京时间 · 数据更新于 ' + lastUpdate">
          <span class="yc-dot"></span>
          <span class="yc-clock">{{ nowText }}</span>
          <span class="yc-clock-hint">北京时间</span>
        </span>
        <el-switch v-model="autoRefresh" active-text="自动刷新" />
        <el-button type="primary" :loading="refreshing" @click="onRefresh">
          <el-icon><Refresh /></el-icon> 刷新
        </el-button>
      </template>
    </PageHeader>

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
      <YcQuotes
        v-if="active === 'quotes'"
        :auto-refresh="autoRefresh"
        :refresh-nonce="refreshNonce"
        :last-update="lastUpdate"
        @updated="lastUpdate = $event"
      />
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
import { Money, Refresh } from '@element-plus/icons-vue'
import PageHeader from '../components/PageHeader.vue'
import YcQuotes from '../components/finance/YcQuotes.vue'
import YcWatchlist from '../components/finance/YcWatchlist.vue'
import YcAi from '../components/finance/YcAi.vue'
import YcLearn from '../components/finance/YcLearn.vue'
import YcHotEvents from '../components/finance/YcHotEvents.vue'
import YcSimTrade from '../components/finance/YcSimTrade.vue'

/** 顶部模块名下方左侧的免责声明（免费接口 + 投资建议提示） */
const disclaimer =
  '腾讯财经公开行情（免费接口直连，无需 Key）。盘中为延迟行情，非交易所官方实时推送；休市期间显示最近收盘数据。数据仅供参考，不构成任何投资建议。'

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
const lastUpdate = ref('')
const autoRefresh = ref(true)
const refreshNonce = ref(0)
const refreshing = ref(false)
let clockTimer: number | undefined

/** 顶部刷新按钮：递增 nonce 触发子组件刷新，并记录更新时间 */
function onRefresh(): void {
  refreshing.value = true
  refreshNonce.value++
  lastUpdate.value = nowText.value
  window.setTimeout(() => (refreshing.value = false), 1200)
}

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
  padding: 0 20px;
  box-sizing: border-box;
}

/* 功能 Tab 条（位于顶部 PageHeader 下方） */
.yc-tabbar {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 0 0;
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
.yc-live {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 12px;
  font-weight: 700;
  color: #16a34a;
  background: #dcfce7;
  border: 1px solid #bbf7d0;
  padding: 5px 10px;
  border-radius: 999px;
  white-space: nowrap;
}
.yc-live-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #22c55e;
  box-shadow: 0 0 0 3px rgba(34, 197, 94, 0.2);
  animation: ycPulse 1.4s infinite;
}
@keyframes ycPulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.35; }
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
  .yc-clock-hint {
    display: none;
  }
  .yc-root { padding: 0 14px; }
  .yc-tabbar { padding: 10px 0 0; }
  .yc-tab-hint { width: 100%; flex: none; }
}
</style>
