// ============================================================
// 学习目标管理台 · 纯前端数据层（localStorage，不连任何外部接口）
// 目标：有终点、有总量的学习目标（如"背完 2000 个单词""读完 440 页的书"）
// 全部数据存于 localStorage，断网可用；所有变更即时持久化。
// ============================================================
import { reactive, watch } from 'vue'

// ---------- 类型 ----------
export interface LearningGoal {
  id: string
  name: string
  unit: string // 单位：个 / 页 / 讲 / 节 ...
  total: number // 总量
  deadline: string // 截止日 'YYYY-MM-DD'
  color: string // 配色（hex）
  obstacle?: string // 最容易拦住我的障碍（选填）
  countermeasure?: string // “如果它出现，我就……”的对策（选填）
  createdAt: string // ISO
  sample?: boolean // 是否为预置示例数据
}

export interface GoalRecord {
  id: string
  goalId: string
  date: string // 真实日期 'YYYY-MM-DD'（补记也写真实日期）
  amount: number // 当天完成量
  minutes?: number // 投入分钟数（选填）
  isBackfill: boolean // 是否为补记（带"补"标）
  createdAt: string // ISO
}

export interface WeeklyNote {
  keep: string // 保持
  problem: string // 问题
  try: string // 尝试
  plan: string // 下周预案
}

interface StoreData {
  version: number
  goals: LearningGoal[]
  records: GoalRecord[]
  weeklyNotes: Record<string, WeeklyNote>
}

export interface ExpectedResult {
  date: string | null // 预计完成日（null = 暂无推算）
  deltaDays: number | null // 与截止日比较：>=0 提前，<0 拖后（null = 暂无推算）
  rate: number // 近 7 天平均速度（每天）
}

export interface WeekStat {
  weekStart: string
  perGoal: { goalId: string; amount: number; days: number; minutes: number }[]
  totalAmount: number
  totalDays: number
  totalMinutes: number
}

// ---------- 常量 ----------
const STORAGE_KEY = 'zxs_learning_goals'
const CURRENT_VERSION = 1
export const BACKUP_THRESHOLD = 20 // 累计打卡记录达到该值显示备份横幅

// 预置配色板（冷白底 + 紫渐变主色系）
export const GOAL_PALETTE = [
  '#8b5cf6', // 紫
  '#6366f1', // 靛
  '#38bdf8', // 青
  '#22c55e', // 绿（成功）
  '#f59e0b', // 琥珀
  '#ec4899', // 粉
  '#14b8a6', // 蓝绿
  '#f43f5e' // 玫红
]

// ---------- 日期工具 ----------
export function todayStr(d = new Date()): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function parseDate(s: string): Date {
  const p = s.split('-').map(Number)
  const y = p[0] ?? 0
  const m = (p[1] ?? 1) - 1
  const d = p[2] ?? 1
  return new Date(y, m, d)
}

export function addDays(s: string, n: number): string {
  const d = parseDate(s)
  d.setDate(d.getDate() + n)
  return todayStr(d)
}

export function diffDays(a: string, b: string): number {
  // b - a（整天数）
  return Math.round((parseDate(b).getTime() - parseDate(a).getTime()) / 86400000)
}

/** 返回某日期所在周的周一（周一起算） */
export function weekStartMonday(s: string): string {
  const d = parseDate(s)
  const dow = (d.getDay() + 6) % 7 // 0=周一 .. 6=周日
  d.setDate(d.getDate() - dow)
  return todayStr(d)
}

export function formatShort(s: string): string {
  const parts = s.split('-')
  const m = parts[1] ?? '0'
  const d = parts[2] ?? '0'
  return `${Number(m)}/${Number(d)}`
}

function uid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return 'g_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
}

// ---------- 响应式状态 + 持久化 ----------
const state = reactive<StoreData>({
  version: CURRENT_VERSION,
  goals: [],
  records: [],
  weeklyNotes: {}
})

