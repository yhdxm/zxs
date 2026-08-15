<template>
  <el-dialog
    v-model="visible"
    :title="`模拟考试 · ${paper.title}`"
    width="98%"
    top="2vh"
    :close-on-click-modal="false"
    :close-on-press-escape="false"
    :show-close="!started || submitted"
    class="mock-exam-dialog"
    destroy-on-close
    @opened="onOpen"
    @closed="onClose"
  >
    <!-- 考试说明 -->
    <div v-if="!started" class="mock-welcome">
      <div class="mock-summary">
        <h3>考试说明</h3>
        <p>本卷严格按《学位英语水平考试大纲》结构组卷：总分 100 分，共 52 题，考试时间 120 分钟。</p>
        <div class="mock-sections">
          <div v-for="s in EXAM_SECTIONS" :key="s.key" class="mock-section-item">
            <span class="mock-section-name" :style="{ color: s.color }">{{ s.name }}</span>
            <span class="mock-section-meta">{{ s.count }} 题 · {{ s.score }} 分 · {{ s.minutes }} 分钟</span>
          </div>
        </div>
        <div class="mock-tip">
          客观题（完成对话、阅读理解、词汇语法）系统自动判分；英译汉与写作需提交后自评，系统提供参考答案。
        </div>
      </div>
      <div class="mock-actions">
        <el-button @click="visible = false">取消</el-button>
        <el-button type="primary" @click="startExam">开始考试</el-button>
      </div>
    </div>

    <!-- 考试中 -->
    <div v-else-if="!submitted" class="mock-exam-body">
      <div class="mock-header">
        <div class="mock-title">
          <span>{{ paper.title }}</span>
          <span class="mock-section-label" :style="{ background: currentSection.color }">{{ currentSection.name }}</span>
        </div>
        <div class="mock-timer" :class="{ urgent: timeLeft <= 300 }">
          {{ formatTime(timeLeft) }}
        </div>
      </div>

      <div class="mock-main">
        <aside class="mock-side">
          <div class="mock-side-title">答题卡</div>
          <div v-for="(sec, sIdx) in sections" :key="sec.key" class="mock-side-group">
            <div class="mock-side-group-title" :style="{ color: sec.color }">{{ sec.name }}</div>
            <div class="mock-side-questions">
              <div
                v-for="(q, qIdx) in sec.questions"
                :key="q.id"
                class="mock-side-q"
                :class="{
                  active: sIdx === currentSectionIndex && qIdx === currentQuestionIndex,
                  answered: answers[q.id]
                }"
                @click="goTo(sIdx, qIdx)"
              >
                {{ q.globalIndex }}
              </div>
            </div>
          </div>
        </aside>

        <div class="mock-question-area">
          <div class="mock-progress">
            当前：第 {{ currentQuestion.globalIndex }} 题 / 共 {{ totalQuestions }} 题
            <span class="mock-progress-bar"><span :style="{ width: progressPercent + '%' }"/></span>
          </div>

          <div class="mock-question-card">
            <div class="mock-q-type" :style="{ color: currentSection.color }">{{ currentSection.name }}</div>
            <div v-if="currentQuestion.passage" class="mock-passage">{{ currentQuestion.passage }}</div>
            <div class="mock-stem">{{ currentQuestion.stem }}</div>

            <div v-if="currentQuestion.type === 'translation'" class="mock-subjective">
              <el-input
                v-model="answers[currentQuestion.id]"
                type="textarea"
                :rows="6"
                placeholder="请在此输入中文译文"
                resize="none"
              />
            </div>

            <div v-else-if="currentQuestion.type === 'writing'" class="mock-subjective">
              <el-input
                v-model="answers[currentQuestion.id]"
                type="textarea"
                :rows="8"
                placeholder="请在此输入短文"
                resize="none"
              />
            </div>

            <div v-else class="mock-options">
              <div
                v-for="(opt, idx) in currentQuestion.options"
                :key="idx"
                class="mock-option"
                :class="{ selected: answers[currentQuestion.id] === optLetter(idx) }"
                @click="selectAnswer(optLetter(idx))"
              >
                <span class="mock-option-letter">{{ optLetter(idx) }}</span>
                <span class="mock-option-text">{{ opt }}</span>
              </div>
            </div>
          </div>

          <div class="mock-nav">
            <el-button :disabled="isFirst" @click="prev">上一题</el-button>
            <el-button v-if="!isLast" type="primary" @click="next">下一题</el-button>
            <el-button v-else type="success" @click="confirmSubmit">交卷</el-button>
          </div>
        </div>
      </div>
    </div>

    <!-- 成绩报告 -->
    <div v-else class="mock-report">
      <div class="mock-report-head">
        <h3>成绩报告</h3>
        <div class="mock-score">
          <span class="mock-score-num">{{ totalScore }}</span>
          <span class="mock-score-total">/ 100 分</span>
        </div>
        <div class="mock-time">用时 {{ formatTime(EXAM_TOTAL.minutes * 60 - timeLeft) }}</div>
      </div>

      <div class="mock-report-grid">
        <div v-for="sec in sectionResults" :key="sec.key" class="mock-report-card">
          <div class="mock-report-name" :style="{ color: sec.color }">{{ sec.name }}</div>
          <div class="mock-report-score">{{ sec.score }} / {{ sec.totalScore }} 分</div>
          <div class="mock-report-rate">正确率 {{ sec.rate }}%</div>
          <div v-if="sec.manual" class="mock-report-manual">含主观题自评</div>
        </div>
      </div>

      <div v-if="wrongQuestions.length > 0" class="mock-report-wrongs">
        <h4>错题回顾</h4>
        <div v-for="q in wrongQuestions" :key="q.id" class="mock-wrong-item">
          <div class="mock-wrong-head">
            <span :style="{ color: q.section.color }">[{{ q.section.name }}]</span>
            <span class="mock-wrong-answer">你的答案：{{ q.userAnswer || '未答' }}</span>
            <span class="mock-wrong-correct">正确答案：{{ q.answer }}</span>
          </div>
          <div class="mock-wrong-stem">{{ q.stem }}</div>
          <div class="mock-wrong-exp">{{ q.explanation }}</div>
        </div>
      </div>

      <div class="mock-actions">
        <el-button @click="visible = false">关闭</el-button>
        <el-button type="primary" @click="restart">再考一次</el-button>
      </div>
    </div>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import type { DegreeQuestion, QuestionType } from '../../prep/degreeTypes'
