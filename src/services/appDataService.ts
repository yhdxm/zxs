// Supabase 客户端统一从 lib 引入，避免多处重复创建
import { supabase } from '../lib/supabaseClient'
import { isolatedSupabase } from '../lib/supabaseIsolated'
import type { AiConfig } from './aiService'

export { supabase }

import { APP_MENU, type SideItem } from '../config/appMenu'

export type UserRole = 'superadmin' | 'admin' | 'user'

/** 权限平台：pc 或 mobile */
export type PermissionPlatform = 'pc' | 'mobile'

export interface PermissionNode {
  key: string
  label: string
  children?: PermissionNode[]
}

export interface RoleConfig {
  key: UserRole | string
  name: string
  description?: string
  permissions: string[]
}

export interface PermissionConfig {
  roles: RoleConfig[]
  /** 权限方案版本。v2 起权限 key 细粒度化（每个菜单独立 key），用于旧配置自动迁移 */
  version?: number
}

export interface AppUser {
  id: string
  email: string
  username: string
  nickname: string
  role: UserRole
  disabled: boolean
  /** 关联 Supabase Auth 用户 id（uuid）。旧存量账号可能为空，需判空处理 */
  authUserId?: string | null
  /** 用户实际权限 key 列表（缓存），为空时按 role 取默认角色权限 */
  permissions?: string[]
}

export type TodoPriority = 'low' | 'medium' | 'high'
export type TodoStatus = 'todo' | 'doing' | 'done'
export type PointStatus = 'pending' | 'done' | 'issue'
/** 内容完成状态：未完成 / 已完成（看板统计剔除 done） */
export type ContentStatus = 'undone' | 'done'

export interface TodoItem {
  id: string
  title: string
  /** 状态：未开始 / 进行中 / 已完成 */
  status: TodoStatus
  /** 优先级：低/中/高 */
  priority: TodoPriority
  /** 备注说明 */
  note?: string
  /** 业务日期（用于日历/趋势展示），缺省时回退到 createdAt 的日期部分 */
  date?: string
  createdAt: string
}

export interface PointItem {
  id: string
  name: string
  address: string
  note: string
  /** 分类，如 门店/仓库/站点 */
  category?: string
  /** 巡查状态：待巡查/已巡查/异常 */
  status: PointStatus
  /** 业务日期，缺省时回退到 createdAt 的日期部分 */
  date?: string
  createdAt: string
}

export interface ContentItem {
  id: string
  title: string
  content: string
  /** 分类，如 日报/周报/笔记 */
  category?: string
  /** 标签，逗号分隔 */
  tags?: string
  date: string
  time: string
  image: string
  createdAt: string
  /** 完成状态：未完成 / 已完成（看板统计剔除 done） */
  status?: ContentStatus
}

export interface AppDashboardData {
  todos: TodoItem[]
  points: PointItem[]
  contents: ContentItem[]
}

const AUTH_KEY = 'smart-dashboard-user'

/** ===== 权限树：由全局菜单配置（APP_MENU）自动派生 =====
 *  与 App.vue 侧边栏菜单保持 100% 同步。新增菜单项即自动出现在权限树中，
 *  无需手动维护（满足「权限管理要自动添加」需求）。
 */
function buildPermissionTree(menu: SideItem[]): PermissionNode[] {
  const tree: PermissionNode[] = []
  for (const node of menu) {
    if (!node.permissionKey && !node.children) continue
    if (node.children && node.children.length > 0) {
      const children: PermissionNode[] = []
      for (const child of node.children) {
        if (!child.permissionKey) continue
        children.push({
          key: child.permissionKey,
          label: child.label,
          children: [
            { key: `${child.permissionKey}.pc`, label: 'PC端' },
            { key: `${child.permissionKey}.mobile`, label: '移动端' }
          ]
        })
      }
      if (children.length > 0) {
        tree.push({ key: node.key, label: node.label, children })
      }
    } else if (node.permissionKey) {
      tree.push({
        key: node.permissionKey,
        label: node.label,
        children: [
          { key: `${node.permissionKey}.pc`, label: 'PC端' },
          { key: `${node.permissionKey}.mobile`, label: '移动端' }
        ]
      })
    }
  }
  return tree
}

export const PERMISSION_TREE: PermissionNode[] = buildPermissionTree(APP_MENU)

function collectPermissionKeys(nodes: PermissionNode[]): string[] {
  const keys: string[] = []
  const walk = (list: PermissionNode[]) => {
    list.forEach((node) => {
      if (!node.children || node.children.length === 0) {
        keys.push(node.key)
      } else {
        walk(node.children)
      }
    })
  }
  walk(nodes)
  return keys
}

const ALL_PERMISSION_KEYS = collectPermissionKeys(PERMISSION_TREE)

/** 已知权限基础 key 集合（用于未知模块安全放行，避免配置漂移导致锁死） */
const KNOWN_BASE_KEYS = new Set(ALL_PERMISSION_KEYS.map((k) => k.replace(/\.(pc|mobile)$/, '')))

/** 提取权限 key 的基础模块名（去掉 .pc / .mobile 后缀） */
const baseKeyOf = (k: string): string => k.replace(/\.(pc|mobile)$/, '')

/** 普通用户默认可访问的模块（仅个人数据类，与「账号级数据隔离」一致） */
const USER_ALLOWED_BASES = new Set<string>([
  'news', 'yingcang', 'xingyu', 'weather', 'map', 'third-api',
  'learn-english', 'learn-industry', 'learn-books',
  'requirements', 'dashboard', 'todos', 'points', 'contents',
  'feedback'
])

export const DEFAULT_ROLE_CONFIG: PermissionConfig = {
  version: 2,
  roles: [
    {
      key: 'superadmin',
      name: '超级管理员',
      description: '系统最高权限，可管理所有账号、角色与业务数据。',
      permissions: [...ALL_PERMISSION_KEYS]
    },
    {
      key: 'admin',
      name: '管理员',
      description: '可进入系统管理与数据库监测，管理普通用户账号与业务数据。',
      permissions: ALL_PERMISSION_KEYS.filter((k) => !k.startsWith('system.roles.') && !k.startsWith('feedback.admin.'))
    },
    {
      key: 'user',
      name: '普通用户',
      description: '仅可操作自己的数据，数据与其他账号相互隔离。',
      permissions: ALL_PERMISSION_KEYS.filter((k) => USER_ALLOWED_BASES.has(baseKeyOf(k)))
    }
  ]
}

/** 当前权限方案版本：v2 起权限 key 细粒度化（每个菜单一个独立 key） */
export const PERMISSION_SCHEMA_VERSION = 2

/**
 * v1 → v2 权限迁移映射。
 * v1 时期 `dashboard` / `ai` 是两个粗粒度大权限，覆盖了下面这些页面；
 * v2 拆成每页独立 key 后，需要把老配置里的粗粒度权限自动展开，
 * 否则老账号升级后左侧菜单会大面积消失。
 */
const LEGACY_KEY_EXPANSION: Record<string, string[]> = {
  dashboard: [
    'dashboard',
    'news', 'yingcang', 'xingyu', 'weather', 'map', 'third-api',
    'learn-english', 'learn-industry', 'learn-books',
    'requirements'
  ],
  ai: ['ai', 'models', 'aimodels']
}

/** 把 v1 粗粒度权限列表展开为 v2 细粒度权限列表（幂等；只增不减，保证升级不掉权限） */
export function migratePermissionList(perms: string[]): string[] {
  const out = new Set(perms)
  const allKeys = new Set(ALL_PERMISSION_KEYS)
  perms.forEach((k) => {
    const m = /^(.*)\.(pc|mobile)$/.exec(k)
    if (!m) return
    const legacyBase = m[1] ?? ''
    const platform = m[2] ?? ''
    const expansion = LEGACY_KEY_EXPANSION[legacyBase]
    if (!expansion) return
    expansion.forEach((base: string) => {
      const nk = `${base}.${platform}`
      if (allKeys.has(nk)) out.add(nk)
    })
  })
  return [...out]
}

