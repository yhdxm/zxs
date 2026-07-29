<template>
  <div class="dash-shell">
    <!-- 数据看板（默认主页，置顶第一行） -->
    <DashboardBoard v-if="view === 'overview'" :dashboard="dashboard" />

    <!-- AI 模型监测模块：状态卡 + 内嵌 AI 助手对话 -->
    <section v-if="view === 'overview'" class="model-monitor">
      <div class="mm-head">
        <div class="mm-title">
          <span class="mm-icon"><el-icon><MagicStick /></el-icon></span>
          <div>
            <h2>AI 模型监测</h2>
            <p>当前模型运行状态与对话入口，支持免费模型实时切换与监测。</p>
          </div>
        </div>
        <span class="mm-status" :class="currentModel !== '未配置' ? 'ok' : 'warn'">
          <span class="dot"></span>{{ currentModel !== '未配置' ? '已就绪' : '未配置' }}
        </span>
      </div>

      <div class="mm-grid">
        <div class="mm-cards">
          <div class="mm-card">
            <div class="mm-card-label">当前模型</div>
            <div class="mm-card-value">{{ currentModel }}</div>
          </div>
          <div class="mm-card">
            <div class="mm-card-label">厂商 / 类型</div>
            <div class="mm-card-value">{{ currentProvider }}</div>
          </div>
          <div class="mm-card">
            <div class="mm-card-label">累计对话轮次</div>
            <div class="mm-card-value">{{ callsCount }}</div>
          </div>
          <div class="mm-card mm-card-hint">
            <div class="mm-card-label">用量 / 免费清单</div>
            <div class="mm-card-value small">{{ usage.freeCalls }} 次免费 · {{ usage.todayCalls }} 次今日</div>
            <p class="mm-hint-text">
              <el-button type="primary" link @click="goModels">进入模型中心 →</el-button>
            </p>
          </div>
        </div>
        <div class="mm-chat">
          <AiChatPanel title="AI 对话" subtitle="在监测面板内直接发起对话" :compact="true" />
        </div>
      </div>
    </section>

    <!-- 模块管理：待办 / 点位 / 内容 -->
    <ModuleManager
      v-else
      :type="view"
      :dashboard="dashboard"
      :on-save="save"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import {
  getSavedUser,
  loadDashboardData,
  saveDashboardData,
  subscribeDashboardChanges,
  type AppDashboardData,
  type AppUser,
  type DashboardChangeEvent
} from '../services/appDataService'
import DashboardBoard from '../components/DashboardBoard.vue'
import ModuleManager from '../components/ModuleManager.vue'
import AiChatPanel from '../components/AiChatPanel.vue'
import { loadAiConfig } from '../services/aiService'
import { getUsageStats, type UsageSummary } from '../services/usageTracker'

type ViewMode = 'overview' | 'todos' | 'points' | 'contents'

const router = useRouter()
const route = useRoute()
const user = reactive<AppUser>({ id: '', email: '', username: '', nickname: '', role: 'user', disabled: false })
const dashboard = reactive<AppDashboardData>({ todos: [], points: [], contents: [] })

/* ============ 视图模式：数据看板 / 模块管理 ============ */
const view = ref<ViewMode>('overview')
const currentModel = ref('未配置')
const currentProvider = ref('未知')
const callsCount = ref(0)
const usage = ref<UsageSummary>({
  totalCalls: 0, todayCalls: 0, freeCalls: 0, paidCalls: 0, freeRatio: 0, totalEstTokens: 0, byModel: [], bailianUsed: 0
})
const goModels = () => router.push('/models')
const initViewFromRoute = () => {
  const q = Array.isArray(route.query.view) ? route.query.view[0] : route.query.view
  view.value = q === 'todos' || q === 'points' || q === 'contents' ? (q as ViewMode) : 'overview'
}
watch(() => route.query.view, initViewFromRoute)

/* ============ 跨端同步状态 ============ */
const saving = ref(false)
let pendingSave: AppDashboardData | null = null
let unsubscribe: (() => void) | null = null

/* ============ 持久化 + 跨端同步 ============ */
const save = async () => {
  if (!user.id) return
  saving.value = true
  const ok = await saveDashboardData(user.id, {
    todos: dashboard.todos,
    points: dashboard.points,
    contents: dashboard.contents
  })
  saving.value = false

  if (ok) {
    pendingSave = null
  } else {
    pendingSave = {
      todos: dashboard.todos,
      points: dashboard.points,
      contents: dashboard.contents
    }
    ElMessage.warning('云端同步失败，恢复网络后将自动重试')
  }
}

const reloadFromServer = async () => {
  if (!user.id) return
  const data = await loadDashboardData(user.id)
  dashboard.todos = data.todos
  dashboard.points = data.points
  dashboard.contents = data.contents
}

