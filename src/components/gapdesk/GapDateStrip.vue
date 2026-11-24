<!--
  日期胶囊横滚条
  ---------------------------------------------------------------
  胶囊直接来自 store 的 dateBands：1小时内 / 今天更早 / 8-18 / 8-19…
  当前日渐变紫底白字。没有数据的日期不出现在带子上，不补空日期。
-->
<template>
  <div class="gds">
    <span class="gds-kick gd-mono">实时</span>
    <div class="gds-scroll">
      <button
        v-for="band in bands"
        :key="band.key"
        type="button"
        class="gds-pill gd-mono"
        :class="[`gds-${band.kind}`, { on: active === band.key }]"
        :title="`${band.label} · ${band.count} 条`"
        @click="emit('pick', band.key)"
      >
        {{ band.label }} <b>{{ band.count }}</b>
      </button>
      <span v-if="!bands.length" class="gds-none">当前时间窗内没有可归日的事件</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { GapDateBand } from '../../types/gapdesk'

withDefaults(
  defineProps<{
    bands: GapDateBand[]
    active?: string
  }>(),
  { bands: () => [], active: '' }
)

const emit = defineEmits<{ pick: [key: string] }>()
</script>

<style scoped>
.gds {
  display: flex;
  align-items: center;
  gap: 9px;
  min-width: 0;
  flex-shrink: 0;
}
.gds-kick {
  font-size: var(--gd-fs-kick);
  color: var(--gd-brand);
  letter-spacing: .7px;
  text-transform: uppercase;
  flex-shrink: 0;
}
.gds-scroll {
  display: flex;
  align-items: center;
  gap: 5px;
  min-width: 0;
  overflow-x: auto;
  scrollbar-width: none;
  -webkit-overflow-scrolling: touch;
}
.gds-scroll::-webkit-scrollbar {
  display: none;
}
.gds-pill {
  flex: none;
  min-height: 30px;
  padding: 0 10px;
  border: 1px solid var(--gd-line);
  border-radius: 999px;
  background: var(--gd-card);
  color: var(--gd-ink2);
  font-size: var(--gd-fs-pill);
  cursor: pointer;
  white-space: nowrap;
  transition: all .15s var(--gd-ease);
}
.gds-pill b {
  margin-left: 4px;
  font-weight: 700;
}
.gds-pill:hover {
  border-color: var(--gd-brand);
  color: var(--gd-brand);
}
.gds-pill.on {
  background: var(--gd-grad);
  border-color: transparent;
  color: var(--gd-card);
  font-weight: 600;
}
.gds-live {
  border-color: var(--gd-gap);
  color: var(--gd-gap);
}
.gds-live.on {
  color: var(--gd-card);
}
.gds-none {
  font-size: var(--gd-fs-panels);
  color: var(--gd-ink3);
  white-space: nowrap;
}
/* 真机 / 粗指针：胶囊触控高度提到 44px（PC 保持 30px 紧凑条） */
@media (max-width: 768px), (hover: none) and (pointer: coarse) {
  .gds-pill {
    min-height: 44px;
  }
}
</style>
