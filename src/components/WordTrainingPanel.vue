<template>
  <div class="wtp">
    <div class="wtp-head">
      <el-button text :icon="ArrowLeft" @click="emit('close')">返回</el-button>
      <span class="wtp-title">{{ titleText }}</span>
      <span></span>
    </div>

    <!-- 学习统计：今日任务一目了然 -->
    <div class="wtp-stats">
      <div class="wtp-stat">
        <span class="wtp-stat-label">今日新词</span>
        <span class="wtp-stat-val blue">{{ stats.newToday }}</span>
      </div>
      <div class="wtp-stat">
        <span class="wtp-stat-label">待复习</span>
        <span class="wtp-stat-val orange">{{ stats.due }}</span>
      </div>
      <div class="wtp-stat">
        <span class="wtp-stat-label">已掌握</span>
        <span class="wtp-stat-val green">{{ stats.graduated }}</span>
      </div>
      <div class="wtp-stat">
        <span class="wtp-stat-label">词库总量</span>
        <span class="wtp-stat-val purple">{{ stats.total }}</span>
      </div>
    </div>

    <el-tabs v-model="innerMode" class="wtp-tabs" type="border-card">
      <el-tab-pane label="闪卡" name="flash" />
      <el-tab-pane label="听写" name="dictation" />
      <el-tab-pane label="拼写" name="spelling" />
      <el-tab-pane label="跟读" name="shadow" />
      <el-tab-pane v-if="props.source !== 'cet'" label="翻译" name="translate" />
    </el-tabs>

    <div v-if="innerMode !== 'translate'" class="wtp-progress">
      <span>
        进度 {{ queue.length ? idx + 1 : 0 }} / {{ queue.length || 1 }}
        <small v-if="sessionReviewed">（本次已学 {{ sessionReviewed }} 词）</small>
      </span>
      <el-button text :icon="Refresh" @click="shuffleQueue">换一个顺序</el-button>
    </div>
    <div v-else class="wtp-progress">
      <span>进度 {{ idx + 1 }} / {{ transDeck.length || 1 }}</span>
    </div>

    <el-card v-if="innerMode !== 'translate'" class="wtp-card" shadow="never">
      <template v-if="loadingItems || loadingProgress">
        <div class="wtp-loading">加载词库与进度…</div>
      </template>
      <template v-else-if="!queue.length">
        <el-empty :description="completionText" />
        <div class="wtp-actions">
          <el-button type="primary" :icon="Refresh" @click="rebuildQueue(true)">再来一轮</el-button>
          <el-button @click="emit('close')">返回</el-button>
        </div>
      </template>
      <template v-else>
        <!-- 闪卡 -->
        <template v-if="innerMode === 'flash'">
          <div class="wtp-front">{{ current.word || '暂无单词' }}</div>
          <div v-if="current.kind === 'phrase'" class="wtp-tag">词组 / 搭配</div>
          <div v-if="revealed && current.definition" class="wtp-back">
            <div><b>释义：</b>{{ current.definition }}</div>
            <div v-if="current.phonetic" class="wtp-phon">/{{ current.phonetic }}/</div>
          </div>
          <div v-else-if="revealed && !current.definition" class="wtp-back">（暂无释义）</div>
          <div class="wtp-actions">
            <el-button :icon="Microphone" @click="speak(current.word)">朗读</el-button>
            <el-button v-if="!revealed" type="primary" @click="revealed = true">显示释义</el-button>
            <template v-else>
              <el-button type="danger" @click="gradeCurrent('again')">忘记</el-button>
              <el-button type="primary" @click="gradeCurrent('good')">认识</el-button>
              <el-button type="success" @click="gradeCurrent('easy')">简单</el-button>
            </template>
          </div>
          <div v-if="lastSchedule" class="wtp-schedule">{{ lastSchedule }}</div>
        </template>

        <!-- 听写 -->
        <template v-else-if="innerMode === 'dictation'">
          <div class="wtp-hint">听音频，写出单词拼写：</div>
          <div class="wtp-actions">
            <el-button :icon="Microphone" type="primary" @click="speak(current.word)">播放读音</el-button>
          </div>
          <el-input v-model="answer" placeholder="在此输入单词" class="wtp-input" @keyup.enter="check" />
          <div v-if="checked" class="wtp-feedback" :class="correct ? 'ok' : 'bad'">
            {{ correct ? '正确！' : '正确答案：' + current.word }}
          </div>
          <div class="wtp-actions" v-if="checked">
            <el-button type="primary" @click="afterCheck(true)">下一个</el-button>
          </div>
        </template>

        <!-- 拼写 -->
        <template v-else-if="innerMode === 'spelling'">
          <div class="wtp-hint">根据释义写出单词：</div>
          <div class="wtp-def">{{ current.definition }}</div>
          <el-input v-model="answer" placeholder="在此输入单词" class="wtp-input" @keyup.enter="check" />
          <div v-if="checked" class="wtp-feedback" :class="correct ? 'ok' : 'bad'">
            {{ correct ? '正确！' : '正确答案：' + current.word }}
            <span v-if="current.phonetic"> /{{ current.phonetic }}/</span>
          </div>
          <div class="wtp-actions" v-if="checked">
            <el-button type="primary" @click="afterCheck(true)">下一个</el-button>
          </div>
        </template>

        <!-- 跟读 -->
        <template v-else-if="innerMode === 'shadow'">
          <div class="wtp-front">{{ current.word || '暂无单词' }}</div>
          <div class="wtp-def">{{ current.definition }}</div>
          <div class="wtp-actions">
            <el-button :icon="Microphone" type="primary" @click="speak(current.word)">听音</el-button>
            <el-button type="success" @click="gradeCurrent('good')">已跟读，下一个</el-button>
            <el-button @click="gradeCurrent('again')">不熟悉，再练</el-button>
          </div>
        </template>
      </template>
    </el-card>

    <!-- 翻译（仅学位英语，按句子顺序，不参与 SRS） -->
    <el-card v-else class="wtp-card" shadow="never">
      <div class="wtp-hint">将下列英文翻译为中文：</div>
      <div class="wtp-sentence">{{ currentTrans?.stem || '暂无句子' }}</div>
      <el-input v-model="answer" type="textarea" :rows="2" placeholder="在此输入中文翻译" class="wtp-input" />
      <div v-if="checked" class="wtp-feedback">
        <div class="wtp-ref">参考译文：{{ currentTrans?.answer }}</div>
      </div>
      <div class="wtp-actions">
        <el-button @click="revealRef">看参考</el-button>
        <el-button type="primary" @click="nextTranslate">下一个</el-button>
      </div>
    </el-card>

    <el-empty
      v-if="!loadingItems && innerMode !== 'translate' && !queue.length && !items.length"
      :description="emptyText"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { Microphone, Refresh, ArrowLeft } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { loadWords, loadPhrases } from '../prep/degreeDb'
