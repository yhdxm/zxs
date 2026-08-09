// 四六级备考台 · Supabase 数据服务
// 所有读写按 user_id 隔离（user_id 取自自建账号表的 AppUser.id，与 app_dashboard_data 等一致）。
// 注意：本项目为「自建账号表 + 纯前端」架构，RLS 对 anon 放开，由应用层按 user_id 过滤实现隔离。
import { supabase } from '../lib/supabaseClient'
import { getSavedUser } from './appDataService'

/** 主词表一行：[单词, 音标, 词性, 释义, 常考搭配] */
export type PrepWord = [string, string, string, string, string]

export interface WordProgress {
  status: 'new' | 'learning' | 'graduated'
  level: number
  due: string | null
  wrongStreak: number
  wrongStreakDate: string | null
  weak: boolean
  firstIssued: string | null
  last: string | null
}

export interface PracticeRec {
  id: string
  type: string
  total: number
  correct: number
  date: string
  sample: boolean
}

export interface MistakeRec {
  id: string
  type: string | null
  reason: string | null
  approach: string | null
  level: number
  due: string | null
  removed: boolean
  sample: boolean
  date: string | null
}

export interface CheckinRec {
  words: number
  practice: number
}

export interface PrepSettings {
  newPerDay: number
  examDate: string | null
  manualStreak: number | null
  linkedGoal: string | null
}

/** loadAll 返回给前端的聚合状态 */
export interface PrepState {
  words: Record<string, WordProgress>
  practice: PracticeRec[]
  mistakes: MistakeRec[]
  checkins: Record<string, CheckinRec>
  settings: PrepSettings
}

function uid(): string {
  return Math.random().toString(36).slice(2, 9)
}

/** 判定错误是否因为目标表尚未创建（执行 scripts/cet4_prep.sql 前常见） */
export function isMissingTableError(err: unknown): boolean {
  if (!err) return false
  const e = err as { message?: string; code?: string; details?: string }
  const msg = String(e.message || e.code || e.details || err)
  return /schema cache|table.*does not exist|relation.*does not exist|PGRST204|PGRST116|not find the table/i.test(msg)
}

async function getUid(): Promise<string | null> {
  const u = await getSavedUser()
  return u?.id ?? null
}

async function getUserIdOrThrow(): Promise<string> {
  const id = await getUid()
  if (!id) throw new Error('未登录，无法读写备考数据')
  return id
}

/** 读取主词表（全量四级词），按 id 升序。
 * 注意：Supabase 对匿名角色默认单次最多返回 1000 行，必须分页拉取才能拿到全部 4544 词。 */
export async function fetchMasterWords(): Promise<PrepWord[]> {
  const PAGE = 1000
  const out: PrepWord[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from('cet4_words')
      .select('word, phonetic, pos, definition, collocation')
      .order('id', { ascending: true })
      .range(from, from + PAGE - 1)
    if (error) throw error
    const rows = (data || []) as any[]
    if (rows.length === 0) break
    out.push(
      ...(rows.map((r: any) => [
        r.word,
        r.phonetic ?? '',
        r.pos ?? '',
        r.definition ?? '',
        r.collocation ?? ''
      ]) as PrepWord[])
    )
    if (rows.length < PAGE) break
  }
  return out
}

/** 批量写入主词表（管理员导入）。按 word 去重 upsert。返回写入条数。 */
export async function seedMasterWords(rows: PrepWord[]): Promise<number> {
  const payload = rows
    .filter((r) => r && r[0])
    .map((r) => ({
      word: r[0],
      phonetic: r[1] ?? '',
      pos: r[2] ?? '',
      definition: r[3] ?? '',
      collocation: r[4] ?? ''
    }))
  if (!payload.length) return 0
  const chunks: any[][] = []
  for (let i = 0; i < payload.length; i += 500) chunks.push(payload.slice(i, i + 500))
  let n = 0
  for (const c of chunks) {
    const { error } = await supabase.from('cet4_words').upsert(c, { onConflict: 'word' })
    if (error) throw error
    n += c.length
  }
  return n
}

