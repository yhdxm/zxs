/**
 * 差值台 GAPDESK · 纯函数格式化工具
 *
 * 约定：
 * - 全部为无副作用纯函数，不依赖 Vue / Supabase / dayjs，可直接在采集脚本与测试中复用；
 * - 时间入参统一为 epoch 毫秒（与库表 bigint 字段 ts_* 一致），0 表示「源站无时间」；
 * - 所有函数对 NaN / 负数 / 空值做兜底，绝不返回 undefined 让模板炸掉。
 */
import { GAP_CRED_CROSS, GAP_CRED_FIRST, GAP_CRED_LONE } from '../config/gapdeskConfig'
import type { GapEventRow, GapTone } from '../types/gapdesk'

/** 1 分钟 / 1 小时 / 1 天的毫秒数，避免魔法数字散落 */
const MS_MIN = 60 * 1000
const MS_HOUR = 60 * MS_MIN
const MS_DAY = 24 * MS_HOUR

/**
 * 相对时间：刚刚 / N分钟前 / N小时前 / N天前。
 * @param tsMs 目标时间（epoch 毫秒），0 视为「时间未知」
 * @param nowMs 当前时间（便于测试注入），默认 Date.now()
 */
export function fmtAgo(tsMs: number, nowMs: number = Date.now()): string {
  if (!Number.isFinite(tsMs) || tsMs <= 0) return '时间未知'

  const diff = nowMs - tsMs
  // 源站时间偶尔超前（时区处理瑕疵），一律按「刚刚」展示，不展示「-3分钟前」这种噪音
  if (diff < MS_MIN) return '刚刚'
  if (diff < MS_HOUR) return `${Math.floor(diff / MS_MIN)}分钟前`
  if (diff < MS_DAY) return `${Math.floor(diff / MS_HOUR)}小时前`

  return `${Math.floor(diff / MS_DAY)}天前`
}

/**
 * 绝对时钟：`MM-DD HH:mm`（本地时区，跨年自动带年）。
 * @param tsMs epoch 毫秒；0 或非法值返回空串（表格里留空比显示 1970 干净）
 */
