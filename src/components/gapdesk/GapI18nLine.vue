<!--
  译文标题行 · PC/移动/详情共用
  ---------------------------------------------------------------
  显示规则：
  - 国内原文（is_foreign=false）：只给轻量「国内原文」标记，不给切换按钮；
  - 有译文：显示「机器翻译 · 查看原文」，点一下切回源站标题，再点切回译文；
  - 翻译中 / 失败 / 额度用完：如实给状态，不假装成功，也不阻塞卡片。
  源站标题永远保留，切换只影响展示；打分/排序始终用源站字段，不受影响。
-->
<template>
  <div class="gi18n-wrap" @click.stop>
    <component :is="tag" class="gi18n-title" :class="{ large: large }">{{ shownTitle }}</component>
    <div class="gi18n" :class="{ compact: compact }">
      <span class="gi18n-badge" :class="state">{{ text }}</span>
      <button
        v-if="hasTranslation"
        type="button"
        class="gi18n-toggle gd-mono"
        @click="showOriginal = !showOriginal"
      >{{ showOriginal ? '返回译文' : '查看原文' }}</button>
      <span v-if="state === 'failed'" class="gi18n-tip gd-mono">已保留源站原文</span>
      <button
        v-if="state === 'failed' && retryKey"
        type="button"
        class="gi18n-retry gd-mono"
        :title="I18N_RETRY_TIP"
        @click="retry"
      >{{ I18N_RETRY_TEXT }}</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { I18N_RETRY_TEXT, I18N_RETRY_TIP } from '../../config/gapdeskConfig'
import { clearI18nFailed } from '../../composables/useGapDesk'
import { i18nBadgeTextOf } from '../../utils/gapdeskFormat'

type I18nState = 'native' | 'off' | 'done' | 'loading' | 'failed' | 'quota'

const props = withDefaults(
  defineProps<{
    /** 源站标题（永远可读） */
    original: string
    /** store 给出的展示标题：有译文时是译文，否则等于原文 */
    display: string
    state: I18nState
    /** 是否有可用译文（决定「查看原文」按钮是否出现） */
    hasTranslation?: boolean
    compact?: boolean
    large?: boolean
    tag?: string
    /** 事件指纹（event_key）：失败态据此重试翻译；不传则保持原展示，不影响旧调用方 */
    retryKey?: string
  }>(),
  { hasTranslation: false, compact: false, large: false, tag: 'h3', retryKey: '' }
)

/** 事件切换时复位到译文视图，避免上一条的「看原文」状态串到下一条 */
const showOriginal = ref(false)
watch(
  () => [props.original, props.display] as const,
  () => { showOriginal.value = false }
)
const shownTitle = computed(() => (showOriginal.value ? props.original : props.display))
const text = computed(() => i18nBadgeTextOf(props.state))

/** 手动重试：store 只清失败标记并重新入队，译文缓存与打分都不动 */
function retry(): void {
  if (props.retryKey) clearI18nFailed(props.retryKey)
}
</script>

<style scoped>
.gi18n-wrap {
  min-width: 0;
}
.gi18n-title {
  margin: 0;
  font-size: var(--gd-fs-ttl);
  font-weight: 600;
  line-height: 1.4;
  letter-spacing: -.1px;
  color: var(--gd-ink);
  overflow-wrap: anywhere;
}
.gi18n-title.large {
  font-size: var(--gd-fs-phead);
  font-weight: 700;
}
.gi18n {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  min-height: 24px;
  flex-wrap: wrap;
}
.gi18n.compact {
  min-height: 22px;
}
.gi18n-badge {
  font-size: var(--gd-fs-pill);
  color: var(--gd-ink3);
  border: 1px solid var(--gd-line);
  border-radius: 5px;
  padding: 1px 6px;
}
.gi18n-badge.native { color: var(--gd-ink3); }
.gi18n-badge.done { color: var(--gd-brand); border-color: color-mix(in srgb, var(--gd-brand) 35%, transparent); }
.gi18n-badge.loading,
.gi18n-badge.quota { color: var(--gd-warn); }
.gi18n-badge.failed { color: var(--gd-warn); }
.gi18n-badge.off { color: var(--gd-ink3); }
.gi18n-toggle {
  min-height: 30px;
  padding: 1px 6px;
  border: 0;
  background: transparent;
  color: var(--gd-brand);
  font-size: var(--gd-fs-pill);
  cursor: pointer;
  text-decoration: underline;
}
.gi18n-tip {
  font-size: var(--gd-fs-pill);
  color: var(--gd-ink3);
}
/* 失败重试：与「查看原文」同为弱化文字按钮，不抢主内容视觉 */
.gi18n-retry {
  min-height: 30px;
  padding: 1px 6px;
  border: 1px solid var(--gd-line);
  border-radius: 5px;
  background: transparent;
  color: var(--gd-brand);
  font-size: var(--gd-fs-pill);
  cursor: pointer;
}
.gi18n-retry:hover {
  border-color: var(--gd-brand);
}
@media (max-width: 768px) {
  .gi18n-toggle { min-height: 44px; }
  .gi18n-retry { min-height: 44px; }
}
</style>
