<template>
  <div class="degree-view">
    <PageHeader
      :icon="Reading"
      title="学位英语备考台"
      :subtitle="`大纲 ${MATERIALS[0]?.pages ?? 0}页 · 指南 ${MATERIALS[1]?.pages ?? 0}页 · 模拟卷 ${MATERIALS[2]?.pages ?? 0}页，全本已内置 · 目标：${settings.targetSchool || '商丘师范学院继续教育学院'}`"
    >
      <template #actions>
        <el-button text :icon="Setting" @click="settingsVisible = true">设置</el-button>
        <el-button type="primary" round :icon="VideoPlay" @click="startStudy">开始学习</el-button>
      </template>
    </PageHeader>

    <!-- 统计卡 -->
    <div class="stat-grid">
      <div class="stat-card">
        <div class="stat-label">今日新词</div>
        <div class="stat-num" style="color: #534ab7">{{ settings.newPerDay }}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">连续学习</div>
        <div class="stat-num" style="color: #185fa5">{{ streakDays }}<span class="unit">天</span></div>
      </div>
      <div class="stat-card">
        <div class="stat-label">词汇掌握</div>
        <div class="stat-num" style="color: #0f6e56">
          {{ graduatedCount }}<span class="unit">/{{ degreeWords.length || VOCAB_REQUIREMENT.receptive }}</span>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-label">题库总量</div>
        <div class="stat-num" style="color: #854f0b">{{ degreeQuestions.length }}</div>
      </div>
    </div>

    <!-- 胶囊 Tab -->
    <div class="tab-bar">
      <button v-for="t in tabs" :key="t.key" class="tab-pill" :class="{ active: activeTab === t.key }" @click="activeTab = t.key">
        {{ t.label }}
      </button>
    </div>

    <!-- 概览 -->
    <section v-show="activeTab === 'overview'" class="panel">
      <div class="overview-top">
        <div class="plan-card">
          <div class="card-title">今日学习计划</div>
          <ul class="plan-list">
            <li>新学单词 {{ settings.newPerDay }} 个</li>
            <li>复习待巩固词 {{ reviewCount }} 个</li>
            <li>题型训练：{{ EXAM_SECTIONS.find((s) => s.key === trainingType)?.name }}</li>
            <li v-if="settings.examDate">距考试还有 <b>{{ daysToExam }}</b> 天</li>
          </ul>
          <el-button type="primary" round size="small" @click="startStudy">开始今日学习</el-button>
        </div>
        <div class="ring-card">
          <svg width="120" height="120" viewBox="0 0 120 120">
            <circle cx="60" cy="60" r="50" fill="none" stroke="#eceaf8" stroke-width="12" />
            <circle
              cx="60" cy="60" r="50" fill="none" stroke="#534ab7" stroke-width="12" stroke-linecap="round"
              :stroke-dasharray="`${ringLen} 314`" transform="rotate(-90 60 60)"
            />
            <text x="60" y="66" text-anchor="middle" font-size="22" font-weight="600" fill="#3c3489">{{ masteryPercent }}%</text>
          </svg>
          <div class="ring-cap">总掌握进度</div>
        </div>
      </div>

      <div class="card-title" style="margin: 18px 0 10px">五大题型（严格按大纲）</div>
      <div class="type-grid">
        <div
          v-for="s in EXAM_SECTIONS"
          :key="s.key"
          class="type-card"
          :style="{ borderTopColor: s.color }"
          @click="goTraining(s.key)"
        >
          <div class="type-name" :style="{ color: s.color }">{{ s.name }}</div>
          <div class="type-meta">{{ s.count }}题 · {{ s.score }}分 · {{ s.minutes }}min</div>
          <div class="type-desc">{{ s.desc }}</div>
        </div>
      </div>

      <div class="card-title" style="margin: 18px 0 10px">词汇要求 & 语法项目（大纲规定）</div>
      <div class="req-grid">
        <div class="req-card">
          <div class="req-h">词汇要求</div>
          <div class="req-row">领会式掌握：<b>{{ VOCAB_REQUIREMENT.receptive }}</b> 词 + {{ VOCAB_REQUIREMENT.receptivePhrase }} 词组</div>
          <div class="req-row">复用式掌握：<b>{{ VOCAB_REQUIREMENT.productive }}</b> 词 + {{ VOCAB_REQUIREMENT.productivePhrase }} 词组（大纲带 <span class="star">*</span>）</div>
          <div class="req-row">另需掌握：{{ VOCAB_REQUIREMENT.affix }}</div>
        </div>
        <div class="req-card">
          <div class="req-h">语法项目（10 项）</div>
          <div v-for="(g, i) in GRAMMAR_ITEMS" :key="i" class="grammar-item">{{ i + 1 }}. {{ g }}</div>
        </div>
      </div>
    </section>

    <!-- 单词本 -->
    <section v-show="activeTab === 'words'" class="panel">
      <div class="toolbar">
        <el-input v-model="wordQuery" placeholder="搜索单词 / 释义" clearable style="max-width: 320px" />
        <el-radio-group v-model="wordSrc" size="small">
          <el-radio-button value="all">全部</el-radio-button>
          <el-radio-button value="考试大纲">大纲</el-radio-button>
          <el-radio-button value="复习指南">指南</el-radio-button>
          <el-radio-button value="模拟试卷">模拟</el-radio-button>
        </el-radio-group>
        <el-tag v-if="degreeWords.length" type="info" effect="plain">共 {{ filteredWords.length }} 词</el-tag>
        <el-tag v-else type="warning" effect="plain">OCR 生成中，稍候自动填充</el-tag>
      </div>
      <div v-if="filteredWords.length" class="word-list">
        <div v-for="w in visibleWords" :key="w.word" class="word-item" :class="{ weak: wordProgress[w.word]?.weak }">
          <div class="word-main">
            <span class="word-text">{{ w.word }}<span v-if="w.productive" class="star">*</span></span>
            <button class="speak-btn" :title="'朗读 ' + w.word" @click="speak(w.word)">🔊</button>
            <button class="speak-btn" :title="'查看例句 ' + w.word" @click="loadExample(w.word)" :disabled="exampleLoading[w.word]">📖</button>
          </div>
          <div class="word-def">{{ w.definition }}</div>
          <div class="word-example" v-if="examples[w.word]">
            <span class="ex-label">例句</span> {{ examples[w.word] }}
          </div>
          <div class="word-src">
            <el-tag v-for="b in (w.sourceBooks || [])" :key="b" size="small" :type="srcTagType(b)" effect="plain">{{ b }}</el-tag>
          </div>
          <div class="word-ops">
            <el-button size="small" @click="cycleWord(w.word)">
              {{ wordProgress[w.word]?.status === 'graduated' ? '已掌握' : wordProgress[w.word]?.status === 'learning' ? '学习中' : '标记学习' }}
            </el-button>
            <el-button size="small" text type="primary" @click="addWordBook(w)">加入生词本</el-button>
          </div>
        </div>
      </div>
      <div class="load-more" v-if="filteredWords.length > wordLimit">
        <el-button @click="wordLimit = filteredWords.length">显示全部 {{ filteredWords.length }} 词</el-button>
      </div>
      <el-empty v-else description="词汇表正在由《考试大纲》OCR 提取，完成后这里会显示全部 4400+ 词，并标注复用式（*）" />
    </section>

    <!-- 词组 / 语句 -->
    <section v-show="activeTab === 'phrases'" class="panel">
      <div class="toolbar">
        <el-radio-group v-model="phraseCat">
          <el-radio-button value="all">全部</el-radio-button>
          <el-radio-button value="phrase">词组表</el-radio-button>
          <el-radio-button value="spoken">口语表达</el-radio-button>
          <el-radio-button value="affix">常用词缀</el-radio-button>
          <el-radio-button value="irregular">不规则动词</el-radio-button>
        </el-radio-group>
        <el-input v-model="phraseQuery" placeholder="搜索英文 / 中文" clearable style="max-width: 300px" />
        <el-tag type="info" effect="plain">共 {{ filteredPhrases.length }} 条</el-tag>
      </div>
      <div v-if="filteredPhrases.length" class="phrase-list">
        <div v-for="p in filteredPhrases" :key="p.id" class="phrase-item" :class="p.category">
          <div class="phrase-top">
            <span class="phrase-en">{{ p.en }}<span v-if="p.productive" class="star">*</span></span>
            <span class="phrase-cat">{{ catLabel(p.category) }}</span>
          </div>
          <div class="phrase-zh" v-if="p.zh">{{ p.zh }}</div>
          <div class="phrase-extra" v-if="p.extra">
            {{ p.category === 'irregular' ? '过去式 / 过去分词：' : p.category === 'affix' ? '例词：' : '' }}{{ p.extra }}
          </div>
        </div>
      </div>
      <el-empty v-else description="词组 / 语句数据正在由《考试大纲》OCR 提取" />
    </section>

    <!-- 题型训练 -->
    <section v-show="activeTab === 'training'" class="panel">
      <div class="toolbar">
        <el-radio-group v-model="trainingType" @change="pickQuestion">
          <el-radio-button v-for="s in EXAM_SECTIONS" :key="s.key" :value="s.key">{{ s.name }}</el-radio-button>
        </el-radio-group>
        <el-tag type="info" effect="plain">{{ questionsOfType.length }} 题</el-tag>
      </div>

      <div v-if="currentQ" class="quiz-card">
        <div class="quiz-stem">{{ currentQ.stem }}</div>
        <div v-if="currentQ.passage" class="quiz-passage">{{ currentQ.passage }}</div>
        <div v-if="currentQ.options" class="quiz-options">
          <label v-for="(o, i) in currentQ.options" :key="i" class="opt" :class="{ right: showAnswer && isRight(o), wrong: showAnswer && myAnswer === o && !isRight(o) }">
            <input type="radio" :name="'q'" :value="o" v-model="myAnswer" :disabled="showAnswer" />
            <span>{{ String.fromCharCode(65 + i) }}. {{ o }}</span>
          </label>
        </div>
        <div class="quiz-actions">
          <el-button v-if="!showAnswer" type="primary" @click="revealAnswer">提交 / 看答案</el-button>
          <el-button v-else @click="nextQuestion">下一题</el-button>
          <el-button v-if="showAnswer" text type="danger" @click="markMistake(currentQ)">错题收藏</el-button>
        </div>
        <div v-if="showAnswer" class="quiz-explain">
          <div class="ex-h">答案：<b>{{ currentQ.answer }}</b></div>
          <div class="ex-b">解析：{{ currentQ.explanation }}</div>
          <div class="ex-src">来源：{{ currentQ.source.basis }}（{{ currentQ.source.book }} 第 {{ currentQ.source.page }} 页）</div>
        </div>
      </div>
      <el-empty v-else :description="`《${trainingTypeLabel}》题库正在由 PDF 原题 + 大纲生成，完成后即可逐题练习并看解析`" />
    </section>

    <!-- 模拟考试 -->
    <section v-show="activeTab === 'mock'" class="panel">
      <div class="card-title" style="margin-bottom: 10px">全真模拟考试（5 套，计时交卷 + 判分）</div>
      <div class="paper-grid">
        <div v-for="p in MOCK_PAPERS" :key="p.id" class="paper-card">
          <div class="paper-no">第 {{ p.no }} 套</div>
          <div class="paper-title">{{ p.title }}</div>
          <div class="paper-note">{{ p.note }}</div>
          <div class="paper-meta">满分 100 · 120 分钟 · 52 题</div>
          <el-button type="primary" plain size="small" round @click="startMock(p)">开始模考</el-button>
        </div>
      </div>
      <el-alert
        v-if="!degreeQuestions.length"
        type="info"
        :closable="false"
        style="margin-top: 12px"
        title="模拟卷原题题库正在由《全真模拟试卷及考点点睛》OCR 生成，完成后可直接在线计时模考、交卷判分与薄弱项分析。"
      />
    </section>

    <!-- 资料库 -->
    <section v-show="activeTab === 'library'" class="panel">
      <div class="card-title" style="margin-bottom: 10px">资料库（三本 PDF 内容已全量内置，可在线阅读讲解正文）</div>
      <div class="lib-layout">
        <div class="lib-side">
          <el-radio-group v-model="libBook" size="small" class="lib-filter">
            <el-radio-button value="all">全部</el-radio-button>
            <el-radio-button value="考试大纲">大纲</el-radio-button>
            <el-radio-button value="复习指南">指南</el-radio-button>
          </el-radio-group>
          <div class="lib-list">
            <div v-for="a in libraryArticles" :key="a.id" class="lib-item" :class="{ active: activeArticle?.id === a.id }" @click="openArticle(a)">
              <span class="lib-book">{{ a.book === '复习指南' ? '指南' : '大纲' }}</span>
              <span class="lib-title">{{ a.title }}</span>
            </div>
          </div>
        </div>
        <div class="lib-reader">
          <template v-if="activeArticle">
            <div class="reader-head">
              <span class="reader-book">{{ activeArticle.book }}</span>
              <h3 class="reader-title">{{ activeArticle.title }}</h3>
              <el-button size="small" text :icon="Reading" @click="speakText(activeArticle.content)">朗读全文</el-button>
            </div>
            <div class="reader-body">{{ activeArticle.content }}</div>
          </template>
          <el-empty v-else description="从左侧选择一篇讲解开始阅读" :image-size="70" />
        </div>
      </div>
      <div class="card-title" style="margin: 16px 0 10px">原文件（点开看扫描件）</div>
      <div class="material-grid">
        <div v-for="m in MATERIALS" :key="m.id" class="material-card">
          <div class="material-title">{{ m.title }}</div>
          <div class="material-meta">{{ m.pages }} 页 · {{ m.remark }}</div>
          <div class="material-ops">
            <el-button size="small" type="primary" :icon="Picture" @click="openPreview(m)">预览</el-button>
            <el-button size="small" text @click="addMaterialNote(m.title)">记笔记</el-button>
          </div>
        </div>
      </div>
    </section>

    <!-- 读写中心 -->
    <section v-show="activeTab === 'rw'" class="panel">
      <div class="rw-grid">
        <div class="rw-col">
          <div class="card-title">学习笔记 <el-button size="small" text type="primary" @click="addNote()">＋写笔记</el-button></div>
          <div v-if="notes.length" class="note-list">
            <div v-for="n in notes" :key="n.id" class="note-item">
              <div class="note-body">{{ n.content }}</div>
              <el-button size="small" text type="danger" @click="removeFav(n.id)">删除</el-button>
            </div>
          </div>
          <el-empty v-else description="写下你的学习笔记、好句摘抄" :image-size="60" />
        </div>
        <div class="rw-col">
          <div class="card-title">错题本（可重练）</div>
          <div v-if="mistakes.length" class="note-list">
            <div v-for="m in mistakes" :key="m.id" class="note-item">
              <div class="note-body">{{ m.reason || '错题' }} <span class="muted">（{{ typeLabel(m.type) }}）</span></div>
              <el-button size="small" text type="primary" @click="removeFav(m.id, true)">移除</el-button>
            </div>
          </div>
          <el-empty v-else description="做错的题会自动归集到这里" :image-size="60" />
        </div>
        <div class="rw-col">
          <div class="card-title">生词本</div>
          <div v-if="wordBook.length" class="note-list">
            <div v-for="w in wordBook" :key="w.id" class="note-item">
              <div class="note-body">{{ w.content }}</div>
              <el-button size="small" text type="danger" @click="removeFav(w.id)">删除</el-button>
            </div>
          </div>
          <el-empty v-else description="单词本里「加入生词本」的词会在这里" :image-size="60" />
        </div>
      </div>
    </section>

    <!-- PDF 预览 -->
    <el-dialog v-model="previewVisible" :title="previewTitle" width="90%" top="5vh" class="pdf-dialog">
      <iframe :src="previewUrl" class="pdf-frame" />
    </el-dialog>

    <!-- 设置 -->
    <el-dialog v-model="settingsVisible" title="备考设置" width="420px">
      <el-form label-width="92px">
        <el-form-item label="目标院校">
          <el-input v-model="settings.targetSchool" placeholder="如 商丘师范学院继续教育学院" />
        </el-form-item>
        <el-form-item label="考试日期">
          <el-date-picker v-model="settings.examDate" type="date" value-format="YYYY-MM-DD" placeholder="选择考试日" style="width: 100%" />
        </el-form-item>
        <el-form-item label="每日新词">
          <el-input-number v-model="settings.newPerDay" :min="1" :max="50" />
        </el-form-item>
        <el-form-item label="连续天数">
          <el-input-number v-model="manualStreakInput" :min="0" :max="999" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="settingsVisible = false">取消</el-button>
        <el-button type="primary" @click="saveSettings">保存</el-button>
      </template>
    </el-dialog>

    <!-- 写笔记 -->
    <el-dialog v-model="noteVisible" title="学习笔记" width="460px">
      <el-input v-model="noteTitleInput" placeholder="标题（可选）" style="margin-bottom: 10px" />
      <el-input v-model="noteInput" type="textarea" :rows="5" placeholder="写下你的笔记、好句、心得……" />
      <template #footer>
        <el-button @click="noteVisible = false">取消</el-button>
        <el-button type="primary" @click="saveNote">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { Reading, Setting, VideoPlay, Picture } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import PageHeader from '../components/PageHeader.vue'