import { allDegreeQuestions } from '../prep/degreeQuestionBank'
import { speakEn } from '../prep/degreeSpeech'
import { MASTER_WORDS_BUNDLE } from '../prep/masterWordsBundle'
import { CET6_WORDS_BUNDLE } from '../prep/cet6WordsBundle'
import { loadCetProgress, saveCetProgress, type CetWordProgress } from '../services/cetProgressService'
import {
  loadLearnWordProgress,
  saveLearnWordProgress
} from '../services/learnWordProgressService'
import {
  reviewWord,
  buildReviewQueue,
  todayStr,
  type SrsGrade
} from '../prep/trainingSrs'
import {
  getStudySettings,
  saveStudySettings,
  bumpStreak,
  bumpTodayLearned,
  type StudyModule
} from '../services/studySettingsService'
import type { DegreeWord, DegreePhrase, DegreeQuestion, WordProgress } from '../prep/degreeTypes'
import type { PrepWord } from '../services/cetPrepService'

interface TrainItem {
  word: string
  definition: string
  phonetic?: string
  kind: 'word' | 'phrase'
  category?: string
}

const props = defineProps<{
  mode: 'flash' | 'dictation' | 'spelling' | 'shadow' | 'translate'
  source?: 'degree' | 'cet'
  cetLevel?: 'cet4' | 'cet6'
  /** 仅复习今日到期词（不引入新词）。 */
  reviewOnly?: boolean
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'mode-change', mode: string): void
}>()