/** 聚合读取当前用户的全部备考数据 */
export async function loadAll(): Promise<PrepState> {
  const userId = await getUserIdOrThrow()
  const [w, p, m, c, s] = await Promise.all([
    supabase.from('cet4_prep_progress').select('*').eq('user_id', userId),
    supabase.from('cet4_prep_practice').select('*').eq('user_id', userId),
    supabase.from('cet4_prep_mistakes').select('*').eq('user_id', userId),
    supabase.from('cet4_prep_checkins').select('*').eq('user_id', userId),
    supabase.from('cet4_prep_settings').select('*').eq('user_id', userId).maybeSingle()
  ])
  if (w.error) throw w.error
  if (p.error) throw p.error
  if (m.error) throw m.error
  if (c.error) throw c.error
  if (s.error) throw s.error

  const words: Record<string, WordProgress> = {}
  for (const r of (w.data as any[]) || []) {
    words[r.word] = {
      status: r.status,
      level: r.level,
      due: r.due ?? null,
      wrongStreak: r.wrong_streak ?? 0,
      wrongStreakDate: r.wrong_streak_date ?? null,
      weak: !!r.weak,
      firstIssued: r.first_issued ?? null,
      last: r.last_reviewed ?? null
    }
  }
  const practice: PracticeRec[] = ((p.data as any[]) || []).map((r) => ({
    id: r.id,
    type: r.type,
    total: r.total,
    correct: r.correct,
    date: r.date,
    sample: !!r.sample
  }))
  const mistakes: MistakeRec[] = ((m.data as any[]) || []).map((r) => ({
    id: r.id,
    type: r.type ?? null,
    reason: r.reason ?? null,
    approach: r.approach ?? null,
    level: r.level,
    due: r.due ?? null,
    removed: !!r.removed,
    sample: !!r.sample,
    date: r.date ?? null
  }))
  const checkins: Record<string, CheckinRec> = {}
  for (const r of (c.data as any[]) || []) {
    checkins[r.date] = { words: r.words ?? 0, practice: r.practice ?? 0 }
  }
  const settings: PrepSettings = {
    newPerDay: (s.data && s.data.new_per_day) || 10,
    examDate: (s.data && s.data.exam_date) || null,
    manualStreak: (s.data && s.data.manual_streak != null) ? Number(s.data.manual_streak) : null,
    linkedGoal: (s.data && s.data.linked_goal) || null
  }
  return { words, practice, mistakes, checkins, settings }
}

export async function persistProgress(word: string, st: WordProgress): Promise<void> {
  const userId = await getUserIdOrThrow()
  const { error } = await supabase.from('cet4_prep_progress').upsert(
    {
      user_id: userId,
      word,
      status: st.status,
      level: st.level,
      due: st.due ?? null,
      wrong_streak: st.wrongStreak,
      wrong_streak_date: st.wrongStreakDate ?? null,
      weak: st.weak,
      first_issued: st.firstIssued ?? null,
      last_reviewed: st.last ?? null,
      updated_at: new Date().toISOString()
    },
    { onConflict: 'user_id,word' }
  )
  if (error) throw error
}

export async function persistPractice(rec: PracticeRec): Promise<void> {
  const userId = await getUserIdOrThrow()
  const { error } = await supabase.from('cet4_prep_practice').upsert(
    {
      id: rec.id,
      user_id: userId,
      type: rec.type,
      total: rec.total,
      correct: rec.correct,
      date: rec.date,
      sample: rec.sample
    },
    { onConflict: 'id' }
  )
  if (error) throw error
}

export async function removePractice(id: string): Promise<void> {
  const userId = await getUserIdOrThrow()
  const { error } = await supabase.from('cet4_prep_practice').delete().eq('user_id', userId).eq('id', id)
  if (error) throw error
}

export async function persistMistake(rec: MistakeRec): Promise<void> {
  const userId = await getUserIdOrThrow()
  const { error } = await supabase.from('cet4_prep_mistakes').upsert(
    {
      id: rec.id,
      user_id: userId,
      type: rec.type ?? null,
      reason: rec.reason ?? null,
      approach: rec.approach ?? null,
      level: rec.level,
      due: rec.due ?? null,
      removed: rec.removed,
      sample: rec.sample,
      date: rec.date ?? null,
      updated_at: new Date().toISOString()
    },
    { onConflict: 'id' }
  )
  if (error) throw error
}

export async function removeMistake(id: string): Promise<void> {
  const userId = await getUserIdOrThrow()
  const { error } = await supabase.from('cet4_prep_mistakes').delete().eq('user_id', userId).eq('id', id)
  if (error) throw error
}

export async function persistCheckin(date: string, c: CheckinRec): Promise<void> {
  const userId = await getUserIdOrThrow()
  const { error } = await supabase.from('cet4_prep_checkins').upsert(
    { user_id: userId, date, words: c.words ?? 0, practice: c.practice ?? 0 },
    { onConflict: 'user_id,date' }
  )
  if (error) throw error
}

