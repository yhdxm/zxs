<!--
  移动-03 筛选面板（二级页）
  直接复用 GapFilterBar（同一份 store 筛选），底部「看结果」回主屏。
  键盘弹起时用 visualViewport 给输入区让位，避免底部按钮被遮住。
-->
<template>
  <div class="mbview" :style="{ paddingBottom: `${keyboardOffset}px` }">
    <div class="p-sec"><div class="h">筛选 · 与全景 / 单源共享同一份条件</div></div>
    <GapFilterBar />
    <div class="bottom">
      <button type="button" class="see" @click="emit('navigate', 'm-latest')">看结果 ({{ pool.length }})</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import GapFilterBar from '../../../components/gapdesk/GapFilterBar.vue'
import { useGapDesk } from '../../../composables/useGapDesk'

const emit = defineEmits<{ navigate: [key: string] }>()
const { pool } = useGapDesk()

const keyboardOffset = ref(0)
let viewport: VisualViewport | null = null
function onViewportResize(): void {
  if (!viewport) return
  // 键盘高度 = 布局视口高 − 可视视口高 − 顶部偏移；无键盘时为 0
  keyboardOffset.value = Math.max(0, Math.round(window.innerHeight - viewport.height - viewport.offsetTop))
}
onMounted(() => {
  if (typeof window !== 'undefined' && window.visualViewport) {
    viewport = window.visualViewport
    viewport.addEventListener('resize', onViewportResize)
    viewport.addEventListener('scroll', onViewportResize)
    onViewportResize()
  }
})
onBeforeUnmount(() => {
  if (!viewport) return
  viewport.removeEventListener('resize', onViewportResize)
  viewport.removeEventListener('scroll', onViewportResize)
})
</script>

<style scoped>
.mbview {
  display: flex;
  flex-direction: column;
  gap: 11px;
  min-width: 0;
}
.bottom {
  position: sticky;
  bottom: 0;
  padding: 10px 0;
  background: var(--gd-bg);
}
.see {
  width: 100%;
  min-height: 44px;
  border: 0;
  border-radius: var(--gd-r-nav);
  background: var(--gd-grad);
  color: var(--gd-card);
  font-family: var(--gd-sans);
  font-size: var(--gd-fs-phead);
  font-weight: 600;
  cursor: pointer;
}
</style>
