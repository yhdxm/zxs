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
import { computed, onBeforeUnmount, reactive, ref, type InjectionKey, type Ref, type ComputedRef } from 'vue'
import { useCloudSync } from './useCloudSync'
import { cacheGetStale, cacheSet } from '../services/cloudSyncService'
import { getSavedUser, type AppUser } from '../services/appDataService'
import { canManageSystem } from '../config/appMenu'
import {
  clearFeedCache,
  loadFeed,
  listFavorites,
  listLater,
  listRules,
  listSubscriptions,
  markRead,
  probeLaterTable,
  purgeExpired,
  resolveUserId,
  toggleFavorite as toggleFavoriteRemote,
  toggleLaterRemote,
  toggleSubscribe as toggleSubscribeRemote,
  type LaterWriteResult,
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
  GAP_FRESH_DECAY,
  GAP_FRESH_DECAY_OLD,
  GAP_FEED_CACHE_KEY,
  GAP_REFRESH_MS,
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
import { bandKeyOf, fmtAgo, fmtClock } from '../utils/gapdeskFormat'
import {
  I18N_DAILY_CHARS,
  i18nBudgetLeft,
  i18nCostOf,
  i18nDayKey,
  i18nFresh,
  i18nKeyOf,
  isForeignLike,
  needI18n,
  readAutoTranslate,
  readI18nDaily,
  readI18nMap,
  translateEvent,
  writeAutoTranslate,
  writeI18nDaily,
  writeI18nMap,
  type I18nDaily,
  type I18nEntry,
  type I18nMap
} from '../services/gapdeskI18n'
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
  SourceHealthStat,
  EchoChain,
  EchoChainHop,
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
  /** 只看海外事件（默认 false：国内事件照常全量展示） */
  onlyForeign: boolean
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

/**
 * 共享时钟（毫秒）：数据年龄的唯一时间源。
 * 不按组件各建定时器 —— 只在 useGapDeskRealtime() 的既有刷新生命周期里启停一次，
 * 并在每次 feed 落地（含缓存回放）时立刻对齐到当前时刻。
 */
const nowMs = ref(Date.now())
let clockTimer: ReturnType<typeof setInterval> | null = null
let clockUsers = 0

/** 启动共享时钟：与 GAP_REFRESH_MS 同一节奏，多视图挂载只维持一个定时器 */
function startClock(): void {
  clockUsers += 1
  nowMs.value = Date.now()
  if (clockTimer !== null) return
  clockTimer = setInterval(() => {
    nowMs.value = Date.now()
  }, GAP_REFRESH_MS)
}

/** 停止共享时钟：最后一个使用者卸载时才清理 */
function stopClock(): void {
  clockUsers = Math.max(0, clockUsers - 1)
  if (clockUsers > 0 || clockTimer === null) return
  clearInterval(clockTimer)
  clockTimer = null
}

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
  onlySub: false,
  onlyForeign: false
})

/* ============================================================
   一·补、自动翻译（免费通道；只进展示层，不参与打分/排序）
   ============================================================ */

/** 默认开，用户开关写入 localStorage；关闭后译文不显示但缓存保留 */
const autoTranslate = ref<boolean>(readAutoTranslate())
const i18nMap = ref<I18nMap>(readI18nMap())
const i18nDaily = ref<I18nDaily | null>(readI18nDaily())
/** 每项用 Record<string,true> 便于模板直接读，避免 Set 的响应式代理陷阱 */
const i18nBusy = ref<Record<string, boolean>>({})
const i18nFailed = ref<Record<string, boolean>>({})
const i18nBudgetOutRaw = ref(false)
/** 记录标志置位当天，跨天自动复位（日额度按日键恢复，文案说「明日自动恢复」就必须真恢复） */
let i18nBudgetOutDay = ''
/**
 * 保持原读写接口（.value = true|false），但用普通 getter 而非 computed：
 * 日期不是响应式源，computed 会缓存导致跨天后读不到复位；getter 每次现算，跨天真正自动恢复。
 * 类型上兼容 Ref<boolean>（只读消费 + 可写）。
 */
