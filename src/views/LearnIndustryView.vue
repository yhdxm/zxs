<template>
  <div class="li-root">
    <PageHeader
      title="各行各业知识"
      subtitle="通用知识库 · 数据源：内置行业知识库 + 维基百科在线补充 + 已配置 AI · 全部免费公开源"
      :icon="Collection"
    >
      <div class="li-clock-box" title="北京时间">
        <span class="li-dot"></span><span class="li-clock">{{ nowText }}</span><span class="li-clock-hint">北京时间</span>
      </div>
    </PageHeader>

    <nav class="li-entries">
      <button
        v-for="m in MODULES"
        :key="m.key"
        type="button"
        class="li-entry"
        :class="{ on: active === m.key }"
        :style="{ '--c': m.color }"
        @click="switchModule(m.key)"
      >
        <span class="li-bar"></span>
        <span class="li-icon"><el-icon><component :is="m.icon" /></el-icon></span>
        <span class="li-text">
          <span class="li-label">{{ m.label }}</span>
          <span class="li-desc">{{ m.desc }}</span>
        </span>
      </button>
    </nav>

    <Transition name="li-fade" mode="out-in">
      <section :key="active" class="li-body">
        <!-- 知识库 + 在线补充 -->
        <div v-if="active === 'knowledge'" class="li-card">
          <div class="li-hrow">
            <h3 class="li-h">行业知识库（已有内置兜底，永不空白）</h3>
            <el-input v-model="wikiKw" placeholder="联网补充：输入行业名，如 人工智能" class="li-input" @keyup.enter="wikiSearch" />
            <el-button :loading="wikiLoading" @click="wikiSearch">维基补充</el-button>
          </div>
          <div v-if="wikiResult" class="li-wiki">
            <b>维基百科：{{ wikiKw }}</b>
            <p>{{ wikiResult }}</p>
            <button class="li-mini" @click="wikiResult = ''">关闭</button>
          </div>

          <div class="li-grid">
            <div v-for="t in topics" :key="t.name" class="li-topic">
              <div class="li-topic-head">
                <div>
                  <div class="li-topic-name">{{ t.name }}</div>
                  <div class="li-topic-desc">{{ t.desc }}</div>
                </div>
                <span :class="['li-status', statusOf(t.name)]">{{ statusOf(t.name) === 'done' ? '已掌握' : statusOf(t.name) === 'learning' ? '学习中' : '未学' }}</span>
              </div>
              <ul class="li-points"><li v-for="(p, i) in t.keyPoints" :key="i">{{ p }}</li></ul>
              <div class="li-actions">
                <button class="li-mini" @click="explain(t)">AI 讲透</button>
                <button class="li-mini" :class="{ on: isBooked(t.name) }" @click="toggleBookmark(t)">{{ isBooked(t.name) ? '已收藏' : '收藏' }}</button>
                <button class="li-mini" @click="markDone(t)">标记已掌握</button>
              </div>
              <div v-if="t._explain" class="li-explain">{{ t._explain }}</div>
            </div>
          </div>
          <p v-if="!cfg" class="li-warn">未检测到 AI 配置，AI 讲解不可用；请先到「AI 助手」配置密钥。</p>
        </div>

        <!-- 学习计划 -->
        <div v-else-if="active === 'plan'" class="li-card">
          <h3 class="li-h">个性化学习计划</h3>
          <p class="li-sub">上传资料或填写目标，由 AI 生成可执行计划并存入云端（按账号隔离）。</p>
          <div class="li-plan-form">
            <div class="li-pf-row">
              <label>考试时间</label>
              <el-date-picker v-model="examDate" type="date" placeholder="选择日期（可选）" value-format="YYYY-MM-DD" style="flex:1;" />
            </div>
            <div class="li-pf-row">
              <label>当前水平</label>
              <el-input v-model="planLevel" placeholder="如：零基础 / 想系统了解" style="flex:1;" />
            </div>
            <div class="li-pf-row">
              <label>目标</label>
              <el-input v-model="planTarget" placeholder="如：掌握人工智能核心概念" style="flex:1;" />
            </div>
            <div class="li-pf-row li-pf-col">
              <label>重点模块</label>
              <div class="li-chks">
                <el-checkbox v-for="t in topics" :key="t.name" v-model="planFocus" :value="t.name" size="small">{{ t.name }}</el-checkbox>
              </div>
            </div>
            <div class="li-pf-row">
              <label>资料</label>
              <input ref="fileInput" type="file" accept=".txt,.md,.text" style="display:none" @change="onFile" />
              <el-button @click="fileInput?.click()">{{ materialName || '选择 .txt/.md 文件' }}</el-button>
              <span v-if="materialName" class="li-file-ok">已读取（{{ materialText.length }} 字）</span>
            </div>
            <div class="li-row">
              <el-button type="primary" :loading="planLoading" :disabled="!cfg" @click="genPlan">生成学习计划</el-button>
              <el-button v-if="plan" @click="savePlan">保存计划</el-button>
              <span v-if="!cfg" class="li-warn">未检测到 AI 配置。</span>
            </div>
          </div>

          <div v-if="plan" class="li-plan">
            <div class="li-plan-meta">重点：{{ plan.focus.join('、') || '全模块' }}<span v-if="plan.totalDays"> · 距目标约 {{ plan.totalDays }} 天</span></div>
            <div v-for="(ph, i) in plan.phases" :key="i" class="li-phase">
              <div class="li-phase-h"><span class="li-phase-no">{{ i + 1 }}</span>{{ ph.title }} <span class="li-phase-days">{{ ph.days }}</span></div>
              <div class="li-phase-block"><b>目标</b><ul><li v-for="(g, j) in ph.goals" :key="j">{{ g }}</li></ul></div>
              <div class="li-phase-block"><b>方法</b><ul><li v-for="(m, j) in ph.methods" :key="j">{{ m }}</li></ul></div>
            </div>
            <div class="li-tips"><b>提示</b><ul><li v-for="(t, i) in plan.tips" :key="i">{{ t }}</li></ul></div>
          </div>

          <h3 class="li-h" style="margin-top:18px;">已保存的计划（云端）</h3>
          <div class="li-grid2">
            <div v-for="p in savedPlans" :key="p.id" class="li-know">
              <div class="li-know-title">{{ p.title }}</div>
              <div class="li-row">
                <button class="li-mini" @click="loadPlan(p)">查看</button>
                <button class="li-mini danger" @click="delPlan(p.id)">删除</button>
              </div>
            </div>
            <p v-if="!savedPlans.length" class="li-empty">还没有保存的计划。</p>
          </div>
        </div>

        <!-- AI 答疑 -->
        <div v-else-if="active === 'ai'" class="li-card">
          <h3 class="li-h">AI 知识答疑</h3>
          <p class="li-sub">基于已配置 AI 解答行业概念、学习路径等问题。</p>
          <el-input v-model="qaQuestion" type="textarea" :rows="3" placeholder="例如：想转行做 AI，先学什么？新能源和智能网联有什么区别？" />
          <div class="li-row">
            <el-button type="primary" :loading="qaLoading" @click="runQa">向 AI 提问</el-button>
            <span v-if="!cfg" class="li-warn">未检测到 AI 配置。</span>
          </div>
          <div v-if="qaAnswer" class="li-answer">{{ qaAnswer }}</div>
        </div>
      </section>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { Collection, Calendar, ChatDotRound } from '@element-plus/icons-vue'
