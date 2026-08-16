<template>
  <div class="dt">
    <h2 class="dt-title">高级训练</h2>
    <p class="dt-sub">闪卡记忆 · 听写 · 拼写 · 跟读 · 翻译，多模态强化词汇与句型。</p>

    <el-tabs v-model="mode" class="dt-tabs">
      <el-tab-pane label="闪卡" name="flash" />
      <el-tab-pane label="听写" name="dictation" />
      <el-tab-pane label="拼写" name="spelling" />
      <el-tab-pane label="跟读" name="shadow" />
      <el-tab-pane label="翻译" name="translate" />
    </el-tabs>

    <div class="dt-progress">
      <span>进度 {{ idx + 1 }} / {{ deck.length }}</span>
      <el-button text :icon="Refresh" @click="next(true)">换一个</el-button>
    </div>

    <el-card class="dt-card" shadow="never">
      <!-- 闪卡 -->
      <template v-if="mode === 'flash'">
        <div class="dt-front">{{ current.word }}</div>
        <div v-if="revealed" class="dt-back">
          <div><b>释义：</b>{{ current.definition }}</div>
          <div v-if="current.phonetic" class="dt-phon">/{{ current.phonetic }}/</div>
        </div>
        <div class="dt-actions">
          <el-button :icon="Microphone" @click="speak(current.word)">朗读</el-button>
          <el-button v-if="!revealed" type="primary" @click="revealed = true">显示释义</el-button>
          <template v-else>
            <el-button type="success" @click="next()">认识</el-button>
            <el-button type="warning" @click="next()">不认识</el-button>
          </template>
        </div>
      </template>

      <!-- 听写 -->
      <template v-else-if="mode === 'dictation'">
        <div class="dt-hint">听音频，写出单词拼写：</div>
        <div class="dt-actions">
          <el-button :icon="Microphone" type="primary" @click="speak(current.word)">播放读音</el-button>
        </div>
        <el-input v-model="answer" placeholder="在此输入单词" class="dt-input" @keyup.enter="check" />
        <div v-if="checked" class="dt-feedback" :class="correct ? 'ok' : 'bad'">
          {{ correct ? '正确！' : '正确答案：' + current.word }}
        </div>
        <div class="dt-actions" v-if="checked">
          <el-button type="primary" @click="next()">下一个</el-button>
        </div>
      </template>

      <!-- 拼写 -->
      <template v-else-if="mode === 'spelling'">
        <div class="dt-hint">根据释义写出单词：</div>
        <div class="dt-def">{{ current.definition }}</div>
        <el-input v-model="answer" placeholder="在此输入单词" class="dt-input" @keyup.enter="check" />
        <div v-if="checked" class="dt-feedback" :class="correct ? 'ok' : 'bad'">
          {{ correct ? '正确！' : '正确答案：' + current.word }}
          <span v-if="current.phonetic"> /{{ current.phonetic }}/</span>
        </div>
        <div class="dt-actions" v-if="checked">
          <el-button type="primary" @click="next()">下一个</el-button>
        </div>
      </template>

      <!-- 跟读 -->
      <template v-else-if="mode === 'shadow'">
        <div class="dt-front">{{ current.word }}</div>
        <div class="dt-def">{{ current.definition }}</div>
        <div class="dt-actions">
          <el-button :icon="Microphone" type="primary" @click="speak(current.word)">听音</el-button>
          <el-button @click="next()">我已跟读，下一个</el-button>
        </div>
      </template>

      <!-- 翻译 -->
      <template v-else>
        <div class="dt-hint">将下列英文翻译为中文：</div>
        <div class="dt-sentence">{{ currentTrans?.stem }}</div>
        <el-input v-model="answer" type="textarea" :rows="2" placeholder="在此输入中文翻译" class="dt-input" />
        <div v-if="checked" class="dt-feedback">
          <div class="dt-ref">参考译文：{{ currentTrans?.answer }}</div>
        </div>
        <div class="dt-actions">
          <el-button @click="revealRef">看参考</el-button>
          <el-button type="primary" @click="next()">下一个</el-button>
        </div>
      </template>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { Microphone, Refresh } from '@element-plus/icons-vue'
