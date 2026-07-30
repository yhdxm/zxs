<template>
  <div class="auto-info">
    <div class="ai-header">
      <div>
        <h2>自动化信息 · 各行业十大热点新闻</h2>
        <p>
          选择日期与行业，调用你配置的 AI（如阿里百炼免费模型）生成当日「十大热点新闻」，
          全程走本地 AI 配置、不消耗任何 WorkBuddy 积分。生成结果自动缓存，支持单条删除与过期清理。
        </p>
      </div>
    </div>

    <!-- 生成面板（Fix #6：恢复「选择日期 + 行业 → AI 生成十大热点新闻」） -->
    <div class="ai-generate">
      <div class="ai-gen-row">
        <el-date-picker
          v-model="genDate"
          type="date"
          value-format="YYYY-MM-DD"
          format="YYYY-MM-DD"
          placeholder="选择日期"
          size="default"
          class="ai-gen-date"
        />
        <el-select v-model="genIndustry" size="default" class="ai-gen-industry" placeholder="选择行业" filterable allow-create>
          <el-option v-for="ind in INDUSTRY_OPTIONS" :key="ind" :label="ind" :value="ind" />
        </el-select>
        <el-button type="primary" :loading="generating" @click="generate">
          <el-icon><MagicStick /></el-icon> 生成十大热点
        </el-button>
      </div>
      <div class="ai-gen-note">
        生成走你当前 AI 助手配置（<b>{{ aiModelLabel }}</b>）；未配置 Key 的本地模型（如 Ollama）请确保已启动。
      </div>
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
        超过保留天数的缓存会在「清理过期」或定时自动清理时删除；该设置写入 <code>app_settings.automation_cache_days</code> 并持久固定，刷新 / 重开浏览器不丢失。
      </div>
    </div>

    <!-- 操作栏 -->
    <div class="ai-toolbar">
      <el-button type="danger" plain :loading="loading" @click="clearExpired">
        <el-icon><Delete /></el-icon> 清理过期缓存
      </el-button>
      <el-button type="danger" plain :loading="loading" @click="clearAll">
        <el-icon><Delete /></el-icon> 清空全部
      </el-button>
      <el-select v-model="categoryFilter" size="default" class="ai-filter" placeholder="按行业筛选">
        <el-option label="全部行业" value="__all__" />
        <el-option v-for="c in categoryOptions" :key="c" :label="c" :value="c" />
      </el-select>
      <span class="ai-stat">共 {{ list.length }} 条</span>
      <span class="ai-stat ai-stat-expired">已过期 {{ expiredCount }} 条</span>
      <span class="ai-stat ai-stat-expiring">即将过期 {{ expiringCount }} 条</span>
    </div>

    <div v-if="loading && !list.length" class="ai-loading">
      <el-icon class="is-loading"><Loading /></el-icon> 加载缓存中…
    </div>

    <div v-else-if="!list.length" class="ai-empty">
      <el-empty description="暂无缓存数据（选择行业生成后会出现在这里）" :image-size="64" />
    </div>

    <div v-else class="ai-grid">
      <div v-for="row in filteredList" :key="row.id" class="ai-card" :class="cacheState(row)">
        <div class="ai-card-head">
          <span v-if="rankOf(row)" class="ai-rank">No.{{ rankOf(row) }}</span>
          <el-tag v-if="row.category" size="small" effect="plain" class="ai-cat">{{ row.category }}</el-tag>
          <el-tag size="small" :type="stateTag(row)" effect="light">{{ stateLabel(row) }}</el-tag>
          <el-button class="ai-del" size="small" text type="danger" @click="removeRow(row)">
            <el-icon><Delete /></el-icon>
          </el-button>
        </div>
        <div class="ai-title">{{ row.title }}</div>
        <div class="ai-source-line">
          <el-icon class="ai-ico"><OfficeBuilding /></el-icon>
          <span>{{ row.source || 'AI 生成' }}</span>
          <span v-if="row.extra?.date" class="ai-date-tag">{{ row.extra.date }}</span>
        </div>
        <div v-if="cleanContent(row)" class="ai-analysis">
          <span class="ai-analysis-label">影响解读</span>
          <p class="ai-analysis-text">{{ cleanContent(row) }}</p>
        </div>
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
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Refresh, Delete, Loading, MagicStick, OfficeBuilding } from '@element-plus/icons-vue'
import {
  listAutomationInfo,
  deleteAutomationInfo,
  clearExpiredAutomationInfo,
  getAppSetting,
  setAppSetting,
  refreshSavedUser,
  type AutomationInfo
} from '../services/appDataService'
import { callAi, loadAiConfig, type AiConfig } from '../services/aiService'
import { CALLABLE_MODELS } from '../services/modelCatalog'

