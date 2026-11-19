<!--
  预警视图（规则真实可写，不是静态壳）
  ---------------------------------------------------------------
  能做的都真做：读/写 gap_rules、开关、删除、以及**用当前池子实时试跑 DSL**。
  不能做的明说：本期没有推送服务，通道只是存进 dsl.channels 里，二期才发；
  没有审计表，所以不伪造「已推送 N 次」。
  试跑口径全部写清（基于当前筛选结果、按 48h 外推日均），不给任何含糊的周维度表述。
-->
<template>
  <div class="gav">
    <div v-if="!userId" class="gav-notice">
      未登录：规则列表只读。登录后即可保存/开关/删除（写库走 `gap_rules` 的 RLS 个人策略）。
    </div>

    <div class="gav-grid">
      <!-- 构造器 -->
      <section class="gav-card">
        <div class="gav-card-head">
          <h3 class="gav-h3">新建规则</h3>
          <span class="gav-h3-note">保存后仅对当前账号生效</span>
        </div>

        <div class="gav-field">
          <label class="gav-lb">规则名</label>
          <el-input v-model="draft.name" size="small" placeholder="例如：AI 政策 90 分以上" maxlength="24" />
        </div>

        <div class="gav-field">
          <label class="gav-lb">行业（为空 = 全部）</label>
          <el-select
            :model-value="draft.inds"
            size="small"
            multiple
            collapse-tags
            placeholder="全部行业"
            class="gav-select"
            @update:model-value="(v: unknown) => (draft.inds = asArr<GapInd>(v))"
          >
            <el-option v-for="i in GAP_IND" :key="i.key" :value="i.key" :label="i.label" />
          </el-select>
        </div>

        <div class="gav-field">
          <label class="gav-lb">维度（为空 = 全部）</label>
          <el-select
            :model-value="draft.dims"
            size="small"
            multiple
            collapse-tags
            placeholder="全部维度"
            class="gav-select"
            @update:model-value="(v: unknown) => (draft.dims = asArr<GapDim>(v))"
          >
            <el-option v-for="d in GAP_DIM" :key="d.key" :value="d.key" :label="d.label" />
          </el-select>
        </div>

        <div class="gav-field">
          <label class="gav-lb">差值阈值 <b class="gav-num">{{ draft.gapMin }}</b> 分</label>
          <el-slider v-model="draft.gapMin" :min="85" :max="97" :step="1" size="small" show-stops />
        </div>

        <div class="gav-field gav-field-row">
          <div class="gav-sub">
            <label class="gav-lb">信源数上限</label>
            <el-select
              :model-value="draft.srcMax"
              size="small"
              class="gav-mini"
              @update:model-value="(v: unknown) => (draft.srcMax = Number(v) || 1)"
            >
              <el-option v-for="n in 5" :key="n" :value="n" :label="`≤ ${n} 源`" />
            </el-select>
          </div>
          <div class="gav-sub">
            <label class="gav-lb">时间窗</label>
            <el-select
              :model-value="draft.windowH"
              size="small"
              class="gav-mini"
              @update:model-value="(v: unknown) => (draft.windowH = Number(v) || 48)"
            >
              <el-option v-for="h in [6, 12, 24, 48]" :key="h" :value="h" :label="`${h}h`" />
            </el-select>
          </div>
        </div>

        <div class="gav-field">
          <label class="gav-lb">推送通道（本期只存不推，二期接入）</label>
          <el-select
            :model-value="draft.channels"
            size="small"
            multiple
            class="gav-select"
            @update:model-value="(v: unknown) => (draft.channels = asArr<string>(v))"
          >
            <el-option v-for="c in CHANNELS" :key="c.key" :value="c.key" :label="c.label" />
          </el-select>
        </div>

        <!-- 实时试跑 -->
        <div class="gav-trial" :class="{ 'gav-trial-warn': fatigue }">
          <div class="gav-trial-line">
            <span>当前筛选下命中</span>
            <b class="gav-num">{{ trialHits.length }}</b>
            <span>条 / 48h</span>
            <span class="gav-sep">·</span>
            <span>≈ 日均 <b class="gav-num">{{ perDay }}</b> 条</span>
            <em class="gav-trial-note">（按 48h 外推）</em>
          </div>
          <p v-if="fatigue" class="gav-trial-warnmsg">
            会告警疲劳（日均 &gt; 4 条），建议提高阈值或缩窄行业
          </p>
          <p v-else class="gav-trial-tip">
            试跑基于当前筛选结果与池内数据；阈值越低命中越多，可先看这个数字再保存
          </p>
        </div>

        <p v-if="saveError" class="gav-err">{{ saveError }}</p>

        <div class="gav-actions">
          <el-button size="small" type="primary" :loading="saving" :disabled="!userId" @click="save">
            保存规则
          </el-button>
          <el-button size="small" text @click="resetDraft">清空</el-button>
        </div>
      </section>

      <!-- 规则列表 -->
      <section class="gav-card">
        <div class="gav-card-head">
          <h3 class="gav-h3">我的规则</h3>
          <span class="gav-h3-note">{{ rules.length }} 条</span>
          <el-button size="small" text :loading="loadingRules" @click="reload">刷新</el-button>
        </div>

        <GapEmptyState
          v-if="loadError"
          type="error"
          :title="'规则读取失败'"
          :detail="[loadError]"
          action-text="重试"
          @action="reload"
        />
        <GapEmptyState
          v-else-if="!rules.length"
          type="empty"
          title="还没有规则"
          desc="在左侧配置行业/维度/阈值后保存；规则只存条件，命中推送在二期接入"
        />
        <ul v-else class="gav-rules">
          <li v-for="r in rules" :key="r.id" class="gav-rule">
            <div class="gav-rule-main">
              <span class="gav-rule-name">{{ r.name || '未命名规则' }}</span>
              <el-switch
                :model-value="r.enabled !== false"
                size="small"
                :disabled="!userId"
                @update:model-value="(v: unknown) => toggleEnabled(r, Boolean(v))"
              />
              <el-button size="small" text :disabled="!userId" @click="remove(r)">删除</el-button>
            </div>
            <p class="gav-rule-sum">{{ summaryOf(r.dsl) }}</p>
            <div class="gav-rule-meta">
              <span>通道：{{ channelsText(r.channels) }}</span>
              <span class="gav-sep">·</span>
              <span>命中 <b class="gav-num">{{ r.hits ?? 0 }}</b> 次</span>
              <span class="gav-sep">·</span>
              <span>{{ r.created_at ? fmtClock(Date.parse(r.created_at)) : '—' }}</span>
            </div>
          </li>
        </ul>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import GapEmptyState from '../../components/gapdesk/GapEmptyState.vue'
