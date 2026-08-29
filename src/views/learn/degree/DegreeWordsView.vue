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
          <div class="dw-item-main dw-clickable" @click="openDetail(w)" title="点击查看详情">
            <div class="dw-word-row">
              <span class="dw-emoji" :title="'点击设置象形图标'" @click.stop="editEmoji(w.word)">{{ emojiOf(w.word) }}</span>
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
            <span class="dw-emoji dw-emoji-lg" :title="'点击设置象形图标'" @click.stop="editEmoji(current?.word || '')">{{ emojiOf(current?.word || '') }}</span>
            <span class="dw-word dw-word-link" title="点击查看完整详情" @click="openDetail(current!)">{{ current?.word }}</span>
            <span v-if="current?.phonetic" class="dw-phon">/{{ current.phonetic }}/</span>
            <span v-if="current?.pos" class="dw-pos">{{ current.pos }}</span>
            <el-button :icon="Microphone" circle size="small" class="dw-card-speak" @click.stop="speak(current?.word || '')" title="朗读" />
          </div>
          <div v-if="showAnswer" class="dw-card-def">{{ current?.definition }}</div>
          <div v-else class="dw-card-hint">
            <el-button @click="showAnswer = true">显示释义</el-button>
          </div>

          <!-- 翻转背面：完整详情结构（美/英音标、助记、例句、配图） -->
          <div v-if="showAnswer && current" class="dw-full">
            <div class="dw-full-ph">
              <span class="dw-full-ph-item">
                <b>美</b>
                <span>{{ enrich.phoneticUS || enrich.phonetic || current.phonetic || '—' }}</span>
                <el-button :icon="Microphone" circle size="small" @click.stop="speakAccent('en-US')" title="美式朗读" />
              </span>
              <span class="dw-full-ph-item">
                <b>英</b>
                <span>{{ enrich.phoneticUK || enrich.phonetic || current.phonetic || '—' }}</span>
                <el-button :icon="Microphone" circle size="small" @click.stop="speakAccent('en-GB')" title="英式朗读" />
              </span>
            </div>

            <div class="dw-full-sec dw-full-mnc">
              <div class="dw-full-hd">助记</div>
              <div v-if="enrich.mnemonicReal">{{ enrich.mnemonic }}</div>
              <div v-else class="dw-full-empty">*助记正在赶来的路上</div>
            </div>

            <div class="dw-full-sec dw-full-ex">
              <div class="dw-full-hd">例句</div>
              <template v-if="enrich.example">
                <div class="dw-full-ex-en">{{ enrich.example }}</div>
                <div v-if="enrich.exampleZh" class="dw-full-ex-zh">{{ enrich.exampleZh }}</div>
                <div v-else class="dw-full-ex-zh dw-full-empty">（翻译获取中或不可用）</div>
                <div class="dw-full-ex-bar">
                  <button type="button" @click.stop="speakText(enrich.example, 0.95)">朗读</button>
                  <button type="button" @click.stop="speakText(enrich.example, 0.6)">慢速</button>
                </div>
              </template>
              <div v-else class="dw-full-empty">该词暂无例句，先记住释义即可。</div>
            </div>

            <div class="dw-full-sec dw-full-pic">
              <div class="dw-full-hd">配图</div>
              <div class="dw-full-pic-row">
                <span class="dw-full-pic-em">{{ emojiOf(current.word) }}</span>
                <span class="dw-full-pic-tx">离线象形符号，点击卡片顶部图标可自定义</span>
              </div>
            </div>
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

    <!-- 统一单词详情（三模块共用同一组件） -->
    <WordDetailDialog
      v-model="detailVisible"
      :word="detailWord?.word || ''"
      :phonetic="detailWord?.phonetic || ''"
      :pos="detailWord?.pos || ''"
      :definition="detailWord?.definition || ''"
      :pool="allWordList"
      module-label="学位英语 · 背单词卡"
      @add-word-book="onAddWordBook"
      @mastered="onMastered"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Microphone, Collection, Select } from '@element-plus/icons-vue'
