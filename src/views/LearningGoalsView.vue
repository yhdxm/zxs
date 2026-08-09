<template>
  <div class="lg-root">
    <PageHeader
      title="学习目标"
      subtitle="管理有终点、有总量的目标：背完 2000 词、读完 440 页、学完一门课。每日建议量自动计算，断网也能用。"
      :icon="Aim"
    >
      <div class="lg-backup-mini" v-if="totalRecs >= BACKUP_THRESHOLD">
        <span class="lg-dot-bk"></span>已记录 {{ totalRecs }} 条
      </div>
    </PageHeader>

    <!-- 备份横幅（累计 20 条后温和提示） -->
    <transition name="lg-fade">
      <div class="lg-backup-banner" v-if="totalRecs >= BACKUP_THRESHOLD">
        <div class="lg-bb-icon">
          <svg viewBox="0 0 24 24" width="20" height="20"><path d="M12 2l7 3v6c0 4.4-3 8.3-7 9-4-0.7-7-4.6-7-9V5l7-3z" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M9 12l2 2 4-4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </div>
        <div class="lg-bb-text">
          <strong>数据已累计 {{ totalRecs }} 条打卡</strong>
          <span>建议导出一份 JSON 备份，避免误清空。所有数据仅存于本机浏览器。</span>
        </div>
        <button class="lg-bb-btn" @click="exportJson">导出备份</button>
      </div>
    </transition>

    <div class="lg-shell">
      <!-- 响应式导航：桌面左栏 / 平板顶栏 / 手机底栏 -->
      <nav class="lg-nav" :class="{ 'is-bottom': isMobile, 'is-top': isTablet }">
        <button
          v-for="t in TABS"
          :key="t.key"
          class="lg-nav-item"
          :class="{ active: activeTab === t.key }"
          @click="activeTab = t.key"
        >
          <span class="lg-nav-ico" v-html="t.icon"></span>
          <span class="lg-nav-label">{{ t.label }}</span>
        </button>
      </nav>

      <main class="lg-content">
        <!-- ========== 今日 ========== -->
        <section v-show="activeTab === 'today'" class="lg-tab">
          <button class="lg-new-top" @click="openCreate">
            <svg viewBox="0 0 24 24" width="18" height="18"><path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
            新建学习目标
          </button>

          <!-- 昨日漏打卡置顶（黄卡=休息日 / 红卡=滚入今日） -->
          <div v-for="p in pinnedGoals" :key="'pin-' + p.goal.id" class="lg-pin" :class="p.yMiss.kind">
            <span class="lg-pin-ico">
              <svg viewBox="0 0 24 24" width="18" height="18">
                <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.6"/>
                <path d="M12 7v5l3 2" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
              </svg>
            </span>
            <div class="lg-pin-body">
              <strong v-if="p.yMiss.kind === 'rest'">休息日 · {{ p.goal.name }}</strong>
              <strong v-else>滚入今日 · {{ p.goal.name }}</strong>
              <p v-if="p.yMiss.kind === 'rest'">昨天是本周第 1 个休息日，不中断连续打卡，今天照常推进即可。</p>
              <p v-else>昨天漏打卡已中断连续记录，把落下的量 today 补上，重新开始计数。</p>
            </div>
            <button class="lg-pin-btn" @click="scrollToGoal(p.goal.id)">去打卡</button>
          </div>

          <p v-if="!store.goals.length" class="lg-empty">还没有目标，点上方按钮创建第一个吧。</p>

          <div class="lg-cards">
            <article
              v-for="g in orderedGoals"
              :key="g.goal.id"
              class="lg-card"
              :id="'goal-' + g.goal.id"
              :class="{ done: g.completed, overdue: g.overdue }"
              :style="{ '--gc': g.goal.color }"
            >
              <header class="lg-card-head">
                <span class="lg-card-dot"></span>
                <h3 class="lg-card-title">{{ g.goal.name }}</h3>
                <span v-if="g.completed" class="lg-badge done">已达成</span>
                <span v-else-if="g.overdue" class="lg-badge over">逾期 {{ Math.abs(g.daysLeft) }} 天</span>
                <span v-if="g.goal.sample" class="lg-badge sample">示例</span>
              </header>

              <div class="lg-progress">
                <div class="lg-progress-bar"><span :style="{ width: (g.rate * 100).toFixed(1) + '%' }"></span></div>
                <span class="lg-progress-pct">{{ (g.rate * 100).toFixed(0) }}%</span>
              </div>

              <div class="lg-stats">
                <div><b>{{ g.remaining }}</b><i>{{ g.goal.unit }} 剩余</i></div>
                <div><b>{{ g.daysLeft >= 0 ? g.daysLeft : '已逾期' }}</b><i>{{ g.daysLeft >= 0 ? '天剩余' : '超出截止' }}</i></div>
                <div><b>{{ g.suggestion }}</b><i>今日建议 {{ g.goal.unit }}</i></div>
              </div>

              <div class="lg-exp">
                <template v-if="g.expected.date">
                  预计 {{ formatShort(g.expected.date) }} 完成 ·
                  <span :class="g.expected.deltaDays! >= 0 ? 'early' : 'late'">
                    {{ g.expected.deltaDays! >= 0 ? '提前 ' + g.expected.deltaDays + ' 天' : '拖后 ' + Math.abs(g.expected.deltaDays!) + ' 天' }}
                  </span>
                </template>
                <template v-else>预计完成日：<span class="muted">暂无推算</span></template>
                <span class="lg-streak">连续 {{ g.streak }} 天</span>
              </div>

              <div class="lg-plan" v-if="g.goal.obstacle || g.goal.countermeasure">
                <div v-if="g.goal.obstacle" class="lg-plan-row"><span class="lg-plan-k obstacle">障碍</span>{{ g.goal.obstacle }}</div>
                <div v-if="g.goal.countermeasure" class="lg-plan-row"><span class="lg-plan-k对策">对策</span>{{ g.goal.countermeasure }}</div>
              </div>

              <!-- 打卡区 -->
              <div class="lg-punch" v-if="!g.completed">
                <div class="lg-punch-row">
                  <el-select v-model="g.pf.date" size="default" class="lg-punch-date">
                    <el-option v-for="d in last6Dates" :key="d.value" :label="d.label" :value="d.value" />
                  </el-select>
                  <el-input
                    v-model.number="g.pf.amount"
                    type="number"
                    :min="0"
                    size="default"
                    class="lg-punch-amt"
                    :placeholder="'量 (' + g.goal.unit + ')'"
                  />
                  <el-input
                    v-model.number="g.pf.minutes"
                    type="number"
                    :min="0"
                    size="default"
                    class="lg-punch-min"
                    placeholder="分钟(选填)"
                  />
                </div>
                <div class="lg-punch-row lg-punch-actions">
                  <span v-if="g.pf.date !== today" class="lg-backfill-tag">补记</span>
                  <button class="lg-punch-btn" @click="doPunch(g.goal.id)">立即打卡</button>
                  <button class="lg-edit-btn" @click="openEdit(g.goal)">{{ g.overdue ? '调整计划' : '编辑' }}</button>
                  <button class="lg-del-btn" @click="confirmDelete(g.goal)">删除</button>
                </div>
              </div>
              <div class="lg-punch done-actions" v-else>
                <span class="lg-done-text">
                  <svg viewBox="0 0 24 24" width="16" height="16"><path d="M5 13l4 4L19 7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
                  目标已达成
                </span>
                <button class="lg-edit-btn" @click="openEdit(g.goal)">编辑</button>
                <button class="lg-del-btn" @click="confirmDelete(g.goal)">删除</button>
              </div>

              <!-- 达成彩带 -->
              <div v-if="g.completed" class="lg-confetti" aria-hidden="true">
                <i v-for="n in 10" :key="n" :style="{ '--i': n, background: GOAL_PALETTE[n % GOAL_PALETTE.length] }"></i>
              </div>
            </article>
          </div>

          <button class="lg-new-bottom" @click="openCreate">
            <svg viewBox="0 0 24 24" width="18" height="18"><path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
            新建学习目标
          </button>
        </section>

        <!-- ========== 看板 ========== -->
        <section v-show="activeTab === 'board'" class="lg-tab">
          <p v-if="!store.goals.length" class="lg-empty">还没有目标，去「今日」创建。</p>
          <div class="lg-board">
            <article
              v-for="g in orderedGoals"
              :key="'b-' + g.goal.id"
              class="lg-bcard"
              :style="{ '--gc': g.goal.color }"
            >
              <div class="lg-bcard-head">
                <span class="lg-card-dot"></span>
                <h3>{{ g.goal.name }}</h3>
                <span v-if="g.goal.sample" class="lg-badge sample">示例</span>
              </div>

              <div class="lg-bcard-top">
                <!-- 进度环 -->
                <div class="lg-ring">
                  <svg viewBox="0 0 80 80" width="84" height="84">
                    <circle cx="40" cy="40" r="34" fill="none" stroke="rgba(99,102,241,0.12)" stroke-width="8"/>
                    <circle
                      cx="40" cy="40" r="34" fill="none" :stroke="g.goal.color" stroke-width="8"
                      stroke-linecap="round"
                      :stroke-dasharray="RING_C"
                      :stroke-dashoffset="RING_C * (1 - g.rate)"
                      transform="rotate(-90 40 40)"
                    />
                    <text x="40" y="45" text-anchor="middle" class="lg-ring-t">{{ (g.rate * 100).toFixed(0) }}%</text>
                  </svg>
                </div>
                <div class="lg-bcard-nums">
                  <div class="lg-num"><b>{{ (g.rate * 100).toFixed(0) }}%</b><i>完成率</i></div>
                  <div class="lg-num"><b>{{ g.streak }}</b><i>连续天数</i></div>
                  <div class="lg-num">
                    <b v-if="g.expected.date">{{ formatShort(g.expected.date) }}</b>
                    <b v-else class="muted">—</b>
                    <i>{{ g.expected.date ? (g.expected.deltaDays! >= 0 ? '提前' + g.expected.deltaDays + '天' : '拖后' + Math.abs(g.expected.deltaDays!) + '天') : '暂无推算' }}</i>
                  </div>
                </div>
              </div>

              <div class="lg-plan" v-if="g.goal.obstacle || g.goal.countermeasure">
                <div v-if="g.goal.obstacle" class="lg-plan-row"><span class="lg-plan-k obstacle">障碍</span>{{ g.goal.obstacle }}</div>
                <div v-if="g.goal.countermeasure" class="lg-plan-row"><span class="lg-plan-k对策">对策</span>{{ g.goal.countermeasure }}</div>
              </div>

              <div class="lg-recent">
                <div class="lg-recent-h">最近记录（可删除）</div>
                <div v-for="r in recentRecords(g.goal.id)" :key="r.id" class="lg-recent-row">
                  <span class="lg-recent-date">{{ formatShort(r.date) }}</span>
                  <span class="lg-recent-amt">+{{ r.amount }} {{ g.goal.unit }}</span>
                  <span v-if="r.minutes" class="lg-recent-min">{{ r.minutes }} 分</span>
                  <span v-if="r.isBackfill" class="lg-backfill-tag sm">补</span>
                  <button class="lg-recent-del" @click="deleteRecord(r.id)" title="删除">×</button>
                </div>
                <p v-if="!recentRecords(g.goal.id).length" class="lg-empty sm">暂无记录</p>
              </div>
            </article>
          </div>

          <!-- 近 14 天投入分钟堆叠柱状图 -->
          <div class="lg-chart" v-if="store.goals.length">
            <div class="lg-chart-h">近 14 天投入分钟（按目标堆叠 · 未填分钟不计入）</div>
            <svg class="lg-chart-svg" :viewBox="'0 0 ' + CHART_W + ' ' + CHART_H" preserveAspectRatio="none">
              <line :x1="0" :x2="CHART_W" :y1="CHART_H - 22" :y2="CHART_H - 22" stroke="rgba(99,102,241,0.15)" stroke-width="1"/>
              <g v-for="(d, i) in chartDays" :key="d.date">
                <template v-if="d.total > 0">
                  <g>
                    <rect
                      v-for="(s, j) in d.segments"
                      :key="s.goalId"
                      :x="i * colW + colW * 0.22"
                      :y="barY(d, j)"
                      :width="colW * 0.56"
                      :height="segHeight(d, j)"
                      :fill="s.color"
                      rx="2"
                    />
                  </g>
                </template>
                <text :x="i * colW + colW / 2" :y="CHART_H - 6" text-anchor="middle" class="lg-chart-axis">{{ formatShort(d.date) }}</text>
              </g>
            </svg>
            <div class="lg-chart-legend">
              <span v-for="g in store.goals" :key="g.id" class="lg-legend"><i :style="{ background: g.color }"></i>{{ g.name }}</span>
            </div>
          </div>
        </section>

        <!-- ========== 周报 ========== -->
        <section v-show="activeTab === 'weekly'" class="lg-tab">
          <div class="lg-week-nav">
            <button class="lg-wk-btn" @click="shiftWeek(-1)">← 上周</button>
            <div class="lg-wk-range">
              <strong>{{ formatShort(weekStat.weekStart) }} ~ {{ formatShort(addDays(weekStat.weekStart, 6)) }}</strong>
              <span v-if="weekOffset === 0" class="lg-wk-now">本周</span>
            </div>
            <button class="lg-wk-btn" :disabled="weekOffset >= 0" @click="shiftWeek(1)">下周 →</button>
          </div>

          <div class="lg-week-table">
            <div class="lg-wt-head">
              <span>目标</span><span>投入量</span><span>打卡天数</span><span>分钟</span>
            </div>
            <div v-for="row in weekStat.perGoal" :key="row.goalId" class="lg-wt-row" v-show="goalName(row.goalId)">
              <span class="lg-wt-name"><i :style="{ background: goalColor(row.goalId) }"></i>{{ goalName(row.goalId) }}</span>
              <span>{{ row.amount }} {{ goalUnit(row.goalId) }}</span>
              <span>{{ row.days }} 天</span>
              <span>{{ row.minutes }} 分</span>
            </div>
            <div class="lg-wt-row total">
              <span>合计</span>
              <span>{{ weekStat.totalAmount }}</span>
              <span>{{ weekStat.totalDays }} 天</span>
              <span>{{ weekStat.totalMinutes }} 分</span>
            </div>
          </div>

          <div class="lg-compare">
            环比上周：
            <span :class="cmp.amountPct === null ? 'muted' : cmp.amountPct >= 0 ? 'early' : 'late'">
              {{ cmp.amountPct === null ? '上周无数据' : (cmp.amountPct >= 0 ? '+' : '') + cmp.amountPct.toFixed(0) + '% 投入量' }}
            </span>
            ·
            <span :class="cmp.minutesPct === null ? 'muted' : cmp.minutesPct >= 0 ? 'early' : 'late'">
              {{ cmp.minutesPct === null ? '上周无数据' : (cmp.minutesPct >= 0 ? '+' : '') + cmp.minutesPct.toFixed(0) + '% 分钟' }}
            </span>
          </div>

          <div class="lg-four">
            <div class="lg-four-col" v-for="f in FOUR_COLS" :key="f.key">
              <label>{{ f.label }}</label>
              <textarea v-model="noteDraft[f.key]" rows="3" :placeholder="f.ph" @input="saveNote"></textarea>
            </div>
          </div>

          <button class="lg-report-btn" @click="generateReport">一键生成周报文本</button>
        </section>

        <!-- ========== 我的 ========== -->
        <section v-show="activeTab === 'mine'" class="lg-tab">
          <div class="lg-mine">
            <div class="lg-mine-card">
              <h3>数据备份</h3>
              <p class="lg-mine-desc">所有数据仅存于本机浏览器（localStorage），导出后可随时导入恢复。</p>
              <div class="lg-mine-btns">
                <button class="lg-mine-btn" @click="exportJson">导出 JSON</button>
                <button class="lg-mine-btn" @click="triggerImport">导入 JSON（覆盖）</button>
                <input ref="fileInput" type="file" accept="application/json,.json" hidden @change="onImportFile" />
              </div>
            </div>

            <div class="lg-mine-card">
              <h3>示例数据</h3>
              <p class="lg-mine-desc">预置了 3 个带示例标签的目标与几天记录，用于演示各类状态。</p>
              <div class="lg-mine-btns">
                <button class="lg-mine-btn warn" @click="confirmClearSamples">清空示例</button>
              </div>
            </div>

            <div class="lg-mine-card danger">
              <h3>危险区</h3>
              <p class="lg-mine-desc">清空后无法恢复，请先导出备份。</p>
              <div class="lg-clear-all">
                <el-input v-model="clearText" placeholder='输入"清空"以确认' size="default" />
                <button class="lg-mine-btn danger" :disabled="clearText !== '清空'" @click="confirmClearAll">清空全部</button>
              </div>
            </div>

            <div class="lg-mine-card">
              <h3>添加到手机主屏幕</h3>
              <ol class="lg-homescreen">
                <li><b>iPhone / iPad（Safari）：</b>点底部「分享」图标 → 下滑选「添加到主屏幕」→ 命名「智习」→ 添加。</li>
                <li><b>Android（Chrome）：</b>点右上角「⋮」菜单 →「安装应用 / 添加到主屏幕」→ 安装。</li>
                <li><b>桌面（Chrome / Edge）：</b>地址栏右侧「安装」图标 → 确认，即可像 App 一样打开，断网也可用。</li>
              </ol>
            </div>
          </div>
        </section>
      </main>
    </div>

    <!-- 新建 / 编辑 目标弹窗 -->
    <el-dialog v-model="dialogVisible" :title="editingId ? '编辑目标' : '新建学习目标'" width="520px" class="lg-dialog" :fullscreen="isMobile">
      <div class="lg-form">
        <label>目标名称 *</label>
        <el-input v-model="form.name" placeholder="如：背完 2000 个单词" maxlength="40" />

        <div class="lg-form-2">
          <div>
            <label>单位 *</label>
            <el-input v-model="form.unit" placeholder="个 / 页 / 讲 / 节" maxlength="6" />
          </div>
          <div>
            <label>总量 *</label>
            <el-input v-model.number="form.total" type="number" :min="1" placeholder="2000" />
          </div>
        </div>

        <label>截止日 *</label>
        <el-date-picker v-model="form.deadline" type="date" value-format="YYYY-MM-DD" placeholder="选择截止日" class="lg-form-full" />

        <label>配色</label>
        <div class="lg-colors">
          <button
            v-for="c in GOAL_PALETTE"
            :key="c"
            class="lg-color"
            :class="{ on: form.color === c }"
            :style="{ background: c }"
            @click="form.color = c"
          ></button>
        </div>

        <label>最容易拦住我的障碍（选填）</label>
        <el-input v-model="form.obstacle" type="textarea" :rows="2" placeholder="如：单词太枯燥，背几天就想放弃" />

        <label>如果它出现，我就……（选填）</label>
        <el-input v-model="form.countermeasure" type="textarea" :rows="2" placeholder="如：每天早起 20 分钟打卡，没打完就不刷短视频" />
      </div>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="saveGoal">保存</el-button>
      </template>
    </el-dialog>

    <!-- 周报文本弹窗 -->
    <el-dialog v-model="reportVisible" title="周报文本" width="560px" class="lg-dialog" :fullscreen="isMobile">
      <pre class="lg-report-text">{{ reportText }}</pre>
      <template #footer>
        <el-button @click="reportVisible = false">关闭</el-button>
        <el-button type="primary" @click="copyReport">复制文本</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, watch, nextTick } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Aim } from '@element-plus/icons-vue'
