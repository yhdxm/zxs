// 差值台 GAPDESK · 前端单例 store
//
// 为什么是「模块级 ref」而不是 Pinia：
//   项目没有引入 Pinia，其余页面都用组件内 state + useCloudSync。差值台有 9 个子视图共享
//   同一份 feed，若各视图各自 onMounted 拉一次，切 tab 就会打出 9 组请求。这里用模块级 ref
//   做单例，配合 TTL 去重，只有真正需要时才重拉。
//
// 约定：
//   1) 所有派生数据（过滤/排序/矩阵/时差/健康）都在 computed 里算，模板不写 filter/sort；
//   2) 失败不抛错：network 挂了就退到 localStorage 镜像，并置 stale=true 让界面显式说明
//      「数据可能不是最新」—— 静默展示旧数据是这类工具最致命的体验问题；
//   3) useGapDeskRealtime() 内部调用 useCloudSync()，**必须在组件 setup 内调用**。
import { computed, reactive, ref, type InjectionKey, type Ref, type ComputedRef } from 'vue'
import { useCloudSync } from './useCloudSync'
import { cacheGetStale, cacheSet } from '../services/cloudSyncService'
import { getSavedUser, type AppUser } from '../services/appDataService'
import { canManageSystem } from '../config/appMenu'
import {
  clearFeedCache,
  loadFeed,
  listFavorites,
  listRules,
  listSubscriptions,
  markRead,
  purgeExpired,
  resolveUserId,
  toggleFavorite as toggleFavoriteRemote,
  toggleSubscribe as toggleSubscribeRemote,
  type GapFeedData,
  type GapFeedMeta
} from '../services/gapdeskService'
import {
  EMPTY_ECHO,
  EMPTY_LLM,
  EMPTY_PURGE_CONFIRM,
  EMPTY_PURGE_DENIED,
  EMPTY_PURGE_DONE,
  EMPTY_PURGE_EMPTY,
  EMPTY_PURGE_ERROR,
  EMPTY_PURGE_RUNNING,
  GAP_CACHE_TTL,
  GAP_FEED_CACHE_KEY,
  type PurgeState,
  GAP_DIM,
  GAP_DIM6,
  GAP_DIM6_OF,
  GAP_GAP_MIN,
  GAP_IND,
  GAP_IND_MAP,
  GAP_TTL_HOURS,
  SR_TIERS,
  SR_TIER_OF
} from '../config/gapdeskConfig'
import type {
  GapDim,
  GapDim6Key,
  GapEventRow,
  GapEventSourceRow,
  GapInd,
  GapLayer,
  GapPlatformRow,
  GapRuleRow,
  GapSourceRow,
  GapTier,
  RankedEvent,
  GapDateBand,
  GapMatrix6,
  SourceGradeAgg,
  SourceGradeRow,
  SourceStatusKind,
  SourceGroup,
  SupplyDayRow
} from '../types/gapdesk'

/** 本地镜像 key（与 cloudSyncService 的缓存信封同名约定） */
const CACHE_KEY = GAP_FEED_CACHE_KEY

/** 清理按钮 throttle：60s 内重复点击不重复打 RPC */
const PURGE_THROTTLE_MS = 60_000

/** 可选时间窗（小时）：产品只承诺近 48 小时，更窄的窗口是用户自己的取舍 */
export const GAP_WINDOW_OPTIONS = [6, 12, 24, 48] as const

/**
 * 宿主向各视图提供的「打开详情」注入点。
 * 抽屉由 GapDeskView 统一持有，视图只 emit/open 后调用它，避免每个视图各自挂一层抽屉。
 */
export const GAP_OPEN_DETAIL_KEY: InjectionKey<(eventId: number) => void> = Symbol('gapdesk-open-detail')

export interface GapFilters {
  /** 行业过滤，空数组 = 全部 */
  inds: GapInd[]
  /** 时间窗（小时），按 ts_published 过滤（ts=0 的榜单条目不受限） */
  windowH: number
  sort: 'gap' | 'latest' | 'heat'
  keyword: string
  /** 展示六维过滤；'' = 不限 */
  dim6: GapDim6Key | ''
  /** 日期带选择：live / today / YYYY-MM-DD / unknown；'' = 不限（显示全部） */
  dateBand: string
  /** 只看我订阅的行业 */
  onlySub: boolean
}

/* ============================================================
   一、state（模块级单例）
   ============================================================ */
const events = ref<GapEventRow[]>([])
const platforms = ref<GapPlatformRow[]>([])
const sources = ref<GapSourceRow[]>([])
const evidences = ref<GapEventSourceRow[]>([])
const meta = ref<GapFeedMeta | null>(null)

