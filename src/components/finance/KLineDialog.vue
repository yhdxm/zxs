<template>
  <el-dialog
    :model-value="visible"
    @update:model-value="$emit('update:visible', $event)"
    :title="null"
    width="860px"
    top="6vh"
    class="kl-dialog"
  >
    <div v-if="quote" class="kl-wrap">
      <div class="kl-head">
        <div class="kl-name">
          <span class="kl-t">{{ quote.name }}</span>
          <span class="kl-c">{{ quote.code.toUpperCase() }}</span>
          <span class="kl-p" :class="trendClass(quote)">{{ formatNum(quote.price, 2) }}</span>
          <span class="kl-ch" :class="trendClass(quote)">
            {{ quote.change >= 0 ? '+' : '' }}{{ formatNum(quote.change, 2) }}
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
        <span>开 <b>{{ formatNum(quote.open, 2) }}</b></span>
        <span>高 <b>{{ formatNum(quote.high, 2) }}</b></span>
        <span>低 <b>{{ formatNum(quote.low, 2) }}</b></span>
        <span>昨收 <b>{{ formatNum(quote.prevClose, 2) }}</b></span>
        <span class="kl-time">{{ quote.time || '—' }} 北京时间</span>
      </div>

      <div class="kl-row">
        <div class="kl-chart">
          <div v-if="loading" class="kl-loading">加载 K 线中…</div>
          <div v-else-if="!points.length" class="kl-empty">
            暂无可展示的 K 线数据（免费接口可能受网络限制），请稍后重试。
          </div>
          <template v-else>
            <svg :viewBox="`0 0 620 270`" class="kl-svg" preserveAspectRatio="none">
              <line v-for="(g, i) in gridLines" :key="'g' + i" :x1="g.x" :y1="g.y1" :x2="g.x" :y2="g.y2" stroke="#eee" stroke-width="0.5" />
              <line v-for="(g, i) in hLines" :key="'h' + i" x1="0" :y1="g.y" x2="620" y2="g.y" stroke="#f3f3f3" stroke-width="0.5" />
              <text v-for="(g, i) in hLines" :key="'ht' + i" x="2" :y="g.y - 2" font-size="9" fill="#999">{{ g.label }}</text>

              <polyline
                v-for="ma in maLines"
                :key="ma.key"
                :points="ma.points"
                fill="none"
                :stroke="ma.color"
                stroke-width="1"
              />

              <g v-if="!isLine">
                <line
                  v-for="(c, i) in candles"
                  :key="'c' + i"
                  :x1="c.x"
                  :x2="c.x"
                  :y1="c.highY"
                  :y2="c.lowY"
                  :stroke="c.color"
                  stroke-width="1"
                />
                <rect
                  v-for="(c, i) in candles"
                  :key="'b' + i"
                  :x="c.x - c.w / 2"
                  :y="Math.min(c.openY, c.closeY)"
                  :width="c.w"
                  :height="Math.max(1, Math.abs(c.closeY - c.openY))"
                  :fill="c.color"
                />
              </g>
              <polyline v-else :points="linePoints" fill="none" stroke="#378ADD" stroke-width="1.4" />

              <text
                v-for="(c, i) in xLabels"
                :key="'x' + i"
                :x="c.x"
                y="266"
                font-size="9"
                fill="#999"
                text-anchor="middle"
              >{{ c.label }}</text>
            </svg>

            <div class="kl-vol-head">成交量 VOL</div>
            <svg :viewBox="`0 0 620 80`" class="kl-svg-vol" preserveAspectRatio="none">
              <rect
                v-for="(v, i) in volumes"
                :key="'v' + i"
                :x="v.x - v.w / 2"
                :y="80 - v.h"
                :width="v.w"
                :height="v.h"
                :fill="v.color"
              />
            </svg>
          </template>
        </div>

        <div class="kl-deal">
          <div class="kl-deal-title">五档盘口</div>
          <div v-for="(a, i) in quote.asks.slice().reverse()" :key="'a' + i" class="kl-deal-row">
            <span>卖{{ 5 - i }}</span>
            <span class="kl-down">{{ formatNum(a.price, 2) }}</span>
            <span class="kl-vol">{{ formatVol(a.vol) }}</span>
          </div>
          <div class="kl-deal-split"></div>
          <div v-for="(b, i) in quote.bids" :key="'b' + i" class="kl-deal-row">
            <span>买{{ i + 1 }}</span>
            <span class="kl-up">{{ formatNum(b.price, 2) }}</span>
            <span class="kl-vol">{{ formatVol(b.vol) }}</span>
          </div>
        </div>
      </div>
    </div>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { fetchKline, type KLinePeriod, type KLinePoint, type Quote } from '../../services/tencentFinance'

