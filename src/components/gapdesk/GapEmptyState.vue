<!--
  统一空态
  ---------------------------------------------------------------
  四段固定结构：标题 → 说明 → 「为什么没有」→ 二期标记。
  所有文案只从 config 的 EMPTY_* 常量取，组件内零硬编码；
  失败态额外把失败源 last_msg 原样摊开（最多 8 行），便于定位。
-->
<template>
  <div class="ges" :class="`ges-${type}`">
    <div class="ges-mark gd-mono" aria-hidden="true">{{ mark }}</div>
    <p class="ges-title">{{ resolved.title }}</p>
    <p v-if="resolved.desc" class="ges-desc">{{ resolved.desc }}</p>

    <div v-if="resolved.reason" class="ges-block">
      <span class="ges-label">{{ EMPTY_WHY_TITLE }}</span>
      <p>{{ resolved.reason }}</p>
    </div>

    <div v-if="resolved.phase2" class="ges-block ges-phase">
      <span class="ges-label">{{ EMPTY_PHASE_TITLE }}</span>
      <p>{{ resolved.phase2 }}</p>
    </div>

    <ul v-if="detail.length" class="ges-detail">
      <li v-for="(line, i) in detail.slice(0, 8)" :key="i">{{ line }}</li>
    </ul>

    <button v-if="actionText" type="button" class="ges-action gd-mono" @click="emit('action')">
      {{ actionText }}
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import {
  EMPTY_DEMO,
  EMPTY_ERROR,
  EMPTY_GENERIC,
  EMPTY_HISTORY,
  EMPTY_LOADING,
  EMPTY_PHASE_TITLE,
  EMPTY_STALE,
  EMPTY_WAIT,
  EMPTY_WINDOW,
  EMPTY_WHY_TITLE
} from '../../config/gapdeskConfig'

type EmptyType = 'empty' | 'loading' | 'error' | 'stale'

const props = withDefaults(
  defineProps<{
    type?: EmptyType
    title?: string
    desc?: string
    /** 覆盖「为什么没有」；缺省按 type 取口径常量 */
    reason?: string
    /** 覆盖二期标记；缺省按 type 取口径常量 */
    phase2?: string
    detail?: string[]
    actionText?: string
  }>(),
  { type: 'empty', title: '', desc: '', reason: '', phase2: '', detail: () => [], actionText: '' }
)

const emit = defineEmits<{ action: [] }>()

interface EmptyCopy {
  title: string
  desc: string
  reason: string
  phase2: string
}

const COPY: Record<EmptyType, EmptyCopy> = {
  // 空池场景只说可观测事实：不套用回打/导出/趋势口径，也不替采集链路背书
  empty: { title: EMPTY_GENERIC, desc: EMPTY_WINDOW, reason: '', phase2: '' },
  loading: { title: EMPTY_WAIT, desc: EMPTY_LOADING, reason: EMPTY_HISTORY, phase2: '' },
  error: { title: EMPTY_ERROR, desc: EMPTY_DEMO, reason: EMPTY_WAIT, phase2: '' },
  stale: { title: EMPTY_STALE, desc: EMPTY_DEMO, reason: EMPTY_HISTORY, phase2: '' }
}

const resolved = computed<EmptyCopy>(() => {
  const base = COPY[props.type] ?? COPY.empty
  return {
    title: props.title || base.title,
    desc: props.desc || base.desc,
    reason: props.reason || base.reason,
    phase2: props.phase2 || base.phase2
  }
})

const mark = computed(() => {
  if (props.type === 'error') return '!'
  if (props.type === 'stale') return '~'
  if (props.type === 'loading') return '…'
  return '—'
})
</script>

<style scoped>
.ges {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 9px;
  padding: 30px 20px;
  border-radius: var(--gd-r-panel);
  border: 1px dashed var(--gd-line2);
  background: var(--gd-card);
  text-align: center;
}
.ges-mark {
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  background: var(--gd-sub);
  color: var(--gd-ink3);
  font-size: var(--gd-fs-phead);
}
.ges-error .ges-mark { color: var(--gd-gap); background: color-mix(in srgb, var(--gd-gap) 10%, var(--gd-card)); }
.ges-stale .ges-mark { color: var(--gd-warn); background: color-mix(in srgb, var(--gd-warn) 12%, var(--gd-card)); }
.ges-loading .ges-mark { color: var(--gd-cyan); background: color-mix(in srgb, var(--gd-cyan) 10%, var(--gd-card)); }
.ges-title {
  margin: 0;
  font-size: var(--gd-fs-phead);
  font-weight: 700;
  color: var(--gd-ink);
}
.ges-desc {
  margin: 0;
  max-width: 460px;
  font-size: var(--gd-fs-why);
  line-height: 1.6;
  color: var(--gd-ink2);
}
.ges-block {
  width: 100%;
  max-width: 520px;
  text-align: left;
  padding: 9px 12px;
  border-radius: var(--gd-r-nav);
  background: var(--gd-sub);
}
.ges-block p {
  margin: 3px 0 0;
  font-size: var(--gd-fs-panels);
  line-height: 1.6;
  color: var(--gd-ink2);
}
.ges-label {
  font-family: var(--gd-mono);
  font-size: var(--gd-fs-kick);
  color: var(--gd-ink3);
  letter-spacing: .6px;
}
.ges-phase {
  border: 1px dashed var(--gd-line2);
  background: var(--gd-card);
}
.ges-detail {
  margin: 0;
  padding: 0;
  list-style: none;
  text-align: left;
  max-width: 520px;
  font-size: var(--gd-fs-panels);
  line-height: 1.7;
  color: var(--gd-ink3);
}
.ges-detail li::before {
  content: '· ';
}
.ges-action {
  min-height: 44px;
  padding: 0 15px;
  border: 0;
  border-radius: var(--gd-r-nav);
  background: var(--gd-grad);
  color: var(--gd-card);
  font-size: var(--gd-fs-panels);
  cursor: pointer;
}
</style>
