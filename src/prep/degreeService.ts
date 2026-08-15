// 学位英语备考台 · 个人学习态数据服务（Supabase + 本地兜底）
// 仅处理「个人进度 / 设置 / 练习 / 错题 / 收藏笔记」，按 user_id 隔离。
// 内容数据（词汇/题库）为内置种子，见 degreeWords.ts / degreeQuestions.ts。
import { supabase } from '../lib/supabaseClient'
import { getSavedUser } from '../services/appDataService'
import * as reli from './reliability'
import type {
  DegreeSettings,
  WordProgress,
  PracticeRec,
  MistakeRec,
  FavoriteRec,
  FavoriteKind,
  QuestionType
} from './degreeTypes'

function uid(): string {
  return Math.random().toString(36).slice(2, 10)
}
function today(): string {
  return new Date().toISOString().slice(0, 10)
}
async function getUserId(): Promise<string | null> {
  const u = await getSavedUser()
  return u?.id ?? null
}

// ---------- 本地兜底（Supabase 不可达 / 表未建时仍可正常用） ----------
function lsKey(prefix: string, userId: string) {
  return `degree_${prefix}_${userId}`
}
// 已删除 ID 集合改由 reliability.ts 统一托管（reli.markDeleted / reli.getDeletedIds，按 userId+table 持久化）
function lsGet<T>(prefix: string, userId: string, fallback: T): T {
  try {
    const v = localStorage.getItem(lsKey(prefix, userId))
    return v ? (JSON.parse(v) as T) : fallback
  } catch {
    return fallback
  }
}
function lsSet(prefix: string, userId: string, val: unknown) {
  try {
    localStorage.setItem(lsKey(prefix, userId), JSON.stringify(val))
  } catch {
    /* 忽略 */
  }
}

// ============================================================
// 多端同步核心原则（修复「同账号换设备从新开始」）
//   - Supabase 为唯一真相源（authoritative）。
//   - 写入：先写 localStorage 镜像（保证本机即时可用），再 upsert 云端；
//           云端失败 → 入离线队列，下次 flushQueue 自动补发（不再静默吞错）。
//   - 读取：优先云端；成功 → 回写 localStorage 镜像（弱网/离线时可回退到最近一次云端快照）；
//           云端异常 → 回退 localStorage 镜像（绝不返回空对象导致「从新开始」）。
// ============================================================

/** 云端 upsert：失败入离线队列（幂等，含 PK 整行）。onConflict 指定冲突键，避免重复键报错。 */
async function cloudUpsert(table: string, row: Record<string, unknown>, onConflict?: string): Promise<boolean> {
  try {
    const { error } = await supabase.from(table).upsert(row, onConflict ? { onConflict } : undefined)
    if (error) throw error
    return true
  } catch {
    reli.enqueue({ table, type: 'upsert', row })
    return false
  }
}
/** 云端 insert：行含客户端生成的 id，改用 upsert(onConflict:'id') 使离线重试幂等，不重复落库。 */
async function cloudInsert(table: string, row: Record<string, unknown>): Promise<boolean> {
  try {
    const { error } = await supabase.from(table).upsert(row, { onConflict: 'id' })
    if (error) throw error
    return true
  } catch {
    reli.enqueue({ table, type: 'upsert', row })
    return false
  }
}

/** 待同步（离线队列）条目数，供 UI 展示同步状态。 */
export function pendingSyncCount(): number {
  return reli.getQueue().length
}

// ---------- 设置 ----------
const DEFAULT_SETTINGS: DegreeSettings = {
  targetSchool: '商丘师范学院继续教育学院',
  examDate: null,
  newPerDay: 15,
  manualStreak: null
}

export async function loadDegreeSettings(): Promise<DegreeSettings> {
  const userId = await getUserId()
  if (!userId) return { ...DEFAULT_SETTINGS }
  try {
    const { data, error } = await supabase
      .from('degree_settings')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle()
    if (error) throw error
    if (data) {
      const s: DegreeSettings = {
        targetSchool: data.target_school ?? null,
        examDate: data.exam_date ?? null,
        newPerDay: data.new_per_day ?? 15,
        manualStreak: data.manual_streak ?? null
      }
      lsSet('settings', userId, s) // 云端快照回写本地镜像
      return s
    }
  } catch {
    /* 云端异常 → 回退本地镜像 */
  }
  return { ...DEFAULT_SETTINGS, ...lsGet('settings', userId, {}) }
}

export async function saveDegreeSettings(s: DegreeSettings): Promise<void> {
  const userId = await getUserId()
  if (!userId) return
  lsSet('settings', userId, s) // 本地镜像（本机即时可用）
  await cloudUpsert('degree_settings', {
    user_id: userId,
    target_school: s.targetSchool,
    exam_date: s.examDate,
    new_per_day: s.newPerDay,
    manual_streak: s.manualStreak,
    updated_at: new Date().toISOString()
  }, 'user_id')
}