const loading = ref(false)
const error = ref<string | null>(null)
/** true = 当前展示的是离线镜像（非本轮真实拉取） */
const stale = ref(false)
/** 镜像年龄（毫秒）：界面上「N 分钟前的镜像」用 */
const staleAgeMs = ref(0)
/** 最近一次成功拉取时刻（毫秒） */
const lastLoadedAt = ref(0)

/** 我的收藏 event_id 列表（卡片收藏态、收藏视图共用） */
const favorites = ref<number[]>([])
/** 我的订阅行业 */
const mySubs = ref<GapInd[]>([])
/**
 * 我的预警规则（侧栏 06 计数用真值）。
 * ruleLoaded 区分「读到 0 条」与「没读到」：前者显示 0，后者显示「—」。
 */
const ruleRows = ref<GapRuleRow[]>([])
const ruleLoaded = ref(false)
/** 当前登录用户的 auth uid（空 = 未登录，写操作直接跳过） */
const userId = ref('')

/** 管理员清理：权限、状态机、RPC 真实条数、节流时间戳 */
const canPurge: Ref<boolean> = ref(false)
const purgeState: Ref<PurgeState> = ref<PurgeState>('idle')
const purgeDeleted: Ref<number> = ref(0)
const purgeLastAt: Ref<number> = ref(0)
/** 失败原因（真实 RPC error），只用于提示，不伪造条数 */
const purgeError: Ref<string | null> = ref<string | null>(null)

const filters = reactive<GapFilters>({
  inds: [],
  windowH: GAP_TTL_HOURS,
  sort: 'gap',
  keyword: '',
  dim6: '',
  dateBand: '',
  onlySub: false
})

/** 本机稍后读：不新增表，只存 event_id，跨视图共享 */
const LATER_KEY = 'gapdesk_later_ids'
function readLaterIds(): number[] {
  try {
    const raw = globalThis.localStorage?.getItem(LATER_KEY)
    const parsed: unknown = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed.filter((id): id is number => typeof id === 'number') : []
  } catch {
    return []
  }
}
const laterIds = ref<number[]>(readLaterIds())

let inflight: Promise<void> | null = null

/* ============================================================
   二、加载
   ============================================================ */

/** 把一份 feed 写进 state（缓存回放与网络结果共用同一条路径） */
function applyFeed(data: GapFeedData): void {
  events.value = Array.isArray(data.events) ? data.events : []
  platforms.value = Array.isArray(data.platforms) ? data.platforms : []
  sources.value = Array.isArray(data.sources) ? data.sources : []
  // 旧镜像没有 evidences 字段，回放时按空数组处理
  evidences.value = Array.isArray(data.evidences) ? data.evidences : []
  meta.value = data.meta ?? null
}

/** 拉用户态数据（收藏/订阅）。未登录时静默跳过，不产生错误提示 */
async function loadUserState(): Promise<void> {
  const uid = await resolveUserId()
  userId.value = uid
  if (!uid) {
    favorites.value = []
    mySubs.value = []
    ruleRows.value = []
    ruleLoaded.value = false
    canPurge.value = false
    return
  }
  // 清理权限按 app_accounts 的 role 判定；读不到用户就当普通用户，按钮不渲染。
  let user: AppUser | null = null
  try {
    user = await getSavedUser()
  } catch {
    user = null
  }
  canPurge.value = canManageSystem(user)

  // 规则读取与收藏/订阅同轮发起，但单独兜底：规则读失败不能拖累其它用户态。
  const [fav, sub, rules] = await Promise.all([
    listFavorites(uid),
    listSubscriptions(uid),
    listRules(uid).then(
      (r) => r,
      (e: unknown) => ({ data: [] as GapRuleRow[], error: e instanceof Error ? e.message : String(e) })
    )
  ])
  favorites.value = fav.data.map((f) => f.event_id)
  mySubs.value = sub.data.map((s) => s.ind)
  if (rules.error) {
    ruleRows.value = []
    ruleLoaded.value = false
  } else {
    ruleRows.value = rules.data ?? []
    ruleLoaded.value = true
  }
}

/**
 * 只信字符串：service 误传对象时降级成可读文本。
 * 模板里 `${error}` 插值遇到不可转原始值的对象会直接抛 TypeError 并让整页白，
 * 这是最坏的失败模式，所以在赋值这一层就收敛掉，不往 service 里撒 String()。
 */
function errText(e: unknown): string | null {
  if (e == null) return null
  if (typeof e === 'string') return e
  const msg = (e as { message?: unknown }).message
  return typeof msg === 'string' ? msg : '未知错误'
}

/**
 * 加载 feed。
 * @param force true = 忽略 TTL 强制重拉（手动刷新 / Realtime 推送 / 切回前台）
 */
