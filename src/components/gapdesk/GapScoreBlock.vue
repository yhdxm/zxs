<!--
  四维分解复用件
  ---------------------------------------------------------------
  把「原始加权分」和「展示 GAP 分」放在同一屏讲清楚：
    四维各 0–25 → 按固定权重加权得原始分（满 90）
    → 原始分在完整事件池内做分位映射得 GAP（54–97）
  两个数字不是打架，是同一对象的两把尺子。
-->
<template>
  <div class="gsb2">
    <div class="gsb2-head gd-mono">
      <span class="gsb2-raw">原始 {{ raw }}/90</span>
      <span class="gsb2-arrow">→</span>
      <span class="gsb2-gap" :class="`gsb2-${event.tier.toLowerCase()}`">GAP {{ event.gap }}</span>
      <span class="gsb2-tier">{{ event.tier }} · 池内第 {{ event.rank }} 位</span>
    </div>

    <div class="gsb2-grid">
      <div v-for="seg in segments" :key="seg.key" class="gsb2-seg">
        <div class="gsb2-seg-head">
          <span>{{ seg.label }}</span>
          <b class="gd-mono">{{ seg.value }}/25</b>
        </div>
        <div class="gsb2-track"><i :style="{ width: `${seg.pct}%` }" /></div>
      </div>
    </div>

    <p class="gsb2-note">
      四维各 0–25，权重 时效×{{ GAP_WEIGHTS.time.toFixed(2) }} + 稀缺×{{ GAP_WEIGHTS.rare.toFixed(2) }} +
      影响×{{ GAP_WEIGHTS.impact.toFixed(2) }} + 可行动×{{ GAP_WEIGHTS.action.toFixed(2) }} = 原始分（满 90）；
      GAP 是原始分在完整事件池内的分位映射，用于跨行业比较。
    </p>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { GAP_WEIGHTS } from '../../config/gapdeskConfig'
import { safeJson } from '../../utils/gapdeskFormat'
import type { RankedEvent } from '../../types/gapdesk'

const props = defineProps<{ event: RankedEvent }>()

/** 权重唯一真源在 config.GAP_WEIGHTS，组件内不再抄第二份数值 */
const DIMS = [
  { key: 'time', label: '时效', weight: GAP_WEIGHTS.time },
  { key: 'rare', label: '稀缺', weight: GAP_WEIGHTS.rare },
  { key: 'impact', label: '影响', weight: GAP_WEIGHTS.impact },
  { key: 'action', label: '可行动', weight: GAP_WEIGHTS.action }
] as const
const DIM_MAX = 25

/** Realtime 载荷偶尔把 jsonb 回成字符串，统一过 safeJson */
const dims = computed<number[]>(() => {
  const value = typeof props.event.b_json === 'string'
    ? safeJson<unknown>(props.event.b_json, null)
    : props.event.b_json
  return Array.isArray(value) && value.length === 4
    ? value.map((v) => {
        const n = Number(v)
        return Number.isFinite(n) ? Math.max(0, Math.min(DIM_MAX, Math.round(n))) : 0
      })
    : [0, 0, 0, 0]
})

const segments = computed(() =>
  DIMS.map((dim, i) => {
    const value = dims.value[i] ?? 0
    return { ...dim, value, pct: Math.round((value / DIM_MAX) * 100) }
  })
)

/** 库里已有原始分直接用；没有就按公开权重复算，绝不编造第四个数字 */
const raw = computed<number>(() => {
  const stored = Number(props.event.gap_raw)
  if (Number.isFinite(stored) && stored > 0) return Math.round(stored)
  return Math.round(segments.value.reduce((sum, seg) => sum + seg.value * seg.weight, 0))
})
</script>

<style scoped>
.gsb2 {
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-width: 0;
}
.gsb2-head {
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  gap: 8px;
}
.gsb2-raw {
  font-size: var(--gd-fs-panelh);
  color: var(--gd-ink2);
}
.gsb2-arrow {
  font-size: var(--gd-fs-why);
  color: var(--gd-ink3);
}
.gsb2-gap {
  font-size: var(--gd-fs-gscore);
  font-weight: 700;
  color: var(--gd-brand);
}
.gsb2-l0 {
  color: var(--gd-gap);
}
.gsb2-l2 {
  color: var(--gd-ink3);
}
.gsb2-tier {
  margin-left: auto;
  font-size: var(--gd-fs-pill);
  color: var(--gd-ink3);
}
.gsb2-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 9px;
}
.gsb2-seg {
  min-width: 0;
}
.gsb2-seg-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 4px;
  font-size: var(--gd-fs-panels);
  color: var(--gd-ink2);
}
.gsb2-seg-head b {
  font-size: var(--gd-fs-pill);
  color: var(--gd-ink);
}
.gsb2-track {
  height: 6px;
  margin-top: 4px;
  border-radius: 999px;
  background: var(--gd-line);
  overflow: hidden;
}
.gsb2-track i {
  display: block;
  height: 100%;
  border-radius: 999px;
  background: var(--gd-grad);
}
.gsb2-note {
  margin: 0;
  font-size: var(--gd-fs-panels);
  line-height: 1.6;
  color: var(--gd-ink3);
}
@media (max-width: 768px) {
  .gsb2-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
