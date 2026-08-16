// 学位英语备考台 · SRS 间隔重复引擎（Leitner 盒子式）
// 复用 degree_word_progress 既有列：status / level / due / weak / wrong_streak，无需新增数据库列。
// 设计：level 即「盒子序号」，答对升级（间隔拉长），答错降级（回到短期盒子），达到 SRS_MAX_LEVEL 视为毕业（已掌握）。
import type { DegreeWord, WordProgress } from './degreeTypes'

// 等级上限：达到该等级即 graduated（已掌握）
export const SRS_MAX_LEVEL = 6
// 各 level 对应的复习间隔（天），index = level；超出末尾统一用最大值。
const SRS_INTERVALS = [0, 1, 2, 4, 7, 15, 30]

/** level 对应的下次复习间隔（天）。 */
export function srsInterval(level: number): number {
  if (level <= 0) return 0
  const idx = Math.min(level, SRS_INTERVALS.length - 1)
  return SRS_INTERVALS[idx] ?? 0
}

export function todayStr(): string {
  return new Date().toISOString().slice(0, 10)
}

/** 在日期字符串 d 上加 n 天（按 UTC 零点计算，避免时区漂移）。 */
export function addDays(d: string, n: number): string {
  const dt = new Date(d + 'T00:00:00Z')
  dt.setUTCDate(dt.getUTCDate() + n)
  return dt.toISOString().slice(0, 10)
}

export type SrsGrade = 'again' | 'good' | 'easy'

/**
 * 根据本次评分计算下一步进度（纯函数，不写库）。
 * - again（遗忘）：降级并保持薄弱，due 回到今天（本轮稍后再现）；新词保持 new。
 * - good（记得）：升 1 级，清空薄弱与连错。
 * - easy（简单）：升 2 级，清空薄弱与连错。
 */
export function reviewWord(p: WordProgress | undefined, grade: SrsGrade): WordProgress {
  const cur: WordProgress = p ?? { status: 'new', level: 0, due: null, weak: false, wrongStreak: 0 }
  let level = cur.level
  let weak = cur.weak
  let wrongStreak = cur.wrongStreak ?? 0
  if (grade === 'again') {
    level = level <= 0 ? 0 : Math.max(1, level - 1)
    weak = true
    wrongStreak += 1
  } else {
    const inc = grade === 'easy' ? 2 : 1
    level = Math.min(SRS_MAX_LEVEL, level + inc)
    weak = false
    wrongStreak = 0
  }
  const due = addDays(todayStr(), srsInterval(level))
  const status: WordProgress['status'] =
    level >= SRS_MAX_LEVEL ? 'graduated' : level === 0 ? 'new' : 'learning'
  return { status, level, due, weak, wrongStreak }
}

export interface SrsDueOptions {
  /** 每日新词上限（来自设置 newPerDay），限制单次复习引入的新词数量。 */
  newPerDay: number
}

/**
 * 构建本次复习队列：到期词（due<=今天 且未毕业）优先，新词（无进度）按 newPerDay 截取，混在末尾。
 * 到期词轻微打乱顺序，避免每次都从同一批开头。
 */
export function buildReviewQueue(
  words: DegreeWord[],
  progress: Record<string, WordProgress>,
  opts: SrsDueOptions
): DegreeWord[] {
  const today = todayStr()
  const due: DegreeWord[] = []
  const fresh: DegreeWord[] = []
  for (const w of words) {
    const p = progress[w.word]
    if (!p) {
      fresh.push(w)
    } else if (p.status !== 'graduated' && (p.due ?? today) <= today) {
      due.push(w)
    }
  }
  const cappedFresh = fresh.slice(0, Math.max(0, opts.newPerDay))
  return [...shuffle(due), ...cappedFresh]
}

function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice()
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    const ai = a[i]!
    const aj = a[j]!
    a[i] = aj
    a[j] = ai
  }
  return a
}

export interface SrsStats {
  total: number
  learning: number
  graduated: number
  /** 今日待复习（到期 + 新词待学）。 */
  due: number
  weak: number
}

/** 词库整体学习态统计，供复习面板总览。 */
export function srsStats(words: DegreeWord[], progress: Record<string, WordProgress>): SrsStats {
  const today = todayStr()
  let learning = 0
  let graduated = 0
  let due = 0
  let weak = 0
  let hasProgress = 0
  for (const w of words) {
    const p = progress[w.word]
    if (!p) continue
    hasProgress++
    if (p.status === 'graduated') graduated++
    else {
      learning++
      if ((p.due ?? today) <= today) due++
      if (p.weak) weak++
    }
  }
  const newCount = words.length - hasProgress
  return { total: words.length, learning, graduated, due: due + newCount, weak }
}
