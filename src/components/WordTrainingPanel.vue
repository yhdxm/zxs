<template>
  <div class="wtp">
    <div class="wtp-head">
      <el-button text :icon="ArrowLeft" @click="emit('close')">返回</el-button>
      <span class="wtp-title">
        {{ titleText }}
      </span>
      <span></span>
    </div>

    <el-tabs v-model="innerMode" class="wtp-tabs" type="border-card">
      <el-tab-pane label="闪卡" name="flash" />
      <el-tab-pane label="听写" name="dictation" />
      <el-tab-pane label="拼写" name="spelling" />
      <el-tab-pane label="跟读" name="shadow" />
      <el-tab-pane v-if="props.source !== 'cet'" label="翻译" name="translate" />
    </el-tabs>

    <div class="wtp-progress">
      <span>进度 {{ idx + 1 }} / {{ totalCount || 1 }}</span>
      <el-button text :icon="Refresh" @click="next(true)">换一个</el-button>
    </div>

    <el-card class="wtp-card" shadow="never">
      <!-- 闪卡 -->
      <template v-if="innerMode === 'flash'">
        <div class="wtp-front">{{ current.word || '暂无单词' }}</div>
        <div v-if="revealed && current.definition" class="wtp-back">
          <div><b>释义：</b>{{ current.definition }}</div>
          <div v-if="current.phonetic" class="wtp-phon">/{{ current.phonetic }}/</div>
          <div v-if="current.kind === 'phrase'" class="wtp-tag">词组 / 搭配</div>
        </div>
        <div v-else-if="revealed && !current.definition" class="wtp-back">（暂无释义）</div>
        <div class="wtp-actions">
          <el-button :icon="Microphone" @click="speak(current.word)">朗读</el-button>
          <el-button v-if="!revealed" type="primary" @click="revealed = true">显示释义</el-button>
          <template v-else>
            <el-button type="success" @click="next()">认识</el-button>
            <el-button type="warning" @click="next()">不认识</el-button>
          </template>
        </div>
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
          <el-button type="primary" @click="next()">下一个</el-button>
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
          <el-button type="primary" @click="next()">下一个</el-button>
        </div>
      </template>

      <!-- 跟读 -->
      <template v-else-if="innerMode === 'shadow'">
        <div class="wtp-front">{{ current.word || '暂无单词' }}</div>
        <div class="wtp-def">{{ current.definition }}</div>
        <div class="wtp-actions">
          <el-button :icon="Microphone" type="primary" @click="speak(current.word)">听音</el-button>
          <el-button @click="next()">我已跟读，下一个</el-button>
        </div>
      </template>

      <!-- 翻译（仅学位英语） -->
      <template v-else>
        <div class="wtp-hint">将下列英文翻译为中文：</div>
        <div class="wtp-sentence">{{ currentTrans?.stem || '暂无句子' }}</div>
        <el-input v-model="answer" type="textarea" :rows="2" placeholder="在此输入中文翻译" class="wtp-input" />
        <div v-if="checked" class="wtp-feedback">
          <div class="wtp-ref">参考译文：{{ currentTrans?.answer }}</div>
        </div>
        <div class="wtp-actions">
          <el-button @click="revealRef">看参考</el-button>
          <el-button type="primary" @click="next()">下一个</el-button>
        </div>
      </template>
    </el-card>

    <el-empty
      v-if="!loadingItems && innerMode !== 'translate' && deck.length === 0"
      :description="emptyText"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { Microphone, Refresh, ArrowLeft } from '@element-plus/icons-vue'
import { loadWords, loadPhrases } from '../prep/degreeDb'
import { allDegreeQuestions } from '../prep/degreeQuestionBank'
import { speakEn } from '../prep/degreeSpeech'
import { MASTER_WORDS_BUNDLE } from '../prep/masterWordsBundle'
import { CET6_WORDS_BUNDLE } from '../prep/cet6WordsBundle'
import type { DegreeWord, DegreePhrase, DegreeQuestion } from '../prep/degreeTypes'
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
const loadingItems = ref(false)
const idx = ref(0)
const revealed = ref(false)
const answer = ref('')
const checked = ref(false)
const correct = ref(false)

const titleText = computed(() => {
  if (props.source === 'cet') return props.cetLevel === 'cet6' ? '六级单词卡训练' : '四级单词卡训练'
  return '背单词卡训练'
})
const emptyText = computed(() => {
  if (props.source === 'cet' && props.cetLevel === 'cet6') return '六级词库待补充：将免费六级词表放入 scripts/cet6_words.csv 后运行生成脚本'
  return '该词库暂无数据'
})

const deck = computed<TrainItem[]>(() => items.value)
const transDeck = computed<DegreeQuestion[]>(() =>
  allDegreeQuestions.filter((q) => q.type === 'translation')
)
const totalCount = computed(() => (innerMode.value === 'translate' ? transDeck.value.length : deck.value.length))
const current = computed<TrainItem>(() => {
  const d = deck.value
  if (!d.length) return { word: '', definition: '', kind: 'word' }
  const item = d[idx.value % d.length]
  return (item ?? { word: '', definition: '', kind: 'word' }) as TrainItem
})
const currentTrans = computed<DegreeQuestion | null>(() =>
  transDeck.value[idx.value % Math.max(transDeck.value.length, 1)] || null
)

watch(innerMode, () => {
  idx.value = 0
  reset()
})

function wordToTrain(w: DegreeWord): TrainItem {
  return { word: w.word, definition: w.definition, phonetic: w.phonetic, kind: 'word' }
}
function phraseToTrain(p: DegreePhrase): TrainItem {
  return {
    word: p.en,
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
      const [w, ph] = await Promise.all([loadWords(), loadPhrases()])
      items.value = [...w.map(wordToTrain), ...ph.map(phraseToTrain)]
    }
  } catch {
    items.value = []
  }
  loadingItems.value = false
}

watch(() => [props.source, props.cetLevel], () => {
  idx.value = 0
  reset()
  void loadItems()
})

function reset() {
  revealed.value = false
  answer.value = ''
  checked.value = false
  correct.value = false
}
function next(force = false) {
  if (innerMode.value === 'translate') {
    idx.value = (idx.value + 1) % Math.max(transDeck.value.length, 1)
  } else {
    idx.value = (idx.value + 1) % Math.max(deck.value.length, 1)
  }
  reset()
  if (force && current.value.word) speak(current.value.word)
}
function speak(w: string) {
  if (w) speakEn(w)
}
function check() {
  checked.value = true
  correct.value = answer.value.trim().toLowerCase() === current.value.word.trim().toLowerCase()
}
function revealRef() {
  checked.value = true
}

onMounted(async () => {
  await loadItems()
})
</script>

<style scoped>
.wtp { padding: 4px 0; }
.wtp-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; }
.wtp-title { font-size: 16px; font-weight: 700; color: var(--text-strong); }
.wtp-tabs { margin-bottom: 12px; }
.wtp-progress {
  display: flex; justify-content: space-between; align-items: center;
  font-size: 13px; color: var(--text-muted); margin-bottom: 10px;
}
.wtp-card {
  border-radius: 12px; min-height: 220px;
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
  display: inline-block; margin-top: 8px; font-size: 12px; color: #0891b2;
  border: 1px solid #0891b2; border-radius: 6px; padding: 1px 8px;
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
</style>
