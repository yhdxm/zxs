// 通用用户 JSON Blob 服务（Supabase 主存 + localStorage 镜像）
//
// 用于影仓智核等「单个用户一份配置/数据」的小模块：
//   - watchlist      → zxs_watchlist      （自选股）
//   - learn_mastery  → zxs_learn_mastery  （学习掌握）
//   - simtrade       → zxs_simtrade       （模拟盘）
//   - ai_usage       → zxs_ai_usage       （AI 用量，按需使用）
//
// 2026-08-31 改造：从纯 localStorage 升级为云端同步，PC 与移动端共享同一份数据。
// 未登录 / 会话丢失时回退到 localStorage，功能不崩。

import { supabase, getSavedUser } from './appDataService'

export type BlobKey = 'watchlist' | 'learn_mastery' | 'simtrade' | 'ai_usage'

const LS_PREFIX = 'zxs_'

function lsKey(key: BlobKey): string {
  return LS_PREFIX + key
}

function lsGet<T>(key: BlobKey, fallback: T): T {
  if (typeof localStorage === 'undefined') return fallback
  try {
    const v = localStorage.getItem(lsKey(key))
    return v ? (JSON.parse(v) as T) : fallback
  } catch {
    return fallback
  }
}

function lsSet<T>(key: BlobKey, val: T): void {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(lsKey(key), JSON.stringify(val))
  } catch {
    /* ignore */
  }
}

/**
 * 从云端加载 blob；失败或未登录时回退到 localStorage。
 * 返回 fallback 表示云端和本地都没有。
 */
export async function loadUserBlob<T>(key: BlobKey, fallback: T): Promise<T> {
  const user = await getSavedUser()
  if (!user?.id || user.id === 'anonymous') {
    return lsGet<T>(key, fallback)
  }

  const { data, error } = await supabase
    .from('user_json_blobs')
    .select('value')
    .eq('user_id', user.id)
    .eq('key', key)
    .maybeSingle()

  if (error) {
    console.warn(`[userBlob] ${key} 云端读取失败，回退本地`, error.message)
    return lsGet<T>(key, fallback)
  }

  if (data?.value != null) {
    return data.value as T
  }

  // 云端没有但本地有：迁移到云端
  const local = lsGet<T | null>(key, null)
  if (local != null) {
    await saveUserBlob(key, local)
  }

  return lsGet<T>(key, fallback)
}

/**
 * 保存 blob：同步写 localStorage，异步写云端。
 */
export async function saveUserBlob<T>(key: BlobKey, value: T): Promise<void> {
  lsSet(key, value)

  const user = await getSavedUser()
  if (!user?.id || user.id === 'anonymous') return

  const { error } = await supabase
    .from('user_json_blobs')
    .upsert(
      { user_id: user.id, key, value, updated_at: new Date().toISOString() },
      { onConflict: 'user_id,key' }
    )

  if (error) {
    console.warn(`[userBlob] ${key} 云端写入失败`, error.message)
  }
}
