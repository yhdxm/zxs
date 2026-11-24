<!--
  PC-01 最新信息
  数据来源：store 的 top14 / ranked / tierCounts / lagMedianHours / filters.dateBand。
  14 条硬上限作用在「筛选后的集合」上：选具体日期时在该日期池内重新取前 14，
  不是「全池取 14 再筛日期」——后者在昨天事件排 14 名开外时会筛成空列表。
  日期带与筛选由外壳统一提供。首屏是事件流，Hero 五卡放列表末尾（统计不该挡住「差」）。
-->
<template>
  <div class="pcview">
    <!-- 首屏第一眼必须是事件卡，不是统计：Hero 五卡移到列表末尾 -->
    <GapEmptyState v-if="!displayList.length" type="empty" :desc="EMPTY_WINDOW" />

    <template v-else v-for="section in sections" :key="section.key">
      <template v-if="eventsOf(section.key).length">
        <div class="gh">
          <i class="bar" aria-hidden="true" />
          <span class="t">{{ section.label }}</span>
          <span class="b" :class="{ l0: section.key === 'live' }">{{ eventsOf(section.key).length }}</span>
        </div>
        <GapEventCard
          v-for="item in eventsOf(section.key)"
          :key="item.id"
          :event="item"
          :source="sourceOf(item.id)"
          :favorite="favorites.includes(item.id)"
          :later="laterIds.includes(item.id)"
          @open="openDetail"
          @later="toggleLater"
          @like="toggleFavoriteEvent"
        />
      </template>
    </template>

    <div class="hero">
      <div class="hcard"><span class="n grad">{{ tierCounts.L0 }}</span><span class="l">L0 · 今日必看</span><span class="d">池内前 10%</span></div>
      <div class="hcard"><span class="n">{{ tierCounts.L1 }}</span><span class="l">L1 · 值得看</span><span class="d">池内 10–40%</span></div>
      <div class="hcard"><span class="n">{{ tierCounts.L2 }}</span><span class="l">L2 · 存档</span><span class="d">不推送、不计入今日差值</span></div>
      <div class="hcard"><span class="n">—</span><span class="l">兑现率</span><span class="d">{{ EMPTY_ECHO }}</span></div>
      <div class="hcard"><span class="n gr2">{{ lagMedianHours === null ? '—' : lagMedianHours }}</span><span class="l">时差中位（小时）</span><span class="d">取中位，避免长尾带偏</span></div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, inject } from 'vue'
import GapEmptyState from '../../../components/gapdesk/GapEmptyState.vue'
import GapEventCard from '../../../components/gapdesk/GapEventCard.vue'
import { EMPTY_ECHO, EMPTY_WINDOW } from '../../../config/gapdeskConfig'
import { GAP_OPEN_DETAIL_KEY, useGapDesk } from '../../../composables/useGapDesk'
import type { GapEventRow, RankedEvent } from '../../../types/gapdesk'

// ranked 是有意保留的：选了具体日期时要在该日期池内重新取前 14，不能只靠 top14
const { ranked, top14, tierCounts, lagMedianHours, filters, favorites, laterIds, toggleLater, toggleFavoriteEvent, firstSourceOf } = useGapDesk()
const openDetail = inject(GAP_OPEN_DETAIL_KEY, (_id: number) => {})

/** 卡片要的是 {name,url}；没有来源名就返回 null，卡片不占位也不编造 */
const sourceMap = computed<Map<number, { name: string; url: string | null }>>(() => {
  const map = new Map<number, { name: string; url: string | null }>()
  for (const item of displayList.value) {
    const row = firstSourceOf.value(item.id)
    if (row?.source_name) map.set(item.id, { name: row.source_name, url: row.url })
  }
  return map
})
function sourceOf(id: number): { name: string; url: string | null } | null {
  return sourceMap.value.get(id) ?? null
}

/** 与 store.dateBands 同一归日口径：live / today / YYYY-MM-DD / unknown */
function bandKeyOf(event: GapEventRow): string {
  if (!(event.ts_published > 0)) return 'unknown'
  const now = Date.now()
  if (now - event.ts_published < 3600_000) return 'live'
  const d = new Date(event.ts_published)
  const today = new Date()
  const sameDay = d.getFullYear() === today.getFullYear() && d.getMonth() === today.getMonth() && d.getDate() === today.getDate()
  if (sameDay) return 'today'
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function inSection(event: GapEventRow, key: string): boolean {
  const band = bandKeyOf(event)
  if (key === 'date') return band !== 'live' && band !== 'today' && band !== 'unknown'
  return band === key
}

const sections = [
  { key: 'live', label: '1 小时内' },
  { key: 'today', label: '今天更早' },
  { key: 'date', label: '更早' },
  { key: 'unknown', label: '时间未知' }
] as const

/**
 * 展示集合：14 条硬上限作用在「筛选后的集合」上。
 * 无日期筛选 = 今日前 14；选了具体日期 = 该日期池内重新取前 14。
 * 先全池取 14 再筛日期，会在「昨天事件排在 14 名开外」时筛成空列表。
 */
const displayList = computed<RankedEvent[]>(() => {
  if (!filters.dateBand) return top14.value
  return ranked.value.filter((event) => bandKeyOf(event) === filters.dateBand).slice(0, 14)
})

/** 分段只做分流，日期筛选已经在 displayList 里做完了 */
const eventsOf = computed(() => (key: string) =>
  displayList.value.filter((event) => inSection(event, key))
)
</script>
