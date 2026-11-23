<!--
  PC-04 全景矩阵（8 行业 × 展示六维）
  空格来自 matrix6 的 null，UI 标「待采」，绝不补 0；
  下方 TOP5 与「矩阵读法」全部由真实格子统计得出。
-->
<template>
  <div class="pcview">
    <div class="gh">
      <i class="bar" aria-hidden="true" />
      <span class="t">行业 × 信号维度</span>
      <span class="r">按事件池（{{ ranked.length }} 条）聚合 · 空格 = 该格实测 0 条，标「待采」不补 0</span>
    </div>

    <section class="panel">
      <GapMatrixGrid
        :cells="cells"
        :inds="GAP_IND"
        :dims="dims"
        :picked-ind="picked.ind"
        :picked-dim="picked.dim"
        @pick="onPick"
      />
      <div class="mxlegend">
        <span>低</span><span class="gradb" /><span>高</span>
        <span class="tip">{{ picked.ind ? `已选：${indLabel(picked.ind)} · ${dimLabel(picked.dim)} · ${selectedEvents.length} 条` : '点击任意格子查看明细' }}</span>
      </div>
    </section>

    <div v-if="picked.ind" class="gh">
      <i class="bar" aria-hidden="true" />
      <span class="t">{{ indLabel(picked.ind) }} · {{ dimLabel(picked.dim) }} 明细</span>
      <span class="b">{{ selectedEvents.length }}</span>
    </div>
    <GapEventCard
      v-for="item in selectedEvents"
      :key="item.id"
      :event="item"
      :favorite="favorites.includes(item.id)"
      :later="laterIds.includes(item.id)"
      @open="openDetail"
      @later="toggleLater"
      @like="toggleFavoriteEvent"
    />

    <div class="grid2">
      <section class="panel">
        <h4>矩阵读法</h4>
        <p class="sub">空格不是缺漏，是结论</p>
        <p class="panel-note">
          全表 {{ GAP_IND.length * dims.length }} 个「行业 × 维度」格中，实测 {{ emptyCount }} 个为 0 条，
          即这些交叉点当前没有公开源覆盖。它们被标为「待采」而不是填估计值 —— 填假数据会让这张图失去全部价值。
          <br /><br />覆盖最薄的交叉点：{{ emptySample || '无' }}。
        </p>
      </section>
      <section class="panel">
        <h4>最活跃交叉点 TOP5</h4>
        <p class="sub">峰值 GAP（实测条数见右侧）</p>
        <div v-for="row in top5" :key="`${row.key}|${row.dim}`" class="rowline">
          <i class="dot" :style="{ background: row.color }" aria-hidden="true" />
          <span>{{ row.ind }} · {{ row.dim }}</span>
          <span class="v">{{ row.maxGap }} <small>({{ row.count }} 条)</small></span>
        </div>
        <p v-if="!top5.length" class="panel-note">— {{ EMPTY_WAIT }}：当前没有可统计的交叉点。</p>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, inject, reactive } from 'vue'
import GapEventCard from '../../../components/gapdesk/GapEventCard.vue'
import GapMatrixGrid from '../../../components/gapdesk/GapMatrixGrid.vue'
import { EMPTY_WAIT, GAP_DIM6, GAP_DIM6_OF, GAP_IND, GAP_IND_MAP } from '../../../config/gapdeskConfig'
import { GAP_OPEN_DETAIL_KEY, useGapDesk } from '../../../composables/useGapDesk'
import type { GapDim6Key, GapInd, RankedEvent } from '../../../types/gapdesk'

const { matrix6, ranked, favorites, laterIds, toggleLater, toggleFavoriteEvent } = useGapDesk()
const openDetail = inject(GAP_OPEN_DETAIL_KEY, (_id: number) => {})

const dims = GAP_DIM6.map((d) => ({ key: d.key as string, label: d.label }))
const indLabel = (key: string): string => GAP_IND_MAP[key as GapInd]?.label ?? key
const dimLabel = (key: string): string => GAP_DIM6.find((d) => d.key === key)?.label ?? key

interface CellMap {
  [key: string]: { maxGap: number; count: number; topId: number } | null
}
const cells = computed<CellMap>(() => {
  const out: CellMap = {}
  for (const ind of GAP_IND) {
    for (const dim of GAP_DIM6) {
      out[`${ind.key}|${dim.key}`] = matrix6.value[ind.key]?.[dim.key] ?? null
    }
  }
  return out
})

const picked = reactive({ ind: '', dim: '' })
function onPick(ind: string, dim: string): void {
  if (picked.ind === ind && picked.dim === dim) {
    picked.ind = ''
    picked.dim = ''
    return
  }
  picked.ind = ind
  picked.dim = dim
}

const selectedEvents = computed<RankedEvent[]>(() => {
  if (!picked.ind || !picked.dim) return []
  const target = picked.dim as GapDim6Key
  return ranked.value.filter((e) => e.ind === picked.ind && GAP_DIM6_OF[e.dim] === target)
})

const emptyCount = computed(() => Object.values(cells.value).filter((cell) => !cell).length)
const emptySample = computed(() =>
  Object.entries(cells.value)
    .filter(([, cell]) => !cell)
    .slice(0, 4)
    .map(([key]) => {
      const [ind, dim] = key.split('|')
      return `${indLabel(ind ?? '')}·${dimLabel(dim ?? '')}`
    })
    .join('、')
)

const top5 = computed(() =>
  Object.entries(cells.value)
    .filter(([, cell]) => cell && cell.count > 0)
    .map(([key, cell]) => {
      const [ind, dim] = key.split('|')
      return {
        key,
        ind: indLabel(ind ?? ''),
        dim: dimLabel(dim ?? ''),
        color: GAP_IND_MAP[(ind ?? '') as GapInd]?.color ?? 'var(--gd-ink3)',
        maxGap: cell?.maxGap ?? 0,
        count: cell?.count ?? 0
      }
    })
    .sort((a, b) => b.maxGap - a.maxGap)
    .slice(0, 5)
)
</script>

<style scoped>
.mxlegend {
  display: flex;
  align-items: center;
  gap: 9px;
  margin-top: 12px;
  font-size: var(--gd-fs-panels);
  color: var(--gd-ink3);
}
.gradb {
  width: 120px;
  height: 8px;
  border-radius: 999px;
  background: var(--gd-grad2);
}
.tip {
  margin-left: 12px;
}
small {
  font-size: var(--gd-fs-pill);
  color: var(--gd-ink3);
}
</style>
