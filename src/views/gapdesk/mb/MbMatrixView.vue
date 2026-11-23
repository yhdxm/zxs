<!--
  移动 全景 tab：8 行业 × 6 维改为「行业列表 + 点开看六维」，
  不把 PC 的横向大表硬塞进 420px；空格仍是「待采」，不补 0。
-->
<template>
  <div class="mbview">
    <div class="p-sec"><div class="h">全景矩阵 · 点行业展开六维</div></div>
    <GapEmptyState v-if="!ranked.length" type="empty" />

    <section v-for="ind in GAP_IND" :key="ind.key" class="p-item" @click="toggle(ind.key)">
      <div class="top">
        <i class="dot" :style="{ background: ind.color }" aria-hidden="true" />
        <span class="t">{{ ind.label }}</span>
        <span class="gd-mono n">{{ covered(ind.key) }}/{{ GAP_DIM6.length }}</span>
      </div>
      <div v-if="opened === ind.key" class="dims">
        <div v-for="dim in GAP_DIM6" :key="dim.key" class="dim">
          <span>{{ dim.label }}</span>
          <template v-if="cellOf(ind.key, dim.key)">
            <b class="gd-mono">{{ cellOf(ind.key, dim.key)?.maxGap }}</b>
            <em class="gd-mono">{{ cellOf(ind.key, dim.key)?.count }} 条</em>
          </template>
          <em v-else class="gd-mono todo">{{ EMPTY_WAIT }}</em>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import GapEmptyState from '../../../components/gapdesk/GapEmptyState.vue'
import { EMPTY_WAIT, GAP_DIM6, GAP_IND } from '../../../config/gapdeskConfig'
import { useGapDesk } from '../../../composables/useGapDesk'
import type { GapDim6Key, GapInd } from '../../../types/gapdesk'

const { matrix6, ranked } = useGapDesk()
/** 默认展开第一个行业，让用户一眼看到六维结构（空格即「待采」） */
const opened = ref<GapInd | ''>('ai')

function toggle(ind: GapInd): void {
  opened.value = opened.value === ind ? '' : ind
}
function cellOf(ind: GapInd, dim: GapDim6Key) {
  return matrix6.value[ind]?.[dim] ?? null
}
function covered(ind: GapInd): number {
  return GAP_DIM6.filter((dim) => cellOf(ind, dim.key)).length
}
</script>

<style scoped>
.mbview {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.top {
  display: flex;
  align-items: center;
  gap: 7px;
  min-width: 0;
}
.dot {
  width: 8px;
  height: 8px;
  border-radius: 999px;
  flex-shrink: 0;
}
.n {
  margin-left: auto;
  font-size: var(--gd-fs-panels);
  color: var(--gd-brand);
}
.dims {
  display: flex;
  flex-direction: column;
  gap: 5px;
  padding-top: 8px;
  border-top: 1px solid var(--gd-line);
}
.dim {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 32px;
  font-size: var(--gd-fs-panels);
  color: var(--gd-ink2);
}
.dim b {
  margin-left: auto;
  color: var(--gd-ink);
}
.dim em {
  font-style: normal;
  font-size: var(--gd-fs-pill);
  color: var(--gd-ink3);
  min-width: 40px;
  text-align: right;
}
.dim em.todo {
  color: var(--gd-warn);
}
</style>