const validModes = ['flash', 'dictation', 'spelling', 'shadow', 'translate'] as const
const innerMode = ref<'flash' | 'dictation' | 'spelling' | 'shadow' | 'translate'>(props.mode)
watch(() => props.mode, (v) => { if (validModes.includes(v as any)) innerMode.value = v })
watch(innerMode, (v) => emit('mode-change', v))

const items = ref<TrainItem[]>([])
const progress = ref<Record<string, WordProgress | CetWordProgress>>({})
const queue = ref<TrainItem[]>([])
const idx = ref(0)
const loadingItems = ref(false)
const loadingProgress = ref(false)
const revealed = ref(false)
const answer = ref('')
const checked = ref(false)
const correct = ref(false)
const sessionReviewed = ref(0)
const lastSchedule = ref('')
const newPerDay = ref(15)
// 已掌握词回流开关（来自模块独立设置，不串）
const graduatedReturn = ref(false)
// 当前模块 key（用于连续学习天数记录）：学习中心背单词卡=learn，四六级=cet
const moduleKey = computed<StudyModule>(() => (props.source === 'cet' ? 'cet' : 'learn'))

const titleText = computed(() => {
  const suffix = props.reviewOnly ? ' · 待复习' : ''
  if (props.source === 'cet') return (props.cetLevel === 'cet6' ? '六级单词卡训练' : '四级单词卡训练') + suffix
  return '背单词卡训练' + suffix
})
const emptyText = computed(() => {
  if (props.source === 'cet' && props.cetLevel === 'cet6') return '六级词库待补充：将免费六级词表放入 scripts/cet6_words.csv 后运行生成脚本'
  return '该词库暂无数据'
})
const completionText = computed(() => {
  return props.source === 'cet'
    ? '本轮四六级单词已学完，明天会来复习到期词'
    : '本轮单词/词组已学完，明天会来复习到期词'
})

const transDeck = computed<DegreeQuestion[]>(() =>
  allDegreeQuestions.filter((q) => q.type === 'translation')
)
const current = computed<TrainItem>(() => {
  const d = queue.value
  if (!d.length) return { word: '', definition: '', kind: 'word' }
  return d[idx.value] ?? { word: '', definition: '', kind: 'word' }
})
const currentTrans = computed<DegreeQuestion | null>(() =>
  transDeck.value[idx.value % Math.max(transDeck.value.length, 1)] || null
)

const stats = computed(() => {
  const today = todayStr()
  let graduated = 0, learning = 0, due = 0, fresh = 0
  for (const item of items.value) {
    const p = progress.value[item.word]
    if (!p) {
      fresh++
    } else if (p.status === 'graduated') {
      graduated++
    } else {
      learning++
      if ((p.due ?? today) <= today) due++
    }
  }
  const newToday = Math.min(fresh, newPerDay.value)
  return {
    total: items.value.length,
    due, // 仅今日到期复习（不含新词）
    graduated,
    newToday
  }
})

function wordToTrain(w: DegreeWord): TrainItem {
  return { word: w.word, definition: w.definition, phonetic: w.phonetic, kind: 'word' }
}
function phraseToTrain(p: DegreePhrase): TrainItem {
  return {
    word: 'ph:' + p.en,
    definition: p.zh || p.extra || '（口语/词缀，无固定中文释义）',
    phonetic: '',
    kind: 'phrase',
    category: p.category
  }
}
function prepToTrain(p: PrepWord): TrainItem {
  const def = p[3] + (p[4] ? '（常考搭配：' + p[4] + '）' : '')
  return { word: p[0], definition: def, phonetic: p[1], kind: 'word' }
}

