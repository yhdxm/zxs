// 通用 SRS 适配层：把 degreeSrs.ts 的 Leitner 盒子算法复用到任意 { word: string } 训练项。
import {
  reviewWord as baseReviewWord,
  buildReviewQueue as baseBuildQueue,
  srsStats as baseStats,
  SRS_MAX_LEVEL,
  todayStr,
  addDays,
  type SrsGrade,
  type SrsStats,
  type SrsDueOptions
} from './degreeSrs'
import type { WordProgress } from './degreeTypes'

export { SRS_MAX_LEVEL, todayStr, addDays, type SrsGrade, type SrsStats, type SrsDueOptions }

export interface SrsItem {
  word: string
}

export function reviewWord(p: WordProgress | undefined, grade: SrsGrade): WordProgress {
  return baseReviewWord(p, grade)
}

export function buildReviewQueue<T extends SrsItem>(
  items: T[],
  progress: Record<string, WordProgress>,
  opts: SrsDueOptions
): T[] {
  return baseBuildQueue(items as unknown as never, progress, opts) as unknown as T[]
}

/** 今日到期复习数（仅含已学且 due<=today 的项，不含新项）。 */
export function countDueToday<T extends SrsItem>(
  items: T[],
  progress: Record<string, WordProgress>,
  newPerDay: number
): number {
  const s = baseStats(items as unknown as never, progress, newPerDay)
  return s.due
}

/** 今日新项数（min(未学项, newPerDay)）。 */
export function countNewToday<T extends SrsItem>(
  items: T[],
  progress: Record<string, WordProgress>,
  newPerDay: number
): number {
  const s = baseStats(items as unknown as never, progress, newPerDay)
  return s.newToday
}

export function srsStats<T extends SrsItem>(
  items: T[],
  progress: Record<string, WordProgress>
): SrsStats {
  return baseStats(items as unknown as never, progress)
}