import { GAP_DIM, GAP_IND } from '../../config/gapdeskConfig'
import { useGapDesk } from '../../composables/useGapDesk'
import { deleteRule, listRules, saveRule } from '../../services/gapdeskService'
import { fmtClock } from '../../utils/gapdeskFormat'
import type { GapDim, GapInd, GapRuleDsl, GapRuleRow } from '../../types/gapdesk'

const { pool, userId } = useGapDesk()

/** 通道键：只存进 dsl.channels，本期不发（二期由投放服务消费） */
const CHANNELS = [
  { key: 'inbox', label: '站内' },
  { key: 'email', label: '邮件' },
  { key: 'wecom', label: '企业微信' },
  { key: 'dingtalk', label: '钉钉' },
  { key: 'webhook', label: 'Webhook' }
] as const

/** el-select 的 model-value 是 unknown，统一收敛成字符串数组，避免把脏值写进 dsl */
function asArr<T extends string>(v: unknown): T[] {
  return Array.isArray(v) ? (v.filter((x) => typeof x === 'string') as T[]) : []
}

/* ---------- 草稿 ---------- */
const draft = reactive({
  name: '',
  inds: [] as GapInd[],
  dims: [] as GapDim[],
  gapMin: 88,
  srcMax: 3,
  windowH: 48,
  channels: ['inbox'] as string[]
})

