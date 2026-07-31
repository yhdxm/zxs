<template>
  <div class="am-root">
    <header class="am-top">
      <div class="am-brand">
        <span class="am-logo">AI 模型知识</span>
        <span class="am-tag">全球模型 · 热点 · AI 结合（全部免费）</span>
      </div>
      <div class="am-tabs">
        <span v-for="t in tabs" :key="t.key" :class="['am-tab', active === t.key ? 'on' : '']" @click="active = t.key">{{ t.label }}</span>
      </div>
      <div class="am-clock-box" title="北京时间">
        <span class="am-dot"></span><span class="am-clock">{{ nowText }}</span><span class="am-clock-hint">北京时间</span>
      </div>
    </header>

    <main class="am-main">
      <!-- 全球模型 -->
      <section v-if="active === 'global'" class="am-card">
        <div class="am-hrow">
          <h3 class="am-h">全球开源 / 开放模型榜单</h3>
          <div class="am-tools">
            <el-input v-model="search" placeholder="搜索模型名 / 作者" class="am-search" />
            <el-select v-model="taskFilter" placeholder="任务类型" clearable class="am-sel">
              <el-option v-for="t in tasks" :key="t" :label="t" :value="t" />
            </el-select>
            <button class="am-refresh" @click="loadModels" :disabled="loading">{{ loading ? '加载中…' : '刷新' }}</button>
          </div>
        </div>
        <p class="am-sub">数据来自 Hugging Face 公共 API（按下载量排序，免费直连，失败自动展示知名模型兜底）。</p>
        <div class="am-grid">
          <div v-for="m in filteredModels" :key="m.id" class="am-model">
            <div class="am-model-top">
              <div class="am-model-name">{{ m.model }}</div>
              <span v-if="m.gated" class="am-badge gated">受限</span>
            </div>
            <div class="am-model-author">{{ m.author }}</div>
            <div class="am-model-meta">
              <span>⬇ {{ fmt(m.downloads) }}</span><span>♥ {{ m.likes }}</span><span class="am-task">{{ m.task }}</span>
            </div>
            <div class="am-tags">
              <span v-for="tag in m.tags.slice(0, 4)" :key="tag" class="am-tag">{{ tag }}</span>
            </div>
            <div class="am-model-actions">
              <button class="am-mini" @click="askModel(m)">AI 追问</button>
              <button class="am-mini" :class="{ on: isBooked(m.id) }" @click="toggleBookmark(m)">{{ isBooked(m.id) ? '已收藏' : '收藏' }}</button>
            </div>
          </div>
          <p v-if="!filteredModels.length && !loading" class="am-empty">没有匹配的模型。</p>
        </div>
      </section>

      <!-- 模型热点 -->
      <section v-else class="am-card">
        <div class="am-hrow">
          <h3 class="am-h">模型热点信息</h3>
          <button class="am-refresh" @click="loadNews" :disabled="newsLoading">{{ newsLoading ? '加载中…' : '刷新' }}</button>
        </div>
        <div class="am-grid">
          <a v-for="n in modelNews" :key="n.link" :href="n.link" target="_blank" class="am-news">
            <div class="am-news-title">{{ n.title }}</div>
            <div class="am-news-meta"><span>{{ n.source }}</span><span>{{ n.pubDate }}</span></div>
          </a>
          <p v-if="!modelNews.length && !newsLoading" class="am-empty">暂无数据，点击刷新重试。</p>
        </div>
      </section>

      <!-- AI 追问面板 -->
      <section v-if="askTarget" class="am-card am-ask">
        <div class="am-hrow">
          <h3 class="am-h">向 AI 追问：{{ askTarget.model }}</h3>
          <button class="am-mini" @click="askTarget = null">关闭</button>
        </div>
        <el-input v-model="askQ" type="textarea" :rows="2" :placeholder="`想问关于 ${askTarget.model} 的什么？例如：它适合中文任务吗？和 GPT 比如何？`" />
        <div class="am-row">
          <el-button type="primary" :loading="askLoading" @click="runAsk">提问</el-button>
          <span v-if="!cfg" class="am-warn">未检测到 AI 配置，请先到「AI 助手」配置密钥。</span>
        </div>
        <div v-if="askA" class="am-answer">{{ askA }}</div>
      </section>
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { loadAiConfig, callAi, type AiConfig } from '../services/aiService'
import { fetchGlobalModels, fetchModelNews, MODEL_TASKS, type GlobalModel } from '../services/modelService'
import { listModelBookmarks, addModelBookmark, removeModelBookmark, type ModelBookmark } from '../services/learnDb'
import type { NewsItem } from '../services/newsService'