/**
 * 归一化配置：
 * 1. 老版本（无 version 或 < 2）配置自动做 v1→v2 权限迁移，避免升级后菜单消失；
 * 2. 超级管理员始终拥有全部权限，避免配置漂移导致锁死；
 * 3. 不再强制为普通用户/管理员注入默认权限，管理员在权限页保存什么就是什么，
 *    登录后的默认落地页 /welcome 与 /account 本就不受权限树控制，不会出现死循环。
 */
function normalizeConfig(cfg: PermissionConfig): PermissionConfig {
  if ((cfg.version ?? 1) < PERMISSION_SCHEMA_VERSION) {
    cfg.roles.forEach((r) => {
      r.permissions = migratePermissionList(r.permissions || [])
    })
    cfg.version = PERMISSION_SCHEMA_VERSION
  }
  const sa = cfg.roles.find((r) => r.key === 'superadmin')
  if (sa) sa.permissions = [...ALL_PERMISSION_KEYS]
  return cfg
}

/** 读取全局角色权限配置（优先 app_settings 表，其次 admin profile，最后默认） */
export async function loadPermissionConfig(): Promise<PermissionConfig> {
  try {
    const { data, error } = await supabase.from('app_settings').select('value').eq('key', 'role_config').maybeSingle()
    if (!error && data?.value) {
      const cfg = data.value as PermissionConfig
      if (Array.isArray(cfg.roles)) return normalizeConfig(cfg)
    }
  } catch {
    // ignore
  }

  try {
    const { data, error } = await supabase.from('profiles').select('role_config').eq('user_id', 'admin-default').maybeSingle()
    if (!error && data?.role_config) {
      const cfg = data.role_config as PermissionConfig
      if (Array.isArray(cfg.roles)) return normalizeConfig(cfg)
    }
  } catch {
    // ignore
  }

  return JSON.parse(JSON.stringify(DEFAULT_ROLE_CONFIG)) as PermissionConfig
}

/** 保存全局角色权限配置（优先 app_settings 表，失败则写入 admin profile） */
export async function savePermissionConfig(config: PermissionConfig): Promise<boolean> {
  // 标记为当前权限方案版本，避免下次加载时被重复迁移（尊重管理员手动取消的权限）
  config.version = PERMISSION_SCHEMA_VERSION
  try {
    const { error } = await supabase.from('app_settings').upsert(
      { key: 'role_config', value: config as unknown as Record<string, unknown>, updated_at: new Date().toISOString() },
      { onConflict: 'key' }
    )
    if (!error) return true
  } catch {
    // ignore
  }

  try {
    const { error } = await supabase.from('profiles').upsert(
      { user_id: 'admin-default', role_config: config as unknown as Record<string, unknown>, updated_at: new Date().toISOString() },
      { onConflict: 'user_id' }
    )
    return !error
  } catch {
    return false
  }
}

/** 权限集合缓存（菜单渲染会高频调用 hasPermission，避免重复计算）
 *  注意：这里不再做 v1→v2 的 legacy expansion。权限迁移只在配置加载时
 *  由 normalizeConfig 做一次；运行时如果再展开，会导致「勾了 AI 助手就
 *  自动拥有 AI模型知识」这类权限泄漏。
 */
const effectivePermCache = new Map<string, Set<string>>()
function effectivePermSet(perms: string[]): Set<string> {
  const cacheKey = perms.join('|')
  let set = effectivePermCache.get(cacheKey)
  if (!set) {
    set = new Set(perms)
    if (effectivePermCache.size > 50) effectivePermCache.clear()
    effectivePermCache.set(cacheKey, set)
  }
  return set
}

/** 获取某角色的默认权限 key 列表 */
export function getRolePermissions(role: UserRole | string, config?: PermissionConfig): string[] {
  const cfg = config || DEFAULT_ROLE_CONFIG
  const roleCfg = cfg.roles.find((r) => r.key === role)
  return roleCfg ? [...roleCfg.permissions] : []
}

/** 判断用户是否拥有某模块/某平台的权限 */
export function hasPermission(
  user: AppUser | null,
  moduleKey: string,
  platform: PermissionPlatform = 'pc',
  config?: PermissionConfig
): boolean {
  if (!user) return false
  // 未知模块（如后续新增页面尚未登记到权限树）默认放行，避免配置漂移导致锁死
  if (!KNOWN_BASE_KEYS.has(moduleKey)) return true
  const key = `${moduleKey}.${platform}`
  const raw = user.permissions && user.permissions.length > 0 ? user.permissions : getRolePermissions(user.role, config)
  // v1→v2 迁移已在 normalizeConfig / getSavedUser 中完成，运行时直接按精确 key 匹配，
  // 避免把 ai.pc 重新展开成 aimodels.pc 导致权限泄漏。
  const perms = effectivePermSet(raw)
  if (perms.has(key)) return true
  // 父模块兜底：如 system 没有 system.pc/mobile 叶子节点，
  // 只要拥有 system.accounts.pc/mobile 或 system.roles.pc/mobile 等子权限，即视为有权限
  const prefix = `${moduleKey}.`
  const suffix = `.${platform}`
  for (const k of perms) {
    if (k.startsWith(prefix) && k.endsWith(suffix)) return true
  }
  return false
}

/** 判断用户是否拥有某模块任一平台的权限（用于菜单显示） */
export function hasModulePermission(
  user: AppUser | null,
  moduleKey: string,
  config?: PermissionConfig
): boolean {
  return hasPermission(user, moduleKey, 'pc', config) || hasPermission(user, moduleKey, 'mobile', config)
}

/* ===== 数据库检测：真实数据量统计 ===== */
export interface TableRowStat {
  name: string
  rows: number
  /** 该表（含索引）占用的物理存储字节数；未执行精确统计时为 0 */
  sizeBytes?: number
  /** 该表是否启用了行级安全（RLS）；仅精确统计（RPC）可返回，降级路径为 undefined */
  rlsEnabled?: boolean
  /** 所属模式（schema）；精确统计（RPC）返回，降级路径为 undefined。仅 public 模式下的业务表才纳入 RLS 告警 */
  schema?: string
}

export interface DatabaseStats {
  connected: boolean
  dbSizeBytes?: number
  tables: TableRowStat[]
  apiNote: string
  apiUrl: string
  error?: string
  /** 检测时间戳（毫秒），用于前端展示「检测时间」 */
  checkedAt: number
  /** 数据库容量上限（字节）；free 计划为 500MB，升级后由用户在检测页手动忽略 */
  limitBytes: number
}

/**
 * 读取 Supabase 数据库真实统计：
 * - 数据库大小与表行数优先通过 RPC `get_database_stats`（需在 Supabase 执行 scripts/supabase_stats.sql 创建）
 * - 未创建该函数时降级为逐表 count
 * - API 网关请求量 Supabase 不对外暴露，引导到 Dashboard 查看
 */
