// 学位英语备考台 · 数据类型

export type QuestionType =
  | 'dialogue' // 完成对话
  | 'reading' // 阅读理解
  | 'vocab_grammar' // 词汇和语法
  | 'translation' // 英译汉
  | 'writing' // 短文写作

export type SourceBook = '考试大纲' | '复习指南' | '模拟试卷'

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
}

export type FavoriteKind = 'note' | 'collection' | 'word'

export interface FavoriteRec {
  id: string
  kind: FavoriteKind
  refId: string | null
  title: string | null
  content: string
  createdAt: string
}