import {
  EXAM_SECTIONS,
  VOCAB_REQUIREMENT,
  GRAMMAR_ITEMS,
  MATERIALS,
  MOCK_PAPERS,
  type MaterialMeta
} from '../prep/degreeExamStructure'
import { degreeWords } from '../prep/degreeWords'
import { degreeQuestions } from '../prep/degreeQuestions'
import { degreePhrases } from '../prep/degreePhrases'
import { guideArticles } from '../prep/degreeGuide'
import { syllabusProse } from '../prep/degreeSyllabusProse'
import type { DegreeSettings, WordProgress, MistakeRec, FavoriteRec, QuestionType, DegreeQuestion, DegreePhrase, PhraseCategory, SourceBook, DegreeArticle } from '../prep/degreeTypes'
import * as svc from '../prep/degreeService'

// 资料库：三本 PDF 正文切分后的可读文章（确保内容不遗漏）
const allArticles: DegreeArticle[] = [...syllabusProse, ...guideArticles]
const libBook = ref<'all' | string>('all')
const activeArticle = ref<DegreeArticle | null>(null)
const libraryArticles = computed(() =>
  libBook.value === 'all' ? allArticles : allArticles.filter((a) => a.book === libBook.value)
)
function openArticle(a: DegreeArticle) {
  activeArticle.value = a
}
function speakText(t: string) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return
  const u = new SpeechSynthesisUtterance(t)
  u.lang = 'en-US'
  u.rate = 0.95
  window.speechSynthesis.cancel()
  window.speechSynthesis.speak(u)
}

