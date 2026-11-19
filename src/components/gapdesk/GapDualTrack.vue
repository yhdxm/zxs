<!--
  双轨背离标尺（差值台的唯一图形语言）
  ---------------------------------------------------------------
  为什么自绘不引 echarts：这个图形只有两条横轨 + 一个数字，
  为它拉 700KB 的图表库不值得；而且自绘能保证打印/截图/暗色主题下完全一致。
  口径：左轨=决策圈热度（ins_heat），右轨=大众热度（pub_heat），
       中间数字 = ins - pub（正=决策圈更热，负=大众反过来更热，0=同温）。
-->
<template>
  <div class="gdt" :class="{ 'gdt-compact': compact }">
    <div class="gdt-rows">
      <div class="gdt-row">
        <span class="gdt-label">决策圈</span>
        <span class="gdt-track">
          <i class="gdt-fill gdt-ins" :style="{ width: `${insPct}%` }" />
        </span>
        <span class="gdt-num">{{ insHeat }}</span>
      </div>
      <div class="gdt-row">
        <span class="gdt-label">大众</span>
        <span class="gdt-track">
          <i class="gdt-fill gdt-pub" :style="{ width: `${pubPct}%` }" />
        </span>
        <span class="gdt-num">{{ pubHeat }}</span>
      </div>
    </div>

    <div class="gdt-center">
      <span class="gdt-div" :style="{ color: divColor }">
        <span v-if="div > 0" class="gdt-plus">+</span>{{ div }}
      </span>
      <span class="gdt-cap">差值</span>
      <span v-if="!compact" class="gdt-gap">gap {{ gap }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    /** 决策圈热度 0-100 */
    insHeat: number
    /** 大众热度 0-100 */
    pubHeat: number
    /** 展示分（仅非紧凑模式展示，紧凑模式由卡片自己显示） */
    gap: number
    /** 移动端/卡片内使用：纵向堆叠、字号更小 */
    compact?: boolean
  }>(),
  { compact: false }
)

/** 夹取到 0-100，避免脏数据把进度条撑出容器 */
const clampPct = (v: number): number => {
  if (!Number.isFinite(v)) return 0
  return Math.max(0, Math.min(100, Math.round(v)))
}

const insPct = computed(() => clampPct(props.insHeat))
const pubPct = computed(() => clampPct(props.pubHeat))

const div = computed(() => clampPct(props.insHeat) - clampPct(props.pubHeat))

/** 正=红（差值大，决策圈已热而大众未热）；负=绿（大众比决策圈更热，差值已闭合）；0=灰 */
const divColor = computed(() => {
  if (div.value > 0) return '#FF3358'
  if (div.value < 0) return '#0BA36F'
  return '#909399'
})
</script>

<style scoped>
.gdt {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  min-width: 0;
}
.gdt-rows {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}
.gdt-row {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}
.gdt-label {
  width: 44px;
  flex: none;
  font-size: 11px;
  color: var(--text-muted, #909399);
  letter-spacing: 0.02em;
}
.gdt-track {
  position: relative;
  flex: 1;
  height: 7px;
  min-width: 0;
  background: var(--surface-soft, rgba(0, 0, 0, 0.04));
  border-radius: 4px;
  overflow: hidden;
}
.gdt-fill {
  display: block;
  height: 100%;
  border-radius: 4px;
  transition: width 0.35s ease;
}
.gdt-ins {
  background: linear-gradient(90deg, #ff7a92, #ff3358);
}
.gdt-pub {
  background: linear-gradient(90deg, #9fd6c8, #0ba36f);
}
.gdt-num {
  width: 26px;
  flex: none;
  text-align: right;
  font-size: 11px;
  font-variant-numeric: tabular-nums;
  color: var(--text-strong, #303133);
}
.gdt-center {
  flex: none;
  display: flex;
  flex-direction: column;
  align-items: center;
  min-width: 52px;
}
.gdt-div {
  font-size: 20px;
  font-weight: 700;
  line-height: 1.1;
  font-variant-numeric: tabular-nums;
}
.gdt-plus {
  font-size: 13px;
  font-weight: 600;
}
.gdt-cap {
  font-size: 10px;
  color: var(--text-muted, #909399);
  letter-spacing: 0.08em;
}
.gdt-gap {
  margin-top: 2px;
  font-size: 10px;
  color: var(--text-muted, #909399);
  font-variant-numeric: tabular-nums;
}

/* 紧凑模式（卡片内 / 移动端）：纵向堆叠，标尺在上、数字在下 */
.gdt-compact {
  flex-direction: column;
  align-items: stretch;
  gap: 6px;
}
.gdt-compact .gdt-center {
  flex-direction: row;
  justify-content: flex-end;
  align-items: baseline;
  gap: 4px;
  min-width: 0;
}
.gdt-compact .gdt-div {
  font-size: 16px;
}
</style>