const i18nBudgetOut = {
  get value(): boolean {
    const today = i18nDayKey()
    if (i18nBudgetOutDay && i18nBudgetOutDay !== today) {
      i18nBudgetOutRaw.value = false
      i18nBudgetOutDay = ''
    }
    return i18nBudgetOutRaw.value
  },
  set value(v: boolean) {
    i18nBudgetOutRaw.value = v
    i18nBudgetOutDay = v ? i18nDayKey() : ''
  }
} as { value: boolean }
const I18N_CONCURRENCY = 2
let i18nActive = 0
const i18nPending: GapEventRow[] = []

/** 取一条事件的有效译文；关闭开关 / 过期 / 外文判定失败一律返回 null */
function i18nEntryOf(event: GapEventRow): I18nEntry | null {
  if (!autoTranslate.value || !isForeignLike(event)) return null
  const hit = i18nMap.value[i18nKeyOf(event)]
  return hit && i18nFresh(hit) ? hit : null
}

/** 展示标题：有译文用译文，否则原文（原文永远不丢） */
function titleOf(event: GapEventRow): string {
  return i18nEntryOf(event)?.title || event.title
}

/** 展示摘要：译文缺失时回落原文；证据链原文始终不翻 */
function summaryOf(event: GapEventRow): string {
  const hit = i18nEntryOf(event)
  return hit ? (hit.summary || (event.summary ?? '')) : (event.summary ?? '')
}

/** 卡片角标状态：native=国内原文 / off=用户关了 / done=机翻 / loading / failed / quota */
function i18nStateOf(event: GapEventRow): 'native' | 'off' | 'done' | 'loading' | 'failed' | 'quota' {
  if (!isForeignLike(event)) return 'native'
  if (!autoTranslate.value) return 'off'
  if (i18nBudgetOut.value && !i18nFresh(i18nMap.value[i18nKeyOf(event)])) return 'quota'
  if (i18nFresh(i18nMap.value[i18nKeyOf(event)])) return 'done'
  if (i18nBusy.value[i18nKeyOf(event)]) return 'loading'
  if (i18nFailed.value[i18nKeyOf(event)]) return 'failed'
  return 'loading'
}

/** 翻译队列限流：最多 2 并发；额度不足如实停，不排队空转 */
function pumpI18n(): void {
  while (i18nActive < I18N_CONCURRENCY && i18nPending.length) {
    const event = i18nPending.shift()
    if (!event) return
    const key = i18nKeyOf(event)
    if (i18nFresh(i18nMap.value[key]) || i18nFailed.value[key] || i18nBusy.value[key]) continue
    const cost = i18nCostOf(event)
    if (i18nBudgetLeft(i18nDaily.value) < cost) {
      i18nBudgetOut.value = true
      break
    }
    i18nActive += 1
    i18nBusy.value = { ...i18nBusy.value, [key]: true }
    void translateEvent(event)
      .then((res) => {
        if (!res) {
          i18nFailed.value = { ...i18nFailed.value, [key]: true }
          return
        }
        const next = { ...i18nMap.value, [key]: { ...res, ts: Date.now() } }
        i18nMap.value = next
        writeI18nMap(next)
        const today = i18nDayKey()
        const prev = i18nDaily.value
        const daily: I18nDaily =
          prev?.date === today
            ? { date: today, chars: prev.chars + cost }
            : { date: today, chars: cost }
        i18nDaily.value = daily
        writeI18nDaily(daily)
      })
      .finally(() => {
        const busy = { ...i18nBusy.value }
        delete busy[key]
        i18nBusy.value = busy
        i18nActive -= 1
        pumpI18n()
      })
  }
}

/** 批量入队：同一 key 只排一次；调用方传「当前可见」的条目，避免整池 800 条全翻 */
function ensureI18n(events: readonly GapEventRow[]): void {
  if (!autoTranslate.value) return
  for (const event of events) {
    if (!needI18n(event, i18nMap.value)) continue
    const key = i18nKeyOf(event)
    if (!key || i18nBusy.value[key] || i18nFailed.value[key]) continue
    if (i18nPending.some((x) => i18nKeyOf(x) === key)) continue
    i18nPending.push(event)
  }
  pumpI18n()
}

