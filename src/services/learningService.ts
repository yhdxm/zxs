// 学习中心数据层 — 全部免费、可降级。
//  - 学位英语：Free Dictionary API（免费无 key）
//  - 书籍阅读：Project Gutenberg（gutendex.com 免费 API）
//  - 各行业知识：内置知识库 + 已配置 AI 答疑
//  - AI 答疑：复用 callAi

import { fetchCorsJson, fetchCorsText } from './freeApi'
import { callAi, type AiConfig } from './aiService'
import { degreeWords } from '../prep/degreeWords'
import { MASTER_WORDS_BUNDLE } from '../prep/masterWordsBundle'

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

// 各行业知识库已抽到 industryKnowledge.ts（17 个行业 / 68 讲真实可学内容），
// 此处再导出，保持原有引用路径不变。
export {
  INDUSTRY_KNOWLEDGE_DERIVED as INDUSTRY_KNOWLEDGE,
  INDUSTRY_KNOWLEDGE_FULL,
  INDUSTRY_LESSON_INDEX,
  INDUSTRY_KB_STATS,
  type IndustryTopic,
  type IndustryTopicFull,
  type IndustryLesson,
  type IndustryTable,
  type IndustryExample,
  type IndustryLessonRef
} from './industryKnowledge'

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
  category?: string
}
export interface BookSearchResult {
  count: number
  next: string | null
  previous: string | null
  results: GutenbergBook[]
}

/** 维基文库中文 API（免费无 key），用于检索国内公版书 */
const WIKI_BASE = 'https://zh.wikisource.org/w/api.php'

/** 字符串转稳定数字 id（维基文库条目无数字 id，用标题 hash 生成） */
function hashId(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0
  return Math.abs(h)
}

/**
 * 检索国内公版书：
 * 1) 首选项目内置的中文公版书目，按 书名/作者/分类/主题 本地模糊匹配（离线/国内可达，零报错）；
 * 2) 命中后再 best-effort 追加维基文库在线检索结果作为补充（失败自动忽略，不影响主结果）；
 * 3) 按分类筛选、分页返回。
 */
export const BOOK_CATEGORIES = [
  '古典小说',
  '先秦诸子',
  '史书',
  '诗词文赋',
  '蒙学',
  '现代文学',
  '佛道经典'
]

const BOOK_PAGE_SIZE = 12

export async function fetchBooks(
  query: string,
  page = 1,
  category?: string
): Promise<BookSearchResult> {
  const q = query.trim().toLowerCase()
  const cat = (category || '').trim()
  const matched = BUILTIN_BOOKS.filter((b) => {
    if (cat && b.category !== cat) return false
    if (!q) return true
    return (
      b.title.toLowerCase().includes(q) ||
      b.authors.some((a) => a.name.toLowerCase().includes(q)) ||
      (b.category || '').toLowerCase().includes(q) ||
      (b.subjects || []).some((s) => s.toLowerCase().includes(q))
    )
  })
  // 在线补充（维基文库），失败不影响主结果
  if (q || cat) {
    try {
      const online = await wikiSearchBooks(q || cat)
      const seen = new Set(matched.map((b) => b.title))
      for (const b of online) if (!seen.has(b.title)) { matched.push(b); seen.add(b.title) }
    } catch {
      /* 忽略在线补充失败 */
    }
  }
  const total = matched.length
  const start = (page - 1) * BOOK_PAGE_SIZE
  const slice = matched.slice(start, start + BOOK_PAGE_SIZE)
  return {
    count: total,
    next: start + BOOK_PAGE_SIZE < total ? `page=${page + 1}` : null,
    previous: page > 1 ? `page=${page - 1}` : null,
    results: slice
  }
}

/** 维基文库在线检索（best-effort，调用方已兜底） */
async function wikiSearchBooks(q: string): Promise<GutenbergBook[]> {
  const url = `${WIKI_BASE}?action=query&list=search&srsearch=${encodeURIComponent(q)}&srnamespace=0&srlimit=10&format=json`
  const data = await fetchCorsJson<{ query?: { search?: { title: string }[] } }>(url)
  const list = data?.query?.search || []
  return list.slice(0, 10).map((it) => ({
    id: -hashId(it.title),
    title: it.title,
    authors: [{ name: '维基文库' }],
    download_count: 0,
    languages: ['zh'],
    subjects: ['维基文库'],
    category: '维基文库',
    formats: { wikisource: `https://zh.wikisource.org/wiki/${encodeURIComponent(it.title)}` }
  }))
}

