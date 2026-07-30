<template>
  <div class="auto-info">
    <div class="ai-header">
      <div>
        <h2>自动化信息缓存管理</h2>
        <p>集中管理由自动化任务产生的信息缓存（来源 / 标题 / 摘要 / 获取时间 / 过期时间），支持单条清理与一键清理过期，缓存保留天数可持久固定。</p>
      </div>
      <el-button :loading="loading" @click="reload">
        <el-icon><Refresh /></el-icon> 刷新
      </el-button>
    </div>

    <!-- 缓存设置 -->
    <div class="ai-settings">
      <div class="ai-set-row">
        <span class="ai-set-label">缓存保留天数</span>
        <el-input-number
          v-model="retentionDays"
          :min="1"
          :max="365"
          size="small"
          controls-position="right"
          @change="onRetentionChange"
        />
        <span class="ai-set-unit">天</span>
        <el-tag size="small" effect="plain" type="info">默认 7 天</el-tag>
        <span v-if="savedTip" class="ai-set-tip">已保存</span>
      </div>
      <div class="ai-set-note">
        超过保留天数的缓存会在「清理过期」时删除；该设置写入 <code>app_settings.automation_cache_days</code> 并持久固定，刷新 / 重开浏览器不丢失。
      </div>
    </div>

    <!-- 操作栏 -->
    <div class="ai-toolbar">
      <el-button type="danger" plain :loading="loading" @click="clearExpired">
        <el-icon><Delete /></el-icon> 清理过期缓存
      </el-button>
      <span class="ai-stat">共 {{ list.length }} 条</span>
      <span class="ai-stat ai-stat-expired">已过期 {{ expiredCount }} 条</span>
    </div>

    <div v-if="loading && !list.length" class="ai-loading">
      <el-icon class="is-loading"><Loading /></el-icon> 加载缓存中…
    </div>

    <div v-else-if="!list.length" class="ai-empty">
      <el-empty description="暂无缓存数据（自动化任务产生后会出现在这里）" :image-size="64" />
    </div>

    <div v-else class="ai-grid">
      <div v-for="row in list" :key="row.id" class="ai-card" :class="{ expired: isExpired(row) }">
        <div class="ai-card-top">
          <span class="ai-source">{{ row.source || row.category || '未知来源' }}</span>
          <el-tag v-if="isExpired(row)" size="small" type="danger" effect="light">已过期</el-tag>
          <el-button class="ai-del" size="small" text type="danger" @click="removeRow(row)">
            <el-icon><Delete /></el-icon>
          </el-button>
        </div>
        <div class="ai-title">{{ row.title }}</div>
        <p v-if="row.content" class="ai-summary">{{ row.content }}</p>
        <a v-if="row.url" class="ai-link" :href="row.url" target="_blank" rel="noopener">查看原文 ↗</a>
        <div class="ai-meta">
          <div>获取：{{ fmt(row.fetched_at) }}</div>
          <div>过期：{{ fmt(row.expire_at) }}</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { Refresh, Delete, Loading } from '@element-plus/icons-vue'
import {
  listAutomationInfo,
  deleteAutomationInfo,
  clearExpiredAutomationInfo,
  getAppSetting,
  setAppSetting,
  refreshSavedUser,
  type AutomationInfo
} from '../services/appDataService'

const list = ref<AutomationInfo[]>([])
const loading = ref(false)
const retentionDays = ref(7)
const savedTip = ref(false)

const SETTING_KEY = 'automation_cache_days'
const userId = ref('')

const expiredCount = computed(() => list.value.filter((r) => isExpired(r)).length)

function isExpired(row: AutomationInfo): boolean {
  if (!row.expire_at) return false
  return new Date(row.expire_at).getTime() < Date.now()
}

function fmt(iso?: string): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (isNaN(d.getTime())) return '—'
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

async function loadUser() {
  if (!userId.value) {
    const u = await refreshSavedUser()
    userId.value = u?.id || ''
  }
}

async function reload() {
  loading.value = true
  try {
    await loadUser()
    list.value = await listAutomationInfo(userId.value)
  } finally {
    loading.value = false
  }
}

async function loadRetention() {
  try {
    const v = await getAppSetting(SETTING_KEY)
    const n = typeof v === 'number' ? v : Number(v)
    if (Number.isFinite(n) && n >= 1 && n <= 365) {
      retentionDays.value = n
    } else {
      // 首次使用时写入默认 7 天
      await setAppSetting(SETTING_KEY, 7)
    }
  } catch {
    /* 读取失败则保持默认 7 */
  }
}

