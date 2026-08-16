// 学位英语备考台 · 内容数据访问层（词库 / 题库 / 词组）
// 目标：把「前端内置种子」真正落地到 Supabase 内容表，云端为唯一可共享真相源。
//   - 读取：优先云端；云端为空或不可达 → 回退前端种子（离线可用，绝不返回空导致功能瘫痪）。
//   - 写入：首次运行检测内容表为空，则批量 upsert 前端种子（lazy-seed），之后云端即为准。
//   - 幂等：localStorage 标记 + 模块级 memo，避免重复注入与并发重复写。
// 内容表（degree_words/degree_questions/degree_phrases）RLS 仅授予 select/insert/update，无 delete，
// 故内容只会被注入/修正，不会被清空。详见 scripts/degree-english-schema.sql。
import { supabase } from '../lib/supabaseClient'
import { degreeWords } from './degreeWords'
import { allDegreeQuestions } from './degreeQuestionBank'
import { degreePhrases } from './degreePhrases'
import { spokenPhrases, affixPhrases, irregularPhrases } from './degreePhrasesExtra'
import type { DegreeWord, DegreeQuestion, DegreePhrase, SourceBook } from './degreeTypes'

const SEED_FLAG = 'degree_content_seeded_v1'
const CHUNK = 500

// ---------- DB 行形态（与 scripts/degree-english-schema.sql 列对齐） ----------
interface WordRow {
  word: string
  phonetic: string
  pos: string
  definition: string
  productive: boolean
  source_page: number | null
  source_books: string[] | null
}
interface QuestionRow {
  id: string
  type: string
  stem: string
  passage: string | null
  options: string[] | null
  answer: string
  explanation: string
  difficulty: number | null
  paper_id: string | null
  source_book: string | null
  source_page: number | null
  source_section: string | null
  source_generated: boolean
  source_basis: string | null
}
interface PhraseRow {
  id: string
  category: string
  en: string
  zh: string | null
  extra: string | null
  productive: boolean
  source_page: number | null
}

// ---------- seed → DB row ----------
function wordToRow(w: DegreeWord): WordRow {
  return {
    word: w.word,
    phonetic: w.phonetic ?? '',
    pos: w.pos ?? '',
    definition: w.definition,
    productive: !!w.productive,
    source_page: w.sourcePage ?? null,
    source_books: w.sourceBooks ?? []
  }
}
function questionToRow(q: DegreeQuestion): QuestionRow {
  return {
    id: q.id,
    type: q.type,
    stem: q.stem,
    passage: q.passage ?? null,
    options: q.options ?? null,
    answer: q.answer,
    explanation: q.explanation ?? '',
    difficulty: q.difficulty ?? null,
    paper_id: q.paperId ?? null,
    source_book: q.source?.book ?? null,
    source_page: q.source?.page ?? null,
    source_section: q.source?.section ?? null,
    source_generated: !!q.source?.generated,
    source_basis: q.source?.basis ?? null
  }
}
function phraseToRow(p: DegreePhrase): PhraseRow {
  return {
    id: p.id,
    category: p.category,
    en: p.en,
    zh: p.zh ?? null,
    extra: p.extra ?? null,
    productive: !!p.productive,
    source_page: p.sourcePage ?? null
  }
}

// ---------- DB row → seed ----------
function rowToWord(r: WordRow): DegreeWord {
  return {
    word: r.word,
    phonetic: r.phonetic || undefined,
    pos: r.pos || undefined,
    definition: r.definition,
    productive: !!r.productive,
    sourcePage: r.source_page ?? undefined,
    sourceBooks: r.source_books ? (r.source_books as SourceBook[]) : undefined
  }
}
function rowToQuestion(r: QuestionRow): DegreeQuestion {
  return {
    id: r.id,
    type: r.type as DegreeQuestion['type'],
    stem: r.stem,
    passage: r.passage ?? undefined,
    options: r.options ?? undefined,
    answer: r.answer,
    explanation: r.explanation ?? '',
    difficulty: (r.difficulty as 1 | 2 | 3) ?? undefined,
    paperId: r.paper_id ?? undefined,
    source: {
      book: (r.source_book as DegreeQuestion['source']['book']) ?? '考试大纲',
      page: r.source_page ?? 0,
      section: r.source_section ?? '',
      generated: !!r.source_generated,
      basis: r.source_basis ?? ''
    }
  }
}
function rowToPhrase(r: PhraseRow): DegreePhrase {
  return {
    id: r.id,
    category: r.category as DegreePhrase['category'],
    en: r.en,
    zh: r.zh ?? undefined,
    extra: r.extra ?? undefined,
    productive: !!r.productive,
    sourcePage: r.source_page ?? undefined
  }
}

