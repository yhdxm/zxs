// 学习中心「背单词卡」独立进度服务
// 数据落 public.learn_word_progress，与备考台 degree_word_progress 完全隔离。
import { supabase, getSavedUser } from './appDataService'
import type { WordProgress } from '../prep/degreeTypes'

function lsKey(userId: string) {
  return `learn_word_progress_${userId}`
}
function lsGet<T>(userId: string, fallback: T): T {
  try {
    const v = localStorage.getItem(lsKey(userId))
    return v ? (JSON.parse(v) as T) : fallback
  } catch {
    return fallback
  }
}
function lsSet(userId: string, val: unknown) {
  try {
    localStorage.setItem(lsKey(userId), JSON.stringify(val))
  } catch { /* ignore */ }
}

async function getUserId(): Promise<string | null> {
  const u = await getSavedUser()
  return u?.id ?? null
}

async function seedCloudFromLocal(userId: string, state: Record<string, WordProgress>): Promise<void> {
  const rows = Object.entries(state).map(([word, p]) => ({
    user_id: userId,
    word,
    status: p.status,
    level: p.level,
    due: p.due,
    weak: p.weak,
    wrong_streak: p.wrongStreak ?? 0,
    first_learned: p.firstLearned ?? null,
    last_studied: p.lastStudied ?? null,
    updated_at: new Date().toISOString()
  }))
  if (!rows.length) return
  const { error } = await supabase.from('learn_word_progress').upsert(rows, { onConflict: 'user_id,word' })
  if (error) throw error
}

export async function loadLearnWordProgress(): Promise<Record<string, WordProgress>> {
  const userId = await getUserId()
  if (!userId) return lsGet('anonymous', {})
  const localState = lsGet(userId, {})
  try {
    const { data, error } = await supabase
      .from('learn_word_progress')
      .select('*')
      .eq('user_id', userId)
    if (error) throw error
    const out: Record<string, WordProgress> = {}
    for (const r of (data as any[]) || []) {
      out[r.word] = {
        status: r.status,
        level: r.level,
        due: r.due ?? null,
        weak: r.weak ?? false,
        wrongStreak: r.wrong_streak ?? 0,
        firstLearned: r.first_learned ?? undefined,
        lastStudied: r.last_studied ?? undefined
      }
    }
    // 云端有数据则以云端为准，并回写本地镜像
    if (Object.keys(out).length > 0) {
      lsSet(userId, out)
      return out
    }
    // 云端为空但本地有数据 -> 保留本地，并尝试反哺云端（兼容首次部署/新建空表）
    if (Object.keys(localState).length > 0) {
      await seedCloudFromLocal(userId, localState)
    }
    return localState
  } catch {
    return localState
  }
}

export async function saveLearnWordProgress(word: string, p: WordProgress): Promise<void> {
  const userId = await getUserId()
  if (!userId) {
    const all = lsGet<Record<string, WordProgress>>('anonymous', {})
    all[word] = p
    lsSet('anonymous', all)
    return
  }
  const all = lsGet<Record<string, WordProgress>>(userId, {})
  all[word] = p
  lsSet(userId, all)
  const { error } = await supabase.from('learn_word_progress').upsert(
    {
      user_id: userId,
      word,
      status: p.status,
      level: p.level,
      due: p.due,
      weak: p.weak,
      wrong_streak: p.wrongStreak ?? 0,
      first_learned: p.firstLearned ?? null,
      last_studied: p.lastStudied ?? null,
      updated_at: new Date().toISOString()
    },
    { onConflict: 'user_id,word' }
  )
  if (error) {
    // Supabase 返回 error 对象而非抛出；失败多为缺 first_learned/last_studied 列。
    // 回退到不含新列的 upsert，保证核心进度仍可跨端同步。
    console.error('[learnWordProgressService] upsert with dates failed:', error.message)
    const { error: err2 } = await supabase.from('learn_word_progress').upsert(
      {
        user_id: userId,
        word,
        status: p.status,
        level: p.level,
        due: p.due,
        weak: p.weak,
        wrong_streak: p.wrongStreak ?? 0,
        updated_at: new Date().toISOString()
      },
      { onConflict: 'user_id,word' }
    )
    if (err2) console.error('[learnWordProgressService] legacy upsert failed:', err2.message)
  }
}