import PageHeader from '../components/PageHeader.vue'
import { loadAiConfig, callAi, type AiConfig } from '../services/aiService'
import {
  INDUSTRY_KNOWLEDGE,
  explainTopic,
  generateStudyPlan,
  parseMaterialFile,
  type IndustryTopic,
  type StudyPlan
} from '../services/learningService'
import { fetchCorsJson } from '../services/freeApi'
import {
  getProgress,
  setProgress,
  listLearnBookmarks,
  addLearnBookmark,
  removeLearnBookmark,
  listStudyPlans,
  saveStudyPlan,
  removeStudyPlan,
  type LearnBookmark,
  type LearnProgress
} from '../services/learnDb'

const MODULES = [
  { key: 'knowledge', label: '知识库', desc: '内置 + 维基', color: '#7c3aed', icon: Collection },
  { key: 'plan', label: '学习计划', desc: '资料→AI 计划', color: '#e08a00', icon: Calendar },
  { key: 'ai', label: 'AI 答疑', desc: '概念/路径', color: '#0ea5e9', icon: ChatDotRound }
]
const active = ref('knowledge')

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

function statusOf(name: string): string { const p = progressMap.value[name]; return p?.status || 'none' }
function isBooked(name: string): boolean { return bookmarks.value.some((b) => b.ref_id === name) }

