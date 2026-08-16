<template>
  <div class="dw-view">
    <header class="dw-hero">
      <div class="dw-hero-left">
        <span class="dw-hero-icon"><el-icon :size="22" color="#fff"><Odometer /></el-icon></span>
        <div class="dw-hero-text">
          <h2 class="dw-title">薄弱点分析</h2>
          <p class="dw-sub">整合错题本 · 专项练习 · 模拟考试 · 单词进度四维数据，定位最该补的地方，一键去攻克。</p>
        </div>
      </div>
      <el-button :icon="Refresh" :loading="loading" @click="load">重新分析</el-button>
    </header>

    <!-- 启发式声明 -->
    <div class="dw-note">
      <el-icon><Warning /></el-icon>
      <span>启发式诊断，非 AI 评级：基于你已记录的题型、错因、练习与模考本地统计，不调用任何模型，免费且不消费积分。</span>
    </div>

    <div v-if="loading" class="dw-state">分析中…</div>
    <div v-else-if="error" class="dw-state dw-err">{{ error }}</div>

    <template v-else>
      <!-- 概览 -->
      <section class="dw-card">
        <h3 class="dw-card-title">学习概览</h3>
        <div class="dw-ov-grid">
          <div class="dw-ov">
            <span class="dw-ov-label">错题总数</span>
            <span class="dw-ov-val">{{ mistakes.length }}</span>
            <span class="dw-ov-sub">需重点复盘</span>
          </div>
          <div class="dw-ov">
            <span class="dw-ov-label">练习正确率</span>
            <span class="dw-ov-val" :class="accClass(practiceAccuracy)">{{ practiceAccuracy }}%</span>
            <span class="dw-ov-sub">{{ practiceTotal }} 题已练</span>
          </div>
          <div class="dw-ov">
            <span class="dw-ov-label">模考正确率</span>
            <span class="dw-ov-val" :class="accClass(examAccuracy ?? 0)">{{ examAccuracy === null ? '—' : examAccuracy + '%' }}</span>
            <span class="dw-ov-sub">{{ examCount }} 次模考</span>
          </div>
          <div class="dw-ov">
            <span class="dw-ov-label">薄弱单词</span>
            <span class="dw-ov-val" :class="{ hot: weakWordCount > 0 }">{{ weakWordCount }}</span>
            <span class="dw-ov-sub">待强化记忆</span>
          </div>
        </div>
      </section>

      <!-- 维度一：专项练习 · 题型正确率矩阵 -->
      <section class="dw-card">
        <h3 class="dw-card-title">专项练习 · 题型正确率</h3>
        <div v-if="practiceTotal === 0" class="dw-muted">暂无练习记录，先去「专项练习」刷几组题。</div>
        <div v-for="it in practiceByType" :key="it.type" class="dw-bar-row">
          <span class="dw-bar-label">{{ it.label }}</span>
          <div class="dw-bar-track">
            <div class="dw-bar-fill" :class="accBarClass(it.accuracy)" :style="{ width: (it.accuracy ?? 0) + '%' }"></div>
          </div>
          <span class="dw-bar-num">
            {{ it.accuracy === null ? '—' : it.accuracy + '%' }}
            <em v-if="it.total">（{{ it.correct }}/{{ it.total }}）</em>
          </span>
        </div>
        <router-link
          class="dw-jump"
          :to="{ path: '/degree/practice', query: { type: weakestPracticeType } }"
        >
          去练习最薄弱题型：{{ typeLabelMap[weakestPracticeType] }} →
        </router-link>
      </section>

      <!-- 维度二：错题本归因 -->
      <section class="dw-card">
        <h3 class="dw-card-title">错题本归因</h3>
        <div v-if="mistakes.length === 0" class="dw-muted">暂无错题，继续保持！</div>
        <template v-else>
          <div v-if="!mistakeReport.enough" class="dw-warn">样本不足（&lt; {{ WEAKNESS_MIN_SAMPLE }} 条），结论仅供参考。</div>

          <h4 class="dw-sub-h">按题型分布</h4>
          <div v-for="it in mistakeReport.byType" :key="it.label" class="dw-bar-row">
            <span class="dw-bar-label">{{ typeLabelMap[it.label] || it.label }}</span>
            <div class="dw-bar-track"><div class="dw-bar-fill" :style="{ width: pct(it.count, maxMistakeType) }"></div></div>
            <span class="dw-bar-num">{{ it.count }} · {{ Math.round(it.ratio * 100) }}%</span>
          </div>

          <h4 class="dw-sub-h">常见错因 Top</h4>
          <div v-for="it in mistakeReport.byReason.slice(0, 6)" :key="it.label" class="dw-bar-row">
            <span class="dw-bar-label">{{ it.label }}</span>
            <div class="dw-bar-track"><div class="dw-bar-fill alt" :style="{ width: pct(it.count, maxMistakeReason) }"></div></div>
            <span class="dw-bar-num">{{ it.count }}</span>
          </div>

          <template v-if="mistakeReport.byQuestion.length">
            <h4 class="dw-sub-h">高频错题（按题）</h4>
            <div v-for="it in mistakeReport.byQuestion.slice(0, 8)" :key="it.label" class="dw-q-row">
              <span class="dw-q-label">{{ questionLabel(it.label) }}</span>
              <span class="dw-q-num">{{ it.count }} 次</span>
            </div>
          </template>

          <h4 class="dw-sub-h">错题趋势（按月）</h4>
          <div v-if="mistakeReport.trend.length === 0" class="dw-muted">暂无带时间的错题，无法绘制趋势。</div>
          <div v-for="t in mistakeReport.trend" :key="t.period" class="dw-bar-row">
            <span class="dw-bar-label">{{ t.period }}</span>
            <div class="dw-bar-track"><div class="dw-bar-fill alt" :style="{ width: pct(t.count, maxMistakeTrend) }"></div></div>
            <span class="dw-bar-num">{{ t.count }}</span>
          </div>
        </template>
      </section>

      <!-- 维度三：模拟考试 -->
      <section class="dw-card">
        <h3 class="dw-card-title">模拟考试概览</h3>
        <div v-if="examCount === 0" class="dw-muted">暂无模考记录，去「模拟考试」测一套全真卷。</div>
        <template v-else>
          <div class="dw-exam-summary">
            <span>累计 {{ examCount }} 套 · 共 {{ examTotal }} 题 · 对 {{ examCorrect }} 题</span>
            <strong :class="accClass(examAccuracy ?? 0)">总体正确率 {{ examAccuracy }}%</strong>
          </div>
          <h4 class="dw-sub-h">各卷正确率（由低到高）</h4>
          <div v-for="it in examByPaper" :key="it.paper" class="dw-bar-row">
            <span class="dw-bar-label" :title="it.paper">{{ it.paper }}</span>
            <div class="dw-bar-track"><div class="dw-bar-fill" :class="accBarClass(it.accuracy)" :style="{ width: it.accuracy + '%' }"></div></div>
            <span class="dw-bar-num">{{ it.accuracy }}% <em>（{{ it.correct }}/{{ it.total }}）</em></span>
          </div>
          <router-link v-if="weakestPaper" class="dw-jump" :to="{ path: '/degree/exam' }">
            最弱试卷：{{ weakestPaper.paper }}（{{ weakestPaper.accuracy }}%）→ 重做
          </router-link>
        </template>
      </section>

      <!-- 维度四：薄弱单词 -->
      <section class="dw-card">
        <h3 class="dw-card-title">薄弱单词 Top</h3>
        <div v-if="weakWords.length === 0" class="dw-muted">暂无标记薄弱的单词，背诵保持得不错！</div>
        <div v-else class="dw-word-grid">
          <div v-for="w in weakWords" :key="w.word" class="dw-word-chip" :class="{ hot: w.wrongStreak >= 3 }">
            <span class="dw-word-en">{{ w.word }}</span>
            <span class="dw-word-def">{{ w.def || '—' }}</span>
            <span class="dw-word-meta">错 {{ w.wrongStreak }} 次</span>
          </div>
        </div>
        <router-link v-if="weakWords.length" class="dw-jump" :to="{ path: '/degree/words' }">
          去生词词库复习薄弱项 →
        </router-link>
      </section>

      <!-- 行动建议 -->
      <section class="dw-card dw-action">
        <h3 class="dw-card-title">智能行动建议</h3>
        <ul class="dw-advice">
          <li v-if="weakestPracticeType && practiceTotal > 0">
            <el-icon><Aim /></el-icon>
            <span>你的 <b>{{ typeLabelMap[weakestPracticeType] }}</b> 正确率最低，建议优先在专项练习中集中突破。</span>
            <router-link :to="{ path: '/degree/practice', query: { type: weakestPracticeType } }">去练习 →</router-link>
          </li>
          <li v-if="weakestPaper">
            <el-icon><Medal /></el-icon>
            <span>模考最弱卷 <b>{{ weakestPaper.paper }}</b>（{{ weakestPaper.accuracy }}%），建议重做并分析失分点。</span>
            <router-link :to="{ path: '/degree/exam' }">去模考 →</router-link>
          </li>
          <li v-if="weakWordCount > 0">
            <el-icon><Notebook /></el-icon>
            <span>有 <b>{{ weakWordCount }}</b> 个薄弱单词需要强化记忆（连续答错或标记薄弱）。</span>
            <router-link :to="{ path: '/degree/words' }">去复习 →</router-link>
          </li>
          <li v-if="mistakes.length >= WEAKNESS_MIN_SAMPLE">
            <el-icon><Odometer /></el-icon>
            <span>错题主要集中在 <b>{{ topMistakeTypeLabel }}</b>，主因多为「{{ topMistakeReasonLabel }}」。</span>
          </li>
          <li v-if="practiceTotal === 0 && examCount === 0 && mistakes.length === 0 && weakWordCount === 0">
            <span>还没有足够的学习数据，先在「专项练习 / 模拟考试 / 生词词库」积累记录，系统会自动生成薄弱点画像。</span>
          </li>
        </ul>
      </section>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { Odometer, Refresh, Warning, Aim, Medal, Notebook } from '@element-plus/icons-vue'
