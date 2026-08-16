// 全局同步看门狗：保证「个人操作数据」无论 PC 还是移动端都最终落到云端，
// 从而实现「任意端查看/修改同步、换设备不用从头来」。
//
// 设计要点：
//   - 离线队列（reliability.ts 的 zxsv2_reli_queue）被 degreeService 与 cetPrepService 共享，
//     故 pending 直接取 reliability.getQueue().length 即可覆盖两套业务。
//   - 触发补发的时机：网络恢复(online)、页面重新可见(visibilitychange)、窗口聚焦(focus)、
//     以及队列非空时的定时重试（8s）。不再只依赖单个页面 onMounted 一次性 flush。
//   - syncState 暴露给 UI：pending(待同步条数) / syncing(补发中) / lastError(最近错误)，
//     供顶栏同步状态提示使用，避免「界面显示已保存、实则只存在本机」的静默丢失。
import { reactive } from 'vue'
import { flushQueue as degFlush } from './degreeService'
import { flushQueue as cetFlush } from '../services/cetPrepService'
import { getQueue } from './reliability'

export const syncState = reactive({
  pending: 0,
  syncing: false,
  lastError: ''
})

function refreshPending(): void {
  try {
    syncState.pending = getQueue().length
  } catch {
    syncState.pending = 0
  }
}

let timerHandle: ReturnType<typeof setTimeout> | null = null
function scheduleRetryIfNeeded(): void {
  refreshPending()
  if (syncState.pending > 0 && timerHandle === null) {
    timerHandle = setTimeout(() => {
      timerHandle = null
      void flushAll()
    }, 8000)
  }
}

/** 补发离线队列（degree + cet 共享同一队列，顺序执行即可）。 */
export async function flushAll(): Promise<void> {
  if (syncState.syncing) return
  syncState.syncing = true
  try {
    // 顺序执行：degFlush 先排空队列并把失败项留回，cetFlush 再处理剩余，避免并发重复入队。
    await degFlush()
    await cetFlush()
  } catch (e) {
    syncState.lastError = e instanceof Error ? e.message : String(e)
  } finally {
    syncState.syncing = false
    scheduleRetryIfNeeded()
  }
}

let started = false
/** 在应用入口（main.ts）调用一次，注册全局补发监听。 */
export function startSyncWatcher(): void {
  if (started || typeof window === 'undefined') return
  started = true

  window.addEventListener('online', () => {
    void flushAll()
  })
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void flushAll()
  })
  window.addEventListener('focus', () => {
    void flushAll()
  })

  // 启动即尝试一次（覆盖「上次关闭时残留的离线队列」）。
  void flushAll()
}
