<template>
  <div class="req-collect">
    <div class="rc-header">
      <div>
        <h2>需求收集</h2>
        <p>全面采集本地 AI 调用数据，展现每日高频调用与需求热度趋势（数据仅存浏览器本地，不消耗任何积分）</p>
      </div>
      <el-button :loading="loading" @click="refresh">
        <el-icon><Refresh /></el-icon> 刷新
      </el-button>
    </div>

    <div v-if="loading && !stats" class="rc-loading">
      <el-icon class="is-loading"><Loading /></el-icon> 正在聚合本地调用数据…
    </div>

    <template v-else>
      <!-- 概览卡片 -->
      <div class="rc-cards">
        <div class="rc-card">
          <div class="rc-card-label">累计调用</div>
          <div class="rc-card-value">{{ stats.totalCalls.toLocaleString() }}</div>
        </div>
        <div class="rc-card">
          <div class="rc-card-label">今日调用</div>
          <div class="rc-card-value">{{ stats.todayCalls.toLocaleString() }}</div>
        </div>
        <div class="rc-card">
          <div class="rc-card-label">免费占比</div>
          <div class="rc-card-value">{{ stats.freeRatio }}%</div>
        </div>
        <div class="rc-card">
          <div class="rc-card-label">累计估算 Tokens</div>
          <div class="rc-card-value">{{ stats.totalEstTokens.toLocaleString() }}</div>
        </div>
      </div>

      <div class="rc-grid">
        <!-- 今日高频调用 TOP -->
        <div class="rc-section">
          <h3>今日高频调用 TOP（模型）</h3>
          <div v-if="todayRank.length" class="rc-rank">
            <div v-for="(m, i) in todayRank" :key="m.key" class="rc-rank-row">
              <span class="rc-rank-no">{{ i + 1 }}</span>
              <div class="rc-rank-main">
                <div class="rc-rank-name">{{ m.model }}<span class="rc-rank-provider">{{ m.provider }}</span></div>
                <el-progress :percentage="pct(m.calls, todayMax)" :stroke-width="8" :show-text="false" />
              </div>
              <span class="rc-rank-num">{{ m.calls }}</span>
            </div>
          </div>
          <el-empty v-else description="今日暂无调用记录" :image-size="60" />
        </div>

        <!-- 近 7 天调用趋势 -->
        <div class="rc-section">
          <h3>近 7 天调用趋势</h3>
          <div class="rc-trend">
            <div v-for="d in weekTrend" :key="d.label" class="rc-trend-col">
              <div class="rc-trend-bar" :style="{ height: trendHeight(d.count) }">
                <span class="rc-trend-num">{{ d.count }}</span>
              </div>
              <div class="rc-trend-label">{{ d.label }}</div>
            </div>
          </div>
        </div>
      </div>

      <!-- 累计需求热度榜 -->
      <div class="rc-section">
        <h3>累计需求热度榜（按模型）</h3>
        <el-table :data="stats.byModel" style="width: 100%" size="default" empty-text="暂无数据">
          <el-table-column label="排名" width="70">
            <template #default="{ $index }"><span class="rc-idx">{{ $index + 1 }}</span></template>
          </el-table-column>
          <el-table-column prop="model" label="模型" min-width="200" />
          <el-table-column prop="provider" label="厂商" width="140" />
          <el-table-column label="类型" width="110">
            <template #default="{ row }">
              <el-tag :type="row.isFree ? 'success' : 'warning'" effect="light" size="small">
                {{ row.isFree ? '免费' : '付费' }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="calls" label="调用次数" width="120" sortable />
          <el-table-column label="最后调用" min-width="160">
            <template #default="{ row }">{{ row.lastUsed ? formatTime(row.lastUsed) : '—' }}</template>
          </el-table-column>
        </el-table>
      </div>

      <!-- 用户需求反馈收集 -->
      <div class="rc-section">
        <h3>用户需求反馈收集</h3>
        <div class="rc-feedback">
          <el-input
            v-model="feedbackText"
            type="textarea"
            :rows="3"
            maxlength="300"
            show-word-limit
            placeholder="描述你最希望系统新增/优化的功能需求…"
          />
          <div class="rc-feedback-actions">
            <el-button type="primary" :disabled="!feedbackText.trim()" @click="submitFeedback">
              <el-icon><Promotion /></el-icon> 提交需求
            </el-button>
            <span class="rc-feedback-tip">提交内容仅保存在本机浏览器，用于本地展现</span>
          </div>
        </div>
        <div v-if="feedbacks.length" class="rc-fb-list">
          <div v-for="fb in feedbacks" :key="fb.id" class="rc-fb-item">
            <div class="rc-fb-text">{{ fb.text }}</div>
            <div class="rc-fb-meta">{{ formatTime(fb.ts) }}</div>
          </div>
        </div>
        <el-empty v-else description="还没有提交的需求" :image-size="50" />
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { Refresh, Loading, Promotion } from '@element-plus/icons-vue'
import { getUsageStats, getUsageLog, type UsageSummary, type ModelUsageStat } from '../services/usageTracker'

interface RankItem { key: string; provider: string; model: string; calls: number }
interface DayCount { label: string; count: number }
interface Feedback { id: string; text: string; ts: number }

const stats = ref<UsageSummary>({
  totalCalls: 0, todayCalls: 0, freeCalls: 0, paidCalls: 0, freeRatio: 0, totalEstTokens: 0, byModel: [], bailianUsed: 0
})
const loading = ref(false)
const feedbackText = ref('')
const feedbacks = ref<Feedback[]>([])

const FB_KEY = 'rc-feedback-list'

function pct(v: number, max: number): number {
  return max > 0 ? Math.min(100, Math.round((v / max) * 100)) : 0
}

const todayRank = computed<RankItem[]>(() => {
  const startOfToday = new Date(); startOfToday.setHours(0, 0, 0, 0)
  const map = new Map<string, RankItem>()
  for (const r of getUsageLog()) {
    if (r.ts < startOfToday.getTime()) continue
    const key = `${r.provider}::${r.model}`
    const cur = map.get(key) || { key, provider: r.provider, model: r.model, calls: 0 }
    cur.calls++
    map.set(key, cur)
  }
  return Array.from(map.values()).sort((a, b) => b.calls - a.calls).slice(0, 8)
})

const todayMax = computed(() => Math.max(1, ...todayRank.value.map((m) => m.calls)))

const weekTrend = computed<DayCount[]>(() => {
  const log = getUsageLog()
  const days: DayCount[] = []
  const now = new Date()
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now); d.setDate(now.getDate() - i)
    d.setHours(0, 0, 0, 0)
    const start = d.getTime()
    const end = start + 86400000
    const label = `${d.getMonth() + 1}/${d.getDate()}`
    const count = log.filter((r) => r.ts >= start && r.ts < end).length
    days.push({ label, count })
  }
  return days
})

