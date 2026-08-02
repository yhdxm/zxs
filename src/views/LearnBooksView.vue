<template>
  <div class="lb-root">
    <PageHeader
      title="书籍阅读"
      subtitle="国内公版书 · 数据源：维基文库中文 + 内置中国经典兜底 + 已配置 AI · 全部免费公开源"
      :icon="Notebook"
    >
      <div class="lb-clock-box" title="北京时间">
        <span class="lb-dot"></span><span class="lb-clock">{{ nowText }}</span><span class="lb-clock-hint">北京时间</span>
      </div>
    </PageHeader>

    <nav class="lb-entries">
      <button
        v-for="m in MODULES"
        :key="m.key"
        type="button"
        class="lb-entry"
        :class="{ on: active === m.key }"
        :style="{ '--c': m.color }"
        @click="switchModule(m.key)"
      >
        <span class="lb-bar"></span>
        <span class="lb-icon"><el-icon><component :is="m.icon" /></el-icon></span>
        <span class="lb-text">
          <span class="lb-label">{{ m.label }}</span>
          <span class="lb-desc">{{ m.desc }}</span>
        </span>
      </button>
    </nav>

    <Transition name="lb-fade" mode="out-in">
      <section :key="active" class="lb-body">
        <!-- 搜索 + 阅读 -->
        <div v-if="active === 'search'" class="lb-card">
          <div class="lb-row">
            <el-input v-model="query" placeholder="搜索书名 / 作者，如 红楼梦 / 鲁迅 / 三国" class="lb-input" @keyup.enter="onSearchClick" />
            <el-button type="primary" :loading="loading" @click="onSearchClick">搜索</el-button>
          </div>
          <div class="lb-cats">
            <button class="lb-cat" :class="{ on: !catFilter }" @click="setCat('')">全部</button>
            <button
              v-for="c in categories"
              :key="c"
              class="lb-cat"
              :class="{ on: catFilter === c }"
              @click="setCat(c)"
            >{{ c }}</button>
          </div>
          <p class="lb-count">共找到 <b>{{ bookResult.count }}</b> 本国内公版书（本地检索，离线可用；维基文库在线补充已开启）</p>
          <div class="lb-grid">
            <div v-for="b in books" :key="b.id" class="lb-book">
              <div class="lb-book-top">
                <div class="lb-book-title">{{ b.title }}</div>
                <span v-if="b.category" class="lb-cat-chip">{{ b.category }}</span>
              </div>
              <div class="lb-book-author">{{ b.authors.map((a) => a.name).join(', ') || '佚名' }}</div>
              <div class="lb-book-meta">{{ b.download_count >= 99999 ? '公版书' : ('下载量 ' + b.download_count) }} · {{ (b.languages || []).join('/') || '—' }}</div>
              <div class="lb-book-actions">
                <button class="lb-mini" @click="openBook(b)">在线阅读</button>
                <a v-if="pickEpubUrl(b)" :href="pickEpubUrl(b)!" target="_blank" class="lb-mini">EPUB</a>
                <button class="lb-mini" @click="bookmarkBook(b)">收藏</button>
              </div>
            </div>
            <p v-if="!books.length && !loading" class="lb-empty">没有结果，换个关键词试试（英文检索效果更佳）。</p>
          </div>
          <div class="lb-pager" v-if="bookResult.count > pageSize">
            <button class="lb-mini" :disabled="!bookResult.previous" @click="page--; search()">上一页</button>
            <span class="lb-pageinfo">第 {{ page }} 页 / 共 {{ Math.ceil(bookResult.count / pageSize) }} 页</span>
            <button class="lb-mini" :disabled="!bookResult.next" @click="page++; search()">下一页</button>
          </div>

          <div v-if="reading" class="lb-reader">
            <div class="lb-hrow">
              <h3 class="lb-h">📖 {{ reading.title }}</h3>
              <button class="lb-mini" @click="reading = null">关闭</button>
            </div>
            <div v-if="textLoading" class="lb-empty">正文加载中…</div>
            <pre v-else class="lb-text">{{ bookText }}</pre>
          </div>
        </div>

        <!-- 我的书架 -->
        <div v-else-if="active === 'shelf'" class="lb-card">
          <h3 class="lb-h">我的书架（阅读记录，按账号隔离）</h3>
          <div class="lb-grid">
            <div v-for="r in readingList" :key="r.id" class="lb-book">
              <div class="lb-book-title">{{ r.book_title }}</div>
              <div class="lb-book-meta">最近阅读：{{ fmtTime(r.updated_at) }}</div>
              <div class="lb-book-actions">
                <button class="lb-mini" @click="reopen(r)">继续阅读</button>
              </div>
            </div>
            <p v-if="!readingList.length" class="lb-empty">还没有阅读记录，打开一本书即可自动记录。</p>
          </div>
          <h3 class="lb-h" style="margin-top:18px;">我的收藏</h3>
          <div class="lb-grid">
            <div v-for="b in bookmarks" :key="b.id" class="lb-book">
              <div class="lb-book-title">{{ b.title }}</div>
              <div class="lb-book-actions"><button class="lb-mini danger" @click="unbookmark(b.id)">取消收藏</button></div>
            </div>
            <p v-if="!bookmarks.length" class="lb-empty">还没有收藏。</p>
          </div>
        </div>

        <!-- AI 导读 -->
        <div v-else-if="active === 'airead'" class="lb-card">
          <h3 class="lb-h">AI 书籍导读</h3>
          <p class="lb-sub">输入书名或粘贴书籍片段，由 AI 生成导读、要点或讨论问题。</p>
          <el-input v-model="aiBookTitle" placeholder="书名，如《傲慢与偏见》" class="lb-input" />
          <el-input v-model="aiBookText" type="textarea" :rows="4" placeholder="可粘贴书籍片段（可选），AI 据此导读" style="margin-top:10px;" />
          <div class="lb-row">
            <el-button type="primary" :loading="aiReadLoading" :disabled="!cfg || (!aiBookTitle && !aiBookText)" @click="runAiRead">生成导读</el-button>
            <span v-if="!cfg" class="lb-warn">未检测到 AI 配置。</span>
          </div>
          <div v-if="aiReadResult" class="lb-answer">{{ aiReadResult }}</div>
        </div>

        <!-- 学习计划 -->
        <div v-else-if="active === 'plan'" class="lb-card">
          <h3 class="lb-h">阅读 / 学习计划</h3>
          <p class="lb-sub">上传读书笔记或资料，由 AI 生成阅读计划并存入云端（按账号隔离）。</p>
          <div class="lb-plan-form">
            <div class="lb-pf-row">
              <label>目标日期</label>
              <el-date-picker v-model="examDate" type="date" placeholder="选择日期（可选）" value-format="YYYY-MM-DD" style="flex:1;" />
            </div>
            <div class="lb-pf-row">
              <label>当前基础</label>
              <el-input v-model="planLevel" placeholder="如：英语入门 / 每天可读 30 分钟" style="flex:1;" />
            </div>
            <div class="lb-pf-row">
              <label>目标</label>
              <el-input v-model="planTarget" placeholder="如：一个月读完 2 本原版书" style="flex:1;" />
            </div>
            <div class="lb-pf-row">
              <label>资料</label>
              <input ref="fileInput" type="file" accept=".txt,.md,.text" style="display:none" @change="onFile" />
              <el-button @click="fileInput?.click()">{{ materialName || '选择 .txt/.md 文件' }}</el-button>
              <span v-if="materialName" class="lb-file-ok">已读取（{{ materialText.length }} 字）</span>
            </div>
            <div class="lb-row">
              <el-button type="primary" :loading="planLoading" :disabled="!cfg" @click="genPlan">生成计划</el-button>
              <el-button v-if="plan" @click="savePlan">保存计划</el-button>
              <span v-if="!cfg" class="lb-warn">未检测到 AI 配置。</span>
            </div>
          </div>
          <div v-if="plan" class="lb-plan">
            <div class="lb-plan-meta">重点：{{ plan.focus.join('、') || '阅读计划' }}<span v-if="plan.totalDays"> · 约 {{ plan.totalDays }} 天</span></div>
            <div v-for="(ph, i) in plan.phases" :key="i" class="lb-phase">
              <div class="lb-phase-h"><span class="lb-phase-no">{{ i + 1 }}</span>{{ ph.title }} <span class="lb-phase-days">{{ ph.days }}</span></div>
              <div class="lb-phase-block"><b>目标</b><ul><li v-for="(g, j) in ph.goals" :key="j">{{ g }}</li></ul></div>
              <div class="lb-phase-block"><b>方法</b><ul><li v-for="(m, j) in ph.methods" :key="j">{{ m }}</li></ul></div>
            </div>
            <div class="lb-tips"><b>提示</b><ul><li v-for="(t, i) in plan.tips" :key="i">{{ t }}</li></ul></div>
          </div>
          <h3 class="lb-h" style="margin-top:18px;">已保存的计划（云端）</h3>
          <div class="lb-grid2">
            <div v-for="p in savedPlans" :key="p.id" class="lb-know">
              <div class="lb-know-title">{{ p.title }}</div>
              <div class="lb-row">
                <button class="lb-mini" @click="loadPlan(p)">查看</button>
                <button class="lb-mini danger" @click="delPlan(p.id)">删除</button>
              </div>
            </div>
            <p v-if="!savedPlans.length" class="lb-empty">还没有保存的计划。</p>
          </div>
        </div>

        <!-- AI 答疑 -->
        <div v-else-if="active === 'ai'" class="lb-card">
          <h3 class="lb-h">AI 阅读答疑</h3>
          <p class="lb-sub">解答阅读方法、书单推荐、文本理解等问题。</p>
          <el-input v-model="qaQuestion" type="textarea" :rows="3" placeholder="例如：如何坚持每天阅读？这本书的主题是什么？" />
          <div class="lb-row">
            <el-button type="primary" :loading="qaLoading" @click="runQa">向 AI 提问</el-button>
            <span v-if="!cfg" class="lb-warn">未检测到 AI 配置。</span>
          </div>
          <div v-if="qaAnswer" class="lb-answer">{{ qaAnswer }}</div>
        </div>
      </section>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { Notebook, Collection, Reading, Calendar, ChatDotRound } from '@element-plus/icons-vue'