import {
  loadMistakes,
  loadPractice,
  loadExamRecords,
  loadWordProgress,
  flushQueue
} from '../../../prep/degreeService'
import { loadWords } from '../../../prep/degreeDb'
import {
  buildWeaknessReport,
  WEAKNESS_MIN_SAMPLE,
  type WeaknessMistakeInput,
  type WeaknessReport
} from '../../../prep/weakness'
import { allDegreeQuestions } from '../../../prep/degreeQuestionBank'
import type { DegreeQuestion, QuestionType, WordProgress, ExamRecord, MistakeRec, PracticeRec, DegreeWord } from '../../../prep/degreeTypes'

const loading = ref(false)
const error = ref('')

const mistakes = ref<MistakeRec[]>([])
const practice = ref<PracticeRec[]>([])
const exams = ref<ExamRecord[]>([])
const wordProgress = ref<Record<string, WordProgress>>({})
const wordsMap = ref<Map<string, DegreeWord>>(new Map())

const typeOrder: QuestionType[] = ['vocab_grammar', 'dialogue', 'reading', 'translation', 'writing']
const typeLabelMap: Record<string, string> = {
  dialogue: '完成对话',
  reading: '阅读理解',
  vocab_grammar: '词汇语法',
  translation: '英译汉',
  writing: '短文写作'
}
const degreeQuestionMap = new Map<string, DegreeQuestion>(allDegreeQuestions.map((q) => [q.id, q]))

