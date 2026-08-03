import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { fetchNews, fetchNewsAll, NEWS_CATEGORIES, findCategory } from '../src/services/newsService'

describe('M9c 免费新闻聚合（Google News RSS + 多级代理兜底）', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  /** 按 URL 返回桩响应：优先 json、其次 text；ok=false 时抛错触发降级 */
  function installFetch(handler: (url: string) => { ok: boolean; json?: () => unknown; text?: () => string }) {
    const fn = vi.fn(async (url: string | URL) => {
      const res = handler(String(url))
      return {
        ok: res.ok,
        status: res.ok ? 200 : 500,
        json: async () => (res.json ? res.json() : {}),
        text: async () => (res.text ? res.text() : ''),
      } as unknown as Response
    })
    vi.stubGlobal('fetch', fn)
    return fn
  }

  it('rss2json 代理成功 → 解析标题/来源/去 HTML 摘要', async () => {
    installFetch((u) => {
      if (u.includes('rss2json')) {
        return {
          ok: true,
          json: () => ({
            status: 'ok',
            items: [
              {
                title: '重磅新闻 - 量子位',
                author: '量子位',
                link: 'https://news.example/1',
                pubDate: '2024-01-01T10:00:00Z',
                description: '<p>这是<b>摘要</b></p>',
              },
            ],
          }),
        }
      }
      return { ok: false }
    })
    const items = await fetchNews({ category: 'tech', limit: 10 })
    expect(items.length).toBe(1)
    expect(items[0]!.source).toBe('量子位')
    expect(items[0]!.title).toBe('重磅新闻')
    expect(items[0]!.description).toBe('这是摘要')
    expect(items[0]!.link).toBe('https://news.example/1')
  })

  it('rss2json 失败 → 降级 allorigins（XML 解析）', async () => {
    installFetch((u) => {
      if (u.includes('rss2json')) return { ok: false }
      if (u.includes('allorigins')) {
        return {
          ok: true,
          text: () =>
            '<rss><channel><item><title>XML新闻 - 36氪</title><link>https://xml.example/1</link><pubDate>2024-01-01 08:30</pubDate><description>描述</description></item></channel></rss>',
        }
      }
      return { ok: false }
    })
    const items = await fetchNews({ category: 'tech', limit: 10 })
    expect(items.length).toBe(1)
    expect(items[0]!.title).toBe('XML新闻')
    expect(items[0]!.source).toBe('36氪')
  })

  it('三级代理全失败 → 降级分类免费 RSS 兜底（36氪/少数派）', async () => {
    installFetch((u) => {
      if (u.includes('rss2json')) return { ok: false }
      if (u.includes('codetabs')) return { ok: false }
      if (u.includes('allorigins')) {
        if (u.includes('news.google.com')) return { ok: false }
        // 兜底 RSS（36kr / sspai 等）
        return {
          ok: true,
          text: () =>
            '<rss><channel><item><title>兜底新闻 - 36氪</title><link>https://fb.example/1</link><pubDate>2024-01-01 09:00</pubDate><description>d</description></item></channel></rss>',
        }
      }
      return { ok: false }
    })
    const items = await fetchNews({ category: 'top', limit: 10 })
    expect(items.length).toBeGreaterThan(0)
    expect(items[0]!.title).toBe('兜底新闻')
  })

  it('pubDate 被规范化为 YYYY-MM-DD HH:mm', async () => {
    installFetch((u) => {
      if (u.includes('rss2json')) return { ok: false }
      if (u.includes('allorigins')) {
        return {
          ok: true,
          text: () =>
            '<rss><channel><item><title>时间新闻 - 来源</title><link>https://t.example/1</link><pubDate>2024-01-01 08:30</pubDate><description>d</description></item></channel></rss>',
        }
      }
      return { ok: false }
    })
    const items = await fetchNews({ category: 'tech', limit: 10 })
    expect(items[0]!.pubDate).toBe('2024-01-01 08:30')
  })

  it('keyword 过滤生效', async () => {
    installFetch((u) => {
      if (u.includes('rss2json')) {
        return {
          ok: true,
          json: () => ({
            status: 'ok',
            items: [
              { title: 'A - 源', author: '源', link: 'https://a', pubDate: '2024-01-01T10:00:00Z', description: 'd' },
              { title: 'B - 源', author: '源', link: 'https://b', pubDate: '2024-01-01T10:00:00Z', description: 'd' },
            ],
          }),
        }
      }
      return { ok: false }
    })
    const items = await fetchNews({ category: 'tech', limit: 10, keyword: 'B' })
    expect(items.length).toBe(1)
    expect(items[0]!.title).toBe('B')
  })

  it('NEWS_CATEGORIES 非空且 findCategory 兜底到头条', () => {
    expect(NEWS_CATEGORIES.length).toBeGreaterThan(0)
    expect(findCategory('not-exist').key).toBe('top')
    expect(fetchNewsAll).toBeTypeOf('function')
  })
})