export async function getDatabaseStats(): Promise<DatabaseStats> {
  const FREE_DB_LIMIT = 500 * 1024 * 1024 // Supabase Free 计划数据库容量 500MB
  const result: DatabaseStats = {
    connected: false,
    tables: [],
    apiNote: 'Supabase 不直接对外暴露 API 网关请求量，请在项目 Dashboard → API 设置中查看实时统计。',
    apiUrl: 'https://app.supabase.com',
    checkedAt: Date.now(),
    limitBytes: FREE_DB_LIMIT
  }
  try {
    // 该 RPC 返回 json 标量（非表），不要用 maybeSingle()（那是为「返回表的 0/1 行」设计的）。
    // Supabase 对标量函数可能直接返回 json 对象，也可能包一层 { get_database_stats: {...} }，两种都兼容解析。
    const { data, error } = await supabase.rpc('get_database_stats')
    interface RpcTableStat {
      name: string
      rows: number
      size_bytes?: number
      rls_enabled?: boolean
      schema?: string
    }
    interface RpcStatsPayload {
      db_size_bytes?: number
      tables?: RpcTableStat[]
      get_database_stats?: RpcStatsPayload
    }
    const raw = (data ?? null) as RpcStatsPayload | null
    const payload: RpcStatsPayload | null = raw?.get_database_stats ? raw.get_database_stats : raw
    if (!error && payload) {
      result.dbSizeBytes = Number(payload.db_size_bytes) || 0
      if (Array.isArray(payload.tables)) {
        result.tables = payload.tables.map((t: RpcTableStat) => ({
          name: t.name,
          rows: Number(t.rows) || 0,
          sizeBytes: Number(t.size_bytes) || 0,
          rlsEnabled: t.rls_enabled === true,
          schema: t.schema
        }))
      }
    } else {
      // 降级：逐表统计行数（API 不存在时）
      const tables = [
        'app_dashboard_data',
        'profiles',
        'app_accounts',
        'app_settings',
        'news_daily',
        'external_ideas',
        'automation_info',
        'free_model_catalog',
        'ai_keys',
        'model_usage',
        'custom_free_models',
        'shared_free_api_keys',
        'car_watchlist',
        'model_bookmarks',
        'learn_progress',
        'learn_bookmarks',
        'learn_reading',
        'third_party_apis',
        'api_grants',
        'api_usage_logs',
        'feedbacks',
        'feedback_replies'
      ]
      for (const name of tables) {
        try {
          const { count } = await supabase.from(name).select('*', { count: 'exact', head: true })
          result.tables.push({ name, rows: Number(count) || 0, schema: 'public' })
        } catch {
          result.tables.push({ name, rows: 0, schema: 'public' })
        }
      }
    }
    result.connected = true
  } catch (e) {
    result.error = e instanceof Error ? e.message : String(e)
  }
  return result
}

export const createDefaultDashboardData = (): AppDashboardData => {
  const today = new Date().toISOString().slice(0, 10)
  return {
    todos: [
      { id: createId('todo'), title: '确认今日待办事项', status: 'todo', priority: 'high', note: '上班后第一件事', date: today, createdAt: new Date().toISOString() },
      { id: createId('todo'), title: '更新点位信息', status: 'doing', priority: 'medium', date: today, createdAt: new Date().toISOString() }
    ],
    points: [
      { id: createId('point'), name: '主入口', address: '总部大楼 1 层', note: '上午重点巡查', category: '门店', status: 'pending', date: today, createdAt: new Date().toISOString() }
    ],
    contents: [
      {
        id: createId('content'),
        title: '今日处理说明',
        content: '请把今天的重要事项整理后同步到工作台。',
        category: '日报',
        tags: '日常,同步',
        date: today,
        time: '09:00',
        image: '',
        createdAt: new Date().toISOString()
      }
    ]
  }
}