export async function loadGapFeed(force = false): Promise<void> {
  if (inflight) return inflight
  // TTL 内且已有数据：直接用内存，不打请求
  if (!force && events.value.length && Date.now() - lastLoadedAt.value < GAP_CACHE_TTL) return

  inflight = (async () => {
    loading.value = true
    error.value = null
    try {
      const res = await loadFeed()
      const gotNothing = res.data.events.length === 0

      if (gotNothing && res.error) {
        // 完全失败 → 退到离线镜像，并显式标记「可能不是最新」
        const mirror = cacheGetStale<GapFeedData>(CACHE_KEY)
        if (mirror) {
          applyFeed(mirror.data)
          stale.value = true
          staleAgeMs.value = mirror.ageMs
        }
        error.value = errText(res.error)
        console.warn('[gapdesk] feed 拉取失败，已回退离线镜像', res.error)
      } else {
        applyFeed(res.data)
        stale.value = false
        staleAgeMs.value = 0
        lastLoadedAt.value = Date.now()
        // 部分失败也把错误带出去（界面可提示「信源面板暂不可用」），但数据照常展示
        error.value = errText(res.error)
        cacheSet(CACHE_KEY, res.data)
      }

      await loadUserState()
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e)
      const mirror = cacheGetStale<GapFeedData>(CACHE_KEY)
      if (mirror) {
        applyFeed(mirror.data)
        stale.value = true
        staleAgeMs.value = mirror.ageMs
      }
    } finally {
      loading.value = false
    }
  })().finally(() => {
    inflight = null
  })

  return inflight
}

export interface PurgeResult {
  ok: boolean
  deleted: number
  state: PurgeState
  error: string | null
}

/**
 * 管理员清理：RPC → 清镜像 → 强制重拉。
 * 顺序不可换：RPC 失败时缓存、镜像、已展示数据一概不动；只有成功才清缓存并重拉。
 * 条数只认 RPC 的返回值，0 条如实报 empty，绝不编造「清理成功 N 条」。
 */
export async function purgeAndRefresh(): Promise<PurgeResult> {
  if (!canPurge.value) {
    purgeDeleted.value = 0
    return { ok: false, deleted: 0, state: 'error', error: EMPTY_PURGE_DENIED }
  }
  const now = Date.now()
  // 重复点击 / running 期间都不再打 RPC；不刷新 throttle 时间戳，避免把 60s 窗口越点越长
  if (purgeState.value === 'running' || now - purgeLastAt.value < PURGE_THROTTLE_MS) {
    return { ok: false, deleted: purgeDeleted.value, state: purgeState.value, error: null }
  }
  purgeLastAt.value = now
  purgeError.value = null
  purgeState.value = 'running'

  const res = await purgeExpired()
  if (res.error) {
    // 失败必须清掉上一次成功的条数：UI 与返回值都只能报本次真实结果（本次为 0）
    purgeDeleted.value = 0
    purgeError.value = res.error
    purgeState.value = 'error'
    return { ok: false, deleted: 0, state: 'error', error: res.error }
  }

  purgeDeleted.value = res.data
  clearFeedCache()
  await loadGapFeed(true)
  // isLive 跟随 meta 自动重算：重拉成功后即恢复实时态，失败则走既有的退镜像/降级链路
  purgeState.value = res.data > 0 ? 'done' : 'empty'
  return { ok: true, deleted: res.data, state: purgeState.value, error: null }
}

/**
 * 注册跨端同步（切回前台 / 聚焦 / 联网 / Realtime 四重触发，由 useCloudSync 统一处理）。
 * ⚠️ 只能在组件 setup 内调用一次；重复调用会被内部标记拦住。
 */
let syncBound = false
export function useGapDeskRealtime(): void {
  if (syncBound) return
  syncBound = true
  useCloudSync({
    tables: ['gap_events', 'gap_favorites', 'gap_subscriptions', 'gap_reads'],
    reload: () => loadGapFeed(true),
    // 首次加载由视图自己的 onMounted → load() 负责，避免与 TTL 判断互相抢跑
    immediate: false,
    throttleMs: 1200
  })
}

/* ============================================================
   三、派生数据（全部 computed，模板不写业务逻辑）
   ============================================================ */

/** 双轨差值：决策圈热度 − 大众热度（可为负，负=大众比决策圈更热） */
export function gapDiv(e: GapEventRow): number {
  return (e.ins_heat ?? 0) - (e.pub_heat ?? 0)
}

