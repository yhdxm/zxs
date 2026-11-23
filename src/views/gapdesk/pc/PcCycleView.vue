<!--
  PC 周期视图（侧栏 13）：日 / 周 / 月切换。
  供给与行业结构读真值；跨天历史没有快照就留空并写 EMPTY_HISTORY，不做假趋势。
  当月热力日历的灰格表示系统尚未运行（无数据），不是 0 信号。
-->
<template>
  <div class="pcview">
    <div class="row1">
      <button
        v-for="g in GRANS"
        :key="g.key"
        type="button"
        class="pctl gran"
        :class="{ on: gran === g.key }"
        @click="gran = g.key"
      >
        {{ g.label }}
      </button>
      <span class="gd-mono gran-note">{{ chartRows.length }} 个{{ granLabel }}</span>
    </div>

    <section class="panel">
      <div class="gh">
        <i class="bar" aria-hidden="true" />
        <span class="t">供给柱图 · {{ granLabel }}</span>
      </div>
      <template v-if="!emptyText">
        <GapBarChart :values="chartValues" :labels="chartLabels" />
        <p class="panel-note gd-mono">
          {{ chartRows[0]?.label ?? '—' }} → {{ chartRows[chartRows.length - 1]?.label ?? '—' }}
        </p>
      </template>
      <GapEmptyState v-else type="empty" :desc="emptyText" />
    </section>

    <section class="panel">
      <div class="gh">
        <i class="bar" aria-hidden="true" />
        <span class="t">当月热力日历</span>
        <span class="r gd-mono">{{ calendar.year }}-{{ String(calendar.month + 1).padStart(2, '0') }}</span>
      </div>
      <div class="cal-week">
        <span v-for="w in WEEKDAYS" :key="w">{{ w }}</span>
      </div>
      <div class="cal-grid">
        <span v-for="n in calendar.lead" :key="`lead-${n}`" class="cal-cell cal-blank" />
        <span
          v-for="cell in calendar.cells"
          :key="`day-${cell.day}`"
          class="cal-cell gd-mono"
          :class="cell.has ? 'cal-has' : 'cal-none'"
          :style="cell.has ? { background: cellColor(cell.count) } : {}"
          :title="cell.has ? `${cell.day} 日 ${cell.count} 条（真实供给）` : '系统尚未运行，无数据（非零信号）'"
        >{{ cell.day }}</span>
      </div>
      <p class="panel-note">灰底 = 系统尚未运行，无数据（非零信号）；有色深浅来自当日真实供给条数。</p>
    </section>

    <section class="panel">
      <div class="gh">
        <i class="bar" aria-hidden="true" />
        <span class="t">周期结论</span>
        <span class="r">不做假趋势</span>
      </div>
      <div v-for="row in conclusions" :key="row.label" class="rowline">
        <span>{{ row.label }}</span>
        <span class="v">{{ row.text }}</span>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import GapBarChart from '../../../components/gapdesk/GapBarChart.vue'
import GapEmptyState from '../../../components/gapdesk/GapEmptyState.vue'
import { EMPTY_ECHO, EMPTY_GENERIC, EMPTY_HISTORY, EMPTY_SUPPLY, EMPTY_WAIT, GAP_IND, GAP_IND_MAP } from '../../../config/gapdeskConfig'
import { useGapDesk } from '../../../composables/useGapDesk'
import type { GapInd, SupplyDayRow } from '../../../types/gapdesk'

type Gran = 'day' | 'week' | 'month'
const GRANS: ReadonlyArray<{ key: Gran; label: string }> = [
  { key: 'day', label: '日' },
  { key: 'week', label: '周' },
  { key: 'month', label: '月' }
]
const WEEKDAYS = ['一', '二', '三', '四', '五', '六', '日'] as const

const { supplyByDay, byIndustry, lagMedianDays } = useGapDesk()
const gran = ref<Gran>('day')

