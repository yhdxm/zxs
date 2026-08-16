// 学位英语备考台 · 数据类型

export type QuestionType =
  | 'dialogue' // 完成对话
  | 'reading' // 阅读理解
  | 'vocab_grammar' // 词汇和语法
  | 'translation' // 英译汉
  | 'writing' // 短文写作

export type SourceBook = '考试大纲' | '复习指南' | '模拟试卷'

// 资料库可读文章（三本 PDF 正文切分，供「资料库」浏览）
export interface DegreeArticle {
  id: string
  book: string // 来源 PDF 名
  title: string
  content: string
}

export interface QuestionSource {
  book: SourceBook
  page: number // PDF 原书页码（来源标注，便于溯源与查证）
  section: string // 章节 / 题型 / 套卷
  generated: boolean // true = 依据大纲/词表自动生成；false = PDF 原题
  basis: string // 人类可读来源，如「模拟试卷 第1套 原题」或「依据大纲词汇表生成」
}

export interface DegreeQuestion {
  id: string
  type: QuestionType
  stem: string // 题干
  passage?: string // 阅读/翻译原文（选择题可能含短文）
  options?: string[] // 选择题选项（A/B/C/D）
  answer: string // 答案：选择题为选项文本或序号；翻译/写作为参考答案
  explanation: string // 解析（中文，小白友好，说明「为什么」）
  difficulty?: 1 | 2 | 3
  paperId?: string // 所属模拟卷 id（模拟考试用）
  source: QuestionSource
}

export interface DegreeWord {
  word: string
  phonetic?: string
  pos?: string // 词性
  definition: string // 中文释义
  productive: boolean // 复用式掌握（大纲词表中带 * 号）
  sourcePage?: number // 大纲词汇表所在页
  sourceBooks?: SourceBook[] // 来源 PDF：词表只出自《考试大纲》；扫描《复习指南》《模拟试卷》正文，词在其中出现则追加标签
}

// 语句 / 词组数据（来自《考试大纲》附录二~八）
export type PhraseCategory = 'phrase' | 'spoken' | 'affix' | 'irregular'
export interface DegreePhrase {
  id: string
  category: PhraseCategory
  en: string // 英文短语 / 句子 / 词缀 / 动词原形
  zh?: string // 中文释义（词组、词缀有；口语表达多为空）
  extra?: string // irregular=过去式/过去分词；affix=例词；spoken=分类名
  productive?: boolean // 复用式掌握（词组表带 * 号）
  sourcePage?: number
}

// 个人学习态（入库，按 user_id 隔离）
export interface DegreeSettings {
  targetSchool: string | null
  examDate: string | null
  newPerDay: number
  manualStreak: number | null
}

export interface WordProgress {
  status: 'new' | 'learning' | 'graduated'
  level: number
  due: string | null
  weak: boolean
  /** 连续答错次数（SRS 薄弱度参考，degree_word_progress.wrong_streak 列）。 */
  wrongStreak?: number
  /** 首次学习日期 YYYY-MM-DD（degree_word_progress.first_learned 列）。用于云端派生「今日已学」与「连续天数」，使 PC/手机跨端同步。 */
  firstLearned?: string
  /** 最近一次学习日期 YYYY-MM-DD（degree_word_progress.last_studied 列）。 */
  lastStudied?: string
}

export interface PracticeRec {
  id: string
  type: QuestionType
  total: number
  correct: number
  date: string
}

export interface MistakeRec {
  id: string
  questionId: string | null
  type: QuestionType | null
  userAnswer: string | null
  reason: string | null
  due: string | null
  removed: boolean
  /** 入库时间（degree_mistakes.created_at），用于薄弱点趋势；loadMistakes 已映射 */
  createdAt?: string | null
}

export type FavoriteKind = 'note' | 'collection' | 'word'

/** 模拟考试记录（degree_exam_records，按 user_id 隔离）。 */
export interface ExamRecord {
  id: string
  paperId: string | null
  total: number
  correct: number
  duration: number | null // 用时（秒）
  answers: Record<string, string> | null
  /** 入库时间（degree_exam_records.created_at）。 */
  createdAt: string
}

export interface FavoriteRec {
  id: string
  kind: FavoriteKind
  refId: string | null
  title: string | null
  content: string
  createdAt: string
}
