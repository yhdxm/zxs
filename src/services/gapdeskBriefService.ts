// GAPDESK · AI 模型研判服务
//
// 边界（与项目「不编造」红线一致）：
//   1) 只把当前 48h 池的真实事件作为素材交给模型，提示词强约束「只能引用给定素材」；
//   2) 模型输出仅作为研判辅助展示，规则式 dailyBriefText 原样保留，只增不减；
//   3) 模型不可用 / 未配置 / 调用失败时，UI 降级到规则版，不伪造模型结论；
//   4) 48h 内同配置同池命中本地缓存，避免重复消耗免费额度。
import { callAi, type AiConfig } from './aiService'
import { CALLABLE_MODELS, toAiConfig, type CallableModel } from './modelCatalog'
import type { RankedEvent } from '../types/gapdesk'

const CACHE_KEY_PREFIX = 'gapdesk_ai_brief_v1'
const CACHE_TTL = 48 * 3600_000
const MAX_SEEDS = 12

/** 缓存按账号命名空间：换账号不会看到上一位的研判文本与模型归因 */
function cacheKeyOf(uid: string): string {
  return `${CACHE_KEY_PREFIX}:${uid || 'anon'}`
}

export interface BriefSeed {
  rank: number
  gap: number
  tier: string
  title: string
  ind: string
  reason: string
  srcCount: number
  lagH: number | null
}

export interface BriefResult {
  text: string
  model: string
  cached: boolean
  at: number
}

interface BriefCache {
  fp: string
  at: number
  text: string
  model: string
}

/**
 * 精选可一键套用的免费模型。
 * 注意：百炼免费额度标注有效期至 2026-09-20，已过期，故不列入「免费一键」；
 * 智谱 glm-4-flash 永久免费，硅基流动/智谱新用户送额度，OpenRouter 免费档按平台规则。
 */
export const FREE_BRIEF_MODELS: CallableModel[] = CALLABLE_MODELS.filter(
  (m) =>
    m.isFree &&
    (m.id === 'zhipu:glm-4-flash' ||
      m.id === 'zhipu:glm-4.7-flash' ||
      m.id === 'siliconflow:deepseek-v3' ||
      m.id === 'openrouter:deepseek-v3-free')
)

/** 一键套用免费模型的 provider/baseUrl/model（Key 仍需用户填一次，或复用已保存的） */
export function freeModelToConfig(id: string): Partial<AiConfig> | null {
  const m = CALLABLE_MODELS.find((x) => x.id === id)
  if (!m || !m.isFree) return null
  const cfg = toAiConfig(m)
  return { provider: cfg.provider, baseUrl: cfg.baseUrl, model: cfg.model }
}

/** 是否已有可用配置：Ollama 本地不需 Key；云厂商必须有 Key */
export function briefConfigReady(config: AiConfig | null | undefined): boolean {
  if (!config) return false
  if (config.provider === 'ollama') return Boolean(config.baseUrl)
  return Boolean(config.apiKey && config.model)
}

function poolSignature(events: RankedEvent[]): string {
  const ids = events.slice(0, MAX_SEEDS).map((e) => e.id).join(',')
  return `${events.length}|${ids}`
}

function fingerprint(config: AiConfig, events: RankedEvent[]): string {
  // Key 只取摘要不落明文；同账号换 Key 后指纹变化，不会复用旧结论
  const keyHash = config.apiKey ? String(config.apiKey.length) + config.apiKey.slice(-4) : ''
  return `${config.provider}|${config.model}|${keyHash}|${poolSignature(events)}`
}

function readCache(uid: string): BriefCache | null {
  if (typeof localStorage === 'undefined') return null
  const key = cacheKeyOf(uid)
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return null
    const parsed = JSON.parse(raw) as BriefCache
    if (!parsed || typeof parsed.text !== 'string' || !parsed.fp || !parsed.at) return null
    if (Date.now() - parsed.at > CACHE_TTL) {
      localStorage.removeItem(key)
      return null
    }
    return parsed
  } catch {
    return null
  }
}

