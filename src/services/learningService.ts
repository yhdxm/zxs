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
    /* 忽略，返回兜底 */
  }
  return { count: BUILTIN_BOOKS.length, next: null, previous: null, results: BUILTIN_BOOKS }
}

/** 内置公版书兜底（古登堡 API 不可达时保证有书可读，均为真实古登堡 id + 直链） */
export const BUILTIN_BOOKS: GutenbergBook[] = [
  { id: 1342, title: 'Pride and Prejudice', authors: [{ name: 'Jane Austen' }], download_count: 99999, languages: ['en'], subjects: ['Fiction'], formats: { 'text/plain; charset=utf-8': 'https://www.gutenberg.org/files/1342/1342-0.txt' } },
  { id: 98, title: 'A Tale of Two Cities', authors: [{ name: 'Charles Dickens' }], download_count: 99999, languages: ['en'], subjects: ['Fiction'], formats: { 'text/plain; charset=utf-8': 'https://www.gutenberg.org/files/98/98-0.txt' } },
  { id: 1400, title: 'Great Expectations', authors: [{ name: 'Charles Dickens' }], download_count: 99999, languages: ['en'], subjects: ['Fiction'], formats: { 'text/plain; charset=utf-8': 'https://www.gutenberg.org/files/1400/1400-0.txt' } },
  { id: 11, title: "Alice's Adventures in Wonderland", authors: [{ name: 'Lewis Carroll' }], download_count: 99999, languages: ['en'], subjects: ['Fantasy'], formats: { 'text/plain; charset=utf-8': 'https://www.gutenberg.org/files/11/11-0.txt' } },
  { id: 244, title: 'A Study in Scarlet', authors: [{ name: 'Arthur Conan Doyle' }], download_count: 99999, languages: ['en'], subjects: ['Mystery'], formats: { 'text/plain; charset=utf-8': 'https://www.gutenberg.org/files/244/244-0.txt' } },
  { id: 2591, title: 'Grimms\' Fairy Tales', authors: [{ name: 'Jacob Grimm, Wilhelm Grimm' }], download_count: 99999, languages: ['en'], subjects: ['Fairy Tales'], formats: { 'text/plain; charset=utf-8': 'https://www.gutenberg.org/files/2591/2591-0.txt' } },
  { id: 2701, title: 'Moby-Dick; or, The Whale', authors: [{ name: 'Herman Melville' }], download_count: 99999, languages: ['en'], subjects: ['Fiction'], formats: { 'text/plain; charset=utf-8': 'https://www.gutenberg.org/files/2701/2701-0.txt' } },
  { id: 5200, title: 'Metamorphosis', authors: [{ name: 'Franz Kafka' }], download_count: 99999, languages: ['en'], subjects: ['Fiction'], formats: { 'text/plain; charset=utf-8': 'https://www.gutenberg.org/files/5200/5200-0.txt' } }
]

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

/* ===================== 学位英语：大纲知识库 + 学习计划 ===================== */

export interface EnglishOutlineItem {
  key: string
  name: string
  desc: string
  keyPoints: string[]
}

/**
 * 按《成人高等教育本科生学士学位英语水平考试大纲》（高等教育出版社第二版）分门别类。
 * 题型结构：完成对话 / 阅读理解 / 词汇与语法 / 完形填空 / 英译汉 / 写作。
 */
