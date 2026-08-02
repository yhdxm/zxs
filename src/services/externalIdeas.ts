// 外部灵感聚合服务（需求收集页 M5）
// 数据来源（全部免费、前端直连、无需 Key、国内可访问）：
//   - GitHub 公开 Search API（api.github.com，CORS 开放、免鉴权）
//     搜索近期高星仓库作为「需求 / 创意」灵感来源。
// 单源失败不影响整体；结果归一化为 ExternalIdea[] 后落库 external_ideas（带本地兜底）。
// 注意：GitHub 匿名接口限速 60 次/小时，频繁刷新可能临时受限，失败会优雅降级。

import { supabase } from './appDataService'

export type RelatedModule = 'todo' | 'point' | 'content' | null
/** 来源地区：国内 / 国外 / 通用（不区分） */
export type IdeaRegion = '国内' | '国外' | '通用'

export interface ExternalIdea {
  id: string
  user_id: string
  source: string // Hacker News / Dev.to / Product Hunt / Reddit / RSS:xxx
  title: string
  url: string
  summary: string
  /** 中文意思 / 理解：用通俗中文说明这是什么、能怎么用，便于非技术背景快速理解 */
  cnMeaning?: string
  /** 来源地区：国内 / 国外 / 通用 */
  region?: IdeaRegion
  /** 行业分类：如 前端框架 / AI·大模型 / 电商 / 教育 等 */
  industry?: string
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
  region?: IdeaRegion
  industry?: string
}

const LOCAL_KEY = 'external_ideas_cache'
const FETCH_TIMEOUT = 6000

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
    fetchGitHubRepos('stars:%3E1000+pushed:%3E2025-01-01', 20, '需求 / 创意'),
    fetchGitHubRepos('topic:ai+stars:%3E300', 15, 'AI / 大模型')
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
  const mapped = deduped.map((it) => ({
    id: genId(),
    user_id: '',
    source: it.source,
    title: it.title,
    url: it.url,
    summary: it.summary,
    cnMeaning: undefined as string | undefined,
    region: it.region ?? ('国外' as IdeaRegion),
    industry: it.industry ?? (it.tags.find((t) => t.includes('/') || t.includes('·')) || undefined),
    tags: it.tags,
    fetched_at: now,
    bookmarked: false,
    related_module: null as RelatedModule
  }))

  // GitHub 匿名接口限速（60 次/小时）或网络受限时，返回一份「真实热门开源项目」种子，
  // 保证需求收集页在抓取失败时不空白（数据源缺失属常态，非错误）。
  if (mapped.length === 0) {
    return buildSeedIdeas()
  }
  return mapped
}

/**
 * 真实热门开源项目种子（用于 GitHub 抓取失败/限速时的兜底）。
 * 全部为公开高星仓库，url 指向真实主页，可正常点击。
 */