const list = ref<AutomationInfo[]>([])
const loading = ref(false)
const categoryFilter = ref('__all__')

/** 已生成行业清单（用于顶部筛选） */
const categoryOptions = computed(() => {
  const set = new Set<string>()
  list.value.forEach((r) => {
    if (r.category) set.add(r.category)
  })
  return Array.from(set)
})

/** 按行业筛选后的列表 */
const filteredList = computed(() => {
  if (categoryFilter.value === '__all__') return list.value
  return list.value.filter((r) => r.category === categoryFilter.value)
})

/**
 * 清洗内容：早期缓存的 content 可能存了整段 AI 原始回复（含 ```json 围栏 / 纯 JSON 数组）。
 * 这里尝试解析，提取可读文本；无法解析则原样返回（仅去除代码围栏）。
 */
function cleanContent(row: AutomationInfo): string {
  const raw = (row.content || '').trim()
  if (!raw) return ''
  // 去除 ```json ... ``` 围栏
  const fence = raw.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const body = fence ? fence[1].trim() : raw
  // 尝试解析 JSON 数组 / 对象，提取 title/analysis/content 文本
  if (body.startsWith('[') || body.startsWith('{')) {
    try {
      const parsed = JSON.parse(body)
      const arr = Array.isArray(parsed) ? parsed : [parsed]
      const texts = arr
        .map((it: unknown) => {
          const o = (it || {}) as Record<string, unknown>
          const parts = [o.title, o.标题, o.analysis, o.解读, o.分析, o.content, o.摘要]
            .filter((v) => typeof v === 'string' && v.trim())
            .map((v) => (v as string).trim())
          return parts.join('：')
        })
        .filter((t: string) => t)
      if (texts.length) return texts.join('\n')
    } catch {
      /* 非标准 JSON，继续往下 */
    }
  }
  // 去掉残留的 JSON 片段痕迹（如 "title":"..." 这类）
  return body.replace(/[{}\[\]]/g, '').replace(/"title"\s*:\s*"[^"]*"/g, '').replace(/,\s*"analysis"\s*:\s*"[^"]*"/g, '').trim()
}

const rankOf = (row: AutomationInfo): number | null => {
  const r = row.extra?.rank
  return typeof r === 'number' ? r : null
}
const retentionDays = ref(7)
const savedTip = ref(false)
const generating = ref(false)
const genDate = ref(new Date().toISOString().slice(0, 10))
const genIndustry = ref('')

const SETTING_KEY = 'automation_cache_days'
const userId = ref('')
const aiConfig = ref<AiConfig | null>(null)
const autoCleanTimer = ref<ReturnType<typeof setInterval> | null>(null)

/** 可选行业（用于生成十大热点新闻） */
const INDUSTRY_OPTIONS = [
  '科技', '互联网', '人工智能', '金融', '医疗健康', '教育培训',
  '电商零售', '汽车出行', '房地产', '游戏电竞', '文化旅游',
  '体育运动', '美食餐饮', '时尚美妆', '能源环保', '农业', '企业服务'
]

const aiModelLabel = computed(() => {
  const c = aiConfig.value
  if (!c) return '未配置'
  const hit = CALLABLE_MODELS.find((m) => m.model === c.model && m.provider === c.provider)
  return hit ? hit.label : `${c.provider} · ${c.model}`
})

type CacheState = 'normal' | 'expiring' | 'expired'

/** 距过期 < 24 小时视为「即将过期」 */
const EXPIRING_THRESHOLD_MS = 24 * 60 * 60 * 1000

const STATE_LABEL: Record<CacheState, string> = {
  normal: '正常',
  expiring: '即将过期',
  expired: '已过期'
}

const STATE_TAG: Record<CacheState, 'success' | 'warning' | 'danger'> = {
  normal: 'success',
  expiring: 'warning',
  expired: 'danger'
}

/** 三态判定：已过期 / 即将过期（<24h）/ 正常 */
function cacheState(row: AutomationInfo): CacheState {
  if (!row.expire_at) return 'normal'
  const diff = new Date(row.expire_at).getTime() - Date.now()
  if (diff < 0) return 'expired'
  if (diff < EXPIRING_THRESHOLD_MS) return 'expiring'
  return 'normal'
}

function stateLabel(row: AutomationInfo): string {
  return STATE_LABEL[cacheState(row)]
}

