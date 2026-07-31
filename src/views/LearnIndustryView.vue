<template>
  <div class="li-root">
    <header class="li-top">
      <div class="li-brand">
        <span class="li-logo">各行业知识</span>
        <span class="li-tag">知识库 · AI 讲解 · 学习进度（全部免费）</span>
      </div>
      <div class="li-clock-box" title="北京时间">
        <span class="li-dot"></span><span class="li-clock">{{ nowText }}</span><span class="li-clock-hint">北京时间</span>
      </div>
    </header>

    <main class="li-main">
      <section class="li-card">
        <div class="li-grid">
          <div v-for="t in topics" :key="t.name" class="li-topic">
            <div class="li-topic-head">
              <div>
                <div class="li-topic-name">{{ t.name }}</div>
                <div class="li-topic-desc">{{ t.desc }}</div>
              </div>
              <span :class="['li-status', statusOf(t.name)]">{{ statusOf(t.name) === 'done' ? '已掌握' : statusOf(t.name) === 'learning' ? '学习中' : '未学' }}</span>
            </div>
            <ul class="li-points">
              <li v-for="(p, i) in t.keyPoints" :key="i">{{ p }}</li>
            </ul>
            <div class="li-actions">
              <button class="li-mini" @click="explain(t)">AI 讲透</button>
              <button class="li-mini" :class="{ on: isBooked(t.name) }" @click="toggleBookmark(t)">{{ isBooked(t.name) ? '已收藏' : '收藏' }}</button>
              <button class="li-mini" @click="markDone(t)">标记已掌握</button>
            </div>
            <div v-if="t._explain" class="li-explain">{{ t._explain }}</div>
          </div>
        </div>
        <p v-if="!cfg" class="li-warn">未检测到 AI 配置，AI 讲解不可用；请先到「AI 助手」配置密钥。</p>
      </section>
    </main>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { loadAiConfig, callAi, type AiConfig } from '../services/aiService'
import { INDUSTRY_KNOWLEDGE, explainTopic, type IndustryTopic } from '../services/learningService'
import { getProgress, setProgress, listLearnBookmarks, addLearnBookmark, removeLearnBookmark, type LearnBookmark, type LearnProgress } from '../services/learnDb'

const nowText = ref('')
let clockTimer: number | undefined
function pad(n: number): string { return String(n).padStart(2, '0') }
function updateClock(): void {
  const d = new Date()
  nowText.value = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

const cfg = ref<AiConfig | null>(null)
const topics = reactive(INDUSTRY_KNOWLEDGE.map((t) => ({ ...t, _explain: '' })))
const progressMap = ref<Record<string, LearnProgress>>({})
const bookmarks = ref<LearnBookmark[]>([])

function statusOf(name: string): string {
  const p = progressMap.value[name]
  return p?.status || 'none'
}
function isBooked(name: string): boolean { return bookmarks.value.some((b) => b.ref_id === name) }

async function loadState(): Promise<void> {
  const [bm] = await Promise.all([listLearnBookmarks('topic')])
  bookmarks.value = bm
  for (const t of topics) {
    const p = await getProgress('industry', t.name)
    if (p) progressMap.value[t.name] = p
  }
}

async function explain(t: IndustryTopic & { _explain: string }): Promise<void> {
  if (!cfg.value) { ElMessage.warning('请先配置 AI 密钥'); return }
  t._explain = 'AI 解读中…'
  try { t._explain = await explainTopic(`${t.name}（${t.desc}）`, cfg.value) }
  catch (e) { t._explain = '解读失败：' + (e as Error).message }
}

async function toggleBookmark(t: IndustryTopic): Promise<void> {
  if (isBooked(t.name)) { const b = bookmarks.value.find((x) => x.ref_id === t.name); if (b) await removeLearnBookmark(b.id) }
  else await addLearnBookmark('topic', t.name, t.name)
  await loadState()
}

async function markDone(t: IndustryTopic): Promise<void> {
  await setProgress('industry', t.name, 'done', 100)
  await loadState()
  ElMessage.success(`已标记「${t.name}」为已掌握`)
}

onMounted(async () => {
  updateClock()
  clockTimer = window.setInterval(updateClock, 1000)
  try { cfg.value = await loadAiConfig() } catch { /* ignore */ }
  await loadState()
})
onUnmounted(() => { if (clockTimer) window.clearInterval(clockTimer) })
</script>

<style scoped>
.li-root { min-height: 100%; }
.li-top { position: sticky; top: 0; z-index: 10; display: flex; align-items: center; gap: 16px; padding: 10px 24px; background: var(--surface); border-bottom: 1px solid var(--border); flex-wrap: wrap; }
.li-brand { display: flex; align-items: baseline; gap: 8px; }
.li-logo { font-size: 16px; font-weight: 700; color: var(--text-strong); }
.li-tag { font-size: 11px; color: var(--text-faint); }
.li-clock-box { display: inline-flex; align-items: center; gap: 6px; margin-left: auto; }
.li-dot { width: 8px; height: 8px; border-radius: 50%; background: #22c55e; box-shadow: 0 0 0 3px rgba(34,197,94,.2); }
.li-clock { font-variant-numeric: tabular-nums; font-size: 13px; color: var(--text-strong); }
.li-clock-hint { font-size: 11px; color: var(--text-faint); }
.li-main { padding: 18px 24px; }
.li-card { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 18px; }
.li-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 14px; }
.li-topic { padding: 14px; border: 1px solid var(--border); border-radius: 10px; background: var(--surface-soft); display: flex; flex-direction: column; gap: 8px; }
.li-topic-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 8px; }
.li-topic-name { font-size: 14px; font-weight: 600; color: var(--text-strong); }
.li-topic-desc { font-size: 12px; color: var(--text-faint); margin-top: 2px; }
.li-status { font-size: 11px; padding: 2px 8px; border-radius: 10px; white-space: nowrap; }
.li-status.none { background: var(--surface); color: var(--text-faint); border: 1px solid var(--border); }
.li-status.learning { background: #dbeafe; color: #1d4ed8; }
.li-status.done { background: #dcfce7; color: #15803d; }
.li-points { margin: 0; padding-left: 18px; font-size: 12px; color: var(--text-muted); line-height: 1.7; }
.li-actions { display: flex; gap: 6px; flex-wrap: wrap; }
.li-mini { border: 1px solid var(--border); background: var(--surface); color: var(--brand, #378add); border-radius: 6px; padding: 3px 10px; font-size: 12px; cursor: pointer; }
.li-mini.on { color: #fff; background: var(--brand, #378add); border-color: var(--brand, #378add); }
.li-explain { padding-top: 8px; border-top: 1px dashed var(--border); font-size: 12px; color: var(--text); white-space: pre-wrap; line-height: 1.6; }
.li-warn { font-size: 12px; color: #f59e0b; margin-top: 12px; }
</style>