/** 过滤 + 排序后的池（矩阵/时差/暗流都从它派生，保证全站口径一致） */
const pool = computed<GapEventRow[]>(() => {
  const kw = filters.keyword.trim().toLowerCase()
  const cutoff = Date.now() - filters.windowH * 3600 * 1000
  const subs = new Set<GapInd>(mySubs.value)

  const list = events.value.filter((e) => {
    if (filters.inds.length && !filters.inds.includes(e.ind)) return false
    if (filters.dim6 && GAP_DIM6_OF[e.dim] !== filters.dim6) return false
    // 只订阅：未登录或没订阅任何行业时不做限制（否则界面会莫名全空）
    if (filters.onlySub && subs.size > 0 && !subs.has(e.ind)) return false
    // ts_published=0 表示源站无时间（榜单类），不能用时间窗判它过期
    if (e.ts_published > 0 && e.ts_published < cutoff) return false
    if (kw) {
      const hay = `${e.title} ${e.summary ?? ''}`.toLowerCase()
      if (!hay.includes(kw)) return false
    }
    return true
  })

  return list.sort((a, b) => {
    if (filters.sort === 'heat') return gapDiv(b) - gapDiv(a)
    if (filters.sort === 'latest') return (b.ts_first_seen || 0) - (a.ts_first_seen || 0)
    return b.gap - a.gap
  })
})

/** 概览数字 */
const stats = computed(() => {
  const list = pool.value
  const count = list.length
  const sum = list.reduce((a, e) => a + e.gap, 0)
  const maxGap = list.reduce((a, e) => Math.max(a, e.gap), 0)
  return {
    count,
    avgGap: count ? Math.round(sum / count) : 0,
    maxGap,
    /** 已出圈（命中大众榜）条数 */
    massHit: list.filter((e) => (e.mass_heat ?? 0) > 0).length,
    /** 达到展示阈值（GAP_GAP_MIN）的条数 */
    strong: list.filter((e) => e.gap >= GAP_GAP_MIN).length
  }
})

export interface GapMatrixCell {
  maxGap: number
  count: number
}

export type GapMatrix = Record<GapInd, Record<GapDim, GapMatrixCell | null>>

/** 维度 key 顺序（与 config 的 GAP_DIM 同源，建矩阵时按它铺列，避免顺序漂移） */
const GAP_DIM_KEYS: readonly GapDim[] = GAP_DIM.map((d) => d.key)

/** 行业 × 维度矩阵：空格返回 null（界面显式留白，不补 0 假装有数据） */
const matrix = computed<GapMatrix>(() => {
  const grid = {} as GapMatrix
  for (const i of GAP_IND) {
    const row = {} as Record<GapDim, GapMatrixCell | null>
    for (const d of GAP_DIM_KEYS) row[d] = null
    grid[i.key] = row
  }
  for (const e of pool.value) {
    const row = grid[e.ind]
    if (!row) continue
    const cell = row[e.dim]
    if (!cell) row[e.dim] = { maxGap: e.gap, count: 1 }
    else {
      cell.maxGap = Math.max(cell.maxGap, e.gap)
      cell.count += 1
    }
  }
  return grid
})

export interface GapLagTrack {
  platform: string
  /** null = 未触达（库里 0 表示未触达；这里统一转成 null，界面不显示 0） */
  heat: number | null
  /** 首触时刻（epoch ms），null = 未触达 */
  firstTouchTs: number | null
}

export interface GapLagRow {
  id: number
  title: string
  gap: number
  div: number
  tracks: GapLagTrack[]
  /** 首触跨度（小时）：最晚首触 − 最早首触 */
  spanH: number
}

/** 时差轨迹：取差值最大的 12 条，展示「决策圈先 → 大众后」的真实时间序列 */
const lag = computed<GapLagRow[]>(() => {
  const byEvent = new Map<number, GapPlatformRow[]>()
  for (const p of platforms.value) {
    const arr = byEvent.get(p.event_id)
    if (arr) arr.push(p)
    else byEvent.set(p.event_id, [p])
  }

  return [...pool.value]
    .sort((a, b) => gapDiv(b) - gapDiv(a))
    .slice(0, 12)
    .map((e) => {
      const rows = byEvent.get(e.id) ?? []
      const tracks: GapLagTrack[] = rows.map((r) => ({
        platform: r.platform ?? '未知平台',
        heat: r.heat ?? null,
        firstTouchTs: r.first_touch_ts && r.first_touch_ts > 0 ? r.first_touch_ts : null
      }))
      const ts = tracks.map((t) => t.firstTouchTs).filter((t): t is number => t != null)
      const spanH = ts.length > 1 ? (Math.max(...ts) - Math.min(...ts)) / 3600000 : 0
      return { id: e.id, title: e.title, gap: e.gap, div: gapDiv(e), tracks, spanH }
    })
})

/**
 * 首触来源：同一事件取 publish_ts 最小的一条（谁先报是第一信息）。
 * evidences 为空（子请求失败）时返回 null —— 界面不许编造来源名。
 */
const firstSourceOf = computed<(id: number) => GapEventSourceRow | null>(() => {
  const map = new Map<number, GapEventSourceRow>()
  for (const row of evidences.value) {
    const prev = map.get(row.event_id)
    const ts = row.publish_ts ?? Number.MAX_SAFE_INTEGER
    if (!prev || ts < (prev.publish_ts ?? Number.MAX_SAFE_INTEGER)) map.set(row.event_id, row)
  }
  return (id: number): GapEventSourceRow | null => map.get(id) ?? null
})

