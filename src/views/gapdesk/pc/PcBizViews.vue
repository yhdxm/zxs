<!--
  PC-08/09/10/11 工作台四合一（kind 分支）
  alert 读真实规则 / report 预览规则归纳 / seats 读当前用户用量 / pricing 展示固定套餐。
  全部不接假数据：无成员数据、未接推送、未接导出都明说。
-->
<template>
  <div class="pcview">
    <!-- 订阅提醒 -->
    <template v-if="kind === 'alert'">
      <div class="gh"><i class="bar" aria-hidden="true" /><span class="t">订阅提醒 · 规则</span><span class="b">{{ ruleLoaded ? ruleRows.length : '—' }}</span></div>
      <GapEmptyState v-if="!ruleRows.length" type="empty" :desc="EMPTY_PUSH" />
      <section v-for="rule in ruleRows" :key="rule.id" class="panel">
        <div class="row1">
          <b>{{ rule.name || '未命名规则' }}</b>
          <span class="gd-pill gd-pill-soft gd-mono">{{ rule.enabled ? '启用' : '停用' }}</span>
          <span class="gd-pill gd-pill-acc gd-mono">命中 {{ rule.hits ?? '—' }}</span>
        </div>
        <p class="panel-note gd-mono">
          ind=[{{ rule.dsl.ind.join(',') || '不限' }}] · dim=[{{ rule.dsl.dim.join(',') || '不限' }}] ·
          gap≥{{ rule.dsl.gapMin }} · src≤{{ rule.dsl.srcMax }} · {{ rule.dsl.windowH }}h · [{{ rule.channels.join(',') || '无渠道' }}]
        </p>
      </section>
      <p class="panel-note">{{ EMPTY_PUSH }}</p>
    </template>

    <!-- 导出报告 -->
    <template v-else-if="kind === 'report'">
      <div class="gh"><i class="bar" aria-hidden="true" /><span class="t">导出报告 · 预览</span><span class="r">{{ EMPTY_LLM }}</span></div>
      <section class="panel">
        <h4>今日研判预览</h4>
        <p class="sub">由当前事件池按固定规则归纳，预览即最终文案口径</p>
        <p class="panel-note report-text">{{ dailyBriefText || '— 当前无事件，无法生成研判。' }}</p>
      </section>
      <section class="panel">
        <h4>导出配置</h4>
        <div class="config-row">
          <label>范围 <select class="pctl"><option>当前筛选结果</option></select></label>
          <label>窗口 <select class="pctl"><option>近 48 小时</option></select></label>
          <label>模板 <select class="pctl"><option>规则归纳简报</option></select></label>
          <label>格式 <select class="pctl"><option>Markdown</option></select></label>
        </div>
        <div class="config-actions">
          <button type="button" class="pctl" disabled :title="EMPTY_EXPORT">生成 PDF</button>
          <button type="button" class="pctl" disabled :title="EMPTY_EXPORT">检索导出</button>
          <span class="gd-mono">{{ EMPTY_EXPORT }}</span>
        </div>
      </section>
      <GapEmptyState type="empty" :desc="EMPTY_EXPORT" :phase2="EMPTY_ARCHIVE" />
    </template>

    <!-- 团队席位 -->
    <template v-else-if="kind === 'seats'">
      <div class="gh"><i class="bar" aria-hidden="true" /><span class="t">团队席位 · 当前用量</span></div>
      <GapEmptyState v-if="!seatRows.length" type="empty" :desc="EMPTY_WAIT" />
      <section v-for="row in seatRows" :key="row.user_id" class="panel">
        <div class="row1">
          <b class="gd-mono">{{ gapPlanLabel(row.plan) }}</b>
          <span class="gd-pill gd-pill-acc gd-mono">席位 {{ row.seats ?? '—' }}</span>
        </div>
        <div class="rowline"><span>已用额度</span><span class="v">{{ row.quota_used ?? '—' }} / {{ row.quota_total ?? '—' }}</span></div>
        <p class="panel-note">用量来自 gap_seats 当前用户行，不推测他人数据。</p>
      </section>
      <GapEmptyState type="empty" title="成员" :desc="EMPTY_MEMBERS" />
    </template>

    <!-- 套餐与报价 -->
    <template v-else-if="kind === 'pricing'">
      <div class="gh"><i class="bar" aria-hidden="true" /><span class="t">套餐与报价</span><span class="r">仅展示方案，不做计费</span></div>
      <div class="plans">
        <section v-for="plan in GAP_PLAN" :key="plan.key" class="panel plan" :class="{ hot: plan.key === 'team' }">
          <div class="row1">
            <b>{{ plan.name }}</b>
            <span v-if="plan.key === 'team'" class="gd-pill gd-pill-live gd-mono">主推·转化率高</span>
          </div>
          <div class="price gd-mono">{{ plan.priceLabel }}</div>
          <p class="panel-note">最少 {{ plan.minSeats }} 席</p>
          <div v-for="feature in plan.features" :key="feature" class="rowline"><span>{{ feature }}</span></div>
          <div v-if="plan.key === 'enterprise'" class="panel-note gd-mono">按需 / 年框</div>
        </section>
      </div>
    </template>

    <GapEmptyState v-else type="empty" :desc="EMPTY_GENERIC" />
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import GapEmptyState from '../../../components/gapdesk/GapEmptyState.vue'
import {
  EMPTY_ARCHIVE,
  EMPTY_LLM,
  EMPTY_GENERIC,
  EMPTY_MEMBERS,
  EMPTY_PUSH,
  EMPTY_WAIT,
  EMPTY_EXPORT,
  GAP_PLAN,
  gapPlanLabel
} from '../../../config/gapdeskConfig'
import { loadSeats } from '../../../services/gapdeskService'
import { useGapDesk } from '../../../composables/useGapDesk'
import type { GapSeatRow } from '../../../types/gapdesk'

const props = defineProps<{ kind: 'alert' | 'report' | 'seats' | 'pricing' }>()
/** 规则读一次即可：与侧栏 06 计数同源，避免这里再发一遍 listRules */
const { dailyBriefText, ruleRows, ruleLoaded } = useGapDesk()

const seatRows = ref<GapSeatRow[]>([])

onMounted(async () => {
  if (props.kind === 'seats') seatRows.value = (await loadSeats()).data
})
</script>

<style scoped>
.report-text {
  white-space: pre-line;
}
.config-row,
.config-actions {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
  font-size: var(--gd-fs-panels);
  color: var(--gd-ink2);
}
.config-row label {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.config-actions {
  margin-top: 12px;
}
.plans {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}
.plan.hot {
  border-color: var(--gd-brand);
  box-shadow: var(--gd-sh-sm);
}
.price {
  font-size: var(--gd-fs-hcard);
  font-weight: 700;
  color: var(--gd-ink);
  margin: 8px 0;
}
@media (max-width: 980px) {
  .plans { grid-template-columns: 1fr; }
}
</style>