import PageHeader from '../components/PageHeader.vue'
import {
  useLearningGoals,
  initLearningGoals,
  addGoal,
  updateGoal,
  deleteGoal,
  addRecord,
  deleteRecord,
  clearSamples,
  clearAll,
  exportData,
  importData,
  totalRecords,
  goalDone,
  completionRate,
  remainingAmount,
  daysLeft,
  dailySuggestion,
  computeStreak,
  expectedCompletion,
  yesterdayMissInfo,
  isOverdue,
  isCompleted,
  weekStats,
  weekCompare,
  recentRecords as svcRecent,
  last14DaysMinutes,
  GOAL_PALETTE,
  BACKUP_THRESHOLD,
  todayStr,
  addDays,
  formatShort,
  type LearningGoal
} from '../services/learningGoalService'

const store = useLearningGoals()
const today = todayStr()

// 响应式断点
const isMobile = ref(false)
const isTablet = ref(false)
function syncBreakpoint() {
  const w = window.innerWidth
  isMobile.value = w <= 768
  isTablet.value = w > 768 && w <= 1024
}
onMounted(() => {
  initLearningGoals()
  syncBreakpoint()
  window.addEventListener('resize', syncBreakpoint)
})

const activeTab = ref<'today' | 'board' | 'weekly' | 'mine'>('today')