function questionLabel(id: string): string {
  const q = degreeQuestionMap.get(id)
  if (!q) return id
  const stem = (q.stem || '').replace(/\s+/g, ' ').slice(0, 20)
  return `[${typeLabelMap[q.type] || q.type}] ${stem}${stem.length >= 20 ? '…' : ''}`
}

// ---------- 维度一：练习正确率矩阵 ----------
const practiceByType = computed(() =>
  typeOrder.map((t) => {
    const recs = practice.value.filter((p) => p.type === t)
    const total = recs.reduce((s, p) => s + p.total, 0)
    const correct = recs.reduce((s, p) => s + p.correct, 0)
    return { type: t, label: typeLabelMap[t], total, correct, accuracy: total ? Math.round((correct / total) * 100) : null }
  })
)
const practiceTotal = computed(() => practice.value.reduce((s, p) => s + p.total, 0))
const practiceAccuracy = computed(() =>
  practiceTotal.value ? Math.round((practice.value.reduce((s, p) => s + p.correct, 0) / practiceTotal.value) * 100) : 0
)
const weakestPracticeType = computed<QuestionType>(() => {
  const candidates = practiceByType.value.filter((p) => p.total >= 3 && p.accuracy !== null)
  if (!candidates.length) return 'vocab_grammar'
  const sorted = candidates.slice().sort((a, b) => (a.accuracy as number) - (b.accuracy as number))
  return sorted[0]?.type ?? 'vocab_grammar'
})