let saveTimer: ReturnType<typeof setTimeout> | undefined
function onRetentionChange(val: number) {
  retentionDays.value = val
  savedTip.value = false
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(async () => {
    await setAppSetting(SETTING_KEY, val)
    savedTip.value = true
    setTimeout(() => (savedTip.value = false), 2000)
  }, 400)
}

async function clearExpired() {
  loading.value = true
  try {
    await loadUser()
    const cleared = await clearExpiredAutomationInfo(userId.value, retentionDays.value)
    await reload()
    if (cleared > 0) ElMessage.success(`已清理 ${cleared} 条过期缓存`)
    else ElMessage.info('没有需要清理的过期缓存')
  } finally {
    loading.value = false
  }
}

async function removeRow(row: AutomationInfo) {
  loading.value = true
  try {
    await loadUser()
    await deleteAutomationInfo(userId.value, row.id)
    list.value = list.value.filter((r) => r.id !== row.id)
    ElMessage.success('已删除该缓存')
  } finally {
    loading.value = false
  }
}

onMounted(async () => {
  await loadRetention()
  await reload()
})
</script>

<style scoped>
.auto-info {
  padding: 24px;
  max-width: 1080px;
  margin: 0 auto;
  color: var(--text);
}
.ai-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 18px;
}
.ai-header h2 { margin: 0 0 6px; font-size: 22px; color: var(--text-strong); }
.ai-header p { margin: 0; font-size: 13px; color: var(--text-muted); max-width: 720px; line-height: 1.6; }

.ai-settings {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 14px;
  padding: 16px;
  margin-bottom: 16px;
  box-shadow: var(--shadow-card);
}
.ai-set-row { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.ai-set-label { font-size: 13px; color: var(--text); font-weight: 500; }
.ai-set-unit { font-size: 13px; color: var(--text-muted); }
.ai-set-tip { font-size: 12px; color: #16a34a; }
.ai-set-note { font-size: 12px; color: var(--text-faint); margin-top: 10px; line-height: 1.6; }
.ai-set-note code {
  background: var(--surface-soft); padding: 1px 6px; border-radius: 6px;
  font-size: 11px; color: var(--text-strong);
}

.ai-toolbar {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 16px;
}
.ai-stat { font-size: 12px; color: var(--text-faint); }
.ai-stat-expired { color: #dc2626; }

.ai-loading {
  display: flex; align-items: center; gap: 8px; color: var(--text-muted);
  padding: 40px 0; justify-content: center; font-size: 14px;
}
.is-loading { animation: rotating 1.2s linear infinite; }
@keyframes rotating { to { transform: rotate(360deg); } }

.ai-empty { padding: 30px 0; }

.ai-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 14px;
}
.ai-card {
  display: flex;
  flex-direction: column;
  gap: 8px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 14px;
  padding: 14px 16px;
  box-shadow: var(--shadow-card);
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}
.ai-card:hover { transform: translateY(-2px); box-shadow: 0 12px 28px rgba(15, 23, 42, 0.1); }
.ai-card.expired { opacity: 0.7; border-color: rgba(220, 38, 38, 0.3); }

.ai-card-top { display: flex; align-items: center; gap: 8px; }
.ai-source {
  font-size: 11px; color: var(--text-faint);
  background: var(--surface-soft); padding: 2px 8px; border-radius: 6px;
}
.ai-del { margin-left: auto; }

.ai-title { font-size: 14px; font-weight: 600; color: var(--text-strong); line-height: 1.5; word-break: break-word; }
.ai-summary {
  margin: 0; font-size: 12px; color: var(--text-muted); line-height: 1.6;
  display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden;
}
.ai-link { font-size: 12px; color: var(--primary); text-decoration: none; }
.ai-link:hover { text-decoration: underline; }
.ai-meta { font-size: 11px; color: var(--text-faint); display: flex; flex-direction: column; gap: 2px; margin-top: 2px; }

@media (max-width: 768px) {
  .auto-info { padding: 16px; }
  .ai-header { flex-direction: column; }
  .ai-header .el-button { width: 100%; }
  .ai-grid { grid-template-columns: 1fr; }
}
</style>
