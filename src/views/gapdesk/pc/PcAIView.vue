<!--
  PC AI 研判（侧栏 16）：规则式统计归纳，不是大模型。
  输入框只是口径说明位，禁用且不会产生回答；今日引用可直接打开宿主详情抽屉。
-->
<template>
  <div class="pcview">
    <div class="row1 chips">
      <span v-for="chip in contextChips" :key="chip" class="gd-pill gd-pill-soft gd-mono">{{ chip }}</span>
    </div>

    <section class="panel model-brief">
      <div class="gh">
        <i class="bar" aria-hidden="true" />
        <span class="t">AI 模型研判 · 点击即生成</span>
        <span class="r gd-mono">{{ status === 'done' ? (cached ? '48h 缓存' : modelLabel) : '' }}</span>
      </div>
      <p class="panel-note">
        把当前 48h 池的真实差值交给模型归纳，只引用给定事件，不编造；下方规则版研判始终保留。
      </p>
      <div class="brief-actions">
        <button type="button" class="pctl brief-run" :disabled="!canGenerate" @click="generate()">
          {{ status === 'loading' ? '研判生成中…' : (text ? '重新生成研判' : '生成研判') }}
        </button>
        <span v-if="!configReady" class="brief-hint">首次使用：选免费模型 + 填一次 Key</span>
      </div>
      <div v-if="!configReady" class="brief-setup">
        <select v-model="modelPick" class="brief-select" aria-label="选择免费模型">
          <option v-for="m in freeModels" :key="m.id" :value="m.id">{{ m.label }}</option>
        </select>
        <input
          v-model="keyInput"
          class="pctl brief-key"
          type="password"
          autocomplete="off"
          placeholder="该平台的免费 API Key（仅填一次，加密留存）"
        />
        <button type="button" class="pctl" @click="applyFreeModel()">保存模型</button>
      </div>
      <p v-if="error" class="panel-note brief-error">{{ error }}；下方规则版研判不受影响。</p>
      <p v-if="text" class="panel-note brief-text">{{ text }}</p>
    </section>

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
        <p class="panel-note">{{ GAP_FRESH_NOTE }}</p>
      </div>

      <div class="row1 chips suggest">
        <button v-for="q in SUGGESTS" :key="q" type="button" class="gd-pill gd-pill-soft chip-btn" :title="EMPTY_AI_INPUT" @click="query = q">{{ q }}</button>
      </div>
      <input v-model="query" class="pctl ai-input" type="search" :placeholder="EMPTY_AI_INPUT" :aria-label="EMPTY_AI_INPUT" />
      <div v-if="query.trim()" class="ai-hits">
        <p class="panel-note">检索到 {{ aiHits.length }} 条真实事件（按差值分排序），点一条打开详情：</p>
        <button v-for="item in aiHits" :key="item.id" type="button" class="quote gd-mono" @click="openDetail(item.id)">
          #{{ item.rank }} · GAP {{ item.gap }} · {{ titleOf(item) }}
        </button>
        <GapEmptyState v-if="!aiHits.length" type="empty" desc="当前 48h 池内没有匹配的事件；不编造研判依据" />
      </div>
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
import { computed, inject, ref } from 'vue'
import GapEmptyState from '../../../components/gapdesk/GapEmptyState.vue'
import {
  EMPTY_AI_INPUT,
  EMPTY_AI_PUSH,
  EMPTY_AI_WEIGHT,
  EMPTY_GENERIC,
  EMPTY_LLM,
  GAP_FRESH_NOTE,
  GAP_WEIGHTS
} from '../../../config/gapdeskConfig'
import { GAP_OPEN_DETAIL_KEY, useGapDesk } from '../../../composables/useGapDesk'
import { useGapBriefAi } from '../../../composables/useGapBriefAi'

const { ranked, tierCounts, lagMedianHours, health, dailyBriefText, titleOf } = useGapDesk()
const {
  status, text, modelLabel, cached, error, keyInput, modelPick,
  configReady, canGenerate, freeModels, applyFreeModel, generate
} = useGapBriefAi()
const openDetail = inject(GAP_OPEN_DETAIL_KEY, (_id: number) => {})
const query = ref('')

/** 检索真实事件作为研判依据，不是 LLM 对话；命中仅来自当前 48h 池 */
const aiHits = computed(() => {
  const kw = query.value.trim().toLowerCase()
  if (!kw) return []
  return ranked.value
    .filter((item) => `${item.title} ${titleOf(item)} ${item.reason ?? ''}`.toLowerCase().includes(kw))
    .slice(0, 8)
})

const SUGGESTS = ['孤证为什么降权？', '时差中位怎么取？', 'L0 是怎么分的？'] as const

const contextChips = computed<string[]>(() => [
  `L0 ${tierCounts.value.L0}`,
  `样本 ${ranked.value.length}`,
  `时差 ${lagMedianHours.value === null ? '—' : lagMedianHours.value} 小时`,
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
.model-brief {
  border-color: color-mix(in srgb, var(--gd-brand) 35%, var(--gd-line));
}
.brief-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  margin: 8px 0;
}
.brief-run {
  cursor: pointer;
  color: var(--gd-brand);
  font-weight: 600;
}
.brief-run:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.brief-hint {
  font-size: var(--gd-fs-pill);
  color: var(--gd-ink3);
}
.brief-setup {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  align-items: center;
}
.brief-select,
.brief-key {
  min-height: 34px;
  padding: 0 9px;
  border: 1px solid var(--gd-line);
  border-radius: var(--gd-r-nav);
  background: var(--gd-sub);
  color: var(--gd-ink2);
  font-family: var(--gd-sans);
  font-size: var(--gd-fs-panels);
}
.brief-select {
  max-width: 260px;
}
.brief-key {
  flex: 1 1 240px;
}
.brief-error {
  color: #c0392b;
}
.brief-text {
  white-space: pre-line;
  line-height: 1.7;
  padding: 10px 12px;
  border-radius: var(--gd-r-nav);
  background: var(--gd-sub);
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
.chip-btn {
  cursor: pointer;
  border: 0;
}
.chip-btn:hover {
  color: var(--gd-brand);
}
.ai-input {
  width: 100%;
  min-height: 34px;
}
.ai-hits {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-top: 8px;
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
