import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { fetchNews, hasTianapiKey } from '../src/services/newsService'

const TIANDITU_KEY_STORE = 'zxs_free_apis'

describe('M9 免费新闻降级选择（天行 Key 存在走天行，缺失降级 RSS）', () => {
  let fetchedUrls: string[]

  beforeEach(() => {
    window.localStorage.clear()
    fetchedUrls = []
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  function installFetch() {
    const fn = vi.fn(async (url: string | URL) => {
      const u = String(url)
      fetchedUrls.push(u)
      if (u.includes('api.tianapi.com')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            code: 200,
            newslist: [
              // 不提供 source，验证回退默认值；title/url/pubDate 均提供
              { title: '天行新闻A', url: 'https://tx.example/1', pubDate: '2024-01-01 10:00' },
            ],
          }),
          text: async () => '',
        } as unknown as Response
      }
      if (u.includes('allorigins.win')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({}),
          text: async () =>
            '<rss><channel><item><title>RSS新闻A</title><link>https://rss.example/1</link><pubDate>2024-01-01 08:30</pubDate></item></channel></rss>',
        } as unknown as Response
      }
      return { ok: false, status: 500, json: async () => ({}), text: async () => '' } as unknown as Response
    })
    vi.stubGlobal('fetch', fn)
  }

  it('hasTianapiKey：有天行 Key 返回 true，缺失返回 false', () => {
    expect(hasTianapiKey()).toBe(false)
    window.localStorage.setItem(TIANDITU_KEY_STORE, JSON.stringify({ tianxing: 'TX-KEY' }))
    expect(hasTianapiKey()).toBe(true)
  })

  it('天行 Key 存在 → 走天行数据，不触发 RSS 降级', async () => {
    window.localStorage.setItem(TIANDITU_KEY_STORE, JSON.stringify({ tianxing: 'TX-KEY' }))
    installFetch()

    const items = await fetchNews({ limit: 10 })

    expect(items.length).toBeGreaterThan(0)
    expect(items[0]!.source).toBe('天行数据')
    expect(items[0]!.title).toBe('天行新闻A')
    // 关键分支：既已拿到天行数据，就不再请求 RSS 代理
    expect(fetchedUrls.some((u) => u.includes('allorigins.win'))).toBe(false)
  })

  it('天行 Key 缺失 → 降级到 RSS', async () => {
    installFetch() // 不写 tianxing key

    const items = await fetchNews({ limit: 10 })

    expect(fetchedUrls.some((u) => u.includes('allorigins.win'))).toBe(true)
    expect(items.length).toBeGreaterThan(0)
    expect(items[0]!.title).toBe('RSS新闻A')
    expect(['少数派', 'IT之家', '36氪', '知乎日报']).toContain(items[0]!.source)
  })

  it('pubDate 被规范化为 YYYY-MM-DD HH:mm', async () => {
    installFetch()
    const items = await fetchNews({ limit: 10 })
    expect(items[0]!.pubDate).toBe('2024-01-01 08:30')
  })
})
