<!--
  差值台 GAPDESK · 无状态 SVG 环图
  value 为 0-100 的真实健康分；NaN / null / 非数值只画占位圆和「—」，
  不把缺失值渲染成 0%，避免把「没读到」说成「全坏」。
-->
<template>
  <svg
    class="gd-ring"
    :viewBox="`0 0 ${size} ${size}`"
    :style="{ width: `${size}px`, height: `${size}px` }"
    role="img"
    aria-label="健康分环图"
  >
    <circle
      class="gd-ring-track"
      :class="{ 'is-placeholder': !valid }"
      :cx="center"
      :cy="center"
      :r="radius"
    />
    <circle
      v-if="valid"
      class="gd-ring-arc"
      :cx="center"
      :cy="center"
      :r="radius"
      :stroke-dasharray="`${arcLen} ${circumference}`"
      :transform="`rotate(-90 ${center} ${center})`"
    />
    <text class="gd-ring-text" :x="center" :y="center">{{ valid ? clamped : '—' }}</text>
  </svg>
</template>

<script setup lang="ts">
import { computed } from 'vue'

interface Props {
  /** 0-100；超出范围夹取，非法值走占位 */
  value: number
  size?: number
}
const props = withDefaults(defineProps<Props>(), { size: 76 })

const valid = computed<boolean>(() => typeof props.value === 'number' && Number.isFinite(props.value))
const clamped = computed<number>(() =>
  valid.value ? Math.max(0, Math.min(100, Math.round(props.value))) : 0
)
const center = computed<number>(() => props.size / 2)
const radius = computed<number>(() => Math.max(1, props.size / 2 - 6))
const circumference = computed<number>(() => 2 * Math.PI * radius.value)
const arcLen = computed<number>(() => (clamped.value / 100) * circumference.value)
</script>

<style scoped>
.gd-ring {
  display: block;
  flex: 0 0 auto;
}
.gd-ring-track {
  fill: none;
  stroke: var(--gd-line2);
  stroke-width: 6;
}
.gd-ring-track.is-placeholder {
  stroke: var(--gd-line);
  stroke-dasharray: 3 4;
}
.gd-ring-arc {
  fill: none;
  stroke: var(--gd-brand);
  stroke-width: 6;
  stroke-linecap: round;
}
.gd-ring-text {
  fill: var(--gd-ink);
  font-family: var(--gd-mono);
  font-size: var(--gd-fs-gscore);
  font-weight: 600;
  text-anchor: middle;
  dominant-baseline: central;
}
</style>
