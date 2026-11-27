<!--
  今日最大差横幅（PC 与移动共用同一组件）
  ---------------------------------------------------------------
  数据源唯一：useGapDesk().ranked[0]（已完成筛选/排序/分档的全量排行第一条）。
  标题走 store 的 titleOf()，有译文显示译文；无事件时整条不渲染，不做空横幅。
  点击沿用宿主 provide 的 GAP_OPEN_DETAIL_KEY，不自建抽屉。
-->
<template>
  <button
    v-if="top"
    type="button"
    class="gd-topgap"
    :class="{ 'gd-topgap-compact': compact }"
    :title="bannerTip"
    :aria-label="bannerTip"
    @click="open"
  >
    <span class="tg-kicker gd-mono">今日最大差</span>
    <span class="tg-rank gd-mono">#{{ top.rank }}</span>
    <span class="tg-score gd-mono">GAP {{ top.gap }}</span>
    <span class="tg-title">{{ displayTitle }}</span>
    <span class="tg-tier gd-mono" :class="`t-${top.tier}`">{{ top.tier }}</span>
    <span class="tg-go gd-mono">看详情 →</span>
  </button>
</template>

<script setup lang="ts">
import { computed, inject } from 'vue'
import { GAP_OPEN_DETAIL_KEY, useGapDesk } from '../../composables/useGapDesk'

withDefaults(defineProps<{ compact?: boolean }>(), { compact: false })

const { ranked, titleOf } = useGapDesk()
/** 宿主 GapDeskView provide；单独挂载时退化为无操作，不能抛错 */
const openDetail = inject(GAP_OPEN_DETAIL_KEY, (_id: number) => {})

/** 排行第一条就是今日最大差，不在组件内重排、不另算一套口径 */
const top = computed(() => ranked.value[0] ?? null)
const displayTitle = computed<string>(() => (top.value ? titleOf(top.value) : ''))
const bannerTip = computed<string>(() =>
  top.value
    ? `今日最大差 #${top.value.rank} · GAP ${top.value.gap} · ${top.value.tier} · ${displayTitle.value}；点击查看该差值详情`
    : ''
)

function open(): void {
  const id = top.value?.id
  if (id == null) return
  openDetail(id)
}
</script>

<style scoped>
.gd-topgap {
  display: flex;
  align-items: center;
  gap: 9px;
  width: 100%;
  min-width: 0;
  min-height: 44px;
  padding: 8px 12px;
  border: 1px solid var(--gd-line);
  border-left: 3px solid var(--gd-gap);
  border-radius: var(--gd-r-panel);
  background: var(--gd-card);
  box-shadow: var(--gd-sh-xs);
  text-align: left;
  cursor: pointer;
  flex-shrink: 0;
  transition: border-color .18s var(--gd-ease), box-shadow .18s var(--gd-ease);
}
.gd-topgap:hover {
  border-color: var(--gd-brand);
  box-shadow: var(--gd-sh-sm);
}
.tg-kicker {
  flex: none;
  padding: 3px 8px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--gd-gap) 12%, transparent);
  color: var(--gd-gap);
  font-size: var(--gd-fs-pill);
  font-weight: 700;
  white-space: nowrap;
}
.tg-rank {
  flex: none;
  font-size: var(--gd-fs-pill);
  color: var(--gd-ink3);
  white-space: nowrap;
}
.tg-score {
  flex: none;
  font-size: var(--gd-fs-why);
  font-weight: 700;
  color: var(--gd-gap);
  white-space: nowrap;
}
.tg-title {
  flex: 1;
  min-width: 0;
  font-size: var(--gd-fs-why);
  color: var(--gd-ink);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.tg-tier {
  flex: none;
  padding: 2px 6px;
  border-radius: var(--gd-r-nav);
  background: var(--gd-sub);
  color: var(--gd-ink2);
  font-size: var(--gd-fs-pill);
  white-space: nowrap;
}
.tg-tier.t-L0 {
  background: color-mix(in srgb, var(--gd-gap) 12%, transparent);
  color: var(--gd-gap);
}
.tg-tier.t-L1 {
  background: color-mix(in srgb, var(--gd-warn) 16%, transparent);
  color: var(--gd-warn);
}
.tg-go {
  flex: none;
  font-size: var(--gd-fs-pill);
  color: var(--gd-brand);
  white-space: nowrap;
}
/* 移动紧凑版：允许标题折到第二行，但整条仍是可点的 44px 触控区 */
.gd-topgap-compact {
  gap: 6px;
  padding: 7px 9px;
  flex-wrap: wrap;
}
.gd-topgap-compact .tg-title {
  flex: 1 1 100%;
  order: 5;
  white-space: normal;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}
.gd-topgap-compact .tg-go {
  order: 6;
  margin-left: auto;
}
</style>