async function loadState(): Promise<void> {
  bookmarks.value = await listLearnBookmarks('topic')
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

/* 维基百科在线补充（兜底增强，失败静默） */
const wikiKw = ref('')
const wikiLoading = ref(false)
const wikiResult = ref('')
async function wikiSearch(): Promise<void> {
  const q = wikiKw.value.trim()
  if (!q) return
  wikiLoading.value = true
  try {
    const r = await fetchCorsJson<{ extract?: string }>(`https://zh.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(q)}`)
    wikiResult.value = r?.extract || '（维基暂未返回，已使用内置知识库兜底）'
  } catch {
    wikiResult.value = '（维基暂不可达，已使用内置知识库兜底）'
  }
  wikiLoading.value = false
}

/* 学习计划（与学位英语同逻辑，复用服务层） */
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
      target: planTarget.value || undefined,
      focusModules: planFocus.value.length ? planFocus.value : undefined
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
const qaQuestion = ref('想系统了解新能源汽车产业，从哪里入手？')
const qaLoading = ref(false)
const qaAnswer = ref('')
async function runQa(): Promise<void> {
  if (!cfg.value) { ElMessage.warning('请先配置 AI 密钥'); return }
  qaLoading.value = true
  try { qaAnswer.value = await callAi(cfg.value, '你是通识知识科普老师，用通俗中文解答行业概念与学习路径。\n问题：' + qaQuestion.value) }
  catch (e) { ElMessage.error('AI 调用失败：' + (e as Error).message) }
  finally { qaLoading.value = false }
}

function switchModule(key: string): void {
  active.value = key
  if (key === 'plan' && !savedPlans.value.length) void loadPlans()
}

onMounted(async () => {
  updateClock()
  clockTimer = window.setInterval(updateClock, 1000)
  try { cfg.value = await loadAiConfig() } catch { /* ignore */ }
  await loadState()
  await loadPlans()
})
onUnmounted(() => { if (clockTimer) window.clearInterval(clockTimer) })
</script>

<style scoped>
.li-root { min-height: 100%; }
.li-clock-box { display: inline-flex; align-items: center; gap: 6px; }
.li-dot { width: 8px; height: 8px; border-radius: 50%; background: #22c55e; box-shadow: 0 0 0 3px rgba(34,197,94,.2); animation: liBlink 2s ease-in-out infinite; }
@keyframes liBlink { 0%,100% { opacity: 1; } 50% { opacity: .45; } }
.li-clock { font-variant-numeric: tabular-nums; font-size: 13px; color: var(--text-strong); }
.li-clock-hint { font-size: 11px; color: var(--text-faint); }

.li-entries { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; margin-bottom: 18px; }
.li-entry { position: relative; display: flex; align-items: center; gap: 10px; padding: 12px 14px 12px 16px; background: var(--surface); border: 1px solid var(--border); border-radius: 14px; box-shadow: var(--shadow-card); cursor: pointer; text-align: left; min-width: 0; overflow: hidden; transition: transform .18s ease, border-color .18s ease, background .18s ease; }
.li-entry:hover { transform: translateY(-2px); border-color: var(--c); }
.li-entry.on { border-color: var(--c); background: color-mix(in srgb, var(--c) 7%, var(--surface)); }
.li-bar { position: absolute; left: 0; top: 0; bottom: 0; width: 3px; background: var(--c); opacity: 0; transition: opacity .18s ease; }
.li-entry.on .li-bar { opacity: 1; }
.li-icon { width: 34px; height: 34px; border-radius: 10px; display: grid; place-items: center; flex-shrink: 0; background: color-mix(in srgb, var(--c) 12%, transparent); color: var(--c); }
.li-icon :deep(svg) { font-size: 17px; }
.li-text { display: flex; flex-direction: column; min-width: 0; flex: 1; line-height: 1.3; }
.li-label { font-size: 13.5px; font-weight: 600; color: var(--text-strong); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.li-desc { font-size: 11px; color: var(--text-faint); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

.li-body { min-height: 320px; }
.li-card { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 18px; box-shadow: var(--shadow-card); }
.li-h { font-size: 15px; color: var(--text-strong); margin: 0 0 6px; }
.li-sub { font-size: 12px; color: var(--text-faint); margin: 0 0 12px; }
.li-hrow { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; margin-bottom: 12px; }
.li-input { width: 240px; }
.li-row { display: flex; align-items: center; gap: 10px; margin-top: 10px; flex-wrap: wrap; }
.li-warn { font-size: 12px; color: #f59e0b; }
.li-wiki { background: var(--surface-soft); border: 1px solid var(--border); border-radius: 10px; padding: 12px; margin-bottom: 14px; font-size: 13px; color: var(--text); line-height: 1.7; }
.li-wiki b { color: var(--text-strong); }
.li-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 14px; }
.li-grid2 { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 12px; }
.li-empty { grid-column: 1 / -1; color: var(--text-faint); font-size: 13px; padding: 16px; text-align: center; }
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
.li-mini.danger { color: #ef4444; }
.li-explain { padding-top: 8px; border-top: 1px dashed var(--border); font-size: 12px; color: var(--text); white-space: pre-wrap; line-height: 1.6; }

.li-plan-form { background: var(--surface-soft); border: 1px solid var(--border); border-radius: 10px; padding: 14px; }
.li-pf-row { display: flex; align-items: center; gap: 12px; margin-bottom: 12px; }
.li-pf-row > label { width: 72px; flex-shrink: 0; font-size: 13px; color: var(--text-muted); }
.li-pf-col { align-items: flex-start; }
.li-chks { display: flex; flex-wrap: wrap; gap: 4px 14px; }
.li-file-ok { font-size: 12px; color: #16a34a; }
.li-plan { margin-top: 16px; }
.li-plan-meta { font-size: 13px; color: var(--text-strong); margin-bottom: 10px; }
.li-phase { border: 1px solid var(--border); border-left: 3px solid #e08a00; border-radius: 8px; padding: 12px 14px; margin-bottom: 10px; background: var(--surface); }
.li-phase-h { font-size: 14px; font-weight: 600; color: var(--text-strong); margin-bottom: 8px; }
.li-phase-no { display: inline-grid; place-items: center; width: 22px; height: 22px; border-radius: 50%; background: #e08a00; color: #fff; font-size: 12px; margin-right: 8px; }
.li-phase-days { font-size: 12px; color: var(--text-faint); font-weight: 400; margin-left: 8px; }
.li-phase-block { font-size: 12.5px; color: var(--text-muted); margin: 4px 0; }
.li-phase-block ul, .li-tips ul { margin: 4px 0 0; padding-left: 18px; }
.li-tips { font-size: 12.5px; color: var(--text-muted); background: var(--surface-soft); border-radius: 8px; padding: 10px 14px; margin-top: 6px; }
.li-know { padding: 12px; border: 1px solid var(--border); border-radius: 10px; background: var(--surface-soft); }
.li-know-title { font-size: 13px; font-weight: 600; color: var(--text-strong); margin-bottom: 6px; }
.li-answer { margin-top: 14px; padding: 12px; background: var(--surface-soft); border-radius: 8px; white-space: pre-wrap; line-height: 1.7; font-size: 13px; color: var(--text); }

.li-fade-enter-active, .li-fade-leave-active { transition: opacity .18s ease, transform .18s ease; }
.li-fade-enter-from { opacity: 0; transform: translateY(6px); }
.li-fade-leave-to { opacity: 0; transform: translateY(-6px); }

@media (max-width: 760px) {
  .li-entries { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
  .li-entry { padding: 10px 10px 10px 13px; gap: 8px; }
  .li-icon { width: 30px; height: 30px; border-radius: 9px; }
  .li-label { font-size: 12.5px; }
  .li-desc { display: none; }
}
@media (max-width: 460px) { .li-entries { grid-template-columns: 1fr; } }
</style>
