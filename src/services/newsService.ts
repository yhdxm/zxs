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
const CACHE_LIMIT = 60 // 每分类缓存条数，支持右侧信息流翻页（Top10 + 后续分页）

// 鲜艳色板，按顺序分配给分类
const PALETTE = [
  '#2f6bff', '#e23b3b', '#7c5cff', '#1f9d55', '#0ea5e9', '#ec4899',
  '#e08a00', '#10b981', '#6366f1', '#f59e0b', '#ef4444', '#8b5cf6',
  '#14b8a6', '#f97316', '#64748b', '#a855f7', '#0d9488', '#db2777',
  '#2563eb', '#dc2626', '#7c3aed', '#059669', '#0284c7', '#c026d3'
]

/**
 * 内置分类（各行各业精细版）。
 * headline=头条；topic=Google News 标准分区（覆盖最稳）；search=关键词检索（任意行业）。
 */
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

  { key: 'ai', label: '人工智能', mode: 'search', value: '人工智能', color: '#7c3aed' },
  { key: 'internet', label: '互联网', mode: 'search', value: '互联网', color: '#0ea5e9' },
  { key: 'chip', label: '芯片半导体', mode: 'search', value: '芯片 半导体', color: '#2563eb' },
  { key: 'ev', label: '新能源汽车', mode: 'search', value: '新能源汽车', color: '#059669' },
  { key: 'phone', label: '智能手机', mode: 'search', value: '智能手机', color: '#db2777' },
  { key: 'blockchain', label: '区块链', mode: 'search', value: '区块链', color: '#f59e0b' },
  { key: 'metaverse', label: '元宇宙', mode: 'search', value: '元宇宙', color: '#8b5cf6' },
  { key: 'medical', label: '医疗医药', mode: 'search', value: '医疗 医药', color: '#dc2626' },
  { key: 'biotech', label: '生物医药', mode: 'search', value: '生物医药', color: '#e11d48' },
  { key: 'edu', label: '教育', mode: 'search', value: '教育', color: '#f59e0b' },
  { key: 'kaoyan', label: '考研', mode: 'search', value: '考研', color: '#ca8a04' },
  { key: 'liuxue', label: '留学', mode: 'search', value: '留学', color: '#0891b2' },
  { key: 'realestate', label: '房地产', mode: 'search', value: '房地产', color: '#7c3aed' },
  { key: 'stock', label: '股市', mode: 'search', value: '股市 A股', color: '#dc2626' },
  { key: 'fund', label: '基金', mode: 'search', value: '基金', color: '#16a34a' },
  { key: 'bond', label: '债券', mode: 'search', value: '债券', color: '#65a30d' },
  { key: 'forex', label: '汇率', mode: 'search', value: '汇率 人民币', color: '#0d9488' },
  { key: 'logistics', label: '物流', mode: 'search', value: '物流 快递', color: '#ea580c' },
  { key: 'ecommerce', label: '电商', mode: 'search', value: '电商 直播带货', color: '#c026d3' },
  { key: 'retail', label: '零售', mode: 'search', value: '零售 消费', color: '#db2777' },
  { key: 'food', label: '餐饮美食', mode: 'search', value: '餐饮 美食', color: '#f97316' },
  { key: 'travel', label: '旅游', mode: 'search', value: '旅游', color: '#14b8a6' },
  { key: 'aviation', label: '航空', mode: 'search', value: '航空 民航', color: '#2563eb' },
  { key: 'game', label: '游戏', mode: 'search', value: '游戏', color: '#7c3aed' },
  { key: 'esports', label: '电竞', mode: 'search', value: '电竞', color: '#9333ea' },
  { key: 'anime', label: '动漫', mode: 'search', value: '动漫', color: '#ec4899' },
  { key: 'movie', label: '影视', mode: 'search', value: '影视 电影', color: '#ef4444' },
  { key: 'music', label: '音乐', mode: 'search', value: '音乐', color: '#8b5cf6' },
  { key: 'star', label: '明星', mode: 'search', value: '明星', color: '#db2777' },
  { key: 'football', label: '足球', mode: 'search', value: '足球', color: '#16a34a' },
  { key: 'basketball', label: '篮球', mode: 'search', value: '篮球', color: '#ea580c' },
  { key: 'tennis', label: '网球', mode: 'search', value: '网球', color: '#ca8a04' },
  { key: 'car', label: '汽车', mode: 'search', value: '汽车', color: '#64748b' },
  { key: 'luxurycar', label: '豪华车', mode: 'search', value: '豪华车', color: '#a855f7' },
  { key: 'energy', label: '能源', mode: 'search', value: '能源', color: '#0891b2' },
  { key: 'oil', label: '石油', mode: 'search', value: '石油', color: '#1e293b' },
  { key: 'power', label: '电力', mode: 'search', value: '电力', color: '#f59e0b' },
  { key: 'pv', label: '光伏', mode: 'search', value: '光伏', color: '#eab308' },
  { key: 'wind', label: '风电', mode: 'search', value: '风电', color: '#0ea5e9' },
  { key: 'climate', label: '气候', mode: 'search', value: '气候', color: '#0284c7' },
  { key: 'env', label: '环保', mode: 'search', value: '环保', color: '#10b981' },
  { key: 'agri', label: '农业', mode: 'search', value: '农业', color: '#65a30d' },
  { key: 'rural', label: '乡村振兴', mode: 'search', value: '乡村振兴', color: '#15803d' },
  { key: 'mil', label: '军事', mode: 'search', value: '军事', color: '#334155' },
  { key: 'space', label: '航天', mode: 'search', value: '航天', color: '#4338ca' },
  { key: 'ship', label: '航海', mode: 'search', value: '航海 航运', color: '#0e7490' },
  { key: 'history', label: '历史', mode: 'search', value: '历史', color: '#92400e' },
  { key: 'culture', label: '文化', mode: 'search', value: '文化', color: '#be123c' },
  { key: 'archaeo', label: '考古', mode: 'search', value: '考古', color: '#a16207' },
  { key: 'book', label: '读书', mode: 'search', value: '读书', color: '#a855f7' },
  { key: 'career', label: '职场', mode: 'search', value: '职场', color: '#475569' },
  { key: 'startup', label: '创业', mode: 'search', value: '创业 融资', color: '#7c3aed' },
  { key: 'invest', label: '投资', mode: 'search', value: '投资', color: '#dc2626' },
  { key: 'wealth', label: '理财', mode: 'search', value: '理财', color: '#16a34a' },
  { key: 'ins', label: '保险', mode: 'search', value: '保险', color: '#0891b2' },
  { key: 'bank', label: '银行', mode: 'search', value: '银行', color: '#1d4ed8' },
  { key: 'consumer', label: '消费', mode: 'search', value: '消费', color: '#db2777' },
  { key: 'fashion', label: '时尚', mode: 'search', value: '时尚', color: '#c026d3' },
  { key: 'beauty', label: '美妆', mode: 'search', value: '美妆', color: '#ec4899' },
  { key: 'baby', label: '母婴', mode: 'search', value: '母婴', color: '#f472b6' },
  { key: 'home', label: '家居', mode: 'search', value: '家居', color: '#a16207' },
  { key: 'pet', label: '宠物', mode: 'search', value: '宠物', color: '#ca8a04' },
  { key: 'law', label: '法律', mode: 'search', value: '法律', color: '#334155' },
  { key: 'legal', label: '法治', mode: 'search', value: '法治', color: '#1e40af' },
  { key: 'gov', label: '政务', mode: 'search', value: '政务 政策', color: '#0d9488' },
  { key: 'livelihood', label: '民生', mode: 'search', value: '民生', color: '#059669' }
]

