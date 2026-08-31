// 三模块（学习中心背单词卡 / 学习中心四六级 / 备考台）各自的「单词学习设置」+「连续学习天数 / 今日已学」。
//
// 2026-08-31 改造：设置项（newPerDay / remindDue / graduatedReturn）上云。
//   - getStudySettings() 仍保持同步签名，读 localStorage 镜像，保证调用方零改动、UI 不卡。
//   - saveStudySettings() 同步写 LS + debounce 写云端（Supabase study_module_settings 表）。
//   - syncStudySettingsFromCloud() 从云端拉取并更新 LS；若云端为空且本地有非默认设置，自动迁移上传。
//   - 这样 PC 端改设置后，手机切回前台即可同步；Realtime 生效时更可实时同步。
//
// 「连续天数」与「今日已学」仍从云端单词进度派生，规则不变。
//
// ⚠️ 项目铁律 2（跨端同步，详见 src/config/projectRules.ts）：
//   设备无关的统计指标一律从云端进度派生，禁止用 localStorage 累加同步类计数。
//   后续任何新模块若需「今日 X / 连续 N 天 / 累计 Y」等指标，必须沿用此派生模式，不得回退到本地计数。
import { todayStr, addDays } from '../prep/trainingSrs'
import type { WordProgress } from '../prep/degreeTypes'
import { supabase, getSavedUser } from './appDataService'

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
const CLOUD_FLUSH_MS = 1000 // 连续拖动滑块时，1 秒内只写一次云端

const ALL_MODULES: StudyModule[] = ['learn', 'cet', 'degree']

/** 三个模块的默认值（云端无数据时回退）。 */
export const DEFAULTS: StudySettings = { newPerDay: 15, remindDue: true, graduatedReturn: false }

type SettingsMap = Record<string, StudySettings>

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

function isValidModule(m: string): m is StudyModule {
  return ALL_MODULES.includes(m as StudyModule)
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

/* ===================== 云端同步 ===================== */

let flushTimer: ReturnType<typeof setTimeout> | null = null
const pending = new Map<StudyModule, StudySettings>()

function rowFrom(module: StudyModule, s: StudySettings, userId: string) {
  return {
    user_id: userId,
    module,
    new_per_day: s.newPerDay,
    remind_due: s.remindDue,
    graduated_return: s.graduatedReturn,
    updated_at: new Date().toISOString()
  }
}

async function flushToCloud() {
  const user = await getSavedUser()
  if (!user?.id || user.id === 'anonymous') return
  if (pending.size === 0) return

  const rows = Array.from(pending.entries()).map(([module, s]) => rowFrom(module, s, user.id))
  pending.clear()

  const { error } = await supabase
    .from('study_module_settings')
    .upsert(rows, { onConflict: 'user_id,module' })

  if (error) {
    console.warn('[studySettings] 云端写入失败，下次同步重试', error.message)
  }
}

function scheduleFlush() {
  if (flushTimer) clearTimeout(flushTimer)
  flushTimer = setTimeout(() => {
    flushTimer = null
    void flushToCloud()
  }, CLOUD_FLUSH_MS)
}

/** 保存某模块设置（局部更新）。同步写 LS，debounce 写云端。 */
export function saveStudySettings(module: StudyModule, partial: Partial<StudySettings>): StudySettings {
  const map = lsGet<SettingsMap>(SETTINGS_KEY, {})
  const cur = map[module] ?? ({ ...DEFAULTS } as StudySettings)
  const next: StudySettings = { ...cur, ...partial }
  map[module] = next
  lsSet(SETTINGS_KEY, map)

  pending.set(module, next)
  scheduleFlush()
  return next
}

/** 立即把当前 LS 中的三模块设置刷到云端（供用户显式点击「同步」或切后台前调用）。 */
export async function flushStudySettingsNow(): Promise<void> {
  if (flushTimer) {
    clearTimeout(flushTimer)
    flushTimer = null
  }
  const user = await getSavedUser()
  if (!user?.id || user.id === 'anonymous') return
  const map = lsGet<SettingsMap>(SETTINGS_KEY, {})
  const rows = ALL_MODULES.filter((m) => map[m]).map((m) => rowFrom(m, map[m]!, user.id))
  if (rows.length === 0) return
  const { error } = await supabase.from('study_module_settings').upsert(rows, { onConflict: 'user_id,module' })
  if (error) console.warn('[studySettings] 强制刷云失败', error.message)
}

/**
 * 从云端同步设置到本地 LS。
 * - 若云端有数据而本地不同 → 覆盖本地
 * - 若云端无数据而本地有非默认设置 → 自动迁移上传
 * - 返回「本地是否发生了变化」，调用方可据此决定是否重渲染相关 UI
 */
export async function syncStudySettingsFromCloud(): Promise<boolean> {
  const user = await getSavedUser()
  if (!user?.id || user.id === 'anonymous') return false

  const localMap = lsGet<SettingsMap>(SETTINGS_KEY, {})
  const { data, error } = await supabase
    .from('study_module_settings')
    .select('module,new_per_day,remind_due,graduated_return,updated_at')
    .eq('user_id', user.id)

  if (error) {
    console.warn('[studySettings] 从云端同步失败', error.message)
    return false
  }

  const cloudMap = new Map<StudyModule, StudySettings>()
  for (const row of data || []) {
    const m = row.module
    if (!isValidModule(m)) continue
    cloudMap.set(m, {
      newPerDay: row.new_per_day ?? DEFAULTS.newPerDay,
      remindDue: row.remind_due ?? DEFAULTS.remindDue,
      graduatedReturn: row.graduated_return ?? DEFAULTS.graduatedReturn
    })
  }

  let changed = false
  const toUpload: { module: StudyModule; settings: StudySettings }[] = []

  for (const m of ALL_MODULES) {
    const local = localMap[m]
    const cloud = cloudMap.get(m)

    if (!cloud) {
      // 云端没有，尝试把本地非默认设置迁移上去
      if (local && JSON.stringify(local) !== JSON.stringify(DEFAULTS)) {
        toUpload.push({ module: m, settings: local })
      }
      continue
    }

    if (!local || JSON.stringify(local) !== JSON.stringify(cloud)) {
      localMap[m] = cloud
      changed = true
    }
  }

  if (toUpload.length > 0) {
    const rows = toUpload.map(({ module, settings }) => rowFrom(module, settings, user.id))
    const { error: upError } = await supabase
      .from('study_module_settings')
      .upsert(rows, { onConflict: 'user_id,module' })
    if (!upError) changed = true
  }

  if (changed) lsSet(SETTINGS_KEY, localMap)
  return changed
}

/* ===================== 统计函数（从云端进度派生，未改动） ===================== */

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
