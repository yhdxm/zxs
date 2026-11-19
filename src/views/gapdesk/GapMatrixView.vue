<!--
  矩阵视图（行业 × 维度热力 + 两张副榜）
  ---------------------------------------------------------------
  数据来源：useGapDesk() 的 `matrix`（8×8 聚合，空格为 null）、`pool`（下钻列表）、
           `meta.cut`（外溢临界切点，来自采集侧写入的 insP75 / pubP25）。
  ⚠️ 切点绝不硬编码：它们是按当前池分位算出来的，
     硬编码 70/25 这种数字会在数据分布变化后让「临界榜」变成假榜。
-->
<template>
  <div class="gmv">
    <GapEmptyState
      v-if="!pool.length"
      type="empty"
      desc="当前筛选下池内为空，矩阵没有可聚合的事件"
    />

    <template v-else>
      <!-- 热力网格 -->
      <GapMatrixGrid
        :cells="flatCells"
        :inds="indAxis"
        :dims="dimAxis"
        :picked-ind="picked.ind"
        :picked-dim="picked.dim"
        @pick="onPick"
      />
      <p class="gmv-hint">
        「待采」= 该行业 × 维度当前没有事件（不是 0 分，是没测到）。点击任意格子可下钻。
      </p>

      <!-- 下钻列表 -->
      <section v-if="picked.ind" class="gmv-drill">
        <div class="gmv-drill-head">
          <h3 class="gmv-h3">{{ pickedLabel }}</h3>
          <span class="gmv-h3-note">{{ pickedEvents.length }} 条</span>
          <el-button size="small" text @click="clearPick">收起</el-button>
        </div>
        <GapEmptyState
          v-if="!pickedEvents.length"
          type="empty"
          title="该格当前没有事件"
          desc="空格不是 0 分：说明这个行业 × 维度组合还没有信源覆盖到"
        />
        <div v-else class="gmv-cards">
          <GapEventCard
            v-for="e in pickedEvents"
            :key="e.id"
            :event="e"
            :favorite="isFavorite(e.id)"
            @open="(id: number) => emit('open', id)"
            @favorite="(id: number) => toggleFavoriteEvent(id)"
          />
        </div>
      </section>

      <!-- 两张副榜 -->
      <div class="gmv-boards">
        <section class="gmv-board">
          <div class="gmv-board-head">
            <h3 class="gmv-h3">外溢临界</h3>
            <span class="gmv-h3-note">决策圈 ≥ {{ cut.insP75 }} 且 大众 ≤ {{ cut.pubP25 }}</span>
          </div>
          <p v-if="!cutReady" class="gmv-board-tip">采集侧尚未写入切点（meta.cut），下一轮采集后出现</p>
          <GapEmptyState
            v-else-if="!edgeList.length"
            type="empty"
            title="当前没有处在临界的事件"
            desc="所有事件的决策圈/大众热度都同一侧，说明这一轮没有「刚要出圈」的样本"
          />
          <ul v-else class="gmv-rank">
            <li v-for="e in edgeList" :key="e.id">
              <button type="button" class="gmv-rank-item" @click="emit('open', e.id)">
                <span class="gmv-rank-gap">{{ e.gap }}</span>
                <span class="gmv-rank-title">{{ e.title }}</span>
                <span class="gmv-rank-meta">决 {{ e.ins_heat ?? 0 }} / 众 {{ e.pub_heat ?? 0 }}</span>
              </button>
            </li>
          </ul>
        </section>

        <section class="gmv-board">
          <div class="gmv-board-head">
            <h3 class="gmv-h3">时差最宽</h3>
            <span class="gmv-h3-note">lag_h 降序前 5</span>
          </div>
          <GapEmptyState
            v-if="!lagList.length"
            type="empty"
            title="还没有可比较的时差"
            desc="时差需要同一事件的多个源都有发布时间；单源事件算不出时差"
          />
          <ul v-else class="gmv-rank">
            <li v-for="e in lagList" :key="e.id">
              <button type="button" class="gmv-rank-item" @click="emit('open', e.id)">
                <span class="gmv-rank-gap">{{ e.gap }}</span>
                <span class="gmv-rank-title">{{ e.title }}</span>
                <span class="gmv-rank-meta">{{ (e.lag_h ?? 0).toFixed(1) }}h</span>
              </button>
            </li>
          </ul>
        </section>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import GapMatrixGrid from '../../components/gapdesk/GapMatrixGrid.vue'
import GapEventCard from '../../components/gapdesk/GapEventCard.vue'
import GapEmptyState from '../../components/gapdesk/GapEmptyState.vue'
import { GAP_DIM, GAP_IND } from '../../config/gapdeskConfig'
import { useGapDesk } from '../../composables/useGapDesk'
import type { GapDim, GapInd } from '../../types/gapdesk'

