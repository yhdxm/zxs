// 国内免费新闻源（东方财富全站资讯搜索）—— 免 KEY、免费、响应头带 Access-Control-Allow-Origin: *，
// 浏览器可直连，无需 CORS 代理，因此在国内网络环境下比 Google News RSS 稳定得多。
//
// 接口：https://search-api-web.eastmoney.com/search/jsonp?cb=&param={...}
//  - cb 传空 → 返回纯 JSON（非 JSONP 包装）
//  - sort: "time" 按时间倒序 / "default" 按相关度
//  - 返回字段：date / title / content / mediaName / url（title、content 内含 <em> 高亮标签，需清洗）
//
// 注意：东财是「财经全站搜索」而非垂直搜索，宽泛关键词会混入无关财经新闻，
// 因此调用方应传入 mustInclude 词表做相关性过滤（见 fetchEastmoneyNews）。

import type { NewsItem } from './newsService'

interface EmArticle {
  date?: string
  title?: string
  content?: string
  mediaName?: string
  url?: string
  code?: string
}

interface EmResponse {
  code?: number
  result?: { cmsArticleWebOld?: EmArticle[] }
}

const EM_ENDPOINT = 'https://search-api-web.eastmoney.com/search/jsonp'
const DEFAULT_TIMEOUT = 9000

/** 去掉搜索接口返回的 <em> 高亮标签与多余空白 */
function stripTag(s: string): string {
  return s
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim()
}

/** "2026-08-02 11:26:06" → 时间戳；解析失败回退当前时间 */
function parseEmDate(d: string): number {
  if (!d) return Date.now()
  // Safari 不认 "YYYY-MM-DD HH:mm:ss"，统一替换为 ISO 风格
  const t = Date.parse(d.replace(/-/g, '/'))
  return Number.isNaN(t) ? Date.now() : t
}

function fmtDate(ts: number): string {
  const d = new Date(ts)
  const p = (n: number): string => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}

function fetchWithTimeout(url: string, timeout: number): Promise<Response> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeout)
  return fetch(url, { signal: ctrl.signal }).finally(() => clearTimeout(timer))
}

export interface EmNewsOptions {
  /** 返回条数上限，默认 20 */
  limit?: number
  /** 排序：time=最新优先（默认），default=相关度优先 */
  sort?: 'time' | 'default'
  /**
   * 相关性过滤词表：标题或摘要需至少命中其中一个词才保留。
   * 东财为全站财经搜索，不传此项时宽泛关键词会混入大量无关新闻。
   */
  mustInclude?: string[]
  timeout?: number
}

/**
 * 按关键词搜索国内财经/行业资讯。
 * 失败或无结果返回空数组（由调用方决定降级策略），不抛异常。
 */
export async function fetchEastmoneyNews(keyword: string, opts: EmNewsOptions = {}): Promise<NewsItem[]> {
  const limit = opts.limit ?? 20
  const sort = opts.sort ?? 'time'
  const timeout = opts.timeout ?? DEFAULT_TIMEOUT
  // 多取一些，过滤后仍能凑够 limit 条
  const pageSize = Math.min(50, Math.max(limit * 2, 20))

  const param = {
    uid: '',
    keyword,
    type: ['cmsArticleWebOld'],
    client: 'web',
    clientType: 'web',
    clientVersion: 'curr',
    param: {
      cmsArticleWebOld: {
        searchScope: 'default',
        sort,
        pageIndex: 1,
        pageSize
      }
    }
  }
  const url = `${EM_ENDPOINT}?cb=&param=${encodeURIComponent(JSON.stringify(param))}`

  let json: EmResponse
  try {
    const res = await fetchWithTimeout(url, timeout)
    if (!res.ok) return []
    const text = await res.text()
    if (!text) return []
    // cb 为空时应为纯 JSON；若服务端仍返回 jsonp 包装，做一次兜底剥离
    const body = text.trim().startsWith('{') ? text : text.slice(text.indexOf('(') + 1, text.lastIndexOf(')'))
    json = JSON.parse(body) as EmResponse
  } catch {
    return []
  }

  const list = json?.result?.cmsArticleWebOld
  if (!Array.isArray(list) || !list.length) return []

  const words = opts.mustInclude ?? []
  const seen = new Set<string>()
  const out: NewsItem[] = []

  for (const raw of list) {
    const title = stripTag(raw.title ?? '')
    const link = raw.url ?? ''
    if (!title || !link) continue

    const description = stripTag(raw.content ?? '')
    if (words.length) {
      const hay = title + description
      if (!words.some((w) => hay.includes(w))) continue
    }

    const key = title.slice(0, 30)
    if (seen.has(key)) continue
    seen.add(key)

    const ts = parseEmDate(raw.date ?? '')
    out.push({
      id: raw.code || link,
      title,
      link,
      source: raw.mediaName || '东方财富',
      pubDate: fmtDate(ts),
      pubTimestamp: ts,
      description,
      thumbnail: ''
    })
    if (out.length >= limit) break
  }

  return out
}