export function fmtClock(tsMs: number): string {
  if (!Number.isFinite(tsMs) || tsMs <= 0) return ''

  const date = new Date(tsMs)
  const time = date.getTime()
  if (!Number.isFinite(time)) return ''

  const pad = (n: number): string => (n < 10 ? `0${n}` : String(n))
  const md = `${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
  const hm = `${pad(date.getHours())}:${pad(date.getMinutes())}`

  // 非本年度的记录补上年份，避免「12-31」被误读成今年
  const thisYear = new Date().getFullYear()
  return date.getFullYear() === thisYear ? `${md} ${hm}` : `${date.getFullYear()}-${md} ${hm}`
}

/**
 * 数字展示：千分位；≥10000 转 `N.N万`（去掉多余的 .0）。
 */
export function fmtNum(n: number): string {
  if (!Number.isFinite(n)) return '0'

  const value = Math.round(n)
  const sign = value < 0 ? '-' : ''
  const abs = Math.abs(value)

  if (abs >= 10000) {
    const wan = (abs / 10000).toFixed(1).replace(/\.0$/, '')
    return `${sign}${wan}万`
  }

  return sign + abs.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

/**
 * 金额展示：`¥1,234`（整数元，四舍五入；不用万为单位，避免报价被误读）。
 */
export function fmtMoney(n: number): string {
  if (!Number.isFinite(n)) return '¥0'

  const value = Math.round(n)
  const sign = value < 0 ? '-' : ''
  const abs = Math.abs(value)
  return `${sign}¥${abs.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`
}

/**
 * 数值夹取到 [min, max]；max 小于 min 时以 min 为准。
 */
export function clamp(n: number, min: number, max: number): number {
  if (!Number.isFinite(n)) return min
  const lo = Number.isFinite(min) ? min : 0
  const hi = Number.isFinite(max) ? Math.max(max, lo) : lo
  return Math.min(Math.max(n, lo), hi)
}

/**
 * 百分比（整数 0-100）：a 占 b 的比例。b <= 0 时返回 0，避免除零。
 */
export function pct(a: number, b: number): number {
  if (!Number.isFinite(a) || !Number.isFinite(b) || b <= 0) return 0
  return clamp(Math.round((a / b) * 100), 0, 100)
}

/**
 * 热度文案：0 = 未触达、<20 冷、<50 温、<80 热、≥80 沸。
 * 注意「未触达」与「冷」是两件事：前者是没数据，后者是数据很低。
 */
export function heatLabel(h: number): string {
  if (!Number.isFinite(h) || h <= 0) return '未触达'
  if (h < 20) return '冷'
  if (h < 50) return '温'
  if (h < 80) return '热'
  return '沸'
}

/**
 * 差值分档（决定颜色）：≥85 hot、≥70 warm、其余 cool。
 */
export function gapTone(gap: number): GapTone {
  if (!Number.isFinite(gap)) return 'cool'
  if (gap >= 85) return 'hot'
  if (gap >= 70) return 'warm'
  return 'cool'
}

/**
 * jsonb 兜底读取：Supabase 正常返回已解析对象，但 Realtime 载荷 / 历史数据
 * 可能是字符串，甚至 null。三种情况都收敛成 T。
 *
 * @param v 待解析值
 * @param fallback 解析失败时的返回值
 */
export function safeJson<T>(v: unknown, fallback: T): T {
  if (v === null || v === undefined) return fallback

  if (typeof v === 'string') {
    const text = v.trim()
    if (text === '') return fallback
    try {
      return JSON.parse(text) as T
    } catch {
      return fallback
    }
  }

  if (typeof v === 'object') return v as T

  // number / boolean 这类标量无法代表 jsonb 结构，直接回退
  return fallback
}

/**
 * 标题指纹：FNV-1a 32 位，返回 hex。
 *
 * 归一化与 server.mjs 完全一致：小写 + 去掉所有空白 + 取前 28 字符，
 * 这样同一条快讯在不同信源上的细微排版差异（空格/大小写）不会产生双 key。
 * 输出不补零（与 server.mjs 的 `(h>>>0).toString(16)` 逐位对齐），
 * 因此同一标题在采集端与前端算出的 event_key 必然相同。
 */
export function eventKeyOf(title: string): string {
  const normalized = (title ?? '').toLowerCase().replace(/\s/g, '').slice(0, 28)

  let hash = 2166136261
  for (let i = 0; i < normalized.length; i += 1) {
    hash ^= normalized.charCodeAt(i)
    // Math.imul 保证 32 位乘法不丢精度（与 server.mjs 同写法规避浮点误差）
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0).toString(16)
}

/**
 * 「差在哪」结构化标签：从事件真实字段派生，不重算分数、不编造。
 * 卡片 / 详情 / 移动端共用，保证同一事件在三处说法一致。
 */
export function gapGapTagsOf(event: GapEventRow): string[] {
  const tags: string[] = []
  if (event.is_foreign === true) tags.push('海外先发')
  // 时差优先露出：这是差值台最硬的信号，不能被次要标签挤掉
  if (event.lag_h != null && event.lag_h > 0) {
    tags.push(`源间时差 ${Math.round(event.lag_h * 10) / 10}h`)
  }
  if ((event.mass_heat ?? 0) === 0) tags.push('大众未出圈')
  else tags.push('大众已出圈')
  if (event.src_count <= 1) tags.push('孤证')
  else if (event.src_count >= 3) tags.push(`${event.src_count} 源交叉`)
  if (event.ts_first_seen > 0 && event.ts_published > 0 && event.ts_first_seen > event.ts_published) {
    tags.push('早于源站发布时刻')
  }
  return tags.slice(0, 4)
}

/** 差标签语义色类别：与 tokens.css 的 --gd-tag-* 一一对应 */
export type GapTagTone = 'foreign' | 'lag' | 'mass' | 'risk' | 'cross' | 'neutral'

/**
 * 标签 → 语义色：紫=海外先发 / 橙=时差 / 青=未出圈 / 红=孤证 / 绿=多源交叉。
 * 按标签文字判定，不改 gapGapTagsOf 的返回结构；未知标签落 neutral，
 * 保证加新标签时不会渲染出错色。三处视图共用，色义一致。
 */
export function gapTagTone(tag: string): GapTagTone {
  if (tag.includes('海外')) return 'foreign'
  if (tag.includes('时差')) return 'lag'
  if (tag.includes('未出圈')) return 'mass'
  if (tag.includes('孤证')) return 'risk'
  if (tag.includes('交叉')) return 'cross'
  return 'neutral'
}

/** 自动翻译角标文案：状态来自 store，不在这里判空值 */
export function i18nBadgeTextOf(state: 'native' | 'off' | 'done' | 'loading' | 'failed' | 'quota'): string {
  switch (state) {
    case 'native': return '国内原文'
    case 'off': return '自动翻译已关'
    case 'done': return '机器翻译'
    case 'loading': return '翻译中…'
    case 'failed': return '译文不可用'
    case 'quota': return '今日免费额度已用完'
  }
}

/** 翻译额度用尽的固定文案：所有端共用，避免一处说「额度用完」一处说「保留原文」 */
export const I18N_QUOTA_OUT_TEXT = '额度用尽 · 保留原文'
/** 用尽时的完整说明，作为 title / aria-label，明确「明日恢复 + 原文保留」 */
export const I18N_QUOTA_OUT_TIP = '免费翻译日额度已用完，明日自动恢复；原文始终保留'

/** 额度徽标三档：正常 / 低于 20% 警示 / 用尽 */
export type I18nQuotaTone = 'ok' | 'low' | 'out'

/**
 * 翻译额度档位。每日总字符数从 store 的 i18nDailyChars 传入，不在本函数写死。
 * 用尽标记（store 的 i18nBudgetOut）优先于剩余字符判断。
 */
export function i18nQuotaToneOf(left: number, daily: number, out: boolean): I18nQuotaTone {
  const rest = Number.isFinite(left) && left > 0 ? left : 0
  const total = Number.isFinite(daily) && daily > 0 ? daily : 0
  if (out || rest <= 0) return 'out'
  if (total > 0 && rest / total < 0.2) return 'low'
  return 'ok'
}

/** 额度徽标短文案：正常/警示都报真实剩余字符数，用尽按固定口径说清楚。 */
export function i18nQuotaTextOf(left: number, daily: number, out: boolean): string {
  if (i18nQuotaToneOf(left, daily, out) === 'out') return I18N_QUOTA_OUT_TEXT
  const rest = Number.isFinite(left) && left > 0 ? Math.round(left) : 0
  return `今日剩余 ${rest} 字`
}

/** 额度徽标完整说明（title / aria-label），数值同样来自调用方传入的真实 store 值。 */
export function i18nQuotaTipOf(left: number, daily: number, out: boolean): string {
  if (i18nQuotaToneOf(left, daily, out) === 'out') return I18N_QUOTA_OUT_TIP
  const rest = Number.isFinite(left) && left > 0 ? Math.round(left) : 0
  const total = Number.isFinite(daily) && daily > 0 ? Math.round(daily) : 0
  return `免费翻译日额度 ${total} 字，今日剩余 ${rest} 字；译文只用于展示，原文始终保留`
}

/**
 * 事件归日 key：live（1 小时内）/ today（今天更早）/ YYYY-MM-DD / unknown（源站无时间）。
 * PC 最新信息的分段、移动端最新信息的分段、日期胶囊筛选必须共用这一份，
 * 否则同一事件在两端会被分到不同日期、或筛出空列表。
 */
export function bandKeyOf(event: { ts_published: number }, nowMs: number = Date.now()): string {
  if (!(event.ts_published > 0)) return 'unknown'
  if (nowMs - event.ts_published < 3600_000) return 'live'
  const d = new Date(event.ts_published)
  const today = new Date(nowMs)
  const sameDay =
    d.getFullYear() === today.getFullYear() &&
    d.getMonth() === today.getMonth() &&
    d.getDate() === today.getDate()
  if (sameDay) return 'today'
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/**
 * 「能不能信」展示口径（横幅与移动卡片共用，PC/移动同一句话）。
 * 只用事件自带的 src_count 与证据链首触源；不打分、不猜来源。
 */
export interface GapCredibility {
  /** 短标签：如「3 路源 · 交叉验证」 */
  label: string
  /** 语义色类别：孤证走警示色，交叉验证走正常色 */
  tone: 'lone' | 'cross'
  /** 首触源名称；证据链缺失时为 null，界面不编造 */
  firstSource: string | null
  /** hover 提示：带上首触源，避免窄屏挤不下又看不见 */
  tip: string
}

export function gapCredibilityOf(
  event: Pick<GapEventRow, 'src_count'>,
  firstSource?: { source_name: string | null } | null
): GapCredibility {
  const count = Number.isFinite(event.src_count) ? Math.max(0, Math.round(event.src_count)) : 0
  const lone = count <= 1
  const name = (firstSource?.source_name ?? '').trim() || null
  const headline = `${count} 路源 · ${lone ? GAP_CRED_LONE : GAP_CRED_CROSS}`
  return {
    label: headline,
    tone: lone ? 'lone' : 'cross',
    firstSource: name,
    tip: name ? `${headline}；${GAP_CRED_FIRST}：${name}` : headline
  }
}

/** AI 研判末尾引用行解析结果：body 保持原文，refs 为引用序号 */
export interface GapBriefCitations {
  /** 去掉末尾引用行后的研判正文（原文，不改写） */
  body: string
  /** 去重后的引用序号，按出现顺序 */
  refs: number[]
}

/**
 * 解析模型研判末尾的「依据：#x #y」。只认末尾独立一行；
 * 格式不符 / 没正文 / 没序号一律返回 null，调用方原样纯文本展示。
 */
export function parseBriefCitations(text: string): GapBriefCitations | null {
  if (typeof text !== 'string' || !text.trim()) return null
  const trimmed = text.trimEnd()
  const match = trimmed.match(/(?:^|\n)[ \t]*依据\s*[：:][ \t]*((?:#[0-9]+[ \t、,，]*)+)$/)
  if (!match || match.index == null || !match[1]) return null
  const refs = [...match[1].matchAll(/#([0-9]+)/g)]
    .map((hit) => Number(hit[1]))
    .filter((n) => Number.isSafeInteger(n) && n > 0)
  if (!refs.length) return null
  const body = trimmed.slice(0, match.index).trimEnd()
  // 只有引用行没有正文时降级：原样展示整段，不让研判变成一排空标签
  if (!body) return null
  return { body, refs: [...new Set(refs)] }
}
