<!--
  移动 m-ai · AI 研判（只读二级页）
  规则式统计归纳，不是大模型；输入框在当前 48h 池内真检索事件作为研判依据，与 PC 同口径。
-->
<template>
  <div class="mbview">
    <button type="button" class="back gd-mono" @click="emit('navigate', 'm-latest')">← 返回</button>

    <section class="p-card brief-card">
      <div class="ttl">AI 模型研判 · 点击即生成</div>
      <p class="why">把当前 48h 池的真实差值交给模型归纳，只引用给定事件、不编造；下方规则版研判始终保留。</p>
      <button type="button" class="brief-run" :disabled="!canGenerate" @click="generate()">
        {{ status === 'loading' ? '研判生成中…' : (text ? '重新生成研判' : '生成研判') }}
      </button>
      <p v-if="status === 'done'" class="m gd-mono">{{ cached ? '48h 缓存' : modelLabel }}</p>
      <div v-if="!configReady" class="brief-setup">
        <select v-model="modelPick" class="brief-select" aria-label="选择免费模型">
          <option v-for="m in freeModels" :key="m.id" :value="m.id">{{ m.label }}</option>
        </select>
        <input
          v-model="keyInput"
          class="brief-key"
          type="password"
          autocomplete="off"
          placeholder="免费 API Key（仅填一次）"
        />
        <button type="button" class="brief-save" @click="applyFreeModel()">保存模型</button>
      </div>
      <p v-if="error" class="why brief-error">{{ error }}；下方规则版研判不受影响。</p>
      <!-- 与 PC 同口径：末尾「依据：#x」可点回溯；格式不符时原样展示 -->
      <template v-if="text">
        <p v-if="briefCitations" class="why brief-text">{{ briefCitations.body }}</p>
        <p v-else class="why brief-text">{{ text }}</p>
        <div v-if="briefCitations" class="brief-refs">
          <span class="m gd-mono">{{ GAP_BRIEF_REF_LABEL }}</span>
          <button
            v-for="n in briefCitations.refs"
            :key="n"
            type="button"
            class="brief-ref gd-mono"
            :title="refTitle(n)"
            @click="openRef(n)"
          >#{{ n }}</button>
        </div>
      </template>
    </section>

    <section class="p-card">
      <div class="ttl">今日研判</div>
      <p class="why pre">{{ dailyBriefText || EMPTY_GENERIC }}</p>
      <span class="m gd-mono">{{ EMPTY_LLM }}</span>
    </section>

    <div class="p-sec"><div class="h">引用 TOP3</div></div>
    <GapEmptyState v-if="!top3.length" type="empty" :desc="EMPTY_GENERIC" />
    <button
      v-for="item in top3"
      :key="item.id"
      type="button"
      class="p-item quote"
      @click="openDetail(item.id)"
    >
      <span class="t">#{{ item.rank }} · GAP {{ item.gap }} · {{ item.title }}</span>
      <span class="m gd-mono">{{ indLabel(item.ind) }}</span>
    </button>

    <div class="p-sec"><div class="h">评分权重</div></div>
    <section class="p-card">
      <div v-for="w in weightRows" :key="w.label" class="rowline">
        <span>{{ w.label }}</span><b class="gd-mono">×{{ w.value }}</b>
      </div>
      <p class="why">{{ EMPTY_AI_WEIGHT }}</p>
      <p class="why">{{ GAP_FRESH_NOTE }}</p>
    </section>

    <section class="p-card">
      <div class="ttl">检索研判依据</div>
      <input v-model="query" class="ask" type="search" :placeholder="EMPTY_AI_INPUT" :aria-label="EMPTY_AI_INPUT" />
      <div v-if="query.trim()" class="hits">
        <p class="why">当前 48h 池内命中 {{ aiHits.length }} 条（按差值排序），点一条打开详情：</p>
        <button
          v-for="item in aiHits"
          :key="item.id"
          type="button"
          class="p-item quote"
          @click="openDetail(item.id)"
        >
          <span class="t">#{{ item.rank }} · GAP {{ item.gap }} · {{ titleOf(item) }}</span>
          <span class="m gd-mono">{{ indLabel(item.ind) }}</span>
        </button>
        <GapEmptyState v-if="!aiHits.length" type="empty" desc="当前 48h 池内没有匹配的事件；不编造研判依据" />
      </div>
      <p class="why">{{ EMPTY_AI_INPUT }}</p>
      <p class="why">{{ EMPTY_AI_PUSH }}</p>
    </section>
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
  GAP_BRIEF_REF_LABEL,
  GAP_BRIEF_REF_MISS,
  GAP_FRESH_NOTE,
  GAP_IND_MAP,
  GAP_WEIGHTS
} from '../../../config/gapdeskConfig'
import { GAP_OPEN_DETAIL_KEY, useGapDesk } from '../../../composables/useGapDesk'
import { useGapBriefAi } from '../../../composables/useGapBriefAi'
import { parseBriefCitations } from '../../../utils/gapdeskFormat'
import type { GapInd, RankedEvent } from '../../../types/gapdesk'