// ---------- 维度二：错题归因 ----------
const mistakeReport = computed<WeaknessReport>(() =>
  buildWeaknessReport(
    mistakes.value.map((m) => ({
      type: m.type,
      reason: m.reason,
      questionId: m.questionId,
      createdAt: m.createdAt ?? null
    }))
  )
)
const maxMistakeType = computed(() => maxCount(mistakeReport.value.byType))
const maxMistakeReason = computed(() => maxCount(mistakeReport.value.byReason))
const maxMistakeTrend = computed(() => maxCount(mistakeReport.value.trend))
// 错因 Top 标签（供行动建议，避免模板内复杂索引）
const topMistakeTypeLabel = computed(() => {
  const l = mistakeReport.value.byType[0]?.label
  return (l && typeLabelMap[l]) || l || '—'
})
const topMistakeReasonLabel = computed(() => mistakeReport.value.byReason[0]?.label || '—')

// ---------- 维度三：模考 ----------
const examCount = computed(() => exams.value.length)
const examTotal = computed(() => exams.value.reduce((s, e) => s + e.total, 0))
const examCorrect = computed(() => exams.value.reduce((s, e) => s + e.correct, 0))
const examAccuracy = computed<number | null>(() => (examTotal.value ? Math.round((examCorrect.value / examTotal.value) * 100) : null))
const examByPaper = computed(() => {
  const map = new Map<string, { total: number; correct: number }>()
  for (const e of exams.value) {
    const k = e.paperId || '未命名卷'
    const cur = map.get(k) || { total: 0, correct: 0 }
    cur.total += e.total
    cur.correct += e.correct
    map.set(k, cur)
  }
  return Array.from(map.entries())
    .map(([paper, v]) => ({ paper, total: v.total, correct: v.correct, accuracy: v.total ? Math.round((v.correct / v.total) * 100) : 0 }))
    .sort((a, b) => a.accuracy - b.accuracy)
})
const weakestPaper = computed(() => examByPaper.value[0] || null)

// ---------- 维度四：薄弱单词 ----------
const weakWords = computed(() =>
  Object.entries(wordProgress.value)
    .map(([word, p]) => ({
      word,
      def: wordsMap.value.get(word)?.definition ?? '',
      weak: p.weak,
      wrongStreak: p.wrongStreak ?? 0
    }))
    .filter((w) => w.weak || w.wrongStreak >= 2)
    .sort((a, b) => b.wrongStreak - a.wrongStreak)
    .slice(0, 24)
)
const weakWordCount = computed(
  () => Object.values(wordProgress.value).filter((p) => p.weak || (p.wrongStreak ?? 0) >= 2).length
)

