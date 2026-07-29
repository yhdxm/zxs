<template>
  <div class="auto-info">
    <div class="auto-header">
      <div>
        <h2>自动化 · 信息</h2>
        <p>选择日期与行业，点击「生成」调用 AI 输出当天各行业十大新闻与分析。不选日期不会生成。</p>
      </div>
    </div>

    <div class="auto-controls">
      <el-date-picker
        v-model="pickDate"
        type="date"
        placeholder="选择日期"
        value-format="YYYY-MM-DD"
        :clearable="true"
        size="default"
        class="auto-date"
      />
      <el-select
        v-model="industries"
        multiple
        collapse-tags
        collapse-tags-tooltip
        placeholder="选择行业"
        size="default"
        class="auto-industries"
      >
        <el-option v-for="ind in INDUSTRY_OPTIONS" :key="ind" :label="ind" :value="ind" />
      </el-select>
      <el-button type="primary" :loading="generating" @click="generate">
        <el-icon><MagicStick /></el-icon> 生成
      </el-button>
      <el-button v-if="result" @click="copyResult">
        <el-icon><CopyDocument /></el-icon> 复制
      </el-button>
    </div>

    <div class="auto-cache">
      <div class="auto-cache-row">
        <span class="auto-cache-label">缓存保留天数</span>
        <el-input-number
          v-model="retentionDays"
          :min="1"
          :max="365"
          size="small"
          controls-position="right"
          @change="onRetentionChange"
        />
        <span class="auto-cache-unit">天</span>
        <el-button size="small" @click="clearOldCache(true)">
          <el-icon><Delete /></el-icon> 立即清理过期缓存
        </el-button>
        <span v-if="lastCleared !== null" class="auto-cache-tip">已清理 {{ lastCleared }} 条</span>
      </div>
      <div class="auto-cache-note">超过保留天数的「每日新闻」本地缓存会被自动清除，释放浏览器空间；生成时也会静默清理一次。</div>
    </div>

    <div v-if="!pickDate && !generating && !result" class="auto-hint">
      <el-icon><InfoFilled /></el-icon>
      <span>请先选择日期，再点击「生成」。不选择日期、不点击生成，系统不会调用 AI。</span>
    </div>

    <div v-if="generating" class="auto-loading">
      <el-icon class="is-loading"><Loading /></el-icon> AI 生成中，请稍候…
    </div>

    <div v-if="result" class="auto-result">
      <div class="auto-result-meta">
        <div class="meta-line">
          <span class="meta-key">日期</span><b>{{ pickDate }}</b>
          <span class="meta-key" style="margin-left:14px">模型</span><b>{{ usedModel }}</b>
        </div>
        <div class="meta-industries">
          <span class="meta-key">行业</span>
          <el-tag v-for="ind in industries" :key="ind" size="small" effect="light" class="ind-tag">{{ ind }}</el-tag>
        </div>
      </div>
      <div class="auto-result-body" v-html="renderedResult"></div>
      <div class="auto-result-foot">内容为 AI 生成，仅供参考，请自行核实关键信息。</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { MagicStick, InfoFilled, CopyDocument, Loading, Delete } from '@element-plus/icons-vue'
import { callAi, loadAiConfig } from '../services/aiService'
import { refreshSavedUser } from '../services/appDataService'
import { renderMarkdown } from '../lib/markdown'
import { recordUsage } from '../services/usageTracker'

const INDUSTRY_OPTIONS = [
  '科技', '金融', '医疗健康', '教育培训', '消费零售',
  '能源化工', '房地产', '汽车出行', '农业食品', '文娱传媒', '体育', '旅游'
]

const pickDate = ref('')
const industries = ref<string[]>(['科技', '金融', '消费零售'])
const generating = ref(false)
const result = ref('')
const usedModel = ref('—')
const userId = ref('')

const RETENTION_KEY = 'auto_news_retention_days'
const retentionDays = ref(30)
const lastCleared = ref<number | null>(null)

function cacheKey(date: string, inds: string[]): string {
  return `news_cache_${date}_${[...inds].sort().join(',')}`
}

function loadRetention() {
  try {
    const v = Number(localStorage.getItem(RETENTION_KEY))
    if (v >= 1 && v <= 365) retentionDays.value = v
  } catch { /* ignore */ }
}
function onRetentionChange(val: number) {
  retentionDays.value = val
  try { localStorage.setItem(RETENTION_KEY, String(val)) } catch { /* ignore */ }
}
/** 清理超过保留天数的缓存；showToast=true 时提示清理条数 */
function clearOldCache(showToast = false): number {
  let cleared = 0
  try {
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - retentionDays.value)
    const cutoffTs = cutoff.getTime()
    const keys: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (k && /^news_cache_\d{4}-\d{2}-\d{2}(_.+)?$/.test(k)) keys.push(k)
    }
    for (const k of keys) {
      const m = k.match(/^news_cache_(\d{4}-\d{2}-\d{2})/)
      if (!m) continue
      const ts = new Date(m[1] + 'T00:00:00').getTime()
      if (!isNaN(ts) && ts < cutoffTs) {
        localStorage.removeItem(k)
        cleared++
      }
    }
  } catch { /* ignore */ }
  if (showToast) {
    lastCleared.value = cleared
    if (cleared > 0) ElMessage.success(`已清理 ${cleared} 条过期缓存`)
    else ElMessage.info('没有需要清理的过期缓存')
  }
  return cleared
}

