// 学习中心「四六级单词」进度服务
// 数据落 public.cet_word_progress（按 user_id + level 隔离）。
// 云端不可达时使用 localStorage 镜像兜底，保证本机可用。
import { supabase, getSavedUser } from './appDataService'

export interface CetWordProgress {
  status: 'new' | 'learning' | 'graduated'
  level: number
  due: string | null
  weak: boolean
  wrongStreak?: number
}

function lsKey(level: string, userId: string) {
  return `cet_word_progress_${level}_${userId}`
}
function lsGet<T>(level: string, userId: string, fallback: T): T {
  try {
    const v = localStorage.getItem(lsKey(level, userId))
    return v ? (JSON.parse(v) as T) : fallback
  } catch {
    return fallback
  }
}
function lsSet(level: string, userId: string, val: unknown) {
  try {
    localStorage.setItem(lsKey(level, userId), JSON.stringify(val))
  } catch { /* ignore */ }
}

async function getUserId(): Promise<string | null> {
  const u = await getSavedUser()
  return u?.id ?? null
}

/** 读取某级别全部进度。 */
export async function loadCetProgress(level: 'cet4' | 'cet6'): Promise<Record<string, CetWordProgress>> {
  const userId = await getUserId()
  if (!userId) return lsGet(level, 'anonymous', {})
  try {
    const { data, error } = await supabase
      .from('cet_word_progress')
      .select('*')
      .eq('user_id', userId)
      .eq('level', level)
    if (error) throw error
    const out: Record<string, CetWordProgress> = {}
    for (const r of (data as any[]) || []) {
      out[r.word] = {
        status: r.status,
        level: r.score ?? 0,
        due: r.due ?? null,
        weak: r.weak ?? false,
        wrongStreak: r.wrong_streak ?? 0
      }
    }
    lsSet(level, userId, out)
    return out
  } catch {
    return lsGet(level, userId, {})
  }
}

/** 保存单个单词进度。 */
export async function saveCetProgress(
  level: 'cet4' | 'cet6',
  word: string,
  p: CetWordProgress
): Promise<void> {
  const userId = await getUserId()
  if (!userId) {
    const all = lsGet<Record<string, CetWordProgress>>(level, 'anonymous', {})
    all[word] = p
    lsSet(level, 'anonymous', all)
    return
  }
  const all = lsGet<Record<string, CetWordProgress>>(level, userId, {})
  all[word] = p
  lsSet(level, userId, all)
  try {
    await supabase.from('cet_word_progress').upsert(
      {
        user_id: userId,
        level,
        word,
        status: p.status,
        score: p.level,
        due: p.due,
        weak: p.weak,
        wrong_streak: p.wrongStreak ?? 0,
        updated_at: new Date().toISOString()
      },
      { onConflict: 'user_id,level,word' }
    )
  } catch { /* 本地镜像已更新，云端失败由 syncWatcher 不兜底（cet 目前未接入 reliability 队列）；但本地可用 */ }
}
