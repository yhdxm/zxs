<template>
  <div class="le-root">
    <PageHeader
      title="学位英语"
      subtitle="备考助手 · 内置知识库（11 模块 / 40+ 讲真实讲解）+ Free Dictionary 查词 + 已配置 AI · 依据《成人学士学位英语水平考试大纲（第二版）》"
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

        <!-- 知识库：模块导航 + 逐讲精读 -->
        <div v-else-if="active === 'outline'" class="le-card">
          <div class="le-kb-head">
            <div class="le-kb-headtext">
              <h3 class="le-h">学位英语知识库 · {{ ENGLISH_KB_STATS.modules }} 个模块 / {{ ENGLISH_KB_STATS.lessons }} 讲</h3>
              <p class="le-sub">每一讲都含讲解正文、对照表、例句与易错点，点开即可学；纯内置内容，断网也能看。</p>
            </div>
            <el-input v-model="kbSearch" clearable placeholder="搜索知识点：虚拟语气 / 定语从句 / 婉拒 / 熟词生义…" class="le-kb-search" />
          </div>

          <!-- 搜索结果 -->
          <div v-if="kbSearch.trim()" class="le-kb-results">
            <p class="le-sub">匹配到 {{ searchResults.length }} 讲</p>
            <button
              v-for="r in searchResults"
              :key="r.lesson.id"
              type="button"
              class="le-kb-rescard"
              @click="gotoLesson(r.moduleKey, r.lesson.id)"
            >
              <span class="le-kb-resmod">{{ r.moduleName }}</span>
              <span class="le-kb-restitle">{{ r.lesson.title }}</span>
              <span class="le-kb-ressum">{{ r.lesson.summary }}</span>
            </button>
            <p v-if="!searchResults.length" class="le-empty">没有匹配的知识点，换个关键词试试（如 时态、被动、翻译、作文）。</p>
          </div>

          <div v-else class="le-kb-main">
            <!-- 左侧模块导航 -->
            <aside class="le-kb-nav">
              <button
                v-for="m in outline"
                :key="m.key"
                type="button"
                class="le-kb-navi"
                :class="{ on: curKey === m.key }"
                @click="selectModule(m.key)"
              >
                <span class="le-kb-navname">{{ m.name }}</span>
                <span class="le-kb-navnum">{{ m.lessons.length }} 讲</span>
              </button>
            </aside>

            <!-- 右侧内容 -->
            <div class="le-kb-content">
              <div class="le-kb-intro">
                <div class="le-kb-title">{{ curModule.name }}</div>
                <p class="le-kb-desc">{{ curModule.desc }}</p>
                <div class="le-kb-tags"><span v-for="(kp, i) in curModule.keyPoints" :key="i" class="le-kb-tag">{{ kp }}</span></div>
                <div class="le-row">
                  <button class="le-mini" @click="expandAll(true)">展开全部</button>
                  <button class="le-mini" @click="expandAll(false)">收起全部</button>
                  <button class="le-mini" @click="explainModule(curModule)">AI 讲透本模块</button>
                </div>
                <div v-if="moduleAi[curModule.key]" class="le-know-explain">{{ moduleAi[curModule.key] }}</div>
              </div>

              <article
                v-for="(l, i) in curModule.lessons"
                :id="'les-' + l.id"
                :key="l.id"
                class="le-lesson"
                :class="{ open: !!openMap[l.id] }"
              >
                <header class="le-lesson-h" @click="toggleLesson(l.id)">
                  <span class="le-lesson-no">{{ i + 1 }}</span>
                  <span class="le-lesson-hh">
                    <span class="le-lesson-t">{{ l.title }}</span>
                    <span class="le-lesson-s">{{ l.summary }}</span>
                  </span>
                  <el-icon class="le-lesson-arrow"><ArrowDown /></el-icon>
                </header>

                <div v-show="openMap[l.id]" class="le-lesson-b">
                  <p v-for="(p, pi) in l.body" :key="'p' + pi" class="le-p">{{ p }}</p>

                  <div v-for="(t, ti) in (l.tables || [])" :key="'t' + ti" class="le-tbl-wrap">
                    <div v-if="t.title" class="le-tbl-title">{{ t.title }}</div>
                    <div class="le-tbl-scroll">
                      <table class="le-tbl">
                        <thead><tr><th v-for="(h, hi) in t.head" :key="hi">{{ h }}</th></tr></thead>
                        <tbody>
                          <tr v-for="(r, ri) in t.rows" :key="ri">
                            <td v-for="(c, ci) in r" :key="ci">{{ c }}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div v-if="l.examples && l.examples.length" class="le-exs">
                    <div class="le-block-h">例句</div>
                    <div v-for="(e, ei) in l.examples" :key="'e' + ei" class="le-ex-item">
                      <div class="le-ex-en">{{ e.en }}</div>
                      <div class="le-ex-zh">{{ e.zh }}</div>
                      <div v-if="e.note" class="le-ex-note">提示：{{ e.note }}</div>
                    </div>
                  </div>

                  <div v-if="l.traps && l.traps.length" class="le-traps">
                    <div class="le-block-h warn">易错点 / 考点提醒</div>
                    <ul><li v-for="(t, ti2) in l.traps" :key="'tr' + ti2">{{ t }}</li></ul>
                  </div>

                  <div class="le-row">
                    <button class="le-mini" @click="explainLesson(l)">AI 换种说法再讲一遍</button>
                    <button class="le-mini" @click="quizLesson(l)">AI 出 3 道练习题</button>
                  </div>
                  <div v-if="lessonAi[l.id]" class="le-know-explain">{{ lessonAi[l.id] }}</div>
                </div>
              </article>
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
      </section>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { School, Reading, Collection, Calendar, ChatDotRound, ArrowDown } from '@element-plus/icons-vue'