const base = import.meta.env.BASE_URL

const tabs = [
  { key: 'overview', label: '概览' },
  { key: 'words', label: '单词本' },
  { key: 'phrases', label: '词组/语句' },
  { key: 'training', label: '题型训练' },
  { key: 'mock', label: '模拟考试' },
  { key: 'library', label: '资料库' },
  { key: 'rw', label: '读写中心' }
]
const activeTab = ref('overview')

const settings = ref<DegreeSettings>({ targetSchool: '商丘师范学院继续教育学院', examDate: null, newPerDay: 15, manualStreak: null })
const manualStreakInput = ref(0)
const wordProgress = ref<Record<string, WordProgress>>({})
const mistakes = ref<MistakeRec[]>([])
const notes = ref<FavoriteRec[]>([])
const wordBook = ref<FavoriteRec[]>([])

const wordQuery = ref('')
const wordSrc = ref<'all' | SourceBook>('all')
const wordLimit = ref(300)
const filteredWords = computed(() => {
  const q = wordQuery.value.trim().toLowerCase()
  return degreeWords.filter((w) => {
    if (wordSrc.value !== 'all' && !(w.sourceBooks || []).includes(wordSrc.value)) return false
    if (!q) return true
    return w.word.toLowerCase().includes(q) || w.definition.toLowerCase().includes(q)
  })
})
const visibleWords = computed(() => filteredWords.value.slice(0, wordLimit.value))