const weekMax = computed(() => Math.max(1, ...weekTrend.value.map((d) => d.count)))

function trendHeight(count: number): string {
  return `${Math.max(6, Math.round((count / weekMax.value) * 120))}px`
}

function formatTime(ts: number): string {
  const d = new Date(ts)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function loadFeedback() {
  try {
    const raw = localStorage.getItem(FB_KEY)
    feedbacks.value = raw ? (JSON.parse(raw) as Feedback[]) : []
  } catch { feedbacks.value = [] }
}

function submitFeedback() {
  const text = feedbackText.value.trim()
  if (!text) return
  feedbacks.value.unshift({ id: `${Date.now()}`, text, ts: Date.now() })
  try { localStorage.setItem(FB_KEY, JSON.stringify(feedbacks.value)) } catch { /* ignore */ }
  feedbackText.value = ''
  ElMessage.success('需求已提交（本机保存）')
}

function refresh() {
  loading.value = true
  stats.value = getUsageStats()
  loading.value = false
}

onMounted(() => {
  refresh()
  loadFeedback()
})
</script>

<style scoped>
.req-collect {
  padding: 24px;
  max-width: 1080px;
  margin: 0 auto;
  color: var(--text);
}
.rc-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 20px;
}
.rc-header h2 { margin: 0 0 6px; font-size: 22px; color: var(--text-strong); }
.rc-header p { margin: 0; font-size: 13px; color: var(--text-muted); }
.rc-loading {
  display: flex; align-items: center; gap: 8px; color: var(--text-muted); padding: 40px 0; justify-content: center;
}
.is-loading { animation: rotating 1.2s linear infinite; }
@keyframes rotating { to { transform: rotate(360deg); } }