/** 暗流：只有单一信源、且还没出圈 —— 这是差值台最值钱的那一批 */
const underground = computed<GapEventRow[]>(() => {
  return pool.value
    .filter((e) => e.src_count <= 1 && (e.mass_heat ?? 0) === 0)
    .sort((a, b) => b.gap - a.gap)
    .slice(0, 12)
})

/** 信源健康汇总 */
const health = computed(() => {
  const total = sources.value.length
  const ok = sources.value.filter((s) => s.status === 'ok').length
  const down = sources.value.filter((s) => s.status !== 'ok')
  return { ok, total, down }
})

/* ============================================================
   三·补、T02 派生数据（全部只读 computed）
   ============================================================ */

/** 排名 + 展示分层：按池内分位而非绝对分数，L0 前 10% / L1 10–40% / L2 其余 */
const ranked = computed<RankedEvent[]>(() => {
  const list = [...pool.value].sort(
    (a, b) => b.gap - a.gap || (b.ts_first_seen || 0) - (a.ts_first_seen || 0)
  )
  const total = list.length
  return list.map((e, i) => {
    const ratio = total > 0 ? i / total : 1
    const tier: GapTier = ratio < 0.1 ? 'L0' : ratio < 0.4 ? 'L1' : 'L2'
    return { ...e, tier, rank: i + 1 }
  })
})

/** 首屏批次：一次铺 20 条，点「加载更多」再追加 20，直到全池 */
export const FEED_BATCH = 20

/** 当前已展开条数；不随筛选复位，用户翻到哪就停在哪 */
const feedCount = ref<number>(FEED_BATCH)

/** 今日最新信息：ranked 前 feedCount 条（ranked 已按 gap 降序 + 首见时间次级排序，并带 tier/rank） */
const topList = computed<RankedEvent[]>(() => ranked.value.slice(0, feedCount.value))

/** 全池是否还有未展开的条目 */
const hasMoreTop = computed<boolean>(() => ranked.value.length > feedCount.value)

/** 加载更多：再展开一批 */
function loadMoreTop(): void {
  feedCount.value += FEED_BATCH
}

const tierCounts = computed<Record<GapTier, number>>(() => {
  const out: Record<GapTier, number> = { L0: 0, L1: 0, L2: 0 }
  for (const e of ranked.value) out[e.tier] += 1
  return out
})