const TABS = [
  { key: 'today', label: '今日', icon: '<svg viewBox="0 0 24 24" width="20" height="20"><rect x="3" y="4" width="18" height="17" rx="2.5" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M3 9h18M8 2v4M16 2v4" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>' },
  { key: 'board', label: '看板', icon: '<svg viewBox="0 0 24 24" width="20" height="20"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>' },
  { key: 'weekly', label: '周报', icon: '<svg viewBox="0 0 24 24" width="20" height="20"><rect x="3" y="4" width="18" height="17" rx="2.5" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M7 14l3 3 7-7" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>' },
  { key: 'mine', label: '我的', icon: '<svg viewBox="0 0 24 24" width="20" height="20"><circle cx="12" cy="8" r="3.4" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M5 20c0-3.3 3.1-6 7-6s7 2.7 7 6" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>' }
] as const

// ---------- 派生统计 ----------
interface PunchEntry {
  date: string
  amount: number | null
  minutes: number | null
}

interface GoalView {
  goal: LearningGoal
  pf: PunchEntry
  done: number
  rate: number
  remaining: number
  daysLeft: number
  suggestion: number
  streak: number
  expected: { date: string | null; deltaDays: number | null; rate: number }
  yMiss: { missed: boolean; kind: 'rest' | 'break' | null }
  overdue: boolean
  completed: boolean
}

