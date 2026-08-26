<template>
  <div class="q">
    <h2 class="q-title">自适应出题</h2>
    <p class="q-sub">按记忆曲线加权抽题：薄弱 / 连错 / 到期词优先，已掌握词降权。零 API、免费、离线可用。</p>

    <!-- 设置 -->
    <div v-if="phase === 'setup'" class="q-setup">
      <div class="q-field">
        <span class="q-label">题目数量</span>
        <el-radio-group v-model="count">
          <el-radio-button :value="5">5</el-radio-button>
          <el-radio-button :value="10">10</el-radio-button>
          <el-radio-button :value="20">20</el-radio-button>
        </el-radio-group>
      </div>
      <div class="q-field">
        <span class="q-label">题型</span>
        <el-radio-group v-model="mode">
          <el-radio-button value="wordToDef">看单词选释义</el-radio-button>
          <el-radio-button value="defToWord">看释义选单词</el-radio-button>
        </el-radio-group>
      </div>
      <el-button type="primary" size="large" round @click="start" :disabled="!ready">开始答题</el-button>
      <p v-if="!ready" class="q-hint">词库加载中…</p>
    </div>

    <!-- 答题 -->
    <div v-else-if="phase === 'quiz'" class="q-card">
      <div class="q-card-top">
        <span>第 {{ idx + 1 }} / {{ quiz.length }} 题</span>
        <span>答对 <b>{{ correctCount }}</b></span>
      </div>
      <div class="q-progress"><div class="q-progress-bar" :style="{ width: ((idx) / quiz.length) * 100 + '%' }" /></div>

      <div class="q-prompt">
        <span class="q-emoji">{{ emoji }}</span>
        <span class="q-word">{{ current.prompt }}</span>
        <el-button
          v-if="current.phonetic"
          :icon="Microphone"
          circle
          size="small"
          :loading="speaking"
          @click="speak(current.word)"
          title="朗读"
        />
      </div>

      <div class="q-choices">
        <button
          v-for="(c, i) in current.choices"
          :key="i"
          class="q-choice"
          :class="choiceClass(i)"
          :disabled="answered"
          @click="choose(i)"
        >
          {{ c }}
        </button>
      </div>

      <div v-if="answered" class="q-feedback" :class="isCorrect ? 'ok' : 'no'">
        {{ isCorrect ? '✓ 回答正确' : '✗ 正确答案：' + current.definition }}
      </div>

      <div class="q-actions">
        <el-button v-if="!answered" type="primary" @click="reveal">直接看答案</el-button>
        <el-button v-else-if="idx < quiz.length - 1" type="primary" @click="next">下一题</el-button>
        <el-button v-else type="success" @click="finish">查看结果</el-button>
      </div>
    </div>

    <!-- 结果 -->
    <div v-else class="q-result">
      <el-result
        :icon="correctCount === quiz.length ? 'success' : 'info'"
        :title="`${correctCount} / ${quiz.length} 正确`"
        :sub-title="accuracyTip"
      >
        <template #extra>
          <el-button type="primary" @click="reset">再来一组</el-button>
          <el-button @click="goBack">返回词库</el-button>
        </template>
      </el-result>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { Microphone } from '@element-plus/icons-vue'
import { loadWords } from '../../../prep/degreeDb'
import * as svc from '../../../prep/degreeService'
import { reviewWord, type SrsGrade } from '../../../prep/degreeSrs'
import { buildQuiz, type QuizItem, type QuizMode } from '../../../prep/adaptiveQuiz'
import { useSpeech } from '../../../composables/useSpeech'
import { useEmoji } from '../../../composables/useEmoji'
import type { DegreeWord, WordProgress } from '../../../prep/degreeTypes'

const router = useRouter()
const { speak, speaking } = useSpeech()

const ready = ref(false)
const phase = ref<'setup' | 'quiz' | 'done'>('setup')
const count = ref(10)
const mode = ref<QuizMode>('wordToDef')
const quiz = ref<QuizItem[]>([])
const idx = ref(0)
const selected = ref<number | null>(null)
const answered = ref(false)
const correctCount = ref(0)

const current = computed<QuizItem>(() => quiz.value[idx.value] ?? ({ word: '', prompt: '', choices: [], answerIndex: 0, definition: '' }))
const isCorrect = computed(() => answered.value && selected.value === current.value.answerIndex)
const emoji = useEmoji(() => current.value?.word ?? '')

const accuracyTip = computed(() => {
  const rate = quiz.value.length ? Math.round((correctCount.value / quiz.value.length) * 100) : 0
  if (rate >= 90) return '掌握得不错，保持节奏！'
  if (rate >= 60) return '有提升空间，多复习薄弱词。'
  return '建议回到「记忆复习」巩固基础。'
})