/** 本地日键：按用户看到的「今天」归日，不用 UTC 造成跨日错位 */
function dayKey(ts: number): string {
  const d = new Date(ts)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** 日期胶囊：1 小时内 / 今天更早 / 具体日期 / 时间未知（ts=0 单列） */
const dateBands = computed<GapDateBand[]>(() => {
  const now = Date.now()
  const todayKey = dayKey(now)
  const buckets = new Map<string, GapDateBand>()
  const put = (band: GapDateBand): void => {
    const hit = buckets.get(band.key)
    if (hit) hit.count += 1
    else buckets.set(band.key, { ...band })
  }
  for (const e of pool.value) {
    if (!(e.ts_published > 0)) {
      put({ key: 'unknown', label: '时间未知', count: 1, kind: 'unknown', ts: null })
      continue
    }
    const key = dayKey(e.ts_published)
    if (now - e.ts_published < 3600_000) {
      put({ key: 'live', label: '1小时内', count: 1, kind: 'live', ts: e.ts_published })
    } else if (key === todayKey) {
      put({ key: 'today', label: '今天更早', count: 1, kind: 'today', ts: e.ts_published })
    } else {
      const d = new Date(e.ts_published)
      put({
        key,
        label: `${d.getMonth() + 1}-${String(d.getDate()).padStart(2, '0')}`,
        count: 1,
        kind: 'date',
        ts: new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
      })
    }
  }
  const order = (b: GapDateBand): number =>
    b.kind === 'live' ? 0 : b.kind === 'today' ? 1 : b.kind === 'date' ? 2 : 3
  return [...buckets.values()].sort(
    (a, b) => order(a) - order(b) || (b.ts ?? 0) - (a.ts ?? 0)
  )
})

const byIndustry = computed<Record<GapInd, GapEventRow[]>>(() => {
  const out = {} as Record<GapInd, GapEventRow[]>
  for (const ind of GAP_IND) out[ind.key] = []
  for (const e of pool.value) out[e.ind]?.push(e)
  return out
})

/** 8 行业 × 展示六维；没有事件的格子保持 null（UI 标「待采」，不补 0） */
const matrix6 = computed<GapMatrix6>(() => {
  const grid = {} as GapMatrix6
  for (const ind of GAP_IND) {
    const row = {} as GapMatrix6['ai']
    for (const d of GAP_DIM6) row[d.key] = null
    grid[ind.key] = row
  }
  for (const e of pool.value) {
    const d6 = GAP_DIM6_OF[e.dim]
    if (!d6) continue
    const cell = grid[e.ind]?.[d6]
    if (!cell) {
      grid[e.ind]![d6] = { maxGap: e.gap, count: 1, topId: e.id }
    } else {
      cell.count += 1
      if (e.gap > cell.maxGap) {
        cell.maxGap = e.gap
        cell.topId = e.id
      }
    }
  }
  return grid
})

/** 逐源分组：只统计证据链里真实出现的源；今日无带时间戳证据 → silent */
const bySource = computed<SourceGroup[]>(() => {
  const eventMap = new Map(events.value.map((e) => [e.id, e]))
  const groups = new Map<string, { layer: GapLayer | null; ids: Set<number>; today: boolean }>()
  const todayKey = dayKey(Date.now())
  for (const s of evidences.value) {
    const name = (s.source_name || '').trim() || '未知来源'
    let group = groups.get(name)
    if (!group) {
      group = { layer: s.layer ?? null, ids: new Set<number>(), today: false }
      groups.set(name, group)
    }
    if (s.layer && !group.layer) group.layer = s.layer
    group.ids.add(s.event_id)
    if (s.publish_ts && s.publish_ts > 0 && dayKey(s.publish_ts) === todayKey) group.today = true
  }
  return [...groups.entries()].map(([source, group]) => ({
    source,
    layer: group.layer,
    events: [...group.ids]
      .map((id) => eventMap.get(id))
      .filter((e): e is GapEventRow => Boolean(e)),
    silent: !group.today
  }))
})

/** 源间时差中位数（小时）：均值会被历史长尾带偏，故取中位；无有效样本返回 null */
const lagMedianHours = computed<number | null>(() => {
  const hours = lag.value
    .map((row) => row.spanH)
    .filter((h) => h > 0)
    .sort((a, b) => a - b)
  if (!hours.length) return null
  const mid = hours.length >> 1
  const hit = hours[mid]
  if (hit == null) return null
  // 一位小数：6 小时级的差用「天」看不见，但也不需要 18 位小数
  if (hours.length % 2) return Math.round(hit * 10) / 10
  return Math.round((((hours[mid - 1] ?? 0) + hit) / 2) * 10) / 10
})

/** LIVE 三条件同时成立：采集在 40 分钟内、非镜像、无错误 */
const isLive = computed<boolean>(() => {
  if (stale.value || error.value || !meta.value?.generated_at) return false
  const ts = Date.parse(meta.value.generated_at)
  return Number.isFinite(ts) && Date.now() - ts <= 40 * 60 * 1000
})

/** 降级原因清单：空数组 = 可以自称 LIVE，界面据此决定要不要亮 DEMO */
const demoReasons = computed<string[]>(() => {
  const reasons: string[] = []
  if (error.value) reasons.push(`云端错误：${error.value}`)
  if (stale.value) reasons.push(`离线镜像（${Math.round(staleAgeMs.value / 60000)} 分钟前）`)
  const iso = meta.value?.generated_at
  if (!iso) reasons.push('无采集元信息（generated_at 缺失）')
  else {
    const ts = Date.parse(iso)
    if (!Number.isFinite(ts)) reasons.push('采集时间无法解析')
    else if (Date.now() - ts > 40 * 60 * 1000) reasons.push('采集时间超过 40 分钟')
  }
  if (!events.value.length) reasons.push('事件池为空')
  return reasons
})

/** 今日研判：规则归纳（非 LLM），每一句都能回溯到真实事件统计 */
const dailyBriefText = computed<string>(() => {
  const list = ranked.value
  if (!list.length) return '当前无事件，无法生成研判。'
  const l0 = list.filter((e) => e.tier === 'L0').length
  const l1 = list.filter((e) => e.tier === 'L1').length
  const counts = new Map<GapInd, number>()
  for (const e of list) counts.set(e.ind, (counts.get(e.ind) ?? 0) + 1)
  const top = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 2)
  const topText = top
    .map(([ind, n]) => `${GAP_IND_MAP[ind]?.label ?? ind}（${n} 条）`)
    .join(' 与 ')
  const share = Math.round((top.reduce((sum, [, n]) => sum + n, 0) / list.length) * 100)
  const best = list[0]
  const lone = list.filter((e) => e.src_count <= 1).length
  const lines = [
    `今日 L0 ${l0} 条、L1 ${l1} 条；样本池集中在 ${topText || '—'}，合计占当日 ${share}%。`,
    best
      ? `最高分一条：「${best.title.slice(0, 34)}${best.title.length > 34 ? '…' : ''}」（GAP ${best.gap}）。${(best.reason ?? '').slice(0, 60)}`
      : '',
    `风险提示：${lone} 条为孤证（仅 1 路源，已按孤证系数降权）。`,
    `时差中位 ${lagMedianHours.value ?? '—'} 小时；Echo ${EMPTY_ECHO}。`,
    `${EMPTY_LLM}；本段由当日 ${list.length} 条真实事件按固定规则归纳。`
  ]
  return lines.filter((line) => Boolean(line)).join('\n')
})

