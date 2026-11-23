<!--
  PC-06 差值评分模式
  把「四维原始分」与「GAP 池内分位」摊开讲清楚；示例事件从 ranked 真实事件里选，
  不造样例、不写死分数。
-->
<template>
  <div class="pcview">
    <div class="gh">
      <i class="bar" aria-hidden="true" />
      <span class="t">差值评分模式 · 两把尺子</span>
      <span class="r">四维可复算 · GAP 可横向比较</span>
    </div>

    <section class="panel">
      <h4>示例事件（来自当前事件池）</h4>
      <p class="sub">切换任意真实事件查看它的四维分解；没有事件时显示空态。</p>
      <select v-if="ranked.length" class="pctl picker" :value="selectedEvent?.id" @change="onChange">
        <option v-for="item in ranked" :key="item.id" :value="item.id">#{{ item.rank }} · GAP {{ item.gap }} · {{ item.title.slice(0, 40) }}</option>
      </select>
      <GapEmptyState v-else type="empty" :desc="EMPTY_GENERIC" />
    </section>

    <template v-if="selectedEvent">
      <section class="panel large">
        <h4>{{ selectedEvent.title }}</h4>
        <p class="sub">{{ selectedEvent.ind }} · {{ selectedEvent.tier }} · 池内第 {{ selectedEvent.rank }} 位</p>
        <GapScoreBlock :event="selectedEvent" />
      </section>

      <div class="grid2">
        <section class="panel">
          <h4>四维权重（原始分满 90）</h4>
          <div v-for="w in WEIGHTS" :key="w.label" class="rowline">
            <span>{{ w.label }}</span>
            <span class="v">×{{ w.weight.toFixed(2) }}</span>
          </div>
          <p class="panel-note">四维各 0–25，按上表加权求和得原始分。权重与采集脚本同源，界面只展示、不改写。</p>
        </section>
        <section class="panel">
          <h4>GAP 分位映射（54–97）</h4>
          <p class="panel-note">
            原始分在真实分布上挤在窄带，直接展示区分不出强弱。所以把原始分在完整事件池内做分位映射，
            得到 54–97 的展示 GAP，用于跨行业比较；L0/L1/L2 同样按池内分位切分（前 10% / 10–40% / 其余）。
            <br /><br />事件池在增长，所以同一条事件的 GAP 与层级都可能随新条目进入而变动 —— 这是实时相对分层的正常表现，不是数据抖动。
          </p>
        </section>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import GapEmptyState from '../../../components/gapdesk/GapEmptyState.vue'
import GapScoreBlock from '../../../components/gapdesk/GapScoreBlock.vue'
import { EMPTY_GENERIC, GAP_WEIGHTS } from '../../../config/gapdeskConfig'
import { useGapDesk } from '../../../composables/useGapDesk'

const { ranked } = useGapDesk()
const selectedId = ref<number | null>(null)

const selectedEvent = computed(() => {
  const id = selectedId.value
  return id == null ? (ranked.value[0] ?? null) : (ranked.value.find((item) => item.id === id) ?? ranked.value[0] ?? null)
})

function onChange(event: Event): void {
  const value = Number((event.target as HTMLSelectElement).value)
  if (Number.isFinite(value)) selectedId.value = value
}

/** 权重唯一真源在 config.GAP_WEIGHTS，这里只做展示映射，避免与采集脚本漂移 */
const WEIGHTS = [
  { label: '时效', weight: GAP_WEIGHTS.time },
  { label: '稀缺', weight: GAP_WEIGHTS.rare },
  { label: '影响', weight: GAP_WEIGHTS.impact },
  { label: '可行动', weight: GAP_WEIGHTS.action }
] as const
</script>

<style scoped>
.picker {
  max-width: 100%;
}
.large {
  padding: 18px 20px;
}
</style>