async function loadItems(): Promise<void> {
  loadingItems.value = true
  try {
    if (props.source === 'cet') {
      const bundle = (props.cetLevel === 'cet6' ? CET6_WORDS_BUNDLE : MASTER_WORDS_BUNDLE) as PrepWord[]
      items.value = bundle.map(prepToTrain)
    } else {
      // 学习中心背单词卡 = 单词 ONLY（与词组模块严格隔离，不混为一起）
      const w = await loadWords()
      items.value = w.map(wordToTrain)
    }
  } catch {
    items.value = []
  }
  loadingItems.value = false
}

async function loadProgress(): Promise<void> {
  loadingProgress.value = true
  try {
    if (props.source === 'cet') {
      progress.value = await loadCetProgress(props.cetLevel || 'cet4')
      const s = getStudySettings('cet')
      newPerDay.value = s.newPerDay
      graduatedReturn.value = s.graduatedReturn
    } else {
      progress.value = await loadLearnWordProgress()
      const s = getStudySettings('learn')
      newPerDay.value = s.newPerDay
      graduatedReturn.value = s.graduatedReturn
    }
  } catch {
    progress.value = {}
  }
  loadingProgress.value = false
}

function rebuildQueue(_forceNew = false) {
  if (innerMode.value === 'translate') return
  // 干净重建：直接基于当前已落库进度重新排队列（不再伪造 due 到今天）。
  // 本轮已评分的词已通过 saveProgress 落库，rebuild 后会正确按最新 due 重新入队。
  queue.value = buildReviewQueue(items.value, progress.value as Record<string, WordProgress>, {
    newPerDay: newPerDay.value,
    dueOnly: props.reviewOnly,
    includeGraduated: graduatedReturn.value
  })
  idx.value = 0
  sessionReviewed.value = 0
  lastSchedule.value = ''
}

function shuffleQueue() {
  if (innerMode.value === 'translate') return
  queue.value = buildReviewQueue(items.value, progress.value as Record<string, WordProgress>, {
    newPerDay: newPerDay.value,
    dueOnly: props.reviewOnly,
    includeGraduated: graduatedReturn.value
  })
  idx.value = 0
  lastSchedule.value = ''
  ElMessage.info('已重新排序')
}

function reset() {
  revealed.value = false
  answer.value = ''
  checked.value = false
  correct.value = false
}

function speak(w: string) {
  if (w) speakEn(w)
}

async function saveProgress(word: string, p: WordProgress | CetWordProgress) {
  progress.value = { ...progress.value, [word]: p }
  if (props.source === 'cet') {
    await saveCetProgress(props.cetLevel || 'cet4', word, p as CetWordProgress)
  } else {
    await saveLearnWordProgress(word, p as WordProgress)
  }
}

function scheduleText(word: string, p: WordProgress | CetWordProgress): string {
  if (p.status === 'graduated') return `「${word}」已掌握`
  if (!p.due) return `「${word}」本轮继续复习`
  const days = Math.round((new Date(p.due + 'T00:00:00Z').getTime() - new Date(todayStr() + 'T00:00:00Z').getTime()) / 86400000)
  return `「${word}」${days <= 0 ? '今天' : days + ' 天后'}再次复习`
}

async function gradeCurrent(grade: SrsGrade) {
  const w = current.value
  if (!w.word) return
  const prev = progress.value[w.word]
  const next = reviewWord(prev as WordProgress | undefined, grade)
  await saveProgress(w.word, next)
  bumpStreak(moduleKey.value)
  if (!prev || prev.status === 'new') bumpTodayLearned(moduleKey.value)
  sessionReviewed.value++
  lastSchedule.value = scheduleText(w.word, next)
  // 遗忘：本轮队尾再练一次；其它：正常出队
  if (grade === 'again') {
    queue.value.push(w)
  }
  queue.value.splice(idx.value, 1)
  reset()
  if (idx.value >= queue.value.length) idx.value = 0
}

function check() {
  checked.value = true
  correct.value = answer.value.trim().toLowerCase() === current.value.word.trim().toLowerCase()
}