.rc-cards {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 14px;
  margin-bottom: 22px;
}
.rc-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 14px;
  padding: 16px;
  box-shadow: var(--shadow-card);
}
.rc-card-label { font-size: 12px; color: var(--text-muted); margin-bottom: 10px; }
.rc-card-value { font-size: 24px; font-weight: 800; color: var(--primary); }

.rc-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 18px;
  margin-bottom: 18px;
}
.rc-section {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 14px;
  padding: 18px;
  box-shadow: var(--shadow-card);
}
.rc-section h3 { margin: 0 0 14px; font-size: 15px; color: var(--text-strong); }

.rc-rank { display: flex; flex-direction: column; gap: 12px; }
.rc-rank-row { display: flex; align-items: center; gap: 10px; }
.rc-rank-no {
  width: 22px; height: 22px; flex-shrink: 0;
  display: grid; place-items: center;
  background: var(--nav-active-bg); color: var(--nav-active-text);
  border-radius: 50%; font-size: 12px; font-weight: 700;
}
.rc-rank-main { flex: 1; min-width: 0; }
.rc-rank-name { font-size: 13px; color: var(--text-strong); font-weight: 600; }
.rc-rank-provider {
  margin-left: 8px; font-size: 11px; color: var(--text-faint);
  background: var(--surface-soft); padding: 1px 6px; border-radius: 6px;
}
.rc-rank-num { font-size: 14px; font-weight: 700; color: var(--primary); font-variant-numeric: tabular-nums; }

.rc-trend { display: flex; align-items: flex-end; gap: 10px; height: 150px; padding-top: 8px; }
.rc-trend-col { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 6px; min-width: 0; }
.rc-trend-bar {
  width: 100%; max-width: 38px;
  background: linear-gradient(180deg, var(--primary), var(--primary-2));
  border-radius: 8px 8px 4px 4px;
  position: relative; display: flex; align-items: flex-start; justify-content: center;
  min-height: 6px; transition: height 0.4s ease;
}
.rc-trend-num { font-size: 11px; color: var(--text-invert); padding-top: 3px; font-weight: 700; }
.rc-trend-label { font-size: 11px; color: var(--text-muted); }

.rc-idx { font-weight: 700; color: var(--primary); }

.rc-feedback { margin-bottom: 14px; }
.rc-feedback-actions { display: flex; align-items: center; gap: 12px; margin-top: 10px; flex-wrap: wrap; }
.rc-feedback-tip { font-size: 12px; color: var(--text-faint); }
.rc-fb-list { display: flex; flex-direction: column; gap: 10px; }
.rc-fb-item {
  background: var(--surface-soft); border: 1px solid var(--border);
  border-radius: 10px; padding: 12px 14px;
}
.rc-fb-text { font-size: 13px; color: var(--text); line-height: 1.6; white-space: pre-wrap; word-break: break-word; }
.rc-fb-meta { font-size: 11px; color: var(--text-faint); margin-top: 6px; }

@media (max-width: 860px) {
  .rc-cards { grid-template-columns: repeat(2, 1fr); }
  .rc-grid { grid-template-columns: 1fr; }
}
@media (max-width: 768px) {
  .req-collect { padding: 16px; }
}
</style>
