// 跨端云同步基础设施（纯前端 + Supabase Realtime，免费额度内）
//
// 解决的核心问题：「PC 端数据更新了，移动端看到的仍是进入页面时的快照」。
//   1) 通用表级实时订阅 —— 任意表按 user_id 过滤，另一端写入后本端立即收到通知并重拉。
//      （此前只有 app_dashboard_data 一张表被订阅，见 appDataService.ts:1022）
//   2) 带 TTL 的本地镜像缓存 —— 弱网回退本地镜像时，超期的数据不再被当作「可信数据」
//      静默展示，而是强制走云端；仍失败则由调用方显式提示「数据可能不是最新」。
//
// localStorage 全部 try/catch 包裹，隐私模式 / SSR 不会崩。

import { supabase } from './appDataService'

export type CloudChangeEvent = 'INSERT' | 'UPDATE' | 'DELETE'

interface ChangePayload {
  eventType?: string
  new?: Record<string, unknown> | null
  old?: Record<string, unknown> | null
}

/**
 * 订阅单张表的行级变更，仅回调属于当前用户的变更。
 * - userId 为空或 anonymous 时不订阅（anonymous 是未登录兜底账号，订阅它会收到所有匿名设备的数据）
 * - Realtime 不可用时返回空函数，调用方自动降级为「切回前台 / 聚焦 / 联网」时重拉
 */
export function subscribeTableChanges(
  userId: string,
  table: string,
  onEvent: (event: CloudChangeEvent) => void
): () => void {
  if (!userId || userId === 'anonymous') return () => {}
  try {
    const channel = supabase
      .channel(`sync:${table}:${userId}:${Math.random().toString(36).slice(2, 8)}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table, filter: `user_id=eq.${userId}` },
        (payload: ChangePayload) => {
          const newUserId = payload?.new?.user_id
          const oldUserId = payload?.old?.user_id
          // 客户端二次过滤：RLS 未启用时避免收到其他用户的变更
          if (newUserId !== userId && oldUserId !== userId) return
          const t = payload?.eventType
          onEvent(t === 'INSERT' ? 'INSERT' : t === 'DELETE' ? 'DELETE' : 'UPDATE')
        }
      )
      .subscribe()

    return () => {
      try {
        supabase.removeChannel(channel)
      } catch {
        /* 忽略取消订阅异常 */
      }
    }
  } catch (error) {
    console.warn(`[cloudSync] ${table} 实时订阅失败，降级为可见性刷新`, error)
    return () => {}
  }
}

/** 批量订阅多张表，返回统一的取消函数 */
export function subscribeTables(
  userId: string,
  tables: string[],
  onEvent: (event: CloudChangeEvent) => void
): () => void {
  const unsubs = tables.map((t) => subscribeTableChanges(userId, t, onEvent))
  return () => unsubs.forEach((u) => u())
}

/* ===================== 带 TTL 的本地镜像缓存 ===================== */

const CACHE_PREFIX = 'zxsv2_cache_'
/** 默认 5 分钟：短于一次学习会话，长于一次弱网抖动 */
export const DEFAULT_CACHE_TTL = 5 * 60 * 1000

function lsGet<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(CACHE_PREFIX + key)
    return v ? (JSON.parse(v) as T) : fallback
  } catch {
    return fallback
  }
}
function lsSet(key: string, val: unknown): void {
  try {
    localStorage.setItem(CACHE_PREFIX + key, JSON.stringify(val))
  } catch {
    /* 配额 / 隐私模式：忽略，不影响主流程 */
  }
}

interface Envelope<T> {
  data: T
  ts: number
}

/**
 * 读取仍在有效期内的镜像；过期或不存在返回 null。
 * 兼容旧格式（裸数据无 ts）：一律视为过期，保证老缓存不会污染新逻辑。
 */
export function cacheGet<T>(key: string, ttlMs: number = DEFAULT_CACHE_TTL): T | null {
  const raw = lsGet<Envelope<T> | T | null>(key, null)
  if (raw == null) return null
  if (typeof raw !== 'object' || raw === null || !('ts' in (raw as object))) return null
  const env = raw as Envelope<T>
  if (!env.ts || Date.now() - env.ts > ttlMs) return null
  return env.data
}

/** 写入镜像（自动打时间戳） */
export function cacheSet<T>(key: string, data: T): void {
  const env: Envelope<T> = { data, ts: Date.now() }
  lsSet(key, env)
}

export interface StaleResult<T> {
  data: T
  ageMs: number
}

/**
 * 无视 TTL 读取镜像，专供「云端彻底不可达」时兜底展示。
 * 调用方应据 ageMs > 0 显式提示「离线 / 数据可能不是最新」，杜绝静默陈旧。
 */
export function cacheGetStale<T>(key: string): StaleResult<T> | null {
  const raw = lsGet<Envelope<T> | T | null>(key, null)
  if (raw == null) return null
  if (typeof raw !== 'object' || raw === null || !('ts' in (raw as object))) {
    // 旧格式无时间戳：没法判断新鲜度，当作很旧
    return { data: raw as T, ageMs: Number.MAX_SAFE_INTEGER }
  }
  const env = raw as Envelope<T>
  return { data: env.data, ageMs: Math.max(0, Date.now() - (env.ts || 0)) }
}

export function cacheClear(key: string): void {
  lsSet(key, null)
}
