<template>
  <div class="le-root">
    <PageHeader
      title="学位英语"
      subtitle="备考助手 · 数据源：Free Dictionary API + 内置大纲词库 + 古登堡免费书 + 已配置 AI · 依据《成人学士学位英语水平考试大纲（第二版）》"
      :icon="School"
    >
      <div class="le-clock-box" title="北京时间">
        <span class="le-dot"></span><span class="le-clock">{{ nowText }}</span><span class="le-clock-hint">北京时间</span>
      </div>
    </PageHeader>

    <!-- 模块入口 -->
    <nav class="le-entries">
      <button
        v-for="m in MODULES"
        :key="m.key"
        type="button"
        class="le-entry"
        :class="{ on: active === m.key }"
        :style="{ '--c': m.color }"
        @click="switchModule(m.key)"
      >
        <span class="le-bar"></span>
        <span class="le-icon"><el-icon><component :is="m.icon" /></el-icon></span>
        <span class="le-text">
          <span class="le-label">{{ m.label }}</span>
          <span class="le-desc">{{ m.desc }}</span>
        </span>
      </button>
    </nav>

    <Transition name="le-fade" mode="out-in">
      <section :key="active" class="le-body">
        <!-- 查词收藏 -->
        <div v-if="active === 'word'" class="le-card">
          <h3 class="le-h">查词 · 生词本</h3>
          <div class="le-row">
            <el-input v-model="word" placeholder="输入英文单词，如 vocabulary / sustainable" class="le-input" @keyup.enter="lookup" />
            <el-button type="primary" :loading="loading" @click="lookup">查询</el-button>
            <el-button :disabled="!def && !builtin" @click="explain">AI 讲解</el-button>
            <el-button :disabled="!word" @click="addWord">加入生词本</el-button>
          </div>
          <p v-if="!cfg" class="le-warn">未检测到 AI 配置，AI 讲解不可用；请先到「AI 助手」配置密钥。</p>

          <div v-if="def" class="le-def">
            <div class="le-word">{{ def.word }}
              <span v-for="(p, i) in def.phonetics.filter(Boolean)" :key="i" class="le-phon">/{{ p.text }}/</span>
            </div>
            <div v-for="(m, i) in def.meanings" :key="i" class="le-mean">
              <span class="le-pos">{{ m.partOfSpeech }}</span>
              <ol><li v-for="(d, j) in m.definitions" :key="j">{{ d.definition }}<span v-if="d.example" class="le-ex"> — {{ d.example }}</span></li></ol>
            </div>
          </div>
          <div v-else-if="builtin" class="le-def">
            <div class="le-word">{{ word.trim() }}
              <span class="le-phon">/{{ builtin.phonetic }}/</span>
              <span class="le-pos">{{ builtin.pos }}</span>
            </div>
            <div class="le-mean">{{ builtin.def }}<span v-if="builtin.example" class="le-ex"> — {{ builtin.example }}</span></div>
            <p class="le-tip">（Free Dictionary 暂不可达，已用内置大纲词库兜底，仍可加入生词本）</p>
          </div>
          <p v-else-if="searched && !loading" class="le-empty">未找到「{{ lastWord }}」的释义，检查拼写或换词试试。</p>

          <div v-if="explainText" class="le-answer">{{ explainText }}</div>

          <h3 class="le-h" style="margin-top:18px;">我的生词本</h3>
          <div class="le-grid">
            <div v-for="b in words" :key="b.id" class="le-worditem">
              <div class="le-wordname">{{ b.title }}</div>
              <button class="le-mini danger" @click="removeWord(b.id)">删除</button>
            </div>
            <p v-if="!words.length" class="le-empty">生词本为空，查词后可一键收藏。</p>
          </div>
        </div>

        <!-- 知识库（按大纲分类） -->
        <div v-else-if="active === 'outline'" class="le-card">
          <h3 class="le-h">学位英语知识库（按大纲分门别类）</h3>
          <div class="le-grid2">
            <div v-for="o in outline" :key="o.key" class="le-know">
              <div class="le-know-title">{{ o.name }}</div>
              <div class="le-know-body">{{ o.desc }}</div>
              <ul class="le-kp"><li v-for="(k, i) in o.keyPoints" :key="i">{{ k }}</li></ul>
              <button class="le-mini" @click="explainOutline(o)">AI 讲透</button>
              <div v-if="o._explain" class="le-know-explain">{{ o._explain }}</div>
            </div>
          </div>
        </div>

        <!-- 学习计划 -->
        <div v-else-if="active === 'plan'" class="le-card">
          <h3 class="le-h">备考学习计划</h3>
          <p class="le-sub">上传你的备考资料（.txt/.md），填写考试时间与目标，由 AI 按大纲生成可执行计划；计划存入云端，按账号隔离。</p>
          <div class="le-plan-form">
            <div class="le-pf-row">
              <label>考试时间</label>
              <el-date-picker v-model="examDate" type="date" placeholder="选择考试日期" value-format="YYYY-MM-DD" style="flex:1;" />
            </div>
            <div class="le-pf-row">
              <label>当前水平</label>
              <el-input v-model="planLevel" placeholder="如：四级擦边 / 多年未学英语" style="flex:1;" />
            </div>
            <div class="le-pf-row">
              <label>目标</label>
              <el-input v-model="planTarget" placeholder="如：一次通过，重点突破阅读与写作" style="flex:1;" />
            </div>
            <div class="le-pf-row le-pf-col">
              <label>重点模块</label>
              <div class="le-chks">
                <el-checkbox v-for="o in outline" :key="o.key" v-model="planFocus" :value="o.name" size="small">{{ o.name }}</el-checkbox>
              </div>
            </div>
            <div class="le-pf-row">
              <label>备考资料</label>
              <input ref="fileInput" type="file" accept=".txt,.md,.text" style="display:none" @change="onFile" />
              <el-button @click="fileInput?.click()">{{ materialName || '选择 .txt/.md 文件' }}</el-button>
              <span v-if="materialName" class="le-file-ok">已读取（{{ materialText.length }} 字）</span>
            </div>
            <div class="le-row">
              <el-button type="primary" :loading="planLoading" :disabled="!examDate || !cfg" @click="genPlan">生成备考计划</el-button>
              <el-button v-if="plan" :disabled="!examDate" @click="savePlan">保存计划</el-button>
              <span v-if="!cfg" class="le-warn">未检测到 AI 配置，无法生成计划。</span>
            </div>
          </div>

          <div v-if="plan" class="le-plan">
            <div class="le-plan-meta">距考试约 <b>{{ plan.totalDays }}</b> 天 · 重点：{{ plan.focus.join('、') || '全模块' }}</div>
            <div v-for="(ph, i) in plan.phases" :key="i" class="le-phase">
              <div class="le-phase-h"><span class="le-phase-no">{{ i + 1 }}</span>{{ ph.title }} <span class="le-phase-days">{{ ph.days }}</span></div>
              <div class="le-phase-block"><b>目标</b><ul><li v-for="(g, j) in ph.goals" :key="j">{{ g }}</li></ul></div>
              <div class="le-phase-block"><b>方法</b><ul><li v-for="(m, j) in ph.methods" :key="j">{{ m }}</li></ul></div>
            </div>
            <div class="le-tips"><b>备考提示</b><ul><li v-for="(t, i) in plan.tips" :key="i">{{ t }}</li></ul></div>
          </div>

          <h3 class="le-h" style="margin-top:18px;">已保存的计划（云端）</h3>
          <div class="le-grid2">
            <div v-for="p in savedPlans" :key="p.id" class="le-know">
              <div class="le-know-title">{{ p.title }}</div>
              <div class="le-row">
                <button class="le-mini" @click="loadPlan(p)">查看</button>
                <button class="le-mini danger" @click="delPlan(p.id)">删除</button>
              </div>
            </div>
            <p v-if="!savedPlans.length" class="le-empty">还没有保存的计划。</p>
          </div>
        </div>

        <!-- AI 答疑 -->
        <div v-else-if="active === 'ai'" class="le-card">
          <h3 class="le-h">AI 英语答疑</h3>
          <p class="le-sub">基于你已配置的 AI 回答语法、词汇、备考策略等问题。</p>
          <el-input v-model="qaQuestion" type="textarea" :rows="3" placeholder="例如：完形填空总错，怎么提高？虚拟语气怎么记？" />
          <div class="le-row">
            <el-button type="primary" :loading="qaLoading" @click="runQa">向 AI 提问</el-button>
            <span v-if="!cfg" class="le-warn">未检测到 AI 配置。</span>
          </div>
          <div v-if="qaAnswer" class="le-answer">{{ qaAnswer }}</div>
        </div>

        <!-- 书籍阅读 -->
        <div v-else-if="active === 'book'" class="le-card">
          <div class="le-hrow">
            <h3 class="le-h">书籍查询与阅读（国内公版书）</h3>
            <el-input v-model="bookKw" placeholder="搜索书名，如 红楼梦 / 论语 / 三国演义" class="le-input" @keyup.enter="searchBooks" />
            <el-button type="primary" :loading="bookLoading" @click="searchBooks">搜索</el-button>
          </div>
          <div v-if="!books.length && bookLoading" class="le-skeleton"><el-skeleton :rows="5" animated /></div>
          <div v-else class="le-grid">
            <div v-for="b in books" :key="b.id" class="le-book">
              <div class="le-book-title">{{ b.title }}</div>
              <div class="le-book-meta">{{ b.authors.map(a => a.name).join('、') || '佚名' }} · {{ b.download_count >= 99999 ? '公版书' : ('下载 ' + b.download_count) }}</div>
              <div class="le-row">
                <button class="le-mini" @click="readBook(b)">在线阅读</button>
                <a v-if="pickEpubUrl(b)" :href="pickEpubUrl(b)!" target="_blank" class="le-mini">EPUB</a>
              </div>
            </div>
            <p v-if="!books.length && !bookLoading" class="le-empty">搜索公版书，免费在线阅读。</p>
          </div>
        </div>
      </section>
    </Transition>

    <!-- 阅读弹框 -->
    <el-dialog v-model="readVisible" :title="readingBook?.title || '阅读'" width="720px" top="5vh" class="le-read-dlg">
      <div v-if="bookTextLoading" class="le-skeleton"><el-skeleton :rows="10" animated /></div>
      <div v-else class="le-read-body">{{ bookText || '暂无正文预览。' }}</div>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { School, Reading, Collection, Calendar, ChatDotRound, Notebook } from '@element-plus/icons-vue'
