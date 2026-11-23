<!--
  移动 m-cycle · 周期（只读二级页）
  日供给画真值柱图；当月灰格表示系统尚未运行（无数据），不是 0 信号；
  周/月没有快照就留空并写 EMPTY_HISTORY，不做假趋势。
-->
<template>
  <div class="mbview">
    <button type="button" class="back gd-mono" @click="emit('navigate', 'm-latest')">← 返回</button>

    <div class="p-sec"><div class="h">日供给 · {{ supplyByDay.length }} 个日点</div></div>
    <section class="p-card">
      <GapBarChart v-if="supplyByDay.length > 1" :values="values" :labels="labels" />
      <p v-else class="why">{{ EMPTY_SUPPLY }}</p>
    </section>

    <div class="p-sec"><div class="h">当月热力日历</div></div>
    <section class="p-card">
      <div class="cal">
        <span v-for="n in calendar.lead" :key="`l-${n}`" class="cell blank" />
        <span
          v-for="cell in calendar.cells"
          :key="`d-${cell.day}`"
          class="cell gd-mono"
          :class="cell.has ? 'has' : 'none'"
          :style="cell.has ? { background: cellColor(cell.count) } : {}"
          :title="cell.has ? `${cell.day} 日 ${cell.count} 条` : '系统尚未运行，无数据（非零信号）'"
        >{{ cell.day }}</span>
      </div>
      <p class="why">灰底 = 系统尚未运行，无数据（非零信号）；有色深浅来自当日真实供给条数。</p>
    </section>

    <div class="p-sec"><div class="h">周 / 月周期</div></div>
    <section class="p-card"><p class="why">{{ EMPTY_HISTORY }}</p></section>

    <section class="p-card">
      <div class="ttl">周期结论</div>
      <p class="why">供给与行业结构按真值展示；回打进度：{{ EMPTY_ECHO }}。不做假趋势。</p>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import GapBarChart from '../../../components/gapdesk/GapBarChart.vue'
import { EMPTY_ECHO, EMPTY_HISTORY, EMPTY_SUPPLY } from '../../../config/gapdeskConfig'
import { useGapDesk } from '../../../composables/useGapDesk'
import type { SupplyDayRow } from '../../../types/gapdesk'

const { supplyByDay } = useGapDesk()
const emit = defineEmits<{ navigate: [key: string] }>()
const values = computed(() => supplyByDay.value.map((row: SupplyDayRow) => row.count))
const labels = computed(() => supplyByDay.value.map((row: SupplyDayRow) => row.label))

const WEEKDAYS = 7
const calendar = computed(() => {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth()
  const lead = (new Date(year, month, 1).getDay() + WEEKDAYS - 1) % WEEKDAYS
  const total = new Date(year, month + 1, 0).getDate()
  const byDay = new Map<number, number>()
  for (const row of supplyByDay.value) {
    const d = new Date(`${row.key}T00:00:00`)
    if (d.getFullYear() === year && d.getMonth() === month) byDay.set(d.getDate(), row.count)
  }
  return {
    lead,
    cells: Array.from({ length: total }, (_, i) => {
      const day = i + 1
      return { day, count: byDay.get(day) ?? 0, has: byDay.has(day) }
    })
  }
})

function cellColor(count: number): string {
  const pct = Math.min(82, 14 + count * 16)
  return `color-mix(in srgb, var(--gd-brand) ${pct}%, var(--gd-card))`
}
</script>

<style scoped>
.mbview {
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-width: 0;
}
.back {
  align-self: flex-start;
  min-height: 44px;
  padding: 0 12px;
  border: 1px solid var(--gd-line);
  border-radius: var(--gd-r-nav);
  background: var(--gd-card);
  color: var(--gd-ink2);
  font-size: var(--gd-fs-panels);
  cursor: pointer;
}
.cal {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 4px;
}
.cell {
  min-width: 0;
  aspect-ratio: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--gd-r-nav);
  font-size: var(--gd-fs-pill);
  color: var(--gd-ink3);
}
.blank {
  background: transparent;
}
.none {
  background: var(--gd-sub);
  border: 1px solid var(--gd-line);
}
.has {
  color: var(--gd-ink);
  font-weight: 700;
}
</style>