function createId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}-${Date.now().toString(36)}`
}

function getStoredUser(): AppUser | null {
  if (typeof window === 'undefined') {
    return null
  }

  const raw = window.localStorage.getItem(AUTH_KEY)
  if (!raw) {
    return null
  }

  try {
    const parsed = JSON.parse(raw) as AppUser
    if (!parsed.id || !parsed.username) return null
    return {
      ...parsed,
      role: parsed.role || 'user',
      disabled: Boolean(parsed.disabled)
    }
  } catch {
    return null
  }
}

function setStoredUser(user: AppUser) {
  if (typeof window === 'undefined') {
    return
  }

  window.localStorage.setItem(AUTH_KEY, JSON.stringify(user))
}

function clearStoredUser() {
  if (typeof window === 'undefined') {
    return
  }

  window.localStorage.removeItem(AUTH_KEY)
}

/**
 * 校验数据结构（三类数组均存在），避免脏数据。
 */
function normalizeTodoStatus(item: Record<string, unknown>): TodoStatus {
  // 兼容旧数据：done: true -> done，done: false -> todo
  if (item.status === 'todo' || item.status === 'doing' || item.status === 'done') {
    return item.status as TodoStatus
  }
  if (item.done === true) return 'done'
  return 'todo'
}

function sanitizeDashboardData(raw: unknown): AppDashboardData | null {
  if (!raw || typeof raw !== 'object') {
    return null
  }
  const obj = raw as Partial<AppDashboardData>
  if (!Array.isArray(obj.todos) || !Array.isArray(obj.points) || !Array.isArray(obj.contents)) {
    return null
  }
  return {
    todos: obj.todos.map((t) => ({ ...(t as TodoItem), status: normalizeTodoStatus(t as unknown as Record<string, unknown>) })) as TodoItem[],
    points: obj.points as PointItem[],
    contents: obj.contents.map((c) => {
      const item = c as ContentItem
      const status = item.status === 'done' ? 'done' : 'undone'
      return { ...item, status }
    }) as ContentItem[]
  }
}

async function ensureProfile(userId: string, nickname: string) {
  const { error } = await supabase.from('profiles').upsert(
    {
      user_id: userId,
      nickname,
      created_at: new Date().toISOString()
    },
    { onConflict: 'user_id' }
  )

  if (error) {
    console.warn('profile sync failed', error.message)
  }
}

async function fetchProfile(userId: string) {
  const { data, error } = await supabase.from('profiles').select('nickname').eq('user_id', userId).maybeSingle()
  if (error) {
    return null
  }
  return data
}

const ACCOUNT_CORE_COLUMNS = 'id, username, nickname, created_at'
const ACCOUNT_FULL_COLUMNS = `${ACCOUNT_CORE_COLUMNS}, role, disabled`

/**
 * 查询账号，兼容旧表结构（可能缺少 role/disabled 列）。
 * 先尝试查完整列，若因列不存在失败则回退到核心列。
 */
async function getAccountByAuthId(authUserId: string): Promise<Record<string, unknown> | null> {
  const { data, error } = await supabase
    .from('app_accounts')
    .select(ACCOUNT_FULL_COLUMNS)
    .eq('auth_user_id', authUserId)
    .maybeSingle()

  if (!error) {
    return data
  }

  // 旧表尚无 auth_user_id 列时，降级按 id 查找（兼容迁移过渡期）
  const msg = String(error.message || '').toLowerCase()
  if (msg.includes('column') || msg.includes('does not exist') || msg.includes('auth_user_id')) {
    const { data: coreData, error: coreError } = await supabase
      .from('app_accounts')
      .select(ACCOUNT_CORE_COLUMNS)
      .eq('id', authUserId)
      .maybeSingle()
    if (!coreError) {
      return coreData
    }
  }

  return null
}

/** 将 Supabase Auth 的错误映射为中文用户提示 */
function mapAuthError(error: { message?: string }): string {
  const msg = String(error?.message || '').toLowerCase()
  if (msg.includes('invalid login') || msg.includes('invalid credentials')) return '账号或密码错误'
  if (msg.includes('already registered') || msg.includes('already been registered')) return '用户名已存在'
  if (msg.includes('confirm') && msg.includes('email')) {
    return '邮箱确认未关闭，请在 Supabase 控制台 Authentication → Providers → Email 关闭 Confirm email'
  }
  if (msg.includes('signup') || msg.includes('sign up')) return '注册被拒绝，请确认 Supabase Auth 已启用'
  return error?.message || '操作失败'
}

function normalizeRole(value: unknown): UserRole {
  if (value === 'superadmin' || value === 'admin' || value === 'user') return value
  return 'user'
}

function toAppUser(account: Record<string, unknown>, profileNickname?: string | null): AppUser {
  const nickname = profileNickname || String(account.nickname || '') || String(account.username || '')
  const username = String(account.username || '')
  // 兼容旧表：若 role/disabled 列不存在，给默认值；admin 用户默认 superadmin
  const hasRole = account.role !== undefined
  const role: UserRole = hasRole
    ? normalizeRole(account.role)
    : username === 'admin'
      ? 'superadmin'
      : 'user'
  const disabled = account.disabled === undefined ? false : Boolean(account.disabled)
  return {
    id: String(account.id || ''),
    authUserId: account.auth_user_id ? String(account.auth_user_id) : null,
    email: username,
    username,
    nickname,
    role,
    disabled
  }
}


// 生成高强度随机密码（用于首次初始化默认管理员，避免写死弱口令）
function generateRandomPassword(length = 16): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'
  const bytes = new Uint8Array(length)
  crypto.getRandomValues(bytes)
  let out = ''
  for (let i = 0; i < length; i++) {
    out += chars[bytes[i]! % chars.length]
  }
  return out
}

function getErrorMessage(error: unknown, fallback: string) {
  if (typeof error === 'string' && error.trim()) {
    return error
  }

  if (error && typeof error === 'object' && 'message' in error && typeof (error as { message?: unknown }).message === 'string') {
    return (error as { message: string }).message
  }

  return fallback
}

/**
 * 首次使用时创建默认超级管理员（admin）。
 * 底层改用 Supabase Auth：signUp admin@zxs.local，再由 RLS 策略隔离。
 * 返回生成的初始密码（若配置了 VITE_ADMIN_DEFAULT_PASSWORD 则返回该值）。
 * 严禁写死弱口令；未配置则随机生成并打印到控制台，请登录后立即修改。
 */
export async function initDefaultAdmin(): Promise<string> {
  // 防御：超级管理员已存在则直接跳过，绝不重新创建或重置密码。
  // 保证任何部署/刷新都不会影响已在后台改过的 admin 账号。
  try {
    const { data: existing } = await supabase
      .from('app_accounts')
      .select('id')
      .eq('username', 'admin')
      .maybeSingle()
    if (existing && existing.id) {
      console.info('[init] 超级管理员已存在，跳过初始化，不修改任何密码。')
      return ''
    }
  } catch (e) {
    console.warn('[init] 检查管理员是否存在时失败，继续尝试初始化', e)
  }

  const normalizedUsername = 'admin'
  const password =
    import.meta.env.VITE_ADMIN_DEFAULT_PASSWORD ||
    (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function'
      ? generateRandomPassword()
      : 'Admin-' + Math.random().toString(36).slice(2, 10))

  if (!import.meta.env.VITE_ADMIN_DEFAULT_PASSWORD) {
    console.warn(
      '[init] 未配置 VITE_ADMIN_DEFAULT_PASSWORD，已生成随机默认管理员密码：',
      password,
      '（请登录后立即修改）'
    )
  }

  const email = `${normalizedUsername}@zxs.local`
  const { data: signUpData, error: signUpErr } = await supabase.auth.signUp({ email, password })
  if (signUpErr) {
    throw new Error(getErrorMessage(signUpErr, '初始化默认管理员失败'))
  }
  const uid = signUpData.user?.id
  if (!uid) {
    throw new Error('初始化失败：未返回用户，请确认 Supabase Auth 已启用')
  }

  const { error: insErr } = await supabase.from('app_accounts').insert({
    id: uid,
    auth_user_id: uid,
    username: normalizedUsername,
    nickname: '系统管理员',
    role: 'superadmin',
    disabled: false
  })
  if (insErr) {
    const msg = String(insErr.message || '').toLowerCase()
    // 账号行已存在（重复初始化）属正常情况，忽略
    if (!msg.includes('duplicate') && !msg.includes('unique') && !msg.includes('already')) {
      throw new Error(getErrorMessage(insErr, '初始化失败，请确认已运行 scripts/rls_secure.sql'))
    }
  }

  return password
}

/**
 * 首次登录时若管理员不存在则自动初始化，并返回初始密码用于引导登录。
 */
export async function bootstrapAdminIfNeeded(): Promise<{ needed: boolean; password?: string }> {
  try {
    const password = await initDefaultAdmin()
    if (!password) {
      // 管理员已存在，无需初始化
      return { needed: false }
    }
    return { needed: true, password }
  } catch (err) {
    const msg = String(err instanceof Error ? err.message : '').toLowerCase()
    if (msg.includes('already registered') || msg.includes('already been')) {
      return { needed: false }
    }
    throw err
  }
}

export async function registerUser(username: string, password: string, nickname: string): Promise<AppUser> {
  const normalizedUsername = username.trim().toLowerCase()
  if (!/^[A-Za-z0-9_]{4,20}$/.test(normalizedUsername)) {
    throw new Error('用户名为 4-20 位字母、数字或下划线')
  }
  if (!password || password.length < 6 || password.length > 32) {
    throw new Error('密码长度为 6-32 位')
  }

  const email = `${normalizedUsername}@zxs.local`
  const { data: signUpData, error: signUpErr } = await supabase.auth.signUp({ email, password })
  if (signUpErr) {
    throw new Error(mapAuthError(signUpErr))
  }
  const uid = signUpData.user?.id
  if (!uid) {
    throw new Error('注册失败：未返回用户')
  }

  const displayNickname = nickname.trim() || normalizedUsername
  const { error: insErr } = await supabase.from('app_accounts').insert({
    id: uid,
    auth_user_id: uid,
    username: normalizedUsername,
    nickname: displayNickname,
    role: 'user',
    disabled: false
  })
  if (insErr) {
    // 档案行写入失败（如唯一冲突）不影响认证登录，仅告警
    console.warn('[register] app_accounts 写入失败', insErr.message)
  }

  await ensureProfile(uid, displayNickname)
  const user: AppUser = {
    id: uid,
    authUserId: uid,
    email: normalizedUsername,
    username: normalizedUsername,
    nickname: displayNickname,
    role: 'user',
    disabled: false
  }
  const roleConfig = await loadPermissionConfig()
  user.permissions = getRolePermissions(user.role, roleConfig)
  setStoredUser(user)
  return user
}

export async function loginUser(username: string, password: string): Promise<AppUser> {
  const normalizedUsername = username.trim().toLowerCase()
  const email = `${normalizedUsername}@zxs.local`
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) {
    throw new Error(mapAuthError(error))
  }
  const uid = data.user?.id
  if (!uid) {
    throw new Error('登录失败：未获取到用户')
  }

  const account = await getAccountByAuthId(uid)
  if (!account) {
    throw new Error('账号不存在，请联系管理员')
  }
  if (account.disabled === true) {
    throw new Error('账号已被禁用，请联系管理员')
  }

  const profile = await fetchProfile(uid)
  const user = toAppUser(account, profile?.nickname)
  // 加载角色权限配置并缓存到用户对象
  const roleConfig = await loadPermissionConfig()
  user.permissions = getRolePermissions(user.role, roleConfig)
  setStoredUser(user)
  return user
}

export async function logoutUser() {
  try {
    await supabase.auth.signOut()
  } catch {
    // 忽略登出异常
  }
  clearStoredUser()
}

/**
 * 加载工作台数据，带优雅降级：
 * 1. 优先从 Supabase 读取；
 * 2. Supabase 出错时回退本地缓存；
 * 3. 均无数据时创建默认数据并持久化（Supabase 或本地）。
 * 永远返回可用数据，保证 CRUD 不会因网络问题而中断。
 */
export async function loadDashboardData(userId: string): Promise<AppDashboardData> {
  try {
    const { data, error } = await supabase.from('app_dashboard_data').select('payload').eq('user_id', userId).maybeSingle()
    if (error) {
      console.warn('[dashboard] Supabase 读取失败，返回默认数据', error.message)
      return createDefaultDashboardData()
    }

    if (data?.payload) {
      const parsed = sanitizeDashboardData(data.payload)
      if (parsed) {
        return parsed
      }
    }

    const fallback = createDefaultDashboardData()
    await saveDashboardData(userId, fallback)
    return fallback
  } catch (error) {
    console.warn('[dashboard] Supabase 异常，返回默认数据', error)
    return createDefaultDashboardData()
  }
}

/**
 * 保存工作台数据，带优雅降级：
 * 1. 任何情况下都先写入本地缓存，确保 CRUD 始终可用；
 * 2. 再尽力写入 Supabase（失败仅告警，不影响本地）。
 */
/**
 * 保存工作台数据到 Supabase 数据库（唯一真实数据源）。
 * 不再写入本地缓存，所有待办/点位/内容均存储于云端。
 * 返回 boolean：true = 已成功同步到云端；false = 云端不可用（数据暂存内存，恢复网络后重试）。
 */
export async function saveDashboardData(userId: string, data: AppDashboardData): Promise<boolean> {
  try {
    const { error } = await supabase.from('app_dashboard_data').upsert(
      {
        user_id: userId,
        payload: data,
        updated_at: new Date().toISOString()
      },
      { onConflict: 'user_id' }
    )

    if (error) {
      console.warn('[dashboard] Supabase 写入失败', error.message)
      return false
    }
    return true
  } catch (error) {
    console.warn('[dashboard] Supabase 写入异常', error)
    return false
  }
}

export type DashboardChangeEvent = 'INSERT' | 'UPDATE' | 'DELETE'

/**
 * 订阅该用户工作台数据的实时变更（Supabase Realtime）。
 * 当同一账号在 PC 或移动端的任一设备完成增删改，服务端会推送变更，
 * 另一端通过 onEvent 回调收到后重新拉取最新数据，从而实现「跨端实时同步」。
 * 返回取消订阅的函数；若实时能力不可用（如未启用发布），返回空函数，降级为按需刷新。
 */
export function subscribeDashboardChanges(
  userId: string,
  onEvent: (event: DashboardChangeEvent) => void
): () => void {
  try {
    const channel = supabase
      .channel(`dashboard:${userId}:${Math.random().toString(36).slice(2, 8)}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'app_dashboard_data',
          filter: `user_id=eq.${userId}`
        },
        (payload: { eventType?: string; new?: Record<string, unknown>; old?: Record<string, unknown> }) => {
          const newUserId = payload?.new?.user_id
          const oldUserId = payload?.old?.user_id
          // 客户端按 user_id 二次过滤，避免匿名策略下收到其他用户变更
          if (newUserId !== userId && oldUserId !== userId) {
            return
          }
          const type = payload?.eventType
          const event: DashboardChangeEvent =
            type === 'INSERT' ? 'INSERT' : type === 'DELETE' ? 'DELETE' : 'UPDATE'
          onEvent(event)
        }
      )
      .subscribe()

    return () => {
      try {
        supabase.removeChannel(channel)
      } catch {
        // 忽略取消订阅异常
      }
    }
  } catch (error) {
    console.warn('[dashboard] 实时订阅初始化失败，降级为可见性刷新', error)
    return () => {}
  }
}