loadRetention()

async function ensureUser() {
  if (!userId.value) {
    const u = await refreshSavedUser()
    userId.value = u?.id || ''
  }
}

async function generate() {
  if (!pickDate.value) {
    ElMessage.warning('请先选择日期')
    return
  }
  if (industries.value.length === 0) {
    ElMessage.warning('请至少选择一个行业')
    return
  }

  const key = cacheKey(pickDate.value, industries.value)
  const cached = typeof localStorage !== 'undefined' ? localStorage.getItem(key) : null
  if (cached) {
    try {
      await ElMessageBox.confirm('该日期+行业组合已生成过内容，是否重新生成？', '提示', { type: 'warning' })
    } catch {
      result.value = cached
      usedModel.value = '（本地缓存）'
      ElMessage.info('已展示本地已生成内容')
      return
    }
  }

  generating.value = true
  try {
    clearOldCache() // 生成前静默清理过期缓存，释放浏览器空间
    await ensureUser()
    const config = await loadAiConfig(userId.value)
    if (!config.apiKey && config.provider !== 'ollama') {
      ElMessage.warning('尚未配置 AI 密钥，请先到「AI 助手」页配置可用的模型与 Key')
      return
    }
    const prompt = buildPrompt(pickDate.value, industries.value)
    const text = await callAi(config, prompt)
    result.value = text
    usedModel.value = `${config.provider} / ${config.model}`
    recordUsage({ provider: config.provider, model: config.model, promptText: prompt, completionText: text })
    if (typeof localStorage !== 'undefined') localStorage.setItem(key, text)
  } catch (e) {
    ElMessage.error('生成失败：' + (e instanceof Error ? e.message : String(e)))
  } finally {
    generating.value = false
  }
}

function buildPrompt(date: string, inds: string[]): string {
  return [
    `请以「${date}」为时间节点，整理并输出以下行业当天的「十大新闻与分析」：`,
    inds.join('、') + '。',
    '',
    '对每一个行业，分别给出：',
    '1）「十大新闻」列表：每条为「一句话标题 + 简短说明」；',
    '2）一段「行业分析」：涵盖趋势、机会与风险。',
    '',
    '要求：信息结构化、客观、可执行；使用中文输出；行业之间用标题清晰分隔。'
  ].join('\n')
}

const renderedResult = computed(() => renderMarkdown(result.value || ''))

async function copyResult() {
  try {
    await navigator.clipboard.writeText(result.value)
    ElMessage.success('已复制到剪贴板')
  } catch {
    ElMessage.warning('复制失败，请手动选择文本复制')
  }
}
</script>

<style scoped>
.auto-info {
  padding: 24px;
  max-width: 1080px;
  margin: 0 auto;
  color: var(--text);
}
.auto-header {
  margin-bottom: 20px;
}
.auto-header h2 {
  margin: 0 0 6px;
  font-size: 22px;
  color: var(--text-strong);
}
.auto-header p {
  margin: 0;
  font-size: 13px;
  color: var(--text-muted);
}
.auto-controls {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: center;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 14px;
  padding: 16px;
  margin-bottom: 18px;
  box-shadow: var(--shadow-card);
}
.auto-date {
  width: 180px;
}
.auto-industries {
  flex: 1;
  min-width: 240px;
}
.auto-cache {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 14px;
  padding: 14px 16px;
  margin-bottom: 18px;
}
.auto-cache-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
}
.auto-cache-label {
  font-size: 13px;
  color: var(--text);
  font-weight: 500;
}
.auto-cache-unit {
  font-size: 13px;
  color: var(--text-muted);
}
.auto-cache-tip {
  font-size: 12px;
  color: #16a34a;
}
.auto-cache-note {
  font-size: 12px;
  color: var(--text-faint);
  margin-top: 8px;
  line-height: 1.6;
}
.auto-hint {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  background: var(--nav-hover);
  border-radius: 10px;
  padding: 14px 16px;
  font-size: 13px;
  color: var(--text);
  line-height: 1.6;
}
.auto-loading {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--primary);
  padding: 30px 0;
  justify-content: center;
  font-size: 14px;
}
.is-loading {
  animation: rotating 1.2s linear infinite;
}
@keyframes rotating {
  to { transform: rotate(360deg); }
}
.auto-result {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 14px;
  padding: 20px;
  box-shadow: var(--shadow-card);
}
.auto-result-meta {
  font-size: 13px;
  color: var(--text-muted);
  margin-bottom: 14px;
  padding-bottom: 12px;
  border-bottom: 1px dashed var(--border-strong);
}
.auto-result-meta b {
  color: var(--text-strong);
}
.meta-key {
  color: var(--text-faint);
  margin-right: 4px;
}
.meta-industries {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 8px;
}
.ind-tag {
  margin-right: 2px;
}
.auto-result-body {
  color: var(--text);
  font-size: 14px;
  line-height: 1.8;
}
.auto-result-foot {
  margin-top: 16px;
  font-size: 12px;
  color: var(--text-faint);
  border-top: 1px dashed var(--border);
  padding-top: 10px;
}

@media (max-width: 768px) {
  .auto-info { padding: 16px; }
  .auto-date { width: 100%; }
  .auto-industries { width: 100%; }
}
</style>
