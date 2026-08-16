<template>
  <div class="dex">
    <h2 class="dex-title">模拟考试</h2>
    <p class="dex-sub">5 套全真模拟卷，含答案解析与考点点睛，按真实考试结构组卷。</p>

    <div class="dex-grid">
      <el-card v-for="p in papers" :key="p.id" class="dex-card" shadow="hover">
        <div class="dex-no">第 {{ p.no }} 套</div>
        <div class="dex-name">{{ p.title }}</div>
        <div class="dex-note">{{ p.note }}</div>
        <el-button type="primary" @click="start(p)">开始考试</el-button>
      </el-card>
    </div>

    <MockExamDialog
      v-model="visible"
      :paper="selected"
      :all-questions="allQuestions"
      @submit="onExamSubmit"
    />
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { ElMessage } from 'element-plus'
import MockExamDialog from '../../../components/degree/MockExamDialog.vue'
import { MOCK_PAPERS } from '../../../prep/degreeExamStructure'
import { allDegreeQuestions } from '../../../prep/degreeQuestionBank'
import * as svc from '../../../prep/degreeService'

const papers = MOCK_PAPERS
const allQuestions = allDegreeQuestions
const visible = ref(false)
const selected = ref<{ id: string; title: string; no: number }>(papers[0]!)

function start(p: { id: string; title: string; no: number }) {
  selected.value = p
  visible.value = true
}
function onExamSubmit(result: { score: number; seconds: number }) {
  svc.recordExam(selected.value.id, allQuestions.length, result.score, result.seconds, {}).catch(() => {})
  ElMessage.success(`考试完成：得分 ${result.score} / ${allQuestions.length}`)
}
</script>

<style scoped>
.dex {
  max-width: 1100px;
  margin: 0 auto;
  padding: 16px;
}
.dex-title {
  margin: 0 0 4px;
  font-size: 20px;
  font-weight: 700;
  color: #2c2c3a;
}
.dex-sub {
  margin: 0 0 16px;
  color: #8a8aa0;
  font-size: 13px;
}
.dex-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 14px;
}
.dex-card {
  border-radius: 14px;
  text-align: center;
}
.dex-no {
  font-size: 13px;
  color: #534ab7;
  font-weight: 700;
}
.dex-name {
  font-size: 17px;
  font-weight: 700;
  color: #2c2c3a;
  margin: 6px 0;
}
.dex-note {
  font-size: 12px;
  color: #8a8aa0;
  margin-bottom: 12px;
}
</style>