function stateTag(row: AutomationInfo): 'success' | 'warning' | 'danger' {
  return STATE_TAG[cacheState(row)]
}

const expiredCount = computed(() => list.value.filter((r) => cacheState(r) === 'expired').length)
const expiringCount = computed(() => list.value.filter((r) => cacheState(r) === 'expiring').length)

function fmt(iso?: string): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (isNaN(d.getTime())) return '—'
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function genRowId(): string {
  return `auto-${Math.random().toString(36).slice(2, 9)}-${Date.now().toString(36)}`
}

async function loadUser() {
  if (userId.value) return
  try {
    const u = await refreshSavedUser()
    userId.value = u?.id || ''
  } catch {
    userId.value = ''
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

/** 解析 AI 返回的十大热点（优先 JSON，回退按行解析） */
function parseNews(text: string): Array<{ title: string; source: string; analysis: string }> {
  let raw = (text || '').trim()
  // 去掉 ```json ... ``` 代码围栏
  const fence = raw.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fence) raw = fence[1].trim()
  try {
    const arr = JSON.parse(raw)
    if (Array.isArray(arr)) {
      return arr
        .map((it: unknown) => {
          const o = it as Record<string, unknown>
          return {
            title: String(o.title || o.标题 || '').trim(),
            source: String(o.source || o.来源 || 'AI 生成').trim(),
            analysis: String(o.analysis || o.解读 || o.分析 || o.content || '').trim()
          }
        })
        .filter((it) => it.title)
    }
  } catch {
    /* 非 JSON，走行解析 */
  }
  // 行解析：每行视为一条，标题以「数字.」或「-」开头
  return raw
    .split(/\n+/)
    .map((line) => line.replace(/^[\d]+[.、)]\s*/, '').replace(/^[-*]\s*/, '').trim())
    .filter((line) => line.length > 0)
    .map((line) => ({ title: line, source: 'AI 生成', analysis: '' }))
}