export const ENGLISH_OUTLINE: EnglishOutlineItem[] = [
  {
    key: 'dialogue',
    name: '会话技能（完成对话）',
    desc: '从备选选项中选出最符合语境的应答，考查日常交际用语与语用能力。',
    keyPoints: ['问候、介绍、告别', '邀约、道歉、道谢、请求', '打电话、问路与指路、购物就餐']
  },
  {
    key: 'vocabulary',
    name: '词汇（词语用法）',
    desc: '考查词语的辨析、搭配与语境中最恰当用词，约 3000 核心词汇量。',
    keyPoints: ['近义词/形近词辨析', '固定搭配与短语动词', '一词多义与熟词生义']
  },
  {
    key: 'grammar',
    name: '语法结构',
    desc: '考查时态语态、非谓语、从句、虚拟语气、主谓一致等核心语法点。',
    keyPoints: ['时态与被动语态', '非谓语动词（不定式/分词/动名词）', '定语从句/名词性从句/虚拟语气']
  },
  {
    key: 'reading',
    name: '阅读理解',
    desc: '考查快速获取主旨、细节、推理与作者态度，通常 4 篇，约 1000-1200 词。',
    keyPoints: ['主旨大意与标题', '细节定位与推理判断', '词义猜测与作者态度']
  },
  {
    key: 'cloze',
    name: '完形填空',
    desc: '一篇约 200 词短文挖空，综合考查词汇、语法与语篇逻辑。',
    keyPoints: ['语篇连贯与逻辑', '上下文线索复现', '固定搭配与常识']
  },
  {
    key: 'translation',
    name: '英译汉（翻译）',
    desc: '将一段英文（约 100-120 词）译成通顺准确的中文，考查理解与表达。',
    keyPoints: ['长难句拆分', '定语从句/非谓语的处理', '直译与意译的平衡']
  },
  {
    key: 'writing',
    name: '写作',
    desc: '按要求写一篇约 100-120 词的短文（提纲/图画/情景作文），考查组织与表达。',
    keyPoints: ['三段式结构（引入-展开-结论）', '常用句式与连接词', '书写规范与卷面']
  }
]

/** 内置学位英语高频词兜底（Free Dictionary API 不可达时使用，保证查词页有数据） */
export const BUILTIN_WORDS: Record<string, { phonetic: string; pos: string; def: string; example?: string }> = {
  vocabulary: { phonetic: '/vəˈkæbjələri/', pos: 'n.', def: '词汇；某人掌握的全部词语。', example: 'Reading widely builds your vocabulary.' },
  sustainable: { phonetic: '/səˈsteɪnəbl/', pos: 'adj.', def: '可持续的；能长期维持的。', example: 'We need sustainable development.' },
  analysis: { phonetic: '/əˈnæləsɪs/', pos: 'n.', def: '分析；对事物构成的研究。', example: 'Data analysis helps decision-making.' },
  significant: { phonetic: '/sɪɡˈnɪfɪkənt/', pos: 'adj.', def: '重要的；有意义的。', example: 'There was a significant change.' },
  environment: { phonetic: '/ɪnˈvaɪrənmənt/', pos: 'n.', def: '环境；周围条件。', example: 'We should protect the environment.' },
  economy: { phonetic: '/ɪˈkɒnəmi/', pos: 'n.', def: '经济；节约。', example: 'The economy is recovering.' },
  technology: { phonetic: '/tekˈnɒlədʒi/', pos: 'n.', def: '技术；科技。', example: 'Technology changes our life.' },
  responsibility: { phonetic: '/rɪˌspɒnsəˈbɪləti/', pos: 'n.', def: '责任；职责。', example: 'He has a lot of responsibility.' },
  communication: { phonetic: '/kəˌmjuːnɪˈkeɪʃn/', pos: 'n.', def: '交流；沟通。', example: 'Good communication matters.' },
  opportunity: { phonetic: '/ˌɒpəˈtjuːnəti/', pos: 'n.', def: '机会；时机。', example: 'It is a good opportunity.' },
  certificate: { phonetic: '/səˈtɪfɪkət/', pos: 'n.', def: '证书；证明。', example: 'He got a degree certificate.' },
  graduate: { phonetic: '/ˈɡrædʒueɪt/', pos: 'v./n.', def: '毕业；毕业生。', example: 'She will graduate next year.' },
  academic: { phonetic: '/ˌækəˈdemɪk/', pos: 'adj.', def: '学术的；学院的。', example: 'Academic performance is important.' },
  requirement: { phonetic: '/rɪˈkwaɪəmənt/', pos: 'n.', def: '要求；必要条件。', example: 'Meet the requirement first.' },
  benefit: { phonetic: '/ˈbenɪfɪt/', pos: 'n./v.', def: '好处；受益。', example: 'Exercise benefits health.' }
}

