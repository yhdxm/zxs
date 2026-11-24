<!--
  PC-05 传播路径
  样本取 ranked 中 GAP 分最高的一条真实事件；曲线 / 三榜 / 首触表全部取自
  platforms 与 evidences。没有历史序列就给 EMPTY_HISTORY 空态，不画假曲线。
-->
<template>
  <div class="pcview">
    <template v-if="!sample">
      <GapEmptyState type="empty" :desc="EMPTY_GENERIC" />
    </template>

    <template v-else>
      <div class="gh">
        <i class="bar" aria-hidden="true" />
        <span class="t">{{ sample.title.slice(0, 40) }}{{ sample.title.length > 40 ? '…' : '' }}</span>
        <span class="r">当前 GAP 分最高的一条 · 全部取自真实观测</span>
      </div>

      <section class="panel">
        <h4>决策圈 vs 大众 · 真实热度对比</h4>
        <p class="sub">未命中的平台显示「未命中」，不填估计数字；窗口结论只依据 mass_on / mass_heat 实测。</p>
        <div class="grid2">
          <div>
            <div class="colcap">决策圈 / 一手源</div>
            <div v-for="row in insRows" :key="row.name" class="rowline">
              <i class="dot" :style="{ background: 'var(--gd-gap)' }" aria-hidden="true" />
              <span>{{ row.name }}</span>
              <span class="track"><i :style="{ width: `${row.pct}%` }" /></span>
              <span class="v">{{ row.heat === null ? '未命中' : row.heat }}</span>
            </div>
            <p v-if="!insRows.length" class="panel-note">— 暂无决策圈平台热度数据。</p>
          </div>
          <div>
            <div class="colcap">大众三榜</div>
            <div v-for="row in massRows" :key="row.name" class="rowline">
              <i class="dot" :style="{ background: row.heat === null ? 'var(--gd-line2)' : 'var(--gd-warn)' }" aria-hidden="true" />
              <span>{{ row.name }}</span>
              <span class="track"><i :style="{ width: `${row.pct}%` }" /></span>
              <span class="v">{{ row.heat === null ? '未命中' : row.heat }}</span>
            </div>
            <p v-if="!massRows.length" class="panel-note">— 暂无大众三榜触达记录。</p>
          </div>
        </div>
      </section>

      <section class="panel window" :class="{ closed: (sample.mass_heat ?? 0) > 0 }">
        <p class="panel-note">
          <template v-if="(sample.mass_heat ?? 0) > 0">
            这条已外溢到大众榜（{{ sample.mass_on || '大众榜' }}，热度 {{ sample.mass_heat }}），
            可行动窗口已基本关闭 —— 它现在的价值是复盘，不是抢跑。
          </template>
          <template v-else>
            大众三榜实测 0 命中，说明这条目前只在决策圈 / 一手源内部流转，
            <b>窗口仍然打开</b>。是否可行动取决于它多久被大众平台追平，这由回打引擎持续测量，不靠预估。
          </template>
          <br />本条 GAP {{ sample.gap }} · 原始 {{ sample.gap_raw }}/90 · {{ sample.src_count }} 路源 · {{ sample.reason || '—' }}
        </p>
      </section>

      <div class="grid2">
        <section class="panel">
          <h4>双轨传播曲线</h4>
          <p class="sub">横轴为相对首触小时数 · 无有效样本时的空态见下方</p>
          <GapLagCurve v-if="curvePoints.length" :points="curvePoints" :width="480" :height="200" />
          <GapEmptyState v-else type="empty" :desc="EMPTY_HISTORY" />
        </section>

        <section class="panel">
          <h4>该事件的信源首触</h4>
          <p class="sub">谁先说 —— 全部为真实发布时间</p>
          <div v-for="row in firstTouchRows" :key="row.name" class="rowline">
            <i class="dot" :style="{ background: row.ts === null ? 'var(--gd-line2)' : 'var(--gd-cyan)' }" aria-hidden="true" />
            <span>{{ row.name }}</span>
            <span class="v">{{ row.ts === null ? '未触达' : row.ts }}</span>
          </div>
          <p v-if="!firstTouchRows.length" class="panel-note">— 该条暂无可列出的信源明细。</p>
          <p class="panel-note">全站时差中位 {{ lagMedianHours === null ? '—' : `${lagMedianHours} 小时` }}。</p>
        </section>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import GapEmptyState from '../../../components/gapdesk/GapEmptyState.vue'