const goalsView = computed<GoalView[]>(() =>
  store.goals.map((goal) => ({
    goal,
    pf: ensurePf(goal.id),
    done: goalDone(goal.id),
    rate: completionRate(goal),
    remaining: remainingAmount(goal),
    daysLeft: daysLeft(goal),
    suggestion: dailySuggestion(goal),
    streak: computeStreak(goal.id),
    expected: expectedCompletion(goal),
    yMiss: yesterdayMissInfo(goal.id),
    overdue: isOverdue(goal),
    completed: isCompleted(goal)
  }))
)

const pinnedGoals = computed(() => goalsView.value.filter((g) => g.yMiss.missed))
const orderedGoals = computed(() => {
  const pinned = new Set(pinnedGoals.value.map((p) => p.goal.id))
  return goalsView.value.slice().sort((a, b) => {
    const pa = pinned.has(a.goal.id) ? 0 : 1
    const pb = pinned.has(b.goal.id) ? 0 : 1
    if (pa !== pb) return pa - pb
    return a.goal.createdAt < b.goal.createdAt ? -1 : 1
  })
})

const totalRecs = computed(() => totalRecords())

// ---------- 打卡表单 ----------
const punchForm = reactive<Record<string, PunchEntry>>({})
function ensurePf(id: string): PunchEntry {
  let e = punchForm[id]
  if (!e) {
    e = { date: today, amount: null, minutes: null }
    punchForm[id] = e
  }
  return e
}
watch(
  () => store.goals.map((g) => g.id).join(','),
  () => {
    for (const g of store.goals) ensurePf(g.id)
  },
  { immediate: true }
)
// 切换目标时，把今日建议量预填进 amount（允许修改）
watch(goalsView, () => {
  for (const g of goalsView.value) {
    if (g.pf.amount === null || g.pf.amount === undefined) g.pf.amount = g.suggestion
  }
})

const last6Dates = computed(() => {
  const arr: { value: string; label: string }[] = []
  for (let i = 6; i >= 0; i--) {
    const d = addDays(today, -i)
    let label = formatShort(d)
    if (i === 0) label += '（今天）'
    else label += '（补记）'
    arr.push({ value: d, label })
  }
  return arr
})

function doPunch(goalId: string) {
  const f = ensurePf(goalId)
  if (f.amount === null || f.amount === undefined || f.amount < 0) {
    ElMessage.warning('请输入本次完成量')
    return
  }
  const gv = goalsView.value.find((x) => x.goal.id === goalId)
  addRecord({
    goalId,
    date: f.date,
    amount: Number(f.amount),
    minutes: f.minutes ? Number(f.minutes) : undefined,
    isBackfill: f.date !== today
  })
  ElMessage.success(f.date !== today ? '补记成功' : '打卡成功')
  // 重置为今日建议量
  if (gv) f.amount = gv.suggestion
  f.minutes = null
  f.date = today
}

// ---------- 弹窗 / 表单 ----------
const dialogVisible = ref(false)
const editingId = ref<string | null>(null)
const form = reactive({
  name: '',
  unit: '',
  total: 1,
  deadline: '',
  color: GOAL_PALETTE[0] ?? '#6366f1',
  obstacle: '',
  countermeasure: ''
})

function resetForm() {
  form.name = ''
  form.unit = ''
  form.total = 1
  form.deadline = addDays(today, 30)
  form.color = GOAL_PALETTE[store.goals.length % GOAL_PALETTE.length] ?? '#6366f1'
  form.obstacle = ''
  form.countermeasure = ''
}

function openCreate() {
  editingId.value = null
  resetForm()
  dialogVisible.value = true
}

function openEdit(goal: LearningGoal) {
  editingId.value = goal.id
  form.name = goal.name
  form.unit = goal.unit
  form.total = goal.total
  form.deadline = goal.deadline
  form.color = goal.color
  form.obstacle = goal.obstacle || ''
  form.countermeasure = goal.countermeasure || ''
  dialogVisible.value = true
}

function saveGoal() {
  if (!form.name.trim()) return ElMessage.warning('请填写目标名称')
  if (!form.unit.trim()) return ElMessage.warning('请填写单位')
  if (!form.total || form.total <= 0) return ElMessage.warning('总量需大于 0')
  if (!form.deadline) return ElMessage.warning('请选择截止日')
  const payload = {
    name: form.name.trim(),
    unit: form.unit.trim(),
    total: Number(form.total),
    deadline: form.deadline,
    color: form.color,
    obstacle: form.obstacle.trim() || undefined,
    countermeasure: form.countermeasure.trim() || undefined
  }
  if (editingId.value) {
    updateGoal(editingId.value, payload)
    ElMessage.success('已保存')
  } else {
    addGoal(payload)
    ElMessage.success('目标已创建')
  }
  dialogVisible.value = false
}

