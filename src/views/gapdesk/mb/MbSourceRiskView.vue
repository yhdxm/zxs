<!--
  移动 m-source-risk · 信源分级（只读二级页）
  三档摘要、健康 ok/total、DOWN 数都来自 sourceGrade；读不到网关就只给空态。
-->
<template>
  <div class="mbview">
    <button type="button" class="back gd-mono" @click="emit('navigate', 'm-latest')">← 返回</button>

    <div class="stats">
      <div><b class="gd-mono">{{ health.ok }}/{{ health.total }}</b><span>路正常</span></div>
      <div><b class="gd-mono" :class="{ down: sourceGrade.down > 0 }">{{ sourceGrade.down }}</b><span>DOWN</span></div>
    </div>

    <GapEmptyState
      v-if="!sourceGrade.total"
      type="empty"
      :desc="EMPTY_SR_GATEWAY"
      :reason="EMPTY_SR_GATEWAY"
    />

    <template v-else>
      <div class="p-sec"><div class="h">三档分级摘要</div></div>
      <section v-for="agg in sourceGrade.aggs" :key="agg.tier" class="p-card">
        <div class="mhead">
          <span class="ttl">{{ TIER_LABEL[agg.tier] }}</span>
          <b class="gd-mono n">{{ agg.count }}</b>
        </div>
        <p class="why gd-mono">{{ agg.avg === null ? '—/待验证' : `均健康分 ${agg.avg}` }}</p>
      </section>

      <div class="p-sec"><div class="h">体检口径</div></div>
      <section class="p-card">
        <p class="why">分数由各源 ok/(ok+fail) 实测得出；冷却态按网关 msg 近似识别，不伪装成在线。</p>
      </section>
    </template>
  </div>
</template>

<script setup lang="ts">
import GapEmptyState from '../../../components/gapdesk/GapEmptyState.vue'
import { EMPTY_SR_GATEWAY } from '../../../config/gapdeskConfig'
import { useGapDesk } from '../../../composables/useGapDesk'
import type { SourceGradeTier } from '../../../types/gapdesk'

const { sourceGrade, health } = useGapDesk()
const emit = defineEmits<{ navigate: [key: string] }>()

const TIER_LABEL: Readonly<Record<SourceGradeTier, string>> = {
  reliable: '稳定可靠层',
  official: '官方主源层',
  probe: '波动探针层'
}
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
.stats b.down {
  color: var(--gd-gap);
}
.stats span {
  font-size: var(--gd-fs-pill);
  color: var(--gd-ink3);
}
.mhead {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
  min-width: 0;
}
.n {
  font-size: var(--gd-fs-gscore);
  color: var(--gd-ink2);
}
</style>