/** 带兜底地查词：API 不可达时返回内置高频词释义 */
export async function fetchDefinitionSafe(word: string): Promise<{ def: WordDefinition | null; builtin?: { phonetic: string; pos: string; def: string; example?: string } }> {
  const def = await fetchDefinition(word)
  if (def) return { def }
  const key = word.trim().toLowerCase()
  if (BUILTIN_WORDS[key]) return { def: null, builtin: BUILTIN_WORDS[key] }
  return { def: null }
}

/* ----- 学习计划 ----- */
export interface StudyPlanPhase {
  title: string
  days: string
  goals: string[]
  methods: string[]
}
export interface StudyPlan {
  examDate: string
  totalDays: number
  focus: string[]
  phases: StudyPlanPhase[]
  tips: string[]
}
export interface StudyPlanInput {
  materialText?: string
  examDate: string
  currentLevel?: string
  target?: string
  focusModules?: string[]
}

/**
 * 调用已配置 AI 生成学位英语备考计划（依据大纲第二版）。
 * 资料文本本地解析后传入（不存服务器原文件），计划结构返回后由页面存入云端。
 */
export async function generateStudyPlan(cfg: AiConfig, input: StudyPlanInput): Promise<StudyPlan> {
  const focus = input.focusModules && input.focusModules.length
    ? input.focusModules.join('、')
    : '会话/词汇/语法/阅读/完形/翻译/写作（按大纲）'
  const material = input.materialText
    ? `考生上传的备考资料（节选）：\n${input.materialText.slice(0, 3000)}\n`
    : '（未提供资料，按通用学位英语大纲备考）'
  const prompt =
    '你是成人本科学位英语备考规划师。请严格依据《成人高等教育本科生学士学位英语水平考试大纲》（高等教育出版社第二版）。\n' +
    '基于以下信息制定一份合理、可执行的备考学习计划。\n' +
    `# 考生资料：\n${material}\n` +
    `# 考试时间：${input.examDate}\n` +
    `# 当前水平：${input.currentLevel || '未说明'}\n` +
    `# 目标：${input.target || '通过考试'}\n` +
    `# 重点模块：${focus}\n\n` +
    '只输出严格 JSON（不要任何解释文字），结构如下：\n' +
    '{\n' +
    '  "examDate": "' + input.examDate + '",\n' +
    '  "totalDays": 数字(距考试天数),\n' +
    '  "focus": ["模块1","模块2"],\n' +
    '  "phases": [{"title":"阶段名","days":"第X-Y天","goals":["目标"],"methods":["方法"]}],\n' +
    '  "tips": ["提示1","提示2","提示3"]\n' +
    '}\n' +
    '阶段按时间由近到远合理划分，总量适中、可执行；若距考试较近应突出高频考点与真题。'
  const text = await callAi(cfg, prompt)
  const jsonStr = text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1)
  return JSON.parse(jsonStr) as StudyPlan
}

/** 前端本地解析上传的资料文件（txt/md 全量；docx 暂提示另存为 txt） */
export async function parseMaterialFile(file: File): Promise<string> {
  const name = file.name.toLowerCase()
  if (name.endsWith('.txt') || name.endsWith('.md') || name.endsWith('.text')) {
    return await file.text()
  }
  if (name.endsWith('.docx')) {
    throw new Error('暂仅支持 .txt/.md，请在 Word 中「另存为」纯文本(.txt)后重新上传。')
  }
  throw new Error('不支持的文件类型，请上传 .txt 或 .md 文本文件。')
}
