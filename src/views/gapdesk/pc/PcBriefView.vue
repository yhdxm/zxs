<!--
  PC 今日简报（侧栏 10）：全部读 store 真值。
  回打样本不存在，收敛曲线只画虚线基线，绝不铺假柱。
  日期带 / 筛选 / 右栏由宿主统一渲染，这里只写中栏。
-->
<template>
  <div class="pcview">
    <GapHeroCards :items="heroItems" />

    <section class="panel">
      <div class="gh">
        <i class="bar" aria-hidden="true" />
        <span class="t">AI 今日研判</span>
        <span class="r">{{ EMPTY_LLM }}</span>
      </div>
      <p class="panel-note brief-text">{{ dailyBriefText || EMPTY_GENERIC }}</p>
    </section>

    <div class="gh">
      <i class="bar" aria-hidden="true" />
      <span class="t">今日 L0 必看</span>
      <span class="b l0">{{ l0List.length }}</span>
    </div>
    <GapEmptyState v-if="!l0List.length" type="empty" :desc="EMPTY_GENERIC" />
    <GapEventCard
      v-for="item in l0List"
      :key="item.id"
      :event="item"
      :favorite="favorites.includes(item.id)"
      :later="laterIds.includes(item.id)"
      @open="openDetail"
      @later="toggleLater"
      @like="toggleFavoriteEvent"
    />

    <section class="panel">
      <div class="gh">
        <i class="bar" aria-hidden="true" />
        <span class="t">按发布日供给曲线</span>
        <span class="r gd-mono">{{ supplyByDay.length }} 个日点</span>
      </div>
      <template v-if="supplyByDay.length > 1">
        <GapBarChart :values="chartValues" :labels="chartLabels" />
        <p class="panel-note gd-mono">
          {{ lastDay?.label ?? '—' }}：L0 {{ lastDay?.l0 ?? 0 }} · L1 {{ lastDay?.l1 ?? 0 }} · L2 {{ lastDay?.l2 ?? 0 }}
        </p>
      </template>
      <GapEmptyState v-else type="empty" :desc="EMPTY_SUPPLY" />
    </section>

    <section class="panel">
      <div class="gh">
        <i class="bar" aria-hidden="true" />
        <span class="t">行业活跃度 TOP5</span>
      </div>
      <div v-for="row in topInds" :key="row.key" class="rowline">
        <span>{{ row.label }}</span>
        <span class="v gd-mono">{{ row.count }} 条</span>
      </div>
      <p v-if="!topInds.length" class="panel-note">{{ EMPTY_GENERIC }}</p>
    </section>

    <section class="panel">
      <div class="gh">
        <i class="bar" aria-hidden="true" />
        <span class="t">回打收敛曲线</span>
        <span class="r">{{ EMPTY_ECHO }}</span>
      </div>
      <svg class="gd-null-line" viewBox="0 0 320 36" aria-hidden="true">
        <line x1="4" y1="30" x2="316" y2="30" />
      </svg>
      <p class="panel-note">{{ EMPTY_ECHO }}</p>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, inject } from 'vue'
import GapBarChart from '../../../components/gapdesk/GapBarChart.vue'
import GapEmptyState from '../../../components/gapdesk/GapEmptyState.vue'
import GapEventCard from '../../../components/gapdesk/GapEventCard.vue'
import GapHeroCards from '../../../components/gapdesk/GapHeroCards.vue'
import { EMPTY_ECHO, EMPTY_GENERIC, EMPTY_LLM, EMPTY_SUPPLY, GAP_IND, GAP_IND_MAP, GAP_LAG_NOTE } from '../../../config/gapdeskConfig'
import { GAP_OPEN_DETAIL_KEY, useGapDesk } from '../../../composables/useGapDesk'
import type { GapInd } from '../../../types/gapdesk'

const {
  ranked,
  tierCounts,
  byIndustry,
  lagMedianHours,
  dailyBriefText,
  supplyByDay,
  favorites,
  laterIds,
  toggleLater,
  toggleFavoriteEvent
} = useGapDesk()
const openDetail = inject(GAP_OPEN_DETAIL_KEY, (_id: number) => {})

const heroItems = computed(() => [
  { label: 'L0 · 今日必看', n: tierCounts.value.L0, d: '池内前 10%', grad: true },
  { label: 'L1 · 值得看', n: tierCounts.value.L1, d: '池内 10–40%', grad: false },
  { label: '兑现率', n: '—', d: EMPTY_ECHO, grad: false },
  {
    label: '时差中位（小时）',
    n: lagMedianHours.value === null ? '—' : lagMedianHours.value,
    d: '取中位，避免长尾带偏 · ' + GAP_LAG_NOTE,
    grad: false
  }
])

const l0List = computed(() => ranked.value.filter((item) => item.tier === 'L0'))
const chartValues = computed(() => supplyByDay.value.map((row) => row.count))
const chartLabels = computed(() => supplyByDay.value.map((row) => row.label))
const lastDay = computed(() => supplyByDay.value[supplyByDay.value.length - 1] ?? null)

const topInds = computed(() =>
  GAP_IND.map((ind: { key: GapInd; label: string }) => ({
    key: ind.key,
    label: GAP_IND_MAP[ind.key]?.label ?? ind.label,
    count: byIndustry.value[ind.key]?.length ?? 0
  }))
    .filter((row) => row.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)
)
</script>

<style scoped>
.brief-text {
  white-space: pre-line;
}
.gd-null-line {
  display: block;
  width: 100%;
  height: 36px;
}
.gd-null-line line {
  stroke: var(--gd-line2);
  stroke-width: 1;
  stroke-dasharray: 4 4;
}
</style>
