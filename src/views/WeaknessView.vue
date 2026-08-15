<template>
  <div class="wk-view">
    <header class="wk-header">
      <div class="wk-h-left">
        <span class="wk-h-icon"><el-icon :size="20" color="#fff"><Odometer /></el-icon></span>
        <div class="wk-h-text">
          <h2 class="wk-h-title">薄弱点分析</h2>
          <p class="wk-h-sub">本地启发式归因：按题型 / 错因 / 知识点聚合你的错题，定位最该补的地方。</p>
        </div>
      </div>
      <el-button :icon="Refresh" :loading="loading" @click="load">重新分析</el-button>
    </header>

    <!-- 范围切换 -->
    <div class="wk-tabs">
      <button class="wk-tab" :class="{ active: scope === 'cet' }" @click="scope = 'cet'">四六级</button>
      <button class="wk-tab" :class="{ active: scope === 'degree' }" @click="scope = 'degree'">学位英语</button>
    </div>

    <!-- 启发式声明（对应 Non-goals：非 AI 评级） -->
    <div class="wk-note">
      <el-icon><Warning /></el-icon>
      <span>启发式诊断，非 AI 评级：基于你已记录的题型与错因本地统计，不调用任何模型，免费且不消费积分。</span>
    </div>

    <div v-if="loading" class="wk-state">分析中…</div>
    <div v-else-if="error" class="wk-state wk-err">{{ error }}</div>
    <div v-else-if="report.total === 0" class="wk-state">
      暂无错题数据。先去「四六级备考台 / 学位英语」的错题本积累一些吧。
    </div>

    <template v-else>
      <!-- 概览 -->
      <section class="wk-card">
        <div class="wk-overview">
          <div class="wk-ov">
            <span class="wk-ov-label">错题总数</span>
            <span class="wk-ov-val">{{ report.total }}</span>
          </div>
          <div class="wk-ov">
            <span class="wk-ov-label">题型数</span>
            <span class="wk-ov-val">{{ report.byType.length }}</span>
          </div>
          <div class="wk-ov">
            <span class="wk-ov-label">主要错因</span>
            <span class="wk-ov-val wk-ov-sm">{{ report.byReason[0]?.label || '—' }}</span>
          </div>
        </div>
        <div v-if="!report.enough" class="wk-warn">样本不足（&lt; {{ WEAKNESS_MIN_SAMPLE }} 条），结论仅供参考。</div>
      </section>

      <!-- 按题型 -->
      <section class="wk-card">
        <h3 class="wk-card-title">按题型分布</h3>
        <div v-for="it in report.byType" :key="it.label" class="wk-bar-row">
          <span class="wk-bar-label">{{ it.label }}</span>
          <div class="wk-bar-track"><div class="wk-bar-fill" :style="{ width: pct(it.count, maxType) }"></div></div>
          <span class="wk-bar-num">{{ it.count }} · {{ Math.round(it.ratio * 100) }}%</span>
        </div>
      </section>

      <!-- 按错因 -->
      <section class="wk-card">
        <h3 class="wk-card-title">常见错因 Top</h3>
        <div v-for="it in report.byReason.slice(0, 8)" :key="it.label" class="wk-bar-row">
          <span class="wk-bar-label">{{ it.label }}</span>
          <div class="wk-bar-track"><div class="wk-bar-fill alt" :style="{ width: pct(it.count, maxReason) }"></div></div>
          <span class="wk-bar-num">{{ it.count }}</span>
        </div>
      </section>

      <!-- 按知识点（仅学位英语，含 question_id） -->
      <section v-if="scope === 'degree' && report.byQuestion.length" class="wk-card">
        <h3 class="wk-card-title">知识薄弱点（按题）</h3>
        <div v-for="it in report.byQuestion.slice(0, 10)" :key="it.label" class="wk-q-row">
          <span class="wk-q-label">{{ questionLabel(it.label) }}</span>
          <span class="wk-q-num">{{ it.count }} 次</span>
        </div>
      </section>
      <section v-else-if="scope === 'cet'" class="wk-card wk-muted">
        四六级错题未记录具体题号，薄弱点以「题型」维度呈��。
      </section>

      <!-- 趋势 -->
      <section class="wk-card">
        <h3 class="wk-card-title">错题趋势（按月）</h3>
        <div v-if="report.trend.length === 0" class="wk-muted">暂无带时间的错题，无法绘制趋势。</div>
        <div v-for="t in report.trend" :key="t.period" class="wk-bar-row">
          <span class="wk-bar-label">{{ t.period }}</span>
          <div class="wk-bar-track"><div class="wk-bar-fill" :style="{ width: pct(t.count, maxTrend) }"></div></div>
          <span class="wk-bar-num">{{ t.count }}</span>
        </div>
      </section>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { Odometer, Refresh, Warning } from '@element-plus/icons-vue'
