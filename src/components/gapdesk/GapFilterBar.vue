<!--
  筛选栏（PC 与移动共用）
  ---------------------------------------------------------------
  原生 chipbar / select，不引入任何 UI 库组件。
  直接读写 useGapDesk().filters 单例：在「最新信息」里筛了 AI，
  切到「全景矩阵」还应该是 AI —— 用户对同一台仪器的预期。
-->
<template>
  <div class="gfb">
    <div class="gfb-inds">
      <button
        v-for="ind in GAP_IND"
        :key="ind.key"
        type="button"
        class="gfb-chip"
        :class="{ on: filters.inds.includes(ind.key) }"
        :style="filters.inds.includes(ind.key) ? { borderColor: ind.color, color: ind.color } : undefined"
        :title="`${ind.label}（⌘/Ctrl + 点击可多选）`"
        @click="onInd(ind.key, $event)"
      >
        <i class="gfb-dot" :style="{ background: ind.color }" aria-hidden="true" />
        {{ ind.label }}
      </button>
      <button v-if="filters.inds.length" type="button" class="gfb-clear gd-mono" @click="filters.inds = []">全部</button>
    </div>

    <div class="gfb-ctl">
      <label class="gfb-group">
        <span class="gfb-lb">维度</span>
        <select class="gfb-select gd-mono" :value="filters.dim6" @change="onDim">
          <option value="">全部维度</option>
          <option v-for="d in GAP_DIM6" :key="d.key" :value="d.key">{{ d.label }}</option>
        </select>
      </label>

      <div class="gfb-group">
        <span class="gfb-lb">排序</span>
        <button
          v-for="opt in SORTS"
          :key="opt.key"
          type="button"
          class="gfb-chip gd-mono"
          :class="{ on: filters.sort === opt.key }"
          @click="setSort(opt.key)"
        >{{ opt.label }}</button>
      </div>

      <div class="gfb-group">
        <span class="gfb-lb">时间窗</span>
        <button
          v-for="opt in WINDOWS"
          :key="opt.h"
          type="button"
          class="gfb-chip gd-mono"
          :class="{ on: filters.windowH === opt.h }"
          @click="setWindow(opt.h)"
        >{{ opt.label }}</button>
      </div>

      <input
        v-model="keywordInput"
        class="gfb-kw gd-mono"
        type="search"
        placeholder="标题 / 摘要关键词"
        aria-label="标题或摘要关键词"
      />

      <span class="gfb-count gd-mono">{{ pool.length }} 条</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue'
import { GAP_DIM6, GAP_IND } from '../../config/gapdeskConfig'
import { useGapDesk } from '../../composables/useGapDesk'
import type { GapDim6Key, GapInd } from '../../types/gapdesk'

const { filters, pool, setWindow, setSort, setDim6, setKeyword, resetFilters } = useGapDesk()

const SORTS: ReadonlyArray<{ key: 'latest' | 'gap' | 'heat'; label: string }> = [
  { key: 'latest', label: '最新' },
  { key: 'gap', label: '差值评分' },
  { key: 'heat', label: '热度差' }
]

/** 全天 = 库里 48h 保留窗口；近 3 天只用于检索，超出保留期的条目本就不在池里 */
const WINDOWS: ReadonlyArray<{ h: number; label: string }> = [
  { h: 48, label: '全天' },
  { h: 3, label: '3h' },
  { h: 12, label: '12h' },
  { h: 24, label: '24h' },
  { h: 72, label: '近3天' }
]

/** 关键词防抖：本地受控，300ms 后才写 store，避免每敲一字重算整池 */
const keywordInput = ref(filters.keyword)
let kwTimer: ReturnType<typeof setTimeout> | null = null
watch(keywordInput, (value) => {
  if (kwTimer) clearTimeout(kwTimer)
  kwTimer = setTimeout(() => setKeyword(value), 300)
})
onBeforeUnmount(() => {
  if (kwTimer) clearTimeout(kwTimer)
})