async function buildUserFromSession(session: { user: { id: string } }): Promise<AppUser | null> {
  const uid = session.user.id
  try {
    const account = await getAccountByAuthId(uid)
    if (!account) {
      return null
    }
    const profile = await fetchProfile(uid)
    const user = toAppUser(account, profile?.nickname)
    const roleConfig = await loadPermissionConfig()
    user.permissions = getRolePermissions(user.role, roleConfig)
    setStoredUser(user)
    return user
  } catch {
    return null
  }
}

export async function getSavedUser(): Promise<AppUser | null> {
  const { data } = await supabase.auth.getSession()
  if (!data.session) {
    return null
  }
  const cached = getStoredUser()
  if (cached && cached.id === data.session.user.id) {
    // 角色权限配置可能已被超管修改，必须重新按最新配置计算权限，
    // 否则返回旧快照会导致「改了角色权限、其他账号登录不生效」的问题。
    // 仅重算权限字段，其余用户信息沿用缓存以减少会话重建开销。
    try {
      const roleConfig = await loadPermissionConfig()
      cached.permissions = getRolePermissions(cached.role, roleConfig)
      setStoredUser(cached) // 写回缓存，避免新标签页/下次读取仍拿旧权限
    } catch {
      // 读取失败则沿用缓存中的权限，不阻断登录
    }
    return cached
  }
  return await buildUserFromSession(data.session)
}

/** 从 Supabase Auth 会话刷新当前登录用户（会话恢复 / 路由切换时调用） */
export async function refreshSavedUser(): Promise<AppUser | null> {
  const { data } = await supabase.auth.getSession()
  if (!data.session) {
    clearStoredUser()
    return null
  }
  return await buildUserFromSession(data.session)
}

export interface AccountRecord {
  id: string
  authUserId: string | null
  username: string
  nickname: string
  role: UserRole
  disabled: boolean
  createdBy: string | null
  createdAt: string
}

const toAccountRecord = (row: Record<string, unknown>): AccountRecord => {
  const username = String(row.username || '')
  const hasRole = row.role !== undefined
  const role: UserRole = hasRole ? normalizeRole(row.role) : username === 'admin' ? 'superadmin' : 'user'
  return {
    id: String(row.id || ''),
    authUserId: row.auth_user_id ? String(row.auth_user_id) : null,
    username,
    nickname: String(row.nickname || ''),
    role,
    disabled: row.disabled === undefined ? false : Boolean(row.disabled),
    createdBy: row.created_by ? String(row.created_by) : null,
    createdAt: String(row.created_at || '')
  }
}

async function listAccountsCore(columns: string): Promise<AccountRecord[]> {
  const { data, error } = await supabase.from('app_accounts').select(columns).order('created_at', { ascending: false })
  if (error) {
    throw new Error(getErrorMessage(error, '查询账号失败'))
  }
  return ((data || []) as unknown as Record<string, unknown>[]).map((row) => toAccountRecord(row))
}

export async function listAccounts(): Promise<AccountRecord[]> {
  const { data, error } = await supabase.rpc('list_accounts_for_admin')
  if (error) {
    throw new Error(getErrorMessage(error, '查询账号失败'))
  }
  return ((data || []) as unknown as Record<string, unknown>[]).map((row) => toAccountRecord(row))
}

async function searchAccountsCore(keyword: string, columns: string): Promise<AccountRecord[]> {
  const kw = keyword.trim().toLowerCase()
  if (!kw) return listAccountsCore(columns)
  const { data, error } = await supabase.from('app_accounts').select(columns).ilike('username', `%${kw}%`).order('created_at', { ascending: false })
  if (error) {
    throw new Error(getErrorMessage(error, '查询账号失败'))
  }
  return ((data || []) as unknown as Record<string, unknown>[]).map((row) => toAccountRecord(row))
}

export async function searchAccountsByUsername(keyword: string): Promise<AccountRecord[]> {
  const { data, error } = await supabase.rpc('search_accounts_for_admin', { kw: keyword.trim().toLowerCase() })
  if (error) {
    throw new Error(getErrorMessage(error, '查询账号失败'))
  }
  return ((data || []) as unknown as Record<string, unknown>[]).map((row) => toAccountRecord(row))
}

