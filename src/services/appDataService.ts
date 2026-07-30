// Supabase 客户端统一从 lib 引入，避免多处重复创建
import { supabase } from '../lib/supabaseClient'
import type { AiConfig } from './aiService'

export { supabase }

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
}

export interface AppUser {
  id: string
  email: string
  username: string
  nickname: string
  role: UserRole
  disabled: boolean
  /** 用户实际权限 key 列表（缓存），为空时按 role 取默认角色权限 */
  permissions?: string[]
}

export type TodoPriority = 'low' | 'medium' | 'high'
export type TodoStatus = 'todo' | 'doing' | 'done'
export type PointStatus = 'pending' | 'done' | 'issue'

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
}

export interface AppDashboardData {
  todos: TodoItem[]
  points: PointItem[]
  contents: ContentItem[]
}

const AUTH_KEY = 'smart-dashboard-user'

/** ===== 权限树定义 ===== */
export const PERMISSION_TREE: PermissionNode[] = [
  {
    key: 'dashboard',
    label: '数据看板',
    children: [
      { key: 'dashboard.pc', label: 'PC端' },
      { key: 'dashboard.mobile', label: '移动端' }
    ]
  },
  {
    key: 'worktasks',
    label: '工作任务',
    children: [
      {
        key: 'todos',
        label: '待办',
        children: [
          { key: 'todos.pc', label: 'PC端' },
          { key: 'todos.mobile', label: '移动端' }
        ]
      },
      {
        key: 'points',
        label: '点位',
        children: [
          { key: 'points.pc', label: 'PC端' },
          { key: 'points.mobile', label: '移动端' }
        ]
      },
      {
        key: 'contents',
        label: '内容',
        children: [
          { key: 'contents.pc', label: 'PC端' },
          { key: 'contents.mobile', label: '移动端' }
        ]
      }
    ]
  },
  {
    key: 'ai',
    label: 'AI助手',
    children: [
      { key: 'ai.pc', label: 'PC端' },
      { key: 'ai.mobile', label: '移动端' }
    ]
  },
  {
    key: 'database',
    label: '数据库检测',
    children: [
      { key: 'database.pc', label: 'PC端' },
      { key: 'database.mobile', label: '移动端' }
    ]
  },
  {
    key: 'automation',
    label: '自动化',
    children: [
      { key: 'automation.pc', label: 'PC端' },
      { key: 'automation.mobile', label: '移动端' }
    ]
  },
  {
    key: 'system',
    label: '权限管理',
    children: [
      {
        key: 'system.accounts',
        label: '账号管理',
        children: [
          { key: 'system.accounts.pc', label: 'PC端' },
          { key: 'system.accounts.mobile', label: '移动端' }
        ]
      },
      {
        key: 'system.roles',
        label: '角色权限',
        children: [
          { key: 'system.roles.pc', label: 'PC端' },
          { key: 'system.roles.mobile', label: '移动端' }
        ]
      }
    ]
  }
]

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

export const DEFAULT_ROLE_CONFIG: PermissionConfig = {
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
      description: '可进入系统管理与数据库检测，管理普通用户账号与业务数据。',
      permissions: ALL_PERMISSION_KEYS.filter((k) => k !== 'system.roles.pc' && k !== 'system.roles.mobile')
    },
    {
      key: 'user',
      name: '普通用户',
      description: '仅可操作自己的数据，数据与其他账号相互隔离。',
      permissions: ALL_PERMISSION_KEYS.filter((k) => !k.startsWith('system.') && !k.startsWith('database.'))
    }
  ]
}

/** 读取全局角色权限配置（优先 app_settings 表，其次 admin profile，最后默认） */
export async function loadPermissionConfig(): Promise<PermissionConfig> {
  try {
    const { data, error } = await supabase.from('app_settings').select('value').eq('key', 'role_config').maybeSingle()
    if (!error && data?.value) {
      const cfg = data.value as PermissionConfig
      if (Array.isArray(cfg.roles)) return cfg
    }
  } catch {
    // ignore
  }

  try {
    const { data, error } = await supabase.from('profiles').select('role_config').eq('user_id', 'admin-default').maybeSingle()
    if (!error && data?.role_config) {
      const cfg = data.role_config as PermissionConfig
      if (Array.isArray(cfg.roles)) return cfg
    }
  } catch {
    // ignore
  }

  return JSON.parse(JSON.stringify(DEFAULT_ROLE_CONFIG)) as PermissionConfig
}

/** 保存全局角色权限配置（优先 app_settings 表，失败则写入 admin profile） */
export async function savePermissionConfig(config: PermissionConfig): Promise<boolean> {
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
  const key = `${moduleKey}.${platform}`
  const perms = user.permissions && user.permissions.length > 0 ? user.permissions : getRolePermissions(user.role, config)
  if (perms.includes(key)) return true
  // 父模块兜底：如 system 没有 system.pc/mobile 叶子节点，
  // 只要拥有 system.accounts.pc/mobile 或 system.roles.pc/mobile 等子权限，即视为有权限
  return perms.some((k) => k.startsWith(`${moduleKey}.`) && k.endsWith(`.${platform}`))
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
    const { data, error } = await supabase.rpc('get_database_stats').maybeSingle()
    const raw = (data ?? null) as { db_size_bytes?: number; tables?: Array<{ name: string; rows: number; size_bytes?: number }> } | null
    if (!error && raw) {
      result.dbSizeBytes = Number(raw.db_size_bytes) || 0
      if (Array.isArray(raw.tables)) {
        result.tables = raw.tables.map((t) => ({
          name: t.name,
          rows: Number(t.rows) || 0,
          sizeBytes: Number(t.size_bytes) || 0
        }))
      }
    } else {
      // 降级：逐表统计行数（API 不存在时）
      const tables = ['app_dashboard_data', 'profiles', 'app_accounts', 'app_settings', 'news_daily']
      for (const name of tables) {
        try {
          const { count } = await supabase.from(name).select('*', { count: 'exact', head: true })
          result.tables.push({ name, rows: Number(count) || 0 })
        } catch {
          result.tables.push({ name, rows: 0 })
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
    contents: obj.contents as ContentItem[]
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

  // 1) 在 Supabase Auth 创建认证用户
  const { data: signUpData, error: signUpErr } = await supabase.auth.signUp({
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

  // 2) 写入应用档案（仅超管可调用的 SECURITY DEFINER 函数）
  const { error: rpcErr } = await supabase.rpc('create_account_by_admin', {
    p_auth_user_id: uid,
    p_username: normalizedUsername,
    p_nickname: params.nickname.trim() || normalizedUsername,
    p_role: params.role,
    p_disabled: false
  })
  if (rpcErr) {
    throw new Error(getErrorMessage(rpcErr, '创建账号失败'))
  }

  return {
    id: uid,
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
  const { error } = await supabase.rpc('update_account_by_admin', {
    p_auth_user_id: params.id,
    p_nickname: params.nickname ?? null,
    p_role: params.role ?? null,
    p_disabled: null
  })
  if (error) {
    throw new Error(getErrorMessage(error, '更新账号失败'))
  }
  if (params.password) {
    // 子账号密码修改需服务端 API（service_role），纯前端无法实现，记录提示
    console.warn('[admin] 通过前端修改子账号密码需要服务端 API，已跳过')
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
