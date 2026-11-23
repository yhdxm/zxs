<!--
  PC-03 按行业时间线
  数据来源：store.ranked（真实 ts_published / gap / ind），归日口径与 dateBands 一致。
  没有可归日事件时给空态，不用写死时间线样例。
-->
<template>
  <div class="pcview">
    <div class="gh">
      <i class="bar" aria-hidden="true" />
      <span class="t">按发布日归组的差值时间线</span>
      <span class="b">{{ days.length }}</span>
      <span class="r">{{ ranked.length }} 条 · 点击标题查看详情</span>
    </div>

    <div class="tlbar">
      <label class="row1">
        <span class="lbl">行业</span>
        <select v-model="indFilter" class="pctl">
          <option value="">全部行业</option>
          <option v-for="ind in GAP_IND" :key="ind.key" :value="ind.key">{{ ind.label }}</option>
        </select>
      </label>
    </div>

    <GapEmptyState v-if="!days.length" type="empty" :desc="EMPTY_HISTORY" />

    <div v-else class="tl">
      <section v-for="day in days" :key="day.key" class="tli">
        <div class="tli-d gd-mono">{{ day.label }} <b>{{ day.items.length }} 条</b></div>
        <article v-for="item in day.items" :key="item.id" class="tli-item" @click="openDetail(item.id)">
          <div class="tli-title">{{ item.title }}</div>
          <div class="row1 tli-meta">
            <i class="dot" :style="{ background: indColor(item.ind) }" aria-hidden="true" />
            <span>{{ indLabel(item.ind) }}</span>
            <span class="gd-mono">GAP {{ item.gap }}</span>
            <span class="gd-mono">{{ item.tier }}</span>
          </div>
        </article>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, inject, ref } from 'vue'
import GapEmptyState from '../../../components/gapdesk/GapEmptyState.vue'
import { EMPTY_HISTORY, GAP_IND, GAP_IND_MAP } from '../../../config/gapdeskConfig'
import { GAP_OPEN_DETAIL_KEY, useGapDesk } from '../../../composables/useGapDesk'
import type { GapEventRow, GapInd, RankedEvent } from '../../../types/gapdesk'

const { ranked, filters } = useGapDesk()
const openDetail = inject(GAP_OPEN_DETAIL_KEY, (_id: number) => {})
const indFilter = ref<GapInd | ''>('')

const WEEK = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'] as const

function dayKeyOf(event: GapEventRow): string {
  if (!(event.ts_published > 0)) return '时间未知'
  const d = new Date(event.ts_published)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function labelOf(key: string): string {
  if (key === '时间未知') return key
  const [year, month, day] = key.split('-').map(Number)
  if (!year || !month || !day) return key
  const dt = new Date(year, month - 1, day)
  return `${month}-${String(day).padStart(2, '0')} ${WEEK[dt.getDay()] ?? ''}`
}

const indColor = (ind: GapInd): string => GAP_IND_MAP[ind]?.color ?? 'var(--gd-ink3)'
const indLabel = (ind: GapInd): string => GAP_IND_MAP[ind]?.label ?? '未分类'

/** 宿主日期胶囊的选择：live / today / YYYY-MM-DD / unknown，空值显示全部 */
function matchesBand(event: GapEventRow, band: string): boolean {
  if (!band) return true
  if (band === 'unknown') return !(event.ts_published > 0)
  if (!(event.ts_published > 0)) return false
  if (band === 'live') return Date.now() - event.ts_published < 3600_000
  if (band === 'today') {
    const d = new Date(event.ts_published)
    const today = new Date()
    return d.getFullYear() === today.getFullYear() && d.getMonth() === today.getMonth() && d.getDate() === today.getDate()
  }
  return dayKeyOf(event) === band
}

const days = computed(() => {
  const groups = new Map<string, RankedEvent[]>()
  for (const event of ranked.value) {
    if (indFilter.value && event.ind !== indFilter.value) continue
    if (!matchesBand(event, filters.dateBand)) continue
    const key = dayKeyOf(event)
    const list = groups.get(key) ?? []
    list.push(event)
    groups.set(key, list)
  }
  return [...groups.entries()]
    .sort((a, b) => (a[0] === '时间未知' ? 1 : b[0] === '时间未知' ? -1 : a[0] < b[0] ? 1 : -1))
    .map(([key, items]) => ({
      key,
      label: labelOf(key),
      items: [...items].sort((a, b) => b.gap - a.gap)
    }))
})
</script>

<style scoped>
.tlbar {
  display: flex;
  align-items: center;
  gap: 14px;
  flex-wrap: wrap;
  flex-shrink: 0;
}
.lbl {
  font-size: var(--gd-fs-panels);
  color: var(--gd-ink3);
}
.tl {
  position: relative;
  padding-left: 20px;
  min-width: 0;
}
.tl::before {
  content: '';
  position: absolute;
  left: 5px;
  top: 8px;
  bottom: 8px;
  width: 2px;
  background: var(--gd-grad);
  opacity: .35;
}
.tli {
  position: relative;
  margin-bottom: 16px;
  padding-left: 12px;
}
.tli::before {
  content: '';
  position: absolute;
  left: -19px;
  top: 4px;
  width: 11px;
  height: 11px;
  border-radius: 999px;
  background: var(--gd-card);
  border: 2.5px solid var(--gd-brand);
}
.tli-d {
  font-size: var(--gd-fs-panels);
  color: var(--gd-ink3);
  margin-bottom: 6px;
}
.tli-d b {
  margin-left: 6px;
  font-size: var(--gd-fs-pill);
  color: var(--gd-ink3);
  font-weight: 400;
}
.tli-item {
  margin-bottom: 8px;
  padding: 8px 10px;
  border: 1px solid var(--gd-line);
  border-radius: var(--gd-r-nav);
  background: var(--gd-card);
  cursor: pointer;
  transition: all .15s var(--gd-ease);
}
.tli-item:hover {
  border-color: var(--gd-brand);
  box-shadow: var(--gd-sh-sm);
}
.tli-title {
  font-size: var(--gd-fs-panels);
  font-weight: 600;
  color: var(--gd-ink);
  line-height: 1.5;
  overflow-wrap: anywhere;
}
.tli-meta {
  margin-top: 4px;
  font-size: var(--gd-fs-pill);
  color: var(--gd-ink3);
}
</style>