/**
 * 行业语义：普通点击 = 单选（再点同一项回到「全部」），
 * ⌘/Ctrl + 点击 = 多选。不做默认全选：「全部」与「选了 8 个」语义不同。
 */
function onInd(ind: GapInd, event: MouseEvent): void {
  if (event.metaKey || event.ctrlKey) {
    const index = filters.inds.indexOf(ind)
    if (index >= 0) filters.inds.splice(index, 1)
    else filters.inds.push(ind)
    return
  }
  const onlyThis = filters.inds.length === 1 && filters.inds[0] === ind
  filters.inds = onlyThis ? [] : [ind]
}

function onDim(event: Event): void {
  const value = (event.target as HTMLSelectElement).value
  setDim6(value === '' ? '' : (value as GapDim6Key))
}

/** 暴露给宿主做「重置筛选」；本组件自身不额外画按钮，避免重复入口 */
function reset(): void {
  keywordInput.value = ''
  resetFilters()
}
defineExpose({ reset })
</script>

<style scoped>
.gfb {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 9px 11px;
  border: 1px solid var(--gd-line);
  border-radius: var(--gd-r-panel);
  background: var(--gd-card);
  min-width: 0;
  flex-shrink: 0;
}
.gfb-inds {
  display: flex;
  align-items: center;
  gap: 5px;
  min-width: 0;
  overflow-x: auto;
  scrollbar-width: none;
}
.gfb-inds::-webkit-scrollbar {
  display: none;
}
.gfb-chip {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  flex: none;
  min-height: 30px;
  padding: 0 9px;
  border-radius: 999px;
  border: 1px solid var(--gd-line);
  background: var(--gd-card);
  color: var(--gd-ink2);
  font-family: var(--gd-sans);
  font-size: var(--gd-fs-panels);
  cursor: pointer;
  white-space: nowrap;
  transition: all .15s var(--gd-ease);
}
.gfb-chip:hover {
  border-color: var(--gd-brand);
  color: var(--gd-brand);
}
.gfb-chip.on {
  background: var(--gd-grad);
  border-color: transparent;
  color: var(--gd-card);
  font-weight: 600;
}
.gfb-dot {
  width: 7px;
  height: 7px;
  border-radius: 999px;
  flex-shrink: 0;
}
.gfb-clear {
  flex: none;
  min-height: 30px;
  border: 0;
  background: transparent;
  color: var(--gd-ink3);
  font-size: var(--gd-fs-pill);
  cursor: pointer;
  text-decoration: underline;
}
.gfb-ctl {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
  min-width: 0;
}
.gfb-group {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  min-width: 0;
}
.gfb-lb {
  font-size: var(--gd-fs-panels);
  color: var(--gd-ink3);
  white-space: nowrap;
}
.gfb-select {
  height: 30px;
  padding: 0 8px;
  border: 1px solid var(--gd-line2);
  border-radius: var(--gd-r-nav);
  background: var(--gd-sub);
  color: var(--gd-ink2);
  font-size: var(--gd-fs-pill);
  max-width: 140px;
}
.gfb-kw {
  flex: 1;
  min-width: 120px;
  max-width: 220px;
  height: 30px;
  padding: 0 9px;
  border: 1px solid var(--gd-line);
  border-radius: var(--gd-r-nav);
  background: var(--gd-sub);
  color: var(--gd-ink);
  font-size: var(--gd-fs-panels);
}
.gfb-kw::placeholder {
  color: var(--gd-ink3);
}
.gfb-count {
  margin-left: auto;
  font-size: var(--gd-fs-panels);
  color: var(--gd-ink2);
  white-space: nowrap;
}
@media (max-width: 768px) {
  .gfb-chip,
  .gfb-clear {
    min-height: 44px;
  }
  .gfb-kw,
  .gfb-select {
    height: 44px;
    max-width: none;
  }
}
</style>
