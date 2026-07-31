// 新闻服务（新闻聚合 M9c）—— 数据源：Google News 公开 RSS（中文区）。
// 免费、纯前端直连，经多级 CORS 代理兜底（rss2json → allorigins → codetabs）。
// 所有抓取带 8s 超时；结果缓存到 localStorage（TTL 3 分钟 + 同一分类并发去重），
// 既不频繁打接口，也不会无限制增长存储，避免把浏览器/代理拉爆。

export interface NewsItem {
  id: string
  title: string
  link: string
  source: string
  /** 已格式化为 YYYY-MM-DD HH:mm */
  pubDate: string
  /** 原始时间戳，用于相对时间计算 */
  pubTimestamp: number
  /** 摘要（已去 HTML 标签） */
  description: string
  /** 缩略图 URL，可能为空 */
  thumbnail: string
}

export interface NewsCategory {
  key: string
  label: string
  mode: 'headline' | 'topic' | 'search'
  value: string
  color: string
}

const CACHE_PREFIX = 'zxs_news_cache_'
const CACHE_TTL = 3 * 60 * 1000 // 3 分钟
const FETCH_TIMEOUT = 8000
const CACHE_LIMIT = 30 // 每分类最多缓存条数，控制存储体积

/** 内置分类（16 个）。headline=头条；topic=Google News 标准分区；search=关键词检索模拟分区 */
export const NEWS_CATEGORIES: NewsCategory[] = [
  { key: 'top', label: '头条', mode: 'headline', value: '', color: '#2f6bff' },
  { key: 'nation', label: '中国', mode: 'topic', value: 'NATION', color: '#e23b3b' },
  { key: 'world', label: '国际', mode: 'topic', value: 'WORLD', color: '#7c5cff' },
  { key: 'business', label: '财经', mode: 'topic', value: 'BUSINESS', color: '#1f9d55' },
  { key: 'tech', label: '科技', mode: 'topic', value: 'TECHNOLOGY', color: '#0ea5e9' },
  { key: 'ent', label: '娱乐', mode: 'topic', value: 'ENTERTAINMENT', color: '#ec4899' },
  { key: 'sports', label: '体育', mode: 'topic', value: 'SPORTS', color: '#e08a00' },
  { key: 'health', label: '健康', mode: 'topic', value: 'HEALTH', color: '#10b981' },
  { key: 'science', label: '科学', mode: 'topic', value: 'SCIENCE', color: '#6366f1' },
  { key: 'edu', label: '教育', mode: 'search', value: '教育', color: '#f59e0b' },
  { key: 'movie', label: '影视', mode: 'search', value: '影视', color: '#ef4444' },
  { key: 'music', label: '音乐', mode: 'search', value: '音乐', color: '#8b5cf6' },
  { key: 'travel', label: '旅游', mode: 'search', value: '旅游', color: '#14b8a6' },
  { key: 'food', label: '美食', mode: 'search', value: '美食', color: '#f97316' },
  { key: 'car', label: '汽车', mode: 'search', value: '汽车', color: '#64748b' },
  { key: 'book', label: '读书', mode: 'search', value: '读书', color: '#a855f7' }
]

export function findCategory(key: string): NewsCategory {
  return NEWS_CATEGORIES.find((c) => c.key === key) || NEWS_CATEGORIES[0]
}

function buildRssUrl(cat: NewsCategory): string {
  const base = 'https://news.google.com/rss'
  const hl = 'hl=zh-CN&gl=CN&ceid=CN:zh-Hans'
  if (cat.mode === 'headline') return `${base}?${hl}`
  if (cat.mode === 'topic') return `${base}/headlines/section/topic/${cat.value}?${hl}`
  return `${base}/search?q=${encodeURIComponent(cat.value)}&${hl}`
}

function timeoutFetch(url: string, opts: RequestInit = {}): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT)
  return fetch(url, { ...opts, signal: controller.signal }).finally(() => clearTimeout(timer))
}

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

