// 本地 AI 调用用量统计：全部存于浏览器 localStorage，
// 不写入云端、不消耗任何积分/额度，用于功能3「模型用量监测」。
//
// 记录口径（Fix #2）：
// - 对所有 provider 均在 callAi 成功后记录一次调用；
// - 若响应体携带 usage（如阿里百炼 / OpenAI 兼容返回的 prompt_tokens / completion_tokens /
//   total_tokens），则使用「真实 tokens」；否则按字符长度估算（est）。
// - 阿里百炼官方未开放实时余额/额度查询 API，模型中心「阿里百炼·本地用量」展示的
//   均为本应用真实调用记录（调用次数 + 响应 tokens），绝不伪造额度数字。

export interface UsageRecord {
  ts: number
  provider: string
  model: string
  /** 估算 prompt tokens（无真实 usage 时使用） */
  estPromptTokens: number
  /** 估算 completion tokens */
  estCompletionTokens: number
  /** 真实 prompt tokens（响应带 usage 时） */
  realPromptTokens?: number
  /** 真实 completion tokens */
  realCompletionTokens?: number
  /** 真实 total tokens */
  realTotalTokens?: number
  /** tokens 来源：real = 响应返回；est = 本地估算 */
  tokenSource: 'real' | 'est'
  isFree: boolean
}

export interface ModelUsageStat {
  provider: string
  model: string
  calls: number
  /** 该模型累计 tokens（真实优先，缺则估算） */
  tokens: number
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

/** 阿里百炼本地用量明细（Fix #2：真实调用次数 + 真实 tokens） */
export interface BailianUsage {
  totalCalls: number
  todayCalls: number
  totalTokens: number
  byModel: ModelUsageStat[]
}

const LOG_KEY = 'ai-usage-log'
const QUOTA_KEY = 'ai-bailian-quota'
const MAX_LOG = 600

function estTokens(text: string): number {
  return Math.max(1, Math.ceil((text || '').length / 4))
}

function recordTokens(r: UsageRecord): number {
  if (r.tokenSource === 'real') {
    return r.realTotalTokens ?? (r.realPromptTokens ?? 0) + (r.realCompletionTokens ?? 0)
  }
  return r.estPromptTokens + r.estCompletionTokens
}

/**
 * 判定某次调用是否免费（用于统计免费占比）。
 * 免费判定规则：
 * - ollama（本地）一律免费；
 * - openrouter 模型中含 :free 的为免费；
 * - siliconflow / zhipu / deepseek / volcengine 的已知免费档（模型名命中免费清单）计为免费；
 * - bailian（阿里百炼）在用户控制台属于「免费额度」档，按其免费档计为免费。
 * - openai-compatible 等其他默认按付费计。
 */
export function classifyFree(provider: string, model: string): boolean {
  if (provider === 'ollama') return true
  if (provider === 'bailian') return true // 用户控制台免费额度档
  if (provider === 'openrouter') return model.includes(':free')

  const p = provider.toLowerCase()
  const m = model.toLowerCase()
  if (p === 'siliconflow') {
    // 硅基流动免费档多为开源模型（DeepSeek / Qwen / GLM 等），命中即计免费
    return (
      m.includes('deepseek') ||
      m.includes('qwen') ||
      m.includes('glm') ||
      m.includes('llama') ||
      m.includes('qwq')
    )
  }
  if (p === 'zhipu') return m.includes('flash') // 智谱 GLM-4-Flash / 4.7-Flash 为永久免费档
  if (p === 'deepseek') return m.includes('chat') || m.includes('reasoner') // DeepSeek 新用户赠送额度，近似免费
  if (p === 'volcengine') return m.includes('seed') // 火山方舟豆包 seed 系列每日刷新免费额度

  return false // openai-compatible 等其他默认按付费计
}

export interface RecordUsageOptions {
  provider: string
  model: string
  promptText: string
  completionText: string
  /** 真实 usage（响应体携带时传入），优先于估算 */
  realUsage?: { promptTokens: number; completionTokens: number; totalTokens: number }
}

export function recordUsage(opts: RecordUsageOptions): void {
  if (typeof window === 'undefined') return
  try {
    const list = readLog()
    const isFree = classifyFree(opts.provider, opts.model)
    const realUsage = opts.realUsage
    list.push({
      ts: Date.now(),
      provider: opts.provider,
      model: opts.model,
      estPromptTokens: estTokens(opts.promptText),
      estCompletionTokens: estTokens(opts.completionText),
      realPromptTokens: realUsage ? realUsage.promptTokens : undefined,
      realCompletionTokens: realUsage ? realUsage.completionTokens : undefined,
      realTotalTokens: realUsage ? realUsage.totalTokens : undefined,
      tokenSource: realUsage ? 'real' : 'est',
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
    return Array.isArray(arr) ? (arr as UsageRecord[]) : []
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
      ({ provider: r.provider, model: r.model, calls: 0, tokens: 0, isFree: r.isFree, lastUsed: null } as ModelUsageStat)
    cur.calls++
    cur.tokens += recordTokens(r)
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

/**
 * 阿里百炼本地用量明细（Fix #2）：
 * 仅统计 provider === 'bailian' 的调用，返回总调用/今日调用/总 tokens/按模型分布。
 * 数据全部来自本应用真实调用记录（含响应 tokens），非官方额度。
 */
export function getBailianUsage(): BailianUsage {
  const list = readLog().filter((r) => r.provider === 'bailian')
  const startOfToday = new Date()
  startOfToday.setHours(0, 0, 0, 0)
  const todayMs = startOfToday.getTime()

  const byModelMap = new Map<string, ModelUsageStat>()
  let totalCalls = 0
  let todayCalls = 0
  let totalTokens = 0

  for (const r of list) {
    totalCalls++
    if (r.ts >= todayMs) todayCalls++
    const tok = recordTokens(r)
    totalTokens += tok
    const key = r.model
    const cur =
      byModelMap.get(key) ||
      ({ provider: 'bailian', model: r.model, calls: 0, tokens: 0, isFree: true, lastUsed: null } as ModelUsageStat)
    cur.calls++
    cur.tokens += tok
    cur.lastUsed = cur.lastUsed === null ? r.ts : Math.max(cur.lastUsed, r.ts)
    byModelMap.set(key, cur)
  }

  const byModel = Array.from(byModelMap.values()).sort((a, b) => b.calls - a.calls)
  return { totalCalls, todayCalls, totalTokens, byModel }
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
