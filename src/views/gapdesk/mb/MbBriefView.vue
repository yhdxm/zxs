<!--
  移动 m-brief · 今日简报（只读二级页）
  数据全部来自与 PC 同一份 store；回打没有样本就只写口径，不画假柱。
-->
<template>
  <div class="mbview">
    <button type="button" class="back gd-mono" @click="emit('navigate', 'm-latest')">← 返回</button>

    <div class="stats">
      <div><b class="gd-mono">{{ tierCounts.L0 }}</b><span>L0 · 必看</span></div>
      <div><b class="gd-mono">{{ tierCounts.L1 }}</b><span>L1 · 关注</span></div>
      <div><b class="gd-mono">{{ lagMedianHours === null ? '—' : lagMedianHours }}</b><span>时差中位（小时）</span></div>
      <div><b class="gd-mono">—</b><span>兑现率 · {{ EMPTY_ECHO }}</span></div>
    </div>

    <section class="p-card">
      <div class="ttl">AI 今日研判</div>
      <p class="why pre">{{ dailyBriefText || EMPTY_GENERIC }}</p>
      <span class="m gd-mono">{{ EMPTY_LLM }}</span>
    </section>

    <div class="p-sec"><div class="h">今日 L0 必看 · {{ l0.length }}</div></div>
    <GapEmptyState v-if="!l0.length" type="empty" :desc="EMPTY_GENERIC" />
    <section v-for="item in l0" :key="item.id" class="p-card t-L0" @click="openDetail(item.id)">
      <div class="mhead">
        <span class="m">{{ indLabel(item.ind) }}</span>
        <span class="gd-mono score">{{ item.gap }}</span>
      </div>
      <div class="ttl">{{ item.title }}</div>
      <p v-if="item.reason" class="why">{{ item.reason }}</p>
      <div class="ft gd-mono">#{{ item.rank }} · {{ item.src_count }} 路源</div>
    </section>

    <div class="p-sec"><div class="h">行业活跃 TOP5</div></div>
    <section v-if="topInds.length" class="p-card">
      <div v-for="row in topInds" :key="row.key" class="rowline">
        <span>{{ row.label }}</span><b class="gd-mono">{{ row.count }}</b>
      </div>
    </section>
    <p v-else class="m gd-mono">{{ EMPTY_GENERIC }}</p>

    <div class="p-card">
      <div class="ttl">回打收敛</div>
      <p class="why">{{ EMPTY_ECHO }}，不画假趋势。</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, inject } from 'vue'
import GapEmptyState from '../../../components/gapdesk/GapEmptyState.vue'
import { EMPTY_ECHO, EMPTY_GENERIC, EMPTY_LLM, GAP_IND, GAP_IND_MAP } from '../../../config/gapdeskConfig'
import { GAP_OPEN_DETAIL_KEY, useGapDesk } from '../../../composables/useGapDesk'
import type { GapInd } from '../../../types/gapdesk'

const { ranked, tierCounts, byIndustry, lagMedianHours, dailyBriefText } = useGapDesk()
const openDetail = inject(GAP_OPEN_DETAIL_KEY, (_id: number) => {})
/** 返回复用宿主 navigate 通道，不新造路由 */
const emit = defineEmits<{ navigate: [key: string] }>()

const l0 = computed(() => ranked.value.filter((item) => item.tier === 'L0'))
const topInds = computed(() =>
  GAP_IND.map((ind: { key: GapInd; label: string }) => ({
    key: ind.key,
    label: GAP_IND_MAP[ind.key]?.label ?? ind.label,
    count: byIndustry.value[ind.key]?.length ?? 0
  }))
    .filter((row) => row.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)
)
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
.stats {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}
.stats > div {
  min-width: 0;
  background: var(--gd-card);
  border: 1px solid var(--gd-line);
  border-radius: var(--gd-r-panel);
  padding: 10px 11px;
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.stats b {
  font-size: var(--gd-fs-hcard);
  color: var(--gd-ink);
}
.stats span {
  font-size: var(--gd-fs-pill);
  color: var(--gd-ink3);
  overflow-wrap: anywhere;
}
.mhead {
  display: flex;
  align-items: center;
  gap: 7px;
  min-width: 0;
}
.score {
  margin-left: auto;
  font-size: var(--gd-fs-gscore);
  font-weight: 700;
  color: var(--gd-gap);
}
.pre {
  white-space: pre-line;
}
.rowline {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  padding: 4px 0;
  font-size: var(--gd-fs-panels);
  color: var(--gd-ink2);
}
.m {
  font-size: var(--gd-fs-pill);
  color: var(--gd-ink3);
  overflow-wrap: anywhere;
}
</style>