function keyOf(ts: number): string {
  const d = new Date(ts)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** 周/月只是把真实日点聚合，缺日不补 0、缺周期不补假历史 */
const chartRows = computed<SupplyDayRow[]>(() => {
  if (gran.value === 'day') return supplyByDay.value
  const buckets = new Map<string, SupplyDayRow>()
  for (const row of supplyByDay.value) {
    const d = new Date(`${row.key}T00:00:00`)
    let key: string
    let label: string
    if (gran.value === 'month') {
      key = row.key.slice(0, 7)
      label = key
    } else {
      const weekday = d.getDay() || 7
      d.setDate(d.getDate() - weekday + 1)
      key = keyOf(d.getTime())
      label = `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}周`
    }
    let bucket = buckets.get(key)
    if (!bucket) {
      bucket = { key, label, count: 0, l0: 0, l1: 0, l2: 0 }
      buckets.set(key, bucket)
    }
    bucket.count += row.count
    bucket.l0 += row.l0
    bucket.l1 += row.l1
    bucket.l2 += row.l2
  }
  return [...buckets.values()].sort((a, b) => a.key.localeCompare(b.key))
})

const granLabel = computed<string>(() => GRANS.find((g) => g.key === gran.value)?.label ?? '日')
const chartValues = computed(() => chartRows.value.map((row) => row.count))
const chartLabels = computed(() => chartRows.value.map((row) => row.label))
const emptyText = computed<string>(() => {
  if (gran.value === 'day') return supplyByDay.value.length <= 1 ? EMPTY_SUPPLY : ''
  return chartRows.value.length <= 1 ? EMPTY_HISTORY : ''
})

const calendar = computed(() => {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth()
  const lead = (new Date(year, month, 1).getDay() + 6) % 7
  const total = new Date(year, month + 1, 0).getDate()
  const byDay = new Map<number, SupplyDayRow>()
  for (const row of supplyByDay.value) {
    const d = new Date(`${row.key}T00:00:00`)
    if (d.getFullYear() === year && d.getMonth() === month) byDay.set(d.getDate(), row)
  }
  return {
    year,
    month,
    lead,
    cells: Array.from({ length: total }, (_, i) => {
      const day = i + 1
      const hit = byDay.get(day) ?? null
      return { day, count: hit?.count ?? 0, has: hit !== null }
    })
  }
})

function cellColor(count: number): string {
  const pct = Math.min(82, 14 + count * 16)
  return `color-mix(in srgb, var(--gd-brand) ${pct}%, var(--gd-card))`
}

const conclusions = computed(() => {
  const active = GAP_IND.map((ind: { key: GapInd; label: string }) => ({
    label: GAP_IND_MAP[ind.key]?.label ?? ind.label,
    count: byIndustry.value[ind.key]?.length ?? 0
  }))
    .filter((row) => row.count > 0)
    .sort((a, b) => b.count - a.count)[0]
  const first = supplyByDay.value[0]
  const last = supplyByDay.value[supplyByDay.value.length - 1]
  return [
    { label: '行业结构', text: active ? `${active.label} ${active.count} 条` : EMPTY_GENERIC },
    { label: '时差结构', text: lagMedianDays.value === null ? EMPTY_WAIT : `${lagMedianDays.value} 天` },
    { label: '回打进度', text: EMPTY_ECHO },
    {
      label: '供给跨度',
      text: first && last && first.key !== last.key
        ? `${first.label} → ${last.label}（${supplyByDay.value.length} 个日点）`
        : EMPTY_SUPPLY
    }
  ]
})
</script>

<style scoped>
.gran {
  min-height: 30px;
  cursor: pointer;
}
.gran.on {
  border-color: var(--gd-brand);
  color: var(--gd-brand);
  background: color-mix(in srgb, var(--gd-brand) 8%, var(--gd-card));
}
.gran-note {
  margin-left: auto;
  font-size: var(--gd-fs-panels);
  color: var(--gd-ink3);
}
.cal-week,
.cal-grid {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 4px;
}
.cal-week {
  font-size: var(--gd-fs-kick);
  color: var(--gd-ink3);
  text-align: center;
}
.cal-cell {
  display: flex;
  align-items: center;
  justify-content: center;
  aspect-ratio: 1;
  border-radius: var(--gd-r-nav);
  font-size: var(--gd-fs-pill);
  color: var(--gd-ink2);
}
.cal-blank {
  background: transparent;
}
.cal-none {
  background: var(--gd-sub);
  border: 1px solid var(--gd-line);
  color: var(--gd-ink3);
}
.cal-has {
  color: var(--gd-ink);
  font-weight: 700;
}
</style>
