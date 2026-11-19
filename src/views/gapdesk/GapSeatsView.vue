<!--
  席位与用量
  ---------------------------------------------------------------
  诚实口径的三条底线：
   ① 席位表只列 `gap_seats` 真实行，没有就写「尚未分配」，不编造团队名额；
   ② 用量条只画 `quota_used / quota_total`，百分比是算出来的，不是估的；
   ③ 本期**没有审计表**，所以「近期操作」只列真实可查的三项（收藏/已读/规则），
      并明确标注「完整审计流需二期」—— 绝不伪造推送记录或转化率。
-->
<template>
  <div class="gsv">
    <!-- 顶部 4 卡 -->
    <div class="gsv-cards">
      <div class="gsv-card">
        <span class="gsv-lb">当前套餐</span>
        <b class="gsv-val">{{ planLabel }}</b>
        <span class="gsv-tip">{{ planTip }}</span>
      </div>
      <div class="gsv-card">
        <span class="gsv-lb">席位数</span>
        <b class="gsv-val">{{ mySeat?.seats ?? 1 }}</b>
        <span class="gsv-tip">按账号计，不含只读访客</span>
      </div>
      <div class="gsv-card">
        <span class="gsv-lb">48h 配额已用</span>
        <b class="gsv-val">{{ quotaText }}</b>
        <div class="gsv-bar">
          <i :style="{ width: `${quotaPct}%`, background: quotaColor }" />
        </div>
        <span class="gsv-tip">{{ quotaTip }}</span>
      </div>
      <div class="gsv-card">
        <span class="gsv-lb">命中 → 动作</span>
        <b class="gsv-val">{{ actionRatePct }}%</b>
        <span class="gsv-tip">口径：池内被收藏的事件 / 池内事件（真实可查，非推送转化）</span>
      </div>
    </div>

    <!-- 席位表 -->
    <section class="gsv-block">
      <div class="gsv-block-head">
        <h3 class="gsv-h3">席位分配</h3>
        <span class="gsv-h3-note">{{ visibleSeats.length }} 行 · 来自 gap_seats</span>
        <el-button size="small" text :loading="loading" @click="reload">刷新</el-button>
      </div>

      <GapEmptyState
        v-if="seatsError"
        type="error"
        title="席位数据读取失败"
        :detail="[seatsError]"
        action-text="重试"
        @action="reload"
      />
      <GapEmptyState
        v-else-if="!visibleSeats.length"
        type="empty"
        :title="isAdmin ? '尚未分配席位' : '尚未为你分配席位'"
        desc="gap_seats 里还没有记录：首次开通套餐后，由管理员或开通流程写入（含 plan / seats / quota_total）"
      />
      <div v-else class="gsv-table-wrap">
        <p v-if="!isAdmin" class="gsv-scope-note">仅管理员可查看全量席位；下方只显示你自己的那一行。</p>
        <table class="gsv-table">
          <thead>
            <tr>
              <th scope="col">用户（脱敏）</th>
              <th scope="col">套餐</th>
              <th scope="col">席位</th>
              <th scope="col">配额</th>
              <th scope="col">更新时间</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="s in visibleSeats" :key="s.user_id">
              <td class="gsv-mono">{{ mask(s.user_id) }}</td>
              <td>{{ gapPlanLabel(s.plan) }}</td>
              <td class="gsv-num">{{ s.seats ?? 1 }}</td>
              <td class="gsv-num">{{ s.quota_used ?? 0 }} / {{ s.quota_total ?? 0 }}</td>
              <td>{{ s.updated_at ? fmtClock(Date.parse(s.updated_at)) : '—' }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <!-- 近期操作（真实可查的三项） -->
    <section class="gsv-block">
      <div class="gsv-block-head">
        <h3 class="gsv-h3">近期操作</h3>
        <span class="gsv-h3-note">仅当前账号 · 完整审计流需二期</span>
      </div>

      <div class="gsv-ops">
        <div class="gsv-op">
          <b class="gsv-num">{{ favorites.length }}</b>
          <span>收藏事件（累计）</span>
        </div>
        <div class="gsv-op">
          <b class="gsv-num">{{ reads48h }}</b>
          <span>48h 内已读</span>
        </div>
        <div class="gsv-op">
          <b class="gsv-num">{{ ruleCount }}</b>
          <span>预警规则</span>
        </div>
      </div>

      <p v-if="!userId" class="gsv-tip-line">未登录：只显示空值，登录后可看到自己的操作计数</p>
      <p v-else class="gsv-tip-line">
        「完整审计流（谁在什么时候看了哪条、点了什么）」需要独立的 `gap_audit` 表，属二期范围
      </p>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import GapEmptyState from '../../components/gapdesk/GapEmptyState.vue'
import { GAP_PLAN_MAP, gapPlanLabel } from '../../config/gapdeskConfig'
import { canManageSystem } from '../../config/appMenu'
import { getSavedUser } from '../../services/appDataService'
import { useGapDesk } from '../../composables/useGapDesk'
import { listReads, listRules, loadSeats } from '../../services/gapdeskService'
import { fmtClock } from '../../utils/gapdeskFormat'
import type { GapSeatRow } from '../../types/gapdesk'

const { pool, favorites, userId } = useGapDesk()

const seats = ref<GapSeatRow[]>([])
/** 是否管理员：只有管理员能看全量席位（RLS 是 select using(true)，前端必须自己收口） */
const isAdmin = ref(false)
/** 自己的可能标识：auth uid（RLS 口径）+ 业务 id（老数据兜底） */
const selfIds = ref<string[]>([])
const loading = ref(false)
const seatsError = ref<string | null>(null)
const reads48h = ref(0)
const ruleCount = ref(0)

/** 读当前账号角色，决定席位表看全量还是只看自己 */
async function loadIdentity(): Promise<void> {
  const u = await getSavedUser()
  isAdmin.value = canManageSystem(u)
  selfIds.value = [u?.authUserId, u?.id].filter((x): x is string => Boolean(x))
  if (userId.value && !selfIds.value.includes(userId.value)) selfIds.value.push(userId.value)
}

async function reload(): Promise<void> {
  loading.value = true
  seatsError.value = null
  const res = await loadSeats()
  seats.value = res.data
  seatsError.value = res.error
  loading.value = false

  if (!userId.value) {
    reads48h.value = 0
    ruleCount.value = 0
    return
  }
  // 已读与规则：直接查库（store 里只缓存了收藏），统计口径写清「48h 内」
  const [reads, rules] = await Promise.all([listReads(userId.value), listRules(userId.value)])
  const cutoff = Date.now() - 48 * 3600 * 1000
  reads48h.value = reads.data.filter((r) => {
    const ts = r.read_at ? Date.parse(r.read_at) : 0
    return ts > cutoff
  }).length
  ruleCount.value = rules.data.length
}

onMounted(async () => {
  await loadIdentity()
  await reload()
})
watch(userId, () => {
  void reload()
})

/**
 * 展示用席位行。
 * 管理员：全量（user_id 仍脱敏 8 位）；
 * 普通用户：只保留自己那一行 —— 别人的配额与席位对他没有意义，泄露账号前缀更是多余风险。
 */
const visibleSeats = computed<GapSeatRow[]>(() => {
  if (isAdmin.value) return seats.value
  const mine = new Set(selfIds.value)
  return seats.value.filter((s) => mine.has(s.user_id))
})

/** 当前用户的席位行（管理员视角下表格是全量，卡片只反映自己） */
const mySeat = computed(() => seats.value.find((s) => s.user_id === userId.value) ?? null)

const planLabel = computed(() => gapPlanLabel(mySeat.value?.plan ?? 'trial'))
const planTip = computed(() => {
  const key = mySeat.value?.plan ?? 'trial'
  if (key === 'trial') return '试用：全量事件可见，规则与席位受限'
  const plan = GAP_PLAN_MAP[key as keyof typeof GAP_PLAN_MAP]
  return plan ? `${plan.priceLabel} · 起售 ${plan.minSeats} 席` : '—'
})

const quotaText = computed(() => {
  const used = mySeat.value?.quota_used ?? 0
  const total = mySeat.value?.quota_total ?? 0
  return total > 0 ? `${used} / ${total}` : `${used} / 0`
})

const quotaPct = computed(() => {
  const used = mySeat.value?.quota_used ?? 0
  const total = mySeat.value?.quota_total ?? 0
  if (total <= 0) return 0
  return Math.max(0, Math.min(100, Math.round((used / total) * 100)))
})

/** ≥60% 黄、≥90% 红 */
const quotaColor = computed(() => {
  if (quotaPct.value >= 90) return '#ff3358'
  if (quotaPct.value >= 60) return '#d97706'
  return '#0ba36f'
})

const quotaTip = computed(() => {
  if (quotaPct.value >= 90) return '接近用尽：建议扩容或降低刷新频率'
  if (quotaPct.value >= 60) return '已过半：留意剩余调用额度'
  return '用量正常'
})

/** 收藏覆盖率（真实可算，替代「转化率」这个没有数据支撑的说法） */
const actionRatePct = computed(() => {
  const total = pool.value.length
  if (!total) return 0
  const favSet = new Set(favorites.value)
  const hit = pool.value.filter((e) => favSet.has(e.id)).length
  return Math.round((hit / total) * 100)
})

/** user_id 前 8 位脱敏（uuid 前缀足以区分人，又不泄露完整标识） */
function mask(id: string | null | undefined): string {
  const s = String(id ?? '')
  if (!s) return '—'
  return s.length <= 8 ? s : `${s.slice(0, 8)}…`
}
</script>

<style scoped>
.gsv {
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-width: 0;
}
.gsv-cards {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
}
.gsv-card {
  display: flex;
  flex-direction: column;
  gap: 3px;
  padding: 12px 14px;
  background: var(--surface, #fff);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 10px;
  min-width: 0;
}
.gsv-lb {
  font-size: 10px;
  color: var(--text-muted, #909399);
}
.gsv-val {
  font-size: 20px;
  font-weight: 800;
  line-height: 1.2;
  font-variant-numeric: tabular-nums;
  color: var(--text-strong, #303133);
}
.gsv-tip {
  font-size: 10px;
  line-height: 1.5;
  color: var(--text-muted, #909399);
}
.gsv-bar {
  height: 5px;
  margin: 3px 0;
  border-radius: 3px;
  background: var(--surface-soft, rgba(0, 0, 0, 0.05));
  overflow: hidden;
}
.gsv-bar i {
  display: block;
  height: 100%;
  border-radius: 3px;
  transition: width 0.3s ease;
}
.gsv-block {
  padding: 12px 14px;
  background: var(--surface, #fff);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 10px;
  min-width: 0;
}
.gsv-block-head {
  display: flex;
  align-items: baseline;
  gap: 8px;
  margin-bottom: 8px;
}
.gsv-h3 {
  margin: 0;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-strong, #303133);
}
.gsv-h3-note {
  font-size: 10px;
  color: var(--text-muted, #909399);
  margin-right: auto;
}
.gsv-scope-note {
  margin: 0 0 8px;
  padding: 6px 10px;
  border-radius: 6px;
  background: var(--surface-soft, rgba(0, 0, 0, 0.03));
  font-size: 11px;
  line-height: 1.6;
  color: var(--text-muted, #909399);
}
.gsv-table-wrap {
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
}
.gsv-table {
  width: 100%;
  min-width: 560px;
  border-collapse: collapse;
  font-size: 12px;
}
.gsv-table th,
.gsv-table td {
  padding: 9px 8px;
  text-align: left;
  border-bottom: 1px solid var(--el-border-color-lighter);
  white-space: nowrap;
}
.gsv-table thead th {
  font-size: 11px;
  font-weight: 600;
  color: var(--text-muted, #909399);
}
.gsv-mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  color: var(--text-strong, #303133);
}
.gsv-num {
  font-variant-numeric: tabular-nums;
}
.gsv-ops {
  display: flex;
  flex-wrap: wrap;
  gap: 24px;
}
.gsv-op {
  display: flex;
  flex-direction: column;
  gap: 1px;
  min-width: 96px;
}
.gsv-op b {
  font-size: 20px;
  font-weight: 800;
  line-height: 1.2;
  color: var(--text-strong, #303133);
}
.gsv-op span {
  font-size: 10px;
  color: var(--text-muted, #909399);
}
.gsv-tip-line {
  margin: 10px 0 0;
  font-size: 10px;
  line-height: 1.6;
  color: var(--text-muted, #909399);
}
@media (max-width: 768px) {
  .gsv-cards {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