export async function createAccountByAdmin(params: {
  username: string
  password: string
  nickname: string
  role: UserRole
  createdBy: string
}): Promise<AccountRecord> {
  const normalizedUsername = params.username.trim().toLowerCase()
  if (!/^[A-Za-z0-9_]{4,20}$/.test(normalizedUsername)) {
    throw new Error('用户名为 4-20 位字母、数字或下划线')
  }
  if (!params.password || params.password.length < 6 || params.password.length > 32) {
    throw new Error('密码长度为 6-32 位')
  }

  // 0) 保存当前超管会话。即使隔离客户端的广播事件污染了主客户端，
  // 创建完新用户后也能立刻恢复，确保后续超管 RPC 携带正确的 JWT。
  const { data: currentSession } = await supabase.auth.getSession()
  const adminAccessToken = currentSession.session?.access_token
  const adminRefreshToken = currentSession.session?.refresh_token

  // 1) 在隔离的 Supabase 客户端创建认证用户，避免顶替当前超管会话。
  // 若用主客户端 signUp，新用户会话会覆盖 localStorage 中的 token，导致后续
  // 超管 RPC（create_account_by_admin）因权限不足而失败，最终出现"账号不存在"。
  const { data: signUpData, error: signUpErr } = await isolatedSupabase.auth.signUp({
    email: `${normalizedUsername}@zxs.local`,
    password: params.password
  })
  if (signUpErr) {
    throw new Error(mapAuthError(signUpErr))
  }
  const uid = signUpData.user?.id
  if (!uid) {
    throw new Error('创建账号失败：未返回用户')
  }

  // 1.5) 立即恢复超管会话
  if (adminAccessToken && adminRefreshToken) {
    await supabase.auth.setSession({
      access_token: adminAccessToken,
      refresh_token: adminRefreshToken
    })
  }

  // 2) 写入应用档案（仅超管可调用的 SECURITY DEFINER 函数）
  const { error: rpcErr } = await supabase.rpc('create_account_by_admin', {
    p_auth_user_id: uid,
    p_username: normalizedUsername,
    p_nickname: params.nickname.trim() || normalizedUsername,
    p_role: params.role,
    p_disabled: false
  })
  if (rpcErr) {
    // 档案写入失败时清理已创建的认证用户，避免留下"能登录但无档案"的孤儿账号
    // 注：supabase.rpc() 返回的是 PostgrestFilterBuilder（thenable，无 .catch），需用 try/catch
    try {
      await supabase.rpc('delete_account_by_admin', { p_auth_user_id: uid })
    } catch {
      // 忽略清理失败，优先抛出原始错误
    }
    throw new Error(getErrorMessage(rpcErr, '创建账号失败'))
  }

  return {
    id: uid,
    authUserId: uid,
    username: normalizedUsername,
    nickname: params.nickname.trim() || normalizedUsername,
    role: params.role,
    disabled: false,
    createdBy: params.createdBy,
    createdAt: new Date().toISOString()
  }
}

export async function updateAccount(params: {
  id: string
  nickname?: string
  role?: UserRole
  password?: string
}): Promise<void> {
  // 1) 昵称 / 角色走管理员 RPC
  if (params.nickname || params.role) {
    const { error } = await supabase.rpc('update_account_by_admin', {
      p_auth_user_id: params.id,
      p_nickname: params.nickname ?? null,
      p_role: params.role ?? null,
      p_disabled: null
    })
    if (error) {
      throw new Error(getErrorMessage(error, '更新账号失败'))
    }
  }
  // 2) 密码：超级管理员重置他人密码，走专用 RPC（函数内校验 superadmin 权限）
  if (params.password) {
    const { error } = await supabase.rpc('admin_set_user_password', {
      p_target_user_id: params.id,
      p_new_password: params.password
    })
    if (error) {
      throw new Error(getErrorMessage(error, '重置密码失败：仅超级管理员可操作'))
    }
  }
}

/**
 * 修改当前登录用户【自己】的密码。
 * 直接调用 Supabase Auth 的 updateUser，作用于 auth.users，登录即立即生效。
 * 注意：必须是已登录会话（个人设置页满足）。改其他账号密码需 service_role 后台，前端无法实现。
 */
export async function changeOwnPassword(password: string): Promise<void> {
  if (!password || password.length < 6 || password.length > 32) {
    throw new Error('密码长度为 6-32 位')
  }
  const { error } = await supabase.auth.updateUser({ password })
  if (error) {
    throw new Error(mapAuthError(error))
  }
}

export async function toggleAccountDisabled(id: string, disabled: boolean): Promise<void> {
  const { error } = await supabase.rpc('set_account_disabled', { p_auth_user_id: id, p_disabled: disabled })
  if (error) {
    throw new Error(getErrorMessage(error, '操作失败'))
  }
}

export async function deleteAccount(id: string): Promise<void> {
  const { error } = await supabase.rpc('delete_account_by_admin', { p_auth_user_id: id })
  if (error) {
    throw new Error(getErrorMessage(error, '删除账号失败'))
  }
}

/**
 * 读取账号级 AI 配置（存于 profiles.ai_config，仅含非敏感项）。
 * 注意：apiKey 已从云端移除，统一以本地 localStorage 为准，此处不再返回密钥，
 * 避免数据库被拖库或 RLS 配置失误导致密钥泄露被盗刷。
 */
export async function loadProfileAiConfig(userId: string): Promise<Partial<AiConfig> | null> {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('ai_config')
      .eq('user_id', userId)
      .maybeSingle()

    if (error) {
      console.warn('[profile] 读取 ai_config 失败', error.message)
      return null
    }

    const cfg = data?.ai_config as Record<string, unknown> | null
    if (!cfg || typeof cfg !== 'object') {
      return null
    }

    return {
      provider: cfg.provider as AiConfig['provider'],
      baseUrl: typeof cfg.baseUrl === 'string' ? cfg.baseUrl : '',
      model: typeof cfg.model === 'string' ? cfg.model : '',
      systemPrompt: typeof cfg.systemPrompt === 'string' ? cfg.systemPrompt : '',
      // 密钥已从云端移除，统一以本地 localStorage 为准
      apiKey: ''
    }
  } catch (error) {
    console.warn('[profile] 读取 ai_config 异常', error)
    return null
  }
}

/**
 * 保存账号级 AI 配置到 profiles（云端）。
 * 安全约定：apiKey 不再持久化到云端，仅存储于本地 localStorage，
 * 故此处将云端 ai_config.apiKey 置为 null 以主动清空历史残留的密钥。
 * profiles 行在注册时已通过 ensureProfile 创建，此处仅 update ai_config 列。
 */
export async function saveProfileAiConfig(userId: string, config: AiConfig) {
  try {
    const { error } = await supabase
      .from('profiles')
      .update({
        ai_config: {
          provider: config.provider,
          baseUrl: config.baseUrl,
          model: config.model,
          systemPrompt: config.systemPrompt,
          apiKey: null // 密钥不上云：主动清空云端残留密钥
        }
      })
      .eq('user_id', userId)

    if (error) {
      console.warn('[profile] 保存 ai_config 失败', error.message)
    }
  } catch (error) {
    console.warn('[profile] 保存 ai_config 异常', error)
  }
}

/* =========================================================================
 * 看板统计口径（M6）
 * 规则：
 * - 新增 = createdAt 日期 === 今日（本地时区）的条目数
 * - 总条数 count = max(0, 全量剔除不计入状态后 − 新增)
 * - 剔除规则：点位剔除 done(已巡查)，内容剔除 done(已完成)，待办 done 仍计入
 * ========================================================================= */

export interface ModuleCount {
  /** 条数（全量） */
  total: number
  /** 新增（createdAt 日期 === 今日） */
  newCount: number
  /** 总条数 = max(0, 剔除不计入状态后 − 新增) */
  count: number
}

export interface DashboardCounts {
  todos: ModuleCount
  points: ModuleCount
  contents: ModuleCount
}

function isToday(iso: string): boolean {
  if (!iso) return false
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return false
  const now = new Date()
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  )
}

/** 计算看板统计口径（点位剔除已巡查、内容剔除已完成；待办 done 仍计入） */
export function computeDashboardCounts(d: AppDashboardData): DashboardCounts {
  const todoTotal = d.todos.length
  const todoNew = d.todos.filter((t) => isToday(t.createdAt)).length

  const pointAll = d.points.filter((p) => p.status !== 'done').length // 剔除 已巡查
  const pointNew = d.points.filter((p) => p.status !== 'done' && isToday(p.createdAt)).length

  const contentAll = d.contents.filter((c) => (c.status ?? 'undone') !== 'done').length // 剔除 已完成
  const contentNew = d.contents.filter((c) => (c.status ?? 'undone') !== 'done' && isToday(c.createdAt)).length

  return {
    todos: {
      total: todoTotal,
      newCount: todoNew,
      count: Math.max(0, todoTotal - todoNew)
    },
    points: {
      total: pointAll,
      newCount: pointNew,
      count: Math.max(0, pointAll - pointNew)
    },
    contents: {
      total: contentAll,
      newCount: contentNew,
      count: Math.max(0, contentAll - contentNew)
    }
  }
}

/* =========================================================================
 * app_settings 读写（M8：自动化缓存保留天数等）
 * 仅认证用户可读写；失败兼容降级（返回默认值 / 静默忽略）
 * ========================================================================= */