/** 维基文库阅读地址构造：exact 为确切条目名（走精确页），否则用站内搜索兜底（保证可打开） */
function ws(exact?: string, title?: string): Record<string, string> {
  const t = title || exact || ''
  return {
    wikisource: exact
      ? `https://zh.wikisource.org/wiki/${encodeURIComponent(exact)}`
      : `https://zh.wikisource.org/w/index.php?search=${encodeURIComponent(t)}`
  }
}

/** 内置中国公版书（覆盖 7 大类、均为真实书目，维基文库可在线阅读；本地优先，离线可达零报错） */
export const BUILTIN_BOOKS: GutenbergBook[] = [
  // ===== 古典小说 =====
  { id: 1, title: '红楼梦', authors: [{ name: '曹雪芹' }], category: '古典小说', subjects: ['古典小说'], download_count: 99999, languages: ['zh'], formats: ws('紅樓夢', '红楼梦') },
  { id: 2, title: '三国演义', authors: [{ name: '罗贯中' }], category: '古典小说', subjects: ['古典小说'], download_count: 99999, languages: ['zh'], formats: ws('三國演義', '三国演义') },
  { id: 3, title: '水浒传', authors: [{ name: '施耐庵' }], category: '古典小说', subjects: ['古典小说'], download_count: 99999, languages: ['zh'], formats: ws('水滸傳', '水浒传') },
  { id: 4, title: '西游记', authors: [{ name: '吴承恩' }], category: '古典小说', subjects: ['古典小说'], download_count: 99999, languages: ['zh'], formats: ws('西遊記', '西游记') },
  { id: 5, title: '儒林外史', authors: [{ name: '吴敬梓' }], category: '古典小说', subjects: ['古典小说'], download_count: 99999, languages: ['zh'], formats: ws('儒林外史', '儒林外史') },
  { id: 6, title: '聊斋志异', authors: [{ name: '蒲松龄' }], category: '古典小说', subjects: ['古典小说'], download_count: 99999, languages: ['zh'], formats: ws('聊齋志異', '聊斋志异') },
  { id: 7, title: '镜花缘', authors: [{ name: '李汝珍' }], category: '古典小说', subjects: ['古典小说'], download_count: 99999, languages: ['zh'], formats: ws('鏡花緣', '镜花缘') },
  { id: 8, title: '老残游记', authors: [{ name: '刘鹗' }], category: '古典小说', subjects: ['古典小说'], download_count: 99999, languages: ['zh'], formats: ws('老殘遊記', '老残游记') },
  { id: 9, title: '官场现形记', authors: [{ name: '李伯元' }], category: '古典小说', subjects: ['古典小说'], download_count: 99999, languages: ['zh'], formats: ws('官場現形記', '官场现形记') },
  { id: 10, title: '二十年目睹之怪现状', authors: [{ name: '吴趼人' }], category: '古典小说', subjects: ['古典小说'], download_count: 99999, languages: ['zh'], formats: ws('二十年目睹之怪現狀', '二十年目睹之怪现状') },
  { id: 11, title: '孽海花', authors: [{ name: '曾朴' }], category: '古典小说', subjects: ['古典小说'], download_count: 99999, languages: ['zh'], formats: ws('孽海花', '孽海花') },
  { id: 12, title: '封神演义', authors: [{ name: '许仲琳' }], category: '古典小说', subjects: ['古典小说'], download_count: 99999, languages: ['zh'], formats: ws('封神演義', '封神演义') },
  { id: 13, title: '东周列国志', authors: [{ name: '冯梦龙' }], category: '古典小说', subjects: ['古典小说'], download_count: 99999, languages: ['zh'], formats: ws('東周列國志', '东周列国志') },

  // ===== 先秦诸子 =====
  { id: 14, title: '论语', authors: [{ name: '孔子' }], category: '先秦诸子', subjects: ['先秦诸子'], download_count: 99999, languages: ['zh'], formats: ws('論語', '论语') },
  { id: 15, title: '道德经', authors: [{ name: '老子' }], category: '先秦诸子', subjects: ['先秦诸子'], download_count: 99999, languages: ['zh'], formats: ws('道德經', '道德经') },
  { id: 16, title: '孟子', authors: [{ name: '孟轲' }], category: '先秦诸子', subjects: ['先秦诸子'], download_count: 99999, languages: ['zh'], formats: ws('孟子', '孟子') },
  { id: 17, title: '庄子', authors: [{ name: '庄周' }], category: '先秦诸子', subjects: ['先秦诸子'], download_count: 99999, languages: ['zh'], formats: ws('莊子', '庄子') },
  { id: 18, title: '荀子', authors: [{ name: '荀况' }], category: '先秦诸子', subjects: ['先秦诸子'], download_count: 99999, languages: ['zh'], formats: ws('荀子', '荀子') },
  { id: 19, title: '韩非子', authors: [{ name: '韩非' }], category: '先秦诸子', subjects: ['先秦诸子'], download_count: 99999, languages: ['zh'], formats: ws('韓非子', '韩非子') },
  { id: 20, title: '墨子', authors: [{ name: '墨翟' }], category: '先秦诸子', subjects: ['先秦诸子'], download_count: 99999, languages: ['zh'], formats: ws('墨子', '墨子') },
  { id: 21, title: '孙子兵法', authors: [{ name: '孙武' }], category: '先秦诸子', subjects: ['先秦诸子', '兵书'], download_count: 99999, languages: ['zh'], formats: ws('孫子兵法', '孙子兵法') },
  { id: 22, title: '周易', authors: [{ name: '佚名' }], category: '先秦诸子', subjects: ['先秦诸子', '经部'], download_count: 99999, languages: ['zh'], formats: ws('周易', '周易') },
  { id: 23, title: '诗经', authors: [{ name: '佚名' }], category: '先秦诸子', subjects: ['诗经'], download_count: 99999, languages: ['zh'], formats: ws('詩經', '诗经') },
  { id: 24, title: '楚辞', authors: [{ name: '屈原 等' }], category: '先秦诸子', subjects: ['楚辞', '辞赋'], download_count: 99999, languages: ['zh'], formats: ws('楚辭', '楚辞') },
  { id: 25, title: '尚书', authors: [{ name: '佚名' }], category: '先秦诸子', subjects: ['尚书', '经部'], download_count: 99999, languages: ['zh'], formats: ws('尚書', '尚书') },

  // ===== 史书 =====
  { id: 26, title: '史记', authors: [{ name: '司马迁' }], category: '史书', subjects: ['史书'], download_count: 99999, languages: ['zh'], formats: ws('史記', '史记') },
  { id: 27, title: '资治通鉴', authors: [{ name: '司马光' }], category: '史书', subjects: ['史书'], download_count: 99999, languages: ['zh'], formats: ws('資治通鑑', '资治通鉴') },
  { id: 28, title: '汉书', authors: [{ name: '班固' }], category: '史书', subjects: ['史书'], download_count: 99999, languages: ['zh'], formats: ws('漢書', '汉书') },
  { id: 29, title: '三国志', authors: [{ name: '陈寿' }], category: '史书', subjects: ['史书'], download_count: 99999, languages: ['zh'], formats: ws('三國志', '三国志') },
  { id: 30, title: '左传', authors: [{ name: '左丘明' }], category: '史书', subjects: ['史书'], download_count: 99999, languages: ['zh'], formats: ws('左傳', '左传') },
  { id: 31, title: '战国策', authors: [{ name: '佚名' }], category: '史书', subjects: ['史书'], download_count: 99999, languages: ['zh'], formats: ws('戰國策', '战国策') },
  { id: 32, title: '世说新语', authors: [{ name: '刘义庆' }], category: '史书', subjects: ['史书', '笔记'], download_count: 99999, languages: ['zh'], formats: ws('世說新語', '世说新语') },

  // ===== 诗词文赋 =====
  { id: 33, title: '唐诗三百首', authors: [{ name: '蘅塘退士 编' }], category: '诗词文赋', subjects: ['诗词'], download_count: 99999, languages: ['zh'], formats: ws('唐詩三百首', '唐诗三百首') },
  { id: 34, title: '宋词三百首', authors: [{ name: '上彊村民 编' }], category: '诗词文赋', subjects: ['诗词'], download_count: 99999, languages: ['zh'], formats: ws('宋詞三百首', '宋词三百首') },
  { id: 35, title: '古文观止', authors: [{ name: '吴楚材 编' }], category: '诗词文赋', subjects: ['古文', '选本'], download_count: 99999, languages: ['zh'], formats: ws('古文觀止', '古文观止') },
  { id: 36, title: '人间词话', authors: [{ name: '王国维' }], category: '诗词文赋', subjects: ['词话', '文学批评'], download_count: 99999, languages: ['zh'], formats: ws('人間詞話', '人间词话') },
  { id: 37, title: '乐府诗集', authors: [{ name: '郭茂倩 编' }], category: '诗词文赋', subjects: ['诗词', '乐府'], download_count: 99999, languages: ['zh'], formats: ws('樂府詩集', '乐府诗集') },
  { id: 38, title: '文心雕龙', authors: [{ name: '刘勰' }], category: '诗词文赋', subjects: ['文论'], download_count: 99999, languages: ['zh'], formats: ws('文心雕龍', '文心雕龙') },

  // ===== 蒙学 =====
  { id: 39, title: '三字经', authors: [{ name: '王应麟' }], category: '蒙学', subjects: ['蒙学'], download_count: 99999, languages: ['zh'], formats: ws('三字經', '三字经') },
  { id: 40, title: '百家姓', authors: [{ name: '佚名' }], category: '蒙学', subjects: ['蒙学'], download_count: 99999, languages: ['zh'], formats: ws('百家姓', '百家姓') },
  { id: 41, title: '千字文', authors: [{ name: '周兴嗣' }], category: '蒙学', subjects: ['蒙学'], download_count: 99999, languages: ['zh'], formats: ws('千字文', '千字文') },
  { id: 42, title: '弟子规', authors: [{ name: '李毓秀' }], category: '蒙学', subjects: ['蒙学'], download_count: 99999, languages: ['zh'], formats: ws('弟子規', '弟子规') },
  { id: 43, title: '声律启蒙', authors: [{ name: '车万育' }], category: '蒙学', subjects: ['蒙学', '对韵'], download_count: 99999, languages: ['zh'], formats: ws('聲律啟蒙', '声律启蒙') },
  { id: 44, title: '增广贤文', authors: [{ name: '佚名' }], category: '蒙学', subjects: ['蒙学'], download_count: 99999, languages: ['zh'], formats: ws('增廣賢文', '增广贤文') },

  // ===== 现代文学（均为 1949 年前出版、国内公版） =====
  { id: 45, title: '呐喊', authors: [{ name: '鲁迅' }], category: '现代文学', subjects: ['现代文学', '小说集'], download_count: 99999, languages: ['zh'], formats: ws(undefined, '呐喊') },
  { id: 46, title: '彷徨', authors: [{ name: '鲁迅' }], category: '现代文学', subjects: ['现代文学', '小说集'], download_count: 99999, languages: ['zh'], formats: ws(undefined, '彷徨') },
  { id: 47, title: '朝花夕拾', authors: [{ name: '鲁迅' }], category: '现代文学', subjects: ['现代文学', '散文集'], download_count: 99999, languages: ['zh'], formats: ws(undefined, '朝花夕拾') },
  { id: 48, title: '野草', authors: [{ name: '鲁迅' }], category: '现代文学', subjects: ['现代文学', '散文诗集'], download_count: 99999, languages: ['zh'], formats: ws(undefined, '野草') },
  { id: 49, title: '边城', authors: [{ name: '沈从文' }], category: '现代文学', subjects: ['现代文学', '小说'], download_count: 99999, languages: ['zh'], formats: ws(undefined, '边城') },
  { id: 50, title: '骆驼祥子', authors: [{ name: '老舍' }], category: '现代文学', subjects: ['现代文学', '小说'], download_count: 99999, languages: ['zh'], formats: ws(undefined, '骆驼祥子') },
  { id: 51, title: '茶馆', authors: [{ name: '老舍' }], category: '现代文学', subjects: ['现代文学', '话剧'], download_count: 99999, languages: ['zh'], formats: ws(undefined, '茶馆') },
  { id: 52, title: '雷雨', authors: [{ name: '曹禺' }], category: '现代文学', subjects: ['现代文学', '话剧'], download_count: 99999, languages: ['zh'], formats: ws(undefined, '雷雨') },
  { id: 53, title: '子夜', authors: [{ name: '茅盾' }], category: '现代文学', subjects: ['现代文学', '小说'], download_count: 99999, languages: ['zh'], formats: ws(undefined, '子夜') },
  { id: 54, title: '家', authors: [{ name: '巴金' }], category: '现代文学', subjects: ['现代文学', '小说'], download_count: 99999, languages: ['zh'], formats: ws(undefined, '家') },
  { id: 55, title: '女神', authors: [{ name: '郭沫若' }], category: '现代文学', subjects: ['现代文学', '诗集'], download_count: 99999, languages: ['zh'], formats: ws(undefined, '女神') },
  { id: 56, title: '背影', authors: [{ name: '朱自清' }], category: '现代文学', subjects: ['现代文学', '散文'], download_count: 99999, languages: ['zh'], formats: ws(undefined, '背影') },
  { id: 57, title: '春蚕', authors: [{ name: '茅盾' }], category: '现代文学', subjects: ['现代文学', '小说'], download_count: 99999, languages: ['zh'], formats: ws(undefined, '春蚕') },
  { id: 58, title: '沉沦', authors: [{ name: '郁达夫' }], category: '现代文学', subjects: ['现代文学', '小说集'], download_count: 99999, languages: ['zh'], formats: ws(undefined, '沉沦') },

  // ===== 佛道经典 =====
  { id: 59, title: '金刚经', authors: [{ name: '鸠摩罗什 译' }], category: '佛道经典', subjects: ['佛经'], download_count: 99999, languages: ['zh'], formats: ws('金剛經', '金刚经') },
  { id: 60, title: '心经', authors: [{ name: '玄奘 译' }], category: '佛道经典', subjects: ['佛经'], download_count: 99999, languages: ['zh'], formats: ws('心經', '心经') },
  { id: 61, title: '黄帝内经', authors: [{ name: '佚名' }], category: '佛道经典', subjects: ['医典', '道家'], download_count: 99999, languages: ['zh'], formats: ws('黃帝內經', '黄帝内经') },
  { id: 62, title: '六祖坛经', authors: [{ name: '惠能' }], category: '佛道经典', subjects: ['佛经'], download_count: 99999, languages: ['zh'], formats: ws('六祖壇經', '六祖坛经') }
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
/** 选取阅读地址：优先纯文本，其次维基文库在线阅读外链（国内书籍） */
export function pickReadUrl(book: GutenbergBook): string | null {
  return pickTextUrl(book) || book.formats['wikisource'] || null
}

/** 拉取书籍正文（限制长度，避免超大文件卡顿） */
export async function fetchBookText(textUrl: string, maxBytes = 80000): Promise<string> {
  return fetchCorsText(textUrl, { maxBytes })
}

/* ===================== 学位英语：知识库 + 学习计划 ===================== */

// 知识库正文已抽到 englishKnowledge.ts（11 个模块 / 40+ 讲真实讲解内容），
// 此处再导出，保持原有引用路径不变。
export {
  ENGLISH_OUTLINE,
  ENGLISH_LESSON_INDEX,
  ENGLISH_KB_STATS,
  type EnglishOutlineItem,
  type EnglishLesson,
  type EnglishExample,
  type EnglishTable
} from './englishKnowledge'

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

/** 从 degreeWords 解析出 pos + def（definition 字段已含 pos 前缀，如 "n.单词"） */
function parseDegreeDefinition(raw: string): { pos: string; def: string } {
  const m = raw.match(/^([a-z]+\.|n\.|v\.|a\.|ad\.|prep\.|conj\.|pron\.|art\.|num\.|int\.|vt\.|vi\.|t\.|ut\.|ot\.)(.*)$/)
  if (m) return { pos: m[1]!, def: m[2]! }
  return { pos: '', def: raw }
}

/** 带兜底地查词：先 Free Dictionary，再内置高频词，再学位英语词库，再四级词库 */
export async function fetchDefinitionSafe(word: string): Promise<{ def: WordDefinition | null; builtin?: { phonetic: string; pos: string; def: string; example?: string } }> {
  const def = await fetchDefinition(word)
  if (def) return { def }
  const key = word.trim().toLowerCase()
  if (BUILTIN_WORDS[key]) return { def: null, builtin: BUILTIN_WORDS[key] }
  const degree = degreeWords.find((w) => w.word.toLowerCase() === key)
  if (degree) {
    const parsed = parseDegreeDefinition(degree.definition)
    return {
      def: null,
      builtin: { phonetic: degree.phonetic || '', pos: parsed.pos || ' ', def: parsed.def || degree.definition }
    }
  }
  const master = MASTER_WORDS_BUNDLE.find((row) => row[0].toLowerCase() === key)
  if (master) {
    const [_w, phonetic, pos, meaning, example] = master
    return {
      def: null,
      builtin: { phonetic: phonetic || '', pos: `${pos}.`, def: meaning, example: example || undefined }
    }
  }
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
