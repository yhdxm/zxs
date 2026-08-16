<template>
  <div class="dp-home">
    <header class="dp-hero">
      <div class="dp-hero-left">
        <h2 class="dp-title">学位英语备考台 2.0</h2>
        <p class="dp-sub">
          严格依据三本 PDF（考试大纲 / 复习指南 / 模拟试卷），词库·题库·词组已落地云端，离线可用。
        </p>
      </div>
      <div class="dp-hero-right">
        <el-tag v-if="seededFromCloud" type="success" effect="light" round>云端数据已同步</el-tag>
        <el-tag v-else type="info" effect="light" round>使用本地内置内容</el-tag>
      </div>
    </header>

    <!-- 内容数据概况 -->
    <section class="dp-section">
      <h3 class="dp-h3">内容资源</h3>
      <div class="dp-stat-grid">
        <div class="dp-stat-card">
          <div class="dp-stat-val">{{ stats.words }}</div>
          <div class="dp-stat-label">词库总量</div>
          <div class="dp-stat-sub">复用式 {{ stats.productive }} 词</div>
        </div>
        <div class="dp-stat-card">
          <div class="dp-stat-val">{{ stats.questions }}</div>
          <div class="dp-stat-label">题库总量</div>
          <div class="dp-stat-sub">五大题型</div>
        </div>
        <div class="dp-stat-card">
          <div class="dp-stat-val">{{ stats.phrases }}</div>
          <div class="dp-stat-label">词组 / 语句</div>
          <div class="dp-stat-sub">大纲附录二~八</div>
        </div>
        <div class="dp-stat-card">
          <div class="dp-stat-val">{{ stats.materials }}</div>
          <div class="dp-stat-label">备考资料</div>
          <div class="dp-stat-sub">PDF 原版</div>
        </div>
      </div>
    </section>

    <!-- 个人学习进度 -->
    <section class="dp-section">
      <h3 class="dp-h3">我的进度</h3>
      <div class="dp-stat-grid">
        <div class="dp-stat-card alt">
          <div class="dp-stat-val">{{ progress.learned }}</div>
          <div class="dp-stat-label">已学单词</div>
        </div>
        <div class="dp-stat-card alt">
          <div class="dp-stat-val">{{ progress.streak }}</div>
          <div class="dp-stat-label">连续学习(天)</div>
        </div>
        <div class="dp-stat-card alt">
          <div class="dp-stat-val">{{ progress.accuracy }}%</div>
          <div class="dp-stat-label">练习正确率</div>
        </div>
        <div class="dp-stat-card alt">
          <div class="dp-stat-val">{{ progress.mistakes }}</div>
          <div class="dp-stat-label">错题数</div>
        </div>
      </div>
    </section>

    <!-- 八大模块入口 -->
    <section class="dp-section">
      <h3 class="dp-h3">学习模块</h3>
      <div class="dp-module-grid">
        <router-link
          v-for="m in modules"
          :key="m.to"
          :to="m.to"
          class="dp-module-card"
          :style="{ borderColor: m.color }"
        >
          <span class="dp-module-icon" :style="{ background: m.color }">
            <el-icon :size="22"><component :is="m.icon" /></el-icon>
          </span>
          <span class="dp-module-name">{{ m.name }}</span>
          <span class="dp-module-desc">{{ m.desc }}</span>
        </router-link>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import {
  Document,
  Notebook,
  Reading,
  Picture,
  VideoPlay,
  List,
  Medal,
  User,
  DataBoard
} from '@element-plus/icons-vue'
import { loadWords, loadQuestions, loadPhrases, ensureContentSeeded } from '../../../prep/degreeDb'
import * as svc from '../../../prep/degreeService'
import { MATERIALS } from '../../../prep/degreeExamStructure'

const seededFromCloud = ref(false)
const stats = reactive({ words: 0, productive: 0, questions: 0, phrases: 0, materials: MATERIALS.length })
const progress = reactive({ learned: 0, streak: 0, accuracy: 0, mistakes: 0 })