function dslOf(): GapRuleDsl {
  return {
    ind: [...draft.inds],
    dim: [...draft.dims],
    gapMin: draft.gapMin,
    srcMax: draft.srcMax,
    windowH: draft.windowH,
    channels: [...draft.channels]
  }
}

function resetDraft(): void {
  draft.name = ''
  draft.inds = []
  draft.dims = []
  draft.gapMin = 88
  draft.srcMax = 3
  draft.windowH = 48
  draft.channels = ['inbox']
  saveError.value = ''
}

/* ---------- 试跑 ---------- */
const trialHits = computed(() =>
  pool.value.filter((e) => {
    if (draft.inds.length && !draft.inds.includes(e.ind)) return false
    if (draft.dims.length && !draft.dims.includes(e.dim)) return false
    if (e.gap < draft.gapMin) return false
    if ((e.src_count ?? 1) > draft.srcMax) return false
    // 时间窗：优先用发布时间；榜单类无发布时间时退回首次观测时间
    const ts = e.ts_published || e.ts_first_seen
    if (ts > 0 && Date.now() - ts > draft.windowH * 3600 * 1000) return false
    return true
  })
)

/** 日均 = 48h 命中数 / 2 —— 只在 UI 上写「按 48h 外推」，不冒充周/月数据 */
const perDay = computed(() => Math.round((trialHits.value.length / 2) * 10) / 10)
/** 告警疲劳阈值：日均 > 4 条基本会被用户静音，这是经验值，写死在 UI 文案里 */
const fatigue = computed(() => perDay.value > 4)

/* ---------- 规则列表 ---------- */
const rules = ref<GapRuleRow[]>([])
const loadingRules = ref(false)
const loadError = ref<string | null>(null)
const saving = ref(false)
const saveError = ref<string | null>(null)

async function reload(): Promise<void> {
  if (!userId.value) {
    rules.value = []
    return
  }
  loadingRules.value = true
  loadError.value = null
  const res = await listRules(userId.value)
  rules.value = res.data
  loadError.value = res.error
  loadingRules.value = false
}

// userId 来自单例（首次 load 后才有值），变化时补拉一次
watch(userId, () => void reload(), { immediate: true })

async function save(): Promise<void> {
  saveError.value = ''
  if (!userId.value) {
    saveError.value = '未登录，规则无法保存（写库需要登录态）'
    return
  }
  if (!draft.name.trim()) {
    saveError.value = '请填写规则名'
    return
  }
  saving.value = true
  const saved = await saveRule(userId.value, {
    name: draft.name.trim(),
    dsl: dslOf(),
    channels: [...draft.channels],
    enabled: true
  })
  saving.value = false
  if (!saved) {
    // 不静默失败：RLS 拒绝 / 网络失败都会走到这里
    saveError.value = '保存失败：登录态可能已失效，或被 RLS 拒绝（详见控制台 [gapdesk] 日志）'
    return
  }
  rules.value = [saved, ...rules.value.filter((r) => r.id !== saved.id)]
  resetDraft()
  ElMessage.success('规则已保存')
}

async function toggleEnabled(r: GapRuleRow, enabled: boolean): Promise<void> {
  if (!userId.value) return
  const before = r.enabled
  r.enabled = enabled // 乐观更新，开关必须即时响应
  const saved = await saveRule(userId.value, {
    id: r.id,
    name: r.name || '',
    dsl: r.dsl,
    channels: r.channels ?? [],
    enabled
  })
  if (!saved) {
    r.enabled = before
    ElMessage.error('规则状态保存失败')
  }
}

async function remove(r: GapRuleRow): Promise<void> {
  if (!userId.value) return
  const ok = await deleteRule(userId.value, r.id)
  if (!ok) {
    ElMessage.error('删除失败')
    return
  }
  rules.value = rules.value.filter((x) => x.id !== r.id)
  ElMessage.success('已删除')
}