const SEED_REPOS: Array<{
  owner: string
  name: string
  lang: string
  desc: string
  tag: string
  /** 中文意思 / 理解：通俗说明这是什么、能怎么用 */
  cnMeaning: string
  /** 来源地区 */
  region: IdeaRegion
  /** 行业分类 */
  industry: string
}> = [
  // ===== 国内（中国团队 / 中国开源） =====
  { owner: 'alibaba', name: 'ant-design-vue', lang: 'TypeScript', desc: 'Ant Design 的 Vue 实现，企业级中后台 UI 组件库。', tag: 'UI 组件库',
    cnMeaning: '阿里开源的 Vue 版 Ant Design 组件库，国内中后台管理系统的主流选型，提供丰富表单、表格与导航组件，能直接复用其交互与样式规范。', region: '国内', industry: 'UI 组件库' },
  { owner: 'Tencent', name: 'tdesign-vue', lang: 'TypeScript', desc: '腾讯开源的企业级设计体系与 Vue 组件库。', tag: 'UI 组件库',
    cnMeaning: '腾讯出品的设计语言 TDesign 的 Vue 实现，覆盖桌面与移动端，适合做统一风格的企业产品界面。', region: '国内', industry: 'UI 组件库' },
  { owner: 'jdf2e', name: 'nutui', lang: 'Vue', desc: '京东风格的移动端组件库，支持 Vue 与 React。', tag: 'UI 组件库',
    cnMeaning: '京东开源的移动端组件库，电商类 App 与小程序常用，组件贴合国内购物场景。', region: '国内', industry: 'UI 组件库' },
  { owner: 'arco-design', name: 'arco-design-vue', lang: 'TypeScript', desc: '字节跳动开源的企业级设计系统与 Vue 组件库。', tag: 'UI 组件库',
    cnMeaning: '字节跳动出品，设计精致、文档完善，适合中后台与数据类产品快速搭界面。', region: '国内', industry: 'UI 组件库' },
  { owner: 'baidu', name: 'amis', lang: 'TypeScript', desc: '百度开源的低代码前端框架，用 JSON 配置生成页面。', tag: '低代码',
    cnMeaning: '百度开源的低代码方案：用一份 JSON 配置就能生成表单、列表、详情页，能大幅减少中后台页面的重复开发。', region: '国内', industry: '低代码' },
  { owner: 'pingcap', name: 'tidb', lang: 'Go', desc: '开源分布式关系型数据库，兼容 MySQL 协议。', tag: '数据库',
    cnMeaning: 'PingCAP 开源的国产分布式数据库，水平扩展能力强，适合海量数据与高并发业务，是去 Oracle/MySQL 分库分表的替代方案。', region: '国内', industry: '数据库' },
  { owner: 'xuxueli', name: 'xxl-job', lang: 'Java', desc: '分布式任务调度平台，轻量易用。', tag: 'DevOps',
    cnMeaning: '大众点评许雪里开源的定时任务调度平台，能集中管理成百上千个定时任务，国内 Java 团队常用。', region: '国内', industry: 'DevOps' },
  { owner: 'apache', name: 'dubbo', lang: 'Java', desc: '高性能 Java RPC 微服务框架。', tag: '微服务',
    cnMeaning: '阿里贡献给 Apache 的微服务框架，解决服务间远程调用、注册发现与治理，是国内大型 Java 系统的常见底座。', region: '国内', industry: '微服务' },
  { owner: 'THUDM', name: 'chatglm', lang: 'Python', desc: '智谱 AI 开源的中英双语对话大模型。', tag: 'AI / 大模型',
    cnMeaning: '清华系智谱 AI 开源的大语言模型，中文能力强、可私有化部署，适合做企业内问答、客服与知识库问答。', region: '国内', industry: 'AI·大模型' },
  { owner: 'QwenLM', name: 'Qwen', lang: 'Python', desc: '阿里巴巴通义千问开源大模型系列。', tag: 'AI / 大模型',
    cnMeaning: '阿里通义千问开源模型家族，覆盖不同参数量，支持微调与本地部署，是中文场景落地大模型的热门选择。', region: '国内', industry: 'AI·大模型' },
  { owner: 'InternLM', name: 'InternLM', lang: 'Python', desc: '上海人工智能实验室开源的书生·浦语大模型。', tag: 'AI / 大模型',
    cnMeaning: '上海 AI Lab 开源的大模型，配套工链完善（数据、训练、部署），适合科研与行业模型二次开发。', region: '国内', industry: 'AI·大模型' },
  { owner: 'PKUanonym', name: 'REKCARC-TSC-UHT', lang: 'Unknown', desc: '清华大学计算机系课程攻略，覆盖课程笔记与考试经验。', tag: '学习资源',
    cnMeaning: '清华学生自发维护的计算机系课程攻略仓库，含课件、笔记与考题经验，是计算机自学者的宝藏资料。', region: '国内', industry: '学习资源' },
  { owner: 'CyC2018', name: 'CS-Notes', lang: 'Java', desc: '技术面试必备基础知识（计算机/网络/操作系统/算法）。', tag: '学习资源',
    cnMeaning: '广受好评的中文面试复习资料，系统梳理计网、OS、Java、算法，求职者刷题背书常用。', region: '国内', industry: '学习资源' },
  { owner: 'jaywcjlove', name: 'linux-command', lang: 'HTML', desc: 'Linux 命令在线手册，中文检索便捷。', tag: '效率工具',
    cnMeaning: '中文 Linux 命令查询手册，每个命令配示例，运维与开发查命令时很方便，可当速查工具嵌入产品。', region: '国内', industry: '效率工具' },

  // ===== 国外（国际开源 / 海外团队） =====
  { owner: 'vuejs', name: 'vue', lang: 'TypeScript', desc: '渐进式 JavaScript 框架，易学易用、性能出色。', tag: '前端框架',
    cnMeaning: 'Vue 是一套用于构建用户界面的渐进式框架，学习曲线平缓、生态丰富，是国内外中后台与移动端项目的常见选型。', region: '国外', industry: '前端框架' },
  { owner: 'facebook', name: 'react', lang: 'JavaScript', desc: '用于构建用户界面的声明式 JavaScript 库。', tag: '前端框架',
    cnMeaning: 'React 由 Meta 维护，生态最庞大，组件化与虚拟 DOM 思想影响整个前端行业，适合大型应用与跨端。', region: '国外', industry: '前端框架' },
  { owner: 'vercel', name: 'next.js', lang: 'TypeScript', desc: '基于 React 的全栈框架，支持 SSR/SSG。', tag: '前端框架',
    cnMeaning: 'Next.js 是 React 的全栈框架，自带服务端渲染、静态生成与路由，适合做 SEO 友好的内容与电商站点。', region: '国外', industry: '前端框架' },
  { owner: 'vitejs', name: 'vite', lang: 'TypeScript', desc: '下一代前端构建工具，极速冷启动与热更新。', tag: '前端工程化',
    cnMeaning: 'Vite 用原生 ESM 做开发服务器，启动与热更新极快，已成为 Vue/React 项目的主流构建底座。', region: '国外', industry: '前端工程化' },
  { owner: 'tailwindlabs', name: 'tailwindcss', lang: 'TypeScript', desc: '原子化 CSS 框架，高效构建自定义界面。', tag: '前端工程化',
    cnMeaning: 'Tailwind 用原子类直接在模板里写样式，开发快、风格统一，适合做设计系统驱动的前端。', region: '国外', industry: '前端工程化' },
  { owner: 'microsoft', name: 'TypeScript', lang: 'TypeScript', desc: 'JavaScript 的类型化超集，大型项目首选。', tag: '前端工程化',
    cnMeaning: 'TypeScript 给 JS 加上类型系统，能在大项目里提前发现错误，是现代化前端与 Node 服务的标配。', region: '国外', industry: '前端工程化' },
  { owner: 'supabase', name: 'supabase', lang: 'TypeScript', desc: '开源的 Firebase 替代方案，提供 Postgres、Auth 与实时能力。', tag: '后端即服务',
    cnMeaning: 'Supabase 提供开箱即用的数据库、登录鉴权、文件存储与实时订阅，小团队可零后端快速做出可用产品。', region: '国外', industry: '后端即服务' },
  { owner: 'langchain-ai', name: 'langchain', lang: 'Python', desc: '大模型应用开发框架，串联检索、工具与 Agent。', tag: 'AI / 大模型',
    cnMeaning: 'LangChain 把大模型、知识库检索、工具调用串成流水线，是做 AI 应用（问答、Agent）最流行的开发框架。', region: '国外', industry: 'AI·大模型' },
  { owner: 'ollama', name: 'ollama', lang: 'Go', desc: '本地运行大语言模型的工具，一行命令拉起模型。', tag: 'AI / 大模型',
    cnMeaning: 'Ollama 让你在本机一键跑开源大模型，无需联网与付费，适合做隐私敏感或离线的 AI 功能原型。', region: '国外', industry: 'AI·大模型' },
  { owner: 'apache', name: 'echarts', lang: 'TypeScript', desc: '强大的开源可视化图表库，覆盖各类数据大屏。', tag: '数据可视化',
    cnMeaning: 'ECharts 由百度贡献给 Apache，图表类型极全、性能好，是国内外数据大屏与报表系统的标配。', region: '国内', industry: '数据可视化' },
  { owner: 'nocodb', name: 'nocodb', lang: 'TypeScript', desc: '开源 Airtable 替代方案，把数据库变成智能表格。', tag: '低代码',
    cnMeaning: 'NocoDB 把任意数据库包装成在线表格，非技术人员也能增删改查，适合做轻量内部工具与需求台账。', region: '国外', industry: '低代码' },
  { owner: 'twentyhq', name: 'twenty', lang: 'TypeScript', desc: '开源 CRM，替代 Salesforce 的现代客户关系管理。', tag: '企业应用',
    cnMeaning: 'Twenty 是开源的客户关系管理（CRM），可自托管，适合中小企业管理客户、商机与销售流程。', region: '国外', industry: '企业应用' },
  { owner: 'darktable', name: 'darktable', lang: 'C', desc: '开源摄影后期处理与 Raw 管理软件。', tag: '图像处理',
    cnMeaning: 'darktable 是开源的摄影后期与 Raw 处理软件，功能接近 Lightroom，适合做图像编辑类需求参考。', region: '国外', industry: '图像处理' },
  { owner: 'obsidianmd', name: 'obsidian-releases', lang: 'Unknown', desc: '本地优先的知识管理笔记应用发行仓库。', tag: '效率工具',
    cnMeaning: 'Obsidian 是本地优先的双向链接笔记软件，适合做知识库、个人 Wiki 类产品形态参考。', region: '国外', industry: '效率工具' }
]

