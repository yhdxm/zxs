<!--
  差值台 GAPDESK · 信源分级三卡
  均健康分来自 gap_sources 的 ok/fail 实测；无样本显示「—/待验证」，
  绝不把 0 分当成实测值。色阶只消费 --gd-* 令牌。
-->
<template>
  <div class="gd-grade-card">
    <div class="gd-grade-top">
      <span class="gd-grade-label">{{ label }}</span>
      <span class="gd-grade-count gd-mono">{{ count }}</span>
    </div>
    <div class="gd-grade-score gd-mono" :style="{ color: scoreColor }">{{ scoreText }}</div>
    <div class="gd-grade-tier gd-mono">{{ tier }}</div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { SourceGradeTier } from '../../types/gapdesk'

interface Props {
  tier: SourceGradeTier
  label: string
  count: number
  avg: number | null
}
const props = defineProps<Props>()

const validAvg = computed<number | null>(() =>
  typeof props.avg === 'number' && Number.isFinite(props.avg) ? props.avg : null
)
const scoreText = computed<string>(() =>
  validAvg.value === null ? '—/待验证' : String(validAvg.value)
)
const scoreColor = computed<string>(() => {
  const v = validAvg.value
  if (v === null) return 'var(--gd-ink3)'
  if (v >= 85) return 'var(--gd-ok)'
  if (v >= 70) return 'var(--gd-warn)'
  return 'var(--gd-gap)'
})
</script>

<style scoped>
.gd-grade-card {
  flex: 1 1 140px;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 12px 13px;
  background: var(--gd-card);
  border: 1px solid var(--gd-line);
  border-radius: var(--gd-r-gcard);
  box-shadow: var(--gd-sh-xs);
}
.gd-grade-top {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
}
.gd-grade-label {
  font-size: var(--gd-fs-why);
  color: var(--gd-ink2);
}
.gd-grade-count {
  font-size: var(--gd-fs-pill);
  color: var(--gd-ink3);
}
.gd-grade-score {
  font-size: var(--gd-fs-hcard);
  font-weight: 700;
  line-height: 1;
}
.gd-grade-tier {
  font-size: var(--gd-fs-pill);
  color: var(--gd-ink3);
}
</style>
