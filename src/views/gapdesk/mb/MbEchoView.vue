<!--
  移动 m-echo · 命中率（只读二级页）
  没有回打表就没有百分比；只展示真实样本规模与时差中位，口径全文保留。
-->
<template>
  <div class="mbview">
    <button type="button" class="back gd-mono" @click="emit('navigate', 'm-latest')">← 返回</button>

    <div class="stats">
      <div><b class="gd-mono">—</b><span>兑现率 · {{ EMPTY_ECHO }}</span></div>
      <div><b class="gd-mono">{{ sampleN }}</b><span>有效样本 N（L0+L1）</span></div>
      <div><b class="gd-mono">{{ lagMedianDays === null ? '—' : lagMedianDays }}</b><span>时差中位（天）</span></div>
      <div><b class="gd-mono">积累中</b><span>待验证队列</span></div>
    </div>

    <section class="p-card">
      <div class="ttl">回打收敛曲线</div>
      <p class="why">{{ EMPTY_ECHO }}，不画收敛趋势。</p>
    </section>

    <section class="p-card">
      <div class="ttl">兑现口径</div>
      <p class="why">{{ EMPTY_ECHO_RULE }}</p>
    </section>

    <section class="p-card">
      <div class="ttl">已出圈（旁证）</div>
      <p class="why"><b class="gd-mono">{{ stats.massHit }}</b> 条；已出圈不等于兑现，不能替代回打表。</p>
    </section>

    <section class="p-card">
      <div class="ttl">回打明细</div>
      <p class="why">{{ EMPTY_ECHO }}</p>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { EMPTY_ECHO, EMPTY_ECHO_RULE } from '../../../config/gapdeskConfig'
import { useGapDesk } from '../../../composables/useGapDesk'

const { ranked, lagMedianDays, stats } = useGapDesk()
const emit = defineEmits<{ navigate: [key: string] }>()
const sampleN = computed(() => ranked.value.filter((row) => row.tier === 'L0' || row.tier === 'L1').length)
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
  overflow-wrap: anywhere;
}
.stats span {
  font-size: var(--gd-fs-pill);
  color: var(--gd-ink3);
  overflow-wrap: anywhere;
}
</style>
