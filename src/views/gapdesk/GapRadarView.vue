<!--
  雷达视图（8 行业全景 + 行业时间线）
  ---------------------------------------------------------------
  数据来源：useGapDesk() 的 `pool`（已按筛选/时间窗过滤）→ 本视图派生行业聚合。
  为什么在视图里派生而不是加进 store：行业聚合只这一个视图用，
  放进 store 会让「每个视图都算一遍」变成「全局都算一遍」。
  行业卡的订阅开关写 gap_subscriptions，订阅后筛选栏的「仅订阅」才可用。
-->
<template>
  <div class="grv">
    <!-- 行业卡 -->
    <div class="grv-grid">
      <article
        v-for="row in industries"
        :key="row.ind.key"
        class="grv-card"
        :class="{ 'grv-card-empty': row.count === 0 }"
      >
        <header class="grv-head">
          <span class="grv-name">
            <i class="grv-dot" :style="{ background: row.ind.color }" />
            {{ row.ind.label }}
          </span>
          <el-switch
            class="grv-sub"
            size="small"
            :model-value="mySubs.includes(row.ind.key)"
            :disabled="!userId"
            :title="userId ? '订阅后可在筛选栏选「仅订阅」' : '未登录，订阅不可用'"
            @update:model-value="() => toggleSubscription(row.ind.key)"
          />
        </header>

        <div class="grv-nums">
          <div class="grv-num-cell">
            <b>{{ row.count }}</b><span>条</span>
          </div>
          <div class="grv-num-cell">
            <b>{{ row.avgGap }}</b><span>均分</span>
          </div>
          <div class="grv-num-cell">
            <b class="grv-hot">{{ row.maxGap }}</b><span>峰值</span>
          </div>
          <div class="grv-num-cell">
            <b class="grv-ok">{{ row.massHit }}</b><span>出圈</span>
          </div>
        </div>

        <button
          v-if="row.top1"
          type="button"
          class="grv-top1"
          :title="row.top1.title"
          @click="emit('open', row.top1.id)"
        >
          <span class="grv-top1-gap">{{ row.top1.gap }}</span>
          <span class="grv-top1-title">{{ row.top1.title }}</span>
        </button>
        <p v-else class="grv-none">该行业在窗口内暂无事件（不是没热度的 0，而是没采到）</p>
      </article>
    </div>

    <!-- 行业时间线 -->
    <section class="grv-timeline">
      <div class="grv-tl-head">
        <h3 class="grv-h3">事件时间线</h3>
        <span class="grv-h3-note">按发布时间倒序 · 分「今天更早 / 近 24 小时 / 近 48 小时」</span>
      </div>

      <GapEmptyState v-if="!pool.length" type="empty" desc="当前筛选下没有事件，可放宽行业或时间窗" />

      <div v-for="bucket in timeline" v-else :key="bucket.label" class="grv-bucket">
        <div class="grv-bucket-head">
          <span class="grv-bucket-lb">{{ bucket.label }}</span>
          <span class="grv-bucket-n">{{ bucket.items.length }} 条</span>
        </div>
        <ul class="grv-items">
          <li v-for="e in bucket.items" :key="e.id">
            <button type="button" class="grv-item" @click="emit('open', e.id)">
              <span class="grv-item-time">{{ fmtClock(e.ts_published || e.ts_first_seen) }}</span>
              <i class="grv-item-dot" :style="{ background: colorOf(e.ind) }" />
              <span class="grv-item-title">{{ e.title }}</span>
              <span class="grv-item-gap">{{ e.gap }}</span>
            </button>
          </li>
        </ul>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import GapEmptyState from '../../components/gapdesk/GapEmptyState.vue'
import { GAP_IND, GAP_IND_MAP } from '../../config/gapdeskConfig'
import { useGapDesk } from '../../composables/useGapDesk'
import { fmtClock } from '../../utils/gapdeskFormat'
import type { GapEventRow, GapInd } from '../../types/gapdesk'

const emit = defineEmits<{ (e: 'open', eventId: number): void }>()

const { pool, mySubs, userId, toggleSubscription } = useGapDesk()

interface IndustryRow {
  ind: (typeof GAP_IND)[number]
  count: number
  avgGap: number
  maxGap: number
  massHit: number
  top1: GapEventRow | null
}

/** 行业聚合：条数 / 均分 / 峰值 / 出圈数 / Top1 */
const industries = computed<IndustryRow[]>(() =>
  GAP_IND.map((ind) => {
    const list = pool.value.filter((e) => e.ind === ind.key)
    const count = list.length
    const sum = list.reduce((a, e) => a + e.gap, 0)
    const sorted = [...list].sort((a, b) => b.gap - a.gap)
    return {
      ind,
      count,
      avgGap: count ? Math.round(sum / count) : 0,
      maxGap: sorted[0]?.gap ?? 0,
      massHit: list.filter((e) => (e.mass_heat ?? 0) > 0).length,
      top1: sorted[0] ?? null
    }
  })
)

