<!--
  PC AI 研判（侧栏 16）：规则式统计归纳，不是大模型。
  输入框只是口径说明位，禁用且不会产生回答；今日引用可直接打开宿主详情抽屉。
-->
<template>
  <div class="pcview">
    <div class="row1 chips">
      <span v-for="chip in contextChips" :key="chip" class="gd-pill gd-pill-soft gd-mono">{{ chip }}</span>
    </div>

    <section class="panel chat">
      <div class="gh">
        <i class="bar" aria-hidden="true" />
        <span class="t">AI 研判 · 规则式统计归纳</span>
        <span class="r">{{ EMPTY_LLM }}</span>
      </div>

      <div class="msg">
        <b class="gd-mono">研判</b>
        <p class="panel-note chat-text">{{ dailyBriefText || EMPTY_GENERIC }}</p>
      </div>
      <div class="msg msg-user">
        <b class="gd-mono">怎么算的？</b>
      </div>
      <div class="msg">
        <b class="gd-mono">口径</b>
        <p class="panel-note">
          时间 ×{{ GAP_WEIGHTS.time }} · 孤证 ×{{ GAP_WEIGHTS.rare }} · 影响 ×{{ GAP_WEIGHTS.impact }} · 行动 ×{{ GAP_WEIGHTS.action }}。
          {{ EMPTY_LLM }}。
        </p>
      </div>

      <div class="row1 chips suggest">
        <span v-for="q in SUGGESTS" :key="q" class="gd-pill gd-pill-soft" :title="EMPTY_AI_INPUT">{{ q }}</span>
      </div>
      <input class="pctl ai-input" type="text" disabled :placeholder="EMPTY_AI_INPUT" :title="EMPTY_AI_INPUT" />
      <p class="panel-note">{{ EMPTY_AI_INPUT }} · {{ EMPTY_LLM }}</p>
    </section>

    <div class="grid2">
      <section class="panel">
        <div class="gh"><i class="bar" aria-hidden="true" /><span class="t">生成方式</span></div>
        <p class="panel-note">{{ EMPTY_LLM }}</p>
        <p class="panel-note">{{ EMPTY_AI_PUSH }}</p>
      </section>

      <section class="panel">
        <div class="gh">
          <i class="bar" aria-hidden="true" />
          <span class="t">今日引用 TOP3</span>
          <span class="b">{{ top3.length }}</span>
        </div>
        <button
          v-for="item in top3"
          :key="item.id"
          type="button"
          class="quote gd-mono"
          @click="openDetail(item.id)"
        >
          #{{ item.rank }} · GAP {{ item.gap }} · {{ item.title }}
        </button>
        <p v-if="!top3.length" class="panel-note">{{ EMPTY_GENERIC }}</p>
      </section>

      <section class="panel">
        <div class="gh"><i class="bar" aria-hidden="true" /><span class="t">评分权重</span></div>
        <div v-for="w in weightRows" :key="w.label" class="rowline">
          <span>{{ w.label }}</span>
          <span class="v gd-mono">×{{ w.value }}</span>
        </div>
        <p class="panel-note">{{ EMPTY_AI_WEIGHT }}</p>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, inject } from 'vue'
import {
  EMPTY_AI_INPUT,
  EMPTY_AI_PUSH,
  EMPTY_AI_WEIGHT,
  EMPTY_GENERIC,
  EMPTY_LLM,
  GAP_WEIGHTS
} from '../../../config/gapdeskConfig'
import { GAP_OPEN_DETAIL_KEY, useGapDesk } from '../../../composables/useGapDesk'

const { ranked, tierCounts, lagMedianDays, health, dailyBriefText } = useGapDesk()
const openDetail = inject(GAP_OPEN_DETAIL_KEY, (_id: number) => {})

const SUGGESTS = ['孤证为什么降权？', '时差中位怎么取？', 'L0 是怎么分的？'] as const

const contextChips = computed<string[]>(() => [
  `L0 ${tierCounts.value.L0}`,
  `样本 ${ranked.value.length}`,
  `时差 ${lagMedianDays.value === null ? '—' : lagMedianDays.value} 天`,
  `信源 ${health.value.ok}/${health.value.total}`
])

const top3 = computed(() => ranked.value.slice(0, 3))
const weightRows = computed(() => [
  { label: '时间新鲜度', value: GAP_WEIGHTS.time },
  { label: '孤证加分', value: GAP_WEIGHTS.rare },
  { label: '影响面', value: GAP_WEIGHTS.impact },
  { label: '可执行性', value: GAP_WEIGHTS.action }
])
</script>

<style scoped>
.chips {
  flex-wrap: wrap;
}
.msg {
  padding: 9px 11px;
  border-radius: var(--gd-r-nav);
  background: var(--gd-sub);
  font-size: var(--gd-fs-panels);
  color: var(--gd-ink2);
}
.msg b {
  color: var(--gd-brand);
}
.msg-user {
  background: color-mix(in srgb, var(--gd-brand) 6%, var(--gd-card));
}
.chat-text {
  white-space: pre-line;
}
.suggest {
  padding-top: 2px;
}
.ai-input {
  width: 100%;
  min-height: 34px;
  cursor: not-allowed;
}
.quote {
  display: block;
  width: 100%;
  margin-top: 6px;
  padding: 7px 9px;
  text-align: left;
  border: 1px solid var(--gd-line);
  border-radius: var(--gd-r-nav);
  background: var(--gd-sub);
  color: var(--gd-ink2);
  font-size: var(--gd-fs-panels);
  cursor: pointer;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.quote:hover {
  border-color: var(--gd-brand);
  color: var(--gd-brand);
}
</style>
