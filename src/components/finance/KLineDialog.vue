<template>
  <el-dialog
    :model-value="visible"
    @update:model-value="emit('update:visible', $event)"
    :title="null"
    width="900px"
    top="5vh"
    class="kl-dialog"
  >
    <div v-if="quote" class="kl-wrap">
      <div class="kl-head">
        <div class="kl-name">
          <span class="kl-t">{{ quote.name }}</span>
          <span class="kl-c">{{ quote.code.toUpperCase() }}</span>
          <span class="kl-p" :class="trendClass(quote)">{{ formatNum(quote.price, dg) }}</span>
          <span class="kl-ch" :class="trendClass(quote)">
            {{ quote.change >= 0 ? '+' : '' }}{{ formatNum(quote.change, dg) }}
            {{ quote.changePercent >= 0 ? '+' : '' }}{{ formatNum(quote.changePercent, 2) }}%
          </span>
        </div>
        <div class="kl-seg">
          <span
            v-for="p in periods"
            :key="p.value"
            :class="['kl-seg-item', p.value === period ? 'on' : '']"
            @click="switchPeriod(p.value)"
            >{{ p.label }}</span
          >
        </div>
      </div>

      <div class="kl-kpi">
        <span>开 <b>{{ formatNum(quote.open, dg) }}</b></span>
        <span>高 <b>{{ formatNum(quote.high, dg) }}</b></span>
        <span>低 <b>{{ formatNum(quote.low, dg) }}</b></span>
        <span>昨收 <b>{{ formatNum(quote.prevClose, dg) }}</b></span>
        <span class="kl-fresh" :class="'f-' + fresh.level">● {{ fresh.text }}</span>
        <span class="kl-time">{{ quote.time || '—' }}</span>
      </div>

      <!-- 外盘商品（hf_）免费接口不提供 K 线，明确提示而非展示空白图表 -->
      <div v-if="!klineSupported" class="kl-nokline">
        该标的为外盘商品，腾讯免费接口暂不提供 K 线 / 分时数据，上方为实时报价。
      </div>

      <div class="kl-row">
        <div class="kl-chart">
          <KLineChart
            :points="points"
            :period="period"
            :prev-close="prevClose"
            :loading="loading"
            :height="isMobile ? '320px' : '400px'"
            :empty-text="emptyText"
          />
        </div>

        <div class="kl-deal">
          <div class="kl-deal-title">五档盘口</div>
          <template v-if="quote.asks.length > 1">
            <div v-for="(a, i) in quote.asks.slice().reverse()" :key="'a' + i" class="kl-deal-row">
              <span>卖{{ 5 - i }}</span>
              <span class="kl-down">{{ formatNum(a.price, dg) }}</span>
              <span class="kl-vol">{{ formatVol(a.vol) }}</span>
            </div>
            <div class="kl-deal-split"></div>
            <div v-for="(b, i) in quote.bids" :key="'b' + i" class="kl-deal-row">
              <span>买{{ i + 1 }}</span>
              <span class="kl-up">{{ formatNum(b.price, dg) }}</span>
              <span class="kl-vol">{{ formatVol(b.vol) }}</span>
            </div>
          </template>
          <template v-else>
            <div class="kl-deal-row">
              <span>买价</span>
              <span class="kl-up">{{ formatNum(quote.bids[0]?.price || 0, dg) }}</span>
              <span class="kl-vol">{{ formatVol(quote.bids[0]?.vol || 0) }}</span>
            </div>
            <div class="kl-deal-row">
              <span>卖价</span>
              <span class="kl-down">{{ formatNum(quote.asks[0]?.price || 0, dg) }}</span>
              <span class="kl-vol">{{ formatVol(quote.asks[0]?.vol || 0) }}</span>
            </div>
            <p class="kl-deal-tip">外盘商品仅提供买卖一档</p>
          </template>
        </div>
      </div>
    </div>
  </el-dialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import {
  fetchKlineWithMeta,
  freshnessOf,
  supportsKline,
  type KLinePeriod,
  type KLinePoint,
  type Quote
} from '../../services/tencentFinance'
import KLineChart from './KLineChart.vue'

const props = defineProps<{
  visible: boolean
  code: string
  quote?: Quote | null
}>()
const emit = defineEmits<{ (e: 'update:visible', v: boolean): void }>()

const periods: { label: string; value: KLinePeriod }[] = [
  { label: '分时', value: 'minute' },
  { label: '日K', value: 'day' },
  { label: '周K', value: 'week' },
  { label: '月K', value: 'month' },
  { label: '季K', value: 'quarter' }
]
const period = ref<KLinePeriod>('day')
const points = ref<KLinePoint[]>([])
const prevClose = ref(0)
const loading = ref(false)
const loadFailed = ref(false)

const quote = computed(() => props.quote ?? null)
const klineSupported = computed(() => supportsKline(props.code))
const isMobile = computed(() => typeof window !== 'undefined' && window.innerWidth <= 768)
/** 低价品种（如天然气 2.88）保留 3 位小数，避免显示不准 */
const dg = computed(() => ((quote.value?.price ?? 0) > 0 && quote.value!.price < 10 ? 3 : 2))

// 数据鲜度：解决「看不到时效性」的问题，用色点区分 60s / 5min 内外的可信度
const fresh = computed(() => freshnessOf(quote.value?.time || ''))