import PageHeader from '../components/PageHeader.vue'
import { loadAiConfig, callAi, type AiConfig } from '../services/aiService'
import {
  fetchDefinitionSafe,
  explainWord,
  explainTopic,
  ENGLISH_OUTLINE,
  generateStudyPlan,
  parseMaterialFile,
  fetchBooks,
  pickTextUrl,
  pickEpubUrl,
  fetchBookText,
  type WordDefinition,
  type GutenbergBook,
  type StudyPlan
} from '../services/learningService'
import {
  listLearnBookmarks,
  addLearnBookmark,
  removeLearnBookmark,
  listStudyPlans,
  saveStudyPlan,
  removeStudyPlan,
  upsertReading,
  type LearnBookmark
} from '../services/learnDb'

const MODULES = [
  { key: 'word', label: '查词收藏', desc: '词典 + 生词本', color: '#0891b2', icon: Reading },
  { key: 'outline', label: '知识库', desc: '大纲分模块', color: '#7c3aed', icon: Collection },
  { key: 'plan', label: '学习计划', desc: '资料→AI 计划', color: '#e08a00', icon: Calendar },
  { key: 'ai', label: 'AI 答疑', desc: '语法/备考', color: '#0ea5e9', icon: ChatDotRound },
  { key: 'book', label: '书籍阅读', desc: '免费公版书', color: '#1f9d55', icon: Notebook }
]
const active = ref('word')

