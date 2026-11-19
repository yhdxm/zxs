<!--
  时差视图（单事件双轨传播曲线 + 首触表）
  ---------------------------------------------------------------
  数据来源：useGapDesk() 的 `pool`（候选：lag_h > 0 的事件）与 `platforms`（该事件的平台首触）。
  曲线点由**真实首触时刻**构造：每个触达时刻累加一次热度（累计传播曲线），
  没有触达的平台一律不参与，绝不为了「画得好看」插值出不存在的时间点。
  x 轴窗口按该事件自身的最早/最晚触达自适应（不写死 24h）。
-->
<template>
  <div class="glv">
    <GapEmptyState
      v-if="!lagEvents.length"
      type="empty"
      title="还没有算得出时差的事件"
      desc="时差需要同一事件至少在两个源上出现、且都带真实发布时间；榜单类条目（ts=0）无法参与"
    />

    <template v-else>
      <!-- 选择器 + 右侧指标 -->
      <div class="glv-bar">
        <el-select
          v-model="selectedId"
          class="glv-select"
          size="small"
          filterable
          placeholder="选择事件（按 lag_h 降序前 50）"
        >
          <el-option
            v-for="e in lagEvents"
            :key="e.id"
            :value="e.id"
            :label="`${(e.lag_h ?? 0).toFixed(1)}h · ${e.title}`"
          />
        </el-select>
        <div class="glv-metrics">
          <span class="glv-metric"><b>{{ selectedLag }}</b><i>lag_h</i></span>
          <span class="glv-metric"><b :class="divClass">{{ selectedDiv }}</b><i>双轨差值</i></span>
        </div>
      </div>

      <!-- 曲线 -->
      <section class="glv-card">
        <div class="glv-card-head">
          <h3 class="glv-h3">传播曲线</h3>
          <span class="glv-h3-note">x 轴按该事件最早/最晚触达自适应 · 面积 = 可变现窗口</span>
        </div>
        <GapLagCurve v-if="curvePoints.length >= 2" :points="curvePoints" />
        <GapEmptyState
          v-else
          type="empty"
          title="这条事件只有一个触达时刻"
          desc="只有一个时间点画不出传播过程；等事件在更多平台/信源出现后即可比较"
        />
      </section>

      <!-- 平台首触表 -->
      <section class="glv-card">
        <div class="glv-card-head">
          <h3 class="glv-h3">平台首触</h3>
          <span class="glv-h3-note">未触达就写「未触达」，不显示 0 分钟</span>
        </div>
        <table class="glv-table">
          <thead>
            <tr>
              <th scope="col">平台</th>
              <th scope="col">首触时刻</th>
              <th scope="col">距今</th>
              <th scope="col">热度</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in platformRows" :key="row.key">
              <th scope="row">{{ row.label }}</th>
              <td>{{ row.ts ? fmtClock(row.ts) : '未触达' }}</td>
              <td :class="{ 'glv-none': !row.ts }">{{ row.ts ? fmtAgo(row.ts) : '—' }}</td>
              <td :class="{ 'glv-none': row.heat == null }">{{ row.heat == null ? '—' : row.heat }}</td>
            </tr>
          </tbody>
        </table>
        <p class="glv-tip">
          0 线说明：图表里的平直段表示该层在这段时间内没有任何触达记录，不是「热度为零」的结论。
        </p>
      </section>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import GapLagCurve from '../../components/gapdesk/GapLagCurve.vue'
import GapEmptyState from '../../components/gapdesk/GapEmptyState.vue'
import { useGapDesk } from '../../composables/useGapDesk'
import { fmtAgo, fmtClock } from '../../utils/gapdeskFormat'

/** 曲线点结构与 GapLagCurve 的 props 契约一致（结构类型匹配，无需跨 SFC 引类型） */
interface LagPoint {
  t: number
  ins: number
  pub: number
}

const { pool, platforms, gapDiv } = useGapDesk()

/** 候选：lag_h > 0，降序前 50（选择器不该有几百项） */
const lagEvents = computed(() =>
  pool.value
    .filter((e) => (e.lag_h ?? 0) > 0)
    .sort((a, b) => (b.lag_h ?? 0) - (a.lag_h ?? 0))
    .slice(0, 50)
)

const selectedId = ref<number | null>(null)

/** 列表变化（筛选/刷新）时保证选中项仍有效 */
watch(
  lagEvents,
  (list) => {
    if (!list.length) {
      selectedId.value = null
      return
    }
    if (!list.some((e) => e.id === selectedId.value)) selectedId.value = list[0]?.id ?? null
  },
  { immediate: true }
)

const selected = computed(() => lagEvents.value.find((e) => e.id === selectedId.value) ?? null)

const selectedLag = computed(() => (selected.value?.lag_h ?? 0).toFixed(1))
const selectedDiv = computed(() => (selected.value ? gapDiv(selected.value) : 0))
const divClass = computed(() => (selectedDiv.value > 0 ? 'glv-hot' : selectedDiv.value < 0 ? 'glv-ok' : ''))

