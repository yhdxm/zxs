<!--
  暗流视图（单源 + 未出圈 = 最值钱的那一批）
  ---------------------------------------------------------------
  数据来源：useGapDesk() 的 `underground`（`src_count<=1 && mass_heat===0`，按 gap 降序前 12）。
  来源名不在 feed 里（证据链是子表、按需拉取），所以这里对前 12 条各拉一次
  `loadEventDetail`，并做模块级缓存：切走再切回不重复请求。
  条数 < 3 时挂黄色横幅——这是「信源退化」的早期信号，不能只靠用户自己发现。
-->
<template>
  <div class="guv">
    <!-- hero 汇总 -->
    <div class="guv-hero">
      <div class="guv-hero-cell">
        <b class="guv-num">{{ underground.length }}</b>
        <span class="guv-lb">单源未出圈</span>
      </div>
      <div class="guv-hero-cell">
        <b class="guv-num">{{ avgLag }}</b>
        <span class="guv-lb">平均时差 h</span>
      </div>
      <div class="guv-hero-cell guv-hero-wide">
        <b class="guv-srcs">{{ topSources }}</b>
        <span class="guv-lb">主要来源（按证据链聚合）</span>
      </div>
    </div>

    <!-- 信源退化横幅 -->
    <div v-if="underground.length < 3" class="guv-warn">
      <strong>信源退化</strong>
      <span>
        当前仅 {{ underground.length }} 条单源高影响事件，低于健康水位（3 条）。
        建议扩源或检查上游是否大面积 DOWN（右侧「信源健康」可看明细）。
      </span>
    </div>

    <GapEmptyState
      v-if="!underground.length"
      type="empty"
      title="当前没有单源未出圈的事件"
      desc="出现「只有一个信源报道、且大众榜零命中」的事件时会落在这里；这需要时间积累"
    />

    <!-- 列表：卡片上方补一行「仅 1 路信源 · 来源名」 -->
    <div v-else class="guv-list">
      <div v-for="e in underground" :key="e.id" class="guv-item">
        <div class="guv-tag">
          <span class="guv-tag-main">仅 1 路信源</span>
          <span class="guv-tag-src">{{ nameOf(e.id) }}</span>
        </div>
        <GapEventCard
          :event="e"
          :favorite="isFavorite(e.id)"
          @open="(id: number) => emit('open', id)"
          @favorite="(id: number) => toggleFavoriteEvent(id)"
        />
      </div>
    </div>
  </div>
</template>

<script lang="ts">
/**
 * 证据链来源名缓存（模块级，跨视图切换保留）。
 * 不做成 store 状态：只有这一屏用，放 store 会污染全局 state 的生命周期。
 */
const evidenceCache = new Map<number, string[]>()
</script>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import GapEventCard from '../../components/gapdesk/GapEventCard.vue'
import GapEmptyState from '../../components/gapdesk/GapEmptyState.vue'
import { loadEventDetail } from '../../services/gapdeskService'
import { useGapDesk } from '../../composables/useGapDesk'
import type { GapEventRow } from '../../types/gapdesk'

const emit = defineEmits<{ (e: 'open', eventId: number): void }>()

const { underground, isFavorite, toggleFavoriteEvent } = useGapDesk()

/** eventId → 该事件的来源名列表（只取前 12 条，控制请求数） */
const sourceNames = ref<Record<number, string[]>>({})

/** 拉取前 12 条的证据链来源名；已缓存的直接复用 */
async function hydrate(list: GapEventRow[]): Promise<void> {
  const targets = list.slice(0, 12)
  const next: Record<number, string[]> = { ...sourceNames.value }
  await Promise.all(
    targets.map(async (e) => {
      const cached = evidenceCache.get(e.id)
      if (cached) {
        next[e.id] = cached
        return
      }
      const res = await loadEventDetail(e.id)
      const names = [
        ...new Set(res.data.map((s) => s.source_name).filter((x): x is string => Boolean(x)))
      ]
      evidenceCache.set(e.id, names)
      next[e.id] = names
    })
  )
  sourceNames.value = next
}

watch(underground, (list) => void hydrate(list), { immediate: true })

function nameOf(id: number): string {
  const names = sourceNames.value[id]
  if (!names || !names.length) return '来源加载中…'
  return names.join('、')
}

/** 平均时差（小时，一位小数） */
const avgLag = computed(() => {
  const list = underground.value.filter((e) => (e.lag_h ?? 0) > 0)
  if (!list.length) return '0.0'
  const sum = list.reduce((a, e) => a + (e.lag_h ?? 0), 0)
  return (sum / list.length).toFixed(1)
})

/** 主要来源：把已加载的证据链来源名做频次聚合，取前 3 */
const topSources = computed(() => {
  const freq = new Map<string, number>()
  for (const names of Object.values(sourceNames.value)) {
    for (const n of names) freq.set(n, (freq.get(n) ?? 0) + 1)
  }
  if (!freq.size) return '—'
  return [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([name, n]) => `${name}(${n})`)
    .join('、')
})
</script>

<style scoped>
.guv {
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-width: 0;
}
.guv-hero {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 20px;
  padding: 12px 16px;
  background: linear-gradient(180deg, rgba(255, 51, 88, 0.05), transparent);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 10px;
}
.guv-hero-cell {
  display: flex;
  flex-direction: column;
  gap: 1px;
  min-width: 80px;
}
.guv-hero-wide {
  min-width: 220px;
  flex: 1;
}
.guv-num {
  font-size: 22px;
  font-weight: 800;
  line-height: 1.15;
  color: #ff3358;
  font-variant-numeric: tabular-nums;
}
.guv-srcs {
  font-size: 12px;
  font-weight: 600;
  line-height: 1.4;
  color: var(--text-strong, #303133);
}
.guv-lb {
  font-size: 10px;
  color: var(--text-muted, #909399);
}
.guv-warn {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 10px 12px;
  border-radius: 8px;
  border: 1px solid rgba(217, 119, 6, 0.32);
  background: rgba(217, 119, 6, 0.1);
  font-size: 11px;
  line-height: 1.6;
  color: #b45309;
}
.guv-warn strong {
  flex: none;
  font-weight: 700;
}
.guv-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 12px;
}
.guv-item {
  display: flex;
  flex-direction: column;
  gap: 5px;
  min-width: 0;
}
.guv-tag {
  display: flex;
  align-items: center;
  gap: 6px;
  padding-left: 2px;
  font-size: 10px;
}
.guv-tag-main {
  flex: none;
  padding: 1px 6px;
  border-radius: 4px;
  background: rgba(255, 51, 88, 0.1);
  color: #ff3358;
  font-weight: 600;
}
.guv-tag-src {
  color: var(--text-muted, #909399);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
@media (max-width: 768px) {
  .guv-list {
    grid-template-columns: minmax(0, 1fr);
  }
  .guv-hero {
    gap: 14px;
  }
}
</style>
