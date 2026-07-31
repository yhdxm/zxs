<template>
  <div class="board">
    <!-- ===== 头部 + 视图切换 ===== -->
    <section class="board-head">
      <div>
        <h2>数据看板</h2>
        <p>实时统计你的待办、点位与内容，支持按日期查看趋势。</p>
      </div>
      <div class="board-switch">
        <button class="switch-btn" :class="{ active: viewMode === 'cards' }" @click="viewMode = 'cards'">
          <el-icon><Grid /></el-icon><span>卡片</span>
        </button>
        <button class="switch-btn" :class="{ active: viewMode === 'charts' }" @click="viewMode = 'charts'">
          <el-icon><TrendCharts /></el-icon><span>图表</span>
        </button>
        <button class="switch-btn" :class="{ active: viewMode === 'report' }" @click="viewMode = 'report'">
          <el-icon><Document /></el-icon><span>报表</span>
        </button>
      </div>
    </section>

    <!-- ===== 卡片视图 ===== -->
    <section v-show="viewMode === 'cards'" class="viz-grid">
      <div class="stat-card stat-todo">
        <div class="stat-icon"><el-icon><List /></el-icon></div>
        <div class="stat-meta">
          <div class="stat-num">{{ boardCounts.todos.count }}</div>
          <div class="stat-label">待完成事项</div>
          <div class="stat-sub">共 {{ boardCounts.todos.total }} · 今日新增 {{ boardCounts.todos.newCount }}</div>
        </div>
      </div>
      <div class="stat-card stat-point">
        <div class="stat-icon"><el-icon><Location /></el-icon></div>
        <div class="stat-meta">
          <div class="stat-num">{{ boardCounts.points.count }}</div>
          <div class="stat-label">点位信息<small>（未巡查）</small></div>
          <div class="stat-sub">共 {{ boardCounts.points.total }} · 今日新增 {{ boardCounts.points.newCount }}</div>
        </div>
      </div>
      <div class="stat-card stat-content">
        <div class="stat-icon"><el-icon><Document /></el-icon></div>
        <div class="stat-meta">
          <div class="stat-num">{{ boardCounts.contents.count }}</div>
          <div class="stat-label">处理内容<small>（未完成）</small></div>
          <div class="stat-sub">共 {{ boardCounts.contents.total }} · 今日新增 {{ boardCounts.contents.newCount }}</div>
        </div>
      </div>
      <div class="stat-card stat-rate">
        <div class="stat-icon"><el-icon><DataLine /></el-icon></div>
        <div class="stat-meta"><div class="stat-num">{{ completionRate }}<small>%</small></div><div class="stat-label">待办完成率</div></div>
      </div>

      <div class="chart-card chart-wide">
        <h4>按日期趋势（近 14 天）</h4>
        <EChart :option="trendOption" height="260px" />
      </div>
      <div class="chart-card">
        <h4>待办完成率</h4>
        <EChart :option="completionOption" height="230px" />
      </div>
      <div class="chart-card">
        <h4>数据量分布</h4>
        <EChart :option="countsOption" height="230px" />
      </div>
    </section>

    <!-- ===== 图表视图 ===== -->
    <section v-show="viewMode === 'charts'" class="viz-grid">
      <div class="chart-card chart-wide">
        <h4>按日期趋势（近 14 天）</h4>
        <EChart :option="trendOption" height="300px" />
      </div>
      <div class="chart-card">
        <h4>待办完成率</h4>
        <EChart :option="completionOption" height="260px" />
      </div>
      <div class="chart-card">
        <h4>数据量分布</h4>
        <EChart :option="countsOption" height="260px" />
      </div>
      <div class="chart-card chart-wide">
        <h4>完成率环形占比</h4>
        <EChart :option="donePieOption" height="300px" />
      </div>
    </section>

    <!-- ===== 报表视图 ===== -->
    <section v-show="viewMode === 'report'" class="report">
      <div class="report-toolbar">
        <el-radio-group v-model="reportMode" size="default">
          <el-radio-button value="todos">待办</el-radio-button>
          <el-radio-button value="points">点位</el-radio-button>
          <el-radio-button value="contents">内容</el-radio-button>
        </el-radio-group>
        <el-select v-model="reportDensity" size="default" class="density-select">
          <el-option label="宽松行距" value="loose" />
          <el-option label="紧凑行距" value="tight" />
        </el-select>
        <span class="report-count">共 {{ reportRows.length }} 条</span>
      </div>

      <div class="report-table-wrap" :class="reportDensity">
        <table class="report-table">
          <thead>
            <tr>
              <th v-for="col in visibleColumns" :key="col.key">{{ col.label }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in reportRows" :key="row._id">
              <td v-for="col in visibleColumns" :key="col.key" :class="{ 'cell-tag': col.tag }">
                <template v-if="col.tag">
                  <el-tag :type="(row[col.key] && row[col.key].type) || 'info'" effect="light" size="small">{{ row[col.key] && row[col.key].text }}</el-tag>
                </template>
                <template v-else>{{ row[col.key] }}</template>
              </td>
            </tr>
            <tr v-if="reportRows.length === 0"><td :colspan="visibleColumns.length" class="report-empty">暂无数据</td></tr>
          </tbody>
        </table>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import type { EChartsOption } from 'echarts'
import {
  List, Location, Document, DataLine, Grid, TrendCharts
} from '@element-plus/icons-vue'
import { type AppDashboardData, type TodoItem, type PointItem, type ContentItem, computeDashboardCounts, type DashboardCounts } from '../services/appDataService'
import EChart from './EChart.vue'

const props = defineProps<{ dashboard: AppDashboardData }>()
type ViewMode = 'cards' | 'charts' | 'report'
const viewMode = ref<ViewMode>('cards')

const todoPendingCount = computed(() => props.dashboard.todos.filter((t) => t.status !== 'done').length)
const todoDoneCount = computed(() => props.dashboard.todos.filter((t) => t.status === 'done').length)

/** 看板统计口径（M6）：点位剔除已巡查、内容剔除已完成；含条数 / 总条数 / 新增 */
const boardCounts = computed<DashboardCounts>(() => computeDashboardCounts(props.dashboard))

const completionRate = computed(() => {
  const total = props.dashboard.todos.length
  if (!total) return 0
  return Math.round((todoDoneCount.value / total) * 100)
})

const trendDays = computed<string[]>(() => {
  const days: string[] = []
  const now = new Date()
  for (let i = 13; i >= 0; i -= 1) {
    const d = new Date(now)
    d.setDate(now.getDate() - i)
    days.push(d.toISOString().slice(0, 10))
  }
  return days
})

const itemDate = (item: { date?: string; createdAt: string }): string => {
  if (item.date && /^\d{4}-\d{2}-\d{2}$/.test(item.date)) return item.date
  return item.createdAt.slice(0, 10)
}

const trendSeries = computed(() => {
  const days = trendDays.value
  // 待办趋势按“未完成”统计，已完成的数据不再占用待办口径
  const todoCounts = days.map((day) => props.dashboard.todos.filter((t) => itemDate(t) === day && t.status !== 'done').length)
  const pointCounts = days.map((day) => props.dashboard.points.filter((p) => itemDate(p) === day).length)
  const contentCounts = days.map((day) => props.dashboard.contents.filter((c) => itemDate(c) === day).length)
  return { todoCounts, pointCounts, contentCounts }
})

const completionOption = computed<EChartsOption>(() => ({
  series: [{
    type: 'gauge',
    startAngle: 210,
    endAngle: -30,
    min: 0,
    max: 100,
    progress: { show: true, width: 16, roundCap: true, itemStyle: { color: '#4f46e5' } },
    axisLine: { lineStyle: { width: 16, color: [[1, '#e5e7eb']] } },
    axisTick: { show: false },
    splitLine: { show: false },
    axisLabel: { show: false },
    pointer: { show: false },
    anchor: { show: false },
    detail: { valueAnimation: true, fontSize: 30, fontWeight: 'bolder', offsetCenter: [0, 0], formatter: '{value}%', color: '#0f172a' },
    data: [{ value: completionRate.value }]
  }]
}))

const countsOption = computed<EChartsOption>(() => ({
  grid: { left: 8, right: 16, top: 24, bottom: 8, containLabel: true },
  tooltip: { trigger: 'axis' },
  xAxis: {
    type: 'category',
    data: ['待办', '点位', '内容'],
    axisLine: { lineStyle: { color: '#cbd5e1' } },
    axisLabel: { color: '#64748b' }
  },
  yAxis: { type: 'value', splitLine: { lineStyle: { color: '#eef2f7' } }, axisLabel: { color: '#64748b' } },
  series: [{
    type: 'bar',
    data: [boardCounts.value.todos.count, boardCounts.value.points.count, boardCounts.value.contents.count],
    barWidth: '46%',
    itemStyle: {
      borderRadius: [8, 8, 0, 0],
      color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: '#6366f1' }, { offset: 1, color: '#06b6d4' }] }
    },
    label: { show: true, position: 'top', color: '#475569' }
  }]
}))