/* ---------- 平台首触 ---------- */
interface TrackRow {
  key: string
  label: string
  ts: number
  heat: number | null
}

/** 展示顺序固定：先大众三榜，再决策圈/主流/海外 */
const PLATFORM_ORDER = ['微博', '知乎', '抖音', '行业决策圈', '主流媒体', '海外'] as const

const rawTracks = computed(() => {
  const e = selected.value
  if (!e) return []
  return platforms.value
    .filter((p) => p.event_id === e.id)
    .map((p) => ({
      platform: p.platform ?? '',
      heat: p.heat ?? null,
      ts: p.first_touch_ts && p.first_touch_ts > 0 ? p.first_touch_ts : 0
    }))
})

/** 把「海外一手源 / 海外源」归一成「海外」，否则同一层会出现两行 */
function normKey(name: string): string {
  if (name.startsWith('海外')) return '海外'
  return name
}

const platformRows = computed<TrackRow[]>(() => {
  const map = new Map<string, { heat: number | null; ts: number }>()
  for (const t of rawTracks.value) {
    const k = normKey(t.platform)
    const prev = map.get(k)
    // 同一层可能有多行（不同平台），取「最早首触 + 最大热度」
    if (!prev) map.set(k, { heat: t.heat, ts: t.ts })
    else
      map.set(k, {
        heat: Math.max(prev.heat ?? 0, t.heat ?? 0),
        ts: prev.ts && t.ts ? Math.min(prev.ts, t.ts) : prev.ts || t.ts
      })
  }
  return PLATFORM_ORDER.map((k) => {
    const hit = map.get(k)
    return { key: k, label: k === '海外' ? '海外一手源' : k, ts: hit?.ts ?? 0, heat: hit?.heat ?? null }
  })
})

/* ---------- 曲线点（累计传播） ---------- */
const INS_PLATFORMS = new Set(['行业决策圈', '主流媒体', '海外'])

const curvePoints = computed<LagPoint[]>(() => {
  const rows = platformRows.value.filter((r) => r.ts > 0)
  if (!rows.length) return []

  const times = [...new Set(rows.map((r) => r.ts))].sort((a, b) => a - b)
  const base = times[0] as number

  return times.map((t) => {
    let ins = 0
    let pub = 0
    for (const r of rows) {
      if (r.ts > t) continue
      const h = r.heat ?? 0
      if (INS_PLATFORMS.has(r.key)) ins = Math.max(ins, h)
      else pub = Math.max(pub, h)
    }
    return { t: (t - base) / 3600000, ins, pub }
  })
})
</script>

<style scoped>
.glv {
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-width: 0;
}
.glv-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  background: var(--surface, #fff);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 10px;
  min-width: 0;
}
.glv-select {
  flex: 1;
  min-width: 0;
  max-width: 560px;
}
.glv-metrics {
  display: flex;
  align-items: baseline;
  gap: 14px;
  margin-left: auto;
}
.glv-metric {
  display: inline-flex;
  align-items: baseline;
  gap: 4px;
}
.glv-metric b {
  font-size: 17px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  color: var(--text-strong, #303133);
}
.glv-metric i {
  font-style: normal;
  font-size: 10px;
  color: var(--text-muted, #909399);
}
.glv-hot {
  color: #ff3358 !important;
}
.glv-ok {
  color: #0ba36f !important;
}
.glv-card {
  padding: 12px 14px;
  background: var(--surface, #fff);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 10px;
  min-width: 0;
}
.glv-card-head {
  display: flex;
  align-items: baseline;
  gap: 8px;
  margin-bottom: 8px;
}
.glv-h3 {
  margin: 0;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-strong, #303133);
}
.glv-h3-note {
  font-size: 10px;
  color: var(--text-muted, #909399);
}
.glv-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}
.glv-table th,
.glv-table td {
  padding: 9px 8px;
  text-align: left;
  border-bottom: 1px solid var(--el-border-color-lighter);
  font-variant-numeric: tabular-nums;
}
.glv-table thead th {
  font-size: 11px;
  font-weight: 600;
  color: var(--text-muted, #909399);
}
.glv-table tbody th {
  font-weight: 500;
  color: var(--text-strong, #303133);
}
.glv-none {
  color: #c0c4cc;
}
.glv-tip {
  margin: 8px 0 0;
  font-size: 10px;
  line-height: 1.6;
  color: var(--text-muted, #909399);
}
@media (max-width: 768px) {
  .glv-bar {
    flex-direction: column;
    align-items: stretch;
    gap: 8px;
  }
  .glv-metrics {
    margin-left: 0;
    justify-content: flex-end;
  }
  .glv-table th,
  .glv-table td {
    padding: 9px 4px;
  }
}
</style>