export function findCategory(key: string): NewsCategory {
  const found = NEWS_CATEGORIES.find((c) => c.key === key) ?? NEWS_CATEGORIES[0]
  // NEWS_CATEGORIES 为非空常量数组，此处兜底仅为满足类型收窄
  return found as NewsCategory
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
  return m?.[1] ?? ''
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

/* ---------- 数据来源托底（全部免费公开 RSS，Google News 不可达时降级） ---------- */

/** UI 用：展示给用户看的数据源托底说明。 */
export const NEWS_FALLBACK_SOURCES: { label: string; note: string }[] = [
  { label: '国内应用', note: '少数派 RSS + 爱范儿 RSS' },
  { label: '人工智能 / 科技', note: '机器之心 RSS + 量子位 RSS' },
  { label: '通用兜底', note: '36氪 RSS' }
]

/**
 * 各分类的免费 RSS 托底源（按 cat.key 映射），全部免 Key、前端直连。
 * Google News 三级代理全部失败时，按分类降级抓取这些源，保证有数据展示。
 */
const FALLBACK_FEEDS: Record<string, string[]> = {
  ai: [
    'https://www.jiqizhixin.com/rss',
    'https://www.qbitai.com/feed',
    'https://sspai.com/feed',
    'https://www.ifanr.com/feed'
  ],
  internet: ['https://sspai.com/feed', 'https://www.ifanr.com/feed'],
  tech: ['https://sspai.com/feed', 'https://www.ifanr.com/feed'],
  chip: ['https://www.jiqizhixin.com/rss', 'https://www.qbitai.com/feed'],
  ev: ['https://www.ifanr.com/feed', 'https://sspai.com/feed'],
  phone: ['https://www.ifanr.com/feed', 'https://sspai.com/feed'],
  game: ['https://www.ifanr.com/feed'],
  movie: ['https://www.ifanr.com/feed'],
  ent: ['https://www.ifanr.com/feed'],
  // 通用兜底（任意分类失败都尝试）
  __all: ['https://36kr.com/feed', 'https://sspai.com/feed']
}

async function fetchRssRaw(url: string, kind: 'allorigins' | 'codetabs'): Promise<NewsItem[]> {
  const proxyUrl =
    kind === 'allorigins'
      ? `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`
      : `https://api.codetabs.com/v1/proxy/?quest=${url}`
  const res = await timeoutFetch(proxyUrl)
  if (!res.ok) throw new Error('http ' + res.status)
  const xml = await res.text()
  return parseXmlItems(xml)
}

/**
 * 通用 RSS 抓取（经 allorigins / codetabs 代理，免费无 Key）：供其他模块（如星舆识途汽车兜底）复用。
 * 失败返回空数组，由调用方决定是否降级到内置数据。
 */
export async function fetchRssViaProxies(url: string): Promise<NewsItem[]> {
  for (const kind of ['allorigins', 'codetabs'] as const) {
    try {
      const items = await fetchRssRaw(url, kind)
      if (items.length) return items
    } catch (e) {
      console.warn('[news] fetchRssViaProxies 失败:', url, e)
    }
  }
  return []
}

/** 尝试分类托底 RSS；成功返回条目，全部失败返回空数组。 */
async function tryFallbackRss(cat: NewsCategory): Promise<NewsItem[]> {
  const feeds = [...(FALLBACK_FEEDS[cat.key] ?? []), ...(FALLBACK_FEEDS.__all ?? [])]
  const seen = new Set<string>()
  const out: NewsItem[] = []
  for (const url of feeds) {
    for (const kind of ['allorigins', 'codetabs'] as const) {
      try {
        const items = await fetchRssRaw(url, kind)
        for (const it of items) {
          if (!it.title || seen.has(it.id)) continue
          seen.add(it.id)
          out.push(it)
        }
        if (out.length >= 12) return out
      } catch (e) {
        console.warn('[news] 托底源失败:', url, e)
      }
    }
  }
  return out
}

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

/** 拉取某分类全部新闻（最多 CACHE_LIMIT 条），已按时间倒序、已缓存。统一去重入口。 */
async function loadAll(cat: NewsCategory): Promise<NewsItem[]> {
  const cacheKey = cat.key
  if (inFlight.has(cacheKey)) return inFlight.get(cacheKey)!
  const p = (async () => {
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
    // Google News 三级代理全失败 → 降级到分类免费 RSS 托底
    if (!items.length) {
      items = await tryFallbackRss(cat)
    }
    items.sort((a, b) => b.pubTimestamp - a.pubTimestamp)
    if (items.length) setCache(cacheKey, items)
    return items
  })()
  inFlight.set(cacheKey, p)
  try {
    return await p
  } finally {
    inFlight.delete(cacheKey)
  }
}

/**
 * 获取某分类新闻列表：先读缓存（3 分钟内直接返回，不发请求）；
 * 缓存未命中则三级代理兜底，按发布时间倒序，keyword 过滤后截断。
 * 同一分类并发请求会被去重为一次。
 */
export async function fetchNews(opts: FetchNewsOptions = {}): Promise<NewsItem[]> {
  const cat = findCategory(opts.category || 'top')
  const all = await loadAll(cat)
  return filterByKeyword(all, opts.keyword).slice(0, opts.limit || 30)
}

/**
 * 取某分类全部新闻（用于分页/切分：Top10 热搜 + 右侧 11 条起信息流）。
 * 已按时间倒序，已应用 keyword 过滤。最多返回 CACHE_LIMIT 条。
 */
export async function fetchNewsAll(opts: FetchNewsOptions = {}): Promise<NewsItem[]> {
  const cat = findCategory(opts.category || 'top')
  const all = await loadAll(cat)
  return filterByKeyword(all, opts.keyword)
}

/** 热搜：取某分类按时间倒序的前 N 条（N 默认 10）。跟随所选分类。 */
export async function fetchHot(category?: string, topN = 10): Promise<NewsItem[]> {
  const all = await fetchNewsAll({ category })
  return all.slice(0, topN)
}

/** 实时脉搏 Top5：取热搜前 5 条，用于首页波浪节点展示。 */
export async function fetchPulse(category?: string, topN = 5): Promise<NewsItem[]> {
  const all = await fetchNewsAll({ category })
  return all.slice(0, topN)
}

/** 信息流（第 offset 条及之后）：默认从第 11 条开始（offset=10），避免与 Top10 重复。 */
export async function fetchNewsTail(opts: FetchNewsOptions & { offset?: number } = {}): Promise<NewsItem[]> {
  const all = await fetchNewsAll(opts)
  const offset = opts.offset ?? 10
  return all.slice(offset)
}