function writeCache(entry: BriefCache, uid: string): void {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(cacheKeyOf(uid), JSON.stringify(entry))
  } catch {
    /* 隐私模式 / 配额满：缓存失败不影响本次生成 */
  }
}

export function clearBriefCache(uid = ''): void {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.removeItem(cacheKeyOf(uid))
  } catch {
    /* ignore */
  }
}

/** 读当前缓存状态，供 UI 显示「本次为 48h 缓存」而不用重复调用模型 */
export function peekBriefCache(config: AiConfig, events: RankedEvent[], uid = ''): BriefResult | null {
  const cache = readCache(uid)
  if (!cache || cache.fp !== fingerprint(config, events)) return null
  return { text: cache.text, model: cache.model, cached: true, at: cache.at }
}

export function buildBriefPrompt(events: RankedEvent[], titleOf: (e: RankedEvent) => string): string {
  const seeds: BriefSeed[] = events.slice(0, MAX_SEEDS).map((e) => ({
    rank: e.rank,
    gap: e.gap,
    tier: e.tier,
    title: titleOf(e),
    ind: e.ind,
    reason: e.reason ?? '',
    srcCount: e.src_count,
    lagH: e.lag_h
  }))
  const material = seeds
    .map(
      (s) =>
        `#${s.rank} [${s.tier} · GAP ${s.gap} · ${s.ind} · ${s.srcCount} 源 · 时差 ${s.lagH ?? '—'}h] ${s.title}${s.reason ? ` — ${s.reason}` : ''}`
    )
    .join('\n')

  return (
    `你是 GAPDESK 差值台的研判助手。下面是本系统当前 48 小时池内的真实差值事件（按池内分位排序，L0=前 10%、L1=前 10-40%、L2=其余）：\n\n` +
    `${material}\n\n` +
    `请基于上述素材写一段今日研判，严格遵守：\n` +
    `1. 只能使用上面给出的事件，不得引入素材之外的任何事件、数字、公司名、来源或时间；不得凭记忆补充；\n` +
    `2. 不要编造「预告兑现」「已确认」「官方回应」等素材中没有的事实；素材不足就直接写「样本不足，不下结论」；\n` +
    `3. 结构固定为四段，每段 1-3 句，总长 400 字内：\n` +
    `   ① 【今日最大差】点出 GAP 最高的一条（写 #序号，不写没给过的细节）；\n` +
    `   ② 【差在哪】按层级/行业归纳集中趋势，只用素材里的层级与行业；\n` +
    `   ③ 【能不能信】结合源数与时差说明可交叉验证程度，孤证（1 源）要点名；\n` +
    `   ④ 【建议动作】给出下一步可执行的核对动作，不承诺结果；\n` +
    `4. 末尾单独一行写「依据：#x #y」（列出你实际引用的序号，最多 5 个）；\n` +
    `5. 纯文本输出，不要 Markdown 代码块、不要额外寒暄。`
  )
}

function tidy(text: string): string {
  let out = (text || '').trim()
  const fence = out.match(/^```(?:markdown|md|text)?\s*\n?([\s\S]*?)\n?```$/i)
  if (fence?.[1]) out = fence[1].trim()
  return out
}

export async function generateGapBrief(
  config: AiConfig,
  events: RankedEvent[],
  titleOf: (e: RankedEvent) => string,
  force = false,
  uid = ''
): Promise<BriefResult> {
  if (!briefConfigReady(config)) throw new Error('未配置可用模型')
  if (!events.length) throw new Error('当前 48h 池没有可研判的真实事件')

  const fp = fingerprint(config, events)
  if (!force) {
    const cache = readCache(uid)
    if (cache && cache.fp === fp) {
      return { text: cache.text, model: cache.model, cached: true, at: cache.at }
    }
  }

  const text = tidy(await callAi(config, buildBriefPrompt(events, titleOf)))
  if (!text) throw new Error('模型返回内容为空')
  const at = Date.now()
  writeCache({ fp, at, text, model: config.model }, uid)
  return { text, model: config.model, cached: false, at }
}
