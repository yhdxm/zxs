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
    if (data)
      return {
        targetSchool: data.target_school ?? null,
        examDate: data.exam_date ?? null,
        newPerDay: data.new_per_day ?? 15,
        manualStreak: data.manual_streak ?? null
      }
  } catch {
    /* 兜底 */
  }
  return { ...DEFAULT_SETTINGS, ...lsGet('settings', userId, {}) }
}

export async function saveDegreeSettings(s: DegreeSettings): Promise<void> {
  const userId = await getUserId()
  if (!userId) return
  lsSet('settings', userId, s)
  try {
    const { error } = await supabase.from('degree_settings').upsert({
      user_id: userId,
      target_school: s.targetSchool,
      exam_date: s.examDate,
      new_per_day: s.newPerDay,
      manual_streak: s.manualStreak,
      updated_at: new Date().toISOString()
    })
    if (error) throw error
  } catch {
    /* 兜底 */
  }
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
    return out
  } catch {
    return lsGet('words', userId, {})
  }
}

export async function saveWordProgress(word: string, p: WordProgress): Promise<void> {
  const userId = await getUserId()
  if (!userId) return
  const all = lsGet<Record<string, WordProgress>>('words', userId, {})
  all[word] = p
  lsSet('words', userId, all)
  try {
    const { error } = await supabase.from('degree_word_progress').upsert({
      user_id: userId,
      word,
      status: p.status,
      level: p.level,
      due: p.due,
      weak: p.weak,
      updated_at: new Date().toISOString()
    })
    if (error) throw error
  } catch {
    /* 兜底 */
  }
}

// ---------- 练习记录 ----------
export async function addPractice(type: QuestionType, total: number, correct: number): Promise<void> {
  const userId = await getUserId()
  if (!userId) return
  const rec: PracticeRec = { id: uid(), type, total, correct, date: today() }
  const all = lsGet<PracticeRec[]>('practice', userId, [])
  all.push(rec)
  lsSet('practice', userId, all)
  try {
    const { error } = await supabase.from('degree_practice').insert({
      id: rec.id,
      user_id: userId,
      type,
      total,
      correct,
      date: rec.date
    })
    if (error) throw error
  } catch {
    /* 兜底 */
  }
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
    return ((data as any[]) || []).map((r) => ({
      id: r.id,
      type: r.type,
      total: r.total,
      correct: r.correct,
      date: r.date
    }))
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
  try {
    const { error } = await supabase.from('degree_mistakes').insert({
      id,
      user_id: userId,
      question_id: m.questionId,
      type: m.type,
      user_answer: m.userAnswer,
      reason: m.reason,
      due: m.due,
      removed: false
    })
    if (error) throw error
  } catch {
    /* 兜底 */
  }
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
    return ((data as any[]) || [])
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
      .filter((m) => !deletedIds.has(m.id)) // 本地删除缓存兜底
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
  try {
    const { error } = await supabase.from('degree_favorites').insert({
      id,
      user_id: userId,
      kind,
      ref_id: refId,
      title,
      content
    })
    if (error) throw error
  } catch {
    /* 兜底 */
  }
  return id
}

export async function loadFavorites(kind?: FavoriteKind): Promise<FavoriteRec[]> {
  const userId = await getUserId()
  if (!userId) return []
  const deletedIds = reli.getDeletedIds(userId, 'degree_favorites')
  try {
    let q = supabase.from('degree_favorites').select('*').eq('user_id', userId)
    if (kind) q = q.eq('kind', kind)
    const { data, error } = await q.order('created_at', { ascending: false })
    if (error) throw error
    return ((data as any[]) || [])
      .filter((r) => !(r as any).removed) // 软删兜底（degree_favorites 加 removed 列后生效）
      .map((r) => ({
        id: r.id,
        kind: r.kind,
        refId: r.ref_id,
        title: r.title,
        content: r.content,
        createdAt: r.created_at
      }))
      .filter((f) => !deletedIds.has(f.id))
  } catch {
    const all = lsGet<FavoriteRec[]>('favorites', userId, [])
    return all.filter((f) => !deletedIds.has(f.id) && (!kind || f.kind === kind))
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

/** 离线重试队列：页面 onMounted 时调用，把未成功的删除/写入补发给 Supabase。 */
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
