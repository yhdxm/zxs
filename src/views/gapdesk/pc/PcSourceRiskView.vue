<!--
  PC 信源分级（侧栏 11）：分数 / 状态 / 健康度条全部来自 gap_sources 实测。
  网关读不到信源表时只给空态，绝不填演示健康分。
-->
<template>
  <div class="pcview">
    <section class="panel">
      <div class="gh">
        <i class="bar" aria-hidden="true" />
        <span class="t">信源分级总览</span>
        <span class="r gd-mono">{{ sourceGrade.total }} 路</span>
      </div>
      <p class="panel-note">
        mass 探针归可靠层、tech 归探针层，其余归官方层；分数由该源 ok/(ok+fail) 实测得出，
        无样本显示待验证而不是 0 分。
      </p>
    </section>

    <GapEmptyState
      v-if="!sourceGrade.total"
      type="empty"
      :desc="EMPTY_SR_GATEWAY"
      :reason="EMPTY_SR_GATEWAY"
    />

    <template v-else>
      <div class="grade-cards">
        <GapSourceGradeCard
          v-for="agg in sourceGrade.aggs"
          :key="agg.tier"
          :tier="agg.tier"
          :label="TIER_LABEL[agg.tier]"
          :count="agg.count"
          :avg="agg.avg"
        />
      </div>

      <section class="panel">
        <div class="gh">
          <i class="bar" aria-hidden="true" />
          <span class="t">信源体检表</span>
          <span class="r gd-mono">DOWN {{ sourceGrade.down }}</span>
        </div>
        <div class="sr-scroll">
          <table class="sr-table">
            <thead>
              <tr>
                <th>信源</th>
                <th>分级</th>
                <th>健康度</th>
                <th>分数</th>
                <th>状态</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in sourceGrade.rows" :key="row.id">
                <td class="gd-mono">{{ row.name }}</td>
                <td>{{ TIER_LABEL[row.tier] }}</td>
                <td>
                  <span class="sr-track">
                    <i :style="{ width: `${row.score ?? 0}%`, background: barColor(row.score) }" />
                  </span>
                </td>
                <td class="gd-mono">{{ row.score === null ? '—' : row.score }}</td>
                <td class="gd-mono" :class="{ 'is-down': row.status === 'down' }" :title="row.msg">
                  {{ STATUS_LABEL[row.status] }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section v-if="sourceGrade.down > 0" class="panel down-note">
        <div class="gh">
          <i class="bar" aria-hidden="true" />
          <span class="t">DOWN 提示</span>
          <span class="b">{{ sourceGrade.down }}</span>
        </div>
        <p class="panel-note">
          {{ sourceGrade.down }} 路抓取失败，已在体检表标红；冷却源按网关 msg 近似识别，不伪装成在线。
        </p>
      </section>
    </template>
  </div>
</template>

<script setup lang="ts">
import GapEmptyState from '../../../components/gapdesk/GapEmptyState.vue'
import GapSourceGradeCard from '../../../components/gapdesk/GapSourceGradeCard.vue'
import { EMPTY_SR_GATEWAY } from '../../../config/gapdeskConfig'
import { useGapDesk } from '../../../composables/useGapDesk'
import type { SourceGradeTier, SourceStatusKind } from '../../../types/gapdesk'

const { sourceGrade } = useGapDesk()

const TIER_LABEL: Readonly<Record<SourceGradeTier, string>> = {
  reliable: '稳定可靠层',
  official: '官方主源层',
  probe: '波动探针层'
}
const STATUS_LABEL: Readonly<Record<SourceStatusKind, string>> = {
  ok: '在线',
  warn: '降级',
  down: 'DOWN',
  cool: '冷却',
  idle: '待验证'
}

function barColor(score: number | null): string {
  if (score === null) return 'var(--gd-line2)'
  if (score >= 85) return 'var(--gd-ok)'
  if (score >= 70) return 'var(--gd-warn)'
  return 'var(--gd-gap)'
}
</script>

<style scoped>
.grade-cards {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}
.sr-scroll {
  overflow-x: auto;
}
.sr-table {
  width: 100%;
  border-collapse: collapse;
  font-size: var(--gd-fs-panels);
  color: var(--gd-ink2);
}
.sr-table th,
.sr-table td {
  padding: 7px 8px;
  text-align: left;
  border-bottom: 1px solid var(--gd-line);
  white-space: nowrap;
}
.sr-table th {
  font-size: var(--gd-fs-kick);
  color: var(--gd-ink3);
  font-weight: 500;
}
.sr-table td.is-down {
  color: var(--gd-gap);
  font-weight: 700;
}
.sr-track {
  display: block;
  width: 84px;
  height: 6px;
  border-radius: 999px;
  background: var(--gd-sub);
  overflow: hidden;
}
.sr-track i {
  display: block;
  height: 100%;
  border-radius: 999px;
}
.down-note {
  border-color: color-mix(in srgb, var(--gd-gap) 32%, var(--gd-line));
  background: color-mix(in srgb, var(--gd-gap) 4%, var(--gd-card));
}
</style>
