// 错题智能归因 + 薄弱点图谱（A4）
// 纯前端、无 API、无网络、免费 —— 仅对「已过滤（不含 removed / 已删除意图）」的错题做本地启发式聚合。
// 设计原则：输入即干净数据（调用方负责过滤 removed 与删除意图，复用 A2 reliability 层），
// 本模块只做计数 / 排序 / 占比 / 趋势，零副作用，便于单测。

export interface WeaknessMistakeInput {
  /** 题型（两库均有 type 字段，是主归因轴） */
  type: string | null
  /** 错因（自由文本，按原值聚合；空值归为「未标注错因」） */
  reason: string | null
  /** 知识点 / 题号（仅学位英语有 question_id；四六级无此字段，归因以题型维度呈现） */
  questionId?: string | null
  /** 时间戳：四六级用 date(yyyy-mm-dd)，学位英语用 created_at(ISO)；用于趋势 */
  createdAt: string | null
}

/** 样本阈值：错题数低于此值时不展示归因结论，避免噪声误导（标注「数据不足」） */
export const WEAKNESS_MIN_SAMPLE = 3

export function normalizeType(t: string | null | undefined): string {
  const s = (t ?? '').trim()
  return s ? s : '未分类'
}

export function normalizeReason(r: string | null | undefined): string {
  const s = (r ?? '').trim()
  return s ? s : '未标注错因'
}

export interface CountItem {
  label: string
  count: number
  /** 占该维度总量的比例 0~1 */
  ratio: number
}

export interface TrendPoint {
  /** 周期键：month=YYYY-MM，week=YYYY-Www */
  period: string
  count: number
}

export type TrendPeriod = 'month' | 'week'

function tally(labels: string[]): CountItem[] {
  const total = labels.length
  const map = new Map<string, number>()
  for (const l of labels) map.set(l, (map.get(l) ?? 0) + 1)
  return Array.from(map.entries())
    .map(([label, count]) => ({ label, count, ratio: total ? count / total : 0 }))
    .sort((a, b) => b.count - a.count)
}

/** 按题型聚合（两库通用主维度） */
export function attributeByType(items: WeaknessMistakeInput[]): CountItem[] {
  return tally(items.map((i) => normalizeType(i.type)))
}

/** 按错因聚合（常见错因 Top-N） */
export function attributeByReason(items: WeaknessMistakeInput[]): CountItem[] {
  return tally(items.map((i) => normalizeReason(i.reason)))
}

/** 按知识点 / 题号聚合（学位英语：questionId；label 为原始 id，视图层再映射题面） */
export function attributeByQuestion(items: WeaknessMistakeInput[]): CountItem[] {
  const ids = items.map((i) => (i.questionId ?? '').trim()).filter(Boolean)
  return tally(ids)
}

function periodKey(iso: string, period: TrendPeriod): string | null {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return null
  if (period === 'month') {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  }
  // ISO 周（简化：以当年 1/1 起算的周序号）
  const start = new Date(d.getFullYear(), 0, 1)
  const dayOfYear = Math.floor((d.getTime() - start.getTime()) / 86_400_000) + start.getDay()
  const week = Math.ceil((dayOfYear + 1) / 7)
  return `${d.getFullYear()}-W${String(week).padStart(2, '0')}`
}

/** 按周期聚合错题数（趋势视图），按周期升序；无效时间被忽略 */
export function trendBy(items: WeaknessMistakeInput[], period: TrendPeriod = 'month'): TrendPoint[] {
  const map = new Map<string, number>()
  for (const it of items) {
    if (!it.createdAt) continue
    const k = periodKey(it.createdAt, period)
    if (!k) continue
    map.set(k, (map.get(k) ?? 0) + 1)
  }
  return Array.from(map.entries())
    .map(([period, count]) => ({ period, count }))
    .sort((a, b) => a.period.localeCompare(b.period))
}

export interface WeaknessReport {
  total: number
  /** 样本是否充足（>= WEAKNESS_MIN_SAMPLE） */
  enough: boolean
  byType: CountItem[]
  byReason: CountItem[]
  byQuestion: CountItem[]
  trend: TrendPoint[]
}

/** 一键生成某题库的薄弱点报告 */
export function buildWeaknessReport(
  items: WeaknessMistakeInput[],
  opts?: { period?: TrendPeriod }
): WeaknessReport {
  const total = items.length
  return {
    total,
    enough: total >= WEAKNESS_MIN_SAMPLE,
    byType: attributeByType(items),
    byReason: attributeByReason(items),
    byQuestion: attributeByQuestion(items),
    trend: trendBy(items, opts?.period ?? 'month')
  }
}
