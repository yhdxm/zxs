// 外部灵感聚合服务（需求收集页 M5）
// 数据来源（全部免费、前端直连、无需 Key）：
//   - Hacker News（Algolia 公开 API）
//   - Dev.to（公开 articles API）
//   - Reddit（公开 JSON 接口）
//   - Product Hunt（RSS 经公共代理解析）
// 单源失败不影响其他源；结果归一化为 ExternalIdea[] 后落库 external_ideas（带本地兜底）。

import { supabase } from './appDataService'

export type RelatedModule = 'todo' | 'point' | 'content' | null

export interface ExternalIdea {
  id: string
  user_id: string
  source: string // Hacker News / Dev.to / Product Hunt / Reddit / RSS:xxx
  title: string
  url: string
  summary: string
  tags: string[]
  fetched_at: string
  bookmarked: boolean
  related_module: RelatedModule
  raw?: Record<string, unknown>
}

/** 归一化后的原始抓取项（落库前结构） */
interface FetchedItem {
  source: string
  title: string
  url: string
  summary: string
  tags: string[]
}

const LOCAL_KEY = 'external_ideas_cache'
const FETCH_TIMEOUT = 8000

function genId(): string {
  return `ext-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

function timeoutFetch(url: string, init?: RequestInit): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT)
  return fetch(url, { ...init, signal: controller.signal }).finally(() => clearTimeout(timer))
}

function summarize(text: string, max = 120): string {
  const clean = (text || '').replace(/\s+/g, ' ').trim()
  if (!clean) return ''
  return clean.length > max ? clean.slice(0, max) + '…' : clean
}

/** 并发抓取多源并归一化 + 去重（按 url） */
export async function fetchExternalIdeas(): Promise<ExternalIdea[]> {
  const tasks: Promise<FetchedItem[]>[] = [
    fetchHackerNews(),
    fetchDevTo(),
    fetchReddit(),
    fetchProductHunt()
  ]

  const results = await Promise.allSettled(tasks)
  const merged: FetchedItem[] = []
  for (const r of results) {
    if (r.status === 'fulfilled') merged.push(...r.value)
  }

  // 去重（保留第一个出现的 url）
  const seen = new Set<string>()
  const deduped = merged.filter((it) => {
    const key = (it.url || it.title).toLowerCase()
    if (!key || seen.has(key)) return false
    seen.add(key)
    return true
  })

  const now = new Date().toISOString()
  return deduped.map((it) => ({
    id: genId(),
    user_id: '',
    source: it.source,
    title: it.title,
    url: it.url,
    summary: it.summary,
    tags: it.tags,
    fetched_at: now,
    bookmarked: false,
    related_module: null
  }))
}

async function fetchHackerNews(): Promise<FetchedItem[]> {
  try {
    const res = await timeoutFetch('https://hn.algolia.com/api/v1/search?tags=front_page&hitsPerPage=20')
    if (!res.ok) return []
    const data = (await res.json().catch(() => ({}))) as { hits?: Array<Record<string, unknown>> }
    return (data.hits || []).map((h) => ({
      source: 'Hacker News',
      title: String(h.title || h.story_title || '无标题'),
      url: String(h.url || h.story_url || `https://news.ycombinator.com/item?id=${h.objectID}`),
      summary: summarize(String(h.story_text || h.title || '')),
      tags: ['技术', '创业']
    }))
  } catch {
    return []
  }
}

async function fetchDevTo(): Promise<FetchedItem[]> {
  try {
    const res = await timeoutFetch('https://dev.to/api/articles?top=1&per_page=20')
    if (!res.ok) return []
    const data = (await res.json().catch(() => [])) as Array<Record<string, unknown>>
    return (Array.isArray(data) ? data : []).map((a) => ({
      source: 'Dev.to',
      title: String(a.title || '无标题'),
      url: String(a.url || ''),
      summary: summarize(String(a.description || a.title || '')),
      tags: Array.isArray(a.tag_list) ? (a.tag_list as string[]).slice(0, 3) : ['开发']
    }))
  } catch {
    return []
  }
}

async function fetchReddit(): Promise<FetchedItem[]> {
  try {
    const res = await timeoutFetch('https://www.reddit.com/r/programming/top.json?limit=20&t=week', {
      headers: { Accept: 'application/json' }
    })
    if (!res.ok) return []
    const data = (await res.json().catch(() => ({}))) as { data?: { children?: Array<Record<string, unknown>> } }
    const children = data.data?.children || []
    return children.map((c) => {
      const d = (c.data || {}) as Record<string, unknown>
      return {
        source: 'Reddit',
        title: String(d.title || '无标题'),
        url: String(d.url || `https://reddit.com${d.permalink || ''}`),
        summary: summarize(String(d.selftext || '')),
        tags: ['社区']
      }
    })
  } catch {
    return []
  }
}