const emit = defineEmits<{ (e: 'open', eventId: number): void }>()

const { pool, matrix, meta, isFavorite, toggleFavoriteEvent } = useGapDesk()

/* ---------- 网格 ---------- */
const indAxis = GAP_IND.map((i) => ({ key: i.key, label: i.label, color: i.color }))
const dimAxis = GAP_DIM.map((d) => ({ key: d.key, label: d.label }))

/** 8×8 二维矩阵 → 扁平 key 表（组件只认 `ind|dim`，不认二维结构） */
const flatCells = computed(() => {
  const flat: Record<string, { maxGap: number; count: number } | null> = {}
  for (const i of GAP_IND) {
    for (const d of GAP_DIM) {
      flat[`${i.key}|${d.key}`] = matrix.value[i.key]?.[d.key] ?? null
    }
  }
  return flat
})

const picked = ref<{ ind: string; dim: string }>({ ind: '', dim: '' })

function onPick(ind: string, dim: string): void {
  // 再点同一格 = 收起
  if (picked.value.ind === ind && picked.value.dim === dim) {
    picked.value = { ind: '', dim: '' }
    return
  }
  picked.value = { ind, dim }
}

function clearPick(): void {
  picked.value = { ind: '', dim: '' }
}

const pickedLabel = computed(() => {
  if (!picked.value.ind) return ''
  const i = GAP_IND.find((x) => x.key === picked.value.ind)
  const d = GAP_DIM.find((x) => x.key === picked.value.dim)
  return `${i?.label ?? picked.value.ind} × ${d?.label ?? picked.value.dim}`
})

const pickedEvents = computed(() => {
  const { ind, dim } = picked.value
  if (!ind) return []
  return pool.value
    .filter((e) => e.ind === (ind as GapInd) && e.dim === (dim as GapDim))
    .sort((a, b) => b.gap - a.gap)
})

/* ---------- 副榜 ---------- */
const cut = computed(() => ({
  insP75: meta.value?.cut?.insP75 ?? 0,
  pubP25: meta.value?.cut?.pubP25 ?? 0
}))
const cutReady = computed(() => cut.value.insP75 > 0 || cut.value.pubP25 > 0)

const edgeList = computed(() => {
  if (!cutReady.value) return []
  return pool.value
    .filter((e) => (e.ins_heat ?? 0) >= cut.value.insP75 && (e.pub_heat ?? 0) <= cut.value.pubP25)
    .sort((a, b) => b.gap - a.gap)
    .slice(0, 8)
})

const lagList = computed(() =>
  pool.value
    .filter((e) => (e.lag_h ?? 0) > 0)
    .sort((a, b) => (b.lag_h ?? 0) - (a.lag_h ?? 0))
    .slice(0, 5)
)
</script>

<style scoped>
.gmv {
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-width: 0;
}
.gmv-hint {
  margin: 0;
  font-size: 11px;
  line-height: 1.6;
  color: var(--text-muted, #909399);
}
.gmv-drill,
.gmv-board {
  padding: 12px 14px;
  background: var(--surface, #fff);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 10px;
  min-width: 0;
}
.gmv-drill-head,
.gmv-board-head {
  display: flex;
  align-items: baseline;
  gap: 8px;
  margin-bottom: 8px;
}
.gmv-h3 {
  margin: 0;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-strong, #303133);
}
.gmv-h3-note {
  font-size: 10px;
  color: var(--text-muted, #909399);
  font-variant-numeric: tabular-nums;
}
.gmv-cards {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 10px;
}
.gmv-boards {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}
.gmv-board-tip {
  margin: 0;
  font-size: 11px;
  color: var(--text-muted, #909399);
}
.gmv-rank {
  margin: 0;
  padding: 0;
  list-style: none;
}
.gmv-rank-item {
  display: flex;
  align-items: baseline;
  gap: 8px;
  width: 100%;
  min-height: 44px;
  padding: 6px 2px;
  border: none;
  border-bottom: 1px dashed var(--el-border-color-lighter);
  background: none;
  text-align: left;
  cursor: pointer;
  min-width: 0;
}
.gmv-rank-item:hover .gmv-rank-title {
  color: var(--el-color-primary);
}
.gmv-rank-gap {
  flex: none;
  width: 22px;
  font-size: 13px;
  font-weight: 700;
  color: #ff3358;
  font-variant-numeric: tabular-nums;
}
.gmv-rank-title {
  flex: 1;
  min-width: 0;
  font-size: 12px;
  color: var(--text-strong, #303133);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.gmv-rank-meta {
  flex: none;
  font-size: 11px;
  color: var(--text-muted, #909399);
  font-variant-numeric: tabular-nums;
}
@media (max-width: 768px) {
  .gmv-boards {
    grid-template-columns: minmax(0, 1fr);
  }
  .gmv-cards {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
