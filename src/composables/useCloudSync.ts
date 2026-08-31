// 统一云端刷新通道（跨端同步的关键）
//
// 背景：此前只有 DashboardView 一个页面做了「切回前台 / 聚焦 / 联网 / Realtime」四重重拉，
// 其余 20+ 视图都是 onMounted 拉一次就结束 —— PC 端写入云端后，移动端停留在旧快照。
//
// 用法（组件 setup 内）：
//   useCloudSync({
//     tables: ['learn_word_progress', 'learn_progress'],
//     reload: async () => { ...重新拉数据... }
//   })
//
// 触发时机：
//   1) onMounted          首次进入立即拉（immediate 可关，交给组件自己的 onMounted）
//   2) visibilitychange   手机切后台再切回 / 切换 App（移动端最关键的触发点）
//   3) focus              浏览器窗口重新获得焦点
//   4) online             断网恢复
//   5) Realtime           另一台设备写入后服务端主动推送
//
// 内置去重 + 节流：Realtime 可能短时间密集推送，避免请求风暴。

import { onBeforeUnmount, onMounted, ref } from 'vue'
import { getSavedUser } from '../services/appDataService'
import { subscribeTables, type CloudChangeEvent } from '../services/cloudSyncService'

export interface UseCloudSyncOptions {
  /** 需要监听云端变更的表名（Supabase public schema，须含 user_id 列） */
  tables?: string[]
  /** 重新拉取数据的回调 */
  reload: () => void | Promise<void>
  /** onMounted 是否立即拉一次，默认 true；若组件自己 onMounted 已加载，可设为 false */
  immediate?: boolean
  /** 后续重拉的节流间隔（毫秒），默认 800 */
  throttleMs?: number
}

export function useCloudSync(options: UseCloudSyncOptions) {
  const { tables = [], reload, immediate = true, throttleMs = 800 } = options

  const userId = ref('')
  const syncing = ref(false)
  const lastSyncAt = ref(0)
  const lastError = ref<string | null>(null)

  let unsubTables: (() => void) | null = null
  let timer: ReturnType<typeof setTimeout> | null = null
  let inFlight = false
  let disposed = false

  async function runReload(): Promise<void> {
    if (disposed || inFlight) return
    inFlight = true
    syncing.value = true
    try {
      await reload()
      lastSyncAt.value = Date.now()
      lastError.value = null
    } catch (error) {
      lastError.value = error instanceof Error ? error.message : String(error)
    } finally {
      inFlight = false
      syncing.value = false
    }
  }

  /** 节流调度：多次触发合并为一次，避免 Realtime 风暴 */
  function scheduleReload(): void {
    if (disposed) return
    if (timer) return
    timer = setTimeout(() => {
      timer = null
      void runReload()
    }, throttleMs)
  }

  /** 手动立即刷新（切 tab、提交后立即生效等场景） */
  function refresh(): void {
    if (timer) {
      clearTimeout(timer)
      timer = null
    }
    void runReload()
  }

  const onVisibility = () => {
    // 手机切后台再回来：移动端最高频、也最容易被忽略的同步时机
    if (typeof document !== 'undefined' && document.visibilityState === 'visible') scheduleReload()
  }
  const onFocus = () => scheduleReload()
  const onOnline = () => scheduleReload()
  const onRemote = (_e: CloudChangeEvent) => scheduleReload()

  onMounted(async () => {
    const user = await getSavedUser()
    // 未登录或落到 anonymous：不订阅（订阅 anonymous 会收到所有匿名设备的数据）
    if (!user?.id || user.id === 'anonymous') {
      userId.value = ''
      if (immediate) void runReload()
      return
    }
    userId.value = user.id

    if (immediate) await runReload()

    if (tables.length) {
      unsubTables = subscribeTables(user.id, tables, onRemote)
    }

    if (typeof window !== 'undefined') {
      window.addEventListener('visibilitychange', onVisibility)
      window.addEventListener('focus', onFocus)
      window.addEventListener('online', onOnline)
    }
  })

  onBeforeUnmount(() => {
    disposed = true
    if (timer) {
      clearTimeout(timer)
      timer = null
    }
    if (unsubTables) {
      unsubTables()
      unsubTables = null
    }
    if (typeof window !== 'undefined') {
      window.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('focus', onFocus)
      window.removeEventListener('online', onOnline)
    }
  })

  return { userId, syncing, lastSyncAt, lastError, refresh }
}