async function fetchProductHunt(): Promise<FetchedItem[]> {
  try {
    const proxy = 'https://api.allorigins.win/raw?url=' + encodeURIComponent('https://www.producthunt.com/feed')
    const res = await timeoutFetch(proxy)
    if (!res.ok) return []
    const xml = await res.text()
    const doc = new DOMParser().parseFromString(xml, 'text/xml')
    const items = Array.from(doc.querySelectorAll('item')).slice(0, 15)
    return items.map((n) => {
      const title = n.querySelector('title')?.textContent?.trim() || '无标题'
      const link = n.querySelector('link')?.textContent?.trim() || n.querySelector('link')?.getAttribute('href') || ''
      const desc = n.querySelector('description')?.textContent?.trim() || ''
      return {
        source: 'Product Hunt',
        title,
        url: link,
        summary: summarize(desc.replace(/<[^>]+>/g, ' ')),
        tags: ['产品', '创业']
      }
    })
  } catch {
    return []
  }
}

/* ============ 落库 / 读取（external_ideas 表 + 本地兜底） ============ */

function readLocalCache(): ExternalIdea[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(LOCAL_KEY)
    return raw ? (JSON.parse(raw) as ExternalIdea[]) : []
  } catch {
    return []
  }
}

function writeLocalCache(items: ExternalIdea[]) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(LOCAL_KEY, JSON.stringify(items.slice(0, 200)))
  } catch {
    /* 忽略写入异常 */
  }
}

/** 将任意来源的一行（Supabase / 本地）规范化为稳定的 ExternalIdea，避免渲染异常 */
export function normalizeExternalIdea(raw: Partial<ExternalIdea> & Record<string, unknown>): ExternalIdea {
  let tags: string[] = []
  const rawTags = raw.tags
  if (Array.isArray(rawTags)) {
    tags = rawTags.filter((t) => typeof t === 'string') as string[]
  } else if (typeof rawTags === 'string' && rawTags.trim()) {
    // Supabase 可能以 `{a,b}` 原生数组或 JSON 字符串形式返回
    const s = rawTags.trim()
    if (s.startsWith('[')) {
      try {
        const arr = JSON.parse(s)
        if (Array.isArray(arr)) tags = arr.filter((t: unknown) => typeof t === 'string')
      } catch {
        tags = []
      }
    } else if (s.startsWith('{')) {
      tags = s
        .slice(1, -1)
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean)
    } else {
      tags = [s]
    }
  }

  return {
    id: String(raw.id || `ext-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`),
    user_id: String(raw.user_id || ''),
    source: String(raw.source || '未知来源'),
    title: String(raw.title || '无标题'),
    url: String(raw.url || ''),
    summary: String(raw.summary || ''),
    tags,
    fetched_at: String(raw.fetched_at || new Date().toISOString()),
    bookmarked: Boolean(raw.bookmarked),
    related_module: (raw.related_module as RelatedModule) ?? null,
    raw: (raw.raw as Record<string, unknown> | undefined) ?? undefined
  }
}

/** 读取灵感列表：优先 Supabase，失败回退本地缓存；结果统一规范化 */
export async function loadExternalIdeas(userId: string): Promise<ExternalIdea[]> {
  if (!userId) return readLocalCache().map(normalizeExternalIdea)
  try {
    const { data, error } = await supabase
      .from('external_ideas')
      .select('*')
      .eq('user_id', userId)
      .order('fetched_at', { ascending: false })
    if (error) {
      console.warn('[externalIdeas] 读取失败，回退本地', error.message)
      return readLocalCache().map(normalizeExternalIdea)
    }
    const rows = Array.isArray(data) ? (data as unknown[]) : []
    // 表未建立 / 字段缺失时规范化兜底，避免白屏
    return rows.map((r) => normalizeExternalIdea(r as Partial<ExternalIdea> & Record<string, unknown>))
  } catch (e) {
    console.warn('[externalIdeas] 读取异常，回退本地', e)
    return readLocalCache().map(normalizeExternalIdea)
  }
}

/** 保存（批量 upsert）灵感列表：先写 Supabase，再写本地兜底 */
export async function saveExternalIdeas(userId: string, items: ExternalIdea[]): Promise<void> {
  const withUser = items.map((it) => ({ ...it, user_id: userId }))
  writeLocalCache(withUser)

  if (!userId) return
  try {
    const payload = withUser.map((it) => ({
      id: it.id,
      user_id: userId,
      source: it.source,
      title: it.title,
      url: it.url,
      summary: it.summary,
      tags: it.tags,
      fetched_at: it.fetched_at,
      bookmarked: it.bookmarked,
      related_module: it.related_module ?? null,
      raw: (it.raw ?? null) as unknown as Record<string, unknown> | null
    }))
    const { error } = await supabase.from('external_ideas').upsert(payload, { onConflict: 'id' })
    if (error) console.warn('[externalIdeas] 云端保存失败', error.message)
  } catch (e) {
    console.warn('[externalIdeas] 云端保存异常', e)
  }
}