/** 行业色点（用于时间线小圆点） */
function colorOf(ind: GapInd): string {
  return GAP_IND_MAP[ind]?.color ?? '#909399'
}

/**
 * 时间线分桶规则（按「距今」小时数，使用 ts_published，缺失时退回 ts_first_seen）：
 *   < 12h  → 今天更早（当日已发生的）
 *   12-24h → 近 24 小时
 *   24-48h → 近 48 小时
 * 用固定小时数而不是自然日：跨端时区不同，自然日边界会让两人看到不同分组。
 */
const timeline = computed(() => {
  const now = Date.now()
  const buckets: { label: string; items: GapEventRow[] }[] = [
    { label: '今天更早', items: [] },
    { label: '近 24 小时', items: [] },
    { label: '近 48 小时', items: [] }
  ]
  const sorted = [...pool.value].sort(
    (a, b) => (b.ts_published || b.ts_first_seen) - (a.ts_published || a.ts_first_seen)
  )
  for (const e of sorted) {
    const ts = e.ts_published || e.ts_first_seen
    const ageH = (now - ts) / 3600000
    if (ageH < 12) buckets[0]?.items.push(e)
    else if (ageH < 24) buckets[1]?.items.push(e)
    else buckets[2]?.items.push(e)
  }
  return buckets.filter((b) => b.items.length > 0)
})
</script>

<style scoped>
.grv {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-width: 0;
}
.grv-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
}
.grv-card {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px 14px;
  background: var(--surface, #fff);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 10px;
  min-width: 0;
}
.grv-card-empty {
  opacity: 0.72;
}
.grv-head {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}
.grv-name {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 12px;
  font-weight: 600;
  color: var(--text-strong, #303133);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.grv-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  flex: none;
}
.grv-sub {
  margin-left: auto;
  flex: none;
}
.grv-nums {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 6px;
}
.grv-num-cell {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  min-width: 0;
}
.grv-num-cell b {
  font-size: 15px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  color: var(--text-strong, #303133);
  line-height: 1.2;
}
.grv-num-cell span {
  font-size: 10px;
  color: var(--text-muted, #909399);
}
.grv-hot {
  color: #ff3358 !important;
}
.grv-ok {
  color: #0ba36f !important;
}
.grv-top1 {
  display: flex;
  align-items: baseline;
  gap: 6px;
  width: 100%;
  padding: 6px 8px;
  min-height: 44px;
  border: 1px dashed var(--el-border-color-lighter);
  border-radius: 8px;
  background: var(--surface-soft, #fafafa);
  text-align: left;
  cursor: pointer;
}
.grv-top1-gap {
  flex: none;
  font-size: 12px;
  font-weight: 700;
  color: #ff3358;
  font-variant-numeric: tabular-nums;
}
.grv-top1-title {
  font-size: 11px;
  line-height: 1.4;
  color: var(--text-muted, #606266);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.grv-none {
  margin: 0;
  font-size: 11px;
  line-height: 1.5;
  color: #c0c4cc;
}
.grv-timeline {
  padding: 12px 14px;
  background: var(--surface, #fff);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 10px;
}
.grv-tl-head {
  display: flex;
  align-items: baseline;
  gap: 8px;
  margin-bottom: 8px;
}
.grv-h3 {
  margin: 0;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-strong, #303133);
}
.grv-h3-note {
  font-size: 10px;
  color: var(--text-muted, #909399);
}
.grv-bucket {
  margin-top: 10px;
}
.grv-bucket-head {
  display: flex;
  align-items: baseline;
  gap: 8px;
  padding-bottom: 4px;
  border-bottom: 1px solid var(--el-border-color-lighter);
}
.grv-bucket-lb {
  font-size: 11px;
  font-weight: 600;
  color: var(--text-strong, #303133);
}
.grv-bucket-n {
  font-size: 10px;
  color: var(--text-muted, #909399);
  font-variant-numeric: tabular-nums;
}
.grv-items {
  margin: 0;
  padding: 0;
  list-style: none;
}
.grv-item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  min-height: 44px;
  padding: 4px 2px;
  border: none;
  border-bottom: 1px dashed var(--el-border-color-lighter);
  background: none;
  text-align: left;
  cursor: pointer;
  min-width: 0;
}
.grv-item:hover .grv-item-title {
  color: var(--el-color-primary);
}
.grv-item-time {
  flex: none;
  width: 82px;
  font-size: 11px;
  color: var(--text-muted, #909399);
  font-variant-numeric: tabular-nums;
}
.grv-item-dot {
  flex: none;
  width: 6px;
  height: 6px;
  border-radius: 50%;
}
.grv-item-title {
  flex: 1;
  min-width: 0;
  font-size: 12px;
  color: var(--text-strong, #303133);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.grv-item-gap {
  flex: none;
  font-size: 12px;
  font-weight: 700;
  color: #ff3358;
  font-variant-numeric: tabular-nums;
}
@media (max-width: 768px) {
  .grv-grid {
    grid-template-columns: minmax(0, 1fr);
  }
  .grv-item-time {
    width: 68px;
  }
}
</style>
