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

/** 读取灵感列表：优先 Supabase，失败回退本地缓存 */
export async function loadExternalIdeas(userId: string): Promise<ExternalIdea[]> {
  if (!userId) return readLocalCache()
  try {
    const { data, error } = await supabase
      .from('external_ideas')
      .select('*')
      .eq('user_id', userId)
      .order('fetched_at', { ascending: false })
    if (error) {
      console.warn('[externalIdeas] 读取失败，回退本地', error.message)
      return readLocalCache()
    }
    return (data || []) as unknown as ExternalIdea[]
  } catch (e) {
    console.warn('[externalIdeas] 读取异常，回退本地', e)
    return readLocalCache()
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
