<template>
  <div class="dw">
    <h2 class="dw-title">生词词库</h2>
    <p class="dw-sub">大纲词汇（含音标 / 词性 / 释义 / 复用式标记），可朗读、加入生词本，并按记忆曲线复习。</p>

    <div class="dw-modes">
      <el-radio-group v-model="mode" size="small">
        <el-radio-button value="browse">词库浏览</el-radio-button>
        <el-radio-button value="review">记忆复习</el-radio-button>
      </el-radio-group>
      <div class="dw-stats" v-if="mode === 'review'">
        <span>待复习 <b>{{ stats.due }}</b></span>
        <span>今日新词 <b>{{ stats.newToday }}</b></span>
        <span>学习中 <b>{{ stats.learning }}</b></span>
        <span>已掌握 <b>{{ stats.graduated }}</b></span>
        <span v-if="stats.weak">薄弱 <b>{{ stats.weak }}</b></span>
      </div>
    </div>

    <!-- 浏览模式 -->
    <template v-if="mode === 'browse'">
      <div class="dw-toolbar">
        <el-input v-model="kw" placeholder="搜索单词或释义" clearable class="dw-search" />
        <el-select v-model="bookFilter" placeholder="来源" class="dw-book">
          <el-option label="全部来源" value="all" />
          <el-option label="考试大纲" value="考试大纲" />
          <el-option label="复习指南" value="复习指南" />
          <el-option label="模拟试卷" value="模拟试卷" />
        </el-select>
        <el-checkbox v-model="onlyProductive" class="dw-prod">仅复用式</el-checkbox>
        <el-tag type="info" effect="plain" round>共 {{ filtered.length }} 词</el-tag>
      </div>

      <div class="dw-list">
        <div v-for="w in paged" :key="w.word" class="dw-item" :class="{ prod: w.productive }">
          <div class="dw-item-main">
            <div class="dw-word-row">
              <span class="dw-word">{{ w.word }}</span>
              <span v-if="w.phonetic" class="dw-phon">/{{ w.phonetic }}/</span>
              <span v-if="w.pos" class="dw-pos">{{ w.pos }}</span>
              <span v-if="w.productive" class="dw-tag">复用式</span>
            </div>
            <div class="dw-def">{{ w.definition }}</div>
            <div class="dw-meta">
              <span v-for="b in w.sourceBooks || []" :key="b" class="dw-src">{{ b }}</span>
            </div>
          </div>
          <div class="dw-item-actions">
            <el-button :icon="Microphone" circle @click="speak(w.word)" title="朗读" />
            <el-button
              :type="isWordBook(w.word) ? 'success' : 'default'"
              :icon="Collection"
              circle
              @click="toggleWordBook(w)"
              :title="isWordBook(w.word) ? '已在生词本' : '加入生词本'"
            />
            <el-button
              :type="isGraduated(w.word) ? 'warning' : 'default'"
              :icon="Select"
              circle
              @click="toggleGraduated(w)"
              :title="isGraduated(w.word) ? '已掌握' : '标记为掌握'"
            />
          </div>
        </div>
      </div>

      <el-pagination
        v-if="filtered.length > pageSize"
        class="dw-pager"
        layout="prev, pager, next"
        :total="filtered.length"
        :page-size="pageSize"
        v-model:current-page="page"
      />
    </template>

    <!-- 复习模式 -->
    <div v-else class="dw-review">
      <template v-if="!reviewStarted">
        <el-empty description="按记忆曲线安排复习：到期词优先，新词按每日上限引入">
          <el-button type="primary" @click="startReview">开始复习</el-button>
        </el-empty>
      </template>

      <template v-else-if="queue.length">
        <div class="dw-card">
          <div class="dw-card-top">
            <span>剩余 {{ queue.length }}</span>
            <span>今日已复习 {{ reviewedCount }}</span>
          </div>
          <div class="dw-card-word">
            <span class="dw-word">{{ current?.word }}</span>
            <span v-if="current?.phonetic" class="dw-phon">/{{ current.phonetic }}/</span>
            <span v-if="current?.pos" class="dw-pos">{{ current.pos }}</span>
            <el-button :icon="Microphone" circle size="small" class="dw-card-speak" @click="speak(current?.word || '')" title="朗读" />
          </div>
          <div v-if="showAnswer" class="dw-card-def">{{ current?.definition }}</div>
          <div v-else class="dw-card-hint">
            <el-button @click="showAnswer = true">显示释义</el-button>
          </div>
          <div v-if="showAnswer" class="dw-grades">
            <el-button type="danger" @click="grade('again')">遗忘</el-button>
            <el-button type="primary" @click="grade('good')">记得</el-button>
            <el-button type="success" @click="grade('easy')">简单</el-button>
          </div>
          <div v-if="showAnswer" class="dw-grade-hint">遗忘→短期重练　记得→正常推进　简单→跳级拉长间隔</div>
        </div>
      </template>

      <template v-else>
        <el-result icon="success" title="本次复习完成" :sub-title="`今日已复习 ${reviewedCount} 词`">
          <template #extra>
            <el-button type="primary" @click="startReview">再来一轮</el-button>
          </template>
        </el-result>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { Microphone, Collection, Select } from '@element-plus/icons-vue'
