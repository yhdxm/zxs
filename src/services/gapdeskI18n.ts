/**
 * 差值台 GAPDESK · 自动翻译（免费通道）
 *
 * 边界（与产品口径一致）：
 *   1) 只翻外文事件的「标题 + 摘要截断」，来源名/URL/证据链原文一律不翻；
 *   2) 译文只进展示层，不参与指纹、聚类、打分、排序 —— 翻译波动不能改变差值；
 *   3) 免费接口有匿名额度，本地按天估字符预算，超了如实停，不偷偷失败；
 *   4) 缓存 48h，与 gap_events 的保留窗口一致；失败不写缓存，下轮可重试。
 *
 * 通道：MyMemory 匿名 GET（免费、无需 key），失败返回 null 由调用方降级原文。
 */
import type { GapEventRow } from '../types/gapdesk'

export const I18N_CACHE_KEY = 'gapdesk_i18n_v1'
export const I18N_DAILY_KEY = 'gapdesk_i18n_daily'
export const I18N_AUTO_KEY = 'gapdesk_i18n_auto'
export const I18N_TTL_HOURS = 48
/** 匿名免费额度保守估算：5000 字符/天，留 500 余量 */
export const I18N_DAILY_CHARS = 4500
/** 摘要只翻前 120 字符，避免长摘要把日额度一次吃光 */
export const I18N_SUMMARY_MAX = 120
/** 标题上限，超长标题多为拼接噪音 */
export const I18N_TITLE_MAX = 180

export interface I18nEntry {
  title: string
  summary: string
  ts: number
}

export type I18nMap = Record<string, I18nEntry>

export interface I18nDaily {
  date: string
  chars: number
}

const ENDPOINT = 'https://api.mymemory.translated.net/get'
const TIMEOUT_MS = 8000

