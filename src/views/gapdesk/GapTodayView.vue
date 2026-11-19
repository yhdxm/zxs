<!--
  今日视图（情报流首屏）
  ---------------------------------------------------------------
  数据来源：useGapDesk() 的 `top14`（pool 按 gap 降序前 14）与 `stats`（池内统计）。
  本视图不调用 loadFeed —— 单例 store 已经加载过，视图只做投影，
  否则切 tab 就会重复打请求（9 个视图 = 9 次全量拉取，移动端直接卡死）。
  卡片点击只 emit 给父级（GapDeskView）开抽屉，视图自身不持有抽屉状态。
-->
<template>
  <div class="gtv">
    <!-- 统计条 -->
    <div class="gtv-stats">
      <div class="gtv-cell">
        <span class="gtv-num">{{ top14.length }}</span>
        <span class="gtv-lb">Top14</span>
      </div>
      <div class="gtv-cell">
        <span class="gtv-num">{{ stats.count }}</span>
        <span class="gtv-lb">池内条数</span>
      </div>
      <div class="gtv-cell">
        <span class="gtv-num">{{ stats.avgGap }}</span>
        <span class="gtv-lb">均分</span>
      </div>
      <div class="gtv-cell">
        <span class="gtv-num gtv-num-hot">{{ stats.maxGap }}</span>
        <span class="gtv-lb">峰值</span>
      </div>
      <div class="gtv-cell">
        <span class="gtv-num gtv-num-ok">{{ stats.massHit }}</span>
        <span class="gtv-lb">已出圈</span>
      </div>
      <div class="gtv-cell gtv-cell-wide">
        <span class="gtv-num">{{ funnelText }}</span>
        <span class="gtv-lb">漏斗 原始 → 事件</span>
      </div>
      <el-button class="gtv-refresh" size="small" :loading="loading" @click="refresh">刷新</el-button>
    </div>

    <!-- 失败但无数据：交给统一失败态（有数据时失败只降级徽标，不打断浏览） -->
    <GapEmptyState
      v-if="!top14.length && error && !loading"
      type="error"
      action-text="重试"
      :detail="[`请求错误：${error}`]"
      @action="refresh"
    />
    <GapEmptyState v-else-if="loading && !top14.length" type="loading" />
    <GapEmptyState
      v-else-if="!top14.length"
      type="empty"
      title="当前筛选下没有事件"
      desc="差值阈值是 85（池内约前 25%）。可在筛选栏放宽行业或时间窗，或等待下一轮采集（每 30 分钟一次）"
      :detail="[
        `当前时间窗 ${filters.windowH}h · 命中 ${stats.count} 条`,
        stats.count > 0 ? `池内最高分 ${stats.maxGap}，低于阈值` : '池内为空：可能采集刚跑完、或全部被新鲜度闸门拦下'
      ]"
      action-text="重置筛选"
      @action="resetFilters"
    />

    <!-- 列表 -->
    <div v-else class="gtv-list">
      <GapEventCard
        v-for="e in top14"
        :key="e.id"
        :event="e"
        :favorite="isFavorite(e.id)"
        @open="(id: number) => emit('open', id)"
        @favorite="(id: number) => toggleFavoriteEvent(id)"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import GapEventCard from '../../components/gapdesk/GapEventCard.vue'
import GapEmptyState from '../../components/gapdesk/GapEmptyState.vue'
import { useGapDesk } from '../../composables/useGapDesk'

const emit = defineEmits<{ (e: 'open', eventId: number): void }>()

const { top14, stats, meta, filters, loading, error, isFavorite, toggleFavoriteEvent, resetFilters, load } =
  useGapDesk()

const funnelText = computed(() => {
  const f = meta.value?.funnel
  if (!f) return '—'
  return `${f.raw} → ${f.event}`
})

function refresh(): void {
  void load(true)
}
</script>

<style scoped>
.gtv {
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-width: 0;
}
.gtv-stats {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 14px;
  padding: 10px 14px;
  background: var(--surface, #fff);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 10px;
}
.gtv-cell {
  display: flex;
  flex-direction: column;
  gap: 1px;
  min-width: 52px;
}
.gtv-cell-wide {
  min-width: 108px;
}
.gtv-num {
  font-size: 17px;
  font-weight: 700;
  line-height: 1.2;
  font-variant-numeric: tabular-nums;
  color: var(--text-strong, #303133);
}
.gtv-num-hot {
  color: #ff3358;
}
.gtv-num-ok {
  color: #0ba36f;
}
.gtv-lb {
  font-size: 10px;
  color: var(--text-muted, #909399);
  white-space: nowrap;
}
.gtv-refresh {
  margin-left: auto;
  min-height: 44px;
}
.gtv-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 10px;
  min-width: 0;
}
@media (max-width: 768px) {
  .gtv-stats {
    gap: 10px 14px;
  }
  .gtv-list {
    grid-template-columns: minmax(0, 1fr);
  }
  .gtv-refresh {
    margin-left: 0;
  }
}
</style>