let persistTimer: number | null = null
function persist() {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch (e) {
    console.warn('[learningGoals] 持久化失败', e)
  }
}

// 深度监听：任意输入即时保存
watch(
  state,
  () => {
    if (persistTimer) window.clearTimeout(persistTimer)
    persistTimer = window.setTimeout(persist, 120)
  },
  { deep: true }
)

// ---------- 读取 / 迁移 / 预置 ----------
function migrate(raw: any): StoreData {
  // 旧版本（无 weeklyNotes / 结构残缺）补默认值
  const data: StoreData = {
    version: CURRENT_VERSION,
    goals: Array.isArray(raw?.goals) ? raw.goals : [],
    records: Array.isArray(raw?.records) ? raw.records : [],
    weeklyNotes: raw?.weeklyNotes && typeof raw.weeklyNotes === 'object' ? raw.weeklyNotes : {}
  }
  return data
}

function buildSample(): StoreData {
  const t = todayStr()
  const g1: LearningGoal = {
    id: uid(),
    name: '背英语单词',
    unit: '个',
    total: 2000,
    deadline: addDays(t, 60),
    color: '#8b5cf6',
    obstacle: '单词太枯燥，背几天就想放弃',
    countermeasure: '每天早起 20 分钟用本页打卡，没打完就不刷短视频',
    createdAt: new Date().toISOString(),
    sample: true
  }
  const g2: LearningGoal = {
    id: uid(),
    name: '学位英语大纲精学',
    unit: '讲',
    total: 40,
    deadline: addDays(t, 90),
    color: '#38bdf8',
    obstacle: '语法规则看不懂，容易卡住',
    countermeasure: '先看例句再抠规则，卡住就标记周末集中问 AI',
    createdAt: new Date().toISOString(),
    sample: true
  }
  const g3: LearningGoal = {
    id: uid(),
    name: 'Python 入门课',
    unit: '节',
    total: 60,
    deadline: addDays(t, 45),
    color: '#22c55e',
    obstacle: '环境配置总报错，容易劝退',
    countermeasure: '严格按课内步骤，报错先搜官方文档再问',
    createdAt: new Date().toISOString(),
    sample: true
  }

  const recs: GoalRecord[] = []
  const mk = (goalId: string, dayOffset: number, amount: number, minutes: number | undefined, isBackfill: boolean): GoalRecord => ({
    id: uid(),
    goalId,
    date: addDays(t, dayOffset),
    amount,
    minutes,
    isBackfill,
    createdAt: new Date().toISOString()
  })

  // g1 背单词：覆盖 补记（day -5）、休息日（day -2 首次漏打）
  recs.push(mk(g1.id, -6, 40, 240, false))
  recs.push(mk(g1.id, -5, 35, 180, true)) // 补记示例
  recs.push(mk(g1.id, -4, 45, 200, false))
  recs.push(mk(g1.id, -3, 50, 220, false))
  // day -2 漏打（本周首次，休息日）
  recs.push(mk(g1.id, -1, 42, 160, false))

  // g2 学位英语：连续漏打（day -3 / -2 / -1），昨天是第二次漏打 → 中断
  recs.push(mk(g2.id, -6, 1, 30, false))
  recs.push(mk(g2.id, -5, 1, 25, false))
  recs.push(mk(g2.id, -4, 1, 20, false))
  // day -3 / -2 / -1 漏打（连续，触发中断）

  // g3 Python：截至昨天连续打卡，昨天首次漏打（休息日黄卡）
  recs.push(mk(g3.id, -6, 1, 40, false))
  recs.push(mk(g3.id, -5, 1, 35, false))
  recs.push(mk(g3.id, -4, 1, 45, false))
  recs.push(mk(g3.id, -3, 1, 30, false))
  recs.push(mk(g3.id, -2, 1, 50, false))
  // day -1 漏打（本周首次，休息日）

  return {
    version: CURRENT_VERSION,
    goals: [g1, g2, g3],
    records: recs,
    weeklyNotes: {}
  }
}

