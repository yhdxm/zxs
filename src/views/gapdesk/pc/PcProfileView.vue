<!--
  PC-02 行业概览
  8 行业档案卡全部由 byIndustry / matrix6 / evidences 实测统计得出；
  自绘六维雷达（不引 echarts）；国标分类与行业解码库无真值 → 二期空态。
-->
<template>
  <div class="pcview">
    <div class="gh">
      <i class="bar" aria-hidden="true" />
      <span class="t">8 个行业档案</span>
      <span class="r">卡片数字全部为当前事件池真实统计 · 无信号的行业不补 0</span>
    </div>

    <div class="cards">
      <button
        v-for="ind in GAP_IND"
        :key="ind.key"
        type="button"
        class="prof"
        :class="{ on: selected === ind.key }"
        @click="selected = ind.key"
      >
        <span class="prof-top">
          <i class="prof-ico" :style="{ background: ind.color }" aria-hidden="true">{{ ind.label.slice(0, 1) }}</i>
          <span class="prof-nm">{{ ind.label }}</span>
        </span>
        <span class="prof-stat">
          <span><b class="gd-mono">{{ statOf(ind.key).count }}</b><em>事件数</em></span>
          <span><b class="gd-mono">{{ statOf(ind.key).avg }}</b><em>均 GAP</em></span>
          <span><b class="gd-mono">{{ statOf(ind.key).srcs }}</b><em>覆盖信源</em></span>
          <span><b class="gd-mono">{{ statOf(ind.key).max }}</b><em>最高分</em></span>
        </span>
        <span class="prof-best gd-mono">{{ statOf(ind.key).best || '— 暂无事件' }}</span>
      </button>
    </div>

    <div class="grid2">
      <section class="panel">
        <h4>{{ selectedLabel }} · 六维信号雷达</h4>
        <p class="sub">维度浓度 = 该行业在事件池中的最高 GAP 分（空格为待采，不补 0）</p>
        <svg v-if="radarValues.some((v) => v > 0)" class="radar" viewBox="0 0 240 210" role="img" aria-label="六维信号雷达">
          <polygon class="radar-grid" :points="hexPoints(1)" />
          <polygon class="radar-grid" :points="hexPoints(0.66)" />
          <polygon class="radar-grid" :points="hexPoints(0.33)" />
          <line v-for="(pt, i) in axisPoints" :key="i" class="radar-grid" x1="120" y1="105" :x2="pt.x" :y2="pt.y" />
          <polygon class="radar-shape" :points="shapePoints" />
          <text v-for="(label, i) in GAP_DIM6_LABELS" :key="label" class="radar-lb" :x="labelPoints[i]?.x" :y="labelPoints[i]?.y" text-anchor="middle">{{ label }}</text>
        </svg>
        <p v-else class="panel-note">— {{ EMPTY_WAIT }}：该行业当前六维都没有可展示的实测事件。</p>
      </section>

      <GapEmptyState type="empty" title="行业解码库" :desc="EMPTY_HISTORY" :phase2="EMPTY_EXPORT" />
    </div>

    <GapEmptyState type="empty" title="中国国标行业分类全览" :desc="EMPTY_HISTORY" :phase2="EMPTY_ARCHIVE" />
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import GapEmptyState from '../../../components/gapdesk/GapEmptyState.vue'
import { EMPTY_ARCHIVE, EMPTY_EXPORT, EMPTY_HISTORY, EMPTY_WAIT, GAP_DIM6, GAP_IND } from '../../../config/gapdeskConfig'
import { useGapDesk } from '../../../composables/useGapDesk'
import type { GapInd } from '../../../types/gapdesk'

const { byIndustry, matrix6, evidences } = useGapDesk()
const selected = ref<GapInd>('ai')

const GAP_DIM6_LABELS = GAP_DIM6.map((d) => d.label)

const selectedLabel = computed(() => GAP_IND.find((i) => i.key === selected.value)?.label ?? '行业')

interface IndStat {
  count: number
  avg: number | string
  srcs: number
  max: number | string
  best: string
}

