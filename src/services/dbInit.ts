import { getSavedUser, loadDashboardData, type AppDashboardData } from './appDataService'

let bootstrapDone = false

/**
 * 确保指定用户的工作台数据行存在：
 * - 若 Supabase 已有记录或本地缓存存在，直接返回；
 * - 若不存在则创建默认数据并持久化（Supabase 或本地降级）。
 *
 * 配合 appDataService 的优雅降级，无需手动执行任何 SQL。
 */
export async function ensureDashboardRow(userId: string): Promise<AppDashboardData> {
  return loadDashboardData(userId)
}

/**
 * 应用启动时调用一次：若当前已登录（localStorage 存在 smart-dashboard-user），
 * 自动确保该用户的工作台数据行存在。即使 Supabase 不可达，也会在本地建立数据行，
 * 保证进入工作台后的 CRUD 永远可用。
 */
export async function initDatabase(): Promise<void> {
  if (bootstrapDone) {
    return
  }
  bootstrapDone = true

  try {
    const user = await getSavedUser()
    if (user?.id) {
      await ensureDashboardRow(user.id)
    }
  } catch (error) {
    console.warn('[dbInit] 初始化工作台数据失败（已降级到本地）', error)
  }
}
