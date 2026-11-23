/**
 * 差值台 GAPDESK · 数据层类型契约（第一批）
 *
 * 约定：
 * 1) 字段名与 `scripts/gapdesk.sql` 严格一一对应，统一 snake_case，
 *    以便直接消费 Supabase 返回值，零映射层、零抄错风险；
 * 2) 可空性对齐 SQL：带 `not null` 的列在 TS 里非空，其余为 `T | null`；
 * 3) 所有 jsonb 列都给具体类型，不使用 `any`（读取时仍建议过
 *    `safeJson()` 兜底，因为 Supabase Realtime 载荷偶尔会回字符串）。
 */

// ============================================================
// 一、枚举键（与 src/config/gapdeskConfig.ts 的常量表一一对应）
// ============================================================

/** 8 个行业赛道 */
export type GapInd = 'ai' | 'fin' | 'med' | 'en' | 'mfg' | 'agri' | 'prop' | 'glob'

/** 8 个差值维度 */
export type GapDim =
  | 'policy'
  | 'capex'
  | 'cost'
  | 'supply'
  | 'tech'
  | 'capital'
  | 'channel'
  | 'regulation'

/** 事件主层（决定它先出现在哪条轨道） */
export type GapKind = 'insider' | 'main' | 'rare' | 'tech'

/** 信源层级（比 kind 多一层 mass：大众榜只做「是否出圈」探针，不进情报池） */
export type GapLayer = 'insider' | 'main' | 'rare' | 'tech' | 'mass'

/** 四维分解：[决策圈, 主流, 冷门, 海外前沿] */
export type GapB = [number, number, number, number]

/** 信源健康状态 */
export type GapSourceStatus = 'unknown' | 'ok' | 'warn' | 'fail'

/** 套餐档位（gap_seats.plan） */
export type GapSeatPlan = 'trial' | 'insight' | 'team' | 'business' | 'enterprise'

/** 差值分档，供 UI 选色 */
export type GapTone = 'hot' | 'warm' | 'cool'

/**
 * 展示分层：按完整事件池的强度排名分位，不用绝对分数阈值。
 * L0 = 前 10%（必读）· L1 = 10–40%（关注）· L2 = 其余 60%（存档）。
 * 池子在增长，所以各层条数会变动，这是实时相对分层的正常表现。
 */
export type GapTier = 'L0' | 'L1' | 'L2'

/** 排名后的事件：rank 从 1 起，tier 由 rank 在池内的分位决定 */
export type RankedEvent = GapEventRow & { tier: GapTier; rank: number }

/** 展示用六维（由库里 8 个 dim 归并，无对应源的维度留空 = 待采） */
export type GapDim6Key = 'policy' | 'price' | 'supply' | 'capital' | 'talent' | 'tech'

/** 大众探针平台 */
export type GapPlatform = '微博' | '知乎' | '抖音'

// ============================================================
// 二、表行类型（对应 SQL 的 7 + 2 张表）
// ============================================================

/** `public.gap_events` · 全局共享事件主表 */
export interface GapEventRow {
  id: number
  /** 标题指纹（FNV-1a 32 位 hex），见 eventKeyOf() */
  event_key: string
  /** 唯一约束占位列；一期恒为 ''，二期填行业键实现「指纹+行业」双键 */
  uniq_keep: string
  title: string
  /** 源站原文截断，不落地全文 */
  summary: string | null
  url: string | null
  ind: GapInd
  dim: GapDim
  kind: GapKind
  /** 展示分 0-100 */
  gap: number
  /** 启发式原始分 */
  gap_raw: number
  /** 四维分解 */
  b_json: GapB
  tags: string[]
  /** 源站发布时间 epoch ms；0 表示源站无时间 */
  ts_published: number
  /** 本系统首次观测 epoch ms */
  ts_first_seen: number
  /** 决策圈热度（投票 + 评论） */
  ins_heat: number | null
  /** 主流媒体互动量 */
  pub_heat: number | null
  /** 命中的大众榜名称；未出圈为 null */
  mass_on: string | null
  /** 大众榜真实热度；0 = 尚未出圈 */
  mass_heat: number | null
  /** 事件簇内各源发布时间差（小时） */
  lag_h: number | null
  src_count: number
  /** 判定理由（由已算特征拼装） */
  reason: string | null
  /** 建议动作 */
  action: string | null
  is_foreign: boolean | null
  /** ISO 时间串，默认 now()+48h */
  expire_at: string
  created_at: string
  updated_at: string
}

/** `public.gap_event_sources` · 事件证据链 */
export interface GapEventSourceRow {
  id: number
  event_id: number
  source_name: string | null
  layer: GapLayer | null
  url: string | null
  /** epoch ms；null = 源站无时间 */
  publish_ts: number | null
  /** 该源上的真实互动量 */
  heat: number | null
}

/** `public.gap_event_platform` · 平台首触/热度（只增不改） */
export interface GapPlatformRow {
  id: number
  event_id: number
  platform: string | null
  /** epoch ms；0 = 未触达 */
  first_touch_ts: number | null
  heat: number | null
  updated_at: string
}

/** `public.gap_sources` · 15 路信源健康 */
export interface GapSourceRow {
  /** 如 wallstreetcn */
  id: string
  name: string
  layer: GapLayer
  /** 建议缓存 TTL（分钟） */
  ttl: number | null
  ok: number | null
  fail: number | null
  last_ok: string | null
  last_fail: string | null
  latency_ms: number | null
  items: number | null
  status: GapSourceStatus | null
  msg: string | null
}

