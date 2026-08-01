// AI 前沿资讯多源聚合 —— 全部免费公开源，纯前端直连（带 CORS 代理兜底），零额度消耗。
// 源：Hugging Face Trending（国外）/ arXiv cs.CL（国外）/ 机器之心（国内）/ 量子位（国内）
// 单源失败只置灰该源，其余照常展示；全部失败时展示本地精选清单。

import { fetchCorsJson, fetchCorsText } from './freeApi'

export type NewsRegion = 'cn' | 'global'

export interface AiNewsItem {
  id: string
  title: string
  link: string
  /** 来源 key */
  sourceKey: string
  /** 来源展示名 */
  sourceLabel: string
  region: NewsRegion
  /** 已格式化 YYYY-MM-DD HH:mm */
  pubDate: string
  pubTs: number
  /** 摘要 */
  desc: string
}

export interface AiNewsSource {
  key: string
  label: string
  region: NewsRegion
  color: string
  /** 该源说明 */
  note: string
}

export interface AiNewsSourceResult {
  source: AiNewsSource
  ok: boolean
  count: number
  error: string
}

export interface AiNewsResult {
  items: AiNewsItem[]
  sources: AiNewsSourceResult[]
  /** 是否走了本地精选兜底 */
  fallback: boolean
  /** 抓取完成时间 */
  fetchedAt: string
}

export const AI_NEWS_SOURCES: AiNewsSource[] = [
  { key: 'hf', label: 'Hugging Face 趋势', region: 'global', color: '#f59e0b', note: '按热度排序的新模型，反映社区最新关注点' },
  { key: 'arxiv', label: 'arXiv cs.CL', region: 'global', color: '#6366f1', note: '计算语言学最新论文预印本' },
  { key: 'jqzx', label: '机器之心', region: 'cn', color: '#ef4444', note: '国内 AI 行业深度报道' },
  { key: 'qbitai', label: '量子位', region: 'cn', color: '#ec4899', note: '国内 AI 快讯与产品动态' }
]

function pad(n: number): string { return String(n).padStart(2, '0') }

function fmtTs(ts: number): string {
  if (!ts || isNaN(ts)) return ''
  const d = new Date(ts)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** 相对时间：刚刚 / X分钟前 / X小时前 / X天前 */
export function relTime(ts: number): string {
  if (!ts || isNaN(ts)) return ''
  const diff = Date.now() - ts
  if (diff < 60_000) return '刚刚'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} 分钟前`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} 小时前`
  if (diff < 30 * 86_400_000) return `${Math.floor(diff / 86_400_000)} 天前`
  return fmtTs(ts).slice(0, 10)
}