function confirmDelete(goal: LearningGoal) {
  ElMessageBox.confirm(`确定删除目标「${goal.name}」吗？其全部打卡记录也会一并删除，不可恢复。`, '二次确认', {
    type: 'warning',
    confirmButtonText: '删除',
    cancelButtonText: '取消',
    confirmButtonClass: 'el-button--danger'
  })
    .then(() => {
      deleteGoal(goal.id)
      delete punchForm[goal.id]
      ElMessage.success('已删除')
    })
    .catch(() => {})
}

function scrollToGoal(id: string) {
  activeTab.value = 'today'
  nextTick(() => {
    const el = document.getElementById('goal-' + id)
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
  })
}

// ---------- 看板图表 ----------
const RING_C = 2 * Math.PI * 34
const CHART_W = 700
const CHART_H = 180
const colW = CHART_W / 14
const chartDays = computed(() => last14DaysMinutes())
const maxMin = computed(() => Math.max(1, ...chartDays.value.map((d) => d.total)))
function barY(d: { segments: { minutes: number }[]; total: number }, j: number): number {
  // 从底部堆叠
  let below = 0
  for (let k = 0; k < j; k++) below += d.segments[k]?.minutes ?? 0
  const totalH = (d.total / maxMin.value) * (CHART_H - 30)
  const h = ((d.segments[j]?.minutes ?? 0) / maxMin.value) * (CHART_H - 30)
  return CHART_H - 22 - totalH + (totalH - (below / d.total) * totalH) - h
}
function segHeight(d: { segments: { minutes: number }[]; total: number }, j: number): number {
  return Math.max(0, ((d.segments[j]?.minutes ?? 0) / maxMin.value) * (CHART_H - 30))
}

function recentRecords(goalId: string) {
  return svcRecent(goalId, 10)
}

// ---------- 周报 ----------
const weekOffset = ref(0)
const curWeekStart = computed(() => {
  const base = store.goals.length ? today : today
  // 以本周一为基准，按偏移平移
  let ws = weekStartOf(today)
  ws = addDays(ws, weekOffset.value * 7)
  return ws
})
function weekStartOf(s: string): string {
  const d = new Date(s)
  const dow = (d.getDay() + 6) % 7
  d.setDate(d.getDate() - dow)
  return todayStr(d)
}
function shiftWeek(n: number) {
  weekOffset.value += n
}
const weekStat = computed(() => weekStats(store.records, store.goals, curWeekStart.value))
const cmp = computed(() => weekCompare(curWeekStart.value, store.records))

const FOUR_COLS = [
  { key: 'keep', label: '保持', ph: '本周哪些做法有效，继续坚持？' },
  { key: 'problem', label: '问题', ph: '遇到了什么阻碍或偏离？' },
  { key: 'try', label: '尝试', ph: '下周准备尝试什么新办法？' },
  { key: 'plan', label: '下周预案', ph: '下周的具体计划与节奏？' }
] as const

interface NoteDraft {
  keep: string
  problem: string
  try: string
  plan: string
}
const noteDraft = reactive<NoteDraft>({ keep: '', problem: '', try: '', plan: '' })
function loadNote() {
  const n = store.weeklyNotes[curWeekStart.value] || { keep: '', problem: '', try: '', plan: '' }
  noteDraft.keep = n.keep
  noteDraft.problem = n.problem
  noteDraft.try = n.try
  noteDraft.plan = n.plan
}
watch(curWeekStart, loadNote, { immediate: true })
function saveNote() {
  store.weeklyNotes[curWeekStart.value] = {
    keep: noteDraft.keep,
    problem: noteDraft.problem,
    try: noteDraft.try,
    plan: noteDraft.plan
  }
}

function goalName(id: string) {
  return store.goals.find((g) => g.id === id)?.name || ''
}
function goalColor(id: string) {
  return store.goals.find((g) => g.id === id)?.color || '#999'
}
function goalUnit(id: string) {
  return store.goals.find((g) => g.id === id)?.unit || ''
}

const reportVisible = ref(false)
const reportText = ref('')
function generateReport() {
  const ws = curWeekStart.value
  const we = addDays(ws, 6)
  const lines: string[] = []
  lines.push(`学习目标周报（${formatShort(ws)} ~ ${formatShort(we)}）`)
  lines.push('')
  lines.push('—— 本周投入 ——')
  for (const row of weekStat.value.perGoal) {
    const name = goalName(row.goalId)
    if (!name) continue
    lines.push(`• ${name}：完成 ${row.amount} ${goalUnit(row.goalId)}，打卡 ${row.days} 天，投入 ${row.minutes} 分钟`)
  }
  lines.push(`合计：完成 ${weekStat.value.totalAmount}，打卡 ${weekStat.value.totalDays} 天，投入 ${weekStat.value.totalMinutes} 分钟`)
  lines.push('')
  lines.push('—— 环比上周 ——')
  lines.push(
    cmp.value.amountPct === null
      ? '上周无数据，暂无可比'
      : `投入量 ${cmp.value.amountPct >= 0 ? '+' : ''}${cmp.value.amountPct.toFixed(0)}%（上周 ${cmp.value.prev.totalAmount}）`
  )
  lines.push(
    cmp.value.minutesPct === null
      ? '上周无数据，暂无可比'
      : `分钟 ${cmp.value.minutesPct >= 0 ? '+' : ''}${cmp.value.minutesPct.toFixed(0)}%（上周 ${cmp.value.prev.totalMinutes}）`
  )
  lines.push('')
  lines.push('—— 四栏反思 ——')
  lines.push(`保持：${noteDraft.keep || '（未填写）'}`)
  lines.push(`问题：${noteDraft.problem || '（未填写）'}`)
  lines.push(`尝试：${noteDraft.try || '（未填写）'}`)
  lines.push(`下周预案：${noteDraft.plan || '（未填写）'}`)
  reportText.value = lines.join('\n')
  reportVisible.value = true
}
function copyReport() {
  navigator.clipboard?.writeText(reportText.value).then(
    () => ElMessage.success('已复制到剪贴板'),
    () => ElMessage.warning('复制失败，请手动选择')
  )
}

