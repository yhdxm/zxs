<!--
  四维分解条（b_json = [时效, 稀缺, 影响, 可行动]，每维 0-25）
  ---------------------------------------------------------------
  为什么要把四维摊开：差值台的分数必须「可复算」。
  用户看到 gap=92 时会问「凭什么」，这四条就是他自己的答案 —— 所以每段都带真实数值，
  不做只有颜色的装饰条。
-->
<template>
  <div class="gsb">
    <div v-for="(seg, i) in segments" :key="i" class="gsb-seg">
      <div class="gsb-head">
        <span class="gsb-label">{{ seg.label }}</span>
        <span class="gsb-val">{{ seg.value }}</span>
      </div>
      <div class="gsb-track">
        <i class="gsb-fill" :style="{ width: `${seg.pct}%`, background: seg.color }" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { safeJson } from '../../utils/gapdeskFormat'

const props = withDefaults(
  defineProps<{
    /** 四维分值，顺序固定 [时效, 稀缺, 影响, 可行动]；Realtime 回传时可能是 JSON 字符串 */
    b: [number, number, number, number] | string
    /** 自定义维度名，缺省用业务口径的四个中文名 */
    labels?: string[]
  }>(),
  {
    // 数组默认值必须用工厂函数，否则所有实例共享同一个引用
    labels: () => ['时效', '稀缺', '影响', '可行动']
  }
)

/** 每维满分（与采集侧打分口径一致：四维各 0-25） */
const DIM_MAX = 25

/** 四段配色：时效红 / 稀缺橙 / 影响蓝 / 可行动绿，深浅区分但不抢标题 */
const COLORS = ['#FF3358', '#F59E0B', '#0EA5E9', '#0BA36F'] as const

/** b_json 经 Realtime 回来可能是字符串；解析失败或非 4 元组一律兜底全 0，绝不让 .map 崩掉整页 */
const rawB = computed<unknown[]>(() => {
  const v = typeof props.b === 'string' ? safeJson<unknown>(props.b, null) : props.b
  return Array.isArray(v) && v.length === 4 ? v : [0, 0, 0, 0]
})

const segments = computed(() =>
  rawB.value.map((item, i) => {
    const n = Number(item)
    const v = Number.isFinite(n) ? Math.max(0, Math.min(DIM_MAX, Math.round(n))) : 0
    return {
      label: props.labels[i] ?? `维度${i + 1}`,
      value: v,
      pct: Math.round((v / DIM_MAX) * 100),
      color: COLORS[i] ?? COLORS[0]
    }
  })
)
</script>

<style scoped>
.gsb {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px;
  width: 100%;
}
.gsb-seg {
  min-width: 0;
}
.gsb-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 4px;
  margin-bottom: 3px;
}
.gsb-label {
  font-size: 11px;
  color: var(--text-muted, #909399);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.gsb-val {
  font-size: 12px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  color: var(--text-strong, #303133);
}
.gsb-track {
  height: 5px;
  border-radius: 3px;
  background: var(--surface-soft, rgba(0, 0, 0, 0.05));
  overflow: hidden;
}
.gsb-fill {
  display: block;
  height: 100%;
  border-radius: 3px;
  transition: width 0.35s ease;
}

/* 移动端：两行两列，避免 4 段挤成一条看不清 */
@media (max-width: 768px) {
  .gsb {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 6px 10px;
  }
}
</style>
