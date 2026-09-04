<template>
  <div class="klc">
    <div ref="boxRef" class="klc-box" :style="{ height: height }"></div>
    <div v-if="loading" class="klc-mask">K 线加载中…</div>
    <div v-else-if="!points.length" class="klc-mask klc-mask-empty">
      {{ emptyText }}
    </div>
  </div>
</template>

<script setup lang="ts">
import type { EChartsOption } from 'echarts'
import * as echarts from 'echarts/core'
import { CandlestickChart, LineChart, BarChart } from 'echarts/charts'
import {
  GridComponent,
  TooltipComponent,
  AxisPointerComponent,
  DataZoomComponent,
  MarkLineComponent
} from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { KLinePeriod, KLinePoint } from '../../services/tencentFinance'

// 按需注册（蜡烛图 + 均线 + 量柱 + 缩放 + 十字光标）
echarts.use([
  CandlestickChart,
  LineChart,
  BarChart,
  GridComponent,
  TooltipComponent,
  AxisPointerComponent,
  DataZoomComponent,
  MarkLineComponent,
  CanvasRenderer
])

const props = withDefaults(
  defineProps<{
    points: KLinePoint[]
    /** 周期：分时走折线，其余走蜡烛图 */
    period: KLinePeriod
    /** 昨收（分时基准线）；K 线模式下留空即可 */
    prevClose?: number
    height?: string
    loading?: boolean
    emptyText?: string
    /** 是否显示内置缩放条（弹窗内空间紧张时可关闭） */
    zoom?: boolean
  }>(),
  {
    prevClose: 0,
    height: '420px',
    loading: false,
    emptyText: '暂无 K 线数据（免费接口可能限速），请稍后重试',
    zoom: true
  }
)

const boxRef = ref<HTMLDivElement | null>(null)
let chart: echarts.ECharts | null = null
let ro: ResizeObserver | null = null

/** 红涨绿跌（A 股习惯，与国内行情软件一致） */
const UP = '#ef4444'
const DOWN = '#16a34a'

function isDark(): boolean {
  if (typeof document === 'undefined') return false
  const el = document.documentElement
  return el.classList.contains('dark') || el.getAttribute('data-theme') === 'dark'
}

/** 分时的 HHMM 转成 HH:MM */
function fmtTime(t: string): string {
  return /^\d{4}$/.test(t) ? `${t.slice(0, 2)}:${t.slice(2)}` : t
}
function fmtVol(v: number): string {
  if (!v) return '0'
  if (v >= 1e8) return (v / 1e8).toFixed(2) + '亿'
  if (v >= 1e4) return (v / 1e4).toFixed(2) + '万'
  return String(Math.round(v))
}
function digitsOf(v: number): number {
  if (!v) return 2
  if (v < 10) return 3
  return 2
}

/** 计算 MA（简单移动平均），前 n-1 项为 null */
function ma(n: number): (number | null)[] {
  const out: (number | null)[] = []
  let sum = 0
  props.points.forEach((p, i) => {
    sum += p.close
    if (i >= n) sum -= props.points[i - n]!.close
    out.push(i >= n - 1 ? Number((sum / n).toFixed(3)) : null)
  })
  return out
}

const isMinute = computed(() => props.period === 'minute')

