// 差值台 GAPDESK · 服务层
//
// 约定（对齐 appDataService.ts 的既有写法）：
//   1) 直接 import 统一的 supabase 客户端（src/lib/supabaseClient.ts），不在这里创建实例；
//   2) 全部 async，**不向 UI 抛异常**：读接口返回 `{ data, error }`，写接口返回 boolean；
//   3) 失败一律 console.warn 记账，界面靠空态/降级提示，不让 Promise 崩掉整页；
//   4) 所有公共表查询都显式带 `expire_at > now` —— RLS 之外再走 expire_at 索引，
//      避免把已过期但尚未被清理函数删掉的行拉回前端。
//
// 数据来源：scripts/gapdesk/collect.mjs（GitHub Actions 每 30 分钟写一轮）。
import { supabase } from '../lib/supabaseClient'
import { cacheClear } from './cloudSyncService'
import { getSavedUser, type AppUser } from './appDataService'
import { canManageSystem } from '../config/appMenu'
import { GAP_FEED_CACHE_KEY } from '../config/gapdeskConfig'
import type {
  GapEventRow,
  GapEventSourceRow,
  GapFavoriteRow,
  GapPlatformRow,
  GapReadRow,
  GapRuleDsl,
  GapRuleRow,
  GapSeatRow,
  GapSourceRow,
  GapSubscriptionRow,
  GapInd
} from '../types/gapdesk'

/** 单轮事件上限：库里 2 天内实测 300-400 条，800 是给「突发」留的安全水位 */
export const FEED_LIMIT = 800

/** feed meta 在 app_settings 里的固定 key（与 collect.mjs 写入时一致） */
export const FEED_META_KEY = 'gapdesk_feed_meta'

/** 平台轨迹一次性取多少条事件：PostgREST 的 in.(...) 走 URL，200 一批是安全长度 */
const IN_CHUNK = 200

/** 读接口统一返回体：error 为 null 表示成功；data 永远有兜底值（空数组/空对象） */
export interface GapResult<T> {
  data: T
  error: string | null
}

/** app_settings.gapdesk_feed_meta 的 value 结构（由采集脚本写入） */
export interface GapFeedMeta {
  funnel: {
    raw: number
    exact: number
    event: number
    shown: number
  }
  /** 池内相对切点：决策圈 P75 / 大众 P25 */
  cut: {
    insP75: number
    pubP25: number
  }
  generated_at: string
  sources_ok: number
  sources_total: number
  wall_ms?: number
}

/** 一次 feed 加载的全部数据 */
export interface GapFeedData {
  events: GapEventRow[]
  platforms: GapPlatformRow[]
  sources: GapSourceRow[]
  meta: GapFeedMeta | null
  /** 本批事件的证据链（批量一次取回，失败为空数组，不阻断 feed） */
  evidences: GapEventSourceRow[]
}

/** 预警规则的可写字段（id 缺省时前端生成） */
export interface GapRuleInput {
  id?: string
  name: string
  dsl: GapRuleDsl
  channels: string[]
  enabled: boolean
}

const nowIso = (): string => new Date().toISOString()

/** 统一把 supabase 异常的 message 抽出来（null 安全） */
function errMsg(e: unknown): string {
  if (!e) return 'unknown error'
  if (typeof e === 'string') return e
  if (typeof e === 'object' && 'message' in e) return String((e as { message: unknown }).message)
  return String(e)
}

/**
 * 当前登录用户在 Supabase Auth 里的 uid。
 * RLS 策略是 `auth.uid()::text = user_id`，所以写入的 user_id 必须是这个值，
 * 不能用本项目 app_accounts 的自增/自定义 id（那是业务 id，不是认证 id）。
 * 无会话时返回 ''，调用方直接跳过写入（由 RLS 拒也不如提前跳过干净）。
 */
export async function resolveUserId(): Promise<string> {
  try {
    const { data, error } = await supabase.auth.getSession()
    if (error) console.warn('[gapdesk] 读取会话失败', error.message)
    const uid = data.session?.user?.id
    if (uid) return uid
  } catch (e) {
    console.warn('[gapdesk] 读取会话异常', errMsg(e))
  }
  return ''
}

