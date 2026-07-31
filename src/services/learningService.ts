// 学习中心数据层 — 全部免费、可降级。
//  - 学位英语：Free Dictionary API（免费无 key）
//  - 书籍阅读：Project Gutenberg（gutendex.com 免费 API）
//  - 各行业知识：内置知识库 + 已配置 AI 答疑
//  - AI 答疑：复用 callAi

import { fetchCorsJson, fetchCorsText } from './freeApi'
import { callAi, type AiConfig } from './aiService'

/* ===================== 学位英语 ===================== */

export interface WordMeaning {
  partOfSpeech: string
  definitions: { definition: string; example?: string }[]
}
export interface WordDefinition {
  word: string
  phonetics: { text?: string; audio?: string }[]
  meanings: WordMeaning[]
}

/** 查词（Free Dictionary API，免费无 key） */
export async function fetchDefinition(word: string): Promise<WordDefinition | null> {
  try {
    const data = await fetchCorsJson<WordDefinition[]>(
      `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word.trim().toLowerCase())}`
    )
    if (Array.isArray(data) && data.length) return data[0] ?? null
  } catch {
    /* 忽略，返回 null 由调用方降级 */
  }
  return null
}

/** 用已配置 AI 通俗讲解单词（面向学位英语/考研备考） */
export async function explainWord(word: string, def: WordDefinition | null, cfg: AiConfig): Promise<string> {
  const base = def ? JSON.stringify(def.meanings?.slice(0, 3)) : '（词典未返回释义）'
  const prompt =
    `请用通俗易懂的中文解释英文单词 "${word}"，面向学位英语/考研备考人群。\n` +
    `已知词典释义：${base}\n` +
    `请输出：1) 中文释义；2) 常见搭配（2-3 个）；3) 一个易记例句（含中英文）；4) 记忆小贴士。控制在 200 字内。`
  return callAi(cfg, prompt)
}

/* ===================== 各行业知识 ===================== */

export interface IndustryTopic {
  name: string
  desc: string
  keyPoints: string[]
}

/** 各行业知识库（零网络依赖，AI 可在此基础上追问） */
export const INDUSTRY_KNOWLEDGE: IndustryTopic[] = [
  {
    name: '人工智能',
    desc: '研究如何让机器模拟人类智能的学科，含机器学习、深度学习、自然语言处理等方向。',
    keyPoints: ['机器学习：从数据中自动学习规律', '大模型：以 Transformer 为主的生成式 AI', '应用：推荐、风控、客服、创作']
  },
  {
    name: '新能源汽车',
    desc: '采用新型动力系统的汽车，含纯电、插混、增程，核心在电池与电控。',
    keyPoints: ['三电：电池/电机/电控', '补能：充电与换电', '趋势：智能化与电动化融合']
  },
  {
    name: '金融理财',
    desc: '对资产进行规划、投资与风险管理，实现保值增值。',
    keyPoints: ['复利：时间带来的指数增长', '资产配置：分散风险', '风险与收益成正比']
  },
  {
    name: '医疗健康',
    desc: '维护与促进健康的科学，含预防、诊断、治疗与康复。',
    keyPoints: ['三级预防：未病先防', '循证医学：以证据为准', '健康生活方式是基础']
  },
  {
    name: '编程开发',
    desc: '用编程语言让计算机按预期工作的过程，是现代数字社会的基础技能。',
    keyPoints: ['算法与数据结构是核心', '版本控制（Git）协作必备', '持续学习新技术']
  },
  {
    name: '法律常识',
    desc: '规范社会行为的规则体系，了解基础法律可更好保护自身权益。',
    keyPoints: ['合同法：约定双方权利义务', '民法典：民事关系总典', '证据意识很重要']
  }
]

/** 用已配置 AI 通俗讲解行业/专业知识点（零基础向） */
export async function explainTopic(topic: string, cfg: AiConfig): Promise<string> {
  const prompt =
    `请用通俗中文讲解「${topic}」这一行业/专业知识，面向零基础学习者：\n` +
    `1) 一句话定义；2) 核心要点（3 条）；3) 一个生活化类比；4) 常见误区。控制在 250 字内，不要编造未经证实的数据。`
  return callAi(cfg, prompt)
}

/* ===================== 书籍阅读（Project Gutenberg） ===================== */

export interface GutenbergBook {
  id: number
  title: string
  authors: { name: string }[]
  formats: Record<string, string>
  download_count: number
  subjects?: string[]
  languages?: string[]
}
export interface BookSearchResult {
  count: number
  next: string | null
  previous: string | null
  results: GutenbergBook[]
}

/** 检索古登堡计划免费电子书（gutendex API，免费无 key） */
export async function fetchBooks(query: string, page = 1): Promise<BookSearchResult> {
  const q = query.trim()
  const url = q
    ? `https://gutendex.com/books/?search=${encodeURIComponent(q)}&page=${page}`
    : `https://gutendex.com/books/?page=${page}`
  try {
    const data = await fetchCorsJson<BookSearchResult>(url)
    if (data && Array.isArray(data.results)) return data
  } catch {
    /* 忽略，返回空 */
  }
  return { count: 0, next: null, previous: null, results: [] }
}

/** 选取适合在线阅读的纯文本 URL */
export function pickTextUrl(book: GutenbergBook): string | null {
  return (
    book.formats['text/plain; charset=utf-8'] ||
    book.formats['text/plain; charset=us-ascii'] ||
    book.formats['text/plain'] ||
    null
  )
}
export function pickEpubUrl(book: GutenbergBook): string | null {
  return book.formats['application/epub+zip'] || null
}

/** 拉取书籍正文（限制长度，避免超大文件卡顿） */
export async function fetchBookText(textUrl: string, maxBytes = 80000): Promise<string> {
  return fetchCorsText(textUrl, { maxBytes })
}