const onRemoteChange = (_event: DashboardChangeEvent) => {
  if (saving.value) return
  reloadFromServer()
}
const onVisibility = () => {
  if (typeof document !== 'undefined' && document.visibilityState === 'visible') reloadFromServer()
}
const onFocus = () => reloadFromServer()
const onOnline = () => {
  if (pendingSave && user.id) save()
}

onMounted(async () => {
  const currentUser = await getSavedUser()
  if (!currentUser) {
    router.replace('/login')
    return
  }
  user.id = currentUser.id
  user.email = currentUser.email
  user.username = currentUser.username
  user.nickname = currentUser.nickname

  initViewFromRoute()

  // AI 模型监测：读取当前模型配置与本地调用统计
  const cfg = await loadAiConfig()
  currentModel.value = cfg.model || '未配置'
  currentProvider.value = cfg.provider || '未知'
  try {
    const raw = window.localStorage.getItem('ai-chat-history')
    if (raw) {
      const arr = JSON.parse(raw) as Array<{ role?: string }>
      if (Array.isArray(arr)) callsCount.value = arr.filter((m) => m.role === 'assistant').length
    }
  } catch { /* ignore */ }

  // 模型用量统计（本地记录，用于监测模块展示）
  usage.value = getUsageStats()

  const data = await loadDashboardData(currentUser.id)
  dashboard.todos = data.todos
  dashboard.points = data.points
  dashboard.contents = data.contents

  unsubscribe = subscribeDashboardChanges(currentUser.id, onRemoteChange)

  if (typeof window !== 'undefined') {
    window.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('focus', onFocus)
    window.addEventListener('online', onOnline)
  }
})

onBeforeUnmount(() => {
  if (unsubscribe) {
    unsubscribe()
    unsubscribe = null
  }
  if (typeof window !== 'undefined') {
    window.removeEventListener('visibilitychange', onVisibility)
    window.removeEventListener('focus', onFocus)
    window.removeEventListener('online', onOnline)
  }
})
</script>

<style scoped>
.dash-shell {
  padding: 22px;
  font-family: 'Inter', system-ui, -apple-system, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif;
  background: var(--bg-app);
  min-height: calc(100vh - var(--nav-h, 56px));
}

/* ===== AI 模型监测模块 ===== */
.model-monitor {
  margin-top: 22px;
}
.mm-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  margin-bottom: 14px;
}
.mm-title { display: flex; align-items: center; gap: 12px; min-width: 0; }
.mm-icon {
  width: 40px; height: 40px; border-radius: 12px;
  display: grid; place-items: center; flex-shrink: 0;
  background: linear-gradient(135deg, var(--primary-3), var(--primary-2));
  color: #fff; box-shadow: 0 8px 18px var(--accent-glow);
}
.mm-icon :deep(svg) { font-size: 20px; }
.mm-title h2 { margin: 0; font-size: 18px; font-weight: 800; color: var(--text-strong); }
.mm-title p { margin: 2px 0 0; font-size: 12px; color: var(--text-muted); }
.mm-status {
  display: inline-flex; align-items: center; gap: 6px;
  font-size: 13px; font-weight: 600; padding: 6px 12px; border-radius: 999px;
  flex-shrink: 0;
}
.mm-status .dot { width: 8px; height: 8px; border-radius: 50%; }
.mm-status.ok { background: rgba(16, 185, 129, 0.12); color: #10b981; }
.mm-status.ok .dot { background: #10b981; box-shadow: 0 0 8px rgba(16, 185, 129, 0.6); }
.mm-status.warn { background: rgba(245, 158, 11, 0.14); color: #f59e0b; }
.mm-status.warn .dot { background: #f59e0b; }

.mm-grid {
  display: grid;
  grid-template-columns: 300px 1fr;
  gap: 16px;
  align-items: stretch;
}
.mm-cards {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.mm-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 14px;
  padding: 14px 16px;
  box-shadow: var(--shadow-card);
}
.mm-card-label { font-size: 12px; color: var(--text-muted); margin-bottom: 4px; }
.mm-card-value { font-size: 18px; font-weight: 800; color: var(--text-strong); }
.mm-card-value.small { font-size: 14px; }
.mm-card-hint { background: var(--surface-soft); }
.mm-hint-text { margin: 8px 0 0; font-size: 12px; color: var(--text-faint); line-height: 1.6; }
.mm-chat {
  height: 520px;
  min-height: 0;
}

@media (max-width: 980px) {
  .mm-grid { grid-template-columns: 1fr; }
  .mm-cards { flex-direction: row; flex-wrap: wrap; }
  .mm-card { flex: 1; min-width: 140px; }
  .mm-card-hint { flex-basis: 100%; }
  .mm-chat { height: 480px; }
}
@media (max-width: 768px) {
  .dash-shell { padding: 14px; }
}
@media (max-width: 560px) {
  .mm-cards { flex-direction: column; }
  .mm-card { min-width: 0; }
  .mm-chat { height: 460px; }
}
</style>