/* ============================================================
   一、公共数据（全局共享，登录用户只读）
   ============================================================ */

/** 取某批事件的平台轨迹（内部分批，避免 in.(...) 过长被网关拒） */
async function loadPlatformsByEvents(eventIds: number[]): Promise<GapResult<GapPlatformRow[]>> {
  const out: GapPlatformRow[] = []
  for (let i = 0; i < eventIds.length; i += IN_CHUNK) {
    const chunk = eventIds.slice(i, i + IN_CHUNK)
    const { data, error } = await supabase
      .from('gap_event_platform')
      .select('*')
      .in('event_id', chunk)
      .order('first_touch_ts', { ascending: true })
    if (error) {
      console.warn('[gapdesk] 平台轨迹读取失败', error.message)
      return { data: out, error: error.message }
    }
    out.push(...((data ?? []) as GapPlatformRow[]))
  }
  return { data: out, error: null }
}

/**
 * 批量取一批事件的证据链（T02）。
 * 按 200 个 id 一批 .in('event_id', chunk)，与平台轨迹同规格；
 * 任一失败返回已取到的部分 + error，绝不抛异常给 UI。
 */
export async function loadEventSourcesBulk(eventIds: number[]): Promise<GapResult<GapEventSourceRow[]>> {
  const out: GapEventSourceRow[] = []
  if (!eventIds.length) return { data: out, error: null }
  try {
    for (let i = 0; i < eventIds.length; i += IN_CHUNK) {
      const chunk = eventIds.slice(i, i + IN_CHUNK)
      const { data, error } = await supabase
        .from('gap_event_sources')
        .select('*')
        .in('event_id', chunk)
        .order('publish_ts', { ascending: true })
      if (error) {
        console.warn('[gapdesk] 证据链批量读取失败', error.message)
        return { data: out, error: error.message }
      }
      out.push(...((data ?? []) as GapEventSourceRow[]))
    }
    return { data: out, error: null }
  } catch (e) {
    console.warn('[gapdesk] 证据链批量读取异常', errMsg(e))
    return { data: out, error: errMsg(e) }
  }
}

/** 信源健康（15-25 路，量小，直接全量） */
export async function loadSources(): Promise<GapResult<GapSourceRow[]>> {
  try {
    const { data, error } = await supabase.from('gap_sources').select('*').order('layer')
    if (error) {
      console.warn('[gapdesk] 信源健康读取失败', error.message)
      return { data: [], error: error.message }
    }
    return { data: (data ?? []) as GapSourceRow[], error: null }
  } catch (e) {
    console.warn('[gapdesk] 信源健康读取异常', errMsg(e))
    return { data: [], error: errMsg(e) }
  }
}

/** 采集元信息（顶栏 LIVE 徽标、漏斗数字都读它） */
export async function loadFeedMeta(): Promise<GapResult<GapFeedMeta | null>> {
  try {
    const { data, error } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', FEED_META_KEY)
      .maybeSingle()
    if (error) {
      console.warn('[gapdesk] feed meta 读取失败', error.message)
      return { data: null, error: error.message }
    }
    const value = (data as { value?: GapFeedMeta } | null)?.value ?? null
    return { data: value, error: null }
  } catch (e) {
    console.warn('[gapdesk] feed meta 读取异常', errMsg(e))
    return { data: null, error: errMsg(e) }
  }
}

/**
 * 加载 feed 全部数据。
 * 事件必须先拿到 id，子表才能按 event_id 过滤，所以是「1 请求 + 4 并发」：
 *   events →（platforms ‖ sources ‖ meta ‖ evidences）
 */
