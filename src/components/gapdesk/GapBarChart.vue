<!--
  差值台 GAPDESK · 无状态 SVG 柱图
  只画真实值：v<=0 不铺柱、只保留日期标签；全 0 时的「积累中」占位由调用方决定。
  颜色 / 字号一律走 .gd-stage 的 --gd-* 令牌，不写死 hex 或 px 字号。
-->
<template>
  <svg
    v-if="bars.length"
    class="gd-barchart"
    :viewBox="`0 0 ${W} ${H}`"
    role="img"
    aria-label="每日供给柱图"
  >
    <line class="gd-baseline" :x1="PAD_X" :x2="W - PAD_X" :y1="BASE_Y" :y2="BASE_Y" />
    <g v-for="bar in bars" :key="bar.key">
      <rect
        v-if="bar.h > 0"
        class="gd-bar"
        :x="bar.x"
        :y="bar.y"
        :width="bar.w"
        :height="bar.h"
        rx="2"
      />
      <text class="gd-bar-label" :x="bar.x + bar.w / 2" :y="H - 4">{{ bar.label }}</text>
    </g>
  </svg>
</template>

<script setup lang="ts">
import { computed } from 'vue'

interface Props {
  values: number[]
  labels: string[]
  /** 统一的纵轴上限；不传则取本组真实最大值 */
  max?: number
}
const props = withDefaults(defineProps<Props>(), { max: 0 })

const W = 320
const H = 118
const PAD_X = 8
const PLOT_H = 88
const BASE_Y = 94

interface Bar {
  key: string
  label: string
  x: number
  y: number
  w: number
  h: number
}

const bars = computed<Bar[]>(() => {
  const vals = props.values
  if (!vals.length) return []
  const clean = vals.map((v) => (Number.isFinite(v) && v > 0 ? v : 0))
  const ceiling = Math.max(props.max > 0 ? props.max : 0, ...clean, 1)
  const step = (W - PAD_X * 2) / vals.length
  const bw = Math.max(2, Math.min(28, step * 0.56))
  return vals.map((_v, i) => {
    const v = clean[i] ?? 0
    const h = v > 0 ? (v / ceiling) * PLOT_H : 0
    return {
      key: `${i}-${props.labels[i] ?? ''}`,
      label: props.labels[i] ?? '',
      x: PAD_X + i * step + (step - bw) / 2,
      y: BASE_Y - h,
      w: bw,
      h
    }
  })
})
</script>

<style scoped>
.gd-barchart {
  display: block;
  width: 100%;
  height: auto;
}
.gd-baseline {
  stroke: var(--gd-line);
  stroke-width: 1;
}
.gd-bar {
  fill: var(--gd-brand);
  transition: fill 0.18s var(--gd-ease);
}
.gd-bar:hover {
  fill: color-mix(in srgb, var(--gd-brand) 72%, var(--gd-brand2));
}
.gd-bar-label {
  fill: var(--gd-ink3);
  font-family: var(--gd-mono);
  font-size: var(--gd-fs-pill);
  text-anchor: middle;
}
</style>