import { loadWords } from '../../../prep/degreeDb'
import * as svc from '../../../prep/degreeService'
import { speakEn } from '../../../prep/degreeSpeech'
import { getEmoji, setEmojiOverride } from '../../../data/emojiDict'
import WordDetailDialog from '../../../components/WordDetailDialog.vue'
import {
  reviewWord,
  buildReviewQueue,
  srsStats,
  type SrsGrade,
  type SrsStats
} from '../../../prep/degreeSrs'
import type { DegreeWord, WordProgress } from '../../../prep/degreeTypes'
import { getWordEnrich, type WordEnrichData } from '../../../services/wordEnrichService'

const kw = ref('')
const bookFilter = ref('all')
const onlyProductive = ref(false)
const page = ref(1)
const pageSize = 30
const words = ref<DegreeWord[]>([])
const progressMap = ref<Record<string, WordProgress>>({})
const wordBook = ref<string[]>([])

// ===== 统一单词详情（三个学英语模块共用同一组件） =====
const detailVisible = ref(false)
const detailWord = ref<DegreeWord | null>(null)
/** 形近词候选池：本模块全部单词 */
const allWordList = computed(() => words.value.map((w) => w.word))
function openDetail(w: DegreeWord) {
  detailWord.value = w
  detailVisible.value = true
}
async function onAddWordBook(word: string) {
  const w = words.value.find((x) => x.word === word)
  if (w && !isWordBook(word)) await toggleWordBook(w)
}
async function onMastered(word: string) {
  const w = words.value.find((x) => x.word === word)
  if (w && !isGraduated(word)) await toggleGraduated(w)
}

/* ===== 复习卡片背面：完整详情结构（与 WordDetailDialog 同源，走免费 API） ===== */
const EMPTY_ENRICH: WordEnrichData = {
  word: '', phonetic: '', phoneticUS: '', phoneticUK: '',
  enDefs: [], example: '', exampleZh: '', similar: [],
  mnemonic: '', mnemonicReal: false, emoji: ''
}
const enrich = ref<WordEnrichData>({ ...EMPTY_ENRICH })
const enrichLoading = ref(false)

async function loadEnrich(w: DegreeWord | null): Promise<void> {
  if (!w) {
    enrich.value = { ...EMPTY_ENRICH }
    return
  }
  enrichLoading.value = true
  enrich.value = { ...EMPTY_ENRICH, word: w.word }
  try {
    const d = await getWordEnrich(w.word, {
      localPhonetic: w.phonetic || '',
      pool: allWordList.value
    })
    // 词已切换就丢弃过期结果，避免串词
    if (current.value?.word === w.word) enrich.value = d
  } finally {
    if (current.value?.word === w.word) enrichLoading.value = false
  }
}
/** 按口音朗读单词（统一走 speakEn 双通道，国产浏览器自动降级在线发音） */
function speakAccent(accent: 'en-US' | 'en-GB'): void {
  const w = current.value?.word
  if (w) speakEn(w, 0.9, accent)
}
/** 朗读任意英文文本（例句），支持慢速 */
function speakText(text: string, rate: number): void {
  if (text) speakEn(text, rate, 'en-US')
}

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