function formatTs(ts: number): string {
  if (!ts || isNaN(ts)) return ''
  const d = new Date(ts)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** 相对时间：刚刚 / X分钟前 / X小时前 / X天前 */
export function relativeTime(ts: number): string {
  if (!ts || isNaN(ts)) return ''
  const diff = Date.now() - ts
  if (diff < 0) return '刚刚'
  if (diff < 60_000) return '刚刚'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}分钟前`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}小时前`
  return `${Math.floor(diff / 86_400_000)}天前`
}

export function formatNow(): string {
  const d = new Date()
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

function stripHtml(html: string): string {
  if (!html) return ''
  return html
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
}

function extractThumbFromHtml(html: string): string {
  if (!html) return ''
  const m = html.match(/<img[^>]+src=["']([^"']+)["']/i)
  return m ? m[1] : ''
}

/** 从 "标题 - 来源" 中拆出真实标题；source 已知时优先用 source 截断 */
function stripSourceSuffix(title: string, source: string): string {
  if (!title) return ''
  if (source && title.endsWith(` - ${source}`)) {
    return title.slice(0, title.length - source.length - 3).trim()
  }
  const idx = title.lastIndexOf(' - ')
  if (idx > 0 && idx > title.length * 0.4) return title.slice(0, idx).trim()
  return title.trim()
}

function extractSourceFromTitle(title: string): string {
  const idx = title.lastIndexOf(' - ')
  if (idx > 0) return title.slice(idx + 3).trim()
  return ''
}

/* ---------- 解析层 ---------- */

function parseRss2JsonItems(json: any): NewsItem[] {
  const items: any[] = Array.isArray(json?.items) ? json.items : []
  return items.map((it) => {
    const rawTitle = String(it.title || '')
    const author = String(it.author || '').trim()
    const source = author || extractSourceFromTitle(rawTitle)
    const link = String(it.link || '')
    const ts = new Date(String(it.pubDate || '')).getTime() || Date.now()
    const descRaw = String(it.description || it.content || '')
    const thumb = String(it.thumbnail || '') || extractThumbFromHtml(descRaw)
    return {
      id: link || rawTitle,
      title: stripSourceSuffix(rawTitle, source) || rawTitle,
      link,
      source,
      pubDate: formatTs(ts),
      pubTimestamp: ts,
      description: stripHtml(descRaw).slice(0, 240),
      thumbnail: thumb
    }
  })
}

function parseXmlItems(xml: string): NewsItem[] {
  const doc = new DOMParser().parseFromString(xml, 'text/xml')
  const nodes = Array.from(doc.querySelectorAll('item, entry'))
  return nodes.map((n) => {
    const rawTitle = n.querySelector('title')?.textContent?.trim() || ''
    const link =
      n.querySelector('link')?.textContent?.trim() ||
      n.querySelector('link')?.getAttribute('href') ||
      ''
    const pubRaw =
      n.querySelector('pubDate')?.textContent?.trim() ||
      n.querySelector('published')?.textContent?.trim() ||
      n.querySelector('updated')?.textContent?.trim() ||
      ''
    const ts = new Date(pubRaw).getTime() || Date.now()
    const sourceTag = n.querySelector('source')?.textContent?.trim() || ''
    const source = sourceTag || extractSourceFromTitle(rawTitle)
    const title = stripSourceSuffix(rawTitle, source) || rawTitle
    const descRaw =
      n.querySelector('description')?.textContent ||
      n.querySelector('summary')?.textContent ||
      ''
    const media =
      n.querySelector('media\\:thumbnail, thumbnail')?.getAttribute('url') ||
      n.querySelector('enclosure')?.getAttribute('url') ||
      ''
    const thumb = media || extractThumbFromHtml(descRaw)
    return {
      id: link || rawTitle,
      title,
      link,
      source,
      pubDate: formatTs(ts),
      pubTimestamp: ts,
      description: stripHtml(descRaw).slice(0, 240),
      thumbnail: thumb
    }
  })
}

/* ---------- 代理兜底层 ---------- */

async function tryRss2Json(cat: NewsCategory): Promise<NewsItem[]> {
  const url = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(buildRssUrl(cat))}`
  const res = await timeoutFetch(url)
  if (!res.ok) throw new Error('rss2json http ' + res.status)
  const data = (await res.json().catch(() => ({}))) as any
  if (data.status !== 'ok' || !Array.isArray(data.items)) throw new Error('rss2json 返回异常')
  const items = parseRss2JsonItems(data)
  if (!items.length) throw new Error('rss2json 空数据')
  return items
}

async function tryAllOrigins(cat: NewsCategory): Promise<NewsItem[]> {
  const url = `https://api.allorigins.win/raw?url=${encodeURIComponent(buildRssUrl(cat))}`
  const res = await timeoutFetch(url)
  if (!res.ok) throw new Error('allorigins http ' + res.status)
  const xml = await res.text()
  const items = parseXmlItems(xml)
  if (!items.length) throw new Error('allorigins 空数据')
  return items
}