import { EXAM_SECTIONS, EXAM_TOTAL } from '../../prep/degreeExamStructure'

interface Props {
  modelValue: boolean
  paper: { id: string; title: string; no: number }
  allQuestions: DegreeQuestion[]
}

const props = defineProps<Props>()
const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  submit: [result: { score: number; seconds: number }]
}>()

const visible = computed({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v)
})

interface SectionData {
  key: QuestionType
  name: string
  color: string
  count: number
  score: number
  minutes: number
  questions: (DegreeQuestion & { globalIndex: number })[]
}

interface AnswerMap {
  [id: string]: string
}

const started = ref(false)
const submitted = ref(false)
const currentSectionIndex = ref(0)
const currentQuestionIndex = ref(0)
const answers = ref<AnswerMap>({})
const timeLeft = ref(EXAM_TOTAL.minutes * 60)
const timer = ref<ReturnType<typeof setInterval> | null>(null)

const sections = computed<SectionData[]>(() => {
  const seed = props.paper.no * 1000
  const baseSeed = seed < 1 ? 1 : seed
  const out: SectionData[] = []
  let globalIndex = 1
  for (const sec of EXAM_SECTIONS) {
    const pool = props.allQuestions.filter((q) => q.type === sec.key)
    let questions: DegreeQuestion[] = []
    if (sec.key === 'writing') {
      // 写作题暂用固定提示，不参与自动评分
      questions = [{
        id: `writing-${props.paper.no}`,
        type: 'writing',
        stem: '请根据题目要求写一篇约 120 词的短文（图表作文/书信/议论文）。提交后请对照参考答案自评。',
        answer: '（写作题无统一标准答案，建议紧扣主题、结构清晰、语法正确、字数达标。）',
        explanation: '写作评分标准：内容切题 6 分，语言表达 5 分，结构连贯 3 分，书写规范 1 分。',
        source: { book: '模拟试卷', page: 1, section: '写作', generated: false, basis: '《全真模拟试卷及考点点睛》写作题型' }
      }]
    } else if (pool.length >= sec.count) {
      questions = sample(pool, sec.count, baseSeed + out.length)
    } else {
      questions = [...pool]
      // 题量不足时循环抽取补齐
      while (questions.length < sec.count && pool.length > 0) {
        questions.push(pool[questions.length % pool.length]!)
      }
    }
    const qWithIndex = questions.map((q) => ({ ...q, globalIndex: globalIndex++ }))
    out.push({
      key: sec.key,
      name: sec.name,
      color: sec.color,
      count: sec.count,
      score: sec.score,
      minutes: sec.minutes,
      questions: qWithIndex
    })
  }
  return out
})