// ---------- 工具 ----------
async function tableCount(table: string): Promise<number> {
  try {
    const { count, error } = await supabase.from(table).select('*', { count: 'exact', head: true })
    if (error) return -1
    return Number(count) || 0
  } catch {
    return -1
  }
}

async function batchUpsert(table: string, rows: Record<string, unknown>[]): Promise<void> {
  for (let i = 0; i < rows.length; i += CHUNK) {
    const slice = rows.slice(i, i + CHUNK)
    const { error } = await supabase.from(table).upsert(slice)
    if (error) throw new Error(`${table} 注入失败：${error.message}`)
  }
}

export interface SeedProgress {
  table: string
  total: number
  done: boolean
  error?: string
}

function allPhrases(): DegreePhrase[] {
  return [...degreePhrases, ...spokenPhrases, ...affixPhrases, ...irregularPhrases]
}

async function doSeed(onProgress?: (p: SeedProgress) => void): Promise<boolean> {
  let already = ''
  try {
    already = localStorage.getItem(SEED_FLAG) || ''
  } catch {
    /* ignore */
  }
  if (already === '1') return false

  const jobs: Array<{ table: string; rows: Record<string, unknown>[] }> = [
    { table: 'degree_words', rows: degreeWords.map(wordToRow) as unknown as Record<string, unknown>[] },
    { table: 'degree_questions', rows: allDegreeQuestions.map(questionToRow) as unknown as Record<string, unknown>[] },
    { table: 'degree_phrases', rows: allPhrases().map(phraseToRow) as unknown as Record<string, unknown>[] }
  ]

  // 任一内容表已非空 → 视为已初始化，仅置 flag，避免重复写入
  for (const job of jobs) {
    const c = await tableCount(job.table)
    if (c > 0) {
      try {
        localStorage.setItem(SEED_FLAG, '1')
      } catch {
        /* ignore */
      }
      return false
    }
  }

  for (const job of jobs) {
    onProgress?.({ table: job.table, total: job.rows.length, done: false })
    try {
      await batchUpsert(job.table, job.rows)
      onProgress?.({ table: job.table, total: job.rows.length, done: true })
    } catch (e) {
      onProgress?.({
        table: job.table,
        total: job.rows.length,
        done: true,
        error: e instanceof Error ? e.message : String(e)
      })
      return false
    }
  }
  try {
    localStorage.setItem(SEED_FLAG, '1')
  } catch {
    /* ignore */
  }
  return true
}

// 模块级 memo：并发/多次调用只注入一次
let seedingPromise: Promise<boolean> | null = null
export function ensureContentSeeded(onProgress?: (p: SeedProgress) => void): Promise<boolean> {
  if (!seedingPromise) seedingPromise = doSeed(onProgress)
  return seedingPromise
}

// ---------- 读取（云端优先 + 前端种子兜底） ----------
export async function loadWords(): Promise<DegreeWord[]> {
  try {
    await ensureContentSeeded()
    const { data, error } = await supabase.from('degree_words').select('*')
    if (!error && Array.isArray(data) && data.length) {
      return (data as unknown as WordRow[]).map(rowToWord)
    }
  } catch {
    /* 云端异常 → 兜底 */
  }
  return degreeWords
}

export async function loadQuestions(): Promise<DegreeQuestion[]> {
  try {
    await ensureContentSeeded()
    const { data, error } = await supabase.from('degree_questions').select('*')
    if (!error && Array.isArray(data) && data.length) {
      return (data as unknown as QuestionRow[]).map(rowToQuestion)
    }
  } catch {
    /* 云端异常 → 兜底 */
  }
  return allDegreeQuestions
}

export async function loadPhrases(): Promise<DegreePhrase[]> {
  try {
    await ensureContentSeeded()
    const { data, error } = await supabase.from('degree_phrases').select('*')
    if (!error && Array.isArray(data) && data.length) {
      return (data as unknown as PhraseRow[]).map(rowToPhrase)
    }
  } catch {
    /* 云端异常 → 兜底 */
  }
  return allPhrases()
}

/** 供「我的/设置」手动重新注入（清空 flag 后触发）。返回注入结果。 */
export async function reseedContent(onProgress?: (p: SeedProgress) => void): Promise<boolean> {
  try {
    localStorage.removeItem(SEED_FLAG)
  } catch {
    /* ignore */
  }
  seedingPromise = null
  return doSeed(onProgress)
}