/** `public.gap_favorites` · 收藏 */
export interface GapFavoriteRow {
  user_id: string
  event_id: number
  created_at: string
}

/** `public.gap_reads` · 已读 */
export interface GapReadRow {
  user_id: string
  event_id: number
  read_at: string | null
}

/** `public.gap_subscriptions` · 行业订阅 */
export interface GapSubscriptionRow {
  user_id: string
  ind: GapInd
  created_at: string
}

/** 预警规则的 DSL 结构（gap_rules.dsl） */
export interface GapRuleDsl {
  /** 命中的行业，空数组视为不限 */
  ind: GapInd[]
  /** 命中的维度，空数组视为不限 */
  dim: GapDim[]
  /** 差值分下限 */
  gapMin: number
  /** 信源数上限（越少越早，用于「早于主流」触发） */
  srcMax: number
  /** 观察窗口（小时） */
  windowH: number
  /** 推送渠道，如 ['wecom', 'email'] */
  channels: string[]
}

/** `public.gap_rules` · 用户级预警规则 */
export interface GapRuleRow {
  id: string
  user_id: string
  name: string | null
  dsl: GapRuleDsl
  channels: string[]
  enabled: boolean | null
  hits: number | null
  created_at: string
}

/** `public.gap_seats` · 席位与用量 */
export interface GapSeatRow {
  user_id: string
  plan: GapSeatPlan | null
  seats: number | null
  quota_used: number | null
  quota_total: number | null
  updated_at: string
}

// ============================================================
// 三、视图聚合类型（组件层消费，不落库）
// ============================================================

/** 事件 + 证据链（列表展开面板 / 详情页使用） */
export interface GapEventWithSources extends GapEventRow {
  sources: GapEventSourceRow[]
  /** 平台首触（可选：详情页才查） */
  platforms?: GapPlatformRow[]
}

/** 信源健康聚合（对应服务端 /api/health 的 summary 段） */
export interface GapHealth {
  /** 健康源数 */
  ok: number
  /** 失败源数 */
  fail: number
  /** 平均延迟（ms） */
  latency: number
  /** 单轮合计条数 */
  items: number
  /** 总体状态 */
  status: GapSourceStatus
}

/**
 * 日期胶囊：按 ts_published 归日；ts=0 的条目单列「时间未知」。
 * kind 决定 UI 形态：live=渐变强调 / today=普通胶囊 / date=日期 / unknown=待采口径。
 */
export interface GapDateBand {
  key: string
  label: string
  count: number
  kind: 'live' | 'today' | 'date' | 'unknown'
  /** 该日 00:00 的 epoch ms；未知时间为 null */
  ts: number | null
}

/** 6 维矩阵单元格：空格返回 null，UI 标「待采」，绝不补 0 */
export interface GapMatrix6Cell {
  maxGap: number
  count: number
  /** 该格最高分事件 id，供点击下钻 */
  topId: number
}

/** 8 行业 × 6 维展示矩阵 */
export type GapMatrix6 = Record<GapInd, Record<GapDim6Key, GapMatrix6Cell | null>>

/** 逐源分组：silent=true 表示该源今日没有带真实发布时间的证据行 */
export interface SourceGroup {
  source: string
  layer: GapLayer | null
  events: GapEventRow[]
  silent: boolean
}

/** 采集脚本注入结果（一期只读表结构，二期采集侧写入后回传） */
export interface GapInjectResult {
  /** 新增事件数 */
  added: number
  /** 命中已有事件并更新（热度/证据）数 */
  updated: number
  /** 去重后跳过数 */
  skipped: number
  /** 过期清理条数（gapdesk_purge 返回） */
  purged: number
}

// ============================================================
// 三·补、T01 派生聚合类型（组件层消费，不落库）
// ============================================================

/** 每日供给序列：本地归日后的真实条数与分层条数（ts=0 不计入） */
export interface SupplyDayRow {
  key: string
  label: string
  count: number
  l0: number
  l1: number
  l2: number
}

/** 信源分级档位：mass 探针归可靠层、tech 归探针层，其余归官方层 */
export type SourceGradeTier = 'reliable' | 'official' | 'probe'

/** 信源运行态：cool=冷却 / down=离线 / warn=降级 / ok=在线 / idle=待验证 */
export type SourceStatusKind = 'ok' | 'warn' | 'down' | 'cool' | 'idle'

/** 单源分级行：分数来自 gap_sources 的 ok/fail 实测，无样本时 score=null */
export interface SourceGradeRow {
  id: string
  name: string
  layer: GapLayer
  tier: SourceGradeTier
  score: number | null
  status: SourceStatusKind
  msg: string
  items: number | null
  ok: number | null
  fail: number | null
}

/** 分级汇总：avg 只对 score≠null 的源求均，不把待验证源算成 0 分 */
export interface SourceGradeAgg {
  tier: SourceGradeTier
  count: number
  avg: number | null
}

// ============================================================
// 四、Supabase 便捷泛型（可选使用，避免各处手写 Row）
// ============================================================

/** 表名 → 行类型的映射，便于写通用仓储函数 */
export interface GapTableMap {
  gap_events: GapEventRow
  gap_event_sources: GapEventSourceRow
  gap_event_platform: GapPlatformRow
  gap_sources: GapSourceRow
  gap_favorites: GapFavoriteRow
  gap_reads: GapReadRow
  gap_subscriptions: GapSubscriptionRow
  gap_rules: GapRuleRow
  gap_seats: GapSeatRow
}
