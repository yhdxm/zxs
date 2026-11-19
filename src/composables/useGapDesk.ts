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
import { computed, reactive, ref } from 'vue'
import { useCloudSync } from './useCloudSync'
import { cacheGetStale, cacheSet } from '../services/cloudSyncService'
import {
  loadFeed,
  listFavorites,
  listSubscriptions,
  markRead,
  resolveUserId,
  toggleFavorite as toggleFavoriteRemote,
  toggleSubscribe as toggleSubscribeRemote,
  type GapFeedData,
  type GapFeedMeta
} from '../services/gapdeskService'
import { GAP_CACHE_TTL, GAP_DIM, GAP_GAP_MIN, GAP_IND, GAP_TTL_HOURS } from '../config/gapdeskConfig'
import type {
  GapDim,
  GapEventRow,
  GapInd,
  GapPlatformRow,
  GapSourceRow
} from '../types/gapdesk'

/** 本地镜像 key（与 cloudSyncService 的缓存信封同名约定） */
const CACHE_KEY = 'gapdesk_feed'

/** 可选时间窗（小时）：产品只承诺近 48 小时，更窄的窗口是用户自己的取舍 */
export const GAP_WINDOW_OPTIONS = [6, 12, 24, 48] as const

export interface GapFilters {
  /** 行业过滤，空数组 = 全部 */
  inds: GapInd[]
  /** 时间窗（小时），按 ts_published 过滤（ts=0 的榜单条目不受限） */
  windowH: number
  sort: 'gap' | 'latest'
  keyword: string
  /** 只看我订阅的行业 */
  onlySub: boolean
}

/* ============================================================
   一、state（模块级单例）
   ============================================================ */
const events = ref<GapEventRow[]>([])
const platforms = ref<GapPlatformRow[]>([])
const sources = ref<GapSourceRow[]>([])
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
/** 当前登录用户的 auth uid（空 = 未登录，写操作直接跳过） */
const userId = ref('')

const filters = reactive<GapFilters>({
  inds: [],
  windowH: GAP_TTL_HOURS,
  sort: 'gap',
  keyword: '',
  onlySub: false
})

let inflight: Promise<void> | null = null

/* ============================================================
   二、加载
   ============================================================ */

/** 把一份 feed 写进 state（缓存回放与网络结果共用同一条路径） */
function applyFeed(data: GapFeedData): void {
  events.value = Array.isArray(data.events) ? data.events : []
  platforms.value = Array.isArray(data.platforms) ? data.platforms : []
  sources.value = Array.isArray(data.sources) ? data.sources : []
  meta.value = data.meta ?? null
}

/** 拉用户态数据（收藏/订阅）。未登录时静默跳过，不产生错误提示 */
async function loadUserState(): Promise<void> {
  const uid = await resolveUserId()
  userId.value = uid
  if (!uid) {
    favorites.value = []
    mySubs.value = []
    return
  }
  const [fav, sub] = await Promise.all([listFavorites(uid), listSubscriptions(uid)])
  favorites.value = fav.data.map((f) => f.event_id)
  mySubs.value = sub.data.map((s) => s.ind)
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
        error.value = res.error
        console.warn('[gapdesk] feed 拉取失败，已回退离线镜像', res.error)
      } else {
        applyFeed(res.data)
        stale.value = false
        staleAgeMs.value = 0
        lastLoadedAt.value = Date.now()
        // 部分失败也把错误带出去（界面可提示「信源面板暂不可用」），但数据照常展示
        error.value = res.error
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

  return list.sort((a, b) =>
    filters.sort === 'gap' ? b.gap - a.gap : (b.ts_first_seen || 0) - (a.ts_first_seen || 0)
  )
})

/** 今日 Top14：按 gap 降序的前 14 条（今日视图首屏） */
const top14 = computed<GapEventRow[]>(() => {
  const sorted = [...pool.value].sort((a, b) => b.gap - a.gap)
  return sorted.slice(0, 14)
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

function setSort(sort: 'gap' | 'latest'): void {
  filters.sort = sort
}

function setKeyword(kw: string): void {
  filters.keyword = kw
}

function resetFilters(): void {
  filters.inds = []
  filters.windowH = GAP_TTL_HOURS
  filters.sort = 'gap'
  filters.keyword = ''
  filters.onlySub = false
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
    userId,
    // derived
    pool,
    top14,
    stats,
    matrix,
    lag,
    underground,
    health,
    // actions
    load: loadGapFeed,
    toggleInd,
    setWindow,
    setSort,
    setKeyword,
    resetFilters,
    toggleFavoriteEvent,
    toggleSubscription,
    markEventRead,
    isFavorite,
    gapDiv
  }
}
