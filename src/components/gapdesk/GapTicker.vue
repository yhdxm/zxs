<!--
  横向 ticker（最高分那几条的跑马灯）
  ---------------------------------------------------------------
  为什么值得做：值班场景下用户不一定会去看列表，但余光扫到一条 96 分就够他点进来。
  无数据时**不渲染**（不留一条空白条占版面），移动端由壳隐藏。
  hover 暂停（CSS animation-play-state），prefers-reduced-motion 时改为静态换行。
-->
<template>
  <div v-if="items.length" class="gtk" role="list" aria-label="差值快讯">
    <div class="gtk-track">
      <!-- 复制一份实现无缝滚动；第二份 aria-hidden，避免读屏重复播报 -->
      <template v-for="pass in 2" :key="pass">
        <button
          v-for="e in shown"
          :key="`${pass}-${e.id}`"
          type="button"
          class="gtk-item"
          role="listitem"
          :aria-hidden="pass === 2"
          :tabindex="pass === 2 ? -1 : 0"
          @click="emit('open', e)"
        >
          <span class="gtk-gap">{{ e.gap }}</span>
          <i class="gtk-dot" :style="{ background: colorOf(e) }" />
          <span class="gtk-title">{{ short(e.title) }}</span>
        </button>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { GAP_IND_MAP } from '../../config/gapdeskConfig'
import type { GapEventRow, GapInd } from '../../types/gapdesk'

const props = withDefaults(
  defineProps<{
    items: GapEventRow[]
    /** 最多展示几条（默认 8） */
    max?: number
  }>(),
  { max: 8 }
)

/** 点进详情：直接把事件对象抛给父级（父级握着抽屉状态） */
const emit = defineEmits<{ (e: 'open', event: GapEventRow): void }>()

const shown = computed(() => props.items.slice(0, Math.max(1, props.max)))

function colorOf(e: GapEventRow): string {
  return GAP_IND_MAP[e.ind as GapInd]?.color ?? '#909399'
}

/** 标题截断 18 字：ticker 一眼扫读，超过就没意义了 */
function short(t: string): string {
  const s = String(t || '')
  return s.length > 18 ? `${s.slice(0, 18)}…` : s
}
</script>

<style scoped>
.gtk {
  overflow: hidden;
  min-width: 0;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  background: var(--surface, #fff);
  padding: 0 10px;
}
.gtk-track {
  display: flex;
  align-items: center;
  gap: 22px;
  width: max-content;
  height: 34px;
  animation: gtk-scroll 32s linear infinite;
}
.gtk:hover .gtk-track {
  animation-play-state: paused;
}
.gtk-item {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 0;
  border: none;
  background: none;
  cursor: pointer;
  white-space: nowrap;
  min-height: 34px;
}
.gtk-gap {
  font-size: 12px;
  font-weight: 700;
  color: #ff3358;
  font-variant-numeric: tabular-nums;
}
.gtk-dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
}
.gtk-title {
  font-size: 12px;
  color: var(--text-muted, #606266);
}
.gtk-item:hover .gtk-title {
  color: var(--el-color-primary);
}
@keyframes gtk-scroll {
  from {
    transform: translateX(0);
  }
  /* 只位移一份的宽度：两份内容首尾相接，看起来就是无缝循环 */
  to {
    transform: translateX(-50%);
  }
}

/* 尊重系统「减少动态效果」：改为静态换行展示，不滚动 */
@media (prefers-reduced-motion: reduce) {
  .gtk {
    overflow-x: auto;
  }
  .gtk-track {
    animation: none;
    flex-wrap: wrap;
    width: auto;
    height: auto;
    gap: 6px 18px;
    padding: 6px 0;
  }
}
</style>