import { loadWords } from '../../../prep/degreeDb'
import { allDegreeQuestions } from '../../../prep/degreeQuestionBank'
import { speakEn } from '../../../prep/degreeSpeech'
import type { DegreeWord, DegreeQuestion } from '../../../prep/degreeTypes'

const mode = ref<'flash' | 'dictation' | 'spelling' | 'shadow' | 'translate'>('flash')
const words = ref<DegreeWord[]>([])
const idx = ref(0)
const revealed = ref(false)
const answer = ref('')
const checked = ref(false)
const correct = ref(false)

const deck = computed<DegreeWord[]>(() => {
  if (mode.value === 'translate') return [] // 翻译用句子，单独处理
  return words.value.length ? words.value : []
})
const transDeck = computed<DegreeQuestion[]>(() =>
  allDegreeQuestions.filter((q) => q.type === 'translation')
)
const current = computed<DegreeWord>(() => {
  const d = deck.value
  if (!d.length) return { word: '', definition: '' } as DegreeWord
  const item = d[idx.value % d.length]
  return (item ?? { word: '', definition: '' }) as DegreeWord
})
const currentTrans = computed<DegreeQuestion | null>(() => transDeck.value[idx.value % Math.max(transDeck.value.length, 1)] || null)

watch(mode, () => {
  idx.value = 0
  reset()
})

function reset() {
  revealed.value = false
  answer.value = ''
  checked.value = false
  correct.value = false
}
function next(force = false) {
  if (mode.value === 'translate') {
    idx.value = (idx.value + 1) % Math.max(transDeck.value.length, 1)
  } else {
    idx.value = (idx.value + 1) % Math.max(deck.value.length, 1)
  }
  reset()
  if (force) speak(current.value.word)
}
function speak(w: string) {
  speakEn(w)
}
function check() {
  checked.value = true
  correct.value = answer.value.trim().toLowerCase() === current.value.word.trim().toLowerCase()
}
function revealRef() {
  checked.value = true
}

onMounted(async () => {
  try {
    words.value = await loadWords()
  } catch {
    /* 兜底 */
  }
})
</script>

<style scoped>
.dt {
  max-width: 760px;
  margin: 0 auto;
  padding: 16px;
}
.dt-title {
  margin: 0 0 4px;
  font-size: 20px;
  font-weight: 700;
  color: #2c2c3a;
}
.dt-sub {
  margin: 0 0 14px;
  color: #8a8aa0;
  font-size: 13px;
}
.dt-progress {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 13px;
  color: #6a6a80;
  margin-bottom: 10px;
}
.dt-card {
  border-radius: 14px;
  min-height: 220px;
  display: flex;
  flex-direction: column;
  justify-content: center;
}
.dt-front {
  font-size: 30px;
  font-weight: 700;
  color: #534ab7;
  text-align: center;
  margin-bottom: 12px;
}
.dt-back {
  text-align: center;
  color: #4a4a5a;
  font-size: 15px;
  margin-bottom: 12px;
}
.dt-phon {
  color: #9a9ab0;
  font-size: 13px;
  margin-top: 4px;
}
.dt-hint {
  text-align: center;
  color: #6a6a80;
  font-size: 14px;
  margin-bottom: 10px;
}
.dt-def {
  text-align: center;
  color: #2c2c3a;
  font-size: 16px;
  margin: 8px 0;
}
.dt-sentence {
  text-align: center;
  color: #2c2c3a;
  font-size: 17px;
  line-height: 1.6;
  margin: 8px 0 14px;
}
.dt-input {
  margin: 10px auto;
  max-width: 420px;
}
.dt-actions {
  display: flex;
  gap: 10px;
  justify-content: center;
  flex-wrap: wrap;
  margin-top: 14px;
}
.dt-feedback {
  text-align: center;
  margin-top: 10px;
  font-size: 14px;
}
.dt-feedback.ok {
  color: #2e9e6b;
}
.dt-feedback.bad {
  color: #b23b5b;
}
.dt-ref {
  color: #4a4a5a;
}
</style>
