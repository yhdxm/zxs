<!--
  PC-13 日历与归档
  月历热力来自 events 的真实 ts_published；系统运行前 / 超 48h 的日期灰底，
  并注明 EMPTY_ARCHIVE —— 那是「无数据」，不是「零信号」。
-->
<template>
  <div class="pcview">
    <div class="searchbar">
      <span aria-hidden="true">⌕</span>
      <span>搜索归档：关键词 / 行业 / 信源 / 时间</span>
      <span class="gd-pill gd-pill-soft gd-mono" :title="EMPTY_EXPORT">{{ EMPTY_EXPORT }}</span>
      <input class="pctl" type="search" disabled :placeholder="EMPTY_EXPORT" :aria-label="EMPTY_EXPORT" />
    </div>

    <div class="archive-grid">
      <section class="panel">
        <h4 class="gd-mono">{{ year }} / {{ String(month + 1).padStart(2, '0') }}</h4>
        <p class="sub">深色 = 当日有差值 · 灰底 = 系统当时尚未运行或已超 48h（不是「零信号」）· 点击切换日期</p>
        <div class="calgrid">
          <span v-for="label in WEEK" :key="label" class="w">{{ label }}</span>
          <template v-for="cell in cells" :key="cell.key">
            <i v-if="!cell.day" class="cd blank" aria-hidden="true" />
            <button
              v-else
              type="button"
              class="cd"
              :class="{ on: cell.day === selectedDay, before: cell.before, busy: cell.count > 0 }"
              :title="cell.before ? EMPTY_ARCHIVE : cell.count ? `${cell.count} 条` : '该日无达标差值'"
              @click="selectedDay = cell.day"
            >
              {{ cell.day }}
              <b v-if="cell.count" class="gd-mono">{{ cell.count }}</b>
            </button>
          </template>
        </div>
        <p class="panel-note">
          当前可统计 {{ activeDays }} 个发布日有差值产出。空档日与运行前的空白已如实区分 ——
          {{ EMPTY_ARCHIVE }}。
        </p>
      </section>

      <section class="panel">
        <div class="gh">
          <i class="bar" aria-hidden="true" />
          <span class="t gd-mono">{{ selectedKey }} 归档</span>
          <span class="b">{{ dayEvents.length }}</span>
        </div>
        <GapEmptyState v-if="!dayEvents.length" type="empty" :desc="isBefore ? EMPTY_ARCHIVE : EMPTY_HISTORY" />
        <GapEventCard
          v-for="item in dayEvents"
          :key="item.id"
          :event="item"
          :favorite="favorites.includes(item.id)"
          :later="laterIds.includes(item.id)"
          @open="openDetail"
          @later="toggleLater"
          @like="toggleFavoriteEvent"
        />
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, inject, ref } from 'vue'
import GapEmptyState from '../../../components/gapdesk/GapEmptyState.vue'
import GapEventCard from '../../../components/gapdesk/GapEventCard.vue'
import { EMPTY_ARCHIVE, EMPTY_EXPORT, EMPTY_HISTORY } from '../../../config/gapdeskConfig'
import { GAP_OPEN_DETAIL_KEY, useGapDesk } from '../../../composables/useGapDesk'
import type { GapEventRow } from '../../../types/gapdesk'

const { events, favorites, laterIds, toggleLater, toggleFavoriteEvent } = useGapDesk()
const openDetail = inject(GAP_OPEN_DETAIL_KEY, (_id: number) => {})

const WEEK = ['一', '二', '三', '四', '五', '六', '日'] as const
const now = new Date()
const year = now.getFullYear()
const month = now.getMonth()
const today = now.getDate()
const selectedDay = ref(today)

function keyOf(day: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}
function dayKeyOf(event: GapEventRow): string {
  const d = new Date(event.ts_published)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const earliest = computed(() => {
  const times = events.value.filter((e) => e.ts_published > 0).map((e) => e.ts_published)
  return times.length ? Math.min(...times) : null
})

const byDay = computed(() => {
  const map = new Map<string, GapEventRow[]>()
  for (const event of events.value) {
    if (!(event.ts_published > 0)) continue
    const key = dayKeyOf(event)
    const list = map.get(key) ?? []
    list.push(event)
    map.set(key, list)
  }
  return map
})

const cells = computed(() => {
  const out: Array<{ key: string; day: number; count: number; before: boolean }> = []
  const lead = (new Date(year, month, 1).getDay() + 6) % 7
  for (let i = 0; i < lead; i++) out.push({ key: `blank-${i}`, day: 0, count: 0, before: false })
  const start = earliest.value == null ? null : new Date(earliest.value).setHours(0, 0, 0, 0)
  const dim = new Date(year, month + 1, 0).getDate()
  for (let day = 1; day <= dim; day++) {
    const key = keyOf(day)
    const dayStart = new Date(year, month, day).getTime()
    // 系统运行前，或超过 48h 保留窗口 → 灰底无数据，不显示 0
    const expired = now.getTime() - dayStart > 48 * 3600_000
    const before = start == null || dayStart < start || expired
    out.push({ key, day, count: before ? 0 : (byDay.value.get(key)?.length ?? 0), before })
  }
  return out
})

const activeDays = computed(() => {
  const limit = now.getTime() - 48 * 3600_000
  return [...byDay.value.keys()].filter((key) => Date.parse(`${key}T00:00:00`) >= limit).length
})

const selectedKey = computed(() => keyOf(selectedDay.value))
const isBefore = computed(() => cells.value.find((cell) => cell.key === selectedKey.value)?.before ?? true)
const dayEvents = computed(() => (byDay.value.get(selectedKey.value) ?? []).slice().sort((a, b) => b.gap - a.gap))
</script>

<style scoped>
.searchbar {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border: 1px solid var(--gd-line);
  border-radius: var(--gd-r-panel);
  background: var(--gd-card);
  color: var(--gd-ink3);
  font-size: var(--gd-fs-panels);
  flex-shrink: 0;
}
.archive-grid {
  display: grid;
  grid-template-columns: 1fr 1.15fr;
  gap: 12px;
  min-width: 0;
}
.calgrid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 5px;
}
.w {
  font-size: var(--gd-fs-panels);
  color: var(--gd-ink3);
  text-align: center;
  padding-bottom: 4px;
}
.cd {
  aspect-ratio: 1;
  border: 1px solid transparent;
  border-radius: var(--gd-r-nav);
  background: var(--gd-sub);
  color: var(--gd-ink2);
  font-family: var(--gd-mono);
  font-size: var(--gd-fs-panels);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  cursor: pointer;
}
.cd.blank {
  visibility: hidden;
}
.cd.before {
  background: var(--gd-line);
  color: var(--gd-ink3);
}
.cd.busy {
  background: color-mix(in srgb, var(--gd-brand) 26%, var(--gd-card));
}
.cd.on {
  background: var(--gd-grad);
  color: var(--gd-card);
  font-weight: 700;
}
.cd b {
  font-size: var(--gd-fs-pill);
  font-weight: 400;
}
@media (max-width: 1140px) {
  .archive-grid { grid-template-columns: 1fr; }
}
</style>