function buildSeedIdeas(): ExternalIdea[] {
  const now = new Date().toISOString()
  return SEED_REPOS.map((r) => ({
    id: genId(),
    user_id: '',
    source: '热门推荐',
    title: `${r.owner}/${r.name}`,
    url: `https://github.com/${r.owner}/${r.name}`,
    summary: r.desc,
    cnMeaning: r.cnMeaning,
    region: r.region,
    industry: r.industry,
    tags: Array.from(new Set([r.lang, r.tag, r.industry, r.region].filter(Boolean))),
    fetched_at: now,
    bookmarked: false,
    related_module: null
  }))
}

/**
 * 默认灵感数据（零网络依赖、国内可达，确保需求收集页永不空白）。
 * 同时覆盖国内 / 国外项目，并标注「中文意思/理解」与「行业分类」，便于按地区与行业筛选灵感。
 */
export function getDefaultIdeas(): ExternalIdea[] {
  return buildSeedIdeas()
}

/**
 * 从 GitHub 公开 Search API 拉取高星仓库作为灵感来源（国内可直连、CORS 开放、免鉴权）。
 * query 形如 `stars:%3E1000+pushed:%3E2025-01-01`；topic 用于打标签。
 * 匿名限速 60 次/小时，超限返回空（由上层提示）。
 */