const emptyQuestion = (): DegreeQuestion & { globalIndex: number } => ({
  id: '',
  type: 'vocab_grammar',
  stem: '',
  answer: '',
  explanation: '',
  source: { book: '考试大纲', page: 1, section: '通用', generated: true, basis: '' },
  globalIndex: 0
})

const emptySection = (): SectionData => ({
  key: 'vocab_grammar',
  name: '词汇和语法',
  color: '#0F6E56',
  count: 0,
  score: 0,
  minutes: 0,
  questions: []
})

const totalQuestions = computed(() => sections.value.reduce((sum, s) => sum + s.questions.length, 0))
const currentSection = computed<SectionData>(() => sections.value[currentSectionIndex.value] ?? emptySection())
const currentQuestion = computed<(DegreeQuestion & { globalIndex: number })>(() =>
  currentSection.value.questions[currentQuestionIndex.value] ?? emptyQuestion()
)
const isFirst = computed(() => currentSectionIndex.value === 0 && currentQuestionIndex.value === 0)
const isLast = computed(() => {
  const lastSec = sections.value.length - 1
  const lastSecData = sections.value[lastSec]
  if (!lastSecData) return false
  const lastQ = lastSecData.questions.length - 1
  return currentSectionIndex.value === lastSec && currentQuestionIndex.value === lastQ
})
const progressPercent = computed(() => {
  let done = 0
  for (let i = 0; i < sections.value.length; i++) {
    const sec = sections.value[i]
    if (!sec) continue
    if (i < currentSectionIndex.value) {
      done += sec.questions.length
    } else if (i === currentSectionIndex.value) {
      done += currentQuestionIndex.value + 1
      break
    }
  }
  return totalQuestions.value > 0 ? Math.round((done / totalQuestions.value) * 100) : 0
})

function seededRandom(seed: number) {
  let s = seed % 2147483647
  if (s <= 0) s += 2147483647
  return () => {
    s = (s * 16807) % 2147483647
    return (s - 1) / 2147483646
  }
}

function sample<T>(arr: T[], count: number, seed: number): T[] {
  const rng = seededRandom(seed)
  const copy = [...arr]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    const a = copy[i] as T
    const b = copy[j] as T
    copy.splice(i, 1, b)
    copy.splice(j, 1, a)
  }
  return copy.slice(0, count)
}

function optLetter(idx: number): string {
  return String.fromCharCode(65 + idx)
}

