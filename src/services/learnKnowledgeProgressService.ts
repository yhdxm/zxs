// 学习中心「知识库」学习进度服务（复用 public.learn_progress，module='degree_knowledge'）
// 云端优先 + localStorage 镜像兜底；与背单词卡/四六级/备考台进度完全隔离。
import { supabase, getSavedUser } from './appDataService'
import { listProgress, setProgress, removeProgress } from './learnDb'

const MODULE = 'degree_knowledge'
const LS_KEY = 'degree_kb_progress_v1'

export interface KnowledgeProgressState {
  done: string[]
  doing: string[]
}

function lsKey(userId: string) {
  return `${LS_KEY}_${userId}`
}
function lsGet(userId: string): KnowledgeProgressState {
  try {
    let v = localStorage.getItem(lsKey(userId))
    if (!v) {
      // 兼容旧版未按账号隔离的 localStorage key
      v = localStorage.getItem(LS_KEY)
    }
    if (v) return JSON.parse(v) as KnowledgeProgressState
  } catch {
    /* ignore */
  }
  return { done: [], doing: [] }
}
function lsSet(userId: string, state: KnowledgeProgressState) {
  try {
    localStorage.setItem(lsKey(userId), JSON.stringify(state))
  } catch {
    /* ignore */
  }
}

async function getUserId(): Promise<string> {
  const u = await getSavedUser()
  return u?.id || 'anonymous'
}

async function syncStateToCloud(userId: string, state: KnowledgeProgressState): Promise<void> {
  const rows = [
    ...state.done.map((id) => ({
      user_id: userId,
      module: MODULE,
      item_id: id,
      status: 'done' as const,
      score: 100,
      updated_at: new Date().toISOString()
    })),
    ...state.doing.map((id) => ({
      user_id: userId,
      module: MODULE,
      item_id: id,
      status: 'doing' as const,
      score: 0,
      updated_at: new Date().toISOString()
    }))
  ]
  if (!rows.length) return
  const { error } = await supabase.from('learn_progress').upsert(rows, { onConflict: 'user_id,module,item_id' })
  if (error) throw error
}

export async function loadKnowledgeProgress(): Promise<KnowledgeProgressState> {
  const userId = await getUserId()
  const localState = lsGet(userId)
  try {
    const rows = await listProgress(MODULE)
    if (rows.length > 0) {
      const done = rows.filter((r) => r.status === 'done').map((r) => r.item_id)
      const doing = rows.filter((r) => r.status === 'doing').map((r) => r.item_id)
      const state = { done, doing }
      lsSet(userId, state)
      return state
    }
    // 云端为空但本地有旧数据 -> 自动反哺云端，避免用户进度"丢失"
    if (localState.done.length > 0 || localState.doing.length > 0) {
      await syncStateToCloud(userId, localState)
    }
    lsSet(userId, localState)
    return localState
  } catch {
    return localState
  }
}

async function mutateLocal(mutate: (s: KnowledgeProgressState) => void): Promise<void> {
  const userId = await getUserId()
  const state = lsGet(userId)
  mutate(state)
  lsSet(userId, state)
}

export async function markLessonDone(lessonId: string, done: boolean): Promise<void> {
  await mutateLocal((s) => {
    if (done) {
      if (!s.done.includes(lessonId)) s.done.push(lessonId)
      s.doing = s.doing.filter((x) => x !== lessonId)
    } else {
      s.done = s.done.filter((x) => x !== lessonId)
    }
  })
  if (done) {
    await setProgress(MODULE, lessonId, 'done', 100)
  } else {
    await removeProgress(MODULE, lessonId)
  }
}

export async function markLessonDoing(lessonId: string, doing: boolean): Promise<void> {
  await mutateLocal((s) => {
    if (doing) {
      if (!s.doing.includes(lessonId)) s.doing.push(lessonId)
    } else {
      s.doing = s.doing.filter((x) => x !== lessonId)
    }
  })
  if (doing) {
    await setProgress(MODULE, lessonId, 'doing', 0)
  } else {
    await removeProgress(MODULE, lessonId)
  }
}