let initialized = false
export function initLearningGoals() {
  if (initialized) return
  initialized = true
  if (typeof localStorage === 'undefined') return
  const rawStr = localStorage.getItem(STORAGE_KEY)
  if (!rawStr) {
    // 首次使用：写入预置示例
    const sample = buildSample()
    state.goals = sample.goals
    state.records = sample.records
    state.weeklyNotes = sample.weeklyNotes
    state.version = CURRENT_VERSION
    persist()
    return
  }
  try {
    const raw = JSON.parse(rawStr)
    const data = migrate(raw)
    state.goals = data.goals
    state.records = data.records
    state.weeklyNotes = data.weeklyNotes
    state.version = CURRENT_VERSION
  } catch (e) {
    console.warn('[learningGoals] 读取失败，回退预置', e)
    const sample = buildSample()
    state.goals = sample.goals
    state.records = sample.records
    state.weeklyNotes = sample.weeklyNotes
    persist()
  }
}

// ---------- 查询 / 计算（纯函数） ----------
export function goalDone(goalId: string, records = state.records): number {
  return records.filter((r) => r.goalId === goalId).reduce((a, r) => a + r.amount, 0)
}

export function completionRate(goal: LearningGoal, records = state.records): number {
  const done = goalDone(goal.id, records)
  if (goal.total <= 0) return 0
  return Math.min(1, done / goal.total)
}

export function remainingAmount(goal: LearningGoal, records = state.records): number {
  return Math.max(0, goal.total - goalDone(goal.id, records))
}

export function daysLeft(goal: LearningGoal, today = todayStr()): number {
  return diffDays(today, goal.deadline) // 可为负（逾期）
}

/** 今日建议量 = 剩余量 ÷ 剩余天数（剩余天数<=0 时按 1 天计，全部滚入今日） */
export function dailySuggestion(goal: LearningGoal, records = state.records, today = todayStr()): number {
  const remaining = remainingAmount(goal, records)
  if (remaining <= 0) return 0
  const dl = daysLeft(goal, today)
  const denom = Math.max(dl, 1)
  return Math.max(1, Math.ceil(remaining / denom))
}

/** 连续打卡天数（含每周 1 个休息日：本周首次漏打不中断，第二次才断） */
export function computeStreak(goalId: string, records = state.records, today = todayStr()): number {
  const hitSet = new Set(records.filter((r) => r.goalId === goalId).map((r) => r.date))
  let streak = 0
  let cur = today
  let lastWeek = ''
  let weekMiss = 0
  let guard = 0
  while (guard++ < 4000) {
    const ws = weekStartMonday(cur)
    if (ws !== lastWeek) {
      weekMiss = 0
      lastWeek = ws
    }
    if (hitSet.has(cur)) {
      streak++
    } else {
      weekMiss++
      if (weekMiss >= 2) break // 第二次漏打才中断
      streak++ // 首次漏打（休息日）仍计入维持天数
    }
    cur = addDays(cur, -1)
  }
  return streak
}

/** 预计完成日：按近 7 天平均速度推算；样本不足（近 7 天无记录）返回 null */
export function expectedCompletion(goal: LearningGoal, records = state.records, today = todayStr()): ExpectedResult {
  const windowStart = addDays(today, -6)
  const recent = records.filter((r) => r.goalId === goal.id && r.date >= windowStart && r.date <= today)
  if (recent.length === 0) return { date: null, deltaDays: null, rate: 0 }
  const sum = recent.reduce((a, r) => a + r.amount, 0)
  if (sum <= 0) return { date: null, deltaDays: null, rate: 0 }
  const rate = sum / 7
  const remaining = remainingAmount(goal, records)
  if (remaining <= 0) return { date: today, deltaDays: 0, rate }
  const need = Math.ceil(remaining / rate)
  const expDate = addDays(today, need)
  const delta = diffDays(expDate, goal.deadline) // >=0 提前，<0 拖后
  return { date: expDate, deltaDays: delta, rate }
}