import { loadWords } from '../../../prep/degreeDb'
import * as svc from '../../../prep/degreeService'
import { speakEn } from '../../../prep/degreeSpeech'
import {
  reviewWord,
  buildReviewQueue,
  srsStats,
  type SrsGrade,
  type SrsStats
} from '../../../prep/degreeSrs'
import type { DegreeWord, WordProgress } from '../../../prep/degreeTypes'

const kw = ref('')
const bookFilter = ref('all')
const onlyProductive = ref(false)
const page = ref(1)
const pageSize = 30
const words = ref<DegreeWord[]>([])
const progressMap = ref<Record<string, WordProgress>>({})
const wordBook = ref<string[]>([])

const filtered = computed(() => {
  const k = kw.value.trim().toLowerCase()
  return words.value.filter((w) => {
    if (onlyProductive.value && !w.productive) return false
    if (bookFilter.value !== 'all' && !(w.sourceBooks || []).includes(bookFilter.value as never)) return false
    if (k && !w.word.toLowerCase().includes(k) && !w.definition.toLowerCase().includes(k)) return false
    return true
  })
})
const paged = computed(() => filtered.value.slice((page.value - 1) * pageSize, page.value * pageSize))

function isWordBook(word: string) {
  return wordBook.value.includes(word)
}
function isGraduated(word: string) {
  return progressMap.value[word]?.status === 'graduated'
}
function speak(word: string) {
  speakEn(word)
}
async function toggleWordBook(w: DegreeWord) {
  if (isWordBook(w.word)) {
    ElMessage.info('已在生词本')
    return
  }
  await svc.addFavorite('word', `${w.word} ${w.definition}`)
  wordBook.value = await svc.loadFavorites('word').then((f) => f.map((x) => (x.title || '').split(' ')[0] || ''))
  ElMessage.success('已加入生词本')
}
async function toggleGraduated(w: DegreeWord) {
  const graduated = isGraduated(w.word)
  await svc.saveWordProgress(w.word, {
    status: graduated ? 'learning' : 'graduated',
    level: graduated ? 1 : 5,
    due: null,
    weak: false
  })
  progressMap.value = await svc.loadWordProgress()
  ElMessage.success(graduated ? '已取消掌握' : '已标记为掌握')
}

// ---------- 复习模式 ----------
const mode = ref<'browse' | 'review'>('browse')
const stats = ref<SrsStats>({ total: 0, learning: 0, graduated: 0, due: 0, newCount: 0, newToday: 0, weak: 0 })
const reviewStarted = ref(false)
const queue = ref<DegreeWord[]>([])
const reviewedCount = ref(0)
const showAnswer = ref(false)
const current = computed(() => queue.value[0] ?? null)
const reviewNewPerDay = ref(15)

async function startReview() {
  try {
    const [ws, prog, settings] = await Promise.all([
      loadWords(),
      svc.loadWordProgress(),
      svc.loadDegreeSettings()
    ])
    words.value = ws
    progressMap.value = prog
    const newPerDay = settings.newPerDay || 15
    reviewNewPerDay.value = newPerDay
    stats.value = srsStats(ws, prog, newPerDay)
    queue.value = buildReviewQueue(ws, prog, { newPerDay })
    reviewedCount.value = 0
    showAnswer.value = false
    reviewStarted.value = true
  } catch {
    /* degreeDb 已兜底 */
  }
}

async function grade(g: SrsGrade) {
  const w = current.value
  if (!w) return
  const prev = progressMap.value[w.word]
  const next = reviewWord(prev, g)
  progressMap.value = { ...progressMap.value, [w.word]: next }
  await svc.saveWordProgress(w.word, next)
  reviewedCount.value++
  // 出队
  queue.value.shift()
  // 遗忘：本轮稍后再出现，强化记忆
  if (g === 'again') queue.value.push(w)
  showAnswer.value = false
  stats.value = srsStats(words.value, progressMap.value, reviewNewPerDay.value)
}

