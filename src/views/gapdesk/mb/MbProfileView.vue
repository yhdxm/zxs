<!--
  移动-02 行业概览
  与 PC-02 同一份 byIndustry 统计；点击行业写入 filters.inds 并回到「最新」看该行业时间线。
-->
<template>
  <div class="mbview">
    <div class="p-sec"><div class="h">8 个行业档案 · 样本来自当前事件池</div></div>
    <GapEmptyState v-if="!ranked.length" type="empty" />
    <!-- 原行业卡点击跳转行为保持不变；下钻为卡片下方新增的独立展开区 -->
    <div v-for="ind in GAP_IND" :key="ind.key" class="indblock">
      <button type="button" class="p-item" @click="openIndustry(ind.key)">
        <span class="top">
          <i class="dot" :style="{ background: ind.color }" aria-hidden="true" />
          <span class="t">{{ ind.label }}</span>
          <span class="gd-mono n">{{ statOf(ind.key).count }}</span>
        </span>
        <span class="m gd-mono">均 GAP {{ statOf(ind.key).avg }} · 最高 {{ statOf(ind.key).max }}</span>
        <span class="m best">{{ statOf(ind.key).best || '— 暂无事件' }}</span>
      </button>

      <button
        type="button"
        class="ind-toggle"
        :aria-expanded="!!openSet[ind.key]"
        @click="toggleTop5(ind.key)"
      >
        <span>{{ openSet[ind.key] ? '收起该行业 TOP5' : '看该行业 TOP5' }}</span>
        <span class="gd-mono ind-toggle-n">{{ top5Of(ind.key).length }} 条</span>
      </button>
      <ol v-if="openSet[ind.key]" class="ind-top5">
        <li v-for="row in top5Of(ind.key)" :key="row.id">
          <button type="button" class="ind-row" @click="openDetail(row.id)">
            <span class="gd-mono ind-rank">#{{ row.rank }}</span>
            <span class="gd-mono ind-gap">GAP {{ row.gap }}</span>
            <span class="ind-title">{{ row.title }}</span>
          </button>
        </li>
        <li v-if="!top5Of(ind.key).length" class="ind-none">{{ EMPTY_WAIT }}：该行业当前没有可展示的实测事件。</li>
      </ol>
    </div>
  </div>
</template>

<script setup lang="ts">
import { inject, reactive } from 'vue'
import GapEmptyState from '../../../components/gapdesk/GapEmptyState.vue'
import { EMPTY_WAIT, GAP_IND } from '../../../config/gapdeskConfig'
import { GAP_OPEN_DETAIL_KEY, useGapDesk } from '../../../composables/useGapDesk'
import type { GapInd } from '../../../types/gapdesk'

const emit = defineEmits<{ navigate: [key: string] }>()
const { ranked, byIndustry, filters } = useGapDesk()
const openDetail = inject(GAP_OPEN_DETAIL_KEY, (_id: number) => {})

interface Top5Row {
  id: number
  rank: number
  gap: number
  title: string
}
/** 每张行业卡的展开态互相独立，默认全部收起，不改变原卡片的跳转行为 */
const openSet = reactive<Partial<Record<GapInd, boolean>>>({})
function toggleTop5(ind: GapInd): void {
  openSet[ind] = !openSet[ind]
}

/**
 * 与 PC 行业档案卡同一口径：byIndustry[ind] 按 gap 降序前 5，
 * 名次从全局 ranked 反查（byIndustry 行本身不带 rank）。
 */
function top5Of(ind: GapInd): Top5Row[] {
  const rankMap = new Map(ranked.value.map((row) => [row.id, row.rank]))
  return [...(byIndustry.value[ind] ?? [])]
    .sort((a, b) => b.gap - a.gap)
    .slice(0, 5)
    .map((row, index) => ({
      id: row.id,
      rank: rankMap.get(row.id) ?? index + 1,
      gap: row.gap,
      title: row.title
    }))
}

function statOf(ind: GapInd): { count: number; avg: number | string; max: number | string; best: string } {
  const list = byIndustry.value[ind] ?? []
  if (!list.length) return { count: 0, avg: '—', max: '—', best: '' }
  const best = [...list].sort((a, b) => b.gap - a.gap)[0]
  return {
    count: list.length,
    avg: Math.round(list.reduce((sum, e) => sum + e.gap, 0) / list.length),
    max: best?.gap ?? '—',
    best: best ? `GAP ${best.gap} · ${best.title.slice(0, 22)}` : ''
  }
}

/** 写入共享筛选（切视图不丢），再回最新信息按发布日读该行业时间线 */
function openIndustry(ind: GapInd): void {
  filters.inds = [ind]
  emit('navigate', 'm-latest')
}

</script>

<style scoped>
.mbview {
  display: flex;
  flex-direction: column;
  gap: 11px;
}
.top {
  display: flex;
  align-items: center;
  gap: 7px;
  min-width: 0;
}
.dot {
  width: 8px;
  height: 8px;
  border-radius: 999px;
  flex-shrink: 0;
}
.n {
  margin-left: auto;
  font-size: var(--gd-fs-gscore);
  font-weight: 700;
  color: var(--gd-brand);
}
.best {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.indblock {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
  flex-shrink: 0;
}
.ind-toggle {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 44px;
  padding: 0 11px;
  border: 1px dashed var(--gd-line2);
  border-radius: var(--gd-r-nav);
  background: var(--gd-sub);
  color: var(--gd-brand);
  font-family: var(--gd-sans);
  font-size: var(--gd-fs-panels);
  text-align: left;
  cursor: pointer;
}
.ind-toggle-n {
  margin-left: auto;
  color: var(--gd-ink3);
  font-size: var(--gd-fs-pill);
}
.ind-top5 {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin: 0;
  padding: 2px 0 4px 6px;
  list-style: none;
}
.ind-row {
  display: flex;
  align-items: center;
  gap: 7px;
  width: 100%;
  min-height: 44px;
  padding: 5px 9px;
  border: 1px solid var(--gd-line);
  border-radius: var(--gd-r-nav);
  background: var(--gd-card);
  text-align: left;
  cursor: pointer;
  min-width: 0;
}
.ind-rank {
  flex: none;
  font-size: var(--gd-fs-pill);
  color: var(--gd-ink3);
}
.ind-gap {
  flex: none;
  font-size: var(--gd-fs-panels);
  font-weight: 700;
  color: var(--gd-gap);
}
.ind-title {
  flex: 1;
  min-width: 0;
  font-size: var(--gd-fs-panels);
  color: var(--gd-ink2);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.ind-none {
  padding: 8px 9px;
  font-size: var(--gd-fs-pill);
  color: var(--gd-ink3);
}
</style>