export interface YesterdayMiss {
  missed: boolean
  kind: 'rest' | 'break' | null // rest=休息日(黄) break=滚入今日(红)
}
/** 昨日是否漏打卡，以及属于休息日还是中断 */
export function yesterdayMissInfo(goalId: string, records = state.records, today = todayStr()): YesterdayMiss {
  const y = addDays(today, -1)
  const hitY = records.some((r) => r.goalId === goalId && r.date === y)
  if (hitY) return { missed: false, kind: null }
  const ws = weekStartMonday(y)
  let weekMissBefore = 0
  let d = y
  let guard = 0
  while (d >= ws && guard++ < 10) {
    const isHit = records.some((r) => r.goalId === goalId && r.date === d)
    if (!isHit) weekMissBefore++
    d = addDays(d, -1)
  }
  // weekMissBefore 含 y 本身（=1）。>=2 表示本周此前已有漏打 → 本次为中断
  return { missed: true, kind: weekMissBefore >= 2 ? 'break' : 'rest' }
}

export function isOverdue(goal: LearningGoal, records = state.records, today = todayStr()): boolean {
  return daysLeft(goal, today) < 0 && remainingAmount(goal, records) > 0
}

export function isCompleted(goal: LearningGoal, records = state.records): boolean {
  return remainingAmount(goal, records) <= 0
}

// ---------- 周报 ----------
export function weekStats(records = state.records, goals = state.goals, weekStart?: string): WeekStat {
  const ws = weekStart || weekStartMonday(todayStr())
  const we = addDays(ws, 6)
  const inWeek = records.filter((r) => r.date >= ws && r.date <= we)
  const perGoalMap = new Map<string, { goalId: string; amount: number; days: number; minutes: number }>()
  for (const g of goals) {
    perGoalMap.set(g.id, { goalId: g.id, amount: 0, days: 0, minutes: 0 })
  }
  const hitDays = new Map<string, Set<string>>()
  for (const r of inWeek) {
    const e = perGoalMap.get(r.goalId)
    if (!e) continue
    e.amount += r.amount
    e.minutes += r.minutes || 0
    if (!hitDays.has(r.goalId)) hitDays.set(r.goalId, new Set())
    hitDays.get(r.goalId)!.add(r.date)
  }
  for (const [gid, e] of perGoalMap) {
    e.days = hitDays.get(gid)?.size || 0
  }
  const perGoal = [...perGoalMap.values()]
  return {
    weekStart: ws,
    perGoal,
    totalAmount: perGoal.reduce((a, e) => a + e.amount, 0),
    totalDays: new Set(inWeek.map((r) => r.date)).size,
    totalMinutes: perGoal.reduce((a, e) => a + e.minutes, 0)
  }
}

export function weekCompare(curWeekStart: string, records = state.records): {
  cur: WeekStat
  prev: WeekStat
  amountPct: number | null
  minutesPct: number | null
} {
  const cur = weekStats(records, state.goals, curWeekStart)
  const prev = weekStats(records, state.goals, addDays(curWeekStart, -7))
  const amountPct = prev.totalAmount > 0 ? ((cur.totalAmount - prev.totalAmount) / prev.totalAmount) * 100 : null
  const minutesPct = prev.totalMinutes > 0 ? ((cur.totalMinutes - prev.totalMinutes) / prev.totalMinutes) * 100 : null
  return { cur, prev, amountPct, minutesPct }
}

