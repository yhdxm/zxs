<template>
  <div class="mc-shell">
    <header class="mc-header">
      <div class="mc-title">
        <span class="mc-icon"><el-icon><MagicStick /></el-icon></span>
        <div>
          <h1>模型中心</h1>
          <p>实时额度 · 已配置模型 · 免费模型清单 · 全程本地记录，不消耗任何积分</p>
        </div>
      </div>
      <div class="mc-actions">
        <el-switch v-model="autoRefresh" active-text="自动检测(60s)" @change="toggleAuto" />
        <el-button type="primary" :loading="checking" @click="runCheck">
          <el-icon><Refresh /></el-icon> 立即检测
        </el-button>
      </div>
    </header>

    <!-- ===== 实时额度卡片（硅基流动） ===== -->
    <div class="mc-balance" :class="{ ok: balance.supported, warn: !balance.supported }">
      <div class="mc-balance-head">
        <div class="mc-balance-title">
          <el-icon><Coin /></el-icon>
          <span>硅基流动 · 实时额度</span>
        </div>
        <el-tag v-if="balance.supported" type="success" effect="light" size="small">已连接</el-tag>
        <el-tag v-else type="info" effect="light" size="small">未获取</el-tag>
      </div>

      <div v-if="balance.supported" class="mc-balance-body">
        <div class="mc-balance-main">
          <span class="mc-balance-num">{{ formatMoney(balance.totalBalance) }}</span>
          <span class="mc-balance-unit">{{ balance.currency || 'CNY' }}</span>
        </div>
        <div class="mc-balance-sub">
          <span v-if="balance.freeBalance !== undefined">免费额度：{{ formatMoney(balance.freeBalance) }}</span>
          <span class="mc-balance-time">更新于 {{ fmtTime(balance.fetchedAt) }}</span>
        </div>
      </div>
      <div v-else class="mc-balance-hint">
        <el-icon><InfoFilled /></el-icon>
        <span>{{ balance.hint || '请在「AI 助手」配置中填入硅基流动 API Key 后查看额度' }}</span>
      </div>
    </div>

    <!-- ===== 用量统计卡片 ===== -->
    <div class="mc-cards">
      <div class="mc-stat">
        <div class="mc-stat-label">总调用次数</div>
        <div class="mc-stat-value">{{ usage.totalCalls }}</div>
      </div>
      <div class="mc-stat">
        <div class="mc-stat-label">今日调用</div>
        <div class="mc-stat-value">{{ usage.todayCalls }}</div>
      </div>
      <div class="mc-stat">
        <div class="mc-stat-label">免费调用占比</div>
        <div class="mc-stat-value accent">{{ usage.freeRatio }}%</div>
      </div>
      <div class="mc-stat">
        <div class="mc-stat-label">预估消耗 Tokens</div>
        <div class="mc-stat-value">{{ tokenText(usage.totalEstTokens) }}</div>
      </div>
    </div>

    <!-- 阿里百炼额度（用户自填已知额度，仅本地记录） -->
    <div class="mc-quota">
      <div class="mc-quota-head">
        <div>
          <h3>阿里百炼额度监测</h3>
          <p>记录本地已用调用次数；额度为你已知的上限（如免费额度 / 购买额度），仅存本地不上云。</p>
        </div>
        <div class="mc-quota-form" v-if="bailianQuota !== null">
          <el-input-number v-model="quotaInput" :min="0" :step="100" controls-position="right" />
          <el-button type="primary" plain @click="saveQuota">保存额度</el-button>
        </div>
      </div>
      <div class="mc-quota-bar" v-if="bailianQuota !== null && bailianQuota > 0">
        <div class="mc-quota-fill" :class="{ danger: quotaPercent >= 90 }" :style="{ width: quotaPercent + '%' }"></div>
      </div>
      <div class="mc-quota-meta" v-if="bailianQuota !== null && bailianQuota > 0">
        已用 {{ usage.bailianUsed }} / 额度 {{ bailianQuota }}（{{ quotaPercent }}%）
      </div>
      <el-button v-else link type="primary" @click="enableQuota">设置阿里百炼额度</el-button>
    </div>

    <el-tabs v-model="activeTab" class="mc-tabs">
      <!-- ===== 已配置模型 ===== -->
      <el-tab-pane label="已配置模型" name="configured">
        <div class="mc-banner">
          <el-icon><Setting /></el-icon>
          <span>这里展示你当前在「AI 助手」中激活的配置。可在 <b>AI 助手 → 配置</b> 中切换更多已验证模型。</span>
        </div>
        <div class="mc-table-wrap">
          <el-table :data="configuredModels" empty-text="尚未配置任何模型" style="width: 100%">
            <el-table-column label="厂商" width="160">
              <template #default="{ row }">
                <span>{{ providerLabel(row.provider) }}</span>
              </template>
            </el-table-column>
            <el-table-column prop="model" label="模型" min-width="220" />
            <el-table-column prop="baseUrl" label="接口地址" min-width="240" show-overflow-tooltip />
            <el-table-column label="类型" width="110">
              <template #default="{ row }">
                <el-tag :type="row.isFree ? 'success' : 'warning'" effect="light" size="small">
                  {{ row.isFree ? '免费' : '付费' }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column label="密钥状态" width="120">
              <template #default="{ row }">
                <el-tag :type="row.hasKey ? 'success' : 'info'" effect="light" size="small">
                  {{ row.hasKey ? '已配置' : '未配置' }}
                </el-tag>
              </template>
            </el-table-column>
          </el-table>
        </div>
      </el-tab-pane>

      <!-- ===== 免费模型清单 ===== -->
      <el-tab-pane label="免费模型清单" name="free">
        <div class="mc-banner">
          <el-icon><Promotion /></el-icon>
          <span>
            免费模型来自各厂商公开免费档与 <b>OpenRouter 实时模型列表</b>（前端直连）。
            纯前端调用，<b>不消耗任何积分/额度</b>，也不写入云端，可用于免费开发实时监测。
          </span>
        </div>

        <div class="mc-table-wrap">
          <el-table :data="freeList" empty-text="点击「立即检测」获取免费模型清单" style="width: 100%">
            <el-table-column label="厂商" width="140">
              <template #default="{ row }">{{ providerLabel(row.provider) }}</template>
            </el-table-column>
            <el-table-column prop="model" label="模型" min-width="220" />
            <el-table-column prop="note" label="说明" min-width="180" show-overflow-tooltip />
            <el-table-column label="状态" width="140">
              <template #default="{ row }">
                <span class="mc-status" :class="statusClass(row.status)">
                  <span class="dot"></span>{{ statusText(row.status) }}
                </span>
                <div class="mc-status-src">{{ row.source === 'live' ? '实时' : '预置' }}</div>
              </template>
            </el-table-column>
            <el-table-column label="最近检测" width="160">
              <template #default="{ row }">{{ fmtTime(row.lastChecked) }}</template>
            </el-table-column>
          </el-table>
        </div>
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { MagicStick, Refresh, Promotion, Setting, Coin, InfoFilled } from '@element-plus/icons-vue'
import {
  getUsageStats,
  clearUsage,
  setBailianQuota,
  getBailianQuota,
  classifyFree,
  type UsageSummary
} from '../services/usageTracker'
import { checkFreeModelsV2, type FreeModelStatusV2, type FreeModelStatusKind } from '../services/freeModels'
import { getProviderBalance, type ProviderBalance } from '../services/balanceService'
import { loadAiConfig, type AiConfig } from '../services/aiService'
import { getSavedUser } from '../services/appDataService'

const PROVIDER_LABELS: Record<string, string> = {
  siliconflow: '硅基流动',
  zhipu: '智谱 AI',
  deepseek: 'DeepSeek',
  volcengine: '火山方舟',
  openrouter: 'OpenRouter',
  ollama: '本地 Ollama',
  bailian: '阿里百炼',
  'openai-compatible': 'OpenAI 兼容'
}
const providerLabel = (p: string): string => PROVIDER_LABELS[p] || p

const activeTab = ref<'configured' | 'free'>('configured')
const usage = ref<UsageSummary>({
  totalCalls: 0,
  todayCalls: 0,
  freeCalls: 0,
  paidCalls: 0,
  freeRatio: 0,
  totalEstTokens: 0,
  byModel: [],
  bailianUsed: 0
})
const bailianQuota = ref<number | null>(null)
const quotaInput = ref<number>(0)

const balance = ref<ProviderBalance>({
  provider: 'siliconflow',
  totalBalance: 0,
  fetchedAt: 0,
  supported: false
})

const freeList = ref<FreeModelStatusV2[]>([])
const checking = ref(false)
const autoRefresh = ref(false)
let timer: ReturnType<typeof setInterval> | null = null

interface ConfiguredModelRow {
  provider: string
  model: string
  baseUrl: string
  isFree: boolean
  hasKey: boolean
}
const configuredModels = ref<ConfiguredModelRow[]>([])

const refreshUsage = () => {
  usage.value = getUsageStats()
  bailianQuota.value = getBailianQuota()
  quotaInput.value = bailianQuota.value ?? 0
}

/** 读取当前激活配置，构建「已配置模型」列表 */
const loadConfigured = async () => {
  const user = await getSavedUser()
  const cfg: AiConfig = await loadAiConfig(user?.id || undefined)
  configuredModels.value = [
    {
      provider: cfg.provider,
      model: cfg.model,
      baseUrl: cfg.baseUrl,
      isFree: classifyFree(cfg.provider, cfg.model),
      hasKey: Boolean(cfg.apiKey && cfg.apiKey.trim())
    }
  ]
}

/** 查询硅基流动实时额度 */
const loadBalance = async () => {
  const user = await getSavedUser()
  const cfg: AiConfig = await loadAiConfig(user?.id || undefined)
  balance.value = await getProviderBalance(cfg.provider as string, cfg.baseUrl, cfg.apiKey)
}

const runCheck = async () => {
  checking.value = true
  try {
    await Promise.all([loadConfigured(), loadBalance()])
    freeList.value = await checkFreeModelsV2()
  } catch {
    ElMessage.error('检测失败，请检查网络后重试')
  } finally {
    checking.value = false
  }
}

const toggleAuto = (val: boolean) => {
  if (val) {
    timer = setInterval(runCheck, 60000)
  } else if (timer) {
    clearInterval(timer)
    timer = null
  }
}

const enableQuota = () => {
  bailianQuota.value = 0
  quotaInput.value = 0
}

const saveQuota = () => {
  setBailianQuota(quotaInput.value || 0)
  bailianQuota.value = getBailianQuota()
  ElMessage.success('阿里额度已更新（仅本地记录，不上云）')
}

const confirmClear = async () => {
  try {
    const { ElMessageBox } = await import('element-plus')
    await ElMessageBox.confirm('确定清空本地用量记录？此操作不可恢复。', '清空确认', { type: 'warning' })
    clearUsage()
    refreshUsage()
    ElMessage.success('已清空')
  } catch {
    /* 取消 */
  }
}

const tokenText = (n: number) => (n >= 1000 ? (n / 1000).toFixed(1) + 'k' : String(n))
const fmtTime = (ts: number | null) =>
  ts ? new Date(ts).toLocaleString('zh-CN', { hour12: false }) : '—'
const formatMoney = (n: number) => (n >= 1 ? n.toFixed(2) : n.toFixed(4))

const statusText = (s: FreeModelStatusKind) =>
  ({ callable: '可调用', limited: '受限', unavailable: '暂不可用', unknown: '未知' } as const)[s]
const statusClass = (s: FreeModelStatusKind) =>
  ({ callable: 'ok', limited: 'warn', unavailable: 'bad', unknown: 'unknown' } as const)[s]

const quotaPercent = computed(() =>
  bailianQuota.value && bailianQuota.value > 0
    ? Math.min(100, Math.round((usage.value.bailianUsed / bailianQuota.value) * 100))
    : 0
)

// 暴露给模板的清空入口（保持与旧交互一致，可由父级或内部按钮触发）
void confirmClear

onMounted(() => {
  refreshUsage()
  runCheck()
})
onBeforeUnmount(() => {
  if (timer) clearInterval(timer)
})
</script>

<style scoped>
.mc-shell {
  padding: 22px;
  font-family: 'Inter', system-ui, -apple-system, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif;
  background: var(--bg-app);
  min-height: calc(100vh - var(--nav-h, 56px));
  max-width: 1200px;
  margin: 0 auto;
}

.mc-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  margin-bottom: 18px;
}
.mc-title { display: flex; align-items: center; gap: 12px; min-width: 0; }
.mc-icon {
  width: 42px; height: 42px; border-radius: 13px; display: grid; place-items: center; flex-shrink: 0;
  background: linear-gradient(135deg, var(--primary-3), var(--primary-2)); color: #fff;
  box-shadow: 0 8px 18px var(--accent-glow);
}
.mc-icon :deep(svg) { font-size: 22px; }
.mc-title h1 { margin: 0; font-size: 20px; font-weight: 800; color: var(--text-strong); }
.mc-title p { margin: 2px 0 0; font-size: 12px; color: var(--text-muted); }
.mc-actions { display: flex; align-items: center; gap: 12px; flex-shrink: 0; }
.mc-actions :deep(.el-button) { display: inline-flex; align-items: center; gap: 4px; }