import { loadAll, flushQueue as cetFlush } from '../services/cetPrepService'
import { loadMistakes, flushQueue as degFlush } from '../prep/degreeService'
import { buildWeaknessReport, WEAKNESS_MIN_SAMPLE, type WeaknessMistakeInput, type WeaknessReport } from '../prep/weakness'
import { allDegreeQuestions } from '../prep/degreeQuestionBank'
import type { DegreeQuestion } from '../prep/degreeTypes'

type Scope = 'cet' | 'degree'

const scope = ref<Scope>('cet')
const loading = ref(false)
const error = ref('')

const emptyReport: WeaknessReport = buildWeaknessReport([])
const cetReport = ref<WeaknessReport>(emptyReport)
const degreeReport = ref<WeaknessReport>(emptyReport)

const degreeQuestionMap = new Map<string, DegreeQuestion>(allDegreeQuestions.map((q) => [q.id, q]))
const typeLabelMap: Record<string, string> = {
  dialogue: '完成对话',
  reading: '阅读理解',
  vocab_grammar: '词汇语法',
  translation: '英译汉',
  writing: '短文写作'
}

function questionLabel(id: string): string {
  const q = degreeQuestionMap.get(id)
  if (!q) return id
  const stem = (q.stem || '').replace(/\s+/g, ' ').slice(0, 20)
  return `[${typeLabelMap[q.type] || q.type}] ${stem}${stem.length >= 20 ? '…' : ''}`
}

const report = computed(() => (scope.value === 'cet' ? cetReport.value : degreeReport.value))
const maxType = computed(() => maxCount(report.value.byType))
const maxReason = computed(() => maxCount(report.value.byReason))
const maxTrend = computed(() => maxCount(report.value.trend))

function maxCount(items: { count: number }[]): number {
  return items.reduce((m, i) => Math.max(m, i.count), 0) || 1
}
function pct(count: number, max: number): string {
  return Math.round((count / max) * 100) + '%'
}

async function load(): Promise<void> {
  loading.value = true
  error.value = ''
  try {
    // 先补发离线队列（A2），保证归因基于最新数据
    await Promise.all([cetFlush(), degFlush()])
    const [cetState, degMistakes] = await Promise.all([loadAll(), loadMistakes()])

    const cetItems: WeaknessMistakeInput[] = cetState.mistakes
      .filter((m) => !m.removed)
      .map((m) => ({ type: m.type, reason: m.reason, createdAt: m.date }))

    const degItems: WeaknessMistakeInput[] = degMistakes.map((m) => ({
      type: m.type,
      reason: m.reason,
      questionId: m.questionId,
      createdAt: m.createdAt ?? null
    }))

    cetReport.value = buildWeaknessReport(cetItems)
    degreeReport.value = buildWeaknessReport(degItems)
  } catch (e) {
    error.value = '加载错题失败：' + (e instanceof Error ? e.message : String(e))
  } finally {
    loading.value = false
  }
}

onMounted(load)
</script>

