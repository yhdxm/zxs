import { describe, it, expect, vi, afterEach } from 'vitest'
import { fetchExternalIdeas, normalizeExternalIdea } from '../src/services/externalIdeas'

// ---- mock fetch：按 URL 返回 GitHub Search 桩数据 ----
function makeFetch(handlers: Record<string, (url: string) => unknown>) {
  return vi.fn(async (url: string | URL) => {
    const u = String(url)
    for (const [key, fn] of Object.entries(handlers)) {
      if (u.includes(key)) {
        const body = fn(u)
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

describe('M5 外部灵感字段归一化（GitHub 公开 Search API）', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('GitHub 高星仓库归一化为完整 ExternalIdea 结构', async () => {
    const fetchMock = makeFetch({
      'api.github.com': () => ({
        items: [
          {
            owner: { login: 'vuejs' },
            name: 'vue',
            language: 'TypeScript',
            description: '渐进式框架',
            html_url: 'https://github.com/vuejs/vue',
          },
        ],
      }),
    })
    vi.stubGlobal('fetch', fetchMock)

    const ideas = await fetchExternalIdeas()

    expect(ideas.length).toBeGreaterThan(0)
    const it0 = ideas[0]!
    expect(it0.source).toBe('GitHub')
    expect(it0.user_id).toBe('')
    expect(typeof it0.id).toBe('string')
    expect(it0.id.length).toBeGreaterThan(0)
    expect(it0.title).toBe('vuejs/vue')
    expect(it0.url).toBe('https://github.com/vuejs/vue')
    expect(Array.isArray(it0.tags)).toBe(true)
    expect(it0.tags).toContain('TypeScript')
    expect(it0.bookmarked).toBe(false)
    expect(it0.related_module).toBeNull()
    expect(typeof it0.fetched_at).toBe('string')
    expect(Number.isNaN(new Date(it0.fetched_at).getTime())).toBe(false)
    // 默认从国外开源仓库抓取
    expect(it0.region).toBe('国外')
  })

  it('缺失字段兜底：无 owner/无 name/无语言/无描述 不崩溃', async () => {
    const fetchMock = makeFetch({
      'api.github.com': (u: string) => {
        if (u.includes('topic:ai')) {
          // 第二路查询：无 description 的条目，topicTag 为「AI / 大模型」
          return { items: [{ owner: { login: 'x' }, name: 'y', language: 'Go' }] }
        }
        // 第一路查询：无 owner / 无 name 的条目
        return { items: [{ name: 'repo-only' }, { owner: { login: 'only' } }] }
      },
    })
    vi.stubGlobal('fetch', fetchMock)

    const ideas = await fetchExternalIdeas()
    const byTitle = Object.fromEntries(ideas.map((i) => [i.title, i]))

    // 无 owner → 兜底 github
    expect(byTitle['github/repo-only'].url).toBe('https://github.com/github/repo-only')
    // 无 name → 兜底 repo
    expect(byTitle['only/repo'].url).toBe('https://github.com/only/repo')
    // 无 description → summary 空串
    expect(byTitle['x/y'].summary).toBe('')
    // 有语言 → tags 含 [语言, topicTag]
    expect(byTitle['x/y'].tags).toEqual(['Go', 'AI / 大模型'])
  })

  it('去重：同 url 只保留首条', async () => {
    const fetchMock = makeFetch({
      'api.github.com': (u: string) => {
        if (u.includes('topic:ai')) {
          return {
            items: [
              { owner: { login: 'a' }, name: 'dup', language: 'Go', description: 'd', html_url: 'https://dup.example' },
              { owner: { login: 'b' }, name: 'uniq', language: 'Python', description: 'u', html_url: 'https://unique.example' },
            ],
          }
        }
        return { items: [{ owner: { login: 'c' }, name: 'dup', language: 'Go', description: 'd', html_url: 'https://dup.example' }] }
      },
    })
    vi.stubGlobal('fetch', fetchMock)

    const ideas = await fetchExternalIdeas()
    const urls = ideas.map((i) => i.url)
    expect(urls.filter((u) => u === 'https://dup.example').length).toBe(1)
    expect(ideas.length).toBe(2) // 1 dup + 1 unique
  })

  it('GitHub 抓取失败（404/限流）→ 返回种子兜底，需求收集页永不空白', async () => {
    const fetchMock = makeFetch({}) // 命中 404 分支
    vi.stubGlobal('fetch', fetchMock)

    const ideas = await fetchExternalIdeas()
    expect(ideas.length).toBeGreaterThan(0)
    expect(ideas.every((i) => i.source === '热门推荐')).toBe(true)
    expect(ideas.every((i) => i.url.startsWith('https://github.com/'))).toBe(true)
    expect(ideas.every((i) => typeof i.cnMeaning === 'string' && i.cnMeaning!.length > 0)).toBe(true)
  })

  it('normalizeExternalIdea：兼容 Supabase 原生数组 / JSON 字符串 tags', () => {
    const a = normalizeExternalIdea({ id: '1', title: 't', source: 's', tags: '{a,b}', url: 'u' })
    expect(a.tags).toEqual(['a', 'b'])

    const b = normalizeExternalIdea({ id: '2', title: 't', source: 's', tags: ['x', 'y'], url: 'u' })
    expect(b.tags).toEqual(['x', 'y'])

    const c = normalizeExternalIdea({ title: '无标题', tags: '', url: '' })
    expect(c.title).toBe('无标题')
    expect(c.id).toBeTruthy()
    expect(c.bookmarked).toBe(false)
    expect(c.related_module).toBeNull()
  })
})