export async function persistSettings(s: PrepSettings): Promise<void> {
  const userId = await getUserIdOrThrow()
  const payload: any = {
    user_id: userId,
    new_per_day: s.newPerDay || 10,
    exam_date: s.examDate ?? null,
    manual_streak: s.manualStreak ?? null,
    linked_goal: s.linkedGoal ?? null,
    updated_at: new Date().toISOString()
  }
  let { error } = await supabase.from('cet4_prep_settings').upsert(payload, { onConflict: 'user_id' })
  // 兼容：旧表没有 manual_streak 列时，回退到只保存基础字段，不阻断用户保存
  if (error && /manual_streak|column.*does not exist|Could not find|未知的列/i.test(String(error.message || error))) {
    delete payload.manual_streak
    const res2 = await supabase.from('cet4_prep_settings').upsert(payload, { onConflict: 'user_id' })
    error = res2.error
  }
  if (error) throw error
}

/**
 * 整体替换当前用户的备考数据（用于「导入 JSON」与「清空全部」）。
 * 先删除该用户全部行，再批量写入，保证导入/清空语义干净。
 */
export async function replaceAll(state: {
  words: Record<string, WordProgress>
  practice: PracticeRec[]
  mistakes: MistakeRec[]
  checkins: Record<string, CheckinRec>
  settings: PrepSettings
}): Promise<void> {
  const userId = await getUserIdOrThrow()
  const tables = ['cet4_prep_progress', 'cet4_prep_practice', 'cet4_prep_mistakes', 'cet4_prep_checkins']
  for (const t of tables) {
    const { error } = await supabase.from(t).delete().eq('user_id', userId)
    if (error) throw error
  }

  const progressRows = Object.entries(state.words).map(([word, st]) => ({
    user_id: userId,
    word,
    status: st.status,
    level: st.level,
    due: st.due ?? null,
    wrong_streak: st.wrongStreak,
    wrong_streak_date: st.wrongStreakDate ?? null,
    weak: st.weak,
    first_issued: st.firstIssued ?? null,
    last_reviewed: st.last ?? null,
    updated_at: new Date().toISOString()
  }))
  const practiceRows = state.practice.map((r) => ({
    id: r.id,
    user_id: userId,
    type: r.type,
    total: r.total,
    correct: r.correct,
    date: r.date,
    sample: r.sample
  }))
  const mistakeRows = state.mistakes.map((r) => ({
    id: r.id,
    user_id: userId,
    type: r.type ?? null,
    reason: r.reason ?? null,
    approach: r.approach ?? null,
    level: r.level,
    due: r.due ?? null,
    removed: r.removed,
    sample: r.sample,
    date: r.date ?? null,
    updated_at: new Date().toISOString()
  }))
  const checkinRows = Object.entries(state.checkins).map(([date, c]) => ({
    user_id: userId,
    date,
    words: c.words ?? 0,
    practice: c.practice ?? 0
  }))

  const insertChunked = async (table: string, rows: any[]) => {
    if (!rows.length) return
    for (let i = 0; i < rows.length; i += 500) {
      const chunk = rows.slice(i, i + 500)
      const { error } = await supabase.from(table).insert(chunk)
      if (error) throw error
    }
  }
  await insertChunked('cet4_prep_progress', progressRows)
  await insertChunked('cet4_prep_practice', practiceRows)
  await insertChunked('cet4_prep_mistakes', mistakeRows)
  await insertChunked('cet4_prep_checkins', checkinRows)
  await persistSettings(state.settings)
}

/** 仅清除预置示例（刷题 / 错题示例），保留真实数据 */
export async function clearSampleData(): Promise<void> {
  const userId = await getUserIdOrThrow()
  const { error: e1 } = await supabase
    .from('cet4_prep_practice')
    .delete()
    .eq('user_id', userId)
    .eq('sample', true)
  const { error: e2 } = await supabase
    .from('cet4_prep_mistakes')
    .delete()
    .eq('user_id', userId)
    .eq('sample', true)
  if (e1) throw e1
  if (e2) throw e2
}

/** 当前用户是否为超级管理员（用于显示词库导入入口） */
export async function isAdmin(): Promise<boolean> {
  const u = await getSavedUser()
  return u?.role === 'superadmin'
}

/** 供 prepApp 生成记录 id 使用 */
export function newId(): string {
  return uid()
}