onMounted(async () => {
  try {
    await svc.loadWordProgress() // 预热进度缓存
    ready.value = true
  } catch {
    ready.value = true
  }
})

async function start() {
  try {
    const [words, progress] = await Promise.all([loadWords(), svc.loadWordProgress()])
    if (!words.length) return
    quiz.value = buildQuiz(words as DegreeWord[], progress as Record<string, WordProgress>, {
      count: count.value,
      mode: mode.value
    })
    idx.value = 0
    selected.value = null
    answered.value = false
    correctCount.value = 0
    phase.value = 'quiz'
  } catch {
    /* degreeDb 已兜底 */
  }
}

function choose(i: number) {
  if (answered.value) return
  selected.value = i
  answered.value = true
  if (i === current.value.answerIndex) correctCount.value++
  recordSrs(i === current.value.answerIndex)
}

// 选项高亮：答对→绿，选错→红（仅作答后展示）
function choiceClass(i: number) {
  if (!answered.value) return ''
  if (i === current.value.answerIndex) return 'correct'
  if (selected.value === i) return 'wrong'
  return ''
}

function reveal() {
  if (answered.value) return
  selected.value = current.value.answerIndex
  answered.value = true
  recordSrs(false)
}

async function recordSrs(correct: boolean) {
  const w = current.value.word
  if (!w) return
  const prog = await svc.loadWordProgress()
  const p = prog[w]
  const grade: SrsGrade = correct ? 'good' : 'again'
  const next = reviewWord(p, grade)
  await svc.saveWordProgress(w, next)
}

function next() {
  idx.value++
  selected.value = null
  answered.value = false
}

function finish() {
  phase.value = 'done'
}

function reset() {
  phase.value = 'setup'
}

function goBack() {
  router.push('/degree/words')
}
</script>

<style scoped>
.q {
  max-width: 760px;
  margin: 0 auto;
  padding: 16px;
}
.q-title {
  margin: 0 0 4px;
  font-size: 20px;
  font-weight: 700;
  color: #2c2c3a;
}
.q-sub {
  margin: 0 0 16px;
  color: #8a8aa0;
  font-size: 13px;
}
.q-setup {
  background: #fff;
  border: 1px solid #eceaff;
  border-radius: 14px;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  align-items: flex-start;
}
.q-field {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.q-label {
  font-size: 13px;
  font-weight: 600;
  color: #6a6a80;
}
.q-hint {
  color: #a0a0b4;
  font-size: 12px;
  margin: 0;
}
.q-card {
  background: #fff;
  border: 1px solid #eceaff;
  border-radius: 16px;
  padding: 22px 20px;
  box-shadow: 0 6px 20px rgba(83, 74, 183, 0.06);
}
.q-card-top {
  display: flex;
  justify-content: space-between;
  font-size: 13px;
  color: #8a8aa0;
  margin-bottom: 10px;
}
.q-card-top b {
  color: #534ab7;
}
.q-progress {
  height: 6px;
  background: #eceaff;
  border-radius: 999px;
  overflow: hidden;
  margin-bottom: 18px;
}
.q-progress-bar {
  height: 100%;
  background: linear-gradient(90deg, #534ab7, #7f77dd);
  transition: width 0.25s;
}
.q-prompt {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  margin-bottom: 18px;
}
.q-emoji {
  font-size: 30px;
}
.q-word {
  font-size: 24px;
  font-weight: 800;
  color: #2c2c3a;
}
.q-choices {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}
.q-choice {
  text-align: left;
  padding: 14px 16px;
  border: 1px solid #e3e0f7;
  border-radius: 12px;
  background: #fafaff;
  font-size: 15px;
  color: #2c2c3a;
  cursor: pointer;
  transition: 0.15s;
  min-height: 52px;
}
.q-choice:hover:not(:disabled) {
  border-color: #534ab7;
  background: #fff;
}
.q-choice:disabled {
  cursor: default;
}
.q-choice.correct {
  border-color: #2e9e5b;
  background: #e7f6ed;
  color: #1f7a44;
  font-weight: 700;
}
.q-choice.wrong {
  border-color: #e0492f;
  background: #fdecea;
  color: #b5371f;
}
.q-feedback {
  margin-top: 14px;
  font-size: 14px;
  font-weight: 600;
}
.q-feedback.ok {
  color: #1f7a44;
}
.q-feedback.no {
  color: #b5371f;
}
.q-actions {
  display: flex;
  gap: 10px;
  margin-top: 18px;
  justify-content: flex-end;
}
@media (max-width: 768px) {
  .q-choices {
    grid-template-columns: 1fr;
  }
  .q-word {
    font-size: 21px;
  }
  .q-actions .el-button {
    flex: 1;
  }
}
</style>