import GapLagCurve from '../../../components/gapdesk/GapLagCurve.vue'
import { EMPTY_GENERIC, EMPTY_HISTORY, GAP_PLATFORM } from '../../../config/gapdeskConfig'
import { useGapDesk } from '../../../composables/useGapDesk'
import { fmtAgo } from '../../../utils/gapdeskFormat'

const { ranked, platforms, evidences, lagMedianHours } = useGapDesk()
const sample = computed(() => ranked.value[0] ?? null)

/** 大众探针平台唯一真源在 config.GAP_PLATFORM，不再就地抄第三份 */
const MASS_NAMES: readonly string[] = GAP_PLATFORM

interface HeatRow {
  name: string
  heat: number | null
  pct: number
}

const heatRows = computed<HeatRow[]>(() => {
  const id = sample.value?.id
  if (id == null) return []
  const rows = platforms.value.filter((p) => p.event_id === id)
  const max = Math.max(1, ...rows.map((p) => p.heat ?? 0))
  return rows.map((p) => {
    const heat = p.heat && p.heat > 0 ? p.heat : null
    return { name: p.platform ?? '未知平台', heat, pct: heat === null ? 0 : Math.round((heat / max) * 100) }
  })
})
const massRows = computed(() => heatRows.value.filter((row) => MASS_NAMES.includes(row.name)))
const insRows = computed(() => heatRows.value.filter((row) => !MASS_NAMES.includes(row.name)))

/** 曲线点：有 first_touch_ts 的平台，按相对首触小时排序；热度归一化到 0-100 */
const curvePoints = computed(() => {
  const id = sample.value?.id
  if (id == null) return []
  const rows = platforms.value
    .filter((p) => p.event_id === id && p.first_touch_ts && p.first_touch_ts > 0)
    .sort((a, b) => (a.first_touch_ts ?? 0) - (b.first_touch_ts ?? 0))
  if (rows.length < 2) return []
  const min = rows[0]?.first_touch_ts ?? 0
  const max = Math.max(1, ...rows.map((p) => p.heat ?? 0))
  return rows.map((p) => {
    const heat = Math.round(((p.heat ?? 0) / max) * 100)
    const isMass = MASS_NAMES.includes(p.platform ?? '')
    return {
      t: Math.round((((p.first_touch_ts ?? min) - min) / 3600000) * 10) / 10,
      ins: isMass ? 0 : heat,
      pub: isMass ? heat : 0
    }
  })
})

const firstTouchRows = computed(() => {
  const id = sample.value?.id
  if (id == null) return []
  return evidences.value
    .filter((row) => row.event_id === id)
    .map((row) => ({
      name: row.source_name || '未知来源',
      ts: row.publish_ts && row.publish_ts > 0 ? fmtAgo(row.publish_ts) : null
    }))
})
</script>

<style scoped>
.colcap {
  font-family: var(--gd-mono);
  font-size: var(--gd-fs-pill);
  color: var(--gd-ink3);
  margin-bottom: 4px;
}
.track {
  flex: 1;
  height: 8px;
  min-width: 40px;
  border-radius: 999px;
  background: var(--gd-line);
  overflow: hidden;
}
.track i {
  display: block;
  height: 100%;
  border-radius: 999px;
  background: var(--gd-grad);
}
.window {
  border-left: 3px solid var(--gd-gap);
}
.window.closed {
  border-left-color: var(--gd-ink3);
}
</style>