// ---------- 单词进度 ----------
export async function loadWordProgress(): Promise<Record<string, WordProgress>> {
  const userId = await getUserId()
  if (!userId) return {}
  try {
    const { data, error } = await supabase
      .from('degree_word_progress')
      .select('*')
      .eq('user_id', userId)
    if (error) throw error
    const out: Record<string, WordProgress> = {}
    for (const r of (data as any[]) || []) {
      out[r.word] = { status: r.status, level: r.level, due: r.due ?? null, weak: r.weak ?? false }
    }
    lsSet('words', userId, out) // 云端快照回写本地镜像
    return out
  } catch {
    return lsGet('words', userId, {}) // 云端异常 → 回退本地镜像，避免「从新开始」
  }
}

export async function saveWordProgress(word: string, p: WordProgress): Promise<void> {
  const userId = await getUserId()
  if (!userId) return
  const all = lsGet<Record<string, WordProgress>>('words', userId, {})
  all[word] = p
  lsSet('words', userId, all) // 本地镜像（含本词，本机即时可用）
  await cloudUpsert('degree_word_progress', {
    user_id: userId,
    word,
    status: p.status,
    level: p.level,
    due: p.due,
    weak: p.weak,
    updated_at: new Date().toISOString()
  }, 'user_id,word')
}

// ---------- 练习记录 ----------
export async function addPractice(type: QuestionType, total: number, correct: number): Promise<void> {
  const userId = await getUserId()
  if (!userId) return
  const rec: PracticeRec = { id: uid(), type, total, correct, date: today() }
  const all = lsGet<PracticeRec[]>('practice', userId, [])
  all.push(rec)
  lsSet('practice', userId, all)
  await cloudInsert('degree_practice', {
    id: rec.id,
    user_id: userId,
    type,
    total,
    correct,
    date: rec.date
  })
}

export async function loadPractice(): Promise<PracticeRec[]> {
  const userId = await getUserId()
  if (!userId) return []
  try {
    const { data, error } = await supabase
      .from('degree_practice')
      .select('*')
      .eq('user_id', userId)
      .order('date', { ascending: false })
    if (error) throw error
    const rows: PracticeRec[] = ((data as any[]) || []).map((r) => ({
      id: r.id,
      type: r.type,
      total: r.total,
      correct: r.correct,
      date: r.date
    }))
    lsSet('practice', userId, rows)
    return rows
  } catch {
    return lsGet<PracticeRec[]>('practice', userId, [])
  }
}

// ---------- 错题本 ----------
export async function addMistake(m: Omit<MistakeRec, 'id' | 'removed'>): Promise<string> {
  const userId = await getUserId()
  const id = uid()
  const rec: MistakeRec = { ...m, id, removed: false }
  if (userId) {
    const all = lsGet<MistakeRec[]>('mistakes', userId, [])
    all.push(rec)
    lsSet('mistakes', userId, all)
  }
  await cloudInsert('degree_mistakes', {
    id,
    user_id: userId,
    question_id: m.questionId,
    type: m.type,
    user_answer: m.userAnswer,
    reason: m.reason,
    due: m.due,
    removed: false
  })
  return id
}

export async function loadMistakes(): Promise<MistakeRec[]> {
  const userId = await getUserId()
  if (!userId) return []
  const deletedIds = reli.getDeletedIds(userId, 'degree_mistakes')
  try {
    const { data, error } = await supabase
      .from('degree_mistakes')
      .select('*')
      .eq('user_id', userId)
      .eq('removed', false)
    if (error) throw error
    const rows: MistakeRec[] = ((data as any[]) || [])
      .map((r) => ({
        id: r.id,
        questionId: r.question_id,
        type: r.type,
        userAnswer: r.user_answer,
        reason: r.reason,
        due: r.due,
        removed: r.removed,
        createdAt: (r as any).created_at ?? null
      }))
      .filter((m) => !deletedIds.has(m.id))
    lsSet('mistakes', userId, rows)
    return rows
  } catch {
    return lsGet<MistakeRec[]>('mistakes', userId, []).filter((m) => !m.removed && !deletedIds.has(m.id))
  }
}

// ---------- 收藏 / 笔记 / 生词本 ----------
export async function addFavorite(
  kind: FavoriteKind,
  content: string,
  refId: string | null = null,
  title: string | null = null
): Promise<string> {
  const userId = await getUserId()
  const id = uid()
  const rec: FavoriteRec = { id, kind, refId, title, content, createdAt: new Date().toISOString() }
  if (userId) {
    const all = lsGet<FavoriteRec[]>('favorites', userId, [])
    all.push(rec)
    lsSet('favorites', userId, all)
  }
  await cloudInsert('degree_favorites', {
    id,
    user_id: userId,
    kind,
    ref_id: refId,
    title,
    content
  })
  return id
}