import PageHeader from '../components/PageHeader.vue'
import { loadAiConfig, callAi, type AiConfig } from '../services/aiService'
import {
  fetchBooks,
  pickTextUrl,
  pickEpubUrl,
  fetchBookText,
  generateStudyPlan,
  parseMaterialFile,
  BOOK_CATEGORIES,
  type GutenbergBook,
  type BookSearchResult,
  type StudyPlan
} from '../services/learningService'
import {
  listReading,
  upsertReading,
  listLearnBookmarks,
  addLearnBookmark,
  removeLearnBookmark,
  listStudyPlans,
  saveStudyPlan,
  removeStudyPlan,
  type LearnReading,
  type LearnBookmark
} from '../services/learnDb'

const MODULES = [
  { key: 'search', label: '书籍搜索', desc: '找书 + 阅读', color: '#1f9d55', icon: Notebook },
  { key: 'shelf', label: '我的书架', desc: '记录 + 收藏', color: '#7c3aed', icon: Collection },
  { key: 'airead', label: 'AI 导读', desc: '要点/提问', color: '#0ea5e9', icon: Reading },
  { key: 'plan', label: '学习计划', desc: '资料→AI 计划', color: '#e08a00', icon: Calendar },
  { key: 'ai', label: 'AI 答疑', desc: '阅读方法', color: '#0891b2', icon: ChatDotRound }
]
const active = ref('search')