onMounted(async () => {
  try {
    words.value = await loadWords()
    const [prog, favs] = await Promise.all([svc.loadWordProgress(), svc.loadFavorites('word')])
    progressMap.value = prog
    wordBook.value = favs.map((f) => (f.title || '').split(' ')[0] || '')
  } catch {
    /* degreeDb 已兜底 */
  }
})
</script>

<style scoped>
.dw {
  max-width: 1100px;
  margin: 0 auto;
  padding: 16px;
}
.dw-title {
  margin: 0 0 4px;
  font-size: 20px;
  font-weight: 700;
  color: #2c2c3a;
}
.dw-sub {
  margin: 0 0 16px;
  color: #8a8aa0;
  font-size: 13px;
}
.dw-modes {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: center;
  margin-bottom: 14px;
}
.dw-stats {
  display: flex;
  gap: 14px;
  flex-wrap: wrap;
  font-size: 13px;
  color: #6a6a80;
}
.dw-stats b {
  color: #534ab7;
  font-size: 15px;
}
.dw-toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  align-items: center;
  margin-bottom: 14px;
}
.dw-search {
  flex: 1;
  min-width: 180px;
}
.dw-book {
  width: 140px;
}
.dw-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.dw-item {
  display: flex;
  gap: 12px;
  align-items: center;
  justify-content: space-between;
  background: #fff;
  border: 1px solid #eceaff;
  border-radius: 12px;
  padding: 12px 14px;
}
.dw-item.prod {
  border-left: 4px solid #534ab7;
}
.dw-item-main {
  min-width: 0;
}
.dw-word-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: baseline;
}
.dw-word {
  font-size: 16px;
  font-weight: 700;
  color: #2c2c3a;
}
.dw-phon {
  font-size: 12px;
  color: #9a9ab0;
}
.dw-pos {
  font-size: 12px;
  color: #2f8bbd;
}
.dw-tag {
  font-size: 11px;
  background: #534ab7;
  color: #fff;
  border-radius: 6px;
  padding: 1px 6px;
}
.dw-def {
  font-size: 13px;
  color: #4a4a5a;
  margin-top: 2px;
}
.dw-meta {
  display: flex;
  gap: 6px;
  margin-top: 4px;
}
.dw-src {
  font-size: 11px;
  color: #8a8aa0;
  border: 1px solid #e6e6f0;
  border-radius: 6px;
  padding: 0 6px;
}
.dw-item-actions {
  display: flex;
  gap: 6px;
  flex-shrink: 0;
}
.dw-pager {
  justify-content: center;
  margin-top: 16px;
}

/* 复习卡片 */
.dw-review {
  margin-top: 4px;
}
.dw-card {
  max-width: 560px;
  margin: 0 auto;
  background: #fff;
  border: 1px solid #eceaff;
  border-radius: 16px;
  padding: 22px 20px;
  box-shadow: 0 6px 20px rgba(83, 74, 183, 0.06);
}
.dw-card-top {
  display: flex;
  justify-content: space-between;
  font-size: 13px;
  color: #8a8aa0;
  margin-bottom: 16px;
}
.dw-card-word {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: baseline;
}
.dw-card-word .dw-word {
  font-size: 26px;
}
.dw-card-speak {
  margin-left: auto;
}
.dw-card-def {
  margin-top: 14px;
  font-size: 16px;
  color: #4a4a5a;
  line-height: 1.6;
  min-height: 48px;
}
.dw-card-hint {
  margin-top: 14px;
  min-height: 48px;
  display: flex;
  align-items: center;
}
.dw-grades {
  display: flex;
  gap: 10px;
  margin-top: 18px;
  justify-content: center;
}
.dw-grades .el-button {
  flex: 1;
  max-width: 140px;
}
.dw-grade-hint {
  margin-top: 10px;
  text-align: center;
  font-size: 12px;
  color: #a0a0b4;
}
@media (max-width: 768px) {
  .dw-book {
    width: 100%;
  }
  .dw-item {
    flex-direction: column;
    align-items: flex-start;
  }
  .dw-item-actions {
    align-self: flex-end;
  }
  .dw-card-word .dw-word {
    font-size: 22px;
  }
}
</style>
