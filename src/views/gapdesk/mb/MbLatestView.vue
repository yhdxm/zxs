<!--
  移动-01 最新信息
  与 PC-01 同一份 store 口径：L0 优先、日期胶囊来自 dateBands，卡片为移动 p-card。
-->
<template>
  <div class="mbview">
    <div class="p-sec"><div class="h">二级入口</div></div>
    <div class="entries">
      <button
        v-for="entry in ENTRIES"
        :key="entry.key"
        type="button"
        class="entry"
        @click="emit('navigate', entry.key)"
      >
        <b>{{ entry.label }}</b>
        <span class="gd-mono">{{ entry.desc }}</span>
      </button>
    </div>

    <div class="p-sec">
      <div class="h">L0 · 今日必看 <b class="gd-mono">{{ l0.length }}</b></div>
    </div>
    <article v-for="item in l0" :key="item.id" class="p-card t-L0" @click="openDetail(item.id)">
      <div class="mhead">
        <i class="dot" :style="{ background: indColor(item.ind) }" aria-hidden="true" />
        <span class="m">{{ indLabel(item.ind) }}</span>
        <span class="gd-mono score">{{ item.gap }}</span>
        <span class="m gd-mono">#{{ item.rank }}</span>
      </div>
      <div class="ttl">{{ item.title }}</div>
      <p v-if="item.reason" class="why">{{ item.reason }}</p>
      <GapDualTrack compact :ins-heat="item.ins_heat ?? 0" :pub-heat="item.pub_heat ?? 0" :gap="item.gap" />
      <div class="ft">
        <span>{{ fmtAgo(item.ts_published || item.ts_first_seen) }}</span>
        <span>{{ item.src_count }} 路源</span>
      </div>
      <div class="row" @click.stop>
        <button type="button" @click="openDetail(item.id)">详情</button>
        <button type="button" :class="{ on: laterIds.includes(item.id) }" @click="toggleLater(item.id)">稍后读</button>
        <button type="button" :class="{ on: favorites.includes(item.id) }" @click="toggleFavoriteEvent(item.id)">喜欢</button>
      </div>
    </article>

    <p v-if="l0.length" class="end gd-mono">以上是今日全部必看</p>
    <GapEmptyState v-if="!ranked.length" type="empty" />

    <template v-if="rest.length">
      <div class="p-sec"><div class="h">L1 / L2 · 按评分排序 <b class="gd-mono">{{ rest.length }}</b></div></div>
      <article v-for="item in rest" :key="item.id" class="p-card" :class="`t-${item.tier}`" @click="openDetail(item.id)">
        <div class="mhead">
          <i class="dot" :style="{ background: indColor(item.ind) }" aria-hidden="true" />
          <span class="m">{{ indLabel(item.ind) }}</span>
          <span class="gd-mono score">{{ item.gap }}</span>
        </div>
        <div class="ttl">{{ item.title }}</div>
        <div class="ft"><span>{{ item.tier }}</span><span>{{ fmtAgo(item.ts_published || item.ts_first_seen) }}</span></div>
      </article>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, inject } from 'vue'
import GapDualTrack from '../../../components/gapdesk/GapDualTrack.vue'
import GapEmptyState from '../../../components/gapdesk/GapEmptyState.vue'
import { GAP_IND_MAP } from '../../../config/gapdeskConfig'
import { GAP_OPEN_DETAIL_KEY, useGapDesk } from '../../../composables/useGapDesk'
import { fmtAgo } from '../../../utils/gapdeskFormat'
import type { GapInd } from '../../../types/gapdesk'

const { ranked, favorites, laterIds, toggleLater, toggleFavoriteEvent } = useGapDesk()
const openDetail = inject(GAP_OPEN_DETAIL_KEY, (_id: number) => {})
const emit = defineEmits<{ navigate: [key: string] }>()

/** 5 个新模块走二级页，底 tab 仍是原来 5 个 */
const ENTRIES = [
  { key: 'm-brief', label: '简报', desc: '每日研判' },
  { key: 'm-echo', label: '命中率', desc: '回打口径' },
  { key: 'm-source-risk', label: '信源', desc: '分级体检' },
  { key: 'm-cycle', label: '周期', desc: '供给日历' },
  { key: 'm-ai', label: 'AI', desc: '权重与引用' }
] as const

const l0 = computed(() => ranked.value.filter((item) => item.tier === 'L0'))
const rest = computed(() => ranked.value.filter((item) => item.tier !== 'L0'))

const indColor = (ind: GapInd): string => GAP_IND_MAP[ind]?.color ?? 'var(--gd-ink3)'
const indLabel = (ind: GapInd): string => GAP_IND_MAP[ind]?.label ?? '未分类'
</script>

<style scoped>
.mbview {
  display: flex;
  flex-direction: column;
  gap: 11px;
  min-width: 0;
}
.mbview > * {
  flex-shrink: 0;
}
.mhead {
  display: flex;
  align-items: center;
  gap: 7px;
  min-width: 0;
}
.dot {
  width: 7px;
  height: 7px;
  border-radius: 999px;
  flex-shrink: 0;
}
.m {
  font-family: var(--gd-mono);
  font-size: var(--gd-fs-pill);
  color: var(--gd-ink3);
}
.score {
  margin-left: auto;
  font-size: var(--gd-fs-gscore);
  font-weight: 700;
  color: var(--gd-gap);
}
.row {
  display: flex;
  gap: 7px;
  margin: 2px -3px -3px;
}
.row button {
  flex: 1;
  min-height: 44px;
  border: 1px solid var(--gd-line);
  border-radius: var(--gd-r-nav);
  background: var(--gd-card);
  color: var(--gd-ink2);
  font-family: var(--gd-sans);
  font-size: var(--gd-fs-panels);
  cursor: pointer;
}
.row button.on {
  background: var(--gd-grad);
  border-color: transparent;
  color: var(--gd-card);
}
.entries {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(96px, 1fr));
  gap: 8px;
}
.entry {
  min-width: 0;
  min-height: 44px;
  padding: 7px 8px;
  border: 1px solid var(--gd-line);
  border-radius: var(--gd-r-nav);
  background: var(--gd-card);
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 2px;
  text-align: left;
  cursor: pointer;
}
.entry b {
  font-size: var(--gd-fs-panels);
  color: var(--gd-ink);
}
.entry span {
  font-size: var(--gd-fs-kick);
  color: var(--gd-ink3);
  overflow-wrap: anywhere;
}
.end {
  text-align: center;
  font-size: var(--gd-fs-pill);
  color: var(--gd-ink3);
  padding: 4px 0;
}
</style>