const tabs = [
  { key: 'global', label: '全球模型' },
  { key: 'hot', label: '模型热点' }
]
const active = ref('global')
const nowText = ref('')
let clockTimer: number | undefined
function pad(n: number): string { return String(n).padStart(2, '0') }
function updateClock(): void {
  const d = new Date()
  nowText.value = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

const cfg = ref<AiConfig | null>(null)
const models = ref<GlobalModel[]>([])
const loading = ref(false)
const search = ref('')
const taskFilter = ref('')
const tasks = MODEL_TASKS

const filteredModels = computed(() => {
  const kw = search.value.trim().toLowerCase()
  return models.value.filter((m) => {
    if (taskFilter.value && m.task !== taskFilter.value) return false
    if (kw && !(`${m.model} ${m.author} ${m.id}`.toLowerCase().includes(kw))) return false
    return true
  })
})

async function loadModels(): Promise<void> {
  loading.value = true
  models.value = await fetchGlobalModels(30)
  loading.value = false
}

const modelNews = ref<NewsItem[]>([])
const newsLoading = ref(false)
async function loadNews(): Promise<void> { newsLoading.value = true; modelNews.value = await fetchModelNews('AI 大模型', 20); newsLoading.value = false }

/* 收藏 */
const bookmarks = ref<ModelBookmark[]>([])
function isBooked(id: string): boolean { return bookmarks.value.some((b) => b.model_id === id) }
async function loadBookmarks(): Promise<void> { bookmarks.value = await listModelBookmarks() }
async function toggleBookmark(m: GlobalModel): Promise<void> {
  if (isBooked(m.id)) { const b = bookmarks.value.find((x) => x.model_id === m.id); if (b) await removeModelBookmark(b.id) }
  else await addModelBookmark(m.id, m.model)
  await loadBookmarks()
}

/* AI 追问 */
const askTarget = ref<GlobalModel | null>(null)
const askQ = ref('')
const askLoading = ref(false)
const askA = ref('')
function askModel(m: GlobalModel): void { askTarget.value = m; askQ.value = ''; askA.value = '' }
async function runAsk(): Promise<void> {
  if (!cfg.value) { ElMessage.warning('请先配置 AI 密钥'); return }
  if (!askTarget.value) return
  askLoading.value = true
  try {
    askA.value = await callAi(cfg.value, `关于 AI 模型「${askTarget.value.model}」（作者 ${askTarget.value.author}，任务类型 ${askTarget.value.task}，下载量 ${askTarget.value.downloads}），用户问：${askQ.value}\n请用通俗中文回答，200 字内，客观中立、注明仅供参考。`)
  } catch (e) { ElMessage.error('AI 调用失败：' + (e as Error).message) }
  finally { askLoading.value = false }
}

function fmt(n: number): string {
  if (n >= 1e9) return (n / 1e9).toFixed(1) + 'B'
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M'
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K'
  return String(n)
}

onMounted(async () => {
  updateClock()
  clockTimer = window.setInterval(updateClock, 1000)
  try { cfg.value = await loadAiConfig() } catch { /* ignore */ }
  await Promise.all([loadModels(), loadNews(), loadBookmarks()])
})
onUnmounted(() => { if (clockTimer) window.clearInterval(clockTimer) })
</script>

<style scoped>
.am-root { min-height: 100%; }
.am-top { position: sticky; top: 0; z-index: 10; display: flex; align-items: center; gap: 16px; padding: 10px 24px; background: var(--surface); border-bottom: 1px solid var(--border); flex-wrap: wrap; }
.am-brand { display: flex; align-items: baseline; gap: 8px; }
.am-logo { font-size: 16px; font-weight: 700; color: var(--text-strong); }
.am-tag { font-size: 11px; color: var(--text-faint); }
.am-tabs { display: flex; gap: 4px; flex: 1; flex-wrap: wrap; }
.am-tab { font-size: 13px; padding: 6px 12px; border-radius: 8px; color: var(--text-muted); cursor: pointer; border: 1px solid transparent; }
.am-tab:hover { background: var(--surface-soft); }
.am-tab.on { color: var(--brand, #378add); background: var(--surface-soft); border-color: var(--brand, #378add); font-weight: 600; }
.am-clock-box { display: inline-flex; align-items: center; gap: 6px; }
.am-dot { width: 8px; height: 8px; border-radius: 50%; background: #22c55e; box-shadow: 0 0 0 3px rgba(34,197,94,.2); }
.am-clock { font-variant-numeric: tabular-nums; font-size: 13px; color: var(--text-strong); }
.am-clock-hint { font-size: 11px; color: var(--text-faint); }
.am-main { padding: 18px 24px; }
.am-card { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 18px; }
.am-h { font-size: 15px; color: var(--text-strong); margin: 0 0 6px; }
.am-sub { font-size: 12px; color: var(--text-faint); margin: 0 0 12px; }
.am-hrow { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; margin-bottom: 10px; }
.am-tools { display: flex; gap: 8px; flex-wrap: wrap; margin-left: auto; }
.am-search { width: 200px; }
.am-sel { width: 160px; }
.am-refresh { border: 1px solid var(--border); background: var(--surface); color: var(--text-muted); border-radius: 8px; padding: 5px 12px; cursor: pointer; font-size: 12px; }
.am-refresh:hover { color: var(--brand, #378add); border-color: var(--brand, #378add); }
.am-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 12px; }
.am-model { padding: 12px; border: 1px solid var(--border); border-radius: 10px; background: var(--surface-soft); display: flex; flex-direction: column; gap: 6px; }
.am-model-top { display: flex; align-items: center; justify-content: space-between; gap: 6px; }
.am-model-name { font-size: 13px; font-weight: 600; color: var(--text-strong); word-break: break-all; }
.am-badge { font-size: 10px; padding: 1px 6px; border-radius: 6px; background: #fde68a; color: #92400e; }
.am-model-author { font-size: 12px; color: var(--text-faint); }
.am-model-meta { display: flex; gap: 10px; font-size: 12px; color: var(--text-muted); flex-wrap: wrap; }
.am-task { color: var(--brand, #378add); }
.am-tags { display: flex; flex-wrap: wrap; gap: 4px; }
.am-tag { font-size: 10px; color: var(--text-faint); background: var(--surface); border: 1px solid var(--border); border-radius: 4px; padding: 1px 6px; }
.am-model-actions { display: flex; gap: 6px; margin-top: 4px; }
.am-mini { border: 1px solid var(--border); background: var(--surface); color: var(--brand, #378add); border-radius: 6px; padding: 3px 10px; font-size: 12px; cursor: pointer; }
.am-mini.on { color: #fff; background: var(--brand, #378add); border-color: var(--brand, #378add); }
.am-news { display: block; padding: 12px; border: 1px solid var(--border); border-radius: 10px; text-decoration: none; color: inherit; background: var(--surface-soft); transition: .15s; }
.am-news:hover { border-color: var(--brand, #378add); transform: translateY(-2px); }
.am-news-title { font-size: 13px; color: var(--text-strong); line-height: 1.5; margin-bottom: 8px; }
.am-news-meta { display: flex; justify-content: space-between; font-size: 11px; color: var(--text-faint); }
.am-empty { grid-column: 1 / -1; color: var(--text-faint); font-size: 13px; padding: 18px; text-align: center; }
.am-ask { margin-top: 16px; }
.am-row { display: flex; align-items: center; gap: 10px; margin-top: 10px; flex-wrap: wrap; }
.am-warn { font-size: 12px; color: #f59e0b; }
.am-answer { margin-top: 12px; padding: 12px; background: var(--surface-soft); border-radius: 8px; white-space: pre-wrap; line-height: 1.7; font-size: 13px; color: var(--text); }
</style>
