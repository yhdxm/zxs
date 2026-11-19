<!--
  套餐与报价（纯前端测算，不产生订单）
  ---------------------------------------------------------------
  价格与起售席位一律取自 src/config/gapdeskConfig.ts 的 GAP_PLAN（唯一真源），
  本页只做「单价 × 席位 × 折扣」的算术，不写死任何金额。
  Enterprise 是年框、按项目报价，不参与滑杆测算 —— 把它塞进滑杆会造出一个假价格。
  所有数字等宽，金额走 fmtMoney，避免 3,600 与 3600 混排。
-->
<template>
  <div class="gpv">
    <!-- 4 档卡 -->
    <div class="gpv-grid">
      <article
        v-for="p in GAP_PLAN"
        :key="p.key"
        class="gpv-card"
        :class="{ 'gpv-card-on': p.key === selectedPlan }"
      >
        <header class="gpv-head">
          <h3 class="gpv-name">{{ p.name }}</h3>
          <span class="gpv-price">{{ p.priceLabel }}</span>
        </header>

        <ul class="gpv-feats">
          <li v-for="f in p.features" :key="f">{{ f }}</li>
        </ul>

        <dl class="gpv-matrix">
          <div><dt>实时性</dt><dd>{{ matrix[p.key].latency }}</dd></div>
          <div><dt>信源名</dt><dd>{{ matrix[p.key].sourceName }}</dd></div>
          <div><dt>规则数</dt><dd>{{ matrix[p.key].rules }}</dd></div>
          <div><dt>数据窗口</dt><dd>{{ matrix[p.key].lookback }}</dd></div>
        </dl>

        <p v-if="p.key === 'enterprise'" class="gpv-ent">年框 ¥30-40 万 · 联系商务（与卡片报价同一口径）</p>
        <button
          v-else-if="p.price > 0"
          type="button"
          class="gpv-pick"
          @click="pickPlan(p.key)"
        >
          {{ p.key === selectedPlan ? '已选中测算' : '按席位测算' }}
        </button>
        <p v-else class="gpv-free">免费档不含席位计费</p>
      </article>
    </div>

    <!-- 席位测算 -->
    <section class="gpv-calc">
      <div class="gpv-calc-head">
        <h3 class="gpv-h3">席位测算</h3>
        <span class="gpv-h3-note">{{ planName }} · 单价 {{ fmtMoney(unitPrice) }} / 席 / 年</span>
      </div>

      <div class="gpv-slider">
        <span class="gpv-lb">席位</span>
        <el-slider v-model="seatCount" :min="5" :max="50" :step="1" size="small" show-input />
      </div>

      <div class="gpv-out">
        <div class="gpv-out-cell">
          <span class="gpv-lb">目录价</span>
          <b>{{ fmtMoney(catalog) }}</b>
        </div>
        <div class="gpv-out-cell">
          <span class="gpv-lb">折扣</span>
          <b>{{ discountText }}</b>
        </div>
        <div class="gpv-out-cell">
          <span class="gpv-lb">实付</span>
          <b class="gpv-pay">{{ fmtMoney(payable) }}</b>
        </div>
        <div class="gpv-out-cell">
          <span class="gpv-lb">每席每天</span>
          <b>{{ fmtMoney(perSeatDay) }}</b>
        </div>
      </div>

      <p class="gpv-note">
        折扣规则：≥10 席 9 折、≥20 席 8 折。Enterprise 走年框、不参与滑杆测算。
      </p>
    </section>

    <p class="gpv-foot">本页为产品内测算，不产生订单；实际报价以合同为准。</p>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { GAP_PLAN, GAP_PLAN_MAP, type GapPlanKey } from '../../config/gapdeskConfig'
import { fmtMoney } from '../../utils/gapdeskFormat'

/** 可参与席位测算的两档（Insight 免费、Enterprise 年框） */
type CalcPlan = 'team' | 'business'

const selectedPlan = ref<CalcPlan>('team')

/** 卡片上的「按席位测算」：只有 team/business 可点，其余忽略（模板里已用 price>0 收口，这里再做一次类型收口） */
function pickPlan(key: GapPlanKey): void {
  if (key === 'team' || key === 'business') selectedPlan.value = key
}
const seatCount = ref(8)

/**
 * 权益对照：只描述**产品真实能力**，不写「无限」「专属」这类没有实现支撑的词。
 * 实时性口径 = 采集频率（30 分钟一轮）+ Realtime 推送（秒级到达已打开页面）。
 */