const donePieOption = computed<EChartsOption>(() => {
  const done = todoDoneCount.value
  const doing = props.dashboard.todos.filter((t) => t.status === 'doing').length
  const todo = props.dashboard.todos.filter((t) => t.status === 'todo').length
  return {
    tooltip: { trigger: 'item' },
    legend: { bottom: 6, itemGap: 16, textStyle: { color: '#64748b' } },
    series: [{
      type: 'pie',
      radius: ['42%', '64%'],
      center: ['50%', '46%'],
      avoidLabelOverlap: false,
      itemStyle: { borderRadius: 8, borderColor: '#fff', borderWidth: 2 },
      label: { show: false },
      data: [
        { value: done, name: '已完成', itemStyle: { color: '#10b981' } },
        { value: doing, name: '进行中', itemStyle: { color: '#3b82f6' } },
        { value: todo, name: '未开始', itemStyle: { color: '#f59e0b' } }
      ]
    }]
  }
})

const trendOption = computed<EChartsOption>(() => ({
  grid: { left: 8, right: 16, top: 30, bottom: 8, containLabel: true },
  tooltip: { trigger: 'axis' },
  legend: { data: ['待办', '点位', '内容'], top: 0, textStyle: { color: '#64748b' } },
  xAxis: {
    type: 'category',
    boundaryGap: false,
    data: trendDays.value,
    axisLabel: { color: '#94a3b8', fontSize: 10, formatter: (value: string) => value.slice(5) }
  },
  yAxis: { type: 'value', splitLine: { lineStyle: { color: '#eef2f7' } }, axisLabel: { color: '#94a3b8' } },
  series: [
    { name: '待办', type: 'line', smooth: true, showSymbol: false, data: trendSeries.value.todoCounts, itemStyle: { color: '#4f46e5' }, areaStyle: { color: 'rgba(79,70,229,0.12)' } },
    { name: '点位', type: 'line', smooth: true, showSymbol: false, data: trendSeries.value.pointCounts, itemStyle: { color: '#0ea5e9' }, areaStyle: { color: 'rgba(14,165,233,0.12)' } },
    { name: '内容', type: 'line', smooth: true, showSymbol: false, data: trendSeries.value.contentCounts, itemStyle: { color: '#10b981' }, areaStyle: { color: 'rgba(16,185,129,0.12)' } }
  ]
}))