/** 切换收藏状态 */
export async function toggleBookmark(userId: string, id: string, val: boolean): Promise<void> {
  if (userId) {
    try {
      const { error } = await supabase
        .from('external_ideas')
        .update({ bookmarked: val })
        .eq('user_id', userId)
        .eq('id', id)
      if (error) console.warn('[externalIdeas] 收藏更新失败', error.message)
    } catch (e) {
      console.warn('[externalIdeas] 收藏更新异常', e)
    }
  }
  // 同步本地缓存
  const cache = readLocalCache().map((it) => (it.id === id ? { ...it, bookmarked: val } : it))
  writeLocalCache(cache)
}

/** 设置关联模块（待办 / 点位 / 内容） */
export async function setRelatedModule(userId: string, id: string, mod: RelatedModule): Promise<void> {
  if (userId) {
    try {
      const { error } = await supabase
        .from('external_ideas')
        .update({ related_module: mod })
        .eq('user_id', userId)
        .eq('id', id)
      if (error) console.warn('[externalIdeas] 关联模块更新失败', error.message)
    } catch (e) {
      console.warn('[externalIdeas] 关联模块更新异常', e)
    }
  }
  const cache = readLocalCache().map((it) => (it.id === id ? { ...it, related_module: mod } : it))
  writeLocalCache(cache)
}

/* ============ 缓存管理（Fix #3）：单条删除 / 清空全部 / 保留天数自动清理 ============ */

const RETENTION_KEY = 'external_ideas_retention_days'
const DEFAULT_RETENTION_DAYS = 30

/** 读取保留天数（默认 30 天） */
export function getRetentionDays(): number {
  if (typeof window === 'undefined') return DEFAULT_RETENTION_DAYS
  try {
    const raw = window.localStorage.getItem(RETENTION_KEY)
    if (!raw) return DEFAULT_RETENTION_DAYS
    const n = Number(raw)
    return Number.isFinite(n) && n >= 1 && n <= 365 ? n : DEFAULT_RETENTION_DAYS
  } catch {
    return DEFAULT_RETENTION_DAYS
  }
}

/** 写入保留天数 */
export function setRetentionDays(days: number): void {
  if (typeof window === 'undefined') return
  const n = Math.max(1, Math.min(365, Math.floor(days)))
  try {
    window.localStorage.setItem(RETENTION_KEY, String(n))
  } catch {
    /* 忽略 */
  }
}

/** 删除单条灵感（Supabase + 本地缓存） */
export async function deleteExternalIdea(userId: string, id: string): Promise<void> {
  if (userId) {
    try {
      const { error } = await supabase.from('external_ideas').delete().eq('user_id', userId).eq('id', id)
      if (error) console.warn('[externalIdeas] 删除失败', error.message)
    } catch (e) {
      console.warn('[externalIdeas] 删除异常', e)
    }
  }
  const cache = readLocalCache().filter((it) => it.id !== id)
  writeLocalCache(cache)
}

/** 清空全部灵感缓存（Supabase + 本地缓存） */
export async function clearExternalIdeas(userId: string): Promise<void> {
  if (userId) {
    try {
      const { error } = await supabase.from('external_ideas').delete().eq('user_id', userId)
      if (error) console.warn('[externalIdeas] 清空失败', error.message)
    } catch (e) {
      console.warn('[externalIdeas] 清空异常', e)
    }
  }
  try {
    if (typeof window !== 'undefined') window.localStorage.removeItem(LOCAL_KEY)
  } catch {
    /* 忽略 */
  }
}

/**
 * 按保留天数裁剪：返回保留（未过期）的列表。
 * 以 fetched_at 为基准，超过 days 天的视为过期。
 */
export function pruneExternalIdeas(items: ExternalIdea[], days: number): ExternalIdea[] {
  const cutoff = Date.now() - days * 86400000
  return items.filter((it) => {
    const t = new Date(it.fetched_at).getTime()
    return Number.isFinite(t) && t >= cutoff
  })
}

/**
 * 清理过期灵感（Fix #3）：保留天数之外的删除。
 * 先本地裁剪并写回，再尽力同步 Supabase（按 fetched_at < cutoff 删除）。
 * @returns 实际清理的条数
 */
export async function cleanupExpiredExternalIdeas(userId: string, days: number): Promise<number> {
  const cutoffIso = new Date(Date.now() - days * 86400000).toISOString()
  // 本地先裁剪
  const cache = readLocalCache()
  const kept = pruneExternalIdeas(cache, days)
  const removed = cache.length - kept.length
  writeLocalCache(kept)

  if (userId) {
    try {
      const { error } = await supabase.from('external_ideas').delete().eq('user_id', userId).lt('fetched_at', cutoffIso)
      if (error) console.warn('[externalIdeas] 过期清理同步失败', error.message)
    } catch (e) {
      console.warn('[externalIdeas] 过期清理同步异常', e)
    }
  }
  return removed
}
