<!--
  PC 命中率（侧栏 12）：没有回打表就没有兑现率。
  这里只放真值样本规模 / 时差中位，兑现率、收敛曲线、分布环图、明细一律留空并写明口径，
  已出圈条数仅作旁证——它不等于兑现率。
-->
<template>
  <div class="pcview">
    <GapHeroCards :items="heroItems" />

    <section class="panel">
      <div class="gh">
        <i class="bar" aria-hidden="true" />
        <span class="t">回打收敛曲线</span>
        <span class="r">{{ EMPTY_ECHO }}</span>
      </div>
      <svg class="gd-null-line" viewBox="0 0 320 36" aria-hidden="true">
        <line x1="4" y1="30" x2="316" y2="30" />
      </svg>
      <p class="panel-note">{{ EMPTY_ECHO }}，不画收敛趋势。</p>
    </section>

    <section class="panel">
      <div class="gh">
        <i class="bar" aria-hidden="true" />
        <span class="t">兑现分布</span>
        <span class="r">{{ EMPTY_ECHO }}</span>
      </div>
      <div class="ring-wrap"><GapRing :value="Number.NaN" :size="84" /></div>
      <p class="panel-note">{{ EMPTY_ECHO }}</p>
    </section>

    <section class="panel">
      <div class="gh">
        <i class="bar" aria-hidden="true" />
        <span class="t">回打明细</span>
      </div>
      <GapEmptyState type="empty" :desc="EMPTY_ECHO" :reason="EMPTY_ECHO_RULE" />
    </section>

    <section class="panel">
      <div class="gh">
        <i class="bar" aria-hidden="true" />
        <span class="t">兑现口径</span>
      </div>
      <p class="panel-note">{{ EMPTY_ECHO_RULE }}</p>
      <div class="rowline">
        <span>已出圈条目（旁证）</span>
        <span class="v gd-mono">{{ stats.massHit }}</span>
      </div>
      <p class="panel-note">已出圈不等于兑现，旁证不能替代回打表。</p>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import GapEmptyState from '../../../components/gapdesk/GapEmptyState.vue'
import GapHeroCards from '../../../components/gapdesk/GapHeroCards.vue'
import GapRing from '../../../components/gapdesk/GapRing.vue'
import { EMPTY_ECHO, EMPTY_ECHO_RULE } from '../../../config/gapdeskConfig'
import { useGapDesk } from '../../../composables/useGapDesk'

const { ranked, lagMedianDays, stats } = useGapDesk()

/** 有效样本只数 L0/L1：L2 是存档层，不进兑现口径 */
const sampleN = computed(() => ranked.value.filter((row) => row.tier === 'L0' || row.tier === 'L1').length)

const heroItems = computed(() => [
  { label: '兑现率', n: '—', d: EMPTY_ECHO, grad: true },
  { label: '有效样本 N', n: sampleN.value, d: '仅统计 L0/L1', grad: false },
  {
    label: '时差中位（天）',
    n: lagMedianDays.value === null ? '—' : lagMedianDays.value,
    d: '源间实测',
    grad: false
  },
  { label: '待验证队列', n: '积累中', d: EMPTY_ECHO, grad: false }
])
</script>

<style scoped>
.gd-null-line {
  display: block;
  width: 100%;
  height: 36px;
}
.gd-null-line line {
  stroke: var(--gd-line2);
  stroke-width: 1;
  stroke-dasharray: 4 4;
}
.ring-wrap {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 6px 0;
}
</style>