/** 采集漏斗：meta 缺失返回 null（界面不画假漏斗） */
const funnel = computed<GapFeedMeta['funnel'] | null>(() => meta.value?.funnel ?? null)

/* ============================================================
   三·补二、T01 新增派生数据（全部只读 computed）
   ============================================================ */

/** 孤证未截断总数：underground 只取前 12 条，侧栏计数不能复用它 */
const loneCount = computed<number>(() =>
  events.value.filter((e) => e.src_count <= 1 && (e.mass_heat ?? 0) === 0).length
)

/**
 * 每日供给序列：从完整 events 按 ts_published 本地归日（与 dayKey 同口径），
 * 分层数取当前 ranked 的分位结果。ts=0 的榜单条目没有日点，不计入。
 * 时间升序，48h 内通常只有 1-3 个点——不足就空着，不补假历史。
 */
const supplyByDay = computed<SupplyDayRow[]>(() => {
  const tierOf = new Map<number, GapTier>()
  for (const e of ranked.value) tierOf.set(e.id, e.tier)

  const buckets = new Map<string, SupplyDayRow>()
  for (const e of events.value) {
    if (!(e.ts_published > 0)) continue
    const key = dayKey(e.ts_published)
    let row = buckets.get(key)
    if (!row) {
      const d = new Date(e.ts_published)
      row = {
        key,
        label: `${d.getMonth() + 1}-${String(d.getDate()).padStart(2, '0')}`,
        count: 0,
        l0: 0,
        l1: 0,
        l2: 0
      }
      buckets.set(key, row)
    }
    row.count += 1
    const tier = tierOf.get(e.id)
    if (tier === 'L0') row.l0 += 1
    else if (tier === 'L1') row.l1 += 1
    else if (tier === 'L2') row.l2 += 1
  }
  return [...buckets.values()].sort((a, b) => a.key.localeCompare(b.key))
})

/**
 * 单源运行态。gap_sources 没有 skip 字段，冷却只能按网关文案近似识别：
 * status='warn' 或 msg 命中 skip/冷却/cooldown 都算冷却，优先于离线判定。
 */
function sourceStatusOf(s: GapSourceRow): SourceStatusKind {
  const ok = s.ok ?? 0
  const fail = s.fail ?? 0
  const msg = s.msg ?? ''
  if (s.status === 'warn' || /skip|冷却|cooldown/i.test(msg)) return 'cool'
  if (ok === 0 && fail > 0) return 'down'
  if (fail > 0) return 'warn'
  if (ok > 0 && fail === 0) return 'ok'
  return 'idle'
}

/** 信源分级：分数与状态都来自 gap_sources 实测，无样本一律 null / idle */
const sourceGrade = computed<{
  rows: SourceGradeRow[]
  aggs: SourceGradeAgg[]
  down: number
  total: number
}>(() => {
  const rows: SourceGradeRow[] = sources.value.map((s) => {
    const ok = s.ok ?? 0
    const fail = s.fail ?? 0
    const denom = ok + fail
    return {
      id: s.id,
      name: s.name,
      layer: s.layer,
      tier: SR_TIER_OF[s.layer] ?? 'official',
      score: denom > 0 ? Math.round((ok / denom) * 100) : null,
      status: sourceStatusOf(s),
      msg: s.msg ?? '',
      items: s.items,
      ok: s.ok,
      fail: s.fail
    }
  })

  const aggs: SourceGradeAgg[] = SR_TIERS.map((tier) => {
    const inTier = rows.filter((r) => r.tier === tier)
    const scored = inTier.map((r) => r.score).filter((n): n is number => n != null)
    return {
      tier,
      count: inTier.length,
      avg: scored.length
        ? Math.round(scored.reduce((sum, n) => sum + n, 0) / scored.length)
        : null
    }
  })

  return {
    rows,
    aggs,
    down: rows.filter((r) => r.status === 'down').length,
    total: rows.length
  }
})

/** 预警规则条数（读失败时侧栏按 ruleLoaded 显示「—」，不把 0 冒充真值） */
const ruleCount = computed<number>(() => ruleRows.value.length)

/** 清理浮层文案唯一真源：组件只读这个 computed，不在模板里拼字符串 */
const purgeMsg: ComputedRef<string> = computed<string>(() => {
  switch (purgeState.value) {
    case 'confirm':
      return EMPTY_PURGE_CONFIRM
    case 'running':
      return EMPTY_PURGE_RUNNING
    case 'done':
      return EMPTY_PURGE_DONE.replace('{n}', String(purgeDeleted.value))
    case 'empty':
      return EMPTY_PURGE_EMPTY
    case 'error':
      return `${EMPTY_PURGE_ERROR}${purgeError.value ? `（${purgeError.value}）` : ''}`
    default:
      return ''
  }
})