/* ============ 报表 ============ */
const reportMode = ref<'todos' | 'points' | 'contents'>('todos')
const reportDensity = ref<'loose' | 'tight'>('loose')

interface ReportCol { key: string; label: string; tag?: boolean }
const todoColumns: ReportCol[] = [
  { key: 'title', label: '标题' },
  { key: 'status', label: '状态', tag: true },
  { key: 'priority', label: '优先级', tag: true },
  { key: 'date', label: '日期' },
  { key: 'note', label: '备注' }
]
const pointColumns: ReportCol[] = [
  { key: 'name', label: '名称' },
  { key: 'address', label: '地址' },
  { key: 'category', label: '分类' },
  { key: 'status', label: '状态', tag: true },
  { key: 'date', label: '日期' }
]
const contentColumns: ReportCol[] = [
  { key: 'title', label: '标题' },
  { key: 'category', label: '分类' },
  { key: 'tags', label: '标签' },
  { key: 'date', label: '日期' },
  { key: 'time', label: '时间' }
]

const visibleColumns = computed(() => {
  if (reportMode.value === 'todos') return todoColumns
  if (reportMode.value === 'points') return pointColumns
  return contentColumns
})

const reportRows = computed<Array<Record<string, any>>>(() => {
  if (reportMode.value === 'todos') {
    return (props.dashboard.todos as TodoItem[]).map((t) => {
      const statusText = t.status === 'done' ? '已完成' : t.status === 'doing' ? '进行中' : '未开始'
      const statusType = t.status === 'done' ? 'success' : t.status === 'doing' ? 'warning' : 'info'
      return {
        _id: t.id,
        title: t.title,
        status: { text: statusText, type: statusType },
        priority: { text: t.priority === 'high' ? '高' : t.priority === 'low' ? '低' : '中', type: t.priority === 'high' ? 'danger' : t.priority === 'low' ? 'info' : 'warning' },
        date: itemDate(t),
        note: t.note || '—'
      }
    })
  }
  if (reportMode.value === 'points') {
    return (props.dashboard.points as PointItem[]).map((p) => ({
      _id: p.id,
      name: p.name,
      address: p.address,
      category: p.category || '—',
      status: { text: p.status === 'done' ? '已巡查' : p.status === 'issue' ? '异常' : '待巡查', type: p.status === 'done' ? 'success' : p.status === 'issue' ? 'danger' : 'info' },
      date: itemDate(p)
    }))
  }
  return (props.dashboard.contents as ContentItem[]).map((c) => ({
    _id: c.id,
    title: c.title,
    category: c.category || '—',
    tags: c.tags || '—',
    date: c.date,
    time: c.time
  }))
})
</script>

