/**
 * 差值台 GAPDESK · 纯函数格式化工具
 *
 * 约定：
 * - 全部为无副作用纯函数，不依赖 Vue / Supabase / dayjs，可直接在采集脚本与测试中复用；
 * - 时间入参统一为 epoch 毫秒（与库表 bigint 字段 ts_* 一致），0 表示「源站无时间」；
 * - 所有函数对 NaN / 负数 / 空值做兜底，绝不返回 undefined 让模板炸掉。
 */
import type { GapTone } from '../types/gapdesk'

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
