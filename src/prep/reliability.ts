// 数据可靠性基础设施（纯前端、离线可用）
// 解决两类问题：
//   1) 「删除意图丢失」——Supabase 删除失败时，旧数据在下次读取时复活。
//      方案：删除前先把 ID 登记进本地「删除意图集」，读取时严格过滤。
//   2) 「写入丢失 / 读取归零」——Supabase 不可达时，persist 静默失败、load 直接抛错归零。
//      方案：本地镜像 + 离线重试队列，网络恢复后自动补发。
//
// 所有 localStorage 访问都包了 try/catch，SSR/隐私模式不会崩。
import type { PrepState } from '../services/cetPrepService'

const PREFIX = 'zxsv2_reli_'

function lsGet<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(PREFIX + key)
    return v ? (JSON.parse(v) as T) : fallback
  } catch {
    return fallback
  }
}
function lsSet(key: string, val: unknown): void {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(val))
  } catch {
    /* 配额/隐私模式：忽略，不影响主流程 */
  }
}

/* ===================== 删除意图集 ===================== */
// 结构：{ [userId]: { [table]: string[] } }
type DelMap = Record<string, Record<string, string[]>>

export function markDeleted(userId: string, table: string, id: string): void {
  const m = lsGet<DelMap>('deleted', {})
  const byUser = (m[userId] ||= {})
  const list = (byUser[table] ||= [])
  if (!list.includes(id)) list.push(id)
  lsSet('deleted', m)
}
export function getDeletedIds(userId: string, table: string): Set<string> {
  const m = lsGet<DelMap>('deleted', {})
  return new Set(m[userId]?.[table] || [])
}
export function isDeleted(userId: string, table: string, id: string): boolean {
  return getDeletedIds(userId, table).has(id)
}

/* ===================== 离线重试队列 ===================== */
export type QueueOp =
  | { table: string; type: 'delete'; id: string }
  | { table: string; type: 'upsert'; row: Record<string, unknown> }

export function enqueue(op: QueueOp): void {
  const q = lsGet<QueueOp[]>('queue', [])
  // 去重：
  //  - 删除：同表同 id 只保留一条
  //  - upsert：有 id 的同表同 id 只留最新；无 id（如 settings 按 user_id 唯一）按表去重只留最新
  const filtered = q.filter((o) => {
    if (o.type === 'delete' && op.type === 'delete') return !(o.table === op.table && o.id === op.id)
    if (o.type === 'upsert' && op.type === 'upsert') {
      const oid = (o.row as any).id
      const nid = (op.row as any).id
      if (oid != null && nid != null) return !(oid === nid && o.table === op.table)
      if (oid == null && nid == null) return o.table !== op.table
      return true
    }
    return true
  })
  filtered.push(op)
  lsSet('queue', filtered)
}
export function getQueue(): QueueOp[] {
  return lsGet<QueueOp[]>('queue', [])
}
export function clearQueue(): void {
  lsSet('queue', [])
}

/* ===================== 四六级本地镜像（聚合状态） ===================== */
// ⚠️ 镜像加 TTL：旧实现写入后**永久有效**，弱网 / 断网时会长期静默展示几天前的数据，
// 用户在手机上的表现就是「PC 明明更新了，手机还是老的，而且没有任何提示」。
// 现在：超期一律视为不可用（调用方强制走云端）；云端彻底不可达时用 mirrorGetStale
// 兜底展示，并由调用方按 ageMs **显式提示**「离线 / 数据可能不是最新」，杜绝静默陈旧。
export const DEFAULT_MIRROR_TTL = 5 * 60 * 1000

interface MirrorEnvelope {
  data: PrepState
  ts: number
}

export function mirrorGet(userId: string, ttlMs: number = DEFAULT_MIRROR_TTL): PrepState | null {
  const raw = lsGet<MirrorEnvelope | PrepState | null>('mirror_' + userId, null)
  if (raw == null) return null
  // 兼容旧格式（裸数据、无 ts）：无法判断新鲜度，直接视为已过期
  if (typeof raw !== 'object' || !('ts' in (raw as object))) return null
  const env = raw as MirrorEnvelope
  if (!env.ts || Date.now() - env.ts > ttlMs) return null
  return env.data
}

/** 无视 TTL 读取镜像，专供云端彻底不可达时兜底展示 */
export function mirrorGetStale(userId: string): { data: PrepState; ageMs: number } | null {
  const raw = lsGet<MirrorEnvelope | PrepState | null>('mirror_' + userId, null)
  if (raw == null) return null
  if (typeof raw !== 'object' || !('ts' in (raw as object))) {
    // 旧格式无时间戳：无法判断新鲜度，当作极旧处理
    return { data: raw as PrepState, ageMs: Number.MAX_SAFE_INTEGER }
  }
  const env = raw as MirrorEnvelope
  return { data: env.data, ageMs: Math.max(0, Date.now() - (env.ts || 0)) }
}

export function mirrorSet(userId: string, val: PrepState): void {
  const env: MirrorEnvelope = { data: val, ts: Date.now() }
  lsSet('mirror_' + userId, env)
}
export function mirrorClear(userId: string): void {
  lsSet('mirror_' + userId, null)
}
