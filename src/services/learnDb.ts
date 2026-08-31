// 新增模块用户数据服务（Supabase 免费档）。
// 由于本项目为自建账号体系（非 Supabase Auth），RLS 在数据库层无法隔离，
// 故所有读写均由前端按「当前登录账号 id」过滤（见 scripts/new_modules_tables.sql 说明）。

import type { StudyPlan } from './learningService'
import { supabase, getSavedUser } from './appDataService'

/**
 * 取当前登录账号 id；未登录返回空串。
 *
 * ⚠️ 历史坑（跨端不同步的元凶之一）：
 * 旧实现是 `return u?.id || 'anonymous'` —— 未登录 / 会话丢失时，数据会写进
 * user_id='anonymous' 这个「所有匿名设备共享」的公共账号，导致：
 *   ① PC 端用真实账号写、移动端用 anonymous 写，两边永远看不到对方的数据；
 *   ② 重新登录后，之前用 anonymous 写的数据不会归属到自己的账号。
 * 现改为：读操作在空 id 时返回空结果（不读公共脏数据），写操作直接抛错提示登录，
 * 从根上杜绝 anonymous 污染。
 */
async function uid(): Promise<string> {
  const u = await getSavedUser()
  return u?.id || ''
}

/** 写操作守卫：未登录时明确失败，而不是静默写到 anonymous */
function assertUid(u: string): string {
  if (!u) {
    throw new Error('未登录：请先登录后再操作，否则数据只会存在本机、无法跨设备同步')
  }
  return u
}

export interface CarWatchItem {
  id: string
  user_id: string
  name: string
  ref: string
  note: string
  created_at: string
}
export interface ModelBookmark {
  id: string
  user_id: string
  model_id: string
  model_name: string
  note: string
  created_at: string
}
export interface LearnProgress {
  id: string
  user_id: string
  module: string
  item_id: string
  status: string
  score: number
  updated_at: string
}
export interface LearnBookmark {
  id: string
  user_id: string
  kind: string
  ref_id: string
  title: string
  note: string
  created_at: string
}
export interface LearnReading {
  id: string
  user_id: string
  book_id: number
  book_title: string
  progress: number
  last_pos: number
  updated_at: string
}

/* ---------- 星舆识途：自选车 ---------- */
export async function listCarWatch(): Promise<CarWatchItem[]> {
  const u = await uid()
  if (!u) return []
  const { data } = await supabase.from('car_watchlist').select('*').eq('user_id', u).order('created_at', { ascending: false })
  return (data as CarWatchItem[] | null) || []
}
export async function addCarWatch(name: string, ref = '', note = ''): Promise<void> {
  const u = assertUid(await uid())
  await supabase.from('car_watchlist').insert({ user_id: u, name, ref, note })
}
export async function removeCarWatch(id: string): Promise<void> {
  await supabase.from('car_watchlist').delete().eq('id', id)
}

/* ---------- AI模型知识：收藏 ---------- */
export async function listModelBookmarks(): Promise<ModelBookmark[]> {
  const u = await uid()
  if (!u) return []
  const { data } = await supabase.from('model_bookmarks').select('*').eq('user_id', u).order('created_at', { ascending: false })
  return (data as ModelBookmark[] | null) || []
}
export async function addModelBookmark(modelId: string, modelName: string, note = ''): Promise<void> {
  const u = assertUid(await uid())
  await supabase.from('model_bookmarks').insert({ user_id: u, model_id: modelId, model_name: modelName, note })
}
export async function removeModelBookmark(id: string): Promise<void> {
  await supabase.from('model_bookmarks').delete().eq('id', id)
}

/* ---------- 学习中心：书签 ---------- */
export async function listLearnBookmarks(kind?: string): Promise<LearnBookmark[]> {
  const u = await uid()
  if (!u) return []
  let q = supabase.from('learn_bookmarks').select('*').eq('user_id', u).order('created_at', { ascending: false })
  if (kind) q = q.eq('kind', kind)
  const { data, error } = await q
  if (error) throw error
  return (data as LearnBookmark[] | null) || []
}
export async function addLearnBookmark(kind: string, refId: string, title: string, note = ''): Promise<void> {
  const u = assertUid(await uid())
  const { error } = await supabase.from('learn_bookmarks').insert({ user_id: u, kind, ref_id: refId, title, note })
  if (error) throw error
}
export async function removeLearnBookmark(id: string): Promise<void> {
  const { error } = await supabase.from('learn_bookmarks').delete().eq('id', id)
  if (error) throw error
}

/* ---------- 学习中心：进度 ---------- */
export async function getProgress(module: string, itemId: string): Promise<LearnProgress | null> {
  const u = await uid()
  if (!u) return null
  const { data, error } = await supabase
    .from('learn_progress')
    .select('*')
    .eq('user_id', u)
    .eq('module', module)
    .eq('item_id', itemId)
    .maybeSingle()
  if (error) throw error
  return (data as LearnProgress | null) || null
}
export async function setProgress(module: string, itemId: string, status: string, score = 0): Promise<void> {
  const u = assertUid(await uid())
  const { error } = await supabase
    .from('learn_progress')
    .upsert(
      { user_id: u, module, item_id: itemId, status, score, updated_at: new Date().toISOString() },
      { onConflict: 'user_id,module,item_id' }
    )
  if (error) throw error
}
export async function listProgress(module: string): Promise<LearnProgress[]> {
  const u = await uid()
  if (!u) return []
  const { data, error } = await supabase
    .from('learn_progress')
    .select('*')
    .eq('user_id', u)
    .eq('module', module)
    .order('updated_at', { ascending: false })
  if (error) throw error
  return (data as LearnProgress[] | null) || []
}
export async function removeProgress(module: string, itemId: string): Promise<void> {
  const u = await uid()
  if (!u) return
  const { error } = await supabase
    .from('learn_progress')
    .delete()
    .eq('user_id', u)
    .eq('module', module)
    .eq('item_id', itemId)
  if (error) throw error
}

/* ---------- 学习中心：阅读记录 ---------- */
export async function listReading(): Promise<LearnReading[]> {
  const u = await uid()
  if (!u) return []
  const { data } = await supabase.from('learn_reading').select('*').eq('user_id', u).order('updated_at', { ascending: false })
  return (data as LearnReading[] | null) || []
}
export async function upsertReading(bookId: number, bookTitle: string, progress = 0, lastPos = 0): Promise<void> {
  const u = assertUid(await uid())
  await supabase
    .from('learn_reading')
    .upsert(
      { user_id: u, book_id: bookId, book_title: bookTitle, progress, last_pos: lastPos, updated_at: new Date().toISOString() },
      { onConflict: 'user_id,book_id' }
    )
}

/* ---------- 学习中心：备考学习计划（复用 learn_bookmarks，kind='plan'，按账号隔离） ---------- */
export async function listStudyPlans(): Promise<LearnBookmark[]> {
  return listLearnBookmarks('plan')
}
export async function saveStudyPlan(plan: StudyPlan, examDate: string): Promise<void> {
  assertUid(await uid())
  const title = `学习计划 · ${examDate}`
  const exist = (await listLearnBookmarks('plan')).find((p) => p.title === title)
  if (exist) {
    await supabase.from('learn_bookmarks').update({ ref_id: JSON.stringify(plan), note: new Date().toISOString() }).eq('id', exist.id)
    return
  }
  await addLearnBookmark('plan', JSON.stringify(plan), title)
}
export async function removeStudyPlan(id: string): Promise<void> {
  await removeLearnBookmark(id)
}