async function fetchGitHubRepos(query: string, perPage: number, topicTag: string): Promise<FetchedItem[]> {
  try {
    const url = `https://api.github.com/search/repositories?q=${query}&sort=stars&order=desc&per_page=${perPage}`
    const res = await timeoutFetch(url, {
      headers: { Accept: 'application/vnd.github+json' }
    })
    if (!res.ok) {
      if (res.status === 403) {
        console.warn('[externalIdeas] GitHub 限速（60/h），稍后重试')
      }
      return []
    }
    const data = (await res.json().catch(() => ({}))) as {
      items?: Array<Record<string, unknown>>
    }
    return (data.items || []).map((r) => {
      const owner = (r.owner as Record<string, unknown> | undefined)?.login || 'github'
      const name = String(r.name || 'repo')
      const lang = typeof r.language === 'string' && r.language ? r.language : ''
      return {
        source: 'GitHub',
        title: `${owner}/${name}`,
        url: String(r.html_url || `https://github.com/${owner}/${name}`),
        summary: summarize(String(r.description || ''), 140),
        tags: Array.from(new Set([lang, topicTag].filter(Boolean))) as string[],
        region: '国外' as IdeaRegion,
        industry: topicTag
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

/** 将任意来源的一行（Supabase / 本地）规范化为稳定的 ExternalIdea，避免渲染异常 */
export function normalizeExternalIdea(input: unknown): ExternalIdea {
  const raw = (input ?? {}) as Partial<ExternalIdea> & Record<string, unknown>
  let tags: string[] = []
  const rawTags: unknown = raw.tags
  if (Array.isArray(rawTags)) {
    tags = rawTags.filter((t): t is string => typeof t === 'string')
  } else if (typeof rawTags === 'string' && rawTags.trim()) {
    // Supabase 可能以 `{a,b}` 原生数组或 JSON 字符串形式返回
    const s = rawTags.trim()
    if (s.startsWith('[')) {
      try {
        const arr: unknown = JSON.parse(s)
        if (Array.isArray(arr)) tags = arr.filter((t: unknown): t is string => typeof t === 'string')
      } catch {
        tags = []
      }
    } else if (s.startsWith('{')) {
      tags = s
        .slice(1, -1)
        .split(',')
        .map((t: string) => t.trim())
        .filter(Boolean)
    } else {
      tags = [s]
    }
  }

  return {
    id: String(raw.id || `ext-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`),
    user_id: String(raw.user_id || ''),
    source: String(raw.source || '未知来源'),
    title: String(raw.title || '无标题'),
    url: String(raw.url || ''),
    summary: String(raw.summary || ''),
    cnMeaning: raw.cnMeaning == null ? undefined : String(raw.cnMeaning),
    region: (raw.region as IdeaRegion) || undefined,
    industry: raw.industry == null ? undefined : String(raw.industry),
    tags,
    fetched_at: String(raw.fetched_at || new Date().toISOString()),
    bookmarked: Boolean(raw.bookmarked),
    related_module: (raw.related_module as RelatedModule) ?? null,
    raw: (raw.raw as Record<string, unknown> | undefined) ?? undefined
  }
}

/** 读取灵感列表：优先 Supabase，失败回退本地缓存；结果统一规范化 */
export async function loadExternalIdeas(userId: string): Promise<ExternalIdea[]> {
  if (!userId) return readLocalCache().map(normalizeExternalIdea)
  try {
    const { data, error } = await supabase
      .from('external_ideas')
      .select('*')
      .eq('user_id', userId)
      .order('fetched_at', { ascending: false })
    if (error) {
      console.warn('[externalIdeas] 读取失败，回退本地', error.message)
      return readLocalCache().map(normalizeExternalIdea)
    }
    const rows = Array.isArray(data) ? (data as unknown[]) : []
    // 表未建立 / 字段缺失时规范化兜底，避免白屏
    return rows.map((r) => normalizeExternalIdea(r as Partial<ExternalIdea> & Record<string, unknown>))
  } catch (e) {
    console.warn('[externalIdeas] 读取异常，回退本地', e)
    return readLocalCache().map(normalizeExternalIdea)
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
      cnMeaning: it.cnMeaning ?? null,
      region: it.region ?? null,
      industry: it.industry ?? null,
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

/* ============ 缓存管理（Fix #3）：单条删除 / 清空全部 / 保留天数自动清理 ============ */

const RETENTION_KEY = 'external_ideas_retention_days'
const DEFAULT_RETENTION_DAYS = 30

/** 读取保留天数（默认 30 天） */
export function getRetentionDays(): number {
  if (typeof window === 'undefined') return DEFAULT_RETENTION_DAYS
  try {
    const raw = window.localStorage.getItem(RETENTION_KEY)
    if (!raw) return DEFAULT_RETENTION_DAYS
    const n = Number(raw)
    return Number.isFinite(n) && n >= 1 && n <= 365 ? n : DEFAULT_RETENTION_DAYS
  } catch {
    return DEFAULT_RETENTION_DAYS
  }
}

/** 写入保留天数 */
export function setRetentionDays(days: number): void {
  if (typeof window === 'undefined') return
  const n = Math.max(1, Math.min(365, Math.floor(days)))
  try {
    window.localStorage.setItem(RETENTION_KEY, String(n))
  } catch {
    /* 忽略 */
  }
}

/** 删除单条灵感（Supabase + 本地缓存） */
export async function deleteExternalIdea(userId: string, id: string): Promise<void> {
  if (userId) {
    try {
      const { error } = await supabase.from('external_ideas').delete().eq('user_id', userId).eq('id', id)
      if (error) console.warn('[externalIdeas] 删除失败', error.message)
    } catch (e) {
      console.warn('[externalIdeas] 删除异常', e)
    }
  }
  const cache = readLocalCache().filter((it) => it.id !== id)
  writeLocalCache(cache)
}

/** 清空全部灵感缓存（Supabase + 本地缓存） */
export async function clearExternalIdeas(userId: string): Promise<void> {
  if (userId) {
    try {
      const { error } = await supabase.from('external_ideas').delete().eq('user_id', userId)
      if (error) console.warn('[externalIdeas] 清空失败', error.message)
    } catch (e) {
      console.warn('[externalIdeas] 清空异常', e)
    }
  }
  try {
    if (typeof window !== 'undefined') window.localStorage.removeItem(LOCAL_KEY)
  } catch {
    /* 忽略 */
  }
}

/**
 * 按保留天数裁剪：返回保留（未过期）的列表。
 * 以 fetched_at 为基准，超过 days 天的视为过期。
 */
export function pruneExternalIdeas(items: ExternalIdea[], days: number): ExternalIdea[] {
  const cutoff = Date.now() - days * 86400000
  return items.filter((it) => {
    const t = new Date(it.fetched_at).getTime()
    return Number.isFinite(t) && t >= cutoff
  })
}

/**
 * 清理过期灵感（Fix #3）：保留天数之外的删除。
 * 先本地裁剪并写回，再尽力同步 Supabase（按 fetched_at < cutoff 删除）。
 * @returns 实际清理的条数
 */
export async function cleanupExpiredExternalIdeas(userId: string, days: number): Promise<number> {
  const cutoffIso = new Date(Date.now() - days * 86400000).toISOString()
  // 本地先裁剪
  const cache = readLocalCache()
  const kept = pruneExternalIdeas(cache, days)
  const removed = cache.length - kept.length
  writeLocalCache(kept)

  if (userId) {
    try {
      const { error } = await supabase.from('external_ideas').delete().eq('user_id', userId).lt('fetched_at', cutoffIso)
      if (error) console.warn('[externalIdeas] 过期清理同步失败', error.message)
    } catch (e) {
      console.warn('[externalIdeas] 过期清理同步异常', e)
    }
  }
  return removed
}
