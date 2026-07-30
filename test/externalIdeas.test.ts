import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { fetchExternalIdeas } from '../src/services/externalIdeas'

// ---- mock fetch：按 URL 返回各源的桩数据 ----
function makeFetch(handlers: Record<string, () => unknown>) {
  return vi.fn(async (url: string | URL) => {
    const u = String(url)
    for (const [key, fn] of Object.entries(handlers)) {
      if (u.includes(key)) {
        const body = fn()
        // 返回既支持 .json() 又支持 .text() 的响应
        return {
          ok: true,
          status: 200,
          json: async () => body,
          text: async () => (typeof body === 'string' ? body : JSON.stringify(body)),
        } as unknown as Response
      }
    }
    return { ok: false, status: 404, json: async () => ({}), text: async () => '' } as unknown as Response
  })
}

describe('M5 外部灵感字段归一化（HN/Dev.to/Reddit/PH）', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('四源均归一化为完整 ExternalIdea 结构', async () => {
    const fetchMock = makeFetch({
      'hn.algolia.com': () => ({
        hits: [{ title: 'HN 标题', url: 'https://hn.example/1', story_text: 'HN 正文摘要' }],
      }),
      'dev.to': () => [
        { title: 'Dev 标题', url: 'https://dev.example/1', description: 'Dev 描述', tag_list: ['js', 'vue'] },
      ],
      'reddit.com': () => ({
        data: { children: [{ data: { title: 'R 标题', url: 'https://reddit.example/1', selftext: 'R 正文' } }] },
      }),
      'producthunt': () =>
        '<rss><channel><item><title>PH 标题</title><link>https://ph.example/1</link><description>PH 描述</description></item></channel></rss>',
    })
    vi.stubGlobal('fetch', fetchMock)

    const ideas = await fetchExternalIdeas()

    expect(ideas.length).toBe(4)
    const sources = ideas.map((i) => i.source).sort()
    expect(sources).toEqual(['Dev.to', 'Hacker News', 'Product Hunt', 'Reddit'])

    for (const it of ideas) {
      expect(typeof it.id).toBe('string')
      expect(it.id.length).toBeGreaterThan(0)
      expect(it.user_id).toBe('')
      expect(typeof it.title).toBe('string')
      expect(it.title.length).toBeGreaterThan(0)
      expect(typeof it.url).toBe('string')
      expect(Array.isArray(it.tags)).toBe(true)
      expect(typeof it.summary).toBe('string')
      expect(it.bookmarked).toBe(false)
      expect(it.related_module).toBeNull()
      // fetched_at 应为当前时刻附近的有效 ISO
      const t = new Date(it.fetched_at).getTime()
      expect(Number.isNaN(t)).toBe(false)
      expect(Math.abs(t - Date.now())).toBeLessThan(10000)
    }

    const hn = ideas.find((i) => i.source === 'Hacker News')!
    expect(hn.title).toBe('HN 标题')
    expect(hn.url).toBe('https://hn.example/1')
    expect(hn.tags).toEqual(['技术', '创业'])

    const dev = ideas.find((i) => i.source === 'Dev.to')!
    expect(dev.url).toBe('https://dev.example/1')
    expect(dev.tags).toEqual(['js', 'vue'])
  })

  it('缺失字段有兜底：无标题/无链接/无标签/无摘要 不崩溃', async () => {
    const fetchMock = makeFetch({
      'hn.algolia.com': () => ({ hits: [{ objectID: 'abc123' }] }), // 无 title/url
      'dev.to': () => [{ title: 'D2', url: 'https://dev.example/2' }], // 无 tag_list / 无 description
      'reddit.com': () => ({
        data: { children: [{ data: { title: 'R2', permalink: '/r/x/2' } }] }, // 无 url，有 permalink
      }),
      'producthunt': () => '<rss><channel><item><title>P2</title></item></channel></rss>', // 无 link
    })
    vi.stubGlobal('fetch', fetchMock)

    const ideas = await fetchExternalIdeas()
    const bySource = Object.fromEntries(ideas.map((i) => [i.source, i]))

    // HN：无标题 → '无标题'；无 url → 用 objectID 兜底
    expect(bySource['Hacker News'].title).toBe('无标题')
    expect(bySource['Hacker News'].url).toContain('abc123')

    // Dev.to：无 tag_list → 默认 ['开发']；无 description → summary 回退到 title（源码：description || title）
    expect(bySource['Dev.to'].tags).toEqual(['开发'])
    expect(bySource['Dev.to'].summary).toBe('D2')

    // Reddit：无 url 但有 permalink → 路径兜底
    expect(bySource['Reddit'].url).toBe('https://reddit.com/r/x/2')

    // PH：无 link → url 空串（不抛错）
    expect(bySource['Product Hunt'].url).toBe('')
    expect(bySource['Product Hunt'].title).toBe('P2')
  })

  it('去重：同 url 只保留首条', async () => {
    const fetchMock = makeFetch({
      'hn.algolia.com': () => ({
        hits: [
          { title: 'A', url: 'https://dup.example', objectID: '1' },
          { title: 'B', url: 'https://dup.example', objectID: '2' },
        ],
      }),
      'dev.to': () => [{ title: 'C', url: 'https://unique.example' }],
      'reddit.com': () => ({ data: { children: [] } }),
      'producthunt': () => '<rss><channel></channel></rss>',
    })
    vi.stubGlobal('fetch', fetchMock)

    const ideas = await fetchExternalIdeas()
    const urls = ideas.map((i) => i.url)
    expect(urls.filter((u) => u === 'https://dup.example').length).toBe(1)
    expect(ideas.length).toBe(2) // 1 dup + 1 unique
  })
})