function formatTime(seconds: number): string {
  const m = Math.max(0, Math.floor(seconds / 60))
  const s = Math.max(0, seconds % 60)
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function startExam() {
  started.value = true
  submitted.value = false
  answers.value = {}
  currentSectionIndex.value = 0
  currentQuestionIndex.value = 0
  timeLeft.value = EXAM_TOTAL.minutes * 60
  timer.value = setInterval(() => {
    if (timeLeft.value > 0) {
      timeLeft.value--
    } else {
      autoSubmit()
    }
  }, 1000)
}

function onOpen() {
  started.value = false
  submitted.value = false
  answers.value = {}
}

function onClose() {
  if (timer.value) {
    clearInterval(timer.value)
    timer.value = null
  }
}

function selectAnswer(letter: string) {
  const q = currentQuestion.value
  if (!q.id) return
  answers.value[q.id] = letter
}

function goTo(sIdx: number, qIdx: number) {
  currentSectionIndex.value = sIdx
  currentQuestionIndex.value = qIdx
}

function next() {
  const sec = currentSection.value
  if (!sec.questions.length) return
  if (currentQuestionIndex.value < sec.questions.length - 1) {
    currentQuestionIndex.value++
  } else if (currentSectionIndex.value < sections.value.length - 1) {
    currentSectionIndex.value++
    currentQuestionIndex.value = 0
  }
}

function prev() {
  if (currentQuestionIndex.value > 0) {
    currentQuestionIndex.value--
  } else if (currentSectionIndex.value > 0) {
    const targetIdx = currentSectionIndex.value - 1
    const targetSec = sections.value[targetIdx]
    if (!targetSec) return
    currentSectionIndex.value = targetIdx
    currentQuestionIndex.value = targetSec.questions.length - 1
  }
}

async function confirmSubmit() {
  const answered = Object.keys(answers.value).length
  try {
    await ElMessageBox.confirm(
      `已答 ${answered} / ${totalQuestions.value} 题，确认交卷？`,
      '交卷确认',
      { confirmButtonText: '确认交卷', cancelButtonText: '继续答题', type: 'warning' }
    )
  } catch {
    return
  }
  submit()
}

function autoSubmit() {
  ElMessage.warning('考试时间到，系统自动交卷')
  submit()
}

interface SectionResult {
  key: QuestionType
  name: string
  color: string
  score: number
  totalScore: number
  rate: number
  manual: boolean
}

interface WrongItem {
  id: string
  stem: string
  answer: string
  userAnswer: string
  explanation: string
  section: { name: string; color: string }
}

const sectionResults = ref<SectionResult[]>([])
const wrongQuestions = ref<WrongItem[]>([])
const totalScore = ref(0)

function submit() {
  if (timer.value) {
    clearInterval(timer.value)
    timer.value = null
  }
  submitted.value = true

  const results: SectionResult[] = []
  const wrongs: WrongItem[] = []
  let total = 0

  for (const sec of sections.value) {
    let correct = 0
    let answered = 0
    let score = 0
    let manual = false
    const perQuestionScore = sec.questions.length > 0 ? sec.score / sec.count : 0

    for (const q of sec.questions) {
      const userAns = answers.value[q.id] || ''
      if (q.type === 'translation' || q.type === 'writing') {
        manual = true
        // 主观题：已作答给 60% 鼓励分，未答给 0
        score += userAns.trim() ? perQuestionScore * 0.6 : 0
        if (userAns.trim()) {
          wrongs.push({
            id: q.id,
            stem: q.stem,
            answer: q.answer,
            userAnswer: userAns,
            explanation: q.explanation,
            section: { name: sec.name, color: sec.color }
          })
        }
      } else {
        if (userAns) answered++
        if (userAns && userAns === q.answer) {
          correct++
          score += perQuestionScore
        } else {
          wrongs.push({
            id: q.id,
            stem: q.stem,
            answer: q.answer,
            userAnswer: userAns,
            explanation: q.explanation,
            section: { name: sec.name, color: sec.color }
          })
        }
      }
    }

    results.push({
      key: sec.key,
      name: sec.name,
      color: sec.color,
      score: Math.round(score),
      totalScore: sec.score,
      rate: sec.count > 0 ? Math.round((correct / sec.count) * 100) : 0,
      manual
    })
    total += score
  }

  sectionResults.value = results
  wrongQuestions.value = wrongs
  totalScore.value = Math.round(total)
  emit('submit', { score: totalScore.value, seconds: EXAM_TOTAL.minutes * 60 - timeLeft.value })
}

function restart() {
  submitted.value = false
  started.value = false
  answers.value = {}
  sectionResults.value = []
  wrongQuestions.value = []
  currentSectionIndex.value = 0
  currentQuestionIndex.value = 0
}

watch(visible, (v) => {
  if (!v) onClose()
})
</script>

<style scoped>
.mock-exam-dialog :deep(.el-dialog__body) {
  padding: 0;
  max-height: 78vh;
  overflow: auto;
}
.mock-welcome {
  padding: 24px;
}
.mock-summary h3 {
  margin: 0 0 12px;
  font-size: 18px;
  color: #26215c;
}
.mock-summary p {
  color: #5f5e5a;
  font-size: 14px;
  line-height: 1.7;
  margin-bottom: 16px;
}
.mock-sections {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 10px;
  margin-bottom: 16px;
}
.mock-section-item {
  background: #f8f8fb;
  border-radius: 10px;
  padding: 12px 14px;
}
.mock-section-name {
  font-weight: 500;
  font-size: 14px;
  display: block;
  margin-bottom: 4px;
}
.mock-section-meta {
  font-size: 12px;
  color: #5f5e5a;
}
.mock-tip {
  background: #eeedfe;
  color: #3c3489;
  border-radius: 8px;
  padding: 12px 14px;
  font-size: 13px;
  margin-bottom: 20px;
}
.mock-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

.mock-exam-body {
  display: flex;
  flex-direction: column;
  height: 70vh;
}
.mock-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 18px;
  border-bottom: 0.5px solid #eeedfe;
  background: #f8f8fb;
}
.mock-title {
  font-size: 15px;
  font-weight: 500;
  color: #26215c;
  display: flex;
  align-items: center;
  gap: 10px;
}
.mock-section-label {
  color: #fff;
  font-size: 12px;
  padding: 2px 8px;
  border-radius: 4px;
}
.mock-timer {
  font-size: 20px;
  font-weight: 500;
  color: #534ab7;
  font-variant-numeric: tabular-nums;
}
.mock-timer.urgent {
  color: #a32d2d;
}

