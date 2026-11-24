<!--
  差值台 GAPDESK · 管理员清理确认浮层
  ---------------------------------------------------------------
  六态：confirm / running / done / empty / error（idle 不渲染）。
  文案全部读 store.purgeMsg（config 常量唯一真源），本组件不拼字符串。
  Teleport 到 body 后离开 .gd-stage，靠根节点 .gd-portal 承接 --gd-* 令牌
  （同 GapDetailDrawer，忘了会白面板失效）。
-->
<template>
  <Teleport to="body">
    <div v-if="modelValue" class="gpc-wrap gd-portal" @click.self="close">
      <div class="gpc-card" role="dialog" aria-modal="true" aria-label="清理过期数据">
        <div class="gpc-bar" aria-hidden="true" />
        <div class="gpc-h">
          <strong>清理过期数据</strong>
          <button
            class="gpc-x"
            type="button"
            title="关闭"
            aria-label="关闭"
            :disabled="busy"
            @click="close"
          >×</button>
        </div>

        <div class="gpc-body">
          <p class="gpc-msg">{{ purgeMsg }}</p>
          <p v-if="hasResult" class="gpc-count gd-mono">实际删除 {{ purgeDeleted }} 条</p>
        </div>

        <div class="gpc-acts">
          <button
            class="gpc-primary"
            type="button"
            :disabled="busy"
            @click="onPrimary"
          >{{ primaryLabel }}</button>
          <button
            v-if="!hasResult"
            class="gpc-secondary"
            type="button"
            :disabled="busy"
            @click="close"
          >取消</button>
        </div>
        <div class="gpc-safe" aria-hidden="true" />
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted } from 'vue'
import { useGapDesk } from '../../composables/useGapDesk'

const props = defineProps<{ modelValue: boolean }>()
const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  confirm: []
}>()

const { purgeState, purgeDeleted, purgeMsg } = useGapDesk()

/** running 态禁止任何关闭路径，避免结果没回来就打断操作 */
const busy = computed<boolean>(() => purgeState.value === 'running')
const hasResult = computed<boolean>(
  () => purgeState.value === 'done' || purgeState.value === 'empty' || purgeState.value === 'error'
)
const primaryLabel = computed<string>(() => {
  if (purgeState.value === 'running') return '正在清理…'
  if (hasResult.value) return '完成'
  return '确认清除并刷新'
})

function close(): void {
  if (busy.value) return
  emit('update:modelValue', false)
}

function onPrimary(): void {
  if (busy.value) return
  if (hasResult.value) {
    close()
    return
  }
  emit('confirm')
}

function onKey(event: KeyboardEvent): void {
  if (props.modelValue && event.key === 'Escape' && !busy.value) close()
}

onMounted(() => {
  if (typeof window !== 'undefined') window.addEventListener('keydown', onKey)
})
onBeforeUnmount(() => {
  if (typeof window !== 'undefined') window.removeEventListener('keydown', onKey)
})
</script>

<style scoped>
.gpc-wrap {
  position: fixed;
  inset: 0;
  z-index: 90;
  background: rgba(12, 16, 48, .42);
  backdrop-filter: blur(2px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
}
.gpc-card {
  position: relative;
  width: min(420px, 100%);
  max-height: calc(100dvh - 32px);
  overflow-y: auto;
  background: var(--gd-card);
  border-radius: var(--gd-r-panel);
  box-shadow: var(--gd-sh-lg);
  display: flex;
  flex-direction: column;
}
.gpc-bar {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 2px;
  background: var(--gd-gap);
}
.gpc-h {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 14px 16px 10px;
  font-size: var(--gd-fs-phead);
  color: var(--gd-ink);
}
.gpc-x {
  margin-left: auto;
  width: 44px;
  height: 44px;
  border: 0;
  border-radius: var(--gd-r-nav);
  background: var(--gd-sub);
  color: var(--gd-ink2);
  font-size: var(--gd-fs-phead);
  cursor: pointer;
}
.gpc-x:disabled {
  opacity: .45;
  cursor: not-allowed;
}
.gpc-body {
  padding: 0 16px 12px;
}
.gpc-msg {
  margin: 0;
  font-size: var(--gd-fs-panels);
  line-height: 1.7;
  color: var(--gd-ink2);
}
.gpc-count {
  margin: 10px 0 0;
  font-size: var(--gd-fs-phead);
  color: var(--gd-gap);
}
.gpc-acts {
  display: flex;
  gap: 8px;
  padding: 0 16px 14px;
}
.gpc-primary,
.gpc-secondary {
  flex: 1;
  min-height: 44px;
  border-radius: var(--gd-r-nav);
  font-size: var(--gd-fs-nav);
  cursor: pointer;
}
.gpc-primary {
  border: 1px solid var(--gd-gap);
  background: var(--gd-gap);
  color: var(--gd-card);
  box-shadow: var(--gd-sh-xs);
}
.gpc-secondary {
  border: 1px solid var(--gd-line2);
  background: var(--gd-card);
  color: var(--gd-ink2);
}
.gpc-primary:disabled,
.gpc-secondary:disabled {
  opacity: .55;
  cursor: not-allowed;
}
.gpc-safe {
  height: calc(18px + env(safe-area-inset-bottom, 0px));
  background: var(--gd-card);
}

@media (max-width: 768px) {
  .gpc-wrap {
    align-items: flex-end;
    padding: 0;
  }
  .gpc-card {
    width: 100%;
    max-height: none;
    border-radius: var(--gd-r-panel) var(--gd-r-panel) 0 0;
  }
}
</style>