// 单词读音（浏览器内置 TTS，离线可用） + 例句（免费词典 API，按需加载并缓存）
const examples = ref<Record<string, string>>({})
const exampleLoading = ref<Record<string, boolean>>({})
function srcTagType(b: SourceBook): 'success' | 'warning' | 'info' {
  if (b === '考试大纲') return 'success'
  if (b === '复习指南') return 'warning'
  return 'info'
}
function speak(word: string) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return
  const u = new SpeechSynthesisUtterance(word)
  u.lang = 'en-US'
  u.rate = 0.9
  window.speechSynthesis.cancel()
  window.speechSynthesis.speak(u)
}
async function loadExample(word: string) {
  if (examples.value[word] || exampleLoading.value[word]) return
  exampleLoading.value = { ...exampleLoading.value, [word]: true }
  try {
    const res = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`)
    if (res.ok) {
      const data = await res.json()
      const arr = Array.isArray(data) ? data : [data]
      let found = ''
      for (const entry of arr) {
        for (const m of entry.meanings || []) {
          for (const d of m.definitions || []) {
            if (d.example) { found = d.example; break }
          }
          if (found) break
        }
        if (found) break
      }
      examples.value = { ...examples.value, [word]: found || `（暂无例句）Please memorize "${word}".` }
    } else {
      examples.value = { ...examples.value, [word]: `Please memorize "${word}".` }
    }
  } catch {
    examples.value = { ...examples.value, [word]: `Please memorize "${word}".` }
  } finally {
    exampleLoading.value = { ...exampleLoading.value, [word]: false }
  }
}

// 词组 / 语句
const phraseCat = ref<'all' | PhraseCategory>('all')
const phraseQuery = ref('')
const CAT_LABEL: Record<PhraseCategory, string> = {
  phrase: '词组',
  spoken: '口语',
  affix: '词缀',
  irregular: '不规则动词'
}
function catLabel(c: PhraseCategory) {
  return CAT_LABEL[c]
}
const filteredPhrases = computed(() => {
  const q = phraseQuery.value.trim().toLowerCase()
  const list = degreePhrases.filter((p) => {
    if (phraseCat.value !== 'all' && p.category !== phraseCat.value) return false
    if (!q) return true
    return (
      p.en.toLowerCase().includes(q) ||
      (p.zh || '').toLowerCase().includes(q) ||
      (p.extra || '').toLowerCase().includes(q)
    )
  })
  return list.slice(0, 300)
})

const graduatedCount = computed(() => Object.values(wordProgress.value).filter((p) => p.status === 'graduated').length)
const reviewCount = computed(() => Object.values(wordProgress.value).filter((p) => p.status === 'learning' || p.weak).length)
const masteryPercent = computed(() => {
  const total = degreeWords.length || VOCAB_REQUIREMENT.receptive
  return Math.round((graduatedCount.value / total) * 100)
})
const ringLen = computed(() => (masteryPercent.value / 100) * 314)
const streakDays = computed(() => settings.value.manualStreak ?? 0)
const daysToExam = computed(() => {
  if (!settings.value.examDate) return null
  const d = new Date(settings.value.examDate).getTime() - Date.now()
  return Math.max(0, Math.ceil(d / 86400000))
})

const trainingType = ref<QuestionType>('vocab_grammar')
const trainingTypeLabel = computed(() => EXAM_SECTIONS.find((s) => s.key === trainingType.value)?.name || '')
const questionsOfType = computed(() => degreeQuestions.filter((q) => q.type === trainingType.value))
const currentQ = ref<DegreeQuestion | null>(null)
const showAnswer = ref(false)
const myAnswer = ref('')

const previewVisible = ref(false)
const previewUrl = ref('')
const previewTitle = ref('')
const settingsVisible = ref(false)
const noteVisible = ref(false)
const noteInput = ref('')
const noteTitleInput = ref('')

function typeLabel(t?: QuestionType | null) {
  return EXAM_SECTIONS.find((s) => s.key === t)?.name || '通用'
}

async function loadAll() {
  settings.value = await svc.loadDegreeSettings()
  manualStreakInput.value = settings.value.manualStreak ?? 0
  wordProgress.value = await svc.loadWordProgress()
  mistakes.value = await svc.loadMistakes()
  notes.value = await svc.loadFavorites('note')
  wordBook.value = await svc.loadFavorites('word')
}

function startStudy() {
  activeTab.value = 'words'
}

function goTraining(key: QuestionType) {
  trainingType.value = key
  activeTab.value = 'training'
  pickQuestion()
}

function pickQuestion() {
  const list = questionsOfType.value
  if (list.length) {
    currentQ.value = list[Math.floor(Math.random() * list.length)] ?? null
    showAnswer.value = false
    myAnswer.value = ''
  } else {
    currentQ.value = null
  }
}
function revealAnswer() {
  showAnswer.value = true
  if (currentQ.value && myAnswer.value && myAnswer.value !== currentQ.value.answer) {
    svc.addMistake({ questionId: currentQ.value.id, type: currentQ.value.type, userAnswer: myAnswer.value, reason: `你的答案：${myAnswer.value}`, due: null })
  }
}
function isRight(o: string) {
  return currentQ.value?.answer === o
}
function nextQuestion() {
  pickQuestion()
}
async function markMistake(q: DegreeQuestion) {
  await svc.addMistake({ questionId: q.id, type: q.type, userAnswer: myAnswer.value || null, reason: q.explanation, due: null })
  mistakes.value = await svc.loadMistakes()
  ElMessage.success('已收入错题本')
}

async function cycleWord(word: string) {
  const cur = wordProgress.value[word]?.status || 'new'
  const next = cur === 'new' ? 'learning' : cur === 'learning' ? 'graduated' : 'new'
  const p: WordProgress = { status: next, level: 0, due: null, weak: false }
  wordProgress.value = { ...wordProgress.value, [word]: p }
  await svc.saveWordProgress(word, p)
}
async function addWordBook(w: { word: string; definition: string }) {
  await svc.addFavorite('word', `${w.word} ${w.definition}`)
  wordBook.value = await svc.loadFavorites('word')
  ElMessage.success('已加入生词本')
}

function openPreview(m: MaterialMeta) {
  previewUrl.value = base + m.file
  previewTitle.value = m.title
  previewVisible.value = true
}
function startMock(p: { id: string; title: string }) {
  ElMessage.info(`「${p.title}」原题题库生成后即可在线计时模考`)
}

async function saveSettings() {
  settings.value.manualStreak = manualStreakInput.value
  await svc.saveDegreeSettings(settings.value)
  settingsVisible.value = false
  ElMessage.success('已保存')
}

function addNote(prefix = '') {
  noteTitleInput.value = prefix
  noteInput.value = ''
  noteVisible.value = true
}
function addMaterialNote(title: string) {
  noteTitleInput.value = title
  noteInput.value = ''
  noteVisible.value = true
}
async function saveNote() {
  if (!noteInput.value.trim()) {
    ElMessage.warning('笔记内容不能为空')
    return
  }
  await svc.addFavorite('note', noteInput.value, null, noteTitleInput.value || null)
  notes.value = await svc.loadFavorites('note')
  noteVisible.value = false
  ElMessage.success('笔记已保存')
}

async function removeFav(id: string, isMistake = false) {
  await svc.removeFavorite(id)
  if (isMistake) mistakes.value = await svc.loadMistakes()
  else {
    notes.value = await svc.loadFavorites('note')
    wordBook.value = await svc.loadFavorites('word')
  }
}

onMounted(loadAll)
</script>

<style scoped>
.degree-view {
  max-width: 1180px;
  margin: 0 auto;
  padding: 4px 4px 40px;
}
.stat-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
  margin-bottom: 14px;
}
.stat-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 14px 16px;
  box-shadow: var(--shadow-card);
}
.stat-label {
  font-size: 13px;
  color: var(--text-muted);
}
.stat-num {
  font-size: 26px;
  font-weight: 600;
  margin-top: 4px;
  line-height: 1.1;
}
.unit {
  font-size: 13px;
  font-weight: 400;
  margin-left: 2px;
}
.tab-bar {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-bottom: 14px;
}
.tab-pill {
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--text-muted);
  border-radius: 20px;
  padding: 7px 16px;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.15s;
}
.tab-pill.active {
  background: #534ab7;
  color: #fff;
  border-color: #534ab7;
  font-weight: 600;
}
.panel {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 14px;
  padding: 18px;
  box-shadow: var(--shadow-card);
}
.card-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-strong);
}
.overview-top {
  display: flex;
  gap: 16px;
  align-items: stretch;
  flex-wrap: wrap;
}
.plan-card {
  flex: 1 1 320px;
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 16px;
  background: linear-gradient(180deg, #f6f5ff, #fff);
}
.plan-list {
  list-style: none;
  padding: 0;
  margin: 10px 0 14px;
  font-size: 14px;
  color: var(--text-strong);
  line-height: 2;
}
.ring-card {
  flex: 0 0 auto;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 10px 18px;
}
.ring-cap {
  font-size: 13px;
  color: var(--text-muted);
  margin-top: 6px;
}
.type-grid {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 10px;
}
.type-card {
  border: 1px solid var(--border);
  border-top: 3px solid #534ab7;
  border-radius: 10px;
  padding: 12px;
  cursor: pointer;
  background: #fff;
  transition: transform 0.12s;
}
.type-card:hover {
  transform: translateY(-2px);
}
.type-name {
  font-size: 14px;
  font-weight: 600;
}
.type-meta {
  font-size: 12px;
  color: var(--text-muted);
  margin: 6px 0;
}
.type-desc {
  font-size: 12px;
  color: var(--text-muted);
  line-height: 1.6;
}
.req-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}
.req-card {
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 14px;
}
.req-h {
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 8px;
  color: #534ab7;
}
.req-row {
  font-size: 13px;
  color: var(--text-strong);
  line-height: 1.9;
}
.grammar-item {
  font-size: 13px;
  color: var(--text-strong);
  line-height: 1.9;
}
.star {
  color: #993c1d;
  font-weight: 700;
}
.toolbar {
  display: flex;
  gap: 12px;
  align-items: center;
  flex-wrap: wrap;
  margin-bottom: 14px;
}
.word-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 10px;
}
.word-item {
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 12px;
}
.word-item.weak {
  border-color: #f09595;
  background: #fdf3f3;
}
.word-main {
  display: flex;
  align-items: baseline;
  gap: 8px;
  flex-wrap: wrap;
}
.word-text {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-strong);
}
.word-phon {
  font-size: 12px;
  color: var(--text-muted);
}
.word-pos {
  font-size: 12px;
  color: #185fa5;
}
.word-def {
  font-size: 13px;
  color: var(--text-strong);
  margin: 6px 0 10px;
  line-height: 1.6;
}
.word-ops {
  display: flex;
  gap: 8px;
}
.speak-btn {
  border: 1px solid var(--border);
  background: #fff;
  border-radius: 8px;
  width: 30px;
  height: 30px;
  font-size: 15px;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s;
}
.speak-btn:hover {
  border-color: #534ab7;
  background: #f3f1ff;
}
.speak-btn:disabled {
  opacity: 0.5;
  cursor: default;
}
.word-example {
  font-size: 12.5px;
  color: var(--text-strong);
  background: #f7f8ff;
  border-left: 3px solid #c9c2ff;
  border-radius: 6px;
  padding: 6px 8px;
  margin: 6px 0 8px;
  line-height: 1.6;
}
.ex-label {
  color: #6b5bd6;
  font-weight: 600;
  margin-right: 4px;
}
.word-src {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  margin-bottom: 8px;
}
.load-more {
  text-align: center;
  margin-top: 14px;
}
.quiz-card {
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 18px;
}
.quiz-stem {
  font-size: 15px;
  font-weight: 600;
  line-height: 1.7;
}
.quiz-passage {
  font-size: 13px;
  color: var(--text-muted);
  background: #f7f7fb;
  border-radius: 8px;
  padding: 10px;
  margin: 10px 0;
  line-height: 1.7;
}
.quiz-options {
  display: grid;
  gap: 8px;
  margin: 12px 0;
}
.opt {
  display: flex;
  align-items: center;
  gap: 8px;
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 10px 12px;
  cursor: pointer;
  font-size: 14px;
}
.opt.right {
  border-color: #0f6e56;
  background: #eaf3de;
}
.opt.wrong {
  border-color: #a32d2d;
  background: #fcebeb;
}
.quiz-actions {
  display: flex;
  gap: 10px;
  margin-top: 8px;
}
.quiz-explain {
  margin-top: 14px;
  border-top: 1px dashed var(--border);
  padding-top: 12px;
}
.ex-h {
  font-size: 14px;
}
.ex-b {
  font-size: 13px;
  color: var(--text-strong);
  line-height: 1.7;
  margin-top: 6px;
}
.ex-src {
  font-size: 12px;
  color: var(--text-muted);
  margin-top: 6px;
}
.paper-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 12px;
}
.paper-card {
  border: 1px solid var(--border);
  border-top: 3px solid #534ab7;
  border-radius: 10px;
  padding: 14px;
  text-align: center;
}
.paper-no {
  font-size: 13px;
  color: var(--text-muted);
}
.paper-title {
  font-size: 15px;
  font-weight: 600;
  margin: 4px 0;
}
.paper-note {
  font-size: 12px;
  color: var(--text-muted);
}
.paper-meta {
  font-size: 12px;
  color: #185fa5;
  margin: 8px 0 10px;
}
.material-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 12px;
}
.material-card {
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 16px;
}
.material-title {
  font-size: 15px;
  font-weight: 600;
}
.material-meta {
  font-size: 12px;
  color: var(--text-muted);
  margin: 8px 0 12px;
  line-height: 1.6;
}
.material-ops {
  display: flex;
  gap: 8px;
}
.lib-layout {
  display: grid;
  grid-template-columns: 280px 1fr;
  gap: 14px;
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 12px;
  min-height: 420px;
}
.lib-side {
  display: flex;
  flex-direction: column;
  gap: 10px;
  border-right: 1px solid var(--border);
  padding-right: 12px;
}
.lib-filter {
  flex-wrap: wrap;
}
.lib-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
  overflow-y: auto;
  max-height: 560px;
}
.lib-item {
  display: flex;
  gap: 6px;
  align-items: baseline;
  padding: 7px 8px;
  border-radius: 8px;
  cursor: pointer;
  font-size: 13px;
  line-height: 1.5;
}
.lib-item:hover {
  background: #f3f1ff;
}
.lib-item.active {
  background: #ece8ff;
  font-weight: 600;
}
.lib-book {
  flex: none;
  font-size: 11px;
  color: #6b5bd6;
  background: #efeaff;
  border-radius: 4px;
  padding: 0 5px;
}
.lib-title {
  color: var(--text-strong);
}
.lib-reader {
  overflow-y: auto;
  max-height: 600px;
  padding: 4px 8px;
}
.reader-head {
  display: flex;
  align-items: center;
  gap: 10px;
  position: sticky;
  top: 0;
  background: var(--bg, #fff);
  padding: 6px 0 10px;
  border-bottom: 1px solid var(--border);
  margin-bottom: 10px;
}
.reader-book {
  font-size: 11px;
  color: #6b5bd6;
  background: #efeaff;
  border-radius: 4px;
  padding: 2px 6px;
}
.reader-title {
  font-size: 16px;
  margin: 0;
  flex: 1;
  color: var(--text-strong);
}
.reader-body {
  font-size: 13.5px;
  line-height: 1.9;
  white-space: pre-wrap;
  color: var(--text-strong);
}
.rw-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 14px;
}
.rw-col {
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 14px;
}
.note-list {
  margin-top: 10px;
  display: grid;
  gap: 8px;
}
.note-item {
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 10px;
  display: flex;
  justify-content: space-between;
  gap: 10px;
  align-items: flex-start;
}
.note-body {
  font-size: 13px;
  line-height: 1.6;
  white-space: pre-wrap;
}
.muted {
  color: var(--text-muted);
  font-size: 12px;
}
.pdf-frame {
  width: 100%;
  height: 82vh;
  border: none;
  border-radius: 8px;
}
.phrase-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 10px;
}
.phrase-item {
  border: 1px solid var(--border);
  border-left: 3px solid #534ab7;
  border-radius: 10px;
  padding: 12px 14px;
}
.phrase-item.spoken {
  border-left-color: #0f6e56;
}
.phrase-item.affix {
  border-left-color: #185fa5;
}
.phrase-item.irregular {
  border-left-color: #854f0b;
}
.phrase-top {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
}
.phrase-en {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-strong);
  word-break: break-word;
}
.phrase-cat {
  font-size: 11px;
  color: #fff;
  background: #534ab7;
  border-radius: 10px;
  padding: 1px 8px;
  white-space: nowrap;
}
.phrase-item.spoken .phrase-cat {
  background: #0f6e56;
}
.phrase-item.affix .phrase-cat {
  background: #185fa5;
}
.phrase-item.irregular .phrase-cat {
  background: #854f0b;
}
.phrase-zh {
  font-size: 13px;
  color: var(--text-strong);
  margin-top: 6px;
  line-height: 1.6;
}
.phrase-extra {
  font-size: 12px;
  color: var(--text-muted);
  margin-top: 6px;
  line-height: 1.6;
  word-break: break-word;
}
@media (max-width: 900px) {
  .type-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .req-grid,
  .rw-grid {
    grid-template-columns: 1fr;
  }
  .lib-layout {
    grid-template-columns: 1fr;
  }
  .lib-side {
    border-right: none;
    border-bottom: 1px solid var(--border);
    padding-right: 0;
    padding-bottom: 10px;
  }
  .lib-list {
    max-height: 240px;
  }
}
@media (max-width: 560px) {
  .stat-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .type-grid {
    grid-template-columns: 1fr;
  }
  .panel {
    padding: 14px;
  }
}
</style>