export async function loadFeed(limit: number = FEED_LIMIT): Promise<GapResult<GapFeedData>> {
  const empty: GapFeedData = { events: [], platforms: [], sources: [], meta: null, evidences: [] }
  try {
    const { data, error } = await supabase
      .from('gap_events')
      .select('*')
      .gt('expire_at', nowIso())
      .order('gap', { ascending: false })
      .limit(limit)

    if (error) {
      console.warn('[gapdesk] 事件读取失败', error.message)
      return { data: empty, error: error.message }
    }

    const events = (data ?? []) as GapEventRow[]
    const ids = events.map((e) => e.id)
    const [platformRes, sourcesRes, metaRes, evidenceRes] = await Promise.all([
      ids.length ? loadPlatformsByEvents(ids) : Promise.resolve({ data: [] as GapPlatformRow[], error: null }),
      loadSources(),
      loadFeedMeta(),
      ids.length ? loadEventSourcesBulk(ids) : Promise.resolve({ data: [] as GapEventSourceRow[], error: null })
    ])

    return {
      data: {
        events,
        platforms: platformRes.data,
        sources: sourcesRes.data,
        meta: metaRes.data,
        evidences: evidenceRes.data
      },
      // 任一子请求失败都算「部分成功」：把第一条错误带出去，界面仍能展示已有部分
      error: platformRes.error || sourcesRes.error || metaRes.error || evidenceRes.error
    }
  } catch (e) {
    console.warn('[gapdesk] feed 加载异常', errMsg(e))
    return { data: empty, error: errMsg(e) }
  }
}

/** 事件证据链（详情抽屉用）：按发布时间升序 —— 「谁先报」是第一信息 */
export async function loadEventDetail(eventId: number): Promise<GapResult<GapEventSourceRow[]>> {
  try {
    const { data, error } = await supabase
      .from('gap_event_sources')
      .select('*')
      .eq('event_id', eventId)
      .order('publish_ts', { ascending: true })
    if (error) {
      console.warn('[gapdesk] 证据链读取失败', error.message)
      return { data: [], error: error.message }
    }
    return { data: (data ?? []) as GapEventSourceRow[], error: null }
  } catch (e) {
    console.warn('[gapdesk] 证据链读取异常', errMsg(e))
    return { data: [], error: errMsg(e) }
  }
}

/* ============================================================
   二、用户行为（收藏 / 已读 / 订阅）
   ============================================================ */

/** 切换收藏。on=true 幂等插入（已存在不报错），on=false 精确删除 */
export async function toggleFavorite(eventId: number, on: boolean): Promise<boolean> {
  const userId = await resolveUserId()
  if (!userId) {
    console.warn('[gapdesk] 未登录，跳过收藏写入')
    return false
  }
  try {
    if (on) {
      const { error } = await supabase
        .from('gap_favorites')
        .upsert({ user_id: userId, event_id: eventId }, { onConflict: 'user_id,event_id', ignoreDuplicates: true })
      if (error) {
        console.warn('[gapdesk] 收藏失败', error.message)
        return false
      }
      return true
    }
    const { error } = await supabase
      .from('gap_favorites')
      .delete()
      .eq('user_id', userId)
      .eq('event_id', eventId)
    if (error) {
      console.warn('[gapdesk] 取消收藏失败', error.message)
      return false
    }
    return true
  } catch (e) {
    console.warn('[gapdesk] 收藏异常', errMsg(e))
    return false
  }
}

/** 我的收藏列表（按收藏时间倒序） */
export async function listFavorites(userId: string): Promise<GapResult<GapFavoriteRow[]>> {
  if (!userId) return { data: [], error: null }
  try {
    const { data, error } = await supabase
      .from('gap_favorites')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1000)
    if (error) {
      console.warn('[gapdesk] 收藏列表读取失败', error.message)
      return { data: [], error: error.message }
    }
    return { data: (data ?? []) as GapFavoriteRow[], error: null }
  } catch (e) {
    console.warn('[gapdesk] 收藏列表读取异常', errMsg(e))
    return { data: [], error: errMsg(e) }
  }
}

/** 标记已读（幂等：重复标记不报错，也不刷新 read_at —— 首次读到的时间更有信息量） */
export async function markRead(userId: string, eventId: number): Promise<boolean> {
  if (!userId) return false
  try {
    const { error } = await supabase
      .from('gap_reads')
      .upsert({ user_id: userId, event_id: eventId }, { onConflict: 'user_id,event_id', ignoreDuplicates: true })
    if (error) {
      console.warn('[gapdesk] 标记已读失败', error.message)
      return false
    }
    return true
  } catch (e) {
    console.warn('[gapdesk] 标记已读异常', errMsg(e))
    return false
  }
}

