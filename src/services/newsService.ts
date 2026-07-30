// 新闻服务（M9c）—— 天行数据 topnews（免费 Key，localStorage）优先；
// 失败 / 无 Key 时降级到公共 RSS（经 allorigins 代理解析）。
// 单源失败不影响其它源；所有抓取带 8s 超时。

import { readFreeApiKey } from './geoService'

export interface NewsItem {
  title: string
  link: string
  source: string
  /** 已格式化为 YYYY-MM-DD HH:mm */
  pubDate: string
}

export interface FetchNewsOptions {
  category?: string
  keyword?: string
  limit?: number
}

const FETCH_TIMEOUT = 8000
const RSS_SOURCES: { url: string; name: string }[] = [
  { url: 'https://sspai.com/feed', name: '少数派' },
  { url: 'https://www.ithome.com/rss/', name: 'IT之家' },
  { url: 'https://www.36kr.com/feed', name: '36氪' },
  { url: 'https://rsshub.app/zhihu/daily', name: '知乎日报' }
]

function timeoutFetch(url: string): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT)
  return fetch(url, { signal: controller.signal }).finally(() => clearTimeout(timer))
}

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

/** 将任意 Date / 时间戳 / 字符串规范化为 YYYY-MM-DD HH:mm */
function formatPubDate(input: string | number | undefined): string {
  if (input === undefined || input === null || input === '') return ''
  let d: Date
  if (typeof input === 'number') d = new Date(input < 1e12 ? input * 1000 : input)
  else d = new Date(input.replace(/-/g, '/').replace('T', ' ').slice(0, 19))
  if (isNaN(d.getTime())) return ''
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function filterByKeyword(items: NewsItem[], keyword?: string): NewsItem[] {
  const kw = (keyword || '').trim().toLowerCase()
  if (!kw) return items
  return items.filter((it) => `${it.title} ${it.source}`.toLowerCase().includes(kw))
}

/** 天行数据 topnews（需免费 Key） */
async function fetchTianapi(opts: FetchNewsOptions): Promise<NewsItem[]> {
  const key = readFreeApiKey('tianxing')
  if (!key) return []
  const params = new URLSearchParams({ key, num: '30', page: '1' })
  if (opts.category) params.set('col', opts.category)
  const url = `https://api.tianapi.com/topnews/index?${params.toString()}`
  const res = await timeoutFetch(url)
  if (!res.ok) throw new Error('tianapi http ' + res.status)
  const data = (await res.json().catch(() => ({}))) as {
    code?: number
    newslist?: Array<{ title?: string; url?: string; source?: string; pubDate?: string; ctime?: number }>
  }
  if (data.code !== 200 || !Array.isArray(data.newslist)) throw new Error('tianapi 返回异常')
  return data.newslist
    .map((n) => ({
      title: String(n.title || '无标题'),
      link: String(n.url || ''),
      source: String(n.source || '天行数据'),
      pubDate: formatPubDate(n.pubDate ?? n.ctime)
    }))
    .filter((it) => it.title && it.link)
}

/** 公共 RSS 经 allorigins 代理解析（降级源） */
async function fetchRssFallback(opts: FetchNewsOptions): Promise<NewsItem[]> {
  const out: NewsItem[] = []
  await Promise.all(
    RSS_SOURCES.map(async (src) => {
      try {
        const proxy = `https://api.allorigins.win/raw?url=${encodeURIComponent(src.url)}`
        const res = await timeoutFetch(proxy)
        if (!res.ok) return
        const xml = await res.text()
        const doc = new DOMParser().parseFromString(xml, 'text/xml')
        const nodes = Array.from(doc.querySelectorAll('item, entry')).slice(0, 8)
        for (const n of nodes) {
          const title = n.querySelector('title')?.textContent?.trim()
          const link =
            n.querySelector('link')?.textContent?.trim() ||
            n.querySelector('link')?.getAttribute('href') ||
            ''
          const pubRaw =
            n.querySelector('pubDate')?.textContent?.trim() ||
            n.querySelector('published')?.textContent?.trim() ||
            n.querySelector('updated')?.textContent?.trim() ||
            ''
          if (title && link) {
            out.push({ title, link, source: src.name, pubDate: formatPubDate(pubRaw) })
          }
        }
      } catch {
        /* 单源失败忽略 */
      }
    })
  )
  return out
}

/**
 * 获取新闻列表：天行数据优先；无 Key 或失败时降级 RSS。
 * 最终按 keyword 过滤，limit 截断。
 */
export async function fetchNews(opts: FetchNewsOptions = {}): Promise<NewsItem[]> {
  let items: NewsItem[] = []
  try {
    items = await fetchTianapi(opts)
  } catch (e) {
    console.warn('[news] 天行数据获取失败，降级 RSS', e)
  }
  if (items.length === 0) {
    items = await fetchRssFallback(opts)
  }
  items = filterByKeyword(items, opts.keyword)
  return items.slice(0, opts.limit || 30)
}

/** 是否已配置天行 Key（用于 UI 提示降级） */
export function hasTianapiKey(): boolean {
  return Boolean(readFreeApiKey('tianxing'))
}
