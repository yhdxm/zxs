// 本地 AI 调用用量统计：全部存于浏览器 localStorage，
// 不写入云端、不消耗任何积分/额度，用于功能3「模型用量监测」。

export interface UsageRecord {
  ts: number
  provider: string
  model: string
  estPromptTokens: number
  estCompletionTokens: number
  isFree: boolean
}

export interface ModelUsageStat {
  provider: string
  model: string
  calls: number
  estTokens: number
  isFree: boolean
  lastUsed: number | null
}

export interface UsageSummary {
  totalCalls: number
  todayCalls: number
  freeCalls: number
  paidCalls: number
  freeRatio: number
  totalEstTokens: number
  byModel: ModelUsageStat[]
  bailianUsed: number
}

const LOG_KEY = 'ai-usage-log'
const QUOTA_KEY = 'ai-bailian-quota'
const MAX_LOG = 600

function estTokens(text: string): number {
  return Math.max(1, Math.ceil((text || '').length / 4))
}

/** 判定某次调用是否免费（用于统计免费占比） */
export function classifyFree(provider: string, model: string): boolean {
  if (provider === 'ollama') return true
  if (provider === 'openrouter') return model.includes(':free')
  return false // 阿里百炼 / OpenAI 兼容接口 默认按付费计
}

export function recordUsage(opts: {
  provider: string
  model: string
  promptText: string
  completionText: string
}): void {
  if (typeof window === 'undefined') return
  try {
    const list = readLog()
    const isFree = classifyFree(opts.provider, opts.model)
    list.push({
      ts: Date.now(),
      provider: opts.provider,
      model: opts.model,
      estPromptTokens: estTokens(opts.promptText),
      estCompletionTokens: estTokens(opts.completionText),
      isFree
    })
    if (list.length > MAX_LOG) list.splice(0, list.length - MAX_LOG)
    window.localStorage.setItem(LOG_KEY, JSON.stringify(list))
  } catch {
    /* 忽略写入异常 */
  }
}

function readLog(): UsageRecord[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(LOG_KEY)
    if (!raw) return []
    const arr = JSON.parse(raw)
    return Array.isArray(arr) ? arr : []
  } catch {
    return []
  }
}

export function getUsageStats(): UsageSummary {
  const list = readLog()
  const startOfToday = new Date()
  startOfToday.setHours(0, 0, 0, 0)
  const todayMs = startOfToday.getTime()

  const byModelMap = new Map<string, ModelUsageStat>()
  let totalCalls = 0
  let todayCalls = 0
  let freeCalls = 0
  let paidCalls = 0
  let totalEstTokens = 0
  let bailianUsed = 0

  for (const r of list) {
    totalCalls++
    if (r.ts >= todayMs) todayCalls++
    if (r.isFree) freeCalls++
    else paidCalls++
    totalEstTokens += r.estPromptTokens + r.estCompletionTokens
    if (r.provider === 'bailian') bailianUsed++

    const key = `${r.provider}::${r.model}`
    const cur =
      byModelMap.get(key) ||
      ({ provider: r.provider, model: r.model, calls: 0, estTokens: 0, isFree: r.isFree, lastUsed: null } as ModelUsageStat)
    cur.calls++
    cur.estTokens += r.estPromptTokens + r.estCompletionTokens
    cur.lastUsed = cur.lastUsed === null ? r.ts : Math.max(cur.lastUsed, r.ts)
    byModelMap.set(key, cur)
  }

  const byModel = Array.from(byModelMap.values()).sort((a, b) => b.calls - a.calls)

  return {
    totalCalls,
    todayCalls,
    freeCalls,
    paidCalls,
    freeRatio: totalCalls ? Math.round((freeCalls / totalCalls) * 100) : 0,
    totalEstTokens,
    byModel,
    bailianUsed
  }
}

export function setBailianQuota(n: number): void {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(QUOTA_KEY, String(Math.max(0, Math.floor(n))))
}

export function getBailianQuota(): number | null {
  if (typeof window === 'undefined') return null
  const raw = window.localStorage.getItem(QUOTA_KEY)
  if (!raw) return null
  const n = Number(raw)
  return Number.isFinite(n) ? n : null
}

export function clearUsage(): void {
  if (typeof window === 'undefined') return
  window.localStorage.removeItem(LOG_KEY)
}

/** 导出原始调用日志，供「需求收集」模块做每日/趋势聚合（本地读取，不消耗积分） */
export function getUsageLog(): UsageRecord[] {
  return readLog()
}
