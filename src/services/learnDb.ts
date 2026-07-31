// 新增模块用户数据服务（Supabase 免费档）。
// 由于本项目为自建账号体系（非 Supabase Auth），RLS 在数据库层无法隔离，
// 故所有读写均由前端按「当前登录账号 id」过滤（见 scripts/new_modules_tables.sql 说明）。

import { supabase, getSavedUser } from './appDataService'

async function uid(): Promise<string> {
  const u = await getSavedUser()
  return u?.id || 'anonymous'
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
  const { data } = await supabase.from('car_watchlist').select('*').eq('user_id', u).order('created_at', { ascending: false })
  return (data as CarWatchItem[] | null) || []
}
export async function addCarWatch(name: string, ref = '', note = ''): Promise<void> {
  const u = await uid()
  await supabase.from('car_watchlist').insert({ user_id: u, name, ref, note })
}
export async function removeCarWatch(id: string): Promise<void> {
  await supabase.from('car_watchlist').delete().eq('id', id)
}

/* ---------- AI模型知识：收藏 ---------- */
export async function listModelBookmarks(): Promise<ModelBookmark[]> {
  const u = await uid()
  const { data } = await supabase.from('model_bookmarks').select('*').eq('user_id', u).order('created_at', { ascending: false })
  return (data as ModelBookmark[] | null) || []
}
export async function addModelBookmark(modelId: string, modelName: string, note = ''): Promise<void> {
  const u = await uid()
  await supabase.from('model_bookmarks').insert({ user_id: u, model_id: modelId, model_name: modelName, note })
}
export async function removeModelBookmark(id: string): Promise<void> {
  await supabase.from('model_bookmarks').delete().eq('id', id)
}

/* ---------- 学习中心：书签 ---------- */
export async function listLearnBookmarks(kind?: string): Promise<LearnBookmark[]> {
  const u = await uid()
  let q = supabase.from('learn_bookmarks').select('*').eq('user_id', u).order('created_at', { ascending: false })
  if (kind) q = q.eq('kind', kind)
  const { data } = await q
  return (data as LearnBookmark[] | null) || []
}
export async function addLearnBookmark(kind: string, refId: string, title: string, note = ''): Promise<void> {
  const u = await uid()
  await supabase.from('learn_bookmarks').insert({ user_id: u, kind, ref_id: refId, title, note })
}
export async function removeLearnBookmark(id: string): Promise<void> {
  await supabase.from('learn_bookmarks').delete().eq('id', id)
}

/* ---------- 学习中心：进度 ---------- */
export async function getProgress(module: string, itemId: string): Promise<LearnProgress | null> {
  const u = await uid()
  const { data } = await supabase
    .from('learn_progress')
    .select('*')
    .eq('user_id', u)
    .eq('module', module)
    .eq('item_id', itemId)
    .maybeSingle()
  return (data as LearnProgress | null) || null
}
export async function setProgress(module: string, itemId: string, status: string, score = 0): Promise<void> {
  const u = await uid()
  await supabase
    .from('learn_progress')
    .upsert(
      { user_id: u, module, item_id: itemId, status, score, updated_at: new Date().toISOString() },
      { onConflict: 'user_id,module,item_id' }
    )
}

/* ---------- 学习中心：阅读记录 ---------- */
export async function listReading(): Promise<LearnReading[]> {
  const u = await uid()
  const { data } = await supabase.from('learn_reading').select('*').eq('user_id', u).order('updated_at', { ascending: false })
  return (data as LearnReading[] | null) || []
}
export async function upsertReading(bookId: number, bookTitle: string, progress = 0, lastPos = 0): Promise<void> {
  const u = await uid()
  await supabase
    .from('learn_reading')
    .upsert(
      { user_id: u, book_id: bookId, book_title: bookTitle, progress, last_pos: lastPos, updated_at: new Date().toISOString() },
      { onConflict: 'user_id,book_id' }
    )
}
