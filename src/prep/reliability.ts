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
export function mirrorGet(userId: string): PrepState | null {
  return lsGet<PrepState | null>('mirror_' + userId, null)
}
export function mirrorSet(userId: string, val: PrepState): void {
  lsSet('mirror_' + userId, val)
}
export function mirrorClear(userId: string): void {
  lsSet('mirror_' + userId, null)
}