/** 本地日键：与 gapdeskFormat 的 dayKey 同口径（用户可见的「今天」） */
export function i18nDayKey(ts: number = Date.now()): string {
  const d = new Date(ts)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/**
 * 外文判定：库里显式标了 is_foreign 就听库的；null 时按标题字符启发式。
 * is_foreign === false 的国内事件一律不翻 —— 用户明确「国内这些事情我是要的」，
 * 不能被误判成外文而替换标题。
 */
export function isForeignLike(e: Pick<GapEventRow, 'is_foreign' | 'title'>): boolean {
  if (e.is_foreign === true) return true
  if (e.is_foreign === false) return false
  const title = e.title ?? ''
  const cjk = (title.match(/[\u3400-\u9fff]/g) ?? []).length
  const latin = (title.match(/[A-Za-z]/g) ?? []).length
  return latin > 12 && cjk <= 1
}

/** 缓存 key：事件指纹足够唯一；同指纹不同标题不会并存（采集侧已按指纹去重） */
export function i18nKeyOf(e: Pick<GapEventRow, 'event_key'>): string {
  return String(e.event_key || '')
}

/** 缓存是否有效：48h 内且确有译文 */
export function i18nFresh(entry: I18nEntry | undefined, nowMs: number = Date.now()): boolean {
  if (!entry || !entry.title) return false
  const age = nowMs - entry.ts
  return Number.isFinite(age) && age >= 0 && age < I18N_TTL_HOURS * 3600_000
}

/** 是否还需要翻译：非外文 / 有新鲜缓存 / 空标题 都跳过 */
export function needI18n(
  e: Pick<GapEventRow, 'event_key' | 'is_foreign' | 'title'>,
  map: I18nMap,
  nowMs: number = Date.now()
): boolean {
  if (!isForeignLike(e)) return false
  if (!(e.title ?? '').trim()) return false
  return !i18nFresh(map[i18nKeyOf(e)], nowMs)
}

/** 本次要消耗的额度（字符数）；已翻过的部分不计 */
export function i18nCostOf(e: Pick<GapEventRow, 'title' | 'summary'>): number {
  const title = (e.title ?? '').slice(0, I18N_TITLE_MAX).length
  const summary = (e.summary ?? '').slice(0, I18N_SUMMARY_MAX).length
  return title + summary
}

/** 日额度是否还有余量；跨天自动重置，不需要清理动作 */
export function i18nBudgetLeft(daily: I18nDaily | null, nowMs: number = Date.now()): number {
  if (!daily || daily.date !== i18nDayKey(nowMs)) return I18N_DAILY_CHARS
  const used = Number.isFinite(daily.chars) ? Math.max(0, daily.chars) : 0
  return Math.max(0, I18N_DAILY_CHARS - used)
}

/** 解析 MyMemory 返回体：只认 status 200 且非空译文，quotaFinished 直接判失败 */
export function parseI18nResponse(raw: string): string | null {
  try {
    const json = JSON.parse(raw) as {
      responseStatus?: number
      quotaFinished?: boolean
      responseData?: { translatedText?: unknown }
    }
    if (json.responseStatus !== 200 || json.quotaFinished) return null
    const text = json.responseData?.translatedText
    return typeof text === 'string' && text.trim() ? text.trim() : null
  } catch {
    return null
  }
}

/** 单段翻译：8 秒超时；任何失败都返回 null，不抛给 UI */
export async function translateSegment(
  text: string,
  signal?: AbortSignal
): Promise<string | null> {
  const value = (text ?? '').trim()
  if (!value) return null
  // 已含中文（国内事件/中英混排标题）不必再翻，避免把中文回译成英文
  if ((value.match(/[\u3400-\u9fff]/g) ?? []).length > 1) return null

  const url = `${ENDPOINT}?q=${encodeURIComponent(value)}&langpair=en|zh-CN`
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  const passSignal = (): void => {
    if (signal?.aborted) controller.abort()
  }
  signal?.addEventListener('abort', passSignal)
  try {
    const res = await fetch(url, { signal: controller.signal })
    if (!res.ok) return null
    return parseI18nResponse(await res.text())
  } catch {
    return null
  } finally {
    clearTimeout(timer)
    signal?.removeEventListener('abort', passSignal)
  }
}

/** 一条事件的标题 + 摘要翻译；标题失败则整条失败（不写半截缓存） */
export async function translateEvent(
  e: Pick<GapEventRow, 'title' | 'summary'>
): Promise<{ title: string; summary: string } | null> {
  const title = await translateSegment((e.title ?? '').slice(0, I18N_TITLE_MAX))
  if (!title) return null
  const rawSummary = (e.summary ?? '').slice(0, I18N_SUMMARY_MAX)
  const summary = rawSummary ? (await translateSegment(rawSummary)) ?? '' : ''
  return { title, summary }
}

/* ============================================================
   localStorage 读写（隐私模式 / 配额满都静默降级为内存态）
   ============================================================ */

export function readI18nMap(): I18nMap {
  try {
    const raw = globalThis.localStorage?.getItem(I18N_CACHE_KEY)
    const parsed: unknown = raw ? JSON.parse(raw) : {}
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
    const out: I18nMap = {}
    for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (!value || typeof value !== 'object') continue
      const row = value as Partial<I18nEntry>
      if (typeof row.title !== 'string' || typeof row.ts !== 'number') continue
      out[key] = { title: row.title, summary: typeof row.summary === 'string' ? row.summary : '', ts: row.ts }
    }
    return out
  } catch {
    return {}
  }
}

export function writeI18nMap(map: I18nMap): void {
  try {
    globalThis.localStorage?.setItem(I18N_CACHE_KEY, JSON.stringify(map))
  } catch {
    /* 写不进去不影响本次会话的内存译文 */
  }
}

export function readI18nDaily(): I18nDaily | null {
  try {
    const raw = globalThis.localStorage?.getItem(I18N_DAILY_KEY)
    const parsed: unknown = raw ? JSON.parse(raw) : null
    if (!parsed || typeof parsed !== 'object') return null
    const row = parsed as Partial<I18nDaily>
    if (typeof row.date !== 'string' || typeof row.chars !== 'number') return null
    return { date: row.date, chars: row.chars }
  } catch {
    return null
  }
}

export function writeI18nDaily(daily: I18nDaily): void {
  try {
    globalThis.localStorage?.setItem(I18N_DAILY_KEY, JSON.stringify(daily))
  } catch {
    /* 同上：额度记账写不进去只影响跨会话统计，不阻塞本次翻译 */
  }
}

export function readAutoTranslate(): boolean {
  try {
    const raw = globalThis.localStorage?.getItem(I18N_AUTO_KEY)
    return raw === null ? true : raw === '1'
  } catch {
    return true
  }
}

export function writeAutoTranslate(on: boolean): void {
  try {
    globalThis.localStorage?.setItem(I18N_AUTO_KEY, on ? '1' : '0')
  } catch {
    /* 静默 */
  }
}
