// 三模块（学习中心背单词卡 / 学习中心四六级 / 备考台）各自的「单词学习设置」+「连续学习天数」。
// 采用 localStorage 镜像：免费、离线可用、无需新增数据库表。
// 备注：degree 模块的 newPerDay 仍以云端 degree_settings 为准（备考设置里改），其余两项（remindDue / graduatedReturn）
//       与本服务统一存本地，保证三模块设置各自独立、互不串。
import { todayStr, addDays } from '../prep/trainingSrs'

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
const STREAK_KEY = 'study_module_streak_v1'

type SettingsMap = Record<string, StudySettings>
type StreakMap = Record<string, { streak: number; lastDate: string }>

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
 * 连续学习天数：每次评分调用。
 * - 今天已记过 → 不变；
 * - 昨天记过 → +1；
 * - 否则（断签或首次）→ 归 1。
 */
export function bumpStreak(module: StudyModule): number {
  const map = lsGet<StreakMap>(STREAK_KEY, {})
  const today = todayStr()
  const cur = map[module] ?? { streak: 0, lastDate: '' }
  let streak = cur.streak
  if (cur.lastDate === today) {
    /* 今天已计入，保持不变 */
  } else if (cur.lastDate === addDays(today, -1)) {
    streak += 1
  } else {
    streak = 1
  }
  map[module] = { streak, lastDate: today }
  lsSet(STREAK_KEY, map)
  return streak
}

/** 读取当前连续学习天数（用于看板展示）。 */
export function getStreak(module: StudyModule): number {
  const map = lsGet<StreakMap>(STREAK_KEY, {})
  return map[module]?.streak ?? 0
}