const nowText = ref('')
let clockTimer: number | undefined
function pad(n: number): string { return String(n).padStart(2, '0') }
function updateClock(): void {
  const d = new Date()
  nowText.value = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

const cfg = ref<AiConfig | null>(null)

/* 搜索 + 阅读 */
const query = ref('')
const page = ref(1)
const pageSize = 12
const catFilter = ref('')
const categories = BOOK_CATEGORIES
const bookResult = ref<BookSearchResult>({ count: 0, next: null, previous: null, results: [] })
const books = ref<GutenbergBook[]>([])
const loading = ref(false)
async function search(): Promise<void> {
  loading.value = true
  const r = await fetchBooks(query.value, page.value, catFilter.value)
  books.value = r.results
  bookResult.value = r
  loading.value = false
}
/** 文本搜索（回车/按钮）：重置到第一页 */
function onSearchClick(): void {
  page.value = 1
  void search()
}
/** 分类筛选：重置到第一页 */
function setCat(c: string): void {
  catFilter.value = catFilter.value === c ? '' : c
  page.value = 1
  void search()
}
const reading = ref<GutenbergBook | null>(null)
const bookText = ref('')
const textLoading = ref(false)
async function openBook(b: GutenbergBook): Promise<void> {
  const textUrl = pickTextUrl(b)
  const ext = b.formats['wikisource']
  if (!textUrl && ext) {
    reading.value = b
    bookText.value = '正在新标签页打开维基文库在线阅读…'
    window.open(ext, '_blank', 'noopener')
    await upsertReading(b.id, b.title, 1, 0)
    await loadReading()
    return
  }
  if (!textUrl) { reading.value = b; bookText.value = '该书未提供纯文本格式，请使用阅读链接。'; return }
  reading.value = b; textLoading.value = true; bookText.value = ''
  try { bookText.value = await fetchBookText(textUrl) }
  catch { bookText.value = '正文加载失败（可能受网络限制），请稍后重试或使用阅读链接。' }
  finally { textLoading.value = false }
  await upsertReading(b.id, b.title, 1, 0)
  await loadReading()
}
async function reopen(r: LearnReading): Promise<void> {
  try {
    const res = await fetchBooks('', 1)
    const found = res.results.find((x) => x.id === r.book_id)
    if (found) await openBook(found)
  } catch { /* ignore */ }
}

/* 书架 + 收藏 */
const readingList = ref<LearnReading[]>([])
async function loadReading(): Promise<void> { readingList.value = await listReading() }
const bookmarks = ref<LearnBookmark[]>([])
async function loadBookmarks(): Promise<void> { bookmarks.value = await listLearnBookmarks('book') }
async function bookmarkBook(b: GutenbergBook): Promise<void> { await addLearnBookmark('book', String(b.id), b.title); await loadBookmarks() }
async function unbookmark(id: string): Promise<void> { await removeLearnBookmark(id); await loadBookmarks() }
function fmtTime(s: string): string { return s ? s.slice(0, 16).replace('T', ' ') : '—' }

/* AI 导读 */
const aiBookTitle = ref('')
const aiBookText = ref('')
const aiReadLoading = ref(false)
const aiReadResult = ref('')
async function runAiRead(): Promise<void> {
  if (!cfg.value) { ElMessage.warning('请先配置 AI 密钥'); return }
  aiReadLoading.value = true
  const ctx = aiBookText.value.trim() ? `\n书籍片段：\n${aiBookText.value.slice(0, 2000)}` : ''
  try {
    aiReadResult.value = await callAi(cfg.value, `你是阅读导读书童。请为《${aiBookTitle.value.trim() || '该书'}》生成导读：1) 一句话主旨；2) 三个核心要点；3) 两个值得思考的讨论问题。${ctx}`)
  } catch (e) { ElMessage.error('AI 调用失败：' + (e as Error).message) }
  finally { aiReadLoading.value = false }
}

/* 学习计划 */
const examDate = ref('')
const planLevel = ref('')
const planTarget = ref('')
const materialName = ref('')
const materialText = ref('')
const planLoading = ref(false)
const plan = ref<StudyPlan | null>(null)
const fileInput = ref<HTMLInputElement | null>(null)
async function onFile(e: Event): Promise<void> {
  const f = (e.target as HTMLInputElement).files?.[0]
  if (!f) return
  try { materialText.value = await parseMaterialFile(f); materialName.value = f.name; ElMessage.success('资料已读取') }
  catch (err) { materialName.value = ''; materialText.value = ''; ElMessage.error((err as Error).message) }
}
async function genPlan(): Promise<void> {
  if (!cfg.value) { ElMessage.warning('请先配置 AI 密钥'); return }
  planLoading.value = true
  try {
    plan.value = await generateStudyPlan(cfg.value, {
      materialText: materialText.value || undefined,
      examDate: examDate.value || '不限期',
      currentLevel: planLevel.value || undefined,
      target: planTarget.value || undefined
    })
    ElMessage.success('计划已生成，可点击「保存计划」')
  } catch (e) { ElMessage.error('生成失败：' + (e as Error).message) }
  finally { planLoading.value = false }
}
async function savePlan(): Promise<void> {
  if (!plan.value) return
  await saveStudyPlan(plan.value, examDate.value || '不限期')
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
const qaQuestion = ref('如何坚持每天阅读并做有效笔记？')
const qaLoading = ref(false)
const qaAnswer = ref('')
async function runQa(): Promise<void> {
  if (!cfg.value) { ElMessage.warning('请先配置 AI 密钥'); return }
  qaLoading.value = true
  try { qaAnswer.value = await callAi(cfg.value, '你是阅读方法顾问，用通俗中文解答。\n问题：' + qaQuestion.value) }
  catch (e) { ElMessage.error('AI 调用失败：' + (e as Error).message) }
  finally { qaLoading.value = false }
}

function switchModule(key: string): void {
  active.value = key
  if (key === 'shelf' && !readingList.value.length) void loadReading()
  if (key === 'plan' && !savedPlans.value.length) void loadPlans()
}

onMounted(async () => {
  updateClock()
  clockTimer = window.setInterval(updateClock, 1000)
  try { cfg.value = await loadAiConfig() } catch { /* ignore */ }
  await Promise.all([search(), loadReading(), loadBookmarks(), loadPlans()])
})
onUnmounted(() => { if (clockTimer) window.clearInterval(clockTimer) })
</script>

<style scoped>
.lb-root { min-height: 100%; }
.lb-clock-box { display: inline-flex; align-items: center; gap: 6px; }
.lb-dot { width: 8px; height: 8px; border-radius: 50%; background: #22c55e; box-shadow: 0 0 0 3px rgba(34,197,94,.2); animation: lbBlink 2s ease-in-out infinite; }
@keyframes lbBlink { 0%,100% { opacity: 1; } 50% { opacity: .45; } }
.lb-clock { font-variant-numeric: tabular-nums; font-size: 13px; color: var(--text-strong); }
.lb-clock-hint { font-size: 11px; color: var(--text-faint); }

.lb-entries { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 12px; margin-bottom: 18px; }
.lb-entry { position: relative; display: flex; align-items: center; gap: 10px; padding: 12px 14px 12px 16px; background: var(--surface); border: 1px solid var(--border); border-radius: 14px; box-shadow: var(--shadow-card); cursor: pointer; text-align: left; min-width: 0; overflow: hidden; transition: transform .18s ease, border-color .18s ease, background .18s ease; }
.lb-entry:hover { transform: translateY(-2px); border-color: var(--c); }
.lb-entry.on { border-color: var(--c); background: color-mix(in srgb, var(--c) 7%, var(--surface)); }
.lb-bar { position: absolute; left: 0; top: 0; bottom: 0; width: 3px; background: var(--c); opacity: 0; transition: opacity .18s ease; }
.lb-entry.on .lb-bar { opacity: 1; }
.lb-icon { width: 34px; height: 34px; border-radius: 10px; display: grid; place-items: center; flex-shrink: 0; background: color-mix(in srgb, var(--c) 12%, transparent); color: var(--c); }
.lb-icon :deep(svg) { font-size: 17px; }
.lb-text { display: flex; flex-direction: column; min-width: 0; flex: 1; line-height: 1.3; }
.lb-label { font-size: 13.5px; font-weight: 600; color: var(--text-strong); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.lb-desc { font-size: 11px; color: var(--text-faint); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

.lb-body { min-height: 320px; }
.lb-card { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 18px; box-shadow: var(--shadow-card); }
.lb-h { font-size: 15px; color: var(--text-strong); margin: 0 0 6px; }
.lb-sub { font-size: 12px; color: var(--text-faint); margin: 0 0 12px; }
.lb-row { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
.lb-input { width: 320px; }
.lb-warn { font-size: 12px; color: #f59e0b; }
.lb-cats { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px; }
.lb-cat { border: 1px solid var(--border); background: var(--surface); color: var(--text-muted); border-radius: 999px; padding: 4px 14px; font-size: 12.5px; cursor: pointer; transition: all .15s ease; }
.lb-cat:hover { border-color: var(--brand, #378add); color: var(--brand, #378add); }
.lb-cat.on { background: var(--brand, #378add); border-color: var(--brand, #378add); color: #fff; }
.lb-count { font-size: 12.5px; color: var(--text-muted); margin: 10px 0 0; }
.lb-count b { color: var(--text-strong); }
.lb-book-top { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.lb-cat-chip { flex-shrink: 0; font-size: 10.5px; color: var(--brand, #378add); background: color-mix(in srgb, var(--brand, #378add) 10%, transparent); border-radius: 6px; padding: 1px 6px; white-space: nowrap; }
.lb-fallback { font-size: 12px; color: #16a34a; background: var(--surface-soft); border: 1px solid var(--border); border-radius: 8px; padding: 8px 12px; margin-bottom: 10px; }
.lb-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 12px; margin-top: 12px; }
.lb-grid2 { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 12px; }
.lb-empty { grid-column: 1 / -1; color: var(--text-faint); font-size: 13px; padding: 16px; text-align: center; }
.lb-book { padding: 12px; border: 1px solid var(--border); border-radius: 10px; background: var(--surface-soft); display: flex; flex-direction: column; gap: 4px; }
.lb-book-title { font-size: 13px; font-weight: 600; color: var(--text-strong); line-height: 1.4; }
.lb-book-author { font-size: 12px; color: var(--text-faint); }
.lb-book-meta { font-size: 11px; color: var(--text-faint); }
.lb-book-actions { display: flex; gap: 6px; margin-top: 6px; flex-wrap: wrap; }
.lb-mini { border: 1px solid var(--border); background: var(--surface); color: var(--brand, #378add); border-radius: 6px; padding: 3px 10px; font-size: 12px; cursor: pointer; text-decoration: none; display: inline-block; }
.lb-mini:hover { border-color: var(--brand, #378add); }
.lb-mini.danger { color: #ef4444; }
.lb-pager { display: flex; align-items: center; gap: 12px; justify-content: center; margin-top: 14px; }
.lb-pageinfo { font-size: 12px; color: var(--text-muted); }
.lb-reader { margin-top: 18px; }
.lb-hrow { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 10px; }
.lb-text { max-height: 55vh; overflow: auto; white-space: pre-wrap; word-break: break-word; line-height: 1.8; font-size: 13px; color: var(--text); background: var(--surface-soft); padding: 14px; border-radius: 8px; }
.lb-answer { margin-top: 14px; padding: 12px; background: var(--surface-soft); border-radius: 8px; white-space: pre-wrap; line-height: 1.7; font-size: 13px; color: var(--text); }

.lb-plan-form { background: var(--surface-soft); border: 1px solid var(--border); border-radius: 10px; padding: 14px; }
.lb-pf-row { display: flex; align-items: center; gap: 12px; margin-bottom: 12px; }
.lb-pf-row > label { width: 72px; flex-shrink: 0; font-size: 13px; color: var(--text-muted); }
.lb-file-ok { font-size: 12px; color: #16a34a; }
.lb-plan { margin-top: 16px; }
.lb-plan-meta { font-size: 13px; color: var(--text-strong); margin-bottom: 10px; }
.lb-phase { border: 1px solid var(--border); border-left: 3px solid #e08a00; border-radius: 8px; padding: 12px 14px; margin-bottom: 10px; background: var(--surface); }
.lb-phase-h { font-size: 14px; font-weight: 600; color: var(--text-strong); margin-bottom: 8px; }
.lb-phase-no { display: inline-grid; place-items: center; width: 22px; height: 22px; border-radius: 50%; background: #e08a00; color: #fff; font-size: 12px; margin-right: 8px; }
.lb-phase-days { font-size: 12px; color: var(--text-faint); font-weight: 400; margin-left: 8px; }
.lb-phase-block { font-size: 12.5px; color: var(--text-muted); margin: 4px 0; }
.lb-phase-block ul, .lb-tips ul { margin: 4px 0 0; padding-left: 18px; }
.lb-tips { font-size: 12.5px; color: var(--text-muted); background: var(--surface-soft); border-radius: 8px; padding: 10px 14px; margin-top: 6px; }
.lb-know { padding: 12px; border: 1px solid var(--border); border-radius: 10px; background: var(--surface-soft); }
.lb-know-title { font-size: 13px; font-weight: 600; color: var(--text-strong); margin-bottom: 6px; }

.lb-fade-enter-active, .lb-fade-leave-active { transition: opacity .18s ease, transform .18s ease; }
.lb-fade-enter-from { opacity: 0; transform: translateY(6px); }
.lb-fade-leave-to { opacity: 0; transform: translateY(-6px); }

@media (max-width: 1100px) { .lb-entries { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
@media (max-width: 760px) {
  .lb-entries { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
  .lb-entry { padding: 10px 10px 10px 13px; gap: 8px; }
  .lb-icon { width: 30px; height: 30px; border-radius: 9px; }
  .lb-label { font-size: 12.5px; }
  .lb-desc { display: none; }
}
@media (max-width: 460px) { .lb-entries { grid-template-columns: 1fr; } }
</style>