/** 生成十大热点新闻（Fix #6） */
async function generate() {
  if (!genIndustry.value.trim()) {
    ElMessage.warning('请先选择或输入行业')
    return
  }
  generating.value = true
  try {
    await loadUser()
    if (!aiConfig.value) {
      aiConfig.value = await loadAiConfig(userId.value || undefined)
    }
    const cfg = aiConfig.value
    const prompt =
      `你是一名资深行业分析师。请针对「${genIndustry.value.trim()}」行业，整理 ${genDate.value} 当天的「十大热点新闻」。` +
      `严格只输出一个 JSON 数组（不要任何代码块标记、不要额外解释文字），数组包含 10 个对象，` +
      `每个对象字段：\n- "title": 新闻标题（简洁，20 字内）\n` +
      `- "source": 来源媒体或机构（如 36氪、证券时报、官方公告 等）\n` +
      `- "analysis": 一句话影响解读（30 字内）\n` +
      `请基于公开常识合理生成，来源标注公开渠道。`

    const reply = await callAi(cfg, prompt)
    const items = parseNews(reply)
    if (items.length === 0) {
      ElMessage.warning('AI 未返回可解析的新闻内容，请重试或更换模型')
      return
    }

    const now = new Date()
    const expireAt = new Date(now.getTime() + retentionDays.value * 86400000).toISOString()
    const rows: AutomationInfo[] = items.slice(0, 10).map((it, i) => ({
      id: genRowId(),
      user_id: userId.value,
      category: genIndustry.value.trim(),
      title: it.title,
      content: it.analysis,
      url: '',
      source: it.source,
      extra: { date: genDate.value, rank: i + 1 },
      fetched_at: now.toISOString(),
      expire_at: expireAt
    }))

    const { saveAutomationInfo } = await import('../services/appDataService')
    await saveAutomationInfo(userId.value, rows)
    await reload()
    ElMessage.success(`已生成 ${rows.length} 条${genIndustry.value.trim()}热点新闻`)
  } catch (e) {
    ElMessage.error('生成失败：' + (e instanceof Error ? e.message : String(e)))
  } finally {
    generating.value = false
  }
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

async function clearAll() {
  try {
    await ElMessageBox.confirm('确认清空全部自动化信息缓存？此操作不可恢复。', '清空确认', { type: 'warning' })
  } catch {
    return
  }
  loading.value = true
  try {
    await loadUser()
    const { clearAllAutomationInfo } = await import('../services/appDataService')
    const cleared = await clearAllAutomationInfo(userId.value)
    await reload()
    ElMessage.success(`已清空 ${cleared} 条缓存`)
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

/** 定时自动清理过期缓存（Fix #6：进入页面后每 5 分钟清理一次） */
function startAutoClean() {
  stopAutoClean()
  autoCleanTimer.value = setInterval(async () => {
    try {
      await loadUser()
      await clearExpiredAutomationInfo(userId.value, retentionDays.value)
      await reload()
    } catch {
      /* 静默 */
    }
  }, 5 * 60 * 1000)
}
function stopAutoClean() {
  if (autoCleanTimer.value) {
    clearInterval(autoCleanTimer.value)
    autoCleanTimer.value = null
  }
}

onMounted(async () => {
  try {
    const u = await refreshSavedUser()
    userId.value = u?.id || ''
    aiConfig.value = await loadAiConfig(userId.value || undefined)
  } catch {
    /* ignore */
  }
  await loadRetention()
  await reload()
  // 进入即清理一次过期缓存，并启动定时自动清理
  try {
    await clearExpiredAutomationInfo(userId.value, retentionDays.value)
    await reload()
  } catch {
    /* ignore */
  }
  startAutoClean()
})

onBeforeUnmount(stopAutoClean)
</script>

<style scoped>
.auto-info {
  padding: 24px;
  max-width: 1080px;
  margin: 0 auto;
  color: var(--text);
}
.ai-header {
  margin-bottom: 18px;
}
.ai-header h2 { margin: 0 0 6px; font-size: 22px; color: var(--text-strong); }
.ai-header p { margin: 0; font-size: 13px; color: var(--text-muted); max-width: 760px; line-height: 1.6; }

.ai-generate {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 14px;
  padding: 16px;
  margin-bottom: 16px;
  box-shadow: var(--shadow-card);
}
.ai-gen-row { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.ai-gen-date { width: 170px; }
.ai-gen-industry { width: 200px; }
.ai-gen-note { font-size: 12px; color: var(--text-faint); margin-top: 10px; line-height: 1.6; }
.ai-gen-note b { color: var(--text-strong); }

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
  gap: 12px;
  margin-bottom: 16px;
  flex-wrap: wrap;
}
.ai-filter { width: 160px; }
.ai-stat { font-size: 12px; color: var(--text-faint); }
.ai-stat-expired { color: #dc2626; }
.ai-stat-expiring { color: #f59e0b; }

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
.ai-card.expiring { border-color: rgba(245, 158, 11, 0.45); }
.ai-card.normal { border-color: rgba(22, 163, 74, 0.25); }

.ai-card-head { display: flex; align-items: center; gap: 8px; }
.ai-rank {
  font-size: 12px; font-weight: 700; color: #fff;
  background: linear-gradient(135deg, #6366f1, #8b5cf6);
  padding: 2px 9px; border-radius: 8px; letter-spacing: 0.3px;
}
.ai-cat { transform: scale(0.9); transform-origin: left center; }
.ai-del { margin-left: auto; }

.ai-title {
  font-size: 16px; font-weight: 700; color: var(--text-strong);
  line-height: 1.5; word-break: break-word; margin-top: 2px;
}
.ai-source-line {
  display: flex; align-items: center; gap: 6px;
  font-size: 12px; color: var(--text-muted);
}
.ai-ico { font-size: 14px; color: var(--text-faint); }
.ai-date-tag {
  font-size: 11px; color: var(--text-faint);
  background: var(--surface-soft); padding: 1px 7px; border-radius: 6px; margin-left: 2px;
}
.ai-analysis {
  background: var(--surface-soft);
  border-left: 3px solid var(--primary);
  border-radius: 8px;
  padding: 8px 10px;
  margin-top: 2px;
}
.ai-analysis-label {
  display: inline-block;
  font-size: 11px; font-weight: 600; color: var(--primary);
  margin-bottom: 3px;
}
.ai-analysis-text {
  margin: 0;
  font-size: 12.5px; color: var(--text); line-height: 1.65;
  white-space: pre-line;
}
.ai-link { font-size: 12px; color: var(--primary); text-decoration: none; }
.ai-link:hover { text-decoration: underline; }
.ai-meta { font-size: 11px; color: var(--text-faint); display: flex; flex-direction: column; gap: 2px; margin-top: 2px; }

@media (max-width: 768px) {
  .auto-info { padding: 16px; }
  .ai-gen-row { flex-direction: column; align-items: stretch; }
  .ai-gen-date, .ai-gen-industry { width: 100%; }
  .ai-grid { grid-template-columns: 1fr; }
}
</style>
