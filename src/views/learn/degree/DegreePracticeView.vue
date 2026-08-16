<template>
  <div class="dpv">
    <h2 class="dpv-title">专项练习</h2>
    <p class="dpv-sub">按题型针对性突破；选择题即时判分，翻译/写作提供参考答案。</p>

    <div class="dpv-toolbar">
      <el-radio-group v-model="type" size="small">
        <el-radio-button v-for="t in types" :key="t.key" :value="t.key">{{ t.label }}</el-radio-button>
      </el-radio-group>
      <el-tag type="info" effect="plain" round>本类 {{ pool.length }} 题</el-tag>
    </div>

    <el-card class="dpv-card" shadow="never" v-if="current">
      <div class="dpv-meta">
        <el-tag size="small">{{ typeLabel }}</el-tag>
        <span v-if="current.difficulty" class="dpv-diff">难度 {{ '★'.repeat(current.difficulty) }}</span>
      </div>
      <div class="dpv-stem">{{ current.stem }}</div>
      <div v-if="current.passage" class="dpv-passage">{{ current.passage }}</div>

      <!-- 选择题 -->
      <div v-if="isChoice" class="dpv-options">
        <button
          v-for="(opt, i) in current.options"
          :key="i"
          class="dpv-opt"
          :class="optClass(i)"
          :disabled="checked"
          @click="choose(i)"
        >
          <span class="dpv-opt-letter">{{ letter(i) }}</span>
          <span class="dpv-opt-text">{{ opt }}</span>
        </button>
      </div>
      <!-- 翻译/写作 -->
      <div v-else class="dpv-free">
        <el-input v-model="freeAnswer" type="textarea" :rows="3" placeholder="在此作答…" />
      </div>

      <div v-if="checked" class="dpv-explain">
        <div class="dpv-ans">
          参考答案：
          <b>{{ isChoice ? current.answer : current.answer }}</b>
        </div>
        <div class="dpv-exp" v-if="current.explanation">{{ current.explanation }}</div>
      </div>

      <div class="dpv-actions">
        <el-button v-if="!checked" type="primary" @click="submit">提交</el-button>
        <el-button v-else type="primary" @click="next">下一题</el-button>
        <span class="dpv-score">本次正确 {{ score.correct }} / {{ score.total }}</span>
      </div>
    </el-card>
    <el-empty v-else description="该题型暂无题目" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { loadQuestions } from '../../../prep/degreeDb'
import * as svc from '../../../prep/degreeService'
import type { DegreeQuestion, QuestionType } from '../../../prep/degreeTypes'

const route = useRoute()

const types: { key: QuestionType; label: string }[] = [
  { key: 'vocab_grammar', label: '词汇语法' },
  { key: 'dialogue', label: '完成对话' },
  { key: 'reading', label: '阅读理解' },
  { key: 'translation', label: '英译汉' },
  { key: 'writing', label: '短文写作' }
]
const typeKeys = types.map((t) => t.key)
// 支持从薄弱点分析等页面带 query.type 直接定位题型；非法/缺省回退到词汇语法。
function resolveInitialType(): QuestionType {
  const q = route.query.type
  return typeKeys.includes(q as QuestionType) ? (q as QuestionType) : 'vocab_grammar'
}
const type = ref<QuestionType>(resolveInitialType())
const all = ref<DegreeQuestion[]>([])
const idx = ref(0)
const selected = ref<number>(-1)
const checked = ref(false)
const freeAnswer = ref('')
const score = ref({ total: 0, correct: 0 })

const pool = computed(() => all.value.filter((q) => q.type === type.value))
const current = computed<DegreeQuestion | null>(() => pool.value[idx.value % Math.max(pool.value.length, 1)] || null)
const isChoice = computed(() => !!current.value?.options && current.value.options.length > 0)
const typeLabel = computed(() => types.find((t) => t.key === type.value)?.label || '')

