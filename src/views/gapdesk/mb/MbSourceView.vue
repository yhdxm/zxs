<!--
  移动 单源 tab：健康摘要读 store.health 真值，信源目录读 bySource。
  silent 源写「今日未说话」，不把沉默误报成故障；无证据链给空态。
-->
<template>
  <div class="mbview">
    <section class="summary">
      <div><b class="gd-mono">{{ health.ok }}/{{ health.total }}</b><span>路正常</span></div>
      <div><b class="gd-mono">{{ health.down.length }}</b><span>DOWN</span></div>
    </section>
    <p v-if="health.total === 0" class="gd-mono">{{ EMPTY_WAIT }}：还没有信源健康数据。</p>

    <template v-for="section in layerGroups" :key="section.key">
      <div class="p-sec"><div class="h">{{ section.label }} · {{ section.groups.length }} 路</div></div>
      <button v-for="group in section.groups" :key="group.source" type="button" class="p-item" @click="toggle(group.source)">
        <span class="top">
          <i class="dot" :style="{ background: group.silent ? 'var(--gd-line2)' : 'var(--gd-ok)' }" aria-hidden="true" />
          <span class="t">{{ group.source }}</span>
          <span class="gd-mono n">{{ group.events.length }}</span>
        </span>
        <span class="m gd-mono">{{ group.silent ? '今日未说话' : `今日参与 ${group.events.length} 条差值` }}</span>
        <span v-if="opened === group.source" class="m">信源在跑，只是今天它没说话；这是正常状态。</span>
      </button>
    </template>

    <GapEmptyState v-if="!groups.length" type="empty" :desc="EMPTY_WAIT" />
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import GapEmptyState from '../../../components/gapdesk/GapEmptyState.vue'
import { EMPTY_WAIT, GAP_LAYER_MAP, GAP_LAYER_ORDER } from '../../../config/gapdeskConfig'
import { useGapDesk } from '../../../composables/useGapDesk'

const { health, bySource } = useGapDesk()
const opened = ref('')

const groups = computed(() => bySource.value)

/** 与 PC 同源：5 层顺序/标签取自 config，null 层归「未知层」，不漏 rare */
const layerGroups = computed(() => {
  const sections = GAP_LAYER_ORDER.map((key) => ({
    key: key as string,
    label: GAP_LAYER_MAP[key].label,
    groups: groups.value.filter((group) => group.layer === key)
  }))
  sections.push({
    key: 'unknown',
    label: '未知层',
    groups: groups.value.filter((group) => !group.layer)
  })
  return sections.filter((section) => section.groups.length > 0)
})
function toggle(source: string): void {
  opened.value = opened.value === source ? '' : source
}
</script>

<style scoped>
.mbview {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.summary {
  display: flex;
  gap: 10px;
}
.summary > div {
  flex: 1;
  background: var(--gd-card);
  border: 1px solid var(--gd-line);
  border-radius: var(--gd-r-panel);
  padding: 11px 12px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.summary b {
  font-size: var(--gd-fs-hcard);
  color: var(--gd-ink);
}
.summary span {
  font-size: var(--gd-fs-pill);
  color: var(--gd-ink3);
}
.top {
  display: flex;
  align-items: center;
  gap: 7px;
  min-width: 0;
}
.dot {
  width: 8px;
  height: 8px;
  border-radius: 999px;
  flex-shrink: 0;
}
.n {
  margin-left: auto;
  font-size: var(--gd-fs-panels);
  color: var(--gd-ink2);
}
</style>