/** 已读列表 */
export async function listReads(userId: string): Promise<GapResult<GapReadRow[]>> {
  if (!userId) return { data: [], error: null }
  try {
    const { data, error } = await supabase
      .from('gap_reads')
      .select('*')
      .eq('user_id', userId)
      .order('read_at', { ascending: false })
      .limit(2000)
    if (error) {
      console.warn('[gapdesk] 已读列表读取失败', error.message)
      return { data: [], error: error.message }
    }
    return { data: (data ?? []) as GapReadRow[], error: null }
  } catch (e) {
    console.warn('[gapdesk] 已读列表读取异常', errMsg(e))
    return { data: [], error: errMsg(e) }
  }
}

/** 订阅/取消订阅某个行业 */
export async function toggleSubscribe(userId: string, ind: GapInd, on: boolean): Promise<boolean> {
  if (!userId) return false
  try {
    if (on) {
      const { error } = await supabase
        .from('gap_subscriptions')
        .upsert({ user_id: userId, ind }, { onConflict: 'user_id,ind', ignoreDuplicates: true })
      if (error) {
        console.warn('[gapdesk] 订阅失败', error.message)
        return false
      }
      return true
    }
    const { error } = await supabase
      .from('gap_subscriptions')
      .delete()
      .eq('user_id', userId)
      .eq('ind', ind)
    if (error) {
      console.warn('[gapdesk] 取消订阅失败', error.message)
      return false
    }
    return true
  } catch (e) {
    console.warn('[gapdesk] 订阅异常', errMsg(e))
    return false
  }
}

/** 我的订阅 */
export async function listSubscriptions(userId: string): Promise<GapResult<GapSubscriptionRow[]>> {
  if (!userId) return { data: [], error: null }
  try {
    const { data, error } = await supabase.from('gap_subscriptions').select('*').eq('user_id', userId)
    if (error) {
      console.warn('[gapdesk] 订阅列表读取失败', error.message)
      return { data: [], error: error.message }
    }
    return { data: (data ?? []) as GapSubscriptionRow[], error: null }
  } catch (e) {
    console.warn('[gapdesk] 订阅列表读取异常', errMsg(e))
    return { data: [], error: errMsg(e) }
  }
}

/* ============================================================
   三、预警规则
   ============================================================ */

/** 规则列表（按创建时间倒序） */
export async function listRules(userId: string): Promise<GapResult<GapRuleRow[]>> {
  if (!userId) return { data: [], error: null }
  try {
    const { data, error } = await supabase
      .from('gap_rules')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
    if (error) {
      console.warn('[gapdesk] 规则读取失败', error.message)
      return { data: [], error: error.message }
    }
    return { data: (data ?? []) as GapRuleRow[], error: null }
  } catch (e) {
    console.warn('[gapdesk] 规则读取异常', errMsg(e))
    return { data: [], error: errMsg(e) }
  }
}

