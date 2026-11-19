<!--
  行业 × 维度 热力网格（纯展示组件，不自己取数）
  ---------------------------------------------------------------
  一条硬规则：**空格显示「待采」，不显示 0**。
  0 是一个测量结果，空格是「没有测量」—— 把两者混为一谈，
  用户就会把「这块没源」误读成「这块没热度」，进而对整张表失去信任。
-->
<template>
  <div class="gmg-wrap">
    <table class="gmg">
      <thead>
        <tr>
          <th class="gmg-corner" scope="col">行业 \ 维度</th>
          <th v-for="d in dims" :key="d.key" scope="col" class="gmg-dim">{{ d.label }}</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="ind in inds" :key="ind.key">
          <th scope="row" class="gmg-ind">
            <i class="gmg-dot" :style="{ background: ind.color }" />
            <span class="gmg-ind-lb">{{ ind.label }}</span>
          </th>
          <td
            v-for="d in dims"
            :key="d.key"
            class="gmg-cell"
            :class="{ 'gmg-cell-empty': !cellOf(ind.key, d.key), 'gmg-cell-on': isPicked(ind.key, d.key) }"
            :style="cellStyle(ind.key, d.key)"
            :title="cellTitle(ind.key, d.key)"
            @click="pick(ind.key, d.key)"
          >
            <template v-if="cellOf(ind.key, d.key)">
              <span class="gmg-gap">{{ cellOf(ind.key, d.key)?.maxGap }}</span>
              <span class="gmg-n">{{ cellOf(ind.key, d.key)?.count }} 条</span>
            </template>
            <span v-else class="gmg-todo">待采</span>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script setup lang="ts">
import type { GapMatrixCell } from '../../composables/useGapDesk'

/** 行业/维度选项的最小结构（只需 key+label，行业多一个色点） */
interface GridAxisItem {
  key: string
  label: string
  color?: string
}

const props = withDefaults(
  defineProps<{
    /** 扁平的格子表：key = `${ind}|${dim}`，null/缺省 = 该格无数据（待采） */
    cells: Record<string, GapMatrixCell | null>
    inds: readonly GridAxisItem[]
    dims: readonly GridAxisItem[]
    /** 当前选中的格子，用于高亮 */
    pickedInd?: string
    pickedDim?: string
  }>(),
  { pickedInd: '', pickedDim: '' }
)

const emit = defineEmits<{
  (e: 'pick', ind: string, dim: string): void
}>()

const key = (ind: string, dim: string): string => `${ind}|${dim}`

function cellOf(ind: string, dim: string): GapMatrixCell | null {
  return props.cells[key(ind, dim)] ?? null
}

function isPicked(ind: string, dim: string): boolean {
  return props.pickedInd === ind && props.pickedDim === dim
}

/**
 * 色阶：底色随 maxGap 从 6% 加深到 30%。
 * 为什么用同一个色相（靛蓝）而不是红黄绿：颜色要表达「强弱」这一维，
 * 混进色相就会暗示「好坏」，而差值大不等于好，也不等于坏。
 */
function cellStyle(ind: string, dim: string): Record<string, string> {
  const cell = cellOf(ind, dim)
  if (!cell) return {}
  const alpha = 0.06 + (Math.max(0, Math.min(100, cell.maxGap)) / 100) * 0.24
  return { background: `rgba(79, 70, 229, ${alpha.toFixed(3)})` }
}

function cellTitle(ind: string, dim: string): string {
  const cell = cellOf(ind, dim)
  if (!cell) return '该组合当前无事件（待采：说明这块覆盖还没到位）'
  return `峰值 ${cell.maxGap} 分 · ${cell.count} 条（点击查看）`
}

function pick(ind: string, dim: string): void {
  emit('pick', ind, dim)
}
</script>

<style scoped>
.gmg-wrap {
  width: 100%;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
  border-radius: 10px;
  border: 1px solid var(--el-border-color-lighter);
  background: var(--surface, #fff);
}
.gmg {
  width: 100%;
  min-width: 720px;
  border-collapse: separate;
  border-spacing: 0;
  font-size: 12px;
}
.gmg th,
.gmg td {
  padding: 0;
  text-align: center;
  border-bottom: 1px solid var(--el-border-color-lighter);
  border-right: 1px solid var(--el-border-color-lighter);
}
.gmg thead th {
  position: sticky;
  top: 0;
  z-index: 2;
  height: 34px;
  background: var(--surface-soft, #fafafa);
  font-weight: 600;
  color: var(--text-strong, #303133);
  white-space: nowrap;
}
/* 左上角与行业列双重 sticky（左侧固定） */
.gmg-corner {
  position: sticky;
  left: 0;
  z-index: 3;
  min-width: 108px;
  padding: 0 10px !important;
  text-align: left !important;
  color: var(--text-muted, #909399) !important;
}
.gmg-ind {
  position: sticky;
  left: 0;
  z-index: 1;
  min-width: 108px;
  height: 44px;
  padding: 0 10px !important;
  text-align: left !important;
  background: var(--surface, #fff);
  font-weight: 500;
  white-space: nowrap;
}
.gmg-dot {
  display: inline-block;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  margin-right: 6px;
  vertical-align: middle;
}
.gmg-ind-lb {
  vertical-align: middle;
}
.gmg-dim {
  min-width: 76px;
  padding: 0 8px !important;
}
.gmg-cell {
  height: 46px;
  min-width: 76px;
  cursor: pointer;
  transition: box-shadow 0.15s ease;
}
.gmg-cell:hover {
  box-shadow: inset 0 0 0 1px var(--el-color-primary);
}
.gmg-cell-on {
  box-shadow: inset 0 0 0 2px var(--el-color-primary);
}
.gmg-gap {
  display: block;
  font-size: 13px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  color: var(--text-strong, #303133);
  line-height: 1.2;
}
.gmg-n {
  display: block;
  font-size: 10px;
  font-variant-numeric: tabular-nums;
  color: var(--text-muted, #909399);
}
.gmg-todo {
  font-size: 10px;
  letter-spacing: 0.06em;
  color: #c0c4cc;
}
@media (max-width: 768px) {
  .gmg {
    min-width: 640px;
  }
  .gmg-cell {
    height: 48px;
    min-width: 68px;
  }
  .gmg-ind,
  .gmg-corner {
    min-width: 92px;
  }
}
</style>
