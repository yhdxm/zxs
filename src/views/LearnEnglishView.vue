<template>
  <div class="le-root">
    <header class="le-top">
      <div class="le-brand">
        <span class="le-logo">学位英语</span>
        <span class="le-tag">查词 · AI 讲解 · 生词本（全部免费）</span>
      </div>
      <div class="le-clock-box" title="北京时间">
        <span class="le-dot"></span><span class="le-clock">{{ nowText }}</span><span class="le-clock-hint">北京时间</span>
      </div>
    </header>

    <main class="le-main">
      <section class="le-card">
        <div class="le-row">
          <el-input v-model="word" placeholder="输入英文单词，如 vocabulary / sustainable" class="le-input" @keyup.enter="lookup" />
          <el-button type="primary" :loading="loading" @click="lookup">查询</el-button>
          <el-button :disabled="!def || !cfg" @click="explain">AI 讲解</el-button>
          <el-button :disabled="!word" @click="addWord">加入生词本</el-button>
        </div>
        <p v-if="!cfg" class="le-warn">未检测到 AI 配置，AI 讲解不可用；请先到「AI 助手」配置密钥。</p>

        <div v-if="def" class="le-def">
          <div class="le-word">{{ def.word }}
            <span v-for="(p, i) in def.phonetics.filter(Boolean)" :key="i" class="le-phon">/{{ p.text }}/</span>
          </div>
          <div v-for="(m, i) in def.meanings" :key="i" class="le-mean">
            <span class="le-pos">{{ m.partOfSpeech }}</span>
            <ol>
              <li v-for="(d, j) in m.definitions" :key="j">{{ d.definition }}<span v-if="d.example" class="le-ex"> — {{ d.example }}</span></li>
            </ol>
          </div>
        </div>
        <p v-else-if="searched && !loading" class="le-empty">未找到「{{ lastWord }}」的释义，检查拼写或换词试试。</p>

        <div v-if="explainText" class="le-answer">{{ explainText }}</div>
      </section>

      <section class="le-card">
        <h3 class="le-h">我的生词本</h3>
        <div class="le-grid">
          <div v-for="b in words" :key="b.id" class="le-worditem">
            <div class="le-wordname">{{ b.title }}</div>
            <button class="le-mini danger" @click="removeWord(b.id)">删除</button>
          </div>
          <p v-if="!words.length" class="le-empty">生词本为空，查词后可一键收藏。</p>
        </div>
      </section>
    </main>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { loadAiConfig, callAi, type AiConfig } from '../services/aiService'
import { fetchDefinition, explainWord, type WordDefinition } from '../services/learningService'
import { listLearnBookmarks, addLearnBookmark, removeLearnBookmark, type LearnBookmark } from '../services/learnDb'

const nowText = ref('')
let clockTimer: number | undefined
function pad(n: number): string { return String(n).padStart(2, '0') }
function updateClock(): void {
  const d = new Date()
  nowText.value = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

const cfg = ref<AiConfig | null>(null)
const word = ref('vocabulary')
const lastWord = ref('')
const def = ref<WordDefinition | null>(null)
const searched = ref(false)
const loading = ref(false)
const explainText = ref('')

async function lookup(): Promise<void> {
  const w = word.value.trim()
  if (!w) return
  lastWord.value = w
  searched.value = true
  loading.value = true
  def.value = await fetchDefinition(w)
  loading.value = false
}

async function explain(): Promise<void> {
  if (!cfg.value) { ElMessage.warning('请先配置 AI 密钥'); return }
  if (!def.value) { ElMessage.warning('请先查询单词'); return }
  explainText.value = 'AI 解读中…'
  try {
    explainText.value = await explainWord(def.value.word, def.value, cfg.value)
  } catch (e) { explainText.value = '解读失败：' + (e as Error).message }
}

const words = ref<LearnBookmark[]>([])
async function loadWords(): Promise<void> { words.value = await listLearnBookmarks('word') }
async function addWord(): Promise<void> {
  const w = word.value.trim()
  if (!w) return
  await addLearnBookmark('word', w.toLowerCase(), w)
  await loadWords()
  ElMessage.success('已加入生词本')
}
async function removeWord(id: string): Promise<void> { await removeLearnBookmark(id); await loadWords() }

onMounted(async () => {
  updateClock()
  clockTimer = window.setInterval(updateClock, 1000)
  try { cfg.value = await loadAiConfig() } catch { /* ignore */ }
  await loadWords()
  await lookup()
})
onUnmounted(() => { if (clockTimer) window.clearInterval(clockTimer) })
</script>

<style scoped>
.le-root { min-height: 100%; }
.le-top { position: sticky; top: 0; z-index: 10; display: flex; align-items: center; gap: 16px; padding: 0 24px 10px; background: var(--surface); border-bottom: 1px solid var(--border); flex-wrap: wrap; }
.le-brand { display: flex; align-items: baseline; gap: 8px; }
.le-logo { font-size: 18px; font-weight: 600; color: var(--text-strong); }
.le-tag { font-size: 11px; color: var(--text-faint); }
.le-clock-box { display: inline-flex; align-items: center; gap: 6px; margin-left: auto; }
.le-dot { width: 8px; height: 8px; border-radius: 50%; background: #22c55e; box-shadow: 0 0 0 3px rgba(34,197,94,.2); }
.le-clock { font-variant-numeric: tabular-nums; font-size: 13px; color: var(--text-strong); }
.le-clock-hint { font-size: 11px; color: var(--text-faint); }
.le-main { padding: 0 24px 24px; }
.le-card { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 18px; margin-bottom: 16px; }
.le-row { display: flex; gap: 8px; flex-wrap: wrap; }
.le-input { width: 320px; }
.le-warn { font-size: 12px; color: #f59e0b; margin: 8px 0 0; }
.le-def { margin-top: 14px; padding: 14px; background: var(--surface-soft); border-radius: 10px; }
.le-word { font-size: 20px; font-weight: 700; color: var(--text-strong); margin-bottom: 8px; }
.le-phon { font-size: 13px; color: var(--text-faint); margin-left: 8px; }
.le-mean { margin-bottom: 8px; }
.le-pos { font-size: 12px; font-style: italic; color: var(--brand, #378add); margin-right: 6px; }
.le-ex { color: var(--text-faint); font-size: 12px; }
.le-answer { margin-top: 14px; padding: 12px; background: var(--surface-soft); border-radius: 8px; white-space: pre-wrap; line-height: 1.7; font-size: 13px; color: var(--text); }
.le-h { font-size: 15px; color: var(--text-strong); margin: 0 0 12px; }
.le-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 10px; }
.le-worditem { display: flex; align-items: center; justify-content: space-between; padding: 8px 12px; border: 1px solid var(--border); border-radius: 8px; background: var(--surface-soft); }
.le-wordname { font-size: 13px; color: var(--text-strong); text-transform: capitalize; }
.le-mini { border: 1px solid var(--border); background: var(--surface); color: #ef4444; border-radius: 6px; padding: 2px 8px; font-size: 12px; cursor: pointer; }
.le-empty { grid-column: 1 / -1; color: var(--text-faint); font-size: 13px; padding: 14px; text-align: center; }
</style>
