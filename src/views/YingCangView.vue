<template>
  <div class="yc-page">
    <header class="yc-head">
      <div class="yc-title">
        <h2>影仓智核</h2>
        <p>
          腾讯财经·实时行情（免费接口直连，无需 Key，含 A 股核心指数与热门个股）。
          数据仅供参考，不构成任何投资建议。
        </p>
      </div>
      <div class="yc-controls">
        <span class="yc-clock" :title="`本地时间 · 数据更新于 ${lastUpdate}`">
          <el-icon><Clock /></el-icon>
          <span>{{ nowText }}</span>
        </span>
        <el-switch v-model="autoRefresh" active-text="自动刷新" />
        <el-button type="primary" :loading="loading" @click="refresh">
          <el-icon><Refresh /></el-icon> 刷新
        </el-button>
      </div>
    </header>

    <!-- 核心指数 -->
    <section class="yc-section">
      <div class="yc-section-title">
        核心指数
        <span class="yc-hint">红涨绿跌 · 每 15 秒自动刷新 · v20260731</span>
      </div>
      <div v-if="indices.length" class="yc-grid">
        <div
          v-for="q in indices"
          :key="q.code"
          class="yc-card"
          :class="trendClass(q)"
        >
          <div class="yc-card-head">
            <span class="yc-card-name">{{ q.name }}</span>
            <span class="yc-card-code">{{ q.code.toUpperCase() }}</span>
          </div>
          <div class="yc-card-price">{{ formatNum(q.price, 2) }}</div>
          <div class="yc-card-sub">
            <span>{{ q.change >= 0 ? '+' : '' }}{{ formatNum(q.change, 2) }}</span>
            <span>{{ q.changePercent >= 0 ? '+' : '' }}{{ formatNum(q.changePercent, 2) }}%</span>
          </div>
          <div class="yc-card-foot">
            <span>高 {{ formatNum(q.high, 2) }}</span>
            <span>低 {{ formatNum(q.low, 2) }}</span>
          </div>
          <div class="yc-card-time">{{ q.time || '—' }}</div>
        </div>
      </div>
      <el-empty v-else-if="!loading" description="暂无可展示的指数行情，请点击刷新重试" />
    </section>

    <!-- 热门个股 -->
    <section class="yc-section">
      <div class="yc-section-title">
        热门个股
        <span class="yc-hint">演示标的 · 可在 services/tencentFinance.ts 自行替换</span>
      </div>
      <el-table
        :data="stocks"
        v-loading="loading"
        class="yc-table"
        :header-cell-style="{ background: 'var(--surface-soft)', color: 'var(--text-muted)' }"
      >
        <el-table-column prop="name" label="名称" min-width="120" />
        <el-table-column prop="code" label="代码" min-width="100" />
        <el-table-column label="现价" align="right" min-width="100">
          <template #default="{ row }">
            <span :class="trendClass(row)">{{ formatNum(row.price, 2) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="涨跌" align="right" min-width="100">
          <template #default="{ row }">
            <span :class="trendClass(row)">{{ row.change >= 0 ? '+' : '' }}{{ formatNum(row.change, 2) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="涨跌幅" align="right" min-width="110">
          <template #default="{ row }">
            <span :class="trendClass(row)">{{ row.changePercent >= 0 ? '+' : '' }}{{ formatNum(row.changePercent, 2) }}%</span>
          </template>
        </el-table-column>
        <el-table-column label="最高 / 最低" align="right" min-width="150">
          <template #default="{ row }">
            <span :class="trendClass(row)">{{ formatNum(row.high, 2) }}</span>
            <span class="yc-sep"> / </span>
            <span :class="trendClass(row)">{{ formatNum(row.low, 2) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="更新时间" align="right" min-width="160">
          <template #default="{ row }">{{ row.time || '—' }}</template>
        </el-table-column>
      </el-table>
    </section>

    <p class="yc-foot">
      数据来源：腾讯财经公开行情接口
      <code>qt.gtimg.cn</code>（免费、实时，盘中有延迟属正常现象）。
      接口直连、不消耗任何积分与额度；加载失败多为当前网络对腾讯域名限速，稍后重试即可。
    </p>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue'
import { Clock, Refresh } from '@element-plus/icons-vue'
import { fetchIndices, fetchHotStocks, type Quote } from '../services/tencentFinance'

const indices = ref<Quote[]>([])
const stocks = ref<Quote[]>([])
const loading = ref(false)
const autoRefresh = ref(true)
const nowText = ref('')
const lastUpdate = ref('')
let refreshTimer: number | undefined
let clockTimer: number | undefined

const REFRESH_MS = 15000

function pad(n: number): string {
  return String(n).padStart(2, '0')
}
function updateClock(): void {
  const d = new Date()
  nowText.value = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(
    d.getMinutes()
  )}:${pad(d.getSeconds())}`
}
function formatNum(v: number, digits = 2): string {
  return v.toFixed(digits)
}
/** 红涨绿跌（A股惯例） */
function trendClass(q: Quote): string {
  if (q.change > 0) return 'up'
  if (q.change < 0) return 'down'
  return 'flat'
}

async function refresh(): Promise<void> {
  loading.value = true
  try {
    const [idx, stk] = await Promise.all([fetchIndices(), fetchHotStocks()])
    indices.value = idx
    stocks.value = stk
    lastUpdate.value = nowText.value
  } catch (e) {
    console.error('[影仓智核] 行情加载失败', e)
  } finally {
    loading.value = false
  }
}

function startAuto(): void {
  stopAuto()
  refreshTimer = window.setInterval(() => {
    void refresh()
  }, REFRESH_MS)
}
function stopAuto(): void {
  if (refreshTimer) {
    window.clearInterval(refreshTimer)
    refreshTimer = undefined
  }
}

watch(autoRefresh, (v) => {
  if (v) startAuto()
  else stopAuto()
})

onMounted(() => {
  updateClock()
  clockTimer = window.setInterval(updateClock, 1000)
  void refresh()
  if (autoRefresh.value) startAuto()
})
onUnmounted(() => {
  stopAuto()
  if (clockTimer) window.clearInterval(clockTimer)
})
</script>

<style scoped>
.yc-page {
  padding: 24px;
  max-width: 1180px;
  margin: 0 auto;
  color: var(--text);
}
.yc-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 20px;
  flex-wrap: wrap;
}
.yc-title h2 {
  margin: 0 0 6px;
  font-size: 22px;
  color: var(--text-strong);
}
.yc-title p {
  margin: 0;
  font-size: 13px;
  color: var(--text-muted);
  line-height: 1.6;
  max-width: 720px;
}
.yc-controls {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-shrink: 0;
}
.yc-clock {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-variant-numeric: tabular-nums;
  color: var(--text-muted);
  background: var(--surface-soft);
  border: 1px solid var(--border);
  padding: 6px 10px;
  border-radius: 10px;
}

.yc-section {
  margin-bottom: 26px;
}
.yc-section-title {
  display: flex;
  align-items: baseline;
  gap: 10px;
  font-size: 16px;
  font-weight: 700;
  color: var(--text-strong);
  margin-bottom: 12px;
}
.yc-hint {
  font-size: 12px;
  font-weight: 400;
  color: var(--text-faint);
}

.yc-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 14px;
}
.yc-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-top: 3px solid var(--border-strong);
  border-radius: 14px;
  padding: 16px 18px;
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}
.yc-card:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-card);
}
.yc-card.up {
  border-top-color: #ef4444;
}
.yc-card.down {
  border-top-color: #16a34a;
}
.yc-card.flat {
  border-top-color: var(--text-faint);
}
.yc-card-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
}
.yc-card-name {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-strong);
}
.yc-card-code {
  font-size: 11px;
  color: var(--text-faint);
  font-variant-numeric: tabular-nums;
}
.yc-card-price {
  font-size: 26px;
  font-weight: 800;
  margin: 8px 0 4px;
  font-variant-numeric: tabular-nums;
}
.yc-card-sub {
  display: flex;
  gap: 12px;
  font-size: 14px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}
.yc-card-foot {
  display: flex;
  justify-content: space-between;
  margin-top: 10px;
  font-size: 12px;
  color: var(--text-muted);
  font-variant-numeric: tabular-nums;
}
.yc-card-time {
  margin-top: 6px;
  font-size: 11px;
  color: var(--text-faint);
  font-variant-numeric: tabular-nums;
}

.yc-card.up .yc-card-price,
.yc-card.up .yc-card-sub {
  color: #ef4444;
}
.yc-card.down .yc-card-price,
.yc-card.down .yc-card-sub {
  color: #16a34a;
}
.yc-card.flat .yc-card-price,
.yc-card.flat .yc-card-sub {
  color: var(--text);
}

.yc-table {
  border-radius: 12px;
  overflow: hidden;
  background: var(--surface);
}
.yc-sep {
  color: var(--text-faint);
}
.yc-table :deep(.up) {
  color: #ef4444;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}
.yc-table :deep(.down) {
  color: #16a34a;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}
.yc-table :deep(.flat) {
  color: var(--text);
  font-variant-numeric: tabular-nums;
}

.yc-foot {
  font-size: 12px;
  color: var(--text-faint);
  line-height: 1.7;
  margin-top: 8px;
}
.yc-foot code {
  background: var(--surface-soft);
  padding: 1px 6px;
  border-radius: 6px;
  color: var(--text-muted);
}

@media (max-width: 768px) {
  .yc-page {
    padding: 16px;
  }
  .yc-controls {
    width: 100%;
    justify-content: space-between;
  }
}
</style>