function stripHtml(s: string): string {
  if (!s) return ''
  return s
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

/** 通用 RSS / Atom 解析 */
function parseFeed(xml: string, src: AiNewsSource, limit: number): AiNewsItem[] {
  const doc = new DOMParser().parseFromString(xml, 'text/xml')
  const nodes = Array.from(doc.querySelectorAll('item, entry')).slice(0, limit)
  const out: AiNewsItem[] = []
  for (const n of nodes) {
    const title = stripHtml(n.querySelector('title')?.textContent || '')
    if (!title) continue
    const linkEl = n.querySelector('link')
    const link = (linkEl?.textContent || '').trim() || linkEl?.getAttribute('href') || ''
    const pubRaw =
      n.querySelector('pubDate')?.textContent?.trim() ||
      n.querySelector('published')?.textContent?.trim() ||
      n.querySelector('updated')?.textContent?.trim() ||
      n.querySelector('date')?.textContent?.trim() ||
      ''
    const ts = new Date(pubRaw).getTime() || Date.now()
    const desc = stripHtml(
      n.querySelector('description')?.textContent ||
      n.querySelector('summary')?.textContent ||
      n.querySelector('content')?.textContent ||
      ''
    ).slice(0, 180)
    out.push({
      id: `${src.key}-${link || title}`,
      title,
      link,
      sourceKey: src.key,
      sourceLabel: src.label,
      region: src.region,
      pubDate: fmtTs(ts),
      pubTs: ts,
      desc
    })
  }
  return out
}

interface HfTrendModel {
  id?: string
  likes?: number
  downloads?: number
  pipeline_tag?: string
  createdAt?: string
  lastModified?: string
}

/** Hugging Face 趋势模型（免费公共 API） */
async function loadHuggingFace(limit: number): Promise<AiNewsItem[]> {
  const src = AI_NEWS_SOURCES[0]!
  const data = await fetchCorsJson<HfTrendModel[]>(
    `https://huggingface.co/api/models?sort=trendingScore&direction=-1&limit=${limit}&full=false`
  )
  if (!Array.isArray(data) || !data.length) throw new Error('空数据')
  return data
    .filter((m) => m.id)
    .map((m) => {
      const ts = new Date(m.lastModified || m.createdAt || '').getTime() || Date.now()
      return {
        id: `hf-${m.id}`,
        title: m.id as string,
        link: `https://huggingface.co/${m.id}`,
        sourceKey: src.key,
        sourceLabel: src.label,
        region: src.region as NewsRegion,
        pubDate: fmtTs(ts),
        pubTs: ts,
        desc: `${m.pipeline_tag || '模型'} · ♥ ${m.likes ?? 0} · 下载 ${m.downloads ?? 0}`
      }
    })
}

/** arXiv cs.CL 最新论文 */
async function loadArxiv(limit: number): Promise<AiNewsItem[]> {
  const src = AI_NEWS_SOURCES[1]!
  const xml = await fetchCorsText('https://export.arxiv.org/rss/cs.CL', { maxBytes: 260000 })
  const items = parseFeed(xml, src, limit)
  if (!items.length) throw new Error('空数据')
  return items
}

/** 机器之心 RSS */
async function loadJqzx(limit: number): Promise<AiNewsItem[]> {
  const src = AI_NEWS_SOURCES[2]!
  const xml = await fetchCorsText('https://www.jiqizhixin.com/rss', { maxBytes: 260000 })
  const items = parseFeed(xml, src, limit)
  if (!items.length) throw new Error('空数据')
  return items
}

/** 量子位 RSS */
async function loadQbitai(limit: number): Promise<AiNewsItem[]> {
  const src = AI_NEWS_SOURCES[3]!
  const xml = await fetchCorsText('https://www.qbitai.com/feed', { maxBytes: 260000 })
  const items = parseFeed(xml, src, limit)
  if (!items.length) throw new Error('空数据')
  return items
}

const LOADERS: Record<string, (limit: number) => Promise<AiNewsItem[]>> = {
  hf: loadHuggingFace,
  arxiv: loadArxiv,
  jqzx: loadJqzx,
  qbitai: loadQbitai
}

/** 全部源不可用时的本地精选（静态，保证页面不空） */
function localFallback(): AiNewsItem[] {
  const base = Date.now()
  const seed: Array<{ t: string; d: string; r: NewsRegion; u: string }> = [
    { t: '如何用 Ollama 在本地跑开源大模型', d: '一条命令下载并运行 Llama / Qwen / Gemma，完全离线、零 API 费用，是入门本地部署的最快路径。', r: 'global', u: 'https://ollama.com' },
    { t: 'Hugging Face：开源模型生态的中心', d: '模型、数据集、Spaces 演示三件套，免费下载与托管，是追踪开源进展的第一站。', r: 'global', u: 'https://huggingface.co/models' },
    { t: 'Google AI Studio 免费 API Key', d: '注册即可获得 Gemini 系列的免费调用额度，是零成本体验一线闭源模型的主要通道。', r: 'global', u: 'https://aistudio.google.com' },
    { t: 'OpenRouter 免费模型端点清单', d: '带 :free 后缀的模型可长期免费调用，一个 Key 覆盖数十个开源模型。', r: 'global', u: 'https://openrouter.ai/models' },
    { t: 'DeepSeek-R1 开源推理模型', d: '完整开放思考过程与蒸馏小模型，1.5B~70B 可在个人电脑运行，学习推理机制的最佳样本。', r: 'cn', u: 'https://github.com/deepseek-ai/DeepSeek-R1' },
    { t: 'Qwen 全尺寸开源模型库', d: '从 0.6B 端侧到 235B MoE，Apache-2.0 协议可商用，国内微调生态最活跃的底座。', r: 'cn', u: 'https://github.com/QwenLM' },
    { t: '魔搭 ModelScope 免费推理', d: '国内可直连的模型社区，提供免费在线推理与 Notebook 算力，无需科学上网。', r: 'cn', u: 'https://modelscope.cn' },
    { t: 'OpenCompass 大模型评测榜单', d: '上海 AI 实验室维护的第三方评测体系，横向对比国内外模型能力的公开参考。', r: 'cn', u: 'https://rank.opencompass.org.cn' }
  ]
  return seed.map((s, i) => ({
    id: `local-${i}`,
    title: s.t,
    link: s.u,
    sourceKey: 'local',
    sourceLabel: '本地精选',
    region: s.r,
    pubDate: fmtTs(base - i * 3600_000),
    pubTs: base - i * 3600_000,
    desc: s.d
  }))
}

/**
 * 并行拉取全部源。单源失败不影响其他源；全部失败返回本地精选。
 * @param perSource 每个源最多取多少条
 */
export async function fetchAiNews(perSource = 12): Promise<AiNewsResult> {
  const results = await Promise.all(
    AI_NEWS_SOURCES.map(async (src): Promise<{ res: AiNewsSourceResult; items: AiNewsItem[] }> => {
      try {
        const items = await LOADERS[src.key]!(perSource)
        return { res: { source: src, ok: true, count: items.length, error: '' }, items }
      } catch (e) {
        return { res: { source: src, ok: false, count: 0, error: (e as Error).message || '抓取失败' }, items: [] }
      }
    })
  )
  const items = results.flatMap((r) => r.items).sort((a, b) => b.pubTs - a.pubTs)
  const sources = results.map((r) => r.res)
  const now = new Date()
  const fetchedAt = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`
  if (!items.length) {
    return { items: localFallback(), sources, fallback: true, fetchedAt }
  }
  return { items, sources, fallback: false, fetchedAt }
}