/**
 * 翻译失败手动重试：只清掉本会话的失败标记并把该事件重新入队。
 * 译文缓存、日额度、打分/排序一概不动；国内事件仍由 needI18n 拦下，不会被翻译。
 */
export function clearI18nFailed(key: string): void {
  if (!key || !i18nFailed.value[key]) return
  const next = { ...i18nFailed.value }
  delete next[key]
  i18nFailed.value = next
  // 失败条目可能已滚出当前筛选，但仍在完整 feed 里；从全池找，保证重试按钮真能生效
  const event = events.value.find((row) => i18nKeyOf(row) === key)
  if (event) ensureI18n([event])
}

/** 用户开关：关闭只停展示与新入队，已翻译文保留；开启后立刻补当前首屏 */
function toggleAutoTranslate(on?: boolean): void {
  autoTranslate.value = on === undefined ? !autoTranslate.value : on
  writeAutoTranslate(autoTranslate.value)
  if (autoTranslate.value) {
    i18nBudgetOut.value = false
    ensureI18n(topList.value)
  }
}

/** 稍后读：localStorage 是离线镜像，登录后以 gap_later 表为准跨设备同步 */
const LATER_KEY = 'gapdesk_later_ids'
/** gap_later 表不可用（未执行增量 SQL / 无权限）时降级为纯本地队列，UI 如实提示一次 */
const laterLocalOnly = ref(false)
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
  // 数据刚落地：马上对齐时钟，避免年龄显示等到下一个 30s tick 才更新
  nowMs.value = Date.now()
  events.value = Array.isArray(data.events) ? data.events : []
  platforms.value = Array.isArray(data.platforms) ? data.platforms : []
  sources.value = Array.isArray(data.sources) ? data.sources : []
  // 旧镜像没有 evidences 字段，回放时按空数组处理
  evidences.value = Array.isArray(data.evidences) ? data.evidences : []
  meta.value = data.meta ?? null
  // 只给首屏可见的外文条目排队翻译，避免整池 800 条一起打免费额度
  ensureI18n(ranked.value.slice(0, FEED_BATCH))
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
    // 未登录：稍后读保留本机镜像，不清空（不能因为读不到云端就丢用户数据）
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
  const [fav, sub, rules, later] = await Promise.all([
    listFavorites(uid),
    listSubscriptions(uid),
    listRules(uid).then(
      (r) => r,
      (e: unknown) => ({ data: [] as GapRuleRow[], error: e instanceof Error ? e.message : String(e) })
    ),
    listLater(uid).then(
      (r) => r,
      (e: unknown) => ({ data: [] as { event_id: number }[], error: e instanceof Error ? e.message : String(e) })
    )
  ])
  favorites.value = fav.data.map((f) => f.event_id)
  mySubs.value = sub.data.map((s) => s.ind)
  // 登录后以云端为准跨端对齐；表未建/读失败时保留本机镜像，不静默清空
  if (!later.error) {
    laterLocalOnly.value = false
    laterIds.value = later.data.map((l) => l.event_id)
    try {
      globalThis.localStorage?.setItem(LATER_KEY, JSON.stringify(laterIds.value))
    } catch { /* ignore */ }
  } else {
    // 区分「缺表/无权限」与「临时网络失败」：前者降级本地并提示，后者也先保留本机镜像不动
    void probeLaterTable().then((ok) => { laterLocalOnly.value = !ok })
  }
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
  // 时钟与刷新订阅共用同一条生命周期：组件卸载时由这里统一收尾，页面挂着不动也会走字
  startClock()
  onBeforeUnmount(stopClock)
  if (syncBound) return
  syncBound = true
  useCloudSync({
    tables: ['gap_events', 'gap_favorites', 'gap_subscriptions', 'gap_reads', 'gap_later'],
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

/**
 * 基础池：关键词/行业/六维/订阅/海外/时间窗过滤 + 排序。
 * 刻意不含 dateBand —— 日期胶囊选项（dateBands）从它派生，否则选一个日期会让胶囊自缩水到只剩一项。
 */
const basePool = computed<GapEventRow[]>(() => {
  const kw = filters.keyword.trim().toLowerCase()
  const cutoff = Date.now() - filters.windowH * 3600 * 1000
  const subs = new Set<GapInd>(mySubs.value)

  const list = events.value.filter((e) => {
    if (filters.inds.length && !filters.inds.includes(e.ind)) return false
    if (filters.dim6 && GAP_DIM6_OF[e.dim] !== filters.dim6) return false
    // 只订阅：未登录或没订阅任何行业时不做限制（否则界面会莫名全空）
    if (filters.onlySub && subs.size > 0 && !subs.has(e.ind)) return false
    if (filters.onlyForeign && !isForeignLike(e)) return false
    // ts_published=0 表示源站无时间（榜单类），不能用时间窗判它过期
    if (e.ts_published > 0 && e.ts_published < cutoff) return false
    if (kw) {
      // 译文也进搜索：用户看到的是中文标题，就该能用中文搜到海外事件
      const hay = `${e.title} ${titleOf(e)} ${e.summary ?? ''} ${summaryOf(e)}`.toLowerCase()
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

/**
 * 全局池：基础池再按 dateBand 收窄。
 * ranked / 矩阵 / 信源 / Echo / AI / 行业 TOP5 / 今日最大差全部从它派生 —— 日期胶囊一选，全站同口径。
 * 胶囊选项本身读 basePool，不受此收窄影响。
 */
const pool = computed<GapEventRow[]>(() => {
  const band = filters.dateBand
  if (!band) return basePool.value
  const now = nowMs.value
  return basePool.value.filter((e) => bandKeyOf(e, now) === band)
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

/**
 * 逐源实测统计：全部来自 48h 池的证据链真值，不依赖 gap_sources 运行态，也不写死数字。
 * 事件 → 首报源（publish_ts 最小）→ 该源首报次数；src_count 判交叉/孤证；
 * 有双时间戳的事件算该源相对首报的滞后，取中位。无样本一律 0 / null，界面须显示「待采」。
 */
const sourceHealthStats = computed<SourceHealthStat[]>(() => {
  const eventMap = new Map(events.value.map((e) => [e.id, e]))
  const first = firstSourceOf.value
  const rowsBySource = new Map<string, GapEventSourceRow[]>()
  for (const row of evidences.value) {
    const name = (row.source_name || '').trim() || '未知来源'
    const arr = rowsBySource.get(name)
    if (arr) arr.push(row)
    else rowsBySource.set(name, [row])
  }

  const out: SourceHealthStat[] = []
  for (const [source, rows] of rowsBySource) {
    const eventIds = new Set<number>(rows.map((r) => r.event_id))
    let firstCount = 0
    let crossCount = 0
    let loneCount = 0
    const lags: number[] = []
    let layer: GapLayer | null = null
    for (const row of rows) {
      if (!layer && row.layer) layer = row.layer
    }
    // 每个事件里该源只取最早一条带时间戳的行（同源重复不重复计滞后），与 Echo 链同口径
    const earliestByEvent = new Map<number, GapEventSourceRow>()
    for (const row of rows) {
      if (!row.publish_ts || row.publish_ts <= 0) continue
      const prev = earliestByEvent.get(row.event_id)
      if (!prev || row.publish_ts < (prev.publish_ts ?? Number.MAX_SAFE_INTEGER)) {
        earliestByEvent.set(row.event_id, row)
      }
    }
    for (const [eventId, row] of earliestByEvent) {
      const f = first(eventId)
      if (f && f.id === row.id) {
        firstCount += 1 // 该源是事件首报，首报本身没有滞后，不计入 lags
      } else if (f?.publish_ts && f.publish_ts > 0 && row.publish_ts) {
        lags.push((row.publish_ts - f.publish_ts) / 3600000)
      }
    }
    for (const id of eventIds) {
      const ev = eventMap.get(id)
      if (!ev) continue
      if (ev.src_count >= 2) crossCount += 1
      else loneCount += 1
    }
    const total = eventIds.size
    const sorted = [...lags].sort((a, b) => a - b)
    let lagH: number | null = null
    if (sorted.length) {
      const mid = sorted.length >> 1
      const hit = sorted[mid]
      if (hit != null) {
        lagH = sorted.length % 2
          ? Math.round(hit * 10) / 10
          : Math.round((((sorted[mid - 1] ?? 0) + hit) / 2) * 10) / 10
      }
    }
    out.push({
      source,
      layer,
      events: total,
      firstCount,
      crossCount,
      loneCount,
      lagH,
      firstPct: total > 0 ? Math.round((firstCount / total) * 100) : 0
    })
  }
  return out.sort((a, b) => b.firstCount - a.firstCount || b.events - a.events)
})

/* ============================================================
   三·补、T02 派生数据（全部只读 computed）
   ============================================================ */

/**
 * 时效衰减系数：按离散档位（3/6/12/24h）打折，避免连续公式随 30 秒时钟抖动重排。
 * 源站无时间（ts_published=0）按最旧档处理，不冒充新鲜。
 */
function freshFactorOf(ts: number, now: number): number {
  // 源站无时间：比最旧档再降一档，避免高 gap 的榜单条目压过有时间的新鲜事件
  if (ts <= 0) return GAP_FRESH_DECAY_OLD * 0.99
  const ageH = Math.max(0, (now - ts) / 3600000)
  for (const band of GAP_FRESH_DECAY) {
    if (ageH < band.maxHours) return band.factor
  }
  return GAP_FRESH_DECAY_OLD
}

/** 排名 + 展示分层：按池内分位而非绝对分数，L0 前 10% / L1 10–40% / L2 其余 */
const ranked = computed<RankedEvent[]>(() => {
  const now = nowMs.value
  // 排序键 = gap × 时效档位；gap 展示分不变，只影响先后。同分档内仍按 gap 降序、再按首见时间。
  const list = [...pool.value].sort((a, b) => {
    const ea = a.gap * freshFactorOf(a.ts_published, now)
    const eb = b.gap * freshFactorOf(b.ts_published, now)
    return eb - ea || b.gap - a.gap || (b.ts_first_seen || 0) - (a.ts_first_seen || 0)
  })
  const total = list.length
  return list.map((e, i) => {
    const ratio = total > 0 ? i / total : 1
    const tier: GapTier = ratio < 0.1 ? 'L0' : ratio < 0.4 ? 'L1' : 'L2'
    return { ...e, tier, rank: i + 1 }
  })
})

/**
 * 稍后读清单：按 laterIds 的加入顺序映射回完整 feed 中的事件对象。
 * 读完整 feed 而非 ranked，筛选/日期带切换时队列不会凭空消失；已过期的 id 直接跳过，不造占位。
 */
const laterList = computed<GapEventRow[]>(() => {
  const byId = new Map(events.value.map((row) => [row.id, row]))
  const out: GapEventRow[] = []
  for (const id of laterIds.value) {
    const hit = byId.get(id)
    if (hit) out.push(hit)
  }
  return out
})

/** 首屏批次：一次铺 20 条，点「加载更多」再追加 20，直到全池 */
export const FEED_BATCH = 20

/** 当前已展开条数；不随筛选复位，用户翻到哪就停在哪 */
const feedCount = ref<number>(FEED_BATCH)

/** 今日最新信息：ranked 前 feedCount 条（ranked 已按 gap 降序 + 首见时间次级排序，并带 tier/rank） */
const topList = computed<RankedEvent[]>(() => ranked.value.slice(0, feedCount.value))

/** 全池是否还有未展开的条目 */
const hasMoreTop = computed<boolean>(() => ranked.value.length > feedCount.value)

/** 加载更多：再展开一批，新出现的外文条目随之入翻译队列 */
function loadMoreTop(): void {
  feedCount.value += FEED_BATCH
  ensureI18n(ranked.value.slice(0, feedCount.value))
}

const tierCounts = computed<Record<GapTier, number>>(() => {
  const out: Record<GapTier, number> = { L0: 0, L1: 0, L2: 0 }
  for (const e of ranked.value) out[e.tier] += 1
  return out
})

/**
 * Echo 传播链：同一事件内按 publish_ts 排序的跨源首触序列（真实证据链，非回打兑现率）。
 * 只收有 ≥2 条带真实时间戳证据、且分属不同源的事件；同源重复行只保留最早那条。
 * 首触滞后 = 该源 publish_ts − 最早源 publish_ts（小时，一位小数）。
 * 这是「谁先报、谁跟、隔多久」的直接实测，不涉及任何预测或补齐。
 */
const echoChains = computed<EchoChain[]>(() => {
  const rankedById = new Map(ranked.value.map((r) => [r.id, r]))
  const byEvent = new Map<number, GapEventSourceRow[]>()
  for (const row of evidences.value) {
    const arr = byEvent.get(row.event_id)
    if (arr) arr.push(row)
    else byEvent.set(row.event_id, [row])
  }

  const out: EchoChain[] = []
  for (const [eventId, rows] of byEvent) {
    const ev = rankedById.get(eventId)
    if (!ev) continue
    // 同源取最早一条，且必须有真实时间戳
    const earliestBySource = new Map<string, GapEventSourceRow>()
    for (const row of rows) {
      if (!row.publish_ts || row.publish_ts <= 0) continue
      const name = (row.source_name || '').trim() || '未知来源'
      const prev = earliestBySource.get(name)
      if (!prev || row.publish_ts < (prev.publish_ts ?? Number.MAX_SAFE_INTEGER)) {
        earliestBySource.set(name, row)
      }
    }
    if (earliestBySource.size < 2) continue

    const ordered = [...earliestBySource.values()].sort(
      (a, b) => (a.publish_ts ?? 0) - (b.publish_ts ?? 0)
    )
    const firstTs = ordered[0]?.publish_ts ?? 0
    const hops: EchoChainHop[] = ordered.map((row) => ({
      source: (row.source_name || '').trim() || '未知来源',
      ts: row.publish_ts ?? 0,
      layer: row.layer ?? null,
      lagH: Math.round((((row.publish_ts ?? 0) - firstTs) / 3600000) * 10) / 10
    }))
    const spanH = hops.length > 1 ? (hops[hops.length - 1]?.lagH ?? 0) : 0
    out.push({
      eventId,
      title: ev.title,
      gap: ev.gap,
      tier: ev.tier,
      firstSource: hops[0]?.source ?? '未知来源',
      firstTs,
      spanH,
      hopCount: hops.length,
      hops
    })
  }
  return out.sort((a, b) => b.spanH - a.spanH || b.gap - a.gap)
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
  // 读 basePool 而非 pool：胶囊是筛选器本身，读筛选后池会导致选中一项后其余选项消失
  for (const e of basePool.value) {
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

/* ---------- 数据新鲜度：真数据 + 真实年龄，不再用 LIVE/DEMO 二分 ---------- */

/** 新鲜度分档：<1h 绿 / 1-12h 黄 / >12h 灰 / 时间未知 */
export type DataFreshnessTone = 'fresh' | 'aging' | 'old' | 'unknown'

/** 采集时刻（毫秒）：缺失或不可解析一律 null，绝不拿 0 当 1970 展示 */
const generatedTs = computed<number | null>(() => {
  const iso = meta.value?.generated_at
  if (typeof iso !== 'string' || !iso.trim()) return null
  const ts = Date.parse(iso)
  return Number.isFinite(ts) && ts > 0 ? ts : null
})

/** 数据年龄（小时，向下取整）：未来时间按 0 处理，不出现负年龄 */
const dataAgeHours = computed<number | null>(() => {
  const ts = generatedTs.value
  if (ts === null) return null
  return Math.max(0, Math.floor((nowMs.value - ts) / 3600_000))
})

/** 分档只用于顶栏配色，不改变任何打分/时差数字 */
const dataFreshnessTone = computed<DataFreshnessTone>(() => {
  const hours = dataAgeHours.value
  if (hours === null) return 'unknown'
  if (hours < 1) return 'fresh'
  if (hours < 12) return 'aging'
  return 'old'
})

/** 顶栏徽标文案：真实年龄；时间不可用时只给破折号，不编造 0 或负数 */
const dataAgeText = computed<string>(() => {
  const ts = generatedTs.value
  return ts === null ? '—' : `数据更新于 ${fmtAgo(ts, nowMs.value)}`
})

/** hover 说明：保留镜像/错误等真实降级信息，但不再把「数据旧」说成数据假 */
const dataFreshnessTitle = computed<string>(() => {
  const ts = generatedTs.value
  if (ts === null) return '采集时间缺失或无法解析；现有数据仍来自采集，只是无法确认更新时间'
  const base = `采集时间 ${fmtClock(ts)}；数据来自采集，可能滞后`
  // 「采集时间超过 40 分钟」已是常态，不再作为降级理由塞进提示
  const notes = demoReasons.value.filter((reason) => !reason.startsWith('采集时间'))
  return notes.length ? `${base}；${notes.join('；')}` : base
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
  filters.onlyForeign = false
  // 重置筛选等于回到首屏：展开批次一并收回，避免用户重置后仍面对一长串列表
  feedCount.value = FEED_BATCH
}

/** 稍后读：乐观更新（立即响应），登录后同步云端；写库失败回滚，localStorage 始终是离线镜像 */
function toggleLater(eventId: number): void {
  const has = laterIds.value.includes(eventId)
  const on = !has
  const next = on ? [...laterIds.value, eventId] : laterIds.value.filter((id) => id !== eventId)
  laterIds.value = next
  try {
    globalThis.localStorage?.setItem(LATER_KEY, JSON.stringify(next))
  } catch {
    /* 隐私模式下写不进去，内存态照常生效 */
  }
  if (userId.value) {
    void toggleLaterRemote(eventId, on).then((result: LaterWriteResult) => {
      if (result === 'schema-missing') {
        // 缺表/无权限：本地操作有效，保留刚才的写入，标记降级并如实提示（不回滚、不静默失败）
        laterLocalOnly.value = true
        console.warn('[gapdesk] gap_later 不可用，稍后读已降级为仅本机；执行 scripts/gapdesk_later.sql 后可跨端同步')
      } else if (result === 'offline') {
        // 真正的网络失败：回滚到操作前状态，避免双端口径不一致
        const rollback = on ? laterIds.value.filter((id) => id !== eventId) : [...laterIds.value, eventId]
        laterIds.value = rollback
        try {
          globalThis.localStorage?.setItem(LATER_KEY, JSON.stringify(rollback))
        } catch { /* ignore */ }
        console.warn('[gapdesk] 稍后读网络失败，已回滚')
      }
    })
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
    nowMs,
    favorites,
    mySubs,
    ruleRows,
    ruleLoaded,
    userId,
    evidences,
    laterIds,
    laterList,
    laterLocalOnly,
    canPurge,
    purgeState,
    purgeDeleted,
    purgeLastAt,
    purgeError,
    // 自动翻译
    autoTranslate,
    i18nMap,
    i18nBusy,
    i18nFailed,
    i18nBudgetOut,
    i18nBudgetLeft: computed(() => i18nBudgetLeft(i18nDaily.value)),
    i18nDailyChars: I18N_DAILY_CHARS,
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
    sourceHealthStats,
    echoChains,
    lagMedianHours,
    isLive,
    demoReasons,
    dataAgeHours,
    dataFreshnessTone,
    dataAgeText,
    dataFreshnessTitle,
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
    gapDiv,
    // 自动翻译动作
    titleOf,
    summaryOf,
    i18nStateOf,
    ensureI18n,
    clearI18nFailed,
    toggleAutoTranslate
  }
}
