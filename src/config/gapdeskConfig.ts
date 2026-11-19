/**
 * 差值台 GAPDESK · 前端常量（纯数据，零副作用）
 *
 * 本文件刻意【不 import 任何运行时模块】（只用 `import type`，编译后完全擦除），
 * 以便被以下三处共用而不会拖入 Vue / Supabase：
 *   1) 前端组件与页面；
 *   2) 采集脚本（Node，server.mjs 同源口径）；
 *   3) 单元测试。
 *
 * 唯一数据源原则：行业 / 维度 / 层级 / 套餐 / 信源种子 全部只在这里定义一次，
 * 其它地方（菜单、筛选器、图例、健康面板）一律引用，禁止就地写死字符串。
 */
import type {
  GapDim,
  GapInd,
  GapLayer,
  GapPlatform,
  GapSeatPlan
} from '../types/gapdesk'

// ============================================================
// 一、选项类型
// ============================================================

/** 行业选项（key 与库表 gap_events.ind 一致） */
export interface GapIndOption {
  key: GapInd
  label: string
  /** 主色，用于徽标/图例/雷达图 */
  color: string
}

/** 差值维度选项（与 gap_events.dim 一致） */
export interface GapDimOption {
  key: GapDim
  label: string
}

/** 信源层级选项（与 gap_sources.layer 一致） */
export interface GapLayerOption {
  key: GapLayer
  label: string
  /** UI 副标题，说明这一层「要证据什么」 */
  desc: string
}

/** 套餐选项 */
export interface GapPlanOption {
  key: GapSeatPlan
  name: string
  /** 年费（元）；insight 为 0 */
  price: number
  /** 展示用价格文案，避免各处自己拼「元/席/年」 */
  priceLabel: string
  /** 起售席位数 */
  minSeats: number
  features: readonly string[]
}

/**
 * 把 `[{ key, ... }]` 常量表折成 `Record<key, 项>` 索引表。
 * 泛型保证：键集合必须由常量表自身推导，漏写一项时编译期即报错（不会静默缺项）。
 * 只在模块初始化时跑一次，无副作用。
 */
function keyedByKey<K extends string, V extends { readonly key: K }>(
  list: readonly V[]
): Record<K, V> {
  const map = {} as Record<K, V>
  for (const item of list) map[item.key] = item
  return map
}

// ============================================================
// 二、行业：8 个赛道
// ============================================================

export const GAP_IND = [
  { key: 'ai', label: 'AI与数字经济', color: '#6366F1' },
  { key: 'fin', label: '金融与资管', color: '#0EA5E9' },
  { key: 'med', label: '医药与健疗', color: '#10B981' },
  { key: 'en', label: '能源与电力', color: '#F59E0B' },
  { key: 'mfg', label: '制造与工业', color: '#F97316' },
  { key: 'agri', label: '农业与食品', color: '#22C55E' },
  { key: 'prop', label: '地产与基建', color: '#8B5CF6' },
  { key: 'glob', label: '出海与全球', color: '#EC4899' }
] as const satisfies readonly GapIndOption[]

/** 行业 key → 选项，O(1) 取 label / color */
export const GAP_IND_MAP: Readonly<Record<GapInd, GapIndOption>> = keyedByKey(GAP_IND)

// ============================================================
// 三、维度：8 个（政策 / 资本开支 / 成本 / 供给 / 技术 / 资本 / 渠道 / 合规）
// ============================================================

export const GAP_DIM = [
  { key: 'policy', label: '政策与监管' },
  { key: 'capex', label: '资本开支' },
  { key: 'cost', label: '成本与价格' },
  { key: 'supply', label: '供给与产能' },
  { key: 'tech', label: '技术与模型' },
  { key: 'capital', label: '资本与融资' },
  { key: 'channel', label: '渠道与跨境' },
  { key: 'regulation', label: '合规与准入' }
] as const satisfies readonly GapDimOption[]

/** 维度 key → 选项 */
export const GAP_DIM_MAP: Readonly<Record<GapDim, GapDimOption>> = keyedByKey(GAP_DIM)

// ============================================================
// 四、信源层级：5 层（前 4 层进情报池，mass 只做「出圈」探针）
// ============================================================

export const GAP_LAYER = [
  { key: 'insider', label: '决策圈快讯', desc: '行业决策者当天就该看到的快讯' },
  { key: 'main', label: '主流媒体', desc: '已经被大范围复述，差值正在收敛' },
  { key: 'rare', label: '冷门与垂直', desc: '垂直站点先报，主流尚未跟进' },
  { key: 'tech', label: '海外前沿', desc: '海外先发生，境内尚未落地' },
  { key: 'mass', label: '大众探针', desc: '只判断是否出圈，不计入情报池' }
] as const satisfies readonly GapLayerOption[]