const matrix: Record<GapPlanKey, { latency: string; sourceName: string; rules: string; lookback: string }> = {
  insight: { latency: '≤30 分钟', sourceName: '不展示', rules: '1 条', lookback: '48h' },
  team: { latency: '≤30 分钟 + 实时推送', sourceName: '展示', rules: '5 条', lookback: '48h + 导出' },
  business: { latency: '≤30 分钟 + 实时推送', sourceName: '展示 + 证据链', rules: '不限', lookback: '48h + 简报' },
  enterprise: { latency: '私有部署可调', sourceName: '全量 + 定制源', rules: '不限', lookback: '私有库按需' }
}

const planName = computed(() => GAP_PLAN_MAP[selectedPlan.value].name)
const unitPrice = computed(() => GAP_PLAN_MAP[selectedPlan.value].price)

const catalog = computed(() => unitPrice.value * seatCount.value)
/** 折扣：≥20 席 8 折、≥10 席 9 折（与方案口径一致） */
const discountRate = computed(() => (seatCount.value >= 20 ? 0.8 : seatCount.value >= 10 ? 0.9 : 1))
const discountText = computed(() =>
  discountRate.value === 1 ? '无（未满 10 席）' : `${(discountRate.value * 10).toFixed(0)} 折`
)
const payable = computed(() => Math.round(catalog.value * discountRate.value))
/** 每席每天：实付 / 席位 / 365，四舍五入到元 —— 用来对比「一天一杯咖啡」的量级 */
const perSeatDay = computed(() =>
  seatCount.value > 0 ? Math.round(payable.value / seatCount.value / 365) : 0
)
</script>

<style scoped>
.gpv {
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-width: 0;
}
.gpv-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
}
.gpv-card {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 14px;
  background: var(--surface, #fff);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 10px;
  min-width: 0;
}
.gpv-card-on {
  border-color: var(--el-color-primary);
  box-shadow: 0 0 0 2px var(--el-color-primary-light-8);
}
.gpv-head {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.gpv-name {
  margin: 0;
  font-size: 14px;
  font-weight: 700;
  color: var(--text-strong, #303133);
}
.gpv-price {
  font-size: 12px;
  font-variant-numeric: tabular-nums;
  color: #ff3358;
  font-weight: 600;
}
.gpv-feats {
  margin: 0;
  padding-left: 16px;
  font-size: 11px;
  line-height: 1.8;
  color: var(--text-muted, #606266);
}
.gpv-matrix {
  margin: 0;
  padding: 8px 0 0;
  border-top: 1px dashed var(--el-border-color-lighter);
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.gpv-matrix div {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
  font-size: 11px;
}
.gpv-matrix dt {
  color: var(--text-muted, #909399);
  flex: none;
}
.gpv-matrix dd {
  margin: 0;
  color: var(--text-strong, #303133);
  text-align: right;
}
.gpv-pick {
  margin-top: auto;
  min-height: 44px;
  border-radius: 8px;
  border: 1px solid var(--el-color-primary-light-5);
  background: var(--surface, #fff);
  color: var(--el-color-primary);
  font-size: 12px;
  cursor: pointer;
}
.gpv-card-on .gpv-pick {
  background: var(--el-color-primary);
  color: #fff;
  border-color: var(--el-color-primary);
}
.gpv-ent,
.gpv-free {
  margin: auto 0 0;
  font-size: 11px;
  line-height: 1.5;
  color: var(--text-muted, #909399);
}
.gpv-calc {
  padding: 12px 14px;
  background: var(--surface, #fff);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 10px;
}
.gpv-calc-head {
  display: flex;
  align-items: baseline;
  gap: 8px;
  margin-bottom: 8px;
}
.gpv-h3 {
  margin: 0;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-strong, #303133);
}
.gpv-h3-note {
  font-size: 10px;
  color: var(--text-muted, #909399);
  font-variant-numeric: tabular-nums;
}
.gpv-slider {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}
.gpv-lb {
  flex: none;
  font-size: 10px;
  color: var(--text-muted, #909399);
}
.gpv-slider :deep(.el-slider) {
  flex: 1;
  min-width: 0;
}
.gpv-out {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
  margin-top: 10px;
}
.gpv-out-cell {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 8px 10px;
  border-radius: 8px;
  background: var(--surface-soft, rgba(0, 0, 0, 0.03));
}
.gpv-out-cell b {
  font-size: 17px;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
  color: var(--text-strong, #303133);
}
.gpv-pay {
  color: #ff3358 !important;
}
.gpv-note {
  margin: 10px 0 0;
  font-size: 10px;
  line-height: 1.6;
  color: var(--text-muted, #909399);
}
.gpv-foot {
  margin: 0;
  text-align: center;
  font-size: 10px;
  color: #c0c4cc;
}
@media (max-width: 768px) {
  .gpv-grid {
    grid-template-columns: minmax(0, 1fr);
  }
  .gpv-out {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
