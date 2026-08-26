// A5 自适应出题引擎（纯函数，零 API、零网络、免费）
// 设计：
//   - 从词库按「学习权重」加权抽样（薄弱 / 连错 / 到期 越高越优先；已毕业降权），实现「自适应」。
//   - 为每题自动生成干扰项（其他词的释义 / 单词），保证选项唯一、答案可定位。
//   - 输入即干净数据（调用方负责过滤 removed / 删除意图），本模块只做选择与组卷，便于单测。
//   复用：degreeTypes(DegreeWord/WordProgress)、degreeSrs(todayStr)。
import type { DegreeWord, WordProgress } from './degreeTypes'
import { todayStr } from './degreeSrs'

export type QuizMode = 'wordToDef' | 'defToWord'

export interface QuizItem {
  /** 题目对应的单词（始终带出，便于朗读 / 象形 / 判分后回写 SRS） */
  word: string
  phonetic?: string
  pos?: string
  /** 题干：wordToDef=单词；defToWord=释义 */
  prompt: string
  /** 选项（已打乱，含正确答案） */
  choices: string[]
  /** 正确答案在 choices 中的下标 */
  answerIndex: number
  /** 正确答案文本（= 该词释义，供解析展示） */
  definition: string
}

export interface BuildQuizOptions {
  /** 题目数量 */
  count: number
  /** 题型：单词→释义（默认）或 释义→单词 */
  mode?: QuizMode
  /** 是否包含已毕业（已掌握）词；默认排除，聚焦薄弱 */
  includeGraduated?: boolean
  /** 自定义随机源（测试注入，默认 Math.random） */
  rng?: () => number
}

/**
 * 词的选择权重：
 *   - 未学过（无进度）基础权重 1；
 *   - 已毕业降权 -3（除非显式包含）；
 *   - 薄弱 +5；连错 +min(10, 连错*2)；到期 +2。
 */
export function wordWeight(w: DegreeWord, p: WordProgress | undefined, today: string): number {
  if (!p) return 1
  if (p.status === 'graduated') return -3
  let wgt = 1
  if (p.weak) wgt += 5
  if ((p.wrongStreak ?? 0) > 0) wgt += Math.min(10, (p.wrongStreak ?? 0) * 2)
  if ((p.due ?? today) <= today) wgt += 2
  return wgt
}

function weightedPick(items: { weight: number }[], rng: () => number): number {
  const total = items.reduce((s, it) => s + Math.max(0.0001, it.weight), 0)
  let r = rng() * total
  for (let i = 0; i < items.length; i++) {
    r -= Math.max(0.0001, items[i]!.weight)
    if (r <= 0) return i
  }
  return items.length - 1
}

function shuffle<T>(arr: T[], rng: () => number): T[] {
  const a = arr.slice()
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    const ai = a[i]!
    const aj = a[j]!
    a[i] = aj
    a[j] = ai
  }
  return a
}

function makeItem(w: DegreeWord, pool: DegreeWord[], mode: QuizMode, rng: () => number): QuizItem {
  const correctDef = w.definition
  const others = shuffle(
    pool.filter((x) => x.word !== w.word && x.definition !== correctDef),
    rng
  )
  if (mode === 'wordToDef') {
    const distractors = others.slice(0, 3).map((x) => x.definition)
    const choices = shuffle([correctDef, ...distractors], rng)
    return {
      word: w.word,
      phonetic: w.phonetic,
      pos: w.pos,
      prompt: w.word,
      choices,
      answerIndex: choices.indexOf(correctDef),
      definition: correctDef
    }
  }
  // defToWord
  const distractors = others.slice(0, 3).map((x) => x.word)
  const choices = shuffle([w.word, ...distractors], rng)
  return {
    word: w.word,
    phonetic: w.phonetic,
    pos: w.pos,
    prompt: correctDef,
    choices,
    answerIndex: choices.indexOf(w.word),
    definition: correctDef
  }
}

/**
 * 构建自适应试卷：按权重抽取 count 个词，每词生成一道选择题。
 * 若词库不足 count，则返回全部可用词组成的试卷（不抛错）。
 */
export function buildQuiz(
  words: DegreeWord[],
  progress: Record<string, WordProgress>,
  opts: BuildQuizOptions
): QuizItem[] {
  const mode = opts.mode ?? 'wordToDef'
  const rng = opts.rng ?? Math.random
  const today = todayStr()
  const pool = words.filter((w) => {
    const p = progress[w.word]
    if (p?.status === 'graduated' && !opts.includeGraduated) return false
    return true
  })
  const weighted = pool.map((w) => ({ w, weight: wordWeight(w, progress[w.word], today) }))
  const remaining = weighted.slice()
  const n = Math.max(0, Math.min(opts.count, remaining.length))
  const picked: DegreeWord[] = []
  while (picked.length < n && remaining.length) {
    const idx = weightedPick(remaining, rng)
    picked.push(remaining[idx]!.w)
    remaining.splice(idx, 1)
  }
  return picked.map((w) => makeItem(w, pool, mode, rng))
}