const option = computed<EChartsOption>(() => {
  const pts = props.points
  const dark = isDark()
  // 移动端（IQOO Neo9 等窄屏）右侧 Y 轴文字空间紧张，需加大 right 并压字号，避免坐标轴标签被挤压堆叠
  const isMobileView = typeof window !== 'undefined' && window.innerWidth <= 768
  const axisLine = dark ? '#334155' : '#e2e8f0'
  const axisLabel = dark ? '#94a3b8' : '#64748b'
  const splitLine = dark ? 'rgba(148,163,184,0.14)' : 'rgba(100,116,139,0.12)'
  const d = digitsOf(pts.length ? pts[pts.length - 1]!.close : 0)

  if (!pts.length) return {}

  const dates = pts.map((p) => (isMinute.value ? fmtTime(p.date) : p.date))
  const closes = pts.map((p) => p.close)
  // 蜡烛图数据顺序为 [开, 收, 低, 高]
  const candles = pts.map((p) => [p.open, p.close, p.low, p.high])
  const vols = pts.map((p, i) => ({
    value: p.volume,
    itemStyle: { color: p.close >= p.open ? UP : DOWN, opacity: 0.55 }
  }))
  // 分时成交量取差分后的单分钟量，直接按涨跌着色
  const volSource = vols.map((v) => v.value)

  const maDefs = [
    { name: 'MA5', color: '#f59e0b', data: ma(5) },
    { name: 'MA10', color: '#3b82f6', data: ma(10) },
    { name: 'MA20', color: '#a855f7', data: ma(20) }
  ]

  // 分时：以昨收为基准的涨跌幅副轴（%）
  const base = props.prevClose || pts[0]?.close || 0
  const pctData = closes.map((c) => (base ? Number((((c - base) / base) * 100).toFixed(2)) : 0))

  const zoomCfg = props.zoom
    ? [
        { type: 'inside' as const, xAxisIndex: [0, 1], start: 40, end: 100 },
        {
          type: 'slider' as const,
          xAxisIndex: [0, 1],
          start: 40,
          end: 100,
          height: 16,
          bottom: 2,
          borderColor: 'transparent',
          backgroundColor: dark ? 'rgba(148,163,184,0.10)' : 'rgba(100,116,139,0.08)',
          fillerColor: dark ? 'rgba(99,102,241,0.22)' : 'rgba(99,102,241,0.14)',
          handleStyle: { color: '#94a3b8' },
          textStyle: { color: axisLabel, fontSize: 10 }
        }
      ]
    : [{ type: 'inside' as const, xAxisIndex: [0, 1], start: 0, end: 100 }]

  // 主图系列：分时=折线+昨收基准线；其余=蜡烛图+均线
  const mainSeries: Record<string, unknown>[] = isMinute.value
    ? [
        {
          name: '分时',
          type: 'line',
          data: closes,
          showSymbol: false,
          smooth: false,
          lineStyle: { width: 1.6, color: '#6366f1' },
          areaStyle: {
            color: {
              type: 'linear',
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: 'rgba(99,102,241,0.22)' },
                { offset: 1, color: 'rgba(99,102,241,0.01)' }
              ]
            }
          },
          markLine: base
            ? {
                symbol: 'none',
                silent: true,
                label: {
                  formatter: `昨收 ${base.toFixed(d)}`,
                  position: 'insideEndTop',
                  fontSize: 10,
                  color: axisLabel
                },
                lineStyle: { color: '#94a3b8', type: 'dashed', width: 1 },
                data: [{ yAxis: base }]
              }
            : undefined
        }
      ]
    : [
        {
          name: 'K线',
          type: 'candlestick',
          data: candles,
          itemStyle: {
            color: UP,
            color0: DOWN,
            borderColor: UP,
            borderColor0: DOWN
          }
        },
        ...maDefs.map((m) => ({
          name: m.name,
          type: 'line' as const,
          data: m.data,
          showSymbol: false,
          smooth: true,
          lineStyle: { width: 1, color: m.color },
          z: 3
        }))
      ]

  return {
    animation: false,
    backgroundColor: 'transparent',
    grid: [
      { left: isMobileView ? 6 : 8, right: isMobileView ? 64 : 52, top: 16, height: '62%' },
      { left: isMobileView ? 6 : 8, right: isMobileView ? 64 : 52, top: '74%', bottom: props.zoom ? 42 : 16 }
    ],
    axisPointer: {
      link: [{ xAxisIndex: 'all' }],
      label: { backgroundColor: '#475569', fontSize: 10 }
    },
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'cross' },
      backgroundColor: dark ? 'rgba(15,23,42,0.96)' : 'rgba(255,255,255,0.98)',
      borderColor: dark ? '#334155' : '#e2e8f0',
      borderWidth: 1,
      textStyle: { color: dark ? '#e2e8f0' : '#334155', fontSize: 12 },
      padding: [8, 12],
      formatter: (params: unknown) => {
        const arr = params as { dataIndex: number }[]
        if (!arr?.length) return ''
        const i = arr[0]!.dataIndex
        const p = pts[i]
        if (!p) return ''
        const head = isMinute.value ? `${fmtTime(p.date)}` : p.date
        if (isMinute.value) {
          const pct = pctData[i] ?? 0
          const color = pct >= 0 ? UP : DOWN
          return [
            `<b>${head}</b>`,
            `价格 <b>${p.close.toFixed(d)}</b>`,
            `涨跌 <span style="color:${color}">${pct >= 0 ? '+' : ''}${pct.toFixed(2)}%</span>`,
            `成交量 ${fmtVol(p.volume)}`
          ].join('<br/>')
        }
        const prev = i > 0 ? pts[i - 1]!.close : p.open
        const chg = p.close - prev
        const pct = prev ? (chg / prev) * 100 : 0
        const color = chg >= 0 ? UP : DOWN
        return [
          `<b>${head}</b>`,
          `开 <b>${p.open.toFixed(d)}</b>　高 <span style="color:${UP}">${p.high.toFixed(d)}</span>`,
          `收 <b>${p.close.toFixed(d)}</b>　低 <span style="color:${DOWN}">${p.low.toFixed(d)}</span>`,
          `涨跌 <span style="color:${color}">${chg >= 0 ? '+' : ''}${chg.toFixed(d)}（${pct >= 0 ? '+' : ''}${pct.toFixed(2)}%）</span>`,
          `成交量 ${fmtVol(p.volume)}`,
          ...maDefs
            .filter((m) => m.data[i] != null)
            .map((m) => `<span style="color:${m.color}">${m.name} ${(m.data[i] as number).toFixed(d)}</span>`)
        ].join('<br/>')
      }
    },
    xAxis: [
      {
        type: 'category',
        data: dates,
        gridIndex: 0,
        boundaryGap: !isMinute.value,
        axisLine: { lineStyle: { color: axisLine } },
        axisLabel: { show: false },
        axisTick: { show: false },
        splitLine: { show: true, lineStyle: { color: splitLine } },
        min: 'dataMin',
        max: 'dataMax'
      },
      {
        type: 'category',
        data: dates,
        gridIndex: 1,
        boundaryGap: !isMinute.value,
        axisLine: { lineStyle: { color: axisLine } },
        axisLabel: { color: axisLabel, fontSize: isMobileView ? 9 : 10, hideOverlap: true },
        axisTick: { show: false },
        splitLine: { show: false },
        min: 'dataMin',
        max: 'dataMax'
      }
    ],
    yAxis: [
      {
        scale: true,
        gridIndex: 0,
        position: 'right',
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { color: axisLabel, fontSize: isMobileView ? 9 : 10, formatter: (v: number) => v.toFixed(d) },
        splitLine: { lineStyle: { color: splitLine } }
      },
      {
        // 分时副轴显示涨跌幅 %
        scale: isMinute.value,
        gridIndex: 0,
        position: 'right',
        offset: isMobileView ? 36 : 40,
        show: isMinute.value,
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: {
          color: axisLabel,
          fontSize: isMobileView ? 9 : 10,
          formatter: (v: number) => `${v.toFixed(2)}%`
        },
        splitLine: { show: false }
      },
      {
        scale: true,
        gridIndex: 1,
        position: 'right',
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { color: axisLabel, fontSize: isMobileView ? 8 : 9, formatter: (v: number) => fmtVol(v) },
        splitLine: { lineStyle: { color: splitLine } }
      }
    ],
    dataZoom: zoomCfg,
    series: [
      ...mainSeries,
      {
        name: '成交量',
        type: 'bar',
        xAxisIndex: 1,
        yAxisIndex: 2,
        data: volSource.map((v, i) => ({
          value: v,
          itemStyle: {
            color: pts[i]!.close >= pts[i]!.open ? UP : DOWN,
            opacity: 0.55
          }
        }))
      }
    ]
  }
})

function render(): void {
  if (!boxRef.value) return
  if (!chart) chart = echarts.init(boxRef.value)
  chart.setOption(option.value, true)
}

function handleResize(): void {
  chart?.resize()
}

onMounted(() => {
  render()
  if (boxRef.value && typeof ResizeObserver !== 'undefined') {
    ro = new ResizeObserver(() => handleResize())
    ro.observe(boxRef.value)
  } else if (typeof window !== 'undefined') {
    window.addEventListener('resize', handleResize)
  }
})

watch(option, () => render(), { deep: true })

onBeforeUnmount(() => {
  ro?.disconnect()
  ro = null
  if (typeof window !== 'undefined') window.removeEventListener('resize', handleResize)
  chart?.dispose()
  chart = null
})
</script>

<style scoped>
.klc {
  position: relative;
  width: 100%;
}
.klc-box {
  width: 100%;
}
.klc-mask {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  color: var(--text-faint);
  background: var(--surface);
}
.klc-mask-empty {
  padding: 0 24px;
  text-align: center;
  line-height: 1.7;
}
</style>