// ---------- 英语象形 emoji ----------
const emojiVersion = ref(0)
function emojiOf(word: string) {
  // 读取 emojiVersion 建立依赖，自定义覆盖变更即刷新
  void emojiVersion.value
  return getEmoji(word)
}
async function editEmoji(word: string) {
  if (!word) return
  try {
    const { value } = await ElMessageBox.prompt('输入一个 emoji 作为该词的象形图标（留空恢复默认）', '设置象形图标', {
      inputValue: getEmoji(word) === '🔤' ? '' : getEmoji(word),
      confirmButtonText: '保存',
      cancelButtonText: '取消',
      inputPlaceholder: '例如 🐱 📘 🌟'
    })
    setEmojiOverride(word, value || '')
    emojiVersion.value++
    ElMessage.success('已更新象形图标')
  } catch {
    /* 用户取消 */
  }
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

/* 翻转显示答案 / 切到下一个词时，拉取该词完整增强数据（音标、助记、例句；免费 API）。
   不显示答案时不提前请求，避免为没翻开的词浪费接口调用。 */
watch(
  () => [showAnswer.value, current.value?.word],
  () => {
    if (mode.value !== 'review') return
    if (showAnswer.value && current.value) void loadEnrich(current.value)
    else enrich.value = { ...EMPTY_ENRICH }
  }
)

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
.dw-clickable {
  cursor: pointer;
  border-radius: 10px;
  transition: background 0.18s ease;
}
.dw-clickable:active {
  background: #f1f5f9;
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
.dw-emoji {
  font-size: 20px;
  cursor: pointer;
  user-select: none;
  filter: drop-shadow(0 1px 1px rgba(0, 0, 0, 0.08));
  transition: transform 0.12s;
}
.dw-emoji:hover {
  transform: scale(1.15);
}
.dw-emoji-lg {
  font-size: 30px;
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

/* 单词可点开完整详情 */
.dw-word-link {
  cursor: pointer;
  border-bottom: 2px dashed #c7d2fe;
  touch-action: manipulation;
  -webkit-tap-highlight-color: rgba(99, 102, 241, 0.12);
  transition: color 0.15s ease, border-color 0.15s ease;
}
.dw-word-link:hover {
  color: #534ab7;
  border-bottom-color: #534ab7;
}

/* 翻转背面：完整详情结构 */
.dw-full {
  margin-top: 14px;
  border-top: 1px dashed #eceaff;
  padding-top: 12px;
  text-align: left;
}
.dw-full-ph {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-bottom: 12px;
}
.dw-full-ph-item {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: #f8fafc;
  border: 1px solid #eceaff;
  border-radius: 9px;
  padding: 4px 8px;
  font-size: 12.5px;
  color: #4a4a5a;
}
.dw-full-ph-item b {
  font-size: 10.5px;
  font-weight: 700;
  color: #9a9ab0;
}
.dw-full-sec {
  background: #fff;
  border: 1px solid #eceaff;
  border-radius: 10px;
  padding: 10px 12px;
  margin-bottom: 10px;
}
.dw-full-mnc {
  background: #fffbeb;
  border-color: #fde68a;
  color: #78350f;
  font-size: 13px;
  line-height: 1.7;
}
.dw-full-ex {
  background: #f0f9ff;
  border-color: #bae6fd;
}
.dw-full-pic {
  background: #f0fdfa;
  border-color: #99f6e4;
}
.dw-full-hd {
  font-size: 12px;
  font-weight: 700;
  color: #334155;
  margin-bottom: 6px;
}
.dw-full-ex-en {
  font-size: 13.5px;
  line-height: 1.7;
  color: #2c2c3a;
}
.dw-full-ex-zh {
  font-size: 12.5px;
  color: #64748b;
  line-height: 1.65;
  margin-top: 5px;
}
.dw-full-ex-bar {
  display: flex;
  gap: 8px;
  margin-top: 9px;
}
.dw-full-ex-bar button {
  border: 1px solid #bae6fd;
  background: #fff;
  border-radius: 8px;
  padding: 5px 12px;
  font-size: 12px;
  cursor: pointer;
  color: #0369a1;
  font-weight: 600;
  min-height: 32px;
  touch-action: manipulation;
}
.dw-full-pic-row {
  display: flex;
  align-items: center;
  gap: 14px;
}
.dw-full-pic-em {
  font-size: 40px;
  line-height: 1;
}
.dw-full-pic-tx {
  font-size: 12px;
  color: #0f766e;
  line-height: 1.65;
}
.dw-full-empty {
  font-size: 12.5px;
  color: #9a9ab0;
  line-height: 1.7;
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