<style scoped>
.wk-view {
  padding: 4px 18px 24px;
  max-width: 920px;
  margin: 0 auto;
}
.wk-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 14px 0 12px;
}
.wk-h-left { display: flex; align-items: center; gap: 12px; min-width: 0; }
.wk-h-icon {
  width: 40px; height: 40px; border-radius: 12px; flex-shrink: 0;
  display: grid; place-items: center;
  background: linear-gradient(135deg, var(--primary), var(--primary-2));
  box-shadow: 0 4px 12px var(--accent-glow);
}
.wk-h-text { min-width: 0; }
.wk-h-title { margin: 0; font-size: 19px; font-weight: 800; color: var(--text-strong); }
.wk-h-sub { margin: 2px 0 0; font-size: 12.5px; color: var(--text-muted); line-height: 1.5; }

.wk-tabs { display: flex; gap: 8px; margin-bottom: 12px; }
.wk-tab {
  flex: 1; border: 1px solid var(--border-strong); background: var(--surface);
  color: var(--text); padding: 9px 0; border-radius: 12px; font-size: 14px; font-weight: 600;
  cursor: pointer; transition: all 0.18s ease;
}
.wk-tab.active { background: var(--nav-active-bg); color: var(--nav-active-text); border-color: var(--primary); box-shadow: inset 0 0 0 1px var(--border-strong); }

.wk-note {
  display: flex; align-items: flex-start; gap: 8px;
  background: color-mix(in srgb, var(--primary) 7%, transparent);
  border: 1px solid var(--border); border-radius: 12px;
  padding: 10px 12px; margin-bottom: 14px;
  font-size: 12.5px; color: var(--text-muted); line-height: 1.5;
}
.wk-note :deep(svg) { color: var(--primary); margin-top: 2px; flex-shrink: 0; }

.wk-state { padding: 48px 16px; text-align: center; color: var(--text-muted); font-size: 14px; }
.wk-err { color: #ef4444; }

.wk-card {
  background: var(--surface); border: 1px solid var(--border);
  border-radius: 16px; padding: 16px; margin-bottom: 14px;
  box-shadow: var(--shadow-card);
}
.wk-card-title { margin: 0 0 12px; font-size: 15px; font-weight: 700; color: var(--text-strong); }

.wk-overview { display: flex; gap: 12px; flex-wrap: wrap; }
.wk-ov { flex: 1; min-width: 120px; background: var(--surface-soft); border: 1px solid var(--border); border-radius: 12px; padding: 12px; }
.wk-ov-label { display: block; font-size: 12px; color: var(--text-muted); margin-bottom: 6px; }
.wk-ov-val { font-size: 22px; font-weight: 800; color: var(--primary); }
.wk-ov-sm { font-size: 15px; word-break: break-all; }
.wk-warn { margin-top: 10px; font-size: 12px; color: #d97706; }

.wk-bar-row { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; }
.wk-bar-row:last-child { margin-bottom: 0; }
.wk-bar-label { width: 92px; flex-shrink: 0; font-size: 13px; color: var(--text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.wk-bar-track { flex: 1; height: 10px; background: var(--surface-soft); border-radius: 6px; overflow: hidden; }
.wk-bar-fill { height: 100%; background: linear-gradient(90deg, var(--primary), var(--primary-2)); border-radius: 6px; transition: width 0.3s ease; }
.wk-bar-fill.alt { background: linear-gradient(90deg, #f59e0b, #ef4444); }
.wk-bar-num { width: 78px; flex-shrink: 0; text-align: right; font-size: 12.5px; color: var(--text-muted); }

.wk-q-row { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 8px 0; border-bottom: 1px dashed var(--border); }
.wk-q-row:last-child { border-bottom: none; }
.wk-q-label { font-size: 13px; color: var(--text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.wk-q-num { font-size: 12.5px; color: var(--text-muted); flex-shrink: 0; }

.wk-muted { color: var(--text-faint); font-size: 13px; line-height: 1.6; }

@media (max-width: 768px) {
  .wk-view { padding: 4px 14px 16px; }
  .wk-h-title { font-size: 17px; }
  .wk-bar-label { width: 76px; font-size: 12px; }
  .wk-bar-num { width: 64px; font-size: 11.5px; }
  .wk-ov-val { font-size: 19px; }
}
</style>