/* 实时额度卡片 */
.mc-balance {
  background: var(--surface); border: 1px solid var(--border); border-radius: 16px;
  padding: 18px 20px; margin-bottom: 16px; box-shadow: var(--shadow-card);
}
.mc-balance.ok { border-color: rgba(16, 185, 129, 0.35); }
.mc-balance-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 14px; }
.mc-balance-title { display: inline-flex; align-items: center; gap: 8px; font-size: 15px; font-weight: 700; color: var(--text-strong); }
.mc-balance-title :deep(svg) { color: #10b981; font-size: 18px; }
.mc-balance-body { display: flex; align-items: baseline; gap: 16px; flex-wrap: wrap; }
.mc-balance-main { display: flex; align-items: baseline; gap: 6px; }
.mc-balance-num { font-size: 34px; font-weight: 800; color: var(--text-strong); font-variant-numeric: tabular-nums; }
.mc-balance-unit { font-size: 14px; color: var(--text-muted); }
.mc-balance-sub { display: flex; gap: 16px; align-items: center; font-size: 13px; color: var(--text-muted); flex-wrap: wrap; }
.mc-balance-time { color: var(--text-faint); }
.mc-balance-hint { display: flex; align-items: flex-start; gap: 8px; font-size: 13px; color: var(--text-muted); line-height: 1.6; }
.mc-balance-hint :deep(svg) { color: #f59e0b; margin-top: 2px; flex-shrink: 0; }

/* 用量统计卡片 */
.mc-cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 14px;
  margin-bottom: 16px;
}
.mc-stat {
  background: var(--surface); border: 1px solid var(--border); border-radius: 14px;
  padding: 16px 18px; box-shadow: var(--shadow-card);
}
.mc-stat-label { font-size: 12px; color: var(--text-muted); margin-bottom: 6px; }
.mc-stat-value { font-size: 26px; font-weight: 800; color: var(--text-strong); }
.mc-stat-value.accent { color: var(--primary); }

/* 阿里额度 */
.mc-quota {
  background: var(--surface); border: 1px solid var(--border); border-radius: 14px;
  padding: 16px 18px; margin-bottom: 16px; box-shadow: var(--shadow-card);
}
.mc-quota-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; flex-wrap: wrap; }
.mc-quota-head h3 { margin: 0 0 4px; font-size: 15px; color: var(--text-strong); }
.mc-quota-head p { margin: 0; font-size: 12px; color: var(--text-muted); max-width: 540px; line-height: 1.6; }
.mc-quota-form { display: flex; align-items: center; gap: 10px; flex-shrink: 0; }
.mc-quota-bar {
  margin-top: 14px; height: 10px; border-radius: 999px; background: var(--surface-soft); overflow: hidden;
}
.mc-quota-fill {
  height: 100%; border-radius: 999px;
  background: linear-gradient(90deg, var(--primary-3), var(--primary-2)); transition: width 0.4s ease;
}
.mc-quota-fill.danger { background: linear-gradient(90deg, #f59e0b, #ef4444); }
.mc-quota-meta { margin-top: 8px; font-size: 12px; color: var(--text-muted); }

/* 表格区 */
.mc-tabs { --el-tabs-header-height: auto; }
.mc-tabs :deep(.el-tabs__header) { margin-bottom: 16px; }
.mc-tabs :deep(.el-tabs__item) { font-size: 15px; font-weight: 600; }
.mc-table-wrap {
  background: var(--surface); border: 1px solid var(--border); border-radius: 14px;
  padding: 14px 16px; box-shadow: var(--shadow-card); overflow-x: auto;
}
.mc-table-wrap :deep(.el-table) { background: transparent; color: var(--text-strong); }
.mc-table-wrap :deep(.el-table th.el-table__cell) { background: var(--surface-soft); color: var(--text-muted); font-weight: 600; }
.mc-table-wrap :deep(.el-table td.el-table__cell) { background: transparent; border-color: var(--border); }

/* 免费清单 */
.mc-banner {
  display: flex; align-items: flex-start; gap: 10px;
  background: linear-gradient(135deg, rgba(16, 185, 129, 0.08), rgba(6, 182, 212, 0.08));
  border: 1px solid var(--border-strong); border-radius: 12px;
  padding: 12px 14px; margin-bottom: 16px; font-size: 13px; color: var(--text-muted); line-height: 1.7;
}
.mc-banner :deep(svg) { color: #10b981; font-size: 18px; margin-top: 2px; flex-shrink: 0; }
.mc-status { display: inline-flex; align-items: center; gap: 6px; font-size: 13px; font-weight: 600; }
.mc-status .dot { width: 8px; height: 8px; border-radius: 50%; }
.mc-status.ok { color: #10b981; } .mc-status.ok .dot { background: #10b981; box-shadow: 0 0 8px rgba(16,185,129,0.6); }
.mc-status.warn { color: #d97706; } .mc-status.warn .dot { background: #d97706; }
.mc-status.bad { color: #ef4444; } .mc-status.bad .dot { background: #ef4444; }
.mc-status.unknown { color: var(--text-faint); } .mc-status.unknown .dot { background: var(--text-faint); }
.mc-status-src { font-size: 11px; color: var(--text-faint); margin-top: 2px; }

@media (max-width: 768px) {
  .mc-shell { padding: 14px; }
  .mc-title h1 { font-size: 18px; }
  .mc-actions { width: 100%; justify-content: space-between; }
}
</style>