<style scoped>
.board {
  font-family: 'Inter', system-ui, -apple-system, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif;
  color: #0f172a;
  max-width: 1440px;
  margin: 0 auto;
}
.board-head { display: flex; align-items: flex-end; justify-content: space-between; gap: 16px; flex-wrap: wrap; padding: 4px 0 4px; }
.board-head h2 { margin: 0 0 4px; font-size: 18px; font-weight: 600; color: var(--text-strong); }
.board-head p { margin: 0; color: #64748b; font-size: 14px; }

.board-switch {
  display: inline-flex;
  background: rgba(255, 255, 255, 0.9);
  border: 1px solid rgba(99, 102, 241, 0.12);
  border-radius: 14px;
  padding: 4px;
  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.06), inset 0 0 0 1px rgba(255,255,255,0.8);
}
.switch-btn {
  display: inline-flex; align-items: center; gap: 6px;
  border: none; background: transparent; padding: 8px 16px; border-radius: 10px;
  font-size: 14px; font-weight: 600; color: #475569; cursor: pointer; transition: all 0.2s ease;
}
.switch-btn :deep(svg) { font-size: 16px; }
.switch-btn:hover { color: #4f46e5; }
.switch-btn.active {
  background: linear-gradient(120deg, #4f46e5, #8b5cf6);
  color: #fff;
  box-shadow: 0 6px 18px rgba(79, 70, 229, 0.35), inset 0 0 0 1px rgba(255,255,255,0.2);
}

.viz-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 16px; margin-top: 16px; }
.stat-card {
  background: #fff;
  border: 1px solid rgba(99, 102, 241, 0.08);
  border-radius: 18px;
  padding: 20px;
  display: flex; align-items: center; gap: 14px;
  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.05);
  transition: transform 0.25s, box-shadow 0.25s;
  position: relative;
  overflow: hidden;
}
.stat-card::before {
  content: '';
  position: absolute;
  top: 0; right: 0;
  width: 90px; height: 90px;
  border-radius: 50%;
  transform: translate(30%, -30%);
  opacity: 0.12;
  filter: blur(18px);
}
.stat-card:hover { transform: translateY(-4px); box-shadow: 0 16px 36px rgba(15, 23, 42, 0.1); }
.stat-icon { width: 46px; height: 46px; border-radius: 14px; display: grid; place-items: center; color: #fff; flex-shrink: 0; box-shadow: 0 6px 16px rgba(0,0,0,0.12); }
.stat-icon :deep(svg) { font-size: 22px; }
.stat-todo .stat-icon { background: linear-gradient(135deg, #6366f1, #8b5cf6); }
.stat-todo::before { background: #6366f1; }
.stat-point .stat-icon { background: linear-gradient(135deg, #0ea5e9, #38bdf8); }
.stat-point::before { background: #0ea5e9; }
.stat-content .stat-icon { background: linear-gradient(135deg, #10b981, #34d399); }
.stat-content::before { background: #10b981; }
.stat-rate .stat-icon { background: linear-gradient(135deg, #f59e0b, #f97316); }
.stat-rate::before { background: #f59e0b; }
.stat-num { font-size: 26px; font-weight: 800; }
.stat-num small { font-size: 15px; }
.stat-label { font-size: 13px; color: #64748b; }
.stat-label small { font-size: 11px; color: #94a3b8; font-weight: 400; }
.stat-sub { font-size: 11px; color: #94a3b8; margin-top: 2px; font-variant-numeric: tabular-nums; }

.chart-card {
  background: #fff;
  border: 1px solid rgba(99, 102, 241, 0.08);
  border-radius: 18px;
  padding: 16px 18px 14px;
  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.05);
  display: flex;
  flex-direction: column;
  min-height: 280px;
}
.chart-card h4 { margin: 0 0 8px; font-size: 14px; color: #334155; font-weight: 600; }
.chart-card :deep(.e-chart) { flex: 1; min-height: 0; }
.chart-wide { grid-column: span 2; min-height: 320px; }

/* ===== 报表 ===== */
.report { margin-top: 16px; }
.report-toolbar { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; margin-bottom: 12px; }
.density-select { width: 130px; }
.report-count { font-size: 13px; color: #64748b; }
.report-table-wrap {
  background: #fff;
  border: 1px solid rgba(99, 102, 241, 0.08);
  border-radius: 18px;
  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.05);
  overflow: hidden;
}
.report-table { width: 100%; border-collapse: collapse; font-size: 14px; }
.report-table thead th {
  text-align: left; padding: 14px 16px; background: #f8fafc; color: #475569; font-weight: 600;
  border-bottom: 1px solid #eef0f4; white-space: nowrap;
}
.report-table td { padding: 14px 16px; border-bottom: 1px solid #f1f5f9; color: #1e293b; }
.report-table tbody tr:last-child td { border-bottom: none; }
.report-table tbody tr:hover { background: #f8fafc; }
.report-table.loose td { padding: 16px; }
.report-table.tight td { padding: 8px 16px; }
.report-empty { text-align: center; color: #94a3b8; padding: 40px 0; }

@media (max-width: 1100px) {
  .viz-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .chart-wide { grid-column: span 2; }
}
@media (max-width: 640px) {
  .viz-grid { grid-template-columns: 1fr 1fr; }
  .chart-wide { grid-column: span 2; min-height: 300px; }
  .board-head { flex-direction: column; align-items: stretch; }
  .board-switch { width: 100%; justify-content: space-between; }
  .switch-btn { flex: 1; justify-content: center; }
  .report-toolbar { gap: 8px; }
  .density-select { width: 110px; }
  .report-table-wrap { overflow-x: auto; }
  .report-table { min-width: 560px; }
}
</style>