const modules = [
  { name: '资料中心', desc: '三本 PDF 预览与下载', to: '/degree/materials', icon: Document, color: '#534ab7' },
  { name: '阅读器', desc: 'PDF 阅读 · 朗读 · 划词翻译', to: '/degree/reader', icon: Reading, color: '#3c3489' },
  { name: '生词词库', desc: '词汇背诵 · 记忆曲线复习', to: '/degree/words', icon: Notebook, color: '#2f8bbd' },
  { name: '高级训练', desc: '闪卡 / 听写 / 拼写 / 跟读', to: '/degree/training', icon: VideoPlay, color: '#c2691d' },
  { name: '专项练习', desc: '按题型针对性突破', to: '/degree/practice', icon: List, color: '#2e9e6b' },
  { name: '模拟考试', desc: '5 套全真模拟卷', to: '/degree/exam', icon: Medal, color: '#b23b5b' },
  { name: '我的', desc: '设置 · 笔记 · 错题 · 同步', to: '/degree/mine', icon: User, color: '#7a5cc2' },
  { name: '综合训练', desc: '原版一站式备考台', to: '/learn/degree-english', icon: DataBoard, color: '#555' }
]

onMounted(async () => {
  // 触发内容落地（首次打开自动注入云端），并读取真实计数
  const seeded = await ensureContentSeeded().catch(() => false)
  seededFromCloud.value = !!seeded
  try {
    const [words, questions, phrases] = await Promise.all([loadWords(), loadQuestions(), loadPhrases()])
    stats.words = words.length
    stats.productive = words.filter((w) => w.productive).length
    stats.questions = questions.length
    stats.phrases = phrases.length
  } catch {
    /* 兜底在 degreeDb 内部已完成 */
  }
  // 个人进度
  try {
    const [prog, settings, prac, mistakes] = await Promise.all([
      svc.loadWordProgress(),
      svc.loadDegreeSettings(),
      svc.loadPractice(),
      svc.loadMistakes()
    ])
    progress.learned = Object.keys(prog).length
    progress.streak = settings.manualStreak ?? 0
    const total = prac.reduce((s, p) => s + p.total, 0)
    const correct = prac.reduce((s, p) => s + p.correct, 0)
    progress.accuracy = total ? Math.round((correct / total) * 100) : 0
    progress.mistakes = mistakes.filter((m) => !m.removed).length
  } catch {
    /* 忽略 */
  }
})
</script>

<style scoped>
.dp-home {
  max-width: 1100px;
  margin: 0 auto;
  padding: 16px;
}
.dp-hero {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: center;
  justify-content: space-between;
  background: linear-gradient(135deg, #534ab7, #3c3489);
  color: #fff;
  border-radius: 16px;
  padding: 20px 22px;
  margin-bottom: 18px;
}
.dp-title {
  margin: 0 0 6px;
  font-size: 22px;
  font-weight: 700;
}
.dp-sub {
  margin: 0;
  opacity: 0.92;
  font-size: 13px;
  line-height: 1.6;
  max-width: 620px;
}
.dp-section {
  margin-bottom: 20px;
}
.dp-h3 {
  margin: 0 0 12px;
  font-size: 16px;
  font-weight: 600;
  color: #2c2c3a;
}
.dp-stat-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 12px;
}
.dp-stat-card {
  background: #fff;
  border: 1px solid #eceaff;
  border-radius: 14px;
  padding: 16px;
  box-shadow: 0 2px 10px rgba(83, 74, 183, 0.06);
}
.dp-stat-card.alt {
  border-color: #e6f0ff;
}
.dp-stat-val {
  font-size: 26px;
  font-weight: 700;
  color: #534ab7;
  line-height: 1.1;
}
.dp-stat-card.alt .dp-stat-val {
  color: #2f8bbd;
}
.dp-stat-label {
  margin-top: 6px;
  font-size: 13px;
  color: #4a4a5a;
  font-weight: 600;
}
.dp-stat-sub {
  margin-top: 2px;
  font-size: 11px;
  color: #9a9ab0;
}
.dp-module-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 14px;
}
.dp-module-card {
  display: flex;
  flex-direction: column;
  gap: 8px;
  text-decoration: none;
  background: #fff;
  border: 1px solid #eceaff;
  border-left-width: 4px;
  border-radius: 14px;
  padding: 16px;
  transition: transform 0.15s, box-shadow 0.15s;
  color: #2c2c3a;
}
.dp-module-card:hover {
  transform: translateY(-3px);
  box-shadow: 0 8px 20px rgba(83, 74, 183, 0.12);
}
.dp-module-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 42px;
  height: 42px;
  border-radius: 12px;
  color: #fff;
}
.dp-module-name {
  font-size: 15px;
  font-weight: 700;
}
.dp-module-desc {
  font-size: 12px;
  color: #8a8aa0;
  line-height: 1.5;
}
@media (max-width: 768px) {
  .dp-hero {
    padding: 16px;
  }
  .dp-title {
    font-size: 19px;
  }
  .dp-stat-val {
    font-size: 22px;
  }
}
</style>