const nowText = ref('')
let clockTimer: number | undefined
function pad(n: number): string { return String(n).padStart(2, '0') }
function updateClock(): void {
  const d = new Date()
  nowText.value = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

const cfg = ref<AiConfig | null>(null)
const outline = ref(ENGLISH_OUTLINE.map((o) => ({ ...o, _explain: '' })))

function switchModule(key: string): void {
  active.value = key
  if (key === 'word' && !words.value.length) void loadWords()
  if (key === 'plan' && !savedPlans.value.length) void loadPlans()
  if (key === 'book' && !books.value.length && !bookLoading.value) void searchBooks('')
}

/* 查词 */
const word = ref('vocabulary')
const lastWord = ref('')
const def = ref<WordDefinition | null>(null)
const builtin = ref<{ phonetic: string; pos: string; def: string; example?: string } | null>(null)
const searched = ref(false)
const loading = ref(false)
const explainText = ref('')
async function lookup(): Promise<void> {
  const w = word.value.trim()
  if (!w) return
  lastWord.value = w
  searched.value = true
  loading.value = true
  def.value = null
  builtin.value = null
  const r = await fetchDefinitionSafe(w)
  def.value = r.def
  builtin.value = r.builtin || null
  loading.value = false
}
async function explain(): Promise<void> {
  if (!cfg.value) { ElMessage.warning('请先配置 AI 密钥'); return }
  explainText.value = 'AI 解读中…'
  try {
    explainText.value = await explainWord(word.value.trim(), def.value, cfg.value)
  } catch (e) { explainText.value = '解读失败：' + (e as Error).message }
}
const words = ref<LearnBookmark[]>([])
async function loadWords(): Promise<void> { words.value = await listLearnBookmarks('word') }
async function addWord(): Promise<void> {
  const w = word.value.trim().toLowerCase()
  if (!w) return
  await addLearnBookmark('word', w, w)
  await loadWords()
  ElMessage.success('已加入生词本')
}
async function removeWord(id: string): Promise<void> { await removeLearnBookmark(id); await loadWords() }

/* 知识库 AI 讲透 */
async function explainOutline(o: { name: string; _explain: string }): Promise<void> {
  if (!cfg.value) { ElMessage.warning('请先配置 AI 密钥'); return }
  o._explain = 'AI 解读中…'
  try {
    o._explain = await explainTopic(`学位英语「${o.name}」`, cfg.value)
  } catch (e) { o._explain = '解读失败：' + (e as Error).message }
}

/* 学习计划 */
const examDate = ref('')
const planLevel = ref('')
const planTarget = ref('')
const planFocus = ref<string[]>([])
const materialName = ref('')
const materialText = ref('')
const planLoading = ref(false)
const plan = ref<StudyPlan | null>(null)
const fileInput = ref<HTMLInputElement | null>(null)
async function onFile(e: Event): Promise<void> {
  const f = (e.target as HTMLInputElement).files?.[0]
  if (!f) return
  try {
    materialText.value = await parseMaterialFile(f)
    materialName.value = f.name
    ElMessage.success('资料已读取')
  } catch (err) {
    materialName.value = ''
    materialText.value = ''
    ElMessage.error((err as Error).message)
  }
}
async function genPlan(): Promise<void> {
  if (!cfg.value) { ElMessage.warning('请先配置 AI 密钥'); return }
  if (!examDate.value) { ElMessage.warning('请选择考试时间'); return }
  planLoading.value = true
  try {
    plan.value = await generateStudyPlan(cfg.value, {
      materialText: materialText.value || undefined,
      examDate: examDate.value,
      currentLevel: planLevel.value || undefined,
      target: planTarget.value || undefined,
      focusModules: planFocus.value.length ? planFocus.value : undefined
    })
    ElMessage.success('计划已生成，可点击「保存计划」存入云端')
  } catch (e) { ElMessage.error('生成失败：' + (e as Error).message) }
  finally { planLoading.value = false }
}
async function savePlan(): Promise<void> {
  if (!plan.value || !examDate.value) return
  await saveStudyPlan(plan.value, examDate.value)
  await loadPlans()
  ElMessage.success('已保存到云端')
}
const savedPlans = ref<LearnBookmark[]>([])
async function loadPlans(): Promise<void> { savedPlans.value = await listStudyPlans() }
function loadPlan(p: LearnBookmark): void {
  try { plan.value = JSON.parse(p.ref_id) as StudyPlan; examDate.value = p.title.replace('学习计划 · ', '') } catch { ElMessage.error('计划解析失败') }
}
async function delPlan(id: string): Promise<void> { await removeStudyPlan(id); await loadPlans() }

/* AI 答疑 */
const qaQuestion = ref('完形填空总错，怎么提高得分？')
const qaLoading = ref(false)
const qaAnswer = ref('')
async function runQa(): Promise<void> {
  if (!cfg.value) { ElMessage.warning('请先配置 AI 密钥'); return }
  qaLoading.value = true
  try {
    qaAnswer.value = await callAi(cfg.value, '你是学位英语备考辅导老师，用通俗中文解答，结合《学位英语水平考试大纲（第二版）》。\n问题：' + qaQuestion.value)
  } catch (e) { ElMessage.error('AI 调用失败：' + (e as Error).message) }
  finally { qaLoading.value = false }
}

/* 书籍 */
const bookKw = ref('')
const books = ref<GutenbergBook[]>([])
const bookLoading = ref(false)
async function searchBooks(q = ''): Promise<void> {
  bookLoading.value = true
  const r = await fetchBooks(q || bookKw.value.trim(), 1)
  books.value = r.results.slice(0, 18)
  bookLoading.value = false
}
const readVisible = ref(false)
const readingBook = ref<GutenbergBook | null>(null)
const bookText = ref('')
const bookTextLoading = ref(false)
async function readBook(b: GutenbergBook): Promise<void> {
  const textUrl = pickTextUrl(b)
  const ext = b.formats['wikisource']
  if (!textUrl && ext) {
    window.open(ext, '_blank', 'noopener')
    ElMessage.success('已在新标签页打开维基文库阅读')
    try { await upsertReading(b.id, b.title, 1, 0) } catch { /* ignore */ }
    return
  }
  if (!textUrl) { ElMessage.warning('该书无纯文本版本'); return }
  readVisible.value = true
  readingBook.value = b
  bookTextLoading.value = true
  bookText.value = ''
  bookText.value = await fetchBookText(textUrl)
  bookTextLoading.value = false
  // 记录阅读
  try { await upsertReading(b.id, b.title, 1, 0) } catch { /* ignore */ }
}

onMounted(async () => {
  updateClock()
  clockTimer = window.setInterval(updateClock, 1000)
  try { cfg.value = await loadAiConfig() } catch { /* ignore */ }
  await loadWords()
  await lookup()
  await loadPlans()
  await searchBooks('')
})
onUnmounted(() => { if (clockTimer) window.clearInterval(clockTimer) })
</script>

<style scoped>
.le-root { min-height: 100%; }
.le-clock-box { display: inline-flex; align-items: center; gap: 6px; }
.le-dot { width: 8px; height: 8px; border-radius: 50%; background: #22c55e; box-shadow: 0 0 0 3px rgba(34,197,94,.2); animation: leBlink 2s ease-in-out infinite; }
@keyframes leBlink { 0%,100% { opacity: 1; } 50% { opacity: .45; } }
.le-clock { font-variant-numeric: tabular-nums; font-size: 13px; color: var(--text-strong); }
.le-clock-hint { font-size: 11px; color: var(--text-faint); }

.le-entries { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 12px; margin-bottom: 18px; }
.le-entry {
  position: relative; display: flex; align-items: center; gap: 10px; padding: 12px 14px 12px 16px;
  background: var(--surface); border: 1px solid var(--border); border-radius: 14px; box-shadow: var(--shadow-card);
  cursor: pointer; text-align: left; min-width: 0; overflow: hidden; transition: transform .18s ease, border-color .18s ease, background .18s ease;
}
.le-entry:hover { transform: translateY(-2px); border-color: var(--c); }
.le-entry.on { border-color: var(--c); background: color-mix(in srgb, var(--c) 7%, var(--surface)); }
.le-bar { position: absolute; left: 0; top: 0; bottom: 0; width: 3px; background: var(--c); opacity: 0; transition: opacity .18s ease; }
.le-entry.on .le-bar { opacity: 1; }
.le-icon { width: 34px; height: 34px; border-radius: 10px; display: grid; place-items: center; flex-shrink: 0; background: color-mix(in srgb, var(--c) 12%, transparent); color: var(--c); }
.le-icon :deep(svg) { font-size: 17px; }
.le-text { display: flex; flex-direction: column; min-width: 0; flex: 1; line-height: 1.3; }
.le-label { font-size: 13.5px; font-weight: 600; color: var(--text-strong); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.le-desc { font-size: 11px; color: var(--text-faint); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

.le-body { min-height: 320px; }
.le-card { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 18px; box-shadow: var(--shadow-card); }
.le-h { font-size: 15px; color: var(--text-strong); margin: 0 0 6px; }
.le-sub { font-size: 12px; color: var(--text-faint); margin: 0 0 12px; }
.le-hrow { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; margin-bottom: 12px; }
.le-row { display: flex; align-items: center; gap: 10px; margin-top: 10px; flex-wrap: wrap; }
.le-input { width: 300px; }
.le-warn { font-size: 12px; color: #f59e0b; }
.le-def { margin-top: 14px; padding: 14px; background: var(--surface-soft); border-radius: 10px; }
.le-word { font-size: 20px; font-weight: 700; color: var(--text-strong); margin-bottom: 8px; }
.le-phon { font-size: 13px; color: var(--text-faint); margin-left: 8px; }
.le-mean { margin-bottom: 8px; }
.le-pos { font-size: 12px; font-style: italic; color: var(--brand, #378add); margin-right: 6px; }
.le-ex { color: var(--text-faint); font-size: 12px; }
.le-tip { font-size: 12px; color: var(--text-faint); margin-top: 8px; }
.le-answer { margin-top: 14px; padding: 12px; background: var(--surface-soft); border-radius: 8px; white-space: pre-wrap; line-height: 1.7; font-size: 13px; color: var(--text); }
.le-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 12px; }
.le-grid2 { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 12px; }
.le-empty { grid-column: 1 / -1; color: var(--text-faint); font-size: 13px; padding: 16px; text-align: center; }
.le-know { padding: 12px; border: 1px solid var(--border); border-radius: 10px; background: var(--surface-soft); }
.le-know-title { font-size: 13px; font-weight: 600; color: var(--text-strong); margin-bottom: 6px; }
.le-know-body { font-size: 12px; color: var(--text-muted); line-height: 1.6; }
.le-kp { margin: 8px 0 0; padding-left: 18px; font-size: 12px; color: var(--text-muted); }
.le-know-explain { margin-top: 8px; padding-top: 8px; border-top: 1px dashed var(--border); font-size: 12px; color: var(--text); white-space: pre-wrap; line-height: 1.6; }
.le-mini { border: 1px solid var(--border); background: var(--surface); color: var(--brand, #378add); border-radius: 6px; padding: 3px 10px; font-size: 12px; cursor: pointer; text-decoration: none; display: inline-block; }
.le-mini.danger { color: #ef4444; }
.le-worditem { display: flex; align-items: center; justify-content: space-between; padding: 8px 12px; border: 1px solid var(--border); border-radius: 8px; background: var(--surface-soft); }
.le-wordname { font-size: 13px; color: var(--text-strong); text-transform: capitalize; }
.le-skeleton { padding: 4px 0; }

.le-plan-form { background: var(--surface-soft); border: 1px solid var(--border); border-radius: 10px; padding: 14px; }
.le-pf-row { display: flex; align-items: center; gap: 12px; margin-bottom: 12px; }
.le-pf-row > label { width: 72px; flex-shrink: 0; font-size: 13px; color: var(--text-muted); }
.le-pf-col { align-items: flex-start; }
.le-chks { display: flex; flex-wrap: wrap; gap: 4px 14px; }
.le-file-ok { font-size: 12px; color: #16a34a; }
.le-plan { margin-top: 16px; }
.le-plan-meta { font-size: 13px; color: var(--text-strong); margin-bottom: 10px; }
.le-phase { border: 1px solid var(--border); border-left: 3px solid #0891b2; border-radius: 8px; padding: 12px 14px; margin-bottom: 10px; background: var(--surface); }
.le-phase-h { font-size: 14px; font-weight: 600; color: var(--text-strong); margin-bottom: 8px; }
.le-phase-no { display: inline-grid; place-items: center; width: 22px; height: 22px; border-radius: 50%; background: #0891b2; color: #fff; font-size: 12px; margin-right: 8px; }
.le-phase-days { font-size: 12px; color: var(--text-faint); font-weight: 400; margin-left: 8px; }
.le-phase-block { font-size: 12.5px; color: var(--text-muted); margin: 4px 0; }
.le-phase-block ul, .le-tips ul { margin: 4px 0 0; padding-left: 18px; }
.le-tips { font-size: 12.5px; color: var(--text-muted); background: var(--surface-soft); border-radius: 8px; padding: 10px 14px; margin-top: 6px; }

.le-book { padding: 12px; border: 1px solid var(--border); border-radius: 10px; background: var(--surface-soft); }
.le-book-title { font-size: 13px; font-weight: 600; color: var(--text-strong); margin-bottom: 4px; line-height: 1.4; }
.le-book-meta { font-size: 11px; color: var(--text-faint); margin-bottom: 8px; }
.le-read-body { max-height: 70vh; overflow: auto; font-size: 13px; line-height: 1.8; white-space: pre-wrap; color: var(--text); }

.le-fade-enter-active, .le-fade-leave-active { transition: opacity .18s ease, transform .18s ease; }
.le-fade-enter-from { opacity: 0; transform: translateY(6px); }
.le-fade-leave-to { opacity: 0; transform: translateY(-6px); }

@media (max-width: 1100px) { .le-entries { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
@media (max-width: 760px) {
  .le-entries { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
  .le-entry { padding: 10px 10px 10px 13px; gap: 8px; }
  .le-icon { width: 30px; height: 30px; border-radius: 9px; }
  .le-label { font-size: 12.5px; }
  .le-desc { display: none; }
}
@media (max-width: 460px) { .le-entries { grid-template-columns: 1fr; } }
</style>
