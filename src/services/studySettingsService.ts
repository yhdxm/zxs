// 三模块（学习中心背单词卡 / 学习中心四六级 / 备考台）各自的「单词学习设置」+「连续学习天数 / 今日已学」。
// 设置项（newPerDay / remindDue / graduatedReturn）仍用 localStorage 镜像，免费、离线可用、无需新增数据库表。
// 「连续天数」与「今日已学」改为【从云端单词进度派生】：单词每次评分都会把 firstLearned/lastStudied 写入
//   public.learn_word_progress / cet_word_progress / degree_word_progress，PC 与手机读同一份云端数据，自然同步。
import { todayStr, addDays } from '../prep/trainingSrs'
import type { WordProgress } from '../prep/degreeTypes'

/** 三个独立单词模块：学习中心背单词卡 / 学习中心四六级 / 备考台（背单词卡+词组共用进度库，靠 key 前缀隔离）。 */
export type StudyModule = 'learn' | 'cet' | 'degree'

export interface StudySettings {
  /** 每日新词上限（learn/cet 由本服务管理；degree 仅作回退默认值，实际以 degree_settings 为准）。 */
  newPerDay: number
  /** 待复习提醒：开启后模块卡/开始页在有待复习时给出醒目提醒。 */
  remindDue: boolean
  /** 已掌握词回流：开启后已毕业（已掌握）的词会重新进入复习队列，可返回「学习单词中」。 */
  graduatedReturn: boolean
}

const SETTINGS_KEY = 'study_module_settings_v1'

type SettingsMap = Record<string, StudySettings>

const DEFAULTS: StudySettings = { newPerDay: 15, remindDue: true, graduatedReturn: false }

function lsGet<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key)
    return v ? (JSON.parse(v) as T) : fallback
  } catch {
    return fallback
  }
}
function lsSet(key: string, val: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(val))
  } catch {
    /* ignore */
  }
}

/** 读取某模块设置；degree 模块可传入云端 newPerDay 作为回退。 */
export function getStudySettings(module: StudyModule, fallbackNewPerDay?: number): StudySettings {
  const map = lsGet<SettingsMap>(SETTINGS_KEY, {})
  const s = map[module] ?? ({ ...DEFAULTS } as StudySettings)
  return {
    newPerDay: fallbackNewPerDay ?? s.newPerDay ?? DEFAULTS.newPerDay,
    remindDue: s.remindDue ?? DEFAULTS.remindDue,
    graduatedReturn: s.graduatedReturn ?? DEFAULTS.graduatedReturn
  }
}

/** 保存某模块设置（局部更新）。 */
export function saveStudySettings(module: StudyModule, partial: Partial<StudySettings>): StudySettings {
  const map = lsGet<SettingsMap>(SETTINGS_KEY, {})
  const cur = map[module] ?? ({ ...DEFAULTS } as StudySettings)
  const next: StudySettings = { ...cur, ...partial }
  map[module] = next
  lsSet(SETTINGS_KEY, map)
  return next
}

/**
 * 今日已学新词数（从云端进度派生，跨端同步）。
 * 统计 progress 中 firstLearned === today 的条目数。
 * - opts.onlyPhrase 省略 → 统计所有条目（learn / cet 模块用）。
 * - opts.onlyPhrase = true → 只统计 key 以 'ph:' 开头的词组（备考台词组卡）。
 * - opts.onlyPhrase = false → 只统计 key 不以 'ph:' 开头的单词（备考台单词卡）。
 */
export function countLearnedToday(
  progress: Record<string, WordProgress>,
  today: string = todayStr(),
  opts?: { onlyPhrase?: boolean }
): number {
  let n = 0
  for (const [key, p] of Object.entries(progress)) {
    if (opts?.onlyPhrase !== undefined) {
      const isPhrase = key.startsWith('ph:')
      if (opts.onlyPhrase && !isPhrase) continue
      if (!opts.onlyPhrase && isPhrase) continue
    }
    if (p.firstLearned === today) n += 1
  }
  return n
}

/**
 * 从一组学习日期集合计算「连续学习天数」（从云端进度派生，跨端同步）。
 * 规则：今天或昨天有记录才算连续；从最近一天往回逐日计数，断一天即止。
 * degree 模块调用时，应把 practice 日期、mistakes 日期、单词 lastStudied 日期全部并入 dates。
 */
export function computeStreakFromDates(dates: string[], today: string = todayStr()): number {
  const set = new Set(dates)
  let cursor = today
  if (!set.has(cursor)) {
    const y = addDays(today, -1)
    if (!set.has(y)) return 0 // 今天和昨天都没学 → 连续中断
    cursor = y
  }
  let streak = 0
  while (set.has(cursor)) {
    streak += 1
    cursor = addDays(cursor, -1)
  }
  return streak
}

/** 收集进度中所有非空的 lastStudied 日期（供计算连续天数并入日期集合）。 */
export function collectStudyDates(progress: Record<string, WordProgress>): string[] {
  const out: string[] = []
  for (const p of Object.values(progress)) {
    if (p.lastStudied) out.push(p.lastStudied)
  }
  return out
}