// ---------- 工具 ----------
function maxCount(items: { count: number }[]): number {
  return items.reduce((m, i) => Math.max(m, i.count), 0) || 1
}
function pct(count: number, max: number): string {
  return Math.round((count / max) * 100) + '%'
}
function accClass(v: number): string {
  if (v >= 80) return 'good'
  if (v >= 60) return 'mid'
  return 'low'
}
function accBarClass(v: number | null): string {
  if (v === null) return ''
  if (v >= 80) return 'good'
  if (v >= 60) return 'mid'
  return 'low'
}

async function load(): Promise<void> {
  loading.value = true
  error.value = ''
  try {
    await flushQueue()
    const [ms, pr, ex, wp, ws] = await Promise.all([
      loadMistakes(),
      loadPractice(),
      loadExamRecords(),
      loadWordProgress(),
      loadWords().catch(() => [] as DegreeWord[])
    ])
    mistakes.value = ms
    practice.value = pr
    exams.value = ex
    wordProgress.value = wp
    wordsMap.value = new Map((ws as DegreeWord[]).map((w) => [w.word, w]))
  } catch (e) {
    error.value = '加载学习数据失败：' + (e instanceof Error ? e.message : String(e))
  } finally {
    loading.value = false
  }
}

onMounted(load)
</script>