function letter(i: number) {
  return String.fromCharCode(65 + i)
}
function optClass(i: number) {
  if (!checked.value) return selected.value === i ? 'sel' : ''
  const ansIdx = current.value ? current.value.answer.charCodeAt(0) - 65 : -1
  if (i === ansIdx) return 'right'
  if (i === selected.value) return 'wrong'
  return ''
}
function choose(i: number) {
  if (checked.value) return
  selected.value = i
}
function submit() {
  if (isChoice.value) {
    if (selected.value < 0) return
    checked.value = true
    const ansIdx = current.value!.answer.charCodeAt(0) - 65
    const ok = selected.value === ansIdx
    score.value.total++
    if (ok) score.value.correct++
    svc.addPractice(type.value, 1, ok ? 1 : 0).catch(() => {})
  } else {
    checked.value = true
    score.value.total++
    svc.addPractice(type.value, 1, 0).catch(() => {})
  }
}
function next() {
  idx.value = (idx.value + 1) % Math.max(pool.value.length, 1)
  selected.value = -1
  checked.value = false
  freeAnswer.value = ''
}
watch(type, () => {
  idx.value = 0
  selected.value = -1
  checked.value = false
  freeAnswer.value = ''
})

onMounted(async () => {
  try {
    all.value = await loadQuestions()
  } catch {
    /* 兜底在 degreeDb */
  }
})
</script>

<style scoped>
.dpv {
  max-width: 820px;
  margin: 0 auto;
  padding: 16px;
}
.dpv-title {
  margin: 0 0 4px;
  font-size: 20px;
  font-weight: 700;
  color: #2c2c3a;
}
.dpv-sub {
  margin: 0 0 14px;
  color: #8a8aa0;
  font-size: 13px;
}
.dpv-toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  align-items: center;
  margin-bottom: 14px;
}
.dpv-card {
  border-radius: 14px;
}
.dpv-meta {
  display: flex;
  gap: 10px;
  align-items: center;
  margin-bottom: 10px;
}
.dpv-diff {
  font-size: 12px;
  color: #c2691d;
}
.dpv-stem {
  font-size: 16px;
  color: #2c2c3a;
  line-height: 1.6;
  margin-bottom: 10px;
}
.dpv-passage {
  background: #f7f7fb;
  border-radius: 10px;
  padding: 10px 12px;
  font-size: 13px;
  color: #4a4a5a;
  line-height: 1.7;
  margin-bottom: 12px;
  white-space: pre-wrap;
}
.dpv-options {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.dpv-opt {
  display: flex;
  gap: 10px;
  align-items: center;
  text-align: left;
  border: 1px solid #e6e6f0;
  background: #fff;
  border-radius: 10px;
  padding: 10px 12px;
  cursor: pointer;
  font-size: 14px;
  color: #2c2c3a;
  transition: border-color 0.15s, background 0.15s;
}
.dpv-opt:hover {
  border-color: #534ab7;
}
.dpv-opt.sel {
  border-color: #534ab7;
  background: #f0effb;
}
.dpv-opt.right {
  border-color: #2e9e6b;
  background: #eafaf2;
}
.dpv-opt.wrong {
  border-color: #b23b5b;
  background: #fdeef2;
}
.dpv-opt-letter {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: #eceaff;
  color: #534ab7;
  font-weight: 700;
  flex-shrink: 0;
}
.dpv-free {
  margin: 10px 0;
}
.dpv-explain {
  margin-top: 12px;
  padding: 12px;
  background: #f7f7fb;
  border-radius: 10px;
}
.dpv-ans {
  font-size: 14px;
  color: #2c2c3a;
}
.dpv-exp {
  margin-top: 6px;
  font-size: 13px;
  color: #4a4a5a;
  line-height: 1.6;
}
.dpv-actions {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 14px;
}
.dpv-score {
  font-size: 13px;
  color: #6a6a80;
}
</style>