// ---------- 我的：导入导出清空 ----------
function exportJson() {
  const blob = new Blob([exportData()], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `智习-学习目标-${today}.json`
  a.click()
  URL.revokeObjectURL(url)
  ElMessage.success('已导出备份')
}

const fileInput = ref<HTMLInputElement | null>(null)
function triggerImport() {
  fileInput.value?.click()
}
function onImportFile(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = () => {
    const text = String(reader.result || '')
    ElMessageBox.confirm('导入将覆盖当前全部目标与记录，确定继续？建议先导出备份。', '覆盖确认', {
      type: 'warning',
      confirmButtonText: '覆盖导入',
      cancelButtonText: '取消'
    })
      .then(() => {
        const res = importData(text)
        if (res.ok) ElMessage.success('导入成功')
        else ElMessage.error('导入失败：' + res.error)
      })
      .catch(() => {})
    input.value = ''
  }
  reader.readAsText(file)
}

function confirmClearSamples() {
  ElMessageBox.confirm('将删除所有预置示例目标与记录（不影响你自建的目标），确定？', '清空示例', {
    type: 'warning'
  })
    .then(() => {
      clearSamples()
      ElMessage.success('示例已清空')
    })
    .catch(() => {})
}

const clearText = ref('')
function confirmClearAll() {
  if (clearText.value !== '清空') return
  ElMessageBox.confirm('此操作清空全部目标、记录与周报，不可恢复！', '最终确认', {
    type: 'error',
    confirmButtonText: '全部清空',
    cancelButtonText: '取消',
    confirmButtonClass: 'el-button--danger'
  })
    .then(() => {
      clearAll()
      clearText.value = ''
      ElMessage.success('已清空全部数据')
    })
    .catch(() => {})
}
</script>

<style scoped>
.lg-root {
  padding: 0 20px 18px;
  max-width: 1240px;
  margin: 0 auto;
  color: var(--text);
}
.lg-backup-mini {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--text-muted);
  background: var(--surface-soft);
  border: 1px solid var(--border);
  padding: 4px 10px;
  border-radius: 999px;
}
.lg-dot-bk {
  width: 7px; height: 7px; border-radius: 50%;
  background: #22c55e; box-shadow: 0 0 0 3px rgba(34,197,94,0.18);
}

