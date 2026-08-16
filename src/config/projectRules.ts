// 项目级硬约束（铁律）—— 跨会话、跨开发者强制遵守。
// 本文件是规则的「代码化声明」：相关模块在文件顶部用 @see 引用，开发新功能前先读此处。
// 任何新功能/修改若违反以下任一条，视为缺陷，评审时必须拦截。
//
// 这些约束由用户在 2026-08-17 明确要求固化到代码中：
//   1) 数据库有新表 → 监测中心自动完善（无需手动登记）
//   2) 移动端与 PC 端任意模块的数据必须跨端同步、保持一致
//   3) 角色与权限的菜单自动完善和同步（APP_MENU 单一数据源）

/**
 * 铁律 1 · 数据库新表自动完善监测
 * - 监测中心（DatabaseCheckView）基于 Supabase 实时统计自动发现所有 public 业务表；
 * - 未登记说明的表通过 WORD_MAP 智能推测中文说明，缺失说明时仅给 info 级提示，不阻断监测；
 * - 禁止「新增表后必须手动在 TABLE_DESC 登记才能监测」的流程 —— 自动完善是默认行为。
 */

/**
 * 铁律 2 · 移动端与 PC 端数据必须跨端同步、保持一致
 * - 任何「设备无关的用户数据」（学习进度、统计指标、设置等）必须存云端（Supabase），
 *   由同一账号在各端读取同一份数据；
 * - 禁止用 localStorage 存储可被同步的计数 / 统计 / 状态（如「今日已学」「连续天数」）；
 *   本地存储仅允许作为离线镜像兜底，且云端非空时必须以云端为准；
 * - 指标类数据（如「已学 X 个」「连续 N 天」）一律从云端进度派生，不得本地累加。
 */

/**
 * 铁律 3 · 角色与权限的菜单自动完善和同步
 * - 侧边栏菜单与权限树均以 src/config/appMenu.ts 的 APP_MENU 为唯一数据源；
 * - 新增页面只需在 APP_MENU 追加一项（带 permissionKey），PERMISSION_TREE、默认角色权限、
 *   迁移映射全自动派生，无需在 PERMISSION_TREE 手动维护重复项；
 * - 侧边栏可见性与路由门禁统一由 APP_MENU 的 permissionKey / visible 驱动。
 */

export const PROJECT_CONSTRAINTS = {
  /** 铁律 1：监测中心自动发现并完善新表 */
  autoMonitorNewTables: true,
  /** 铁律 2：设备无关数据必须云端存储、跨端同步 */
  crossDeviceSyncRequired: true,
  /** 铁律 3：菜单/权限由 APP_MENU 单一数据源自动派生 */
  menuDrivenPermissions: true
} as const

export type ProjectConstraintKey = keyof typeof PROJECT_CONSTRAINTS