/* ---------- 文案 ---------- */
function summaryOf(dsl: GapRuleDsl): string {
  const inds = dsl.ind?.length
    ? dsl.ind.map((k) => GAP_IND.find((i) => i.key === k)?.label ?? k).join('/')
    : '全部行业'
  const dims = dsl.dim?.length
    ? dsl.dim.map((k) => GAP_DIM.find((d) => d.key === k)?.label ?? k).join('/')
    : '全部维度'
  return `${inds} · ${dims} · ≥ ${dsl.gapMin ?? 0} 分 · ≤ ${dsl.srcMax ?? '∞'} 源 · ${dsl.windowH ?? 48}h 内`
}

function channelsText(chs: string[] | null): string {
  const list = (chs ?? []).map((k) => CHANNELS.find((c) => c.key === k)?.label ?? k)
  return list.length ? list.join('、') : '未设置'
}
</script>

<style scoped>
.gav {
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-width: 0;
}
.gav-notice {
  padding: 8px 12px;
  border-radius: 8px;
  border: 1px solid rgba(217, 119, 6, 0.3);
  background: rgba(217, 119, 6, 0.1);
  font-size: 11px;
  line-height: 1.6;
  color: #b45309;
}
.gav-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  align-items: start;
}
.gav-card {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px 14px;
  background: var(--surface, #fff);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 10px;
  min-width: 0;
}
.gav-card-head {
  display: flex;
  align-items: baseline;
  gap: 8px;
}
.gav-h3 {
  margin: 0;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-strong, #303133);
}
.gav-h3-note {
  font-size: 10px;
  color: var(--text-muted, #909399);
  margin-right: auto;
}
.gav-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}
.gav-field-row {
  flex-direction: row;
  gap: 14px;
}
.gav-sub {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}
.gav-lb {
  font-size: 11px;
  color: var(--text-muted, #909399);
}
.gav-num {
  font-variant-numeric: tabular-nums;
  color: var(--text-strong, #303133);
}
.gav-select {
  width: 100%;
}
.gav-mini {
  width: 108px;
}
.gav-trial {
  padding: 8px 10px;
  border-radius: 8px;
  background: var(--surface-soft, rgba(0, 0, 0, 0.03));
  font-size: 11px;
  line-height: 1.7;
  color: var(--text-muted, #606266);
}
.gav-trial-warn {
  background: rgba(255, 51, 88, 0.08);
}
.gav-trial-line {
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  gap: 4px;
}
.gav-trial-note {
  font-style: normal;
  color: #c0c4cc;
}
.gav-sep {
  opacity: 0.6;
}
.gav-trial-warnmsg {
  margin: 2px 0 0;
  color: #ff3358;
  font-weight: 600;
}
.gav-trial-tip {
  margin: 2px 0 0;
  color: var(--text-muted, #909399);
}
.gav-err {
  margin: 0;
  font-size: 11px;
  color: #ff3358;
}
.gav-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}
.gav-actions :deep(.el-button) {
  min-height: 44px;
}
.gav-rules {
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.gav-rule {
  padding: 8px 10px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
}
.gav-rule-main {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}
.gav-rule-name {
  flex: 1;
  min-width: 0;
  font-size: 12px;
  font-weight: 600;
  color: var(--text-strong, #303133);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.gav-rule-sum {
  margin: 4px 0 0;
  font-size: 11px;
  line-height: 1.6;
  color: var(--text-muted, #606266);
}
.gav-rule-meta {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 2px;
  font-size: 10px;
  color: var(--text-muted, #909399);
  font-variant-numeric: tabular-nums;
}
@media (max-width: 768px) {
  .gav-grid {
    grid-template-columns: minmax(0, 1fr);
  }
  .gav-field-row {
    flex-direction: column;
    gap: 8px;
  }
  .gav-mini {
    width: 100%;
  }
}
</style>
