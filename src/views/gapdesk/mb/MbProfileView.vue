<!--
  移动-02 行业概览
  与 PC-02 同一份 byIndustry 统计；点击行业写入 filters.inds 并回到「最新」看该行业时间线。
-->
<template>
  <div class="mbview">
    <div class="p-sec"><div class="h">8 个行业档案 · 样本来自当前事件池</div></div>
    <GapEmptyState v-if="!ranked.length" type="empty" />
    <button v-for="ind in GAP_IND" :key="ind.key" type="button" class="p-item" @click="openIndustry(ind.key)">
      <span class="top">
        <i class="dot" :style="{ background: ind.color }" aria-hidden="true" />
        <span class="t">{{ ind.label }}</span>
        <span class="gd-mono n">{{ statOf(ind.key).count }}</span>
      </span>
      <span class="m gd-mono">均 GAP {{ statOf(ind.key).avg }} · 最高 {{ statOf(ind.key).max }}</span>
      <span class="m best">{{ statOf(ind.key).best || '— 暂无事件' }}</span>
    </button>
  </div>
</template>

<script setup lang="ts">
import GapEmptyState from '../../../components/gapdesk/GapEmptyState.vue'
import { GAP_IND } from '../../../config/gapdeskConfig'
import { useGapDesk } from '../../../composables/useGapDesk'
import type { GapInd } from '../../../types/gapdesk'

const emit = defineEmits<{ navigate: [key: string] }>()
const { ranked, byIndustry, filters } = useGapDesk()

function statOf(ind: GapInd): { count: number; avg: number | string; max: number | string; best: string } {
  const list = byIndustry.value[ind] ?? []
  if (!list.length) return { count: 0, avg: '—', max: '—', best: '' }
  const best = [...list].sort((a, b) => b.gap - a.gap)[0]
  return {
    count: list.length,
    avg: Math.round(list.reduce((sum, e) => sum + e.gap, 0) / list.length),
    max: best?.gap ?? '—',
    best: best ? `GAP ${best.gap} · ${best.title.slice(0, 22)}` : ''
  }
}

/** 写入共享筛选（切视图不丢），再回最新信息按发布日读该行业时间线 */
function openIndustry(ind: GapInd): void {
  filters.inds = [ind]
  emit('navigate', 'm-latest')
}

</script>

<style scoped>
.mbview {
  display: flex;
  flex-direction: column;
  gap: 11px;
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
  font-size: var(--gd-fs-gscore);
  font-weight: 700;
  color: var(--gd-brand);
}
.best {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