/** 层级 key → 选项 */
export const GAP_LAYER_MAP: Readonly<Record<GapLayer, GapLayerOption>> = keyedByKey(GAP_LAYER)

// ============================================================
// 五、套餐：4 档（价格口径与商用方案一致）
// ============================================================

export const GAP_PLAN = [
  {
    key: 'insight',
    name: '洞察版',
    price: 0,
    priceLabel: '免费',
    minSeats: 1,
    features: ['每日 20 条精选差值', '行业筛选', '收藏与已读']
  },
  {
    key: 'team',
    name: '团队版',
    price: 3600,
    priceLabel: '¥3,600 / 席 / 年',
    minSeats: 5,
    features: ['全量差值事件', '证据链展开', '5 个预警规则', '团队共享收藏']
  },
  {
    key: 'business',
    name: '商业版',
    price: 5200,
    priceLabel: '¥5,200 / 席 / 年',
    minSeats: 15,
    features: ['8 行业全覆盖', '预警规则不限', '用量看板', '专属信源投递']
  },
  {
    key: 'enterprise',
    name: '企业版',
    price: 300000,
    priceLabel: '年框 ¥30-40 万',
    minSeats: 15,
    features: ['私有化部署', '定制信源与抽取器', 'API 与数据回传', '专属客户成功']
  }
] as const satisfies readonly GapPlanOption[]

/**
 * 可售套餐键（trial 是库里的默认值，不是商品，故不在 GAP_PLAN 中）
 */
export type GapPlanKey = Exclude<GapSeatPlan, 'trial'>

/** 套餐 key → 选项（GAP_PLAN 已覆盖全部 GapPlanKey，可安全 O(1) 取用） */
export const GAP_PLAN_MAP: Readonly<Record<GapPlanKey, GapPlanOption>> = keyedByKey(GAP_PLAN)

/** 试用版展示文案（gap_seats.plan 默认值，未付费时使用） */
export const GAP_PLAN_TRIAL_LABEL = '试用版'

/** 按套餐键取展示名，trial / null / 未知值一律回落「试用版」，避免界面出现 raw key */
export function gapPlanLabel(plan: GapSeatPlan | null | undefined): string {
  if (!plan || plan === 'trial') return GAP_PLAN_TRIAL_LABEL
  const found = GAP_PLAN_MAP[plan]
  return found ? found.name : GAP_PLAN_TRIAL_LABEL
}

// ============================================================
// 六、大众探针平台
// ============================================================

export const GAP_PLATFORM = ['微博', '知乎', '抖音'] as const satisfies readonly GapPlatform[]

// ============================================================
// 七、信源层级的展示口径（层 → 中文标签 / 展示顺序）
//     ⚠️ 这里**不维护信源清单**。
//     25 路真实注册表在 `scripts/gapdesk/sources.mjs`（采集脚本的唯一真源），
//     健康度落在库表 `gap_sources`；前端健康面板一律读表，不用前端常量兜底 ——
//     否则两处 id 一旦漂移（历史上 hn_new vs hn、eastmoney vs eastmoney724 就对不上），
//     面板会出现「源在表里、界面查不到」的幽灵行。
// ============================================================

/** 层 → 中文标签（健康面板分组标题、卡片来源层标签共用） */
export const GAP_LAYER_LABEL: Readonly<Record<GapLayer, string>> = {
  insider: '决策圈快讯',
  main: '主流媒体',
  rare: '冷门与垂直',
  tech: '海外前沿',
  mass: '大众探针'
}

/** 层展示顺序：越「早」的层排越前（情报池 4 层在前，探针层压底） */
export const GAP_LAYER_ORDER: readonly GapLayer[] = ['insider', 'main', 'rare', 'tech', 'mass']

// ============================================================
// 八、口径常量（改这里即可全局生效）
// ============================================================

/** 事件保留时长（小时）：与库里 expire_at 默认 48h、清理函数一致 */
export const GAP_TTL_HOURS = 48

/** 前端轮询/订阅补偿刷新间隔（毫秒） */
export const GAP_REFRESH_MS = 30000

/** 前端本地缓存 TTL（毫秒）：5 分钟 */
export const GAP_CACHE_TTL = 5 * 60 * 1000

/**
 * 差值分展示阈值：低于此值的「差值」不值得打扰用户。
 * 为什么是 85 而不是 75：展示分是**池内分位**映射（54-97），
 * 实测 333 条里 191 条 ≥75 —— 75 恰好落在中位数附近，等于「全都推」。
 * 85 对应池内约前 25%，才是「真的有人还不知道」的量级。
 */
export const GAP_GAP_MIN = 85

/** 差值分上限（算分与进度条共用） */
export const GAP_GAP_MAX = 100

/** 单页事件条数 */
export const GAP_PAGE_SIZE = 20