const props = defineProps<{
  visible: boolean
  code: string
  name?: string
  quote?: Quote | null
}>()
const emit = defineEmits<{ (e: 'update:visible', v: boolean): void }>()

const periods = [
  { label: '分时', value: 'minute' as KLinePeriod },
  { label: '日K', value: 'day' as KLinePeriod },
  { label: '周K', value: 'week' as KLinePeriod },
  { label: '月K', value: 'month' as KLinePeriod },
  { label: '季K', value: 'quarter' as KLinePeriod }
]
const period = ref<KLinePeriod>('day')
const points = ref<KLinePoint[]>([])
const loading = ref(false)

const isLine = computed(() => period.value === 'minute')

function trendClass(q: Quote) {
  if (q.change > 0) return 'kl-up'
  if (q.change < 0) return 'kl-down'
  return ''
}
function formatNum(v: number, d = 2): string {
  return (v || 0).toFixed(d)
}
function formatVol(v: number): string {
  if (v >= 10000) return (v / 10000).toFixed(1) + '万'
  return String(Math.round(v))
}

async function load(): Promise<void> {
  loading.value = true
  points.value = await fetchKline(props.code, period.value, 80)
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

// ===== 主图坐标计算 =====
const PAD_T = 12
const PAD_B = 22
const PAD_L = 4
const PAD_R = 4
const W = 620
const H = 270
const PLOT_H = H - PAD_T - PAD_B

const priceRange = computed(() => {
  const vals: number[] = []
  points.value.forEach((p) => {
    if (p.high) vals.push(p.high)
    if (p.low) vals.push(p.low)
  })
  if (!vals.length) return { min: 0, max: 1 }
  let min = Math.min(...vals)
  let max = Math.max(...vals)
  const pad = (max - min) * 0.08 || 1
  return { min: min - pad, max: max + pad }
})

const yOf = (price: number): number => {
  const { min, max } = priceRange.value
  return PAD_T + ((max - price) / (max - min)) * PLOT_H
}

const candles = computed(() => {
  const n = points.value.length
  if (!n) return []
  const step = (W - PAD_L - PAD_R) / n
  const w = Math.max(2, step * 0.6)
  return points.value.map((p, i) => {
    const x = PAD_L + step * i + step / 2
    const up = p.close >= p.open
    return {
      x,
      w,
      openY: yOf(p.open),
      closeY: yOf(p.close),
      highY: yOf(p.high),
      lowY: yOf(p.low),
      color: up ? '#ef4444' : '#16a34a'
    }
  })
})

const linePoints = computed(() => {
  const n = points.value.length
  if (!n) return ''
  const step = (W - PAD_L - PAD_R) / n
  return points.value
    .map((p, i) => `${PAD_L + step * i + step / 2},${yOf(p.close)}`)
    .join(' ')
})

const maLines = computed(() => {
  const defs = [
    { key: 'MA5', color: '#378ADD', n: 5 },
    { key: 'MA10', color: '#BA7517', n: 10 },
    { key: 'MA20', color: '#D85A30', n: 20 }
  ]
  const n = points.value.length
  const step = (W - PAD_L - PAD_R) / (n || 1)
  return defs
    .map((d) => {
      const pts: string[] = []
      for (let i = 0; i < n; i++) {
        if (i < d.n - 1) continue
        let sum = 0
        for (let j = i - d.n + 1; j <= i; j++) sum += points.value[j]!.close
        const avg = sum / d.n
        const x = PAD_L + step * i + step / 2
        pts.push(`${x},${yOf(avg)}`)
      }
      return { key: d.key, color: d.color, points: pts.join(' ') }
    })
    .filter((m) => m.points)
})

const hLines = computed(() => {
  const { min, max } = priceRange.value
  const out: { y: number; label: string }[] = []
  for (let i = 0; i <= 4; i++) {
    const price = min + ((max - min) * i) / 4
    out.push({ y: yOf(price), label: price.toFixed(2) })
  }
  return out
})

const gridLines = computed(() => {
  const arr: { x: number; y1: number; y2: number }[] = []
  const n = points.value.length || 1
  const step = (W - PAD_L - PAD_R) / n
  for (let i = 0; i < n; i += Math.max(1, Math.floor(n / 6))) {
    const x = PAD_L + step * i
    arr.push({ x, y1: PAD_T, y2: H - PAD_B })
  }
  return arr
})

const xLabels = computed(() => {
  const n = points.value.length
  if (!n) return []
  const step = (W - PAD_L - PAD_R) / n
  const out: { x: number; label: string }[] = []
  const stride = Math.max(1, Math.floor(n / 6))
  for (let i = 0; i < n; i += stride) {
    out.push({ x: PAD_L + step * i + step / 2, label: points.value[i]!.date.slice(-5) })
  }
  return out
})

const volumes = computed(() => {
  const n = points.value.length
  if (!n) return []
  const maxV = Math.max(...points.value.map((p) => p.volume || 0), 1)
  const step = (W - PAD_L - PAD_R) / n
  const w = Math.max(2, step * 0.6)
  return points.value.map((p, i) => {
    const x = PAD_L + step * i + step / 2
    const up = p.close >= p.open
    return {
      x,
      w,
      h: ((p.volume || 0) / maxV) * 78,
      color: up ? '#ef4444' : '#16a34a'
    }
  })
})
</script>

<style scoped>
.kl-wrap { color: var(--text); }
.kl-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
.kl-name { display: flex; align-items: baseline; gap: 8px; }
.kl-t { font-size: 16px; font-weight: 600; }
.kl-c { font-size: 12px; color: var(--text-faint); }
.kl-p { font-size: 20px; font-weight: 700; }
.kl-ch { font-size: 13px; }
.kl-up { color: #ef4444; }
.kl-down { color: #16a34a; }
.kl-seg { display: flex; gap: 4px; }
.kl-seg-item { border: 1px solid var(--border); border-radius: 6px; padding: 3px 10px; font-size: 12px; color: var(--text-muted); cursor: pointer; }
.kl-seg-item.on { border-color: var(--brand, #378ADD); color: var(--brand, #378ADD); background: var(--surface-soft); }
.kl-kpi { display: flex; gap: 16px; font-size: 13px; color: var(--text-muted); margin: 10px 0; flex-wrap: wrap; }
.kl-kpi b { color: var(--text-strong); font-weight: 600; }
.kl-time { color: var(--text-faint); }
.kl-row { display: flex; gap: 14px; }
.kl-chart { flex: 1; min-width: 0; }
.kl-svg { width: 100%; height: 270px; display: block; }
.kl-svg-vol { width: 100%; height: 80px; display: block; }
.kl-vol-head { font-size: 11px; color: var(--text-faint); margin: 4px 0 2px; }
.kl-loading, .kl-empty { padding: 40px; text-align: center; color: var(--text-faint); font-size: 13px; }
.kl-deal { width: 220px; flex-shrink: 0; border-left: 1px solid var(--border); padding-left: 14px; }
.kl-deal-title { font-size: 12px; color: var(--text-faint); margin-bottom: 6px; }
.kl-deal-row { display: flex; justify-content: space-between; font-size: 12px; padding: 4px 0; }
.kl-deal-row .kl-vol { color: var(--text-faint); }
.kl-deal-split { height: 1px; background: var(--border); margin: 6px 0; }
@media (max-width: 720px) {
  .kl-row { flex-direction: column; }
  .kl-deal { width: 100%; border-left: none; border-top: 1px solid var(--border); padding-left: 0; padding-top: 10px; }
}
</style>