// 近 14 天分目标投入分钟（供手写 SVG 堆叠柱状图；无分钟的日期不硬凑）
export function last14DaysMinutes(goals = state.goals, records = state.records, today = todayStr()) {
  const days: { date: string; segments: { goalId: string; minutes: number; color: string }[]; total: number }[] = []
  for (let i = 13; i >= 0; i--) {
    const date = addDays(today, -i)
    const dayRecs = records.filter((r) => r.date === date && (r.minutes || 0) > 0)
    const segMap = new Map<string, number>()
    for (const r of dayRecs) segMap.set(r.goalId, (segMap.get(r.goalId) || 0) + (r.minutes || 0))
    const segments: { goalId: string; minutes: number; color: string }[] = []
    let total = 0
    for (const g of goals) {
      const m = segMap.get(g.id)
      if (m) {
        segments.push({ goalId: g.id, minutes: m, color: g.color })
        total += m
      }
    }
    days.push({ date, segments, total })
  }
  return days
}

export function recentRecords(goalId: string, limit = 10, records = state.records): GoalRecord[] {
  return records
    .filter((r) => r.goalId === goalId)
    .slice()
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.createdAt < a.createdAt ? -1 : 1))
    .slice(0, limit)
}

// ---------- 写操作 ----------
export function addGoal(input: Omit<LearningGoal, 'id' | 'createdAt'>): LearningGoal {
  const g: LearningGoal = { ...input, id: uid(), createdAt: new Date().toISOString() }
  state.goals.push(g)
  return g
}

export function updateGoal(id: string, patch: Partial<LearningGoal>) {
  const g = state.goals.find((x) => x.id === id)
  if (g) Object.assign(g, patch)
}

export function deleteGoal(id: string) {
  const idx = state.goals.findIndex((x) => x.id === id)
  if (idx >= 0) state.goals.splice(idx, 1)
  // 级联删除其记录
  for (let i = state.records.length - 1; i >= 0; i--) {
    const r = state.records[i]
    if (r && r.goalId === id) state.records.splice(i, 1)
  }
}

export function addRecord(input: {
  goalId: string
  date: string
  amount: number
  minutes?: number
  isBackfill: boolean
}): GoalRecord {
  const r: GoalRecord = {
    id: uid(),
    goalId: input.goalId,
    date: input.date,
    amount: input.amount,
    minutes: input.minutes,
    isBackfill: input.isBackfill,
    createdAt: new Date().toISOString()
  }
  state.records.push(r)
  return r
}

export function deleteRecord(id: string) {
  const idx = state.records.findIndex((x) => x.id === id)
  if (idx >= 0) state.records.splice(idx, 1)
}

export function getWeeklyNote(weekStart: string): WeeklyNote {
  return state.weeklyNotes[weekStart] || { keep: '', problem: '', try: '', plan: '' }
}

export function setWeeklyNote(weekStart: string, note: WeeklyNote) {
  state.weeklyNotes[weekStart] = { ...note }
}

export function clearSamples() {
  state.goals = state.goals.filter((g) => !g.sample)
  state.records = state.records.filter((r) => {
    const g = state.goals.find((x) => x.id === r.goalId)
    return !!g // 目标被删，记录也随之无效；保留与剩余目标的关联
  })
}

export function clearAll() {
  state.goals = []
  state.records = []
  state.weeklyNotes = {}
}

export function exportData(): string {
  return JSON.stringify(
    { version: CURRENT_VERSION, goals: state.goals, records: state.records, weeklyNotes: state.weeklyNotes },
    null,
    2
  )
}

export function importData(json: string): { ok: boolean; error?: string } {
  try {
    const raw = JSON.parse(json)
    if (!raw || !Array.isArray(raw.goals) || !Array.isArray(raw.records)) {
      return { ok: false, error: '文件结构不正确（缺少 goals / records）' }
    }
    state.goals = raw.goals
    state.records = raw.records
    state.weeklyNotes = raw.weeklyNotes && typeof raw.weeklyNotes === 'object' ? raw.weeklyNotes : {}
    state.version = CURRENT_VERSION
    persist()
    return { ok: true }
  } catch (e: any) {
    return { ok: false, error: e?.message || '解析失败' }
  }
}

export function totalRecords(): number {
  return state.records.length
}

// ---------- 导出响应式状态 ----------
export function useLearningGoals() {
  return state
}
