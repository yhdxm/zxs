<template>
  <div class="dmine">
    <h2 class="dmine-title">我的</h2>
    <p class="dmine-sub">备考设置、学习数据与多端同步状态。</p>

    <el-card class="dmine-card" shadow="never">
      <template #header><span class="dmine-h">备考设置</span></template>
      <el-form label-width="120px" class="dmine-form">
        <el-form-item label="目标院校">
          <el-input v-model="settings.targetSchool" placeholder="如：商丘师范学院继续教育学院" />
        </el-form-item>
        <el-form-item label="考试日期">
          <el-date-picker v-model="examDate" type="date" placeholder="选择考试日" value-format="YYYY-MM-DD" />
        </el-form-item>
        <el-form-item label="每日新词">
          <el-input-number v-model="settings.newPerDay" :min="1" :max="100" />
        </el-form-item>
        <el-form-item label="连续天数">
          <el-input-number v-model="settings.manualStreak" :min="0" :max="999" />
          <span class="dmine-tip">手动校准连续学习天数</span>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="save" :loading="saving">保存设置</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-card class="dmine-card" shadow="never">
      <template #header><span class="dmine-h">学习数据</span></template>
      <div class="dmine-stats">
        <div class="dmine-stat"><div class="dmine-num">{{ counts.notes }}</div><div class="dmine-lbl">笔记</div></div>
        <div class="dmine-stat"><div class="dmine-num">{{ counts.collections }}</div><div class="dmine-lbl">收藏</div></div>
        <div class="dmine-stat"><div class="dmine-num">{{ counts.words }}</div><div class="dmine-lbl">生词本</div></div>
        <div class="dmine-stat"><div class="dmine-num">{{ counts.mistakes }}</div><div class="dmine-lbl">错题</div></div>
      </div>
    </el-card>

    <el-card class="dmine-card" shadow="never">
      <template #header><span class="dmine-h">多端同步</span></template>
      <div class="dmine-sync">
        <el-tag :type="pending > 0 ? 'warning' : 'success'" effect="light" round>
          {{ pending > 0 ? `待同步 ${pending} 条` : '已同步至云端' }}
        </el-tag>
        <el-button text :icon="Refresh" @click="refresh">刷新状态</el-button>
      </div>
      <p class="dmine-note">学习数据以 Supabase 为唯一真相源，离线时的改动会在恢复网络后自动补发。</p>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, watch, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { Refresh } from '@element-plus/icons-vue'
import * as svc from '../../../prep/degreeService'
import { pendingSyncCount } from '../../../prep/degreeService'
import type { DegreeSettings } from '../../../prep/degreeTypes'

const settings = reactive<DegreeSettings>({ targetSchool: null, examDate: null, newPerDay: 15, manualStreak: null })
const examDate = ref<string | null>(null)
const saving = ref(false)
const pending = ref(0)
const counts = reactive({ notes: 0, collections: 0, words: 0, mistakes: 0 })

watch(examDate, (v) => {
  settings.examDate = v
})

async function save() {
  saving.value = true
  try {
    await svc.saveDegreeSettings(settings)
    ElMessage.success('已保存')
  } catch {
    ElMessage.error('保存失败，请重试')
  } finally {
    saving.value = false
  }
}
async function refresh() {
  pending.value = pendingSyncCount()
  try {
    const [notes, collections, words, mistakes] = await Promise.all([
      svc.loadFavorites('note'),
      svc.loadFavorites('collection'),
      svc.loadFavorites('word'),
      svc.loadMistakes()
    ])
    counts.notes = notes.length
    counts.collections = collections.length
    counts.words = words.length
    counts.mistakes = mistakes.filter((m) => !m.removed).length
  } catch {
    /* 忽略 */
  }
}
onMounted(async () => {
  try {
    const s = await svc.loadDegreeSettings()
    Object.assign(settings, s)
    examDate.value = s.examDate
  } catch {
    /* 忽略 */
  }
  await refresh()
})
</script>

<style scoped>
.dmine {
  max-width: 900px;
  margin: 0 auto;
  padding: 16px;
}
.dmine-title {
  margin: 0 0 4px;
  font-size: 20px;
  font-weight: 700;
  color: #2c2c3a;
}
.dmine-sub {
  margin: 0 0 16px;
  color: #8a8aa0;
  font-size: 13px;
}
.dmine-card {
  border-radius: 14px;
  margin-bottom: 14px;
}
.dmine-h {
  font-weight: 700;
  color: #2c2c3a;
}
.dmine-tip {
  margin-left: 10px;
  font-size: 12px;
  color: #9a9ab0;
}
.dmine-stats {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 10px;
}
.dmine-stat {
  text-align: center;
  background: #f7f7fb;
  border-radius: 12px;
  padding: 14px;
}
.dmine-num {
  font-size: 24px;
  font-weight: 700;
  color: #534ab7;
}
.dmine-lbl {
  font-size: 12px;
  color: #6a6a80;
  margin-top: 4px;
}
.dmine-sync {
  display: flex;
  align-items: center;
  gap: 12px;
}
.dmine-note {
  margin: 10px 0 0;
  font-size: 12px;
  color: #9a9ab0;
}
@media (max-width: 768px) {
  .dmine-stats {
    grid-template-columns: repeat(2, 1fr);
  }
}
</style>