async function tryCodetabs(cat: NewsCategory): Promise<NewsItem[]> {
  const url = `https://api.codetabs.com/v1/proxy/?quest=${buildRssUrl(cat)}`
  const res = await timeoutFetch(url)
  if (!res.ok) throw new Error('codetabs http ' + res.status)
  const xml = await res.text()
  const items = parseXmlItems(xml)
  if (!items.length) throw new Error('codetabs 空数据')
  return items
}

const PROXIES = [tryRss2Json, tryAllOrigins, tryCodetabs]

/* ---------- 缓存 + 并发去重 ---------- */

const inFlight = new Map<string, Promise<NewsItem[]>>()

function getCache(cacheKey: string): NewsItem[] | null {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + cacheKey)
    if (!raw) return null
    const obj = JSON.parse(raw) as { items: NewsItem[]; fetchedAt: number }
    if (Date.now() - obj.fetchedAt > CACHE_TTL) return null
    return obj.items || null
  } catch {
    return null
  }
}

function setCache(cacheKey: string, items: NewsItem[]): void {
  try {
    localStorage.setItem(
      CACHE_PREFIX + cacheKey,
      JSON.stringify({ items: items.slice(0, CACHE_LIMIT), fetchedAt: Date.now() })
    )
  } catch {
    /* 存储满或隐私模式，忽略 */
  }
}

function filterByKeyword(items: NewsItem[], keyword?: string): NewsItem[] {
  const kw = (keyword || '').trim().toLowerCase()
  if (!kw) return items
  return items.filter((it) => `${it.title} ${it.source}`.toLowerCase().includes(kw))
}

export interface FetchNewsOptions {
  category?: string
  keyword?: string
  limit?: number
}

/**
 * 获取某分类新闻列表：先读缓存（3 分钟内直接返回，不发请求）；
 * 缓存未命中则三级代理兜底，按发布时间倒序，keyword 过滤后截断。
 * 同一分类并发请求会被去重为一次。
 */
export async function fetchNews(opts: FetchNewsOptions = {}): Promise<NewsItem[]> {
  const cat = findCategory(opts.category || 'top')
  const cacheKey = cat.key

  if (inFlight.has(cacheKey)) {
    const all = await inFlight.get(cacheKey)!
    return filterByKeyword(all, opts.keyword).slice(0, opts.limit || 30)
  }

  const run = async (): Promise<NewsItem[]> => {
    const cached = getCache(cacheKey)
    if (cached) return cached
    let items: NewsItem[] = []
    for (const proxy of PROXIES) {
      try {
        items = await proxy(cat)
        if (items.length) break
      } catch (e) {
        console.warn(`[news] 代理失败:`, e)
      }
    }
    items.sort((a, b) => b.pubTimestamp - a.pubTimestamp)
    if (items.length) setCache(cacheKey, items)
    return items
  }

  const p = run()
  inFlight.set(cacheKey, p)
  try {
    const all = await p
    return filterByKeyword(all, opts.keyword).slice(0, opts.limit || 30)
  } finally {
    inFlight.delete(cacheKey)
  }
}

/** 热搜：取某分类按时间倒序的前 N 条（N 默认 10）。跟随所选分类。 */
export async function fetchHot(category?: string, topN = 10): Promise<NewsItem[]> {
  const items = await fetchNews({ category, limit: topN })
  return items.slice(0, topN)
}
