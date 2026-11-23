<!--
  PC-01 最新信息
  数据来源：store 的 ranked / tierCounts / lagMedianDays / filters.dateBand。
  日期带与筛选由外壳统一提供，这里只画 Hero 五卡 + 三段信息流。
-->
<template>
  <div class="pcview">
    <div class="hero">
      <div class="hcard"><span class="n grad">{{ tierCounts.L0 }}</span><span class="l">L0 · 今日必看</span><span class="d">池内前 10%</span></div>
      <div class="hcard"><span class="n">{{ tierCounts.L1 }}</span><span class="l">L1 · 值得看</span><span class="d">池内 10–40%</span></div>
      <div class="hcard"><span class="n">{{ tierCounts.L2 }}</span><span class="l">L2 · 存档</span><span class="d">不推送、不计入今日差值</span></div>
      <div class="hcard"><span class="n">—</span><span class="l">兑现率</span><span class="d">{{ EMPTY_ECHO }}</span></div>
      <div class="hcard"><span class="n gr2">{{ lagMedianDays === null ? '—' : lagMedianDays }}</span><span class="l">时差中位（天）</span><span class="d">取中位，避免长尾带偏</span></div>
    </div>

    <GapEmptyState v-if="!ranked.length" type="empty" />

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
          :favorite="favorites.includes(item.id)"
          :later="laterIds.includes(item.id)"
          @open="openDetail"
          @later="toggleLater"
          @like="toggleFavoriteEvent"
        />
      </template>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, inject } from 'vue'
import GapEmptyState from '../../../components/gapdesk/GapEmptyState.vue'
import GapEventCard from '../../../components/gapdesk/GapEventCard.vue'
import { EMPTY_ECHO } from '../../../config/gapdeskConfig'
import { GAP_OPEN_DETAIL_KEY, useGapDesk } from '../../../composables/useGapDesk'
import type { GapEventRow } from '../../../types/gapdesk'

const { ranked, tierCounts, lagMedianDays, filters, favorites, laterIds, toggleLater, toggleFavoriteEvent } = useGapDesk()
const openDetail = inject(GAP_OPEN_DETAIL_KEY, (_id: number) => {})

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

const eventsOf = computed(() => (key: string) =>
  ranked.value.filter(
    (event) => inSection(event, key) && (!filters.dateBand || filters.dateBand === bandKeyOf(event))
  )
)
</script>