/** 读取应用级配置项；未配置或出错时返回 null */
export async function getAppSetting(key: string): Promise<unknown> {
  if (!key) return null
  try {
    const { data, error } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', key)
      .maybeSingle()
    if (error) {
      console.warn('[appSettings] 读取失败', error.message)
      return null
    }
    return data?.value ?? null
  } catch (e) {
    console.warn('[appSettings] 读取异常', e)
    return null
  }
}

/** 写入应用级配置项（upsert） */
export async function setAppSetting(key: string, value: unknown): Promise<void> {
  if (!key) return
  try {
    const { error } = await supabase.from('app_settings').upsert(
      { key, value: value as unknown as Record<string, unknown>, updated_at: new Date().toISOString() },
      { onConflict: 'key' }
    )
    if (error) {
      console.warn('[appSettings] 写入失败', error.message)
    }
  } catch (e) {
    console.warn('[appSettings] 写入异常', e)
  }
}

/* =========================================================================
 * 免费模型目录（free_model_catalog 表，M4）
 * 登录可读；写仅超管（此处前端只读取 / 本地兜底）
 * ========================================================================= */

export interface FreeModelCatalog {
  provider: string
  model: string
  endpoint?: string
  is_free: boolean
  free_quota?: string
  status: 'callable' | 'limited' | 'unavailable' | 'unknown'
  last_checked?: string
  note?: string
}

/** 读取免费模型目录（登录可读），失败返回空数组 */
export async function loadFreeModelCatalog(): Promise<FreeModelCatalog[]> {
  try {
    const { data, error } = await supabase
      .from('free_model_catalog')
      .select('*')
      .order('provider', { ascending: true })
    if (error) {
      console.warn('[freeCatalog] 读取失败', error.message)
      return []
    }
    return (data || []) as unknown as FreeModelCatalog[]
  } catch (e) {
    console.warn('[freeCatalog] 读取异常', e)
    return []
  }
}

/* =========================================================================
 * 自动化信息缓存（automation_info 表，M8）
 * RLS：本人 auth.uid() = user_id 读写
 * ========================================================================= */

export interface AutomationInfo {
  id: string
  user_id: string
  category?: string
  title: string
  content?: string
  url?: string
  source?: string
  extra?: Record<string, unknown>
  fetched_at: string
  expire_at: string
}

/** 列出当前用户的自动化信息缓存（按获取时间倒序） */
export async function listAutomationInfo(userId: string): Promise<AutomationInfo[]> {
  if (!userId) return []
  try {
    const { data, error } = await supabase
      .from('automation_info')
      .select('*')
      .eq('user_id', userId)
      .order('fetched_at', { ascending: false })
    if (error) {
      console.warn('[automation] 读取失败', error.message)
      return []
    }
    return (data || []) as unknown as AutomationInfo[]
  } catch (e) {
    console.warn('[automation] 读取异常', e)
    return []
  }
}

/** 批量保存（upsert）自动化信息缓存 */
export async function saveAutomationInfo(userId: string, rows: AutomationInfo[]): Promise<void> {
  if (!userId || rows.length === 0) return
  try {
    const payload = rows.map((r) => ({
      id: r.id,
      user_id: userId,
      category: r.category ?? null,
      title: r.title,
      content: r.content ?? null,
      url: r.url ?? null,
      source: r.source ?? null,
      extra: (r.extra ?? null) as unknown as Record<string, unknown> | null,
      fetched_at: r.fetched_at,
      expire_at: r.expire_at
    }))
    const { error } = await supabase.from('automation_info').upsert(payload, { onConflict: 'id' })
    if (error) {
      console.warn('[automation] 保存失败', error.message)
    }
  } catch (e) {
    console.warn('[automation] 保存异常', e)
  }
}

/** 删除单条自动化信息缓存 */
export async function deleteAutomationInfo(userId: string, id: string): Promise<void> {
  if (!userId || !id) return
  try {
    const { error } = await supabase.from('automation_info').delete().eq('user_id', userId).eq('id', id)
    if (error) {
      console.warn('[automation] 删除失败', error.message)
    }
  } catch (e) {
    console.warn('[automation] 删除异常', e)
  }
}

/** 清空该用户全部自动化信息缓存；返回实际删除条数 */
export async function clearAllAutomationInfo(userId: string): Promise<number> {
  if (!userId) return 0
  try {
    const { count, error } = await supabase
      .from('automation_info')
      .delete({ count: 'exact' })
      .eq('user_id', userId)
    if (error) {
      console.warn('[automation] 清空失败', error.message)
      return 0
    }
    return Number(count) || 0
  } catch (e) {
    console.warn('[automation] 清空异常', e)
    return 0
  }
}

/**
 * 清理过期的自动化信息缓存（expire_at < 当前时间）。
 * @returns 实际清理的条数
 */
export async function clearExpiredAutomationInfo(userId: string, _days?: number): Promise<number> {
  if (!userId) return 0
  try {
    const { count, error } = await supabase
      .from('automation_info')
      .delete({ count: 'exact' })
      .eq('user_id', userId)
      .lt('expire_at', new Date().toISOString())
    if (error) {
      console.warn('[automation] 清理失败', error.message)
      return 0
    }
    return Number(count) || 0
  } catch (e) {
    console.warn('[automation] 清理异常', e)
    return 0
  }
}

/* =========================================================================
 * 模型额度账本（model_usage 表，M9）
 * 记录阿里百炼免费模型已用 tokens；剩余 = 免费额度 - 已用。
 * RLS：本人 auth.uid() = user_id 读写；原子递增走 add_model_usage RPC（SECURITY DEFINER）。
 * ========================================================================= */

export interface ModelUsageRow {
  model_id: string
  used_tokens: number
  free_quota: number
  free_until: string
}

/** 读取当前登录账号的 auth.uid()（与 AUTH_KEY 中缓存的 id 一致），用于把用量查询收敛到本账号 */
function currentAuthUid(): string {
  if (typeof window === 'undefined') return ''
  try {
    const raw = window.localStorage.getItem(AUTH_KEY)
    if (!raw) return ''
    const u = JSON.parse(raw) as { id?: string }
    return u && u.id ? String(u.id) : ''
  } catch {
    return ''
  }
}

/** 读取单个模型的已用 tokens（未记录返回 0） */
export async function getModelUsage(modelId: string): Promise<number> {
  if (!modelId) return 0
  try {
    const uid = currentAuthUid()
    let query = supabase
      .from('model_usage')
      .select('used_tokens')
      .eq('model_id', modelId)
    // 仅本账号：普通用户由 RLS 自动隔离；超管需显式收敛，避免读到他人聚合
    if (uid) query = query.eq('user_id', uid)
    const { data, error } = await query.maybeSingle()
    if (error) {
      console.warn('[modelUsage] 读取失败', error.message)
      return 0
    }
    return Number((data as { used_tokens?: number } | null)?.used_tokens) || 0
  } catch {
    return 0
  }
}

/** 读取当前用户全部模型已用 tokens，返回 model_id -> used_tokens 映射 */
export async function getAllModelUsage(): Promise<Record<string, number>> {
  const map: Record<string, number> = {}
  try {
    const uid = currentAuthUid()
    let query = supabase
      .from('model_usage')
      .select('model_id, used_tokens')
      .order('model_id', { ascending: true })
    if (uid) query = query.eq('user_id', uid)
    const { data, error } = await query
    if (error) {
      console.warn('[modelUsage] 批量读取失败', error.message)
      return map
    }
    for (const r of (data || []) as Array<{ model_id: string; used_tokens: number }>) {
      map[r.model_id] = Number(r.used_tokens) || 0
    }
  } catch (e) {
    console.warn('[modelUsage] 批量读取异常', e)
  }
  return map
}

/**
 * 记录一次模型调用消耗的 tokens（原子递增到 model_usage）。
 * 仅对阿里百炼免费模型调用，确保额度按真实用量扣减。
 */