<style scoped>
.dw-view {
  max-width: 1000px;
  margin: 0 auto;
  padding: 16px;
}
.dw-hero {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: center;
  justify-content: space-between;
  background: linear-gradient(135deg, #534ab7, #3c3489);
  color: #fff;
  border-radius: 16px;
  padding: 18px 20px;
  margin-bottom: 14px;
}
.dw-hero-left { display: flex; align-items: center; gap: 12px; min-width: 0; }
.dw-hero-icon {
  width: 44px; height: 44px; border-radius: 12px; flex-shrink: 0;
  display: grid; place-items: center;
  background: rgba(255, 255, 255, 0.18);
}
.dw-hero-text { min-width: 0; }
.dw-title { margin: 0; font-size: 20px; font-weight: 800; }
.dw-sub { margin: 4px 0 0; font-size: 12.5px; opacity: 0.92; line-height: 1.5; max-width: 600px; }

.dw-note {
  display: flex; align-items: flex-start; gap: 8px;
  background: #f3f2ff; border: 1px solid #e6e3ff; border-radius: 12px;
  padding: 10px 12px; margin-bottom: 14px;
  font-size: 12.5px; color: #6a5acd; line-height: 1.5;
}
.dw-note :deep(svg) { color: #534ab7; margin-top: 2px; flex-shrink: 0; }

.dw-state { padding: 48px 16px; text-align: center; color: #8a8aa0; font-size: 14px; }
.dw-err { color: #b23b5b; }

.dw-card {
  background: #fff; border: 1px solid #eceaff;
  border-radius: 16px; padding: 16px; margin-bottom: 14px;
  box-shadow: 0 2px 10px rgba(83, 74, 183, 0.06);
}
.dw-card-title { margin: 0 0 14px; font-size: 16px; font-weight: 700; color: #2c2c3a; }
.dw-sub-h { margin: 16px 0 10px; font-size: 13.5px; font-weight: 600; color: #4a4a5a; }
.dw-sub-h:first-of-type { margin-top: 4px; }
.dw-warn { margin: 0 0 12px; font-size: 12px; color: #d97706; }
.dw-muted { color: #9a9ab0; font-size: 13px; line-height: 1.6; }

.dw-ov-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 12px; }
.dw-ov { background: #f7f6ff; border: 1px solid #eceaff; border-radius: 12px; padding: 14px; }
.dw-ov-label { display: block; font-size: 12px; color: #8a8aa0; margin-bottom: 6px; }
.dw-ov-val { display: block; font-size: 26px; font-weight: 800; color: #534ab7; line-height: 1.1; }
.dw-ov-val.good { color: #2e9e6b; }
.dw-ov-val.mid { color: #c2691d; }
.dw-ov-val.low { color: #b23b5b; }
.dw-ov-val.hot { color: #b23b5b; }
.dw-ov-sub { display: block; font-size: 11px; color: #9a9ab0; margin-top: 4px; }

.dw-bar-row { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; }
.dw-bar-row:last-child { margin-bottom: 0; }
.dw-bar-label { width: 96px; flex-shrink: 0; font-size: 13px; color: #4a4a5a; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dw-bar-track { flex: 1; height: 10px; background: #f0effb; border-radius: 6px; overflow: hidden; }
.dw-bar-fill { height: 100%; background: linear-gradient(90deg, #534ab7, #3c3489); border-radius: 6px; transition: width 0.3s ease; }
.dw-bar-fill.alt { background: linear-gradient(90deg, #f59e0b, #ef4444); }
.dw-bar-fill.good { background: linear-gradient(90deg, #2e9e6b, #1f7d52); }
.dw-bar-fill.mid { background: linear-gradient(90deg, #f0a93b, #c2691d); }
.dw-bar-fill.low { background: linear-gradient(90deg, #ef6b8a, #b23b5b); }
.dw-bar-num { width: 92px; flex-shrink: 0; text-align: right; font-size: 12.5px; color: #8a8aa0; }
.dw-bar-num em { font-style: normal; color: #b6b6c8; font-size: 11px; }

.dw-q-row { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 8px 0; border-bottom: 1px dashed #eceaff; }
.dw-q-row:last-child { border-bottom: none; }
.dw-q-label { font-size: 13px; color: #4a4a5a; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dw-q-num { font-size: 12.5px; color: #8a8aa0; flex-shrink: 0; }

.dw-exam-summary { display: flex; flex-wrap: wrap; gap: 10px 18px; align-items: center; margin-bottom: 6px; font-size: 13px; color: #4a4a5a; }
.dw-exam-summary strong { font-size: 15px; }
.dw-exam-summary strong.good { color: #2e9e6b; }
.dw-exam-summary strong.mid { color: #c2691d; }
.dw-exam-summary strong.low { color: #b23b5b; }

.dw-word-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 10px; }
.dw-word-chip { background: #f7f6ff; border: 1px solid #eceaff; border-radius: 12px; padding: 10px 12px; display: flex; flex-direction: column; gap: 3px; }
.dw-word-chip.hot { border-color: #f0c8d3; background: #fdeef2; }
.dw-word-en { font-size: 15px; font-weight: 700; color: #2c2c3a; }
.dw-word-def { font-size: 12px; color: #6a6a80; line-height: 1.4; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dw-word-meta { font-size: 11px; color: #b23b5b; }

.dw-jump {
  display: inline-block; margin-top: 12px; font-size: 13px; font-weight: 600;
  color: #534ab7; text-decoration: none;
}
.dw-jump:hover { text-decoration: underline; }

.dw-action .dw-advice { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 12px; }
.dw-advice li { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; font-size: 13.5px; color: #4a4a5a; line-height: 1.5; }
.dw-advice li :deep(svg) { color: #534ab7; flex-shrink: 0; }
.dw-advice li b { color: #2c2c3a; }
.dw-advice a { color: #534ab7; font-weight: 600; text-decoration: none; }
.dw-advice a:hover { text-decoration: underline; }

@media (max-width: 768px) {
  .dw-view { padding: 12px; }
  .dw-title { font-size: 18px; }
  .dw-hero { padding: 14px 16px; }
  .dw-bar-label { width: 76px; font-size: 12px; }
  .dw-bar-num { width: 78px; font-size: 11.5px; }
  .dw-ov-val { font-size: 22px; }
  .dw-word-grid { grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); }
}
</style>