const emptyText = computed(() =>
  loadFailed.value
    ? 'K 线加载失败（免费接口可能限速），请稍后重试'
    : '暂无 K 线数据，请切换周期或稍后重试'
)

function trendClass(q: Quote): string {
  if (q.change > 0) return 'kl-up'
  if (q.change < 0) return 'kl-down'
  return ''
}
function formatNum(v: number, d = 2): string {
  return (v || 0).toFixed(d)
}
function formatVol(v: number): string {
  if (v >= 1e8) return (v / 1e8).toFixed(2) + '亿'
  if (v >= 1e4) return (v / 1e4).toFixed(2) + '万'
  return String(Math.round(v))
}

async function load(): Promise<void> {
  if (!klineSupported.value) {
    points.value = []
    return
  }
  loading.value = true
  loadFailed.value = false
  const res = await fetchKlineWithMeta(props.code, period.value, 160)
  points.value = res.points
  prevClose.value = res.prevClose
  loadFailed.value = !res.points.length
  loading.value = false
}
function switchPeriod(p: KLinePeriod): void {
  if (p === period.value) return
  period.value = p
  void load()
}

watch(
  () => props.visible,
  (v) => {
    if (v) void load()
  }
)
watch(
  () => props.code,
  () => {
    if (props.visible) void load()
  }
)
</script>

<style scoped>
.kl-wrap {
  color: var(--text);
}
.kl-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}
.kl-name {
  display: flex;
  align-items: baseline;
  gap: 8px;
  flex-wrap: wrap;
}
.kl-t {
  font-size: 17px;
  font-weight: 700;
  color: var(--text-strong);
}
.kl-c {
  font-size: 12px;
  color: var(--text-faint);
}
.kl-p {
  font-size: 22px;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
}
.kl-ch {
  font-size: 13px;
  font-variant-numeric: tabular-nums;
}
.kl-up {
  color: #ef4444;
}
.kl-down {
  color: #16a34a;
}
.kl-seg {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
}
.kl-seg-item {
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 4px 11px;
  font-size: 12px;
  color: var(--text-muted);
  cursor: pointer;
  transition: all 0.15s ease;
}
.kl-seg-item.on {
  border-color: var(--primary, #6366f1);
  color: var(--primary, #6366f1);
  background: var(--nav-hover);
  font-weight: 600;
}
.kl-kpi {
  display: flex;
  gap: 14px;
  font-size: 13px;
  color: var(--text-muted);
  margin: 10px 0;
  flex-wrap: wrap;
  align-items: center;
  font-variant-numeric: tabular-nums;
}
.kl-kpi b {
  color: var(--text-strong);
  font-weight: 600;
}
.kl-time {
  color: var(--text-faint);
  font-size: 12px;
}
/* 数据鲜度色点：绿=60s 内，黄=5min 内，灰=更久 */
.kl-fresh {
  font-size: 12px;
  font-weight: 600;
}
.kl-fresh.f-fresh {
  color: #16a34a;
}
.kl-fresh.f-normal {
  color: #d97706;
}
.kl-fresh.f-stale {
  color: var(--text-faint);
}
.kl-nokline {
  font-size: 12px;
  color: #d97706;
  background: #fffbeb;
  border: 1px solid #fde68a;
  border-radius: 8px;
  padding: 8px 12px;
  margin-bottom: 10px;
}
.kl-row {
  display: flex;
  gap: 14px;
}
.kl-chart {
  flex: 1;
  min-width: 0;
}
.kl-deal {
  width: 200px;
  flex-shrink: 0;
  border-left: 1px solid var(--border);
  padding-left: 14px;
}
.kl-deal-title {
  font-size: 12px;
  color: var(--text-faint);
  margin-bottom: 6px;
}
.kl-deal-row {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  padding: 4px 0;
  font-variant-numeric: tabular-nums;
}
.kl-deal-row .kl-vol {
  color: var(--text-faint);
}
.kl-deal-tip {
  font-size: 11px;
  color: var(--text-faint);
  margin-top: 6px;
}
.kl-deal-split {
  height: 1px;
  background: var(--border);
  margin: 6px 0;
}
@media (max-width: 768px) {
  .kl-row {
    flex-direction: column;
  }
  .kl-deal {
    width: 100%;
    border-left: none;
    border-top: 1px solid var(--border);
    padding-left: 0;
    padding-top: 10px;
  }
  .kl-seg {
    width: 100%;
  }
  .kl-seg-item {
    flex: 1;
    text-align: center;
    padding: 6px 4px;
  }
}
</style>

<!--
  移动端弹窗覆写必须放全局块：Element Plus 会把自定义 class 合并到 .el-dialog 元素自身，
  用 scoped 的 `.kl-dialog :deep(.el-dialog)` 永远匹配不到（它在找自己的后代）。
-->
<style>
@media (max-width: 768px) {
  .kl-dialog.el-dialog {
    width: 100% !important;
    max-width: 100vw;
    margin: 0 !important;
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    top: auto !important;
    max-height: 92vh;
    border-radius: 16px 16px 0 0;
    display: flex;
    flex-direction: column;
  }
  .kl-dialog.el-dialog .el-dialog__body {
    overflow-y: auto;
    padding: 12px 14px calc(16px + env(safe-area-inset-bottom, 0px));
  }
}
</style>