/** 生成规则 id：gap_rules.id 是 text 主键、库里没有 default，所以客户端生成 */
function newRuleId(): string {
  const c = globalThis.crypto as Crypto | undefined
  if (c && typeof c.randomUUID === 'function') return c.randomUUID()
  return `r_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
}

/** 新建或更新规则（有 id 走 upsert，无 id 生成一个） */
export async function saveRule(userId: string, rule: GapRuleInput): Promise<GapRuleRow | null> {
  if (!userId) return null
  const row = {
    id: rule.id || newRuleId(),
    user_id: userId,
    name: rule.name,
    dsl: rule.dsl,
    channels: rule.channels,
    enabled: rule.enabled
  }
  try {
    const { data, error } = await supabase
      .from('gap_rules')
      .upsert(row, { onConflict: 'id' })
      .select('*')
    if (error) {
      console.warn('[gapdesk] 规则保存失败', error.message)
      return null
    }
    const saved = (data ?? []) as GapRuleRow[]
    return saved[0] ?? null
  } catch (e) {
    console.warn('[gapdesk] 规则保存异常', errMsg(e))
    return null
  }
}

/** 删除规则 */
export async function deleteRule(userId: string, id: string): Promise<boolean> {
  if (!userId || !id) return false
  try {
    const { error } = await supabase.from('gap_rules').delete().eq('user_id', userId).eq('id', id)
    if (error) {
      console.warn('[gapdesk] 规则删除失败', error.message)
      return false
    }
    return true
  } catch (e) {
    console.warn('[gapdesk] 规则删除异常', errMsg(e))
    return false
  }
}

/* ============================================================
   四、席位与用量
   ============================================================ */

/**
 * 席位与用量。
 * RLS：gap_seats 只有 `for all ... auth.uid()::text = user_id`（本人）策略，普通用户读不到别人行。
 * 管理员全量走 security definer 函数 gapdesk_seats_admin()（函数内二次校验角色），
 * 这样「越权读」在 DB 层就被堵住，不依赖前端过滤。
 */
export async function loadSeats(): Promise<GapResult<GapSeatRow[]>> {
  try {
    const uid = await resolveUserId()
    let user: AppUser | null = null
    try {
      user = await getSavedUser()
    } catch {
      /* 拿不到用户时按普通用户处理（只查本人） */
    }

    if (uid && canManageSystem(user)) {
      const { data, error } = await supabase.rpc('gapdesk_seats_admin')
      if (!error) {
        return { data: (data ?? []) as GapSeatRow[], error: null }
      }
      // RPC 失败（如函数未部署）降级为只查本人，不放开全量
      console.warn('[gapdesk] 管理员席位 RPC 失败，降级为本人行', error.message)
    }

    let query = supabase.from('gap_seats').select('*')
    if (uid) query = query.eq('user_id', uid)
    else query = query.eq('user_id', '\u0000') // 无会话时不返回任何行

    const { data, error } = await query.order('user_id')
    if (error) {
      console.warn('[gapdesk] 席位读取失败', error.message)
      return { data: [], error: error.message }
    }
    return { data: (data ?? []) as GapSeatRow[], error: null }
  } catch (e) {
    console.warn('[gapdesk] 席位读取异常', errMsg(e))
    return { data: [], error: errMsg(e) }
  }
}

/* ============================================================
   管理员清理（gapdesk_purge_admin）
   RPC 本体在服务端二次校验角色；这里只负责把 PostgREST 的两种标量返回形态
   统一成 number，并把失败收敛成 { data: 0, error }，绝不向 UI 抛异常。
   ============================================================ */
/**
 * PostgREST 对 returns integer 的函数有两种返回形态：裸 number，或 { data: number, error }。
 * 抽成纯函数便于钉死这两种形态，避免管理员点了清理却被告知「0 条」这种假数字。
 */
export function parsePurgeResult(res: unknown): { deleted: number; error: string | null } {
  if (typeof res === 'number') {
    return Number.isFinite(res)
      ? { deleted: res, error: null }
      : { deleted: 0, error: '无效的清理条数' }
  }
  const obj = (res ?? {}) as { data?: unknown; error?: { message?: unknown } | null }
  if (obj.error?.message) return { deleted: 0, error: String(obj.error.message) }
  const raw = obj.data
  return {
    deleted: typeof raw === 'number' && Number.isFinite(raw) ? raw : 0,
    error: null
  }
}

export async function purgeExpired(): Promise<GapResult<number>> {
  try {
    const res = await supabase.rpc('gapdesk_purge_admin')
    const parsed = parsePurgeResult(res)
    if (parsed.error) {
      console.warn('[gapdesk] 清理 RPC 失败', parsed.error)
      return { data: 0, error: parsed.error }
    }
    return { data: parsed.deleted, error: null }
  } catch (e) {
    console.warn('[gapdesk] 清理 RPC 异常', errMsg(e))
    return { data: 0, error: errMsg(e) }
  }
}

/** 只清 feed 镜像；laterIds 是用户清单，不在这里动 */
export function clearFeedCache(): void {
  cacheClear(GAP_FEED_CACHE_KEY)
}