import PageHeader from '../components/PageHeader.vue'
import { loadAiConfig, callAi, type AiConfig } from '../services/aiService'
import {
  fetchDefinitionSafe,
  explainWord,
  explainTopic,
  ENGLISH_OUTLINE,
  ENGLISH_KB_STATS,
  ENGLISH_LESSON_INDEX,
  generateStudyPlan,
  parseMaterialFile,
  type WordDefinition,
  type EnglishLesson,
  type EnglishOutlineItem,
  type StudyPlan
} from '../services/learningService'
import {
  listLearnBookmarks,
  addLearnBookmark,
  removeLearnBookmark,
  listStudyPlans,
  saveStudyPlan,
  removeStudyPlan,
  type LearnBookmark
} from '../services/learnDb'

const MODULES = [
  { key: 'word', label: '查词收藏', desc: '词典 + 生词本', color: '#0891b2', icon: Reading },
  { key: 'outline', label: '知识库', desc: '40+ 讲精读', color: '#7c3aed', icon: Collection },
  { key: 'plan', label: '学习计划', desc: '资料→AI 计划', color: '#e08a00', icon: Calendar },
  { key: 'ai', label: 'AI 答疑', desc: '语法/备考', color: '#0ea5e9', icon: ChatDotRound }
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

function switchModule(key: string): void {
  active.value = key
  if (key === 'word' && !words.value.length) void loadWords()
  if (key === 'plan' && !savedPlans.value.length) void loadPlans()
}

/* ================= 查词 ================= */
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

/* ================= 知识库 ================= */
const outline = ENGLISH_OUTLINE
const curKey = ref(outline[0]?.key || 'dialogue')
const curModule = computed<EnglishOutlineItem>(
  () => outline.find((o) => o.key === curKey.value) ?? (outline[0] as EnglishOutlineItem)
)
const openMap = reactive<Record<string, boolean>>({})
const moduleAi = reactive<Record<string, string>>({})
const lessonAi = reactive<Record<string, string>>({})
const kbSearch = ref('')

/** 默认展开当前模块第一讲，降低"看起来还是大纲"的观感 */
function openFirst(): void {
  const first = curModule.value?.lessons[0]
  if (first) openMap[first.id] = true
}
function selectModule(key: string): void {
  curKey.value = key
  openFirst()
}
function toggleLesson(id: string): void { openMap[id] = !openMap[id] }
function expandAll(v: boolean): void {
  curModule.value.lessons.forEach((l) => { openMap[l.id] = v })
}

const searchResults = computed(() => {
  const q = kbSearch.value.trim().toLowerCase()
  if (!q) return []
  return ENGLISH_LESSON_INDEX.filter(({ moduleName, lesson }) => {
    const hay = [
      moduleName,
      lesson.title,
      lesson.summary,
      lesson.body.join(' '),
      (lesson.traps || []).join(' '),
      (lesson.examples || []).map((e) => e.en + e.zh).join(' '),
      (lesson.tables || []).map((t) => (t.title || '') + t.head.join(' ') + t.rows.map((r) => r.join(' ')).join(' ')).join(' ')
    ].join(' ').toLowerCase()
    return hay.includes(q)
  })
})

function gotoLesson(moduleKey: string, lessonId: string): void {
  kbSearch.value = ''
  curKey.value = moduleKey
  openMap[lessonId] = true
  void nextTick(() => {
    document.getElementById('les-' + lessonId)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  })
}

async function explainModule(m: EnglishOutlineItem): Promise<void> {
  if (!cfg.value) { ElMessage.warning('请先配置 AI 密钥'); return }
  moduleAi[m.key] = 'AI 解读中…'
  try {
    moduleAi[m.key] = await explainTopic(`学位英语「${m.name}」`, cfg.value)
  } catch (e) { moduleAi[m.key] = '解读失败：' + (e as Error).message }
}
async function explainLesson(l: EnglishLesson): Promise<void> {
  if (!cfg.value) { ElMessage.warning('请先配置 AI 密钥'); return }
  lessonAi[l.id] = 'AI 解读中…'
  try {
    lessonAi[l.id] = await callAi(
      cfg.value,
      '你是学位英语辅导老师。请用更通俗、更口语化的方式重新讲解下面这一讲，配 1 个生活化类比和 2 个新例句（含中文翻译），300 字内，不要编造考试政策。\n' +
      `标题：${l.title}\n要点：${l.summary}\n原讲解：${l.body.join(' ')}`
    )
  } catch (e) { lessonAi[l.id] = '解读失败：' + (e as Error).message }
}
async function quizLesson(l: EnglishLesson): Promise<void> {
  if (!cfg.value) { ElMessage.warning('请先配置 AI 密钥'); return }
  lessonAi[l.id] = 'AI 出题中…'
  try {
    lessonAi[l.id] = await callAi(
      cfg.value,
      '请针对下面这一讲的知识点，出 3 道成人学位英语难度的单项选择题（A/B/C/D），每题后紧跟【答案】与一句话解析。只输出题目与解析，不要寒暄。\n' +
      `知识点：${l.title} —— ${l.summary}\n讲解要点：${l.body.join(' ').slice(0, 800)}`
    )
  } catch (e) { lessonAi[l.id] = '出题失败：' + (e as Error).message }
}

/* ================= 学习计划 ================= */
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

/* ================= AI 答疑 ================= */
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

onMounted(async () => {
  updateClock()
  clockTimer = window.setInterval(updateClock, 1000)
  openFirst()
  try { cfg.value = await loadAiConfig() } catch { /* ignore */ }
  await loadWords()
  await lookup()
  await loadPlans()
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

.le-entries { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; margin-bottom: 18px; }
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
.le-row { display: flex; align-items: center; gap: 10px; margin-top: 10px; flex-wrap: wrap; }
.le-input { width: 300px; max-width: 100%; }
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
.le-know-explain { margin-top: 10px; padding: 10px 12px; border: 1px dashed var(--border); border-radius: 8px; background: var(--surface-soft); font-size: 12.5px; color: var(--text); white-space: pre-wrap; line-height: 1.7; }
.le-mini { border: 1px solid var(--border); background: var(--surface); color: var(--brand, #378add); border-radius: 6px; padding: 3px 10px; font-size: 12px; cursor: pointer; text-decoration: none; display: inline-block; }
.le-mini:hover { border-color: var(--brand, #378add); }
.le-mini.danger { color: #ef4444; }
.le-worditem { display: flex; align-items: center; justify-content: space-between; padding: 8px 12px; border: 1px solid var(--border); border-radius: 8px; background: var(--surface-soft); }
.le-wordname { font-size: 13px; color: var(--text-strong); text-transform: capitalize; }

/* ---------- 知识库 ---------- */
.le-kb-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 14px; flex-wrap: wrap; }
.le-kb-headtext { min-width: 0; flex: 1; }
.le-kb-search { width: 320px; max-width: 100%; }

.le-kb-results { margin-top: 6px; display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 10px; }
.le-kb-results > .le-sub { grid-column: 1 / -1; margin: 0; }
.le-kb-rescard { display: flex; flex-direction: column; gap: 4px; text-align: left; padding: 10px 12px; border: 1px solid var(--border); border-radius: 10px; background: var(--surface-soft); cursor: pointer; transition: border-color .16s ease, transform .16s ease; }
.le-kb-rescard:hover { border-color: #7c3aed; transform: translateY(-2px); }
.le-kb-resmod { font-size: 11px; color: #7c3aed; }
.le-kb-restitle { font-size: 13px; font-weight: 600; color: var(--text-strong); }
.le-kb-ressum { font-size: 12px; color: var(--text-muted); line-height: 1.5; }

.le-kb-main { display: grid; grid-template-columns: 210px minmax(0, 1fr); gap: 16px; margin-top: 8px; }
.le-kb-nav { display: flex; flex-direction: column; gap: 6px; position: sticky; top: 12px; align-self: start; max-height: calc(100vh - 120px); overflow: auto; }
.le-kb-navi { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 9px 11px; border: 1px solid var(--border); border-radius: 9px; background: var(--surface); cursor: pointer; text-align: left; transition: all .16s ease; }
.le-kb-navi:hover { border-color: #7c3aed; }
.le-kb-navi.on { border-color: #7c3aed; background: color-mix(in srgb, #7c3aed 8%, var(--surface)); }
.le-kb-navname { font-size: 12.5px; color: var(--text-strong); line-height: 1.35; }
.le-kb-navi.on .le-kb-navname { font-weight: 600; color: #7c3aed; }
.le-kb-navnum { font-size: 11px; color: var(--text-faint); flex-shrink: 0; }

.le-kb-content { min-width: 0; }
.le-kb-intro { padding: 14px 16px; border: 1px solid var(--border); border-radius: 10px; background: var(--surface-soft); margin-bottom: 12px; }
.le-kb-title { font-size: 16px; font-weight: 700; color: var(--text-strong); margin-bottom: 6px; }
.le-kb-desc { font-size: 12.5px; color: var(--text-muted); line-height: 1.7; margin: 0 0 8px; }
.le-kb-tags { display: flex; flex-wrap: wrap; gap: 6px; }
.le-kb-tag { font-size: 11px; color: #7c3aed; background: color-mix(in srgb, #7c3aed 10%, transparent); border-radius: 999px; padding: 2px 9px; }

.le-lesson { border: 1px solid var(--border); border-radius: 10px; background: var(--surface); margin-bottom: 10px; overflow: hidden; }
.le-lesson.open { border-color: color-mix(in srgb, #7c3aed 45%, var(--border)); }
.le-lesson-h { display: flex; align-items: center; gap: 10px; padding: 11px 13px; cursor: pointer; user-select: none; }
.le-lesson-h:hover { background: var(--surface-soft); }
.le-lesson-no { flex-shrink: 0; width: 22px; height: 22px; border-radius: 6px; display: grid; place-items: center; font-size: 12px; background: color-mix(in srgb, #7c3aed 12%, transparent); color: #7c3aed; }
.le-lesson-hh { display: flex; flex-direction: column; min-width: 0; flex: 1; gap: 2px; }
.le-lesson-t { font-size: 13.5px; font-weight: 600; color: var(--text-strong); line-height: 1.4; }
.le-lesson-s { font-size: 12px; color: var(--text-faint); line-height: 1.5; }
.le-lesson-arrow { flex-shrink: 0; color: var(--text-faint); transition: transform .2s ease; }
.le-lesson.open .le-lesson-arrow { transform: rotate(180deg); }
.le-lesson-b { padding: 4px 15px 15px; border-top: 1px dashed var(--border); }
.le-p { font-size: 13px; color: var(--text); line-height: 1.85; margin: 10px 0 0; }

.le-tbl-wrap { margin-top: 12px; }
.le-tbl-title { font-size: 12.5px; font-weight: 600; color: var(--text-strong); margin-bottom: 6px; }
.le-tbl-scroll { overflow-x: auto; -webkit-overflow-scrolling: touch; border: 1px solid var(--border); border-radius: 8px; }
.le-tbl { width: 100%; border-collapse: collapse; font-size: 12.5px; min-width: 420px; }
.le-tbl th { background: var(--surface-soft); color: var(--text-strong); font-weight: 600; text-align: left; padding: 8px 10px; white-space: nowrap; }
.le-tbl td { padding: 8px 10px; color: var(--text-muted); border-top: 1px solid var(--border); line-height: 1.6; vertical-align: top; }
.le-tbl tbody tr:hover { background: var(--surface-soft); }

.le-block-h { font-size: 12.5px; font-weight: 600; color: var(--text-strong); margin: 14px 0 6px; }
.le-block-h.warn { color: #d97706; }
.le-ex-item { padding: 9px 12px; border-left: 3px solid #0891b2; background: var(--surface-soft); border-radius: 0 8px 8px 0; margin-bottom: 8px; }
.le-ex-en { font-size: 13px; color: var(--text-strong); line-height: 1.7; white-space: pre-wrap; }
.le-ex-zh { font-size: 12.5px; color: var(--text-muted); line-height: 1.7; margin-top: 3px; white-space: pre-wrap; }
.le-ex-note { font-size: 11.5px; color: #0891b2; margin-top: 4px; line-height: 1.6; }
.le-traps ul { margin: 0; padding-left: 18px; }
.le-traps li { font-size: 12.5px; color: var(--text-muted); line-height: 1.8; }

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

.le-fade-enter-active, .le-fade-leave-active { transition: opacity .18s ease, transform .18s ease; }
.le-fade-enter-from { opacity: 0; transform: translateY(6px); }
.le-fade-leave-to { opacity: 0; transform: translateY(-6px); }

@media (max-width: 1100px) {
  .le-entries { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .le-kb-main { grid-template-columns: 1fr; }
  .le-kb-nav { position: static; max-height: none; flex-direction: row; overflow-x: auto; padding-bottom: 4px; }
  .le-kb-navi { flex-shrink: 0; }
  .le-kb-navname { white-space: nowrap; }
}
@media (max-width: 760px) {
  .le-card { padding: 14px; }
  .le-entries { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
  .le-entry { padding: 10px 10px 10px 13px; gap: 8px; }
  .le-icon { width: 30px; height: 30px; border-radius: 9px; }
  .le-label { font-size: 12.5px; }
  .le-desc { display: none; }
  .le-kb-search { width: 100%; }
  .le-input { width: 100%; }
  .le-pf-row { flex-direction: column; align-items: stretch; gap: 6px; }
  .le-pf-row > label { width: auto; }
  .le-lesson-b { padding: 4px 12px 13px; }
  .le-p { font-size: 12.5px; line-height: 1.8; }
}
@media (max-width: 460px) { .le-entries { grid-template-columns: 1fr; } }
</style>