const { ranked, dailyBriefText, titleOf } = useGapDesk()
const {
  status, text, modelLabel, cached, error, keyInput, modelPick,
  configReady, canGenerate, freeModels, applyFreeModel, generate
} = useGapBriefAi()
const openDetail = inject(GAP_OPEN_DETAIL_KEY, (_id: number) => {})
const emit = defineEmits<{ navigate: [key: string] }>()

/** 与 PC PcAIView 同口径：只认末尾引用行，其余情况整段原文展示 */
const briefCitations = computed(() => parseBriefCitations(text.value))
function refEventOf(n: number): RankedEvent | null {
  return ranked.value.find((event) => event.rank === n) ?? null
}
function openRef(n: number): void {
  const event = refEventOf(n)
  if (event) openDetail(event.id)
}
function refTitle(n: number): string {
  const event = refEventOf(n)
  return event
    ? `#${n} · GAP ${event.gap} · ${titleOf(event)}；点击查看该事件详情`
    : `#${n} ${GAP_BRIEF_REF_MISS}`
}

/** 与 PC PcAIView 同口径：只查当前 48h 池，不查历史、不编造 */
const query = ref('')
const aiHits = computed(() => {
  const kw = query.value.trim().toLowerCase()
  if (!kw) return []
  return ranked.value
    .filter((item) => `${item.title} ${titleOf(item)} ${item.reason ?? ''}`.toLowerCase().includes(kw))
    .slice(0, 8)
})

const top3 = computed(() => ranked.value.slice(0, 3))
const weightRows = computed(() => [
  { label: '时间新鲜度', value: GAP_WEIGHTS.time },
  { label: '孤证加分', value: GAP_WEIGHTS.rare },
  { label: '影响面', value: GAP_WEIGHTS.impact },
  { label: '可执行性', value: GAP_WEIGHTS.action }
])
const indLabel = (ind: GapInd): string => GAP_IND_MAP[ind]?.label ?? '未分类'
</script>

<style scoped>
.mbview {
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-width: 0;
}
.back {
  align-self: flex-start;
  min-height: 44px;
  padding: 0 12px;
  border: 1px solid var(--gd-line);
  border-radius: var(--gd-r-nav);
  background: var(--gd-card);
  color: var(--gd-ink2);
  font-size: var(--gd-fs-panels);
  cursor: pointer;
}
.brief-card {
  border-color: color-mix(in srgb, var(--gd-brand) 35%, var(--gd-line));
}
.brief-run {
  width: 100%;
  min-height: 44px;
  margin: 8px 0;
  border: 1px solid var(--gd-brand);
  border-radius: var(--gd-r-nav);
  background: color-mix(in srgb, var(--gd-brand) 8%, var(--gd-card));
  color: var(--gd-brand);
  font-size: var(--gd-fs-panels);
  font-weight: 600;
  cursor: pointer;
}
.brief-run:disabled { opacity: 0.5; cursor: not-allowed; }
.brief-setup {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.brief-select,
.brief-key {
  width: 100%;
  min-height: 44px;
  padding: 0 10px;
  border: 1px solid var(--gd-line);
  border-radius: var(--gd-r-nav);
  background: var(--gd-sub);
  color: var(--gd-ink2);
  font-family: var(--gd-sans);
  font-size: var(--gd-fs-panels);
}
.brief-save {
  min-height: 44px;
  border: 1px solid var(--gd-line);
  border-radius: var(--gd-r-nav);
  background: var(--gd-sub);
  color: var(--gd-ink2);
  font-size: var(--gd-fs-panels);
  cursor: pointer;
}
.brief-error { color: #c0392b; }
.brief-text { white-space: pre-line; line-height: 1.7; }
/* 研判引用标签：移动端 44px 触控高度，窄屏自动折行 */
.brief-refs {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 8px;
}
.brief-ref {
  min-height: 44px;
  padding: 0 10px;
  border: 1px solid color-mix(in srgb, var(--gd-brand) 35%, var(--gd-line));
  border-radius: var(--gd-r-nav);
  background: color-mix(in srgb, var(--gd-brand) 6%, var(--gd-card));
  color: var(--gd-brand);
  font-size: var(--gd-fs-pill);
  cursor: pointer;
}
.brief-ref:hover {
  border-color: var(--gd-brand);
}
.pre {
  white-space: pre-line;
}
.m {
  font-size: var(--gd-fs-pill);
  color: var(--gd-ink3);
  overflow-wrap: anywhere;
}
.rowline {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  padding: 4px 0;
  font-size: var(--gd-fs-panels);
  color: var(--gd-ink2);
}
.ask {
  width: 100%;
  min-height: 44px;
  padding: 0 10px;
  border: 1px solid var(--gd-line);
  border-radius: var(--gd-r-nav);
  background: var(--gd-sub);
  color: var(--gd-ink2);
  font-family: var(--gd-sans);
  font-size: var(--gd-fs-panels);
  cursor: text;
}
.hits {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin: 8px 0;
}
.quote {
  width: 100%;
  min-height: 44px;
  text-align: left;
}
</style>