export async function loadFavorites(kind?: FavoriteKind): Promise<FavoriteRec[]> {
  const userId = await getUserId()
  if (!userId) return []
  const deletedIds = reli.getDeletedIds(userId, 'degree_favorites')
  const localAll = lsGet<FavoriteRec[]>('favorites', userId, [])
  try {
    let q = supabase.from('degree_favorites').select('*').eq('user_id', userId)
    if (kind) q = q.eq('kind', kind)
    const { data, error } = await q.order('created_at', { ascending: false })
    if (error) throw error
    const cloudRows: FavoriteRec[] = ((data as any[]) || [])
      .filter((r) => !(r as any).removed)
      .map((r) => ({
        id: r.id,
        kind: r.kind,
        refId: r.ref_id,
        title: r.title,
        content: r.content,
        createdAt: r.created_at
      }))
    // 合并云端 + 本地：云端优先；本地有但云端尚未同步到的（如刚保存、未回传）予以保留，
    // 避免「云端返回空」覆盖本地导致保存后的笔记/生词不显示。
    const cloudIds = new Set(cloudRows.map((r) => r.id))
    const localOnly = localAll.filter((r) => !cloudIds.has(r.id))
    const merged = [...cloudRows, ...localOnly]
      .filter((f) => !deletedIds.has(f.id))
      .filter((f) => !kind || f.kind === kind)
    lsSet('favorites', userId, merged)
    return merged
  } catch {
    // 云端异常 → 回退本地镜像（绝不返回空导致「从新开始」）
    return localAll.filter((f) => !deletedIds.has(f.id) && (!kind || f.kind === kind))
  }
}

export async function removeFavorite(id: string): Promise<void> {
  const userId = await getUserId()
  if (!userId) return
  // 1) 立即登记删除意图（防回显 + 下次 load 严格过滤）
  reli.markDeleted(userId, 'degree_favorites', id)
  // 2) localStorage 兜底：立即从本地数组中移除
  const all = lsGet<FavoriteRec[]>('favorites', userId, []).filter((f) => f.id !== id)
  lsSet('favorites', userId, all)
  // 3) Supabase 硬删除
  try {
    const { error } = await supabase.from('degree_favorites').delete().eq('id', id)
    if (error) throw error
  } catch {
    // 硬删除失败 → 软删除标记（degree_favorites 加 removed 列后生效，跨设备/清缓存一致）
    try {
      const { error: ue } = await supabase.from('degree_favorites').upsert({ id, user_id: userId, removed: true, updated_at: new Date().toISOString() })
      if (ue) throw ue
    } catch {
      // 软删也失败 → 离线队列，页面进入时 flushQueue 重试
      reli.enqueue({ table: 'degree_favorites', type: 'delete', id })
    }
  }
}

// ---------- 错题删除（与 removeFavorite 同样健壮的删除模式） ----------
export async function removeMistake(id: string): Promise<void> {
  const userId = await getUserId()
  if (!userId) return
  // 1) 立即登记删除意图（防回显 + 下次 load 严格过滤）
  reli.markDeleted(userId, 'degree_mistakes', id)
  // localStorage 兜底
  const all = lsGet<MistakeRec[]>('mistakes', userId, []).map((m) => m.id === id ? { ...m, removed: true } : m)
  lsSet('mistakes', userId, all)
  // Supabase 软删除（mistakes 表已有 removed 字段）
  try {
    const { error } = await supabase.from('degree_mistakes').update({ removed: true, updated_at: new Date().toISOString() }).eq('id', id)
    if (error) throw error
  } catch {
    // 软删也失败 → 离线队列，页面进入时 flushQueue 重试
    reli.enqueue({ table: 'degree_mistakes', type: 'delete', id })
  }
}

/** 离线重试队列：页面 onMounted / 网络恢复时调用，把未成功的写入/删除补发给 Supabase。 */
export async function flushQueue(): Promise<void> {
  const q = reli.getQueue()
  if (!q.length) return
  const userId = await getUserId()
  if (!userId) return
  const remain: reli.QueueOp[] = []
  for (const op of q) {
    try {
      if (op.type === 'delete') {
        await supabase.from(op.table).delete().eq('user_id', userId).eq('id', op.id)
      } else {
        await supabase.from(op.table).upsert(op.row)
      }
    } catch {
      remain.push(op)
    }
  }
  reli.clearQueue()
  remain.forEach((o) => reli.enqueue(o))
}

// 网络恢复时自动补发离线队列（一次性注册，覆盖整个会话）
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    flushQueue().catch(() => {})
  })
}