export async function addModelUsage(modelId: string, tokens: number): Promise<void> {
  if (!modelId || !tokens || tokens <= 0) return
  try {
    const { error } = await supabase.rpc('add_model_usage', {
      p_model_id: modelId,
      p_tokens: Math.round(tokens)
    })
    if (error) {
      console.warn('[modelUsage] 扣减失败', error.message)
    }
  } catch (e) {
    console.warn('[modelUsage] 扣减异常', e)
  }
}

/**
 * 手动校准某模型已用 tokens（直接 set，不递增）。
 * 用于「模型用完了/剩余不准」时，按真实剩余反算已用 = 免费额度 - 剩余，覆盖本账号自己的记录。
 * 仅 upsert 当前登录账号（user_id 由 RLS/后端取值），不会动他人数据。
 */
export async function setModelUsage(modelId: string, usedTokens: number): Promise<boolean> {
  if (!modelId) return false
  try {
    const uid = currentAuthUid()
    if (!uid) return false
    const { error } = await supabase.from('model_usage').upsert(
      {
        user_id: uid,
        model_id: modelId,
        used_tokens: Math.max(0, Math.floor(usedTokens))
      },
      { onConflict: 'user_id,model_id' }
    )
    if (error) {
      console.warn('[modelUsage] 校准失败', error.message)
      return false
    }
    return true
  } catch (e) {
    console.warn('[modelUsage] 校准异常', e)
    return false
  }
}

/* =========================================================================
 * 自定义免费模型（custom_free_models 表）
 * - 用户自行登记的免费 AI（如 WorkBuddy HY3 等），按账号隔离（RLS 仅本人读写）
 * - 仅搬运数据，不做可用性校验（用户自行保证可调用）
 * ========================================================================= */
export interface CustomFreeModel {
  id: string
  provider: string
  model: string
  baseUrl?: string
  note?: string
  createdAt?: string
}

const toCustomFreeModel = (row: Record<string, unknown>): CustomFreeModel => ({
  id: String(row.id || ''),
  provider: String(row.provider || ''),
  model: String(row.model || ''),
  baseUrl: row.base_url ? String(row.base_url) : undefined,
  note: row.note ? String(row.note) : undefined,
  createdAt: row.created_at ? String(row.created_at) : undefined
})

export async function loadCustomFreeModels(): Promise<CustomFreeModel[]> {
  if (!supabase) return []
  try {
    const { data, error } = await supabase
      .from('custom_free_models')
      .select('id, provider, model, base_url, note, created_at')
      .order('created_at', { ascending: false })
    if (error) {
      console.warn('[customFree] 读取失败', error.message)
      return []
    }
    return (data || []).map((r) => toCustomFreeModel(r as Record<string, unknown>))
  } catch (e) {
    console.warn('[customFree] 读取异常', e)
    return []
  }
}

export async function saveCustomFreeModel(input: {
  provider: string
  model: string
  baseUrl?: string
  note?: string
  id?: string
}): Promise<boolean> {
  if (!supabase || !input.provider || !input.model) return false
  try {
    if (input.id) {
      const { error } = await supabase
        .from('custom_free_models')
        .update({
          provider: input.provider,
          model: input.model,
          base_url: input.baseUrl || null,
          note: input.note || null
        })
        .eq('id', input.id)
      if (error) {
        console.warn('[customFree] 更新失败', error.message)
        return false
      }
    } else {
      const { error } = await supabase.from('custom_free_models').insert({
        provider: input.provider,
        model: input.model,
        base_url: input.baseUrl || null,
        note: input.note || null
      })
      if (error) {
        console.warn('[customFree] 新增失败', error.message)
        return false
      }
    }
    return true
  } catch (e) {
    console.warn('[customFree] 写入异常', e)
    return false
  }
}

export async function deleteCustomFreeModel(id: string): Promise<boolean> {
  if (!supabase || !id) return false
  try {
    const { error } = await supabase.from('custom_free_models').delete().eq('id', id)
    if (error) {
      console.warn('[customFree] 删除失败', error.message)
      return false
    }
    return true
  } catch (e) {
    console.warn('[customFree] 删除异常', e)
    return false
  }
}

/* =========================================================================
 * 账号级 AI API Key 云端存储（ai_keys 表）
 * - 每个账号一行，存前端 AES-GCM 加密后的密文（本模块只搬运密文，不加解密）
 * - RLS：本人可读写自己的；超管可读所有人的；其他账号互不可见
 * - 删除账号时 auth.users 级联删除对应行
 * ========================================================================= */

export interface AiKeyRecord {
  userId: string
  provider: string
  baseUrl: string
  model: string
  encryptedKey: string
  updatedAt: string
}

const toAiKeyRecord = (row: Record<string, unknown>): AiKeyRecord => ({
  userId: String(row.user_id || ''),
  provider: String(row.provider || ''),
  baseUrl: String(row.base_url || ''),
  model: String(row.model || ''),
  encryptedKey: String(row.encrypted_key || ''),
  updatedAt: String(row.updated_at || '')
})

/** 读取当前账号自己的云端 Key（密文），未配置返回 null */
export async function loadOwnAiKey(userId: string): Promise<AiKeyRecord | null> {
  if (!userId) return null
  try {
    const { data, error } = await supabase
      .from('ai_keys')
      .select('user_id, provider, base_url, model, encrypted_key, updated_at')
      .eq('user_id', userId)
      .maybeSingle()
    if (error) {
      console.warn('[aiKeys] 读取失败', error.message)
      return null
    }
    return data ? toAiKeyRecord(data as Record<string, unknown>) : null
  } catch (e) {
    console.warn('[aiKeys] 读取异常', e)
    return null
  }
}

/** 保存当前账号自己的云端 Key（密文 upsert，配置一次跨设备留存） */
export async function saveOwnAiKey(
  userId: string,
  payload: { provider: string; baseUrl: string; model: string; encryptedKey: string }
): Promise<void> {
  if (!userId) return
  try {
    const { error } = await supabase.from('ai_keys').upsert(
      {
        user_id: userId,
        provider: payload.provider,
        base_url: payload.baseUrl,
        model: payload.model,
        encrypted_key: payload.encryptedKey,
        updated_at: new Date().toISOString()
      },
      { onConflict: 'user_id' }
    )
    if (error) {
      console.warn('[aiKeys] 保存失败', error.message)
    }
  } catch (e) {
    console.warn('[aiKeys] 保存异常', e)
  }
}

/** 超管专用：读取所有账号的云端 Key（密文），RLS 保证非超管拿不到别人的 */
export async function listAiKeysForAdmin(): Promise<AiKeyRecord[]> {
  try {
    const { data, error } = await supabase
      .from('ai_keys')
      .select('user_id, provider, base_url, model, encrypted_key, updated_at')
      .order('updated_at', { ascending: false })
    if (error) {
      console.warn('[aiKeys] 总览读取失败', error.message)
      return []
    }
    return ((data || []) as Record<string, unknown>[]).map(toAiKeyRecord)
  } catch (e) {
    console.warn('[aiKeys] 总览读取异常', e)
    return []
  }
}

/** 超管专用：读取所有账号的模型用量，返回 user_id -> (model_id -> used_tokens) */
export async function getAllModelUsageForAdmin(): Promise<Record<string, Record<string, number>>> {
  const map: Record<string, Record<string, number>> = {}
  try {
    const { data, error } = await supabase
      .from('model_usage')
      .select('user_id, model_id, used_tokens')
      .order('model_id', { ascending: true })
    if (error) {
      console.warn('[modelUsage] 总览读取失败', error.message)
      return map
    }
    for (const r of (data || []) as Array<{ user_id: string; model_id: string; used_tokens: number }>) {
      const uid = String(r.user_id)
      if (!map[uid]) map[uid] = {}
      map[uid][r.model_id] = Number(r.used_tokens) || 0
    }
  } catch (e) {
    console.warn('[modelUsage] 总览读取异常', e)
  }
  return map
}