/** 收藏判定（模板里每个卡片都会问一次，故做成 Set） */
const favoriteSet = computed(() => new Set(favorites.value))
function isFavorite(eventId: number): boolean {
  return favoriteSet.value.has(eventId)
}

/* ============================================================
   四、动作
   ============================================================ */

function toggleInd(ind: GapInd): void {
  const i = filters.inds.indexOf(ind)
  if (i >= 0) filters.inds.splice(i, 1)
  else filters.inds.push(ind)
}

function setWindow(hours: number): void {
  filters.windowH = hours
}

function setSort(sort: GapFilters['sort']): void {
  filters.sort = sort
}

function setDim6(dim: GapDim6Key | ''): void {
  filters.dim6 = dim
}

function setKeyword(kw: string): void {
  filters.keyword = kw
}

function resetFilters(): void {
  filters.inds = []
  filters.windowH = GAP_TTL_HOURS
  filters.sort = 'gap'
  filters.keyword = ''
  filters.dim6 = ''
  filters.dateBand = ''
  filters.onlySub = false
  // 重置筛选等于回到首屏：展开批次一并收回，避免用户重置后仍面对一长串列表
  feedCount.value = FEED_BATCH
}

/** 稍后读：本机列表，写 localStorage 失败也不影响内存状态 */
function toggleLater(eventId: number): void {
  const has = laterIds.value.includes(eventId)
  const next = has ? laterIds.value.filter((id) => id !== eventId) : [...laterIds.value, eventId]
  laterIds.value = next
  try {
    globalThis.localStorage?.setItem(LATER_KEY, JSON.stringify(next))
  } catch {
    /* 隐私模式下写不进去，内存态照常生效 */
  }
}

function isLater(eventId: number): boolean {
  return laterIds.value.includes(eventId)
}

/**
 * 切换收藏：先本地乐观更新（点击必须有即时反馈），失败再回滚。
 */
async function toggleFavoriteEvent(eventId: number): Promise<void> {
  const on = !favoriteSet.value.has(eventId)
  const before = favorites.value
  favorites.value = on ? [...before, eventId] : before.filter((id) => id !== eventId)
  const ok = await toggleFavoriteRemote(eventId, on)
  if (!ok) {
    favorites.value = before
    console.warn('[gapdesk] 收藏状态写库失败，已回滚')
  }
}

/** 标记已读（失败无所谓，不提示、不回滚） */
async function markEventRead(eventId: number): Promise<void> {
  if (!userId.value) return
  await markRead(userId.value, eventId)
}

/**
 * 切换行业订阅（雷达页的行业卡开关）。
 * 乐观更新 mySubs：订阅开关必须立刻响应，否则用户会连点两次当成没生效而重复点。
 */
async function toggleSubscription(ind: GapInd): Promise<void> {
  if (!userId.value) return
  const on = !mySubs.value.includes(ind)
  const before = mySubs.value
  mySubs.value = on ? [...before, ind] : before.filter((x) => x !== ind)
  const ok = await toggleSubscribeRemote(userId.value, ind, on)
  if (!ok) {
    mySubs.value = before
    console.warn('[gapdesk] 订阅状态写库失败，已回滚')
  }
}

/* ============================================================
   五、对外
   ============================================================ */
export function useGapDesk() {
  return {
    // state
    events,
    platforms,
    sources,
    meta,
    filters,
    loading,
    error,
    stale,
    staleAgeMs,
    lastLoadedAt,
    favorites,
    mySubs,
    ruleRows,
    ruleLoaded,
    userId,
    evidences,
    laterIds,
    canPurge,
    purgeState,
    purgeDeleted,
    purgeLastAt,
    purgeError,
    // derived
    purgeMsg,
    pool,
    topList,
    hasMoreTop,
    feedCount,
    stats,
    matrix,
    lag,
    firstSourceOf,
    underground,
    health,
    ranked,
    tierCounts,
    dateBands,
    byIndustry,
    matrix6,
    bySource,
    lagMedianHours,
    isLive,
    demoReasons,
    dailyBriefText,
    funnel,
    loneCount,
    supplyByDay,
    sourceGrade,
    ruleCount,
    // actions
    load: loadGapFeed,
    loadMoreTop,
    purgeAndRefresh,
    toggleInd,
    setWindow,
    setSort,
    setDim6,
    setKeyword,
    resetFilters,
    toggleFavoriteEvent,
    toggleSubscription,
    markEventRead,
    toggleLater,
    isLater,
    isFavorite,
    gapDiv
  }
}