async function afterCheck(autoNext = true) {
  if (!checked.value) return
  const w = current.value
  if (!w.word) return
  const grade: SrsGrade = correct.value ? 'good' : 'again'
  const prev = progress.value[w.word]
  const next = reviewWord(prev as WordProgress | undefined, grade)
  await saveProgress(w.word, next)
  bumpStreak(moduleKey.value)
  if (!prev || prev.status === 'new') bumpTodayLearned(moduleKey.value)
  sessionReviewed.value++
  lastSchedule.value = scheduleText(w.word, next)
  if (grade === 'again') {
    queue.value.push(w)
  }
  queue.value.splice(idx.value, 1)
  reset()
  if (idx.value >= queue.value.length) idx.value = 0
}

function revealRef() {
  checked.value = true
}

function nextTranslate() {
  idx.value = (idx.value + 1) % Math.max(transDeck.value.length, 1)
  reset()
}

watch(innerMode, () => {
  reset()
  if (innerMode.value !== 'translate') rebuildQueue()
  else idx.value = 0
})

watch(() => [props.source, props.cetLevel], async () => {
  reset()
  await loadItems()
  await loadProgress()
  rebuildQueue()
})

onMounted(async () => {
  await loadItems()
  await loadProgress()
  rebuildQueue()
})
</script>

<style scoped>
.wtp { padding: 4px 0; }
.wtp-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; }
.wtp-title { font-size: 16px; font-weight: 700; color: var(--text-strong); }
.wtp-stats {
  display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px;
  margin-bottom: 14px;
}
.wtp-stat {
  background: var(--surface); border: 1px solid var(--border); border-radius: 10px;
  padding: 10px 8px; text-align: center;
}
.wtp-stat-label { display: block; font-size: 12px; color: var(--text-muted); margin-bottom: 4px; }
.wtp-stat-val { font-size: 18px; font-weight: 700; }
.wtp-stat-val.blue { color: #0ea5e9; }
.wtp-stat-val.orange { color: #f59e0b; }
.wtp-stat-val.green { color: #2e9e6b; }
.wtp-stat-val.purple { color: #534ab7; }
.wtp-tabs { margin-bottom: 12px; }
.wtp-progress {
  display: flex; justify-content: space-between; align-items: center;
  font-size: 13px; color: var(--text-muted); margin-bottom: 10px;
}
.wtp-loading { text-align: center; color: var(--text-muted); padding: 40px 0; }
.wtp-card {
  border-radius: 12px; min-height: 240px;
  display: flex; flex-direction: column; justify-content: center;
}
.wtp-front {
  font-size: 30px; font-weight: 700; color: #534ab7;
  text-align: center; margin-bottom: 12px;
}
.wtp-back {
  text-align: center; color: var(--text); font-size: 15px; margin-bottom: 12px;
}
.wtp-phon { color: var(--text-faint); font-size: 13px; margin-top: 4px; }
.wtp-tag {
  display: inline-block; margin: 0 auto 12px; font-size: 12px; color: #0891b2;
  border: 1px solid #0891b2; border-radius: 6px; padding: 1px 8px; width: fit-content;
}
.wtp-hint { text-align: center; color: var(--text-muted); font-size: 14px; margin-bottom: 10px; }
.wtp-def { text-align: center; color: var(--text-strong); font-size: 16px; margin: 8px 0; }
.wtp-sentence {
  text-align: center; color: var(--text-strong); font-size: 17px;
  line-height: 1.6; margin: 8px 0 14px;
}
.wtp-input { margin: 10px auto; max-width: 420px; }
.wtp-actions {
  display: flex; gap: 10px; justify-content: center; flex-wrap: wrap; margin-top: 14px;
}
.wtp-feedback { text-align: center; margin-top: 10px; font-size: 14px; }
.wtp-feedback.ok { color: #2e9e6b; }
.wtp-feedback.bad { color: #b23b5b; }
.wtp-ref { color: var(--text-muted); }
.wtp-schedule { text-align: center; color: var(--text-muted); font-size: 12px; margin-top: 10px; }
@media (max-width: 640px) {
  .wtp-stats { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
</style>