function statOf(ind: GapInd): IndStat {
  const list = byIndustry.value[ind] ?? []
  if (!list.length) return { count: 0, avg: '—', srcs: 0, max: '—', best: '' }
  const ids = new Set(list.map((e) => e.id))
  const sourceNames = new Set(
    evidences.value.filter((row) => ids.has(row.event_id) && row.source_name).map((row) => row.source_name as string)
  )
  const best = [...list].sort((a, b) => b.gap - a.gap)[0]
  return {
    count: list.length,
    avg: Math.round(list.reduce((sum, e) => sum + e.gap, 0) / list.length),
    srcs: sourceNames.size,
    max: best?.gap ?? '—',
    best: best ? `GAP ${best.gap} · ${best.title.slice(0, 28)}` : ''
  }
}

/** 六维取该行业每格 maxGap；全空时不画多边形，如实显示待采 */
const radarValues = computed<number[]>(() => {
  const row = matrix6.value[selected.value]
  return GAP_DIM6.map((d) => row?.[d.key]?.maxGap ?? 0)
})

const CX = 120
const CY = 105
const R = 74
function pointAt(index: number, ratio: number): { x: number; y: number } {
  const angle = (Math.PI * 2 * index) / 6 - Math.PI / 2
  return { x: CX + Math.cos(angle) * R * ratio, y: CY + Math.sin(angle) * R * ratio }
}
function hexPoints(ratio: number): string {
  return GAP_DIM6.map((_, i) => {
    const p = pointAt(i, ratio)
    return `${p.x.toFixed(1)},${p.y.toFixed(1)}`
  }).join(' ')
}
const axisPoints = computed(() => GAP_DIM6.map((_, i) => pointAt(i, 1)))
const labelPoints = computed(() => GAP_DIM6.map((_, i) => pointAt(i, 1.24)))
const shapePoints = computed(() => {
  const max = Math.max(1, ...radarValues.value)
  return radarValues.value
    .map((v, i) => {
      const p = pointAt(i, v / max)
      return `${p.x.toFixed(1)},${p.y.toFixed(1)}`
    })
    .join(' ')
})
</script>

<style scoped>
.cards {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
  flex-shrink: 0;
}
.prof {
  display: flex;
  flex-direction: column;
  gap: 9px;
  padding: 12px;
  border: 1px solid var(--gd-line);
  border-radius: var(--gd-r-panel);
  background: var(--gd-card);
  text-align: left;
  cursor: pointer;
  min-width: 0;
  transition: all .18s var(--gd-ease);
}
.prof:hover,
.prof.on {
  border-color: var(--gd-brand);
  box-shadow: var(--gd-sh-sm);
}
.prof-top {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}
.prof-ico {
  width: 30px;
  height: 30px;
  border-radius: 9px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--gd-card);
  font-family: var(--gd-mono);
  font-size: var(--gd-fs-why);
  font-weight: 700;
  flex-shrink: 0;
}
.prof-nm {
  font-size: var(--gd-fs-why);
  font-weight: 700;
  color: var(--gd-ink);
}
.prof-stat {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 6px;
  padding-top: 8px;
  border-top: 1px solid var(--gd-line);
}
.prof-stat span {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.prof-stat b {
  font-size: var(--gd-fs-panelh);
  color: var(--gd-ink);
}
.prof-stat em {
  font-style: normal;
  font-size: var(--gd-fs-pill);
  color: var(--gd-ink3);
}
.prof-best {
  font-size: var(--gd-fs-pill);
  color: var(--gd-ink3);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.radar {
  display: block;
  width: 100%;
  max-width: 300px;
  height: auto;
  margin: 0 auto;
}
.radar-grid {
  fill: none;
  stroke: var(--gd-line);
  stroke-width: 1;
}
.radar-shape {
  fill: color-mix(in srgb, var(--gd-brand) 25%, transparent);
  stroke: var(--gd-brand);
  stroke-width: 2;
}
.radar-lb {
  fill: var(--gd-ink3);
  font-size: var(--gd-fs-kick);
  font-family: var(--gd-sans);
}
@media (max-width: 1360px) {
  .cards { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
</style>
