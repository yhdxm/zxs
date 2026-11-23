<!--
  移动-05 价格：GAP_PLAN 四档纵向卡；只展示方案，不做计费。
-->
<template>
  <div class="mbview">
    <div class="p-sec"><div class="h">工作台二级入口</div></div>
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

    <div class="p-sec"><div class="h">套餐与报价 · 仅展示，不做计费</div></div>
    <section v-for="plan in GAP_PLAN" :key="plan.key" class="p-card plan" :class="{ hot: plan.key === 'team' }">
      <div class="top">
        <span class="nm">{{ plan.name }}</span>
        <span v-if="plan.key === 'team'" class="gd-pill gd-pill-live gd-mono">主推·转化率高</span>
      </div>
      <div class="price gd-mono">{{ plan.priceLabel }}</div>
      <p class="why">最少 {{ plan.minSeats }} 席</p>
      <div v-for="feature in plan.features" :key="feature" class="feature">· {{ feature }}</div>
      <div v-if="plan.key === 'enterprise'" class="m gd-mono">按需 / 年框</div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { EMPTY_EXPORT, EMPTY_PUSH, GAP_PLAN } from '../../../config/gapdeskConfig'

const emit = defineEmits<{ navigate: [key: string] }>()

/** 工作台三入口直接复用 PC 已有页面口径，移动端不再造一套功能 */
const ENTRIES = [
  { key: 'alert', label: '订阅提醒', desc: EMPTY_PUSH },
  { key: 'report', label: '导出报告', desc: EMPTY_EXPORT },
  { key: 'seats', label: '团队席位', desc: '用量与套餐' }
] as const
</script>

<style scoped>
.mbview {
  display: flex;
  flex-direction: column;
  gap: 11px;
}
.entries {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(104px, 1fr));
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
.plan.hot {
  border-color: var(--gd-brand);
  box-shadow: var(--gd-sh-sm);
}
.top {
  display: flex;
  align-items: center;
  gap: 7px;
  min-width: 0;
}
.nm {
  font-size: var(--gd-fs-phead);
  font-weight: 700;
  color: var(--gd-ink);
}
.price {
  font-size: var(--gd-fs-hcard);
  font-weight: 700;
  color: var(--gd-brand);
}
.feature {
  font-size: var(--gd-fs-panels);
  line-height: 1.6;
  color: var(--gd-ink2);
}
.m {
  font-size: var(--gd-fs-pill);
  color: var(--gd-ink3);
}
</style>