/* 备份横幅 */
.lg-backup-banner {
  display: flex; align-items: center; gap: 12px;
  background: linear-gradient(120deg, rgba(99,102,241,0.10), rgba(139,92,246,0.08));
  border: 1px solid var(--border-strong);
  border-radius: 16px; padding: 14px 16px; margin: 14px 0 4px;
}
.lg-bb-icon { color: #6366f1; flex-shrink: 0; }
.lg-bb-text { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.lg-bb-text strong { font-size: 14px; color: var(--text-strong); }
.lg-bb-text span { font-size: 12.5px; color: var(--text-muted); }
.lg-bb-btn {
  flex-shrink: 0; border: none; cursor: pointer;
  background: linear-gradient(120deg, #6366f1, #8b5cf6); color: #fff;
  padding: 8px 16px; border-radius: 10px; font-size: 13px; font-weight: 600;
}
.lg-bb-btn:active { transform: scale(0.97); }

/* 响应式外壳 */
.lg-shell { display: flex; gap: 18px; align-items: flex-start; margin-top: 12px; }
.lg-nav {
  position: sticky; top: 78px; flex: 0 0 200px; width: 200px;
  display: flex; flex-direction: column; gap: 6px;
  background: var(--surface); border: 1px solid var(--border);
  border-radius: 16px; padding: 10px;
}
.lg-nav-item {
  display: flex; align-items: center; gap: 10px;
  border: none; cursor: pointer; background: transparent;
  padding: 11px 12px; border-radius: 11px; color: var(--text);
  font-size: 14px; font-weight: 500; text-align: left; width: 100%;
  transition: background 0.18s ease;
}
.lg-nav-item:hover { background: var(--nav-hover); }
.lg-nav-item.active {
  background: var(--nav-active-bg); color: var(--nav-active-text);
  font-weight: 700; box-shadow: inset 0 0 0 1px var(--nav-active-glow);
}
.lg-nav-ico { display: inline-flex; color: inherit; }
.lg-content { flex: 1 1 auto; min-width: 0; }

/* 今日 */
.lg-new-top, .lg-new-bottom {
  display: flex; align-items: center; justify-content: center; gap: 8px;
  width: 100%; border: 1.5px dashed var(--border-strong); cursor: pointer;
  background: var(--surface); color: var(--primary);
  padding: 13px; border-radius: 14px; font-size: 14.5px; font-weight: 600;
  margin-bottom: 14px;
}
.lg-new-bottom { margin: 18px 0 4px; }
.lg-new-top:hover, .lg-new-bottom:hover { background: var(--nav-hover); }

.lg-pin {
  display: flex; align-items: center; gap: 12px;
  border-radius: 14px; padding: 12px 14px; margin-bottom: 12px;
  border: 1px solid;
}
.lg-pin.rest { background: rgba(245,158,11,0.10); border-color: rgba(245,158,11,0.35); }
.lg-pin.break { background: rgba(239,68,68,0.10); border-color: rgba(239,68,68,0.35); }
.lg-pin-ico { flex-shrink: 0; }
.lg-pin.rest .lg-pin-ico { color: #f59e0b; }
.lg-pin.break .lg-pin-ico { color: #ef4444; }
.lg-pin-body { flex: 1; min-width: 0; }
.lg-pin-body strong { font-size: 14px; color: var(--text-strong); display: block; }
.lg-pin-body p { margin: 3px 0 0; font-size: 12.5px; color: var(--text-muted); }
.lg-pin-btn {
  flex-shrink: 0; border: none; cursor: pointer; border-radius: 9px;
  padding: 7px 14px; font-size: 13px; font-weight: 600; color: #fff;
  background: linear-gradient(120deg, #6366f1, #8b5cf6);
}

.lg-empty { color: var(--text-faint); text-align: center; padding: 30px 0; font-size: 14px; }
.lg-empty.sm { padding: 10px 0; font-size: 12.5px; }

.lg-cards { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; }
.lg-card {
  position: relative; background: var(--surface); border: 1px solid var(--border);
  border-radius: 18px; padding: 16px 16px 14px; overflow: hidden;
}
.lg-card.overdue { border-color: rgba(239,68,68,0.4); }
.lg-card.done { border-color: rgba(34,197,94,0.4); }
.lg-card-head { display: flex; align-items: center; gap: 9px; margin-bottom: 12px; }
.lg-card-dot { width: 12px; height: 12px; border-radius: 4px; background: var(--gc); flex-shrink: 0; }
.lg-card-title { margin: 0; font-size: 16px; font-weight: 600; color: var(--text-strong); flex: 1; min-width: 0;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.lg-badge { font-size: 11px; padding: 2px 8px; border-radius: 999px; font-weight: 600; flex-shrink: 0; }
.lg-badge.done { background: rgba(34,197,94,0.15); color: #16a34a; }
.lg-badge.over { background: rgba(239,68,68,0.15); color: #dc2626; }
.lg-badge.sample { background: rgba(99,102,241,0.12); color: #6366f1; }

.lg-progress { display: flex; align-items: center; gap: 10px; margin-bottom: 12px; }
.lg-progress-bar { flex: 1; height: 8px; border-radius: 999px; background: rgba(99,102,241,0.12); overflow: hidden; }
.lg-progress-bar span { display: block; height: 100%; border-radius: 999px;
  background: linear-gradient(90deg, var(--gc), color-mix(in srgb, var(--gc) 60%, #38bdf8)); transition: width 0.4s ease; }
.lg-progress-pct { font-size: 13px; font-weight: 700; color: var(--text-strong); min-width: 38px; text-align: right; }

.lg-stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-bottom: 10px; }
.lg-stats div { background: var(--surface-soft); border: 1px solid var(--border); border-radius: 11px; padding: 8px; text-align: center; }
.lg-stats b { display: block; font-size: 17px; color: var(--text-strong); font-weight: 700; }
.lg-stats i { font-style: normal; font-size: 11px; color: var(--text-muted); }

.lg-exp { font-size: 12.5px; color: var(--text-muted); display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 10px; }
.lg-exp .early { color: #16a34a; font-weight: 600; }
.lg-exp .late { color: #dc2626; font-weight: 600; }
.lg-exp .muted { color: var(--text-faint); }
.lg-streak { margin-left: auto; background: var(--surface-soft); border: 1px solid var(--border); border-radius: 999px; padding: 2px 10px; font-size: 11.5px; color: var(--text); }

.lg-plan { background: var(--surface-soft); border: 1px dashed var(--border-strong); border-radius: 12px; padding: 9px 11px; margin-bottom: 12px; }
.lg-plan-row { font-size: 12.5px; color: var(--text); display: flex; gap: 8px; align-items: baseline; }
.lg-plan-row + .lg-plan-row { margin-top: 6px; }
.lg-plan-k { flex-shrink: 0; font-size: 10.5px; font-weight: 700; padding: 1px 7px; border-radius: 6px; }
.lg-plan-k.obstacle { background: rgba(245,158,11,0.16); color: #b45309; }
.lg-plan-k.对策 { background: rgba(99,102,241,0.14); color: #4f46e5; }

.lg-punch { background: var(--surface-soft); border: 1px solid var(--border); border-radius: 12px; padding: 10px; }
.lg-punch-row { display: flex; gap: 8px; align-items: center; }
.lg-punch-row + .lg-punch-row { margin-top: 9px; }
.lg-punch-date { flex: 1.2; min-width: 0; }
.lg-punch-amt { flex: 1; min-width: 0; }
.lg-punch-min { flex: 1; min-width: 0; }
.lg-punch-actions { align-items: center; }
.lg-backfill-tag { font-size: 10.5px; font-weight: 700; background: rgba(245,158,11,0.18); color: #b45309; padding: 2px 8px; border-radius: 6px; }
.lg-backfill-tag.sm { padding: 1px 6px; }
.lg-punch-btn {
  margin-left: auto; border: none; cursor: pointer; color: #fff; font-weight: 600; font-size: 13.5px;
  background: linear-gradient(120deg, #6366f1, #8b5cf6); padding: 8px 20px; border-radius: 10px;
}
.lg-punch-btn:active { transform: scale(0.97); }
.lg-edit-btn, .lg-del-btn { border: 1px solid var(--border); background: var(--surface); cursor: pointer; border-radius: 9px; padding: 7px 12px; font-size: 12.5px; color: var(--text); }
.lg-del-btn:hover { color: #dc2626; border-color: rgba(239,68,68,0.4); }
.lg-done-text { display: inline-flex; align-items: center; gap: 6px; color: #16a34a; font-weight: 600; font-size: 13.5px; margin-right: auto; }
.done-actions { display: flex; align-items: center; gap: 8px; }

/* 达成彩带 */
.lg-confetti { position: absolute; inset: 0; pointer-events: none; overflow: hidden; border-radius: 18px; }
.lg-confetti i { position: absolute; top: -10px; left: calc(10% + var(--i) * 8%); width: 7px; height: 10px; border-radius: 2px; opacity: 0.9; animation: lgConfetti 2.4s ease-in infinite; animation-delay: calc(var(--i) * 0.18s); }
@keyframes lgConfetti { 0% { transform: translateY(-12px) rotate(0); opacity: 0; } 15% { opacity: 1; } 100% { transform: translateY(220px) rotate(540deg); opacity: 0; } }

/* 看板 */
.lg-board { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; }
.lg-bcard { background: var(--surface); border: 1px solid var(--border); border-radius: 18px; padding: 16px; }
.lg-bcard-head { display: flex; align-items: center; gap: 9px; margin-bottom: 12px; }
.lg-bcard-head h3 { margin: 0; font-size: 15.5px; font-weight: 600; color: var(--text-strong); flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.lg-bcard-top { display: flex; align-items: center; gap: 16px; margin-bottom: 12px; }
.lg-ring { flex-shrink: 0; }
.lg-ring-t { font-size: 16px; font-weight: 700; fill: var(--text-strong); }
.lg-bcard-nums { flex: 1; display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
.lg-num { text-align: center; background: var(--surface-soft); border: 1px solid var(--border); border-radius: 11px; padding: 8px 4px; }
.lg-num b { display: block; font-size: 15px; font-weight: 700; color: var(--text-strong); }
.lg-num i { font-style: normal; font-size: 10.5px; color: var(--text-muted); }
.lg-num .early { color: #16a34a; } .lg-num .late { color: #dc2626; } .lg-num .muted { color: var(--text-faint); }

.lg-recent { margin-top: 12px; border-top: 1px dashed var(--border); padding-top: 10px; }
.lg-recent-h { font-size: 12.5px; color: var(--text-muted); margin-bottom: 6px; }
.lg-recent-row { display: flex; align-items: center; gap: 8px; font-size: 12.5px; padding: 4px 0; }
.lg-recent-date { color: var(--text-muted); width: 44px; flex-shrink: 0; }
.lg-recent-amt { font-weight: 600; color: var(--text-strong); }
.lg-recent-min { color: var(--text-muted); }
.lg-recent-del { margin-left: auto; border: none; background: transparent; color: var(--text-faint); cursor: pointer; font-size: 18px; line-height: 1; }
.lg-recent-del:hover { color: #dc2626; }

.lg-chart { background: var(--surface); border: 1px solid var(--border); border-radius: 18px; padding: 16px; margin-top: 14px; }
.lg-chart-h { font-size: 13.5px; font-weight: 600; color: var(--text-strong); margin-bottom: 10px; }
.lg-chart-svg { width: 100%; height: 180px; display: block; }
.lg-chart-axis { font-size: 9px; fill: var(--text-faint); }
.lg-chart-legend { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 8px; }
.lg-legend { display: inline-flex; align-items: center; gap: 5px; font-size: 11.5px; color: var(--text-muted); }
.lg-legend i { width: 10px; height: 10px; border-radius: 3px; }

/* 周报 */
.lg-week-nav { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 14px; }
.lg-wk-btn { border: 1px solid var(--border); background: var(--surface); cursor: pointer; border-radius: 10px; padding: 8px 16px; font-size: 13.5px; color: var(--text); }
.lg-wk-btn:disabled { opacity: 0.45; cursor: not-allowed; }
.lg-wk-range { text-align: center; }
.lg-wk-range strong { font-size: 14.5px; color: var(--text-strong); }
.lg-wk-now { display: block; font-size: 11px; color: var(--primary); font-weight: 600; }

.lg-week-table { background: var(--surface); border: 1px solid var(--border); border-radius: 16px; overflow: hidden; }
.lg-wt-head, .lg-wt-row { display: grid; grid-template-columns: 1.6fr 1fr 1fr 1fr; gap: 8px; padding: 11px 14px; align-items: center; }
.lg-wt-head { background: var(--surface-soft); font-size: 12.5px; color: var(--text-muted); font-weight: 600; }
.lg-wt-row { border-top: 1px solid var(--border); font-size: 13.5px; color: var(--text); }
.lg-wt-row.total { font-weight: 700; color: var(--text-strong); background: var(--surface-soft); }
.lg-wt-name { display: inline-flex; align-items: center; gap: 7px; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.lg-wt-name i { width: 9px; height: 9px; border-radius: 3px; flex-shrink: 0; }

.lg-compare { font-size: 13px; color: var(--text-muted); margin: 12px 2px; }
.lg-compare .early { color: #16a34a; font-weight: 600; }
.lg-compare .late { color: #dc2626; font-weight: 600; }
.lg-compare .muted { color: var(--text-faint); }

.lg-four { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; margin-top: 8px; }
.lg-four-col label { display: block; font-size: 13px; font-weight: 600; color: var(--text-strong); margin-bottom: 6px; }
.lg-four-col textarea { width: 100%; border: 1px solid var(--border); border-radius: 11px; padding: 9px 11px; font-size: 13px; color: var(--text); background: var(--surface); resize: vertical; font-family: inherit; }
.lg-four-col textarea:focus { outline: none; border-color: var(--primary); }
.lg-report-btn { margin-top: 16px; width: 100%; border: none; cursor: pointer; color: #fff; font-weight: 600; font-size: 14.5px; background: linear-gradient(120deg, #6366f1, #8b5cf6); padding: 13px; border-radius: 13px; }
.lg-report-btn:active { transform: scale(0.99); }
.lg-report-text { white-space: pre-wrap; word-break: break-word; font-size: 13px; line-height: 1.7; color: var(--text); max-height: 60vh; overflow: auto; background: var(--surface-soft); border: 1px solid var(--border); border-radius: 12px; padding: 14px; }

/* 我的 */
.lg-mine { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; }
.lg-mine-card { background: var(--surface); border: 1px solid var(--border); border-radius: 16px; padding: 16px; }
.lg-mine-card.danger { border-color: rgba(239,68,68,0.3); }
.lg-mine-card h3 { margin: 0 0 6px; font-size: 15px; color: var(--text-strong); }
.lg-mine-desc { font-size: 12.5px; color: var(--text-muted); margin: 0 0 12px; }
.lg-mine-btns { display: flex; flex-wrap: wrap; gap: 10px; }
.lg-mine-btn { border: 1px solid var(--border); background: var(--surface); cursor: pointer; border-radius: 10px; padding: 9px 16px; font-size: 13px; color: var(--text); }
.lg-mine-btn:hover { background: var(--nav-hover); }
.lg-mine-btn.warn { color: #b45309; border-color: rgba(245,158,11,0.4); }
.lg-mine-btn.danger { color: #dc2626; border-color: rgba(239,68,68,0.4); }
.lg-mine-btn.danger:disabled { opacity: 0.4; cursor: not-allowed; }
.lg-clear-all { display: flex; gap: 10px; align-items: center; }
.lg-clear-all .el-input { flex: 1; }
.lg-homescreen { margin: 0; padding-left: 18px; }
.lg-homescreen li { font-size: 12.5px; color: var(--text); margin-bottom: 8px; line-height: 1.6; }
.lg-homescreen b { color: var(--text-strong); }

/* 弹窗表单 */
.lg-form { display: flex; flex-direction: column; gap: 6px; }
.lg-form label { font-size: 13px; font-weight: 600; color: var(--text-strong); margin-top: 8px; }
.lg-form-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.lg-form-full { width: 100%; }
.lg-colors { display: flex; flex-wrap: wrap; gap: 8px; }
.lg-color { width: 26px; height: 26px; border-radius: 8px; border: 2px solid transparent; cursor: pointer; }
.lg-color.on { border-color: var(--text-strong); box-shadow: 0 0 0 2px var(--surface), 0 0 0 4px var(--primary); }

.lg-fade-enter-active, .lg-fade-leave-active { transition: opacity 0.25s ease; }
.lg-fade-enter-from, .lg-fade-leave-to { opacity: 0; }

/* 平板：导航变顶栏 */
@media (max-width: 1024px) {
  .lg-shell { flex-direction: column; }
  .lg-nav { position: sticky; top: 64px; flex: none; width: 100%; flex-direction: row; justify-content: space-between; padding: 8px; z-index: 20; }
  .lg-nav-item { width: auto; flex: 1; justify-content: center; flex-direction: column; gap: 4px; padding: 8px 4px; font-size: 12.5px; }
  .lg-content { width: 100%; }
}

/* 手机：导航变底栏 + 单列 */
@media (max-width: 768px) {
  .lg-root { padding: 0 14px 14px; }
  .lg-nav.is-bottom {
    position: fixed; left: 0; right: 0; bottom: 0; top: auto;
    flex-direction: row; justify-content: space-around;
    border-radius: 0; border-left: none; border-right: none; border-bottom: none;
    padding: 6px 4px calc(6px + env(safe-area-inset-bottom));
    background: color-mix(in srgb, var(--surface) 92%, transparent);
    backdrop-filter: blur(12px);
    box-shadow: 0 -6px 20px rgba(2,6,23,0.08);
    z-index: 40;
  }
  .lg-nav.is-bottom .lg-nav-item { flex: 1; }
  .lg-content { padding-bottom: 78px; }
  .lg-cards, .lg-board, .lg-mine, .lg-four { grid-template-columns: 1fr; }
  .lg-bcard-top { flex-direction: column; align-items: stretch; gap: 12px; }
  .lg-ring { align-self: center; }
  .lg-bcard-nums { width: 100%; }
  .lg-form-2 { grid-template-columns: 1fr; }
  .lg-stats { gap: 6px; }
  .lg-punch-row { flex-wrap: wrap; }
  .lg-punch-date, .lg-punch-amt, .lg-punch-min { flex: 1 1 30%; }
}

@media (max-width: 380px) {
  .lg-stats b { font-size: 15px; }
  .lg-nav-label { font-size: 11px; }
}
</style>