.mock-main {
  display: grid;
  grid-template-columns: 220px 1fr;
  flex: 1;
  min-height: 0;
}
.mock-side {
  border-right: 0.5px solid #eeedfe;
  padding: 14px;
  overflow-y: auto;
  background: #fff;
}
.mock-side-title {
  font-weight: 500;
  color: #26215c;
  margin-bottom: 12px;
}
.mock-side-group {
  margin-bottom: 14px;
}
.mock-side-group-title {
  font-size: 13px;
  font-weight: 500;
  margin-bottom: 6px;
}
.mock-side-questions {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.mock-side-q {
  width: 28px;
  height: 28px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  border: 0.5px solid #cecbf6;
  background: #fff;
  color: #444441;
  cursor: pointer;
}
.mock-side-q.active {
  background: #534ab7;
  color: #fff;
  border-color: #534ab7;
}
.mock-side-q.answered {
  background: #e1f5ee;
  border-color: #0f6e56;
  color: #0f6e56;
}
.mock-side-q.answered.active {
  background: #0f6e56;
  color: #fff;
}

.mock-question-area {
  padding: 18px 22px;
  overflow-y: auto;
  background: #f8f8fb;
}
.mock-progress {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 13px;
  color: #5f5e5a;
  margin-bottom: 14px;
}
.mock-progress-bar {
  flex: 1;
  height: 6px;
  background: #eeedfe;
  border-radius: 3px;
  overflow: hidden;
}
.mock-progress-bar span {
  display: block;
  height: 100%;
  background: #534ab7;
  transition: width 0.2s;
}

.mock-question-card {
  background: #fff;
  border: 0.5px solid #cecbf6;
  border-radius: 12px;
  padding: 18px;
  min-height: 280px;
}
.mock-q-type {
  font-size: 13px;
  font-weight: 500;
  margin-bottom: 10px;
}
.mock-passage {
  background: #f8f8fb;
  border-radius: 8px;
  padding: 12px;
  font-size: 14px;
  line-height: 1.8;
  color: #26215c;
  margin-bottom: 14px;
  white-space: pre-wrap;
}
.mock-stem {
  font-size: 15px;
  color: #26215c;
  line-height: 1.7;
  margin-bottom: 18px;
}
.mock-options {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.mock-option {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 12px 14px;
  border: 0.5px solid #cecbf6;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.15s;
}
.mock-option:hover {
  background: #f8f8fb;
}
.mock-option.selected {
  border-color: #534ab7;
  background: #eeedfe;
}
.mock-option-letter {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: #f8f8fb;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  font-weight: 500;
  color: #534ab7;
  flex-shrink: 0;
}
.mock-option.selected .mock-option-letter {
  background: #534ab7;
  color: #fff;
}
.mock-option-text {
  font-size: 14px;
  color: #26215c;
  line-height: 1.5;
  padding-top: 2px;
}
.mock-subjective {
  margin-bottom: 10px;
}
.mock-nav {
  display: flex;
  justify-content: space-between;
  margin-top: 18px;
}

.mock-report {
  padding: 24px;
}
.mock-report-head {
  text-align: center;
  margin-bottom: 22px;
}
.mock-report-head h3 {
  margin: 0 0 10px;
  font-size: 18px;
  color: #26215c;
}
.mock-score {
  display: flex;
  align-items: baseline;
  justify-content: center;
  gap: 6px;
}
.mock-score-num {
  font-size: 48px;
  font-weight: 500;
  color: #534ab7;
}
.mock-score-total {
  font-size: 16px;
  color: #5f5e5a;
}
.mock-time {
  font-size: 13px;
  color: #5f5e5a;
  margin-top: 6px;
}
.mock-report-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 12px;
  margin-bottom: 22px;
}
.mock-report-card {
  background: #f8f8fb;
  border-radius: 10px;
  padding: 14px;
  text-align: center;
}
.mock-report-name {
  font-size: 14px;
  font-weight: 500;
  margin-bottom: 6px;
}
.mock-report-score {
  font-size: 18px;
  font-weight: 500;
  color: #26215c;
  margin-bottom: 4px;
}
.mock-report-rate {
  font-size: 12px;
  color: #5f5e5a;
}
.mock-report-manual {
  font-size: 11px;
  color: #854f0b;
  margin-top: 4px;
}

.mock-report-wrongs h4 {
  margin: 0 0 12px;
  font-size: 16px;
  color: #26215c;
}
.mock-wrong-item {
  background: #fff;
  border: 0.5px solid #eeedfe;
  border-radius: 10px;
  padding: 14px;
  margin-bottom: 10px;
}
.mock-wrong-head {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  font-size: 13px;
  margin-bottom: 8px;
}
.mock-wrong-answer {
  color: #a32d2d;
}
.mock-wrong-correct {
  color: #0f6e56;
}
.mock-wrong-stem {
  font-size: 14px;
  color: #26215c;
  margin-bottom: 8px;
  line-height: 1.6;
}
.mock-wrong-exp {
  font-size: 12px;
  color: #5f5e5a;
  line-height: 1.6;
  background: #f8f8fb;
  border-radius: 6px;
  padding: 10px;
}

@media (max-width: 768px) {
  .mock-exam-dialog :deep(.el-dialog) {
    width: 100% !important;
    margin: 0 !important;
    border-radius: 0 !important;
  }
  .mock-exam-dialog :deep(.el-dialog__body) {
    max-height: calc(100vh - 60px);
  }
  .mock-main {
    grid-template-columns: 1fr;
    grid-template-rows: auto 1fr;
  }
  .mock-side {
    border-right: none;
    border-bottom: 0.5px solid #eeedfe;
    max-height: 160px;
  }
  .mock-side-questions {
    flex-wrap: nowrap;
    overflow-x: auto;
  }
  .mock-exam-body {
    height: calc(100vh - 120px);
  }
  .mock-sections {
    grid-template-columns: 1fr;
  }
}
</style>