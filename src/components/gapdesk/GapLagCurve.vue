<!--
  双轨传播曲线（自绘 SVG，不用 echarts）
  ---------------------------------------------------------------
  看的是「同一条事件，决策圈热度先起还是大众热度先起」：
   · 红线 = 决策圈侧累计热度（0-100）
   · 绿线 = 大众侧累计热度
   · 橙面积 = 两条线之间的窗口 = 可变现的那段时间
  x 轴按该事件自身的首触时刻自适应（不写死 24h）：不同事件的传播跨度
  可能只有 40 分钟，也可能 20 小时，写死一个窗口会让绝大多数事件挤成一条竖线。
-->
<template>
  <div class="glc">
    <GapEmptyState
      v-if="!points.length"
      type="empty"
      title="这条事件还没有可画的传播点"
      desc="需要至少一路信源带真实发布时间；榜单类条目的 ts=0，无法做时差曲线"
    />

    <template v-else>
      <svg
        class="glc-svg"
        :viewBox="`0 0 ${W} ${H}`"
        preserveAspectRatio="none"
        role="img"
        aria-label="决策圈与大众双轨传播曲线"
      >
        <!-- 横向网格 + 右侧刻度 -->
        <g class="glc-grid">
          <template v-for="g in yTicks" :key="`y${g}`">
            <line :x1="PAD.l" :x2="W - PAD.r" :y1="yOf(g)" :y2="yOf(g)" />
            <text :x="PAD.l - 6" :y="yOf(g) + 3" text-anchor="end">{{ g }}</text>
          </template>
        </g>

        <!-- 可变现窗口：两线之间的面积 -->
        <path v-if="areaPath" class="glc-area" :d="areaPath" />

        <!-- 双轨折线 -->
        <polyline class="glc-line glc-line-pub" :points="pubLine" />
        <polyline class="glc-line glc-line-ins" :points="insLine" />

        <!-- x 轴刻度（相对最晚触达时刻，故为负值） -->
        <template v-for="tk in xTicks" :key="`x${tk}`">
          <text class="glc-xt gd-mono" :x="xOf(tk)" :y="H - 6" text-anchor="middle">{{ fmtTick(tk) }}</text>
        </template>
      </svg>

      <div class="glc-legend">
        <span class="glc-lg"><i class="glc-sw glc-sw-ins" />决策圈</span>
        <span class="glc-lg"><i class="glc-sw glc-sw-pub" />大众</span>
        <span class="glc-lg"><i class="glc-sw glc-sw-area" />面积 = 可变现窗口</span>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import GapEmptyState from './GapEmptyState.vue'

/** 曲线点：t 为相对小时，ins/pub 为两侧累计热度（0-100） */
interface LagPoint {
  /** 相对时刻（小时）：内部坐标，非绝对时间 */
  t: number
  /** 决策圈侧累计热度 0-100 */
  ins: number
  /** 大众侧累计热度 0-100 */
  pub: number
}

const props = withDefaults(
  defineProps<{
    points: LagPoint[]
    width?: number
    height?: number
  }>(),
  {
    // 数组类型必须给工厂函数默认值：父级在「事件刚切换、点还没算出来」的一帧里
    // 可能传 undefined，没有默认值就会在 points.length 处整页白屏。
    points: () => [],
    width: 680,
    height: 220
  }
)

const W = computed(() => props.width)
const H = computed(() => props.height)
/** 内边距：左侧留给 0-100 刻度，底部留给时间标签 */
const PAD = { l: 34, r: 14, t: 12, b: 24 }

const yTicks = [0, 25, 50, 75, 100] as const

/** x 轴定义域：取真实最早/最晚触达；只有一个点时人为撑开 1 小时，避免除零 */
const xDomain = computed<{ min: number; max: number }>(() => {
  const ts = props.points.map((p) => p.t)
  const min = Math.min(...ts)
  const max = Math.max(...ts)
  return max > min ? { min, max } : { min, max: min + 1 }
})

const innerW = computed(() => W.value - PAD.l - PAD.r)
const innerH = computed(() => H.value - PAD.t - PAD.b)

function xOf(t: number): number {
  const { min, max } = xDomain.value
  return PAD.l + ((t - min) / (max - min)) * innerW.value
}

function yOf(v: number): number {
  const clamped = Math.max(0, Math.min(100, v))
  return PAD.t + (1 - clamped / 100) * innerH.value
}

const clamp100 = (v: number): number => (Number.isFinite(v) ? Math.max(0, Math.min(100, v)) : 0)

const insLine = computed(() =>
  props.points.map((p) => `${xOf(p.t).toFixed(1)},${yOf(clamp100(p.ins)).toFixed(1)}`).join(' ')
)

const pubLine = computed(() =>
  props.points.map((p) => `${xOf(p.t).toFixed(1)},${yOf(clamp100(p.pub)).toFixed(1)}`).join(' ')
)

/** 面积：沿红线正向走，再沿绿线反向回来闭合 */
const areaPath = computed(() => {
  if (props.points.length < 2) return ''
  const fwd = props.points.map((p) => `${xOf(p.t).toFixed(1)} ${yOf(clamp100(p.ins)).toFixed(1)}`)
  const back = [...props.points]
    .reverse()
    .map((p) => `${xOf(p.t).toFixed(1)} ${yOf(clamp100(p.pub)).toFixed(1)}`)
  return `M ${fwd[0]} L ${fwd.slice(1).join(' L ')} L ${back.join(' L ')} Z`
})

/** x 轴 5 个刻度（含两端） */
const xTicks = computed<number[]>(() => {
  const { min, max } = xDomain.value
  const n = 4
  const out: number[] = []
  for (let i = 0; i <= n; i++) out.push(min + ((max - min) * i) / n)
  return out
})

/** 标签相对「最晚触达」取负值：0h 是最晚那一下，-4.3h 是提前量 */
function fmtTick(t: number): string {
  const rel = t - xDomain.value.max
  if (Math.abs(rel) < 0.05) return '0h'
  return `${rel.toFixed(1)}h`
}
</script>

<style scoped>
.glc {
  width: 100%;
  min-width: 0;
}
.glc-svg {
  display: block;
  width: 100%;
  height: auto;
  overflow: visible;
}
.glc-grid line {
  stroke: var(--gd-line);
  stroke-width: 1;
  stroke-dasharray: 3 3;
}
.glc-grid text {
  fill: var(--gd-line2);
  font-size: 9px;
  font-variant-numeric: tabular-nums;
}
.glc-xt {
  fill: var(--gd-ink3);
  font-size: 9px;
  font-variant-numeric: tabular-nums;
}
.glc-area {
  fill: var(--gd-warn);
  fill-opacity: 0.18;
  stroke: none;
}
.glc-line {
  fill: none;
  stroke-width: 2;
  stroke-linejoin: round;
  stroke-linecap: round;
}
.glc-line-ins {
  stroke: var(--gd-gap);
}
.glc-line-pub {
  stroke: var(--gd-ok);
}
.glc-legend {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: 4px;
  font-size: 11px;
  color: var(--gd-ink3);
}
.glc-lg {
  display: inline-flex;
  align-items: center;
  gap: 5px;
}
.glc-sw {
  width: 10px;
  height: 3px;
  border-radius: 2px;
}
.glc-sw-ins {
  background: var(--gd-gap);
}
.glc-sw-pub {
  background: var(--gd-ok);
}
.glc-sw-area {
  height: 8px;
  border-radius: 2px;
  background: color-mix(in srgb, var(--gd-warn) 28%, transparent);
}
</style>
