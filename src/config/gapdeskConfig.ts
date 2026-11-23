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
  GapDim6Key,
  GapInd,
  GapLayer,
  GapPlatform,
  GapSeatPlan,
  SourceGradeTier
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

// ============================================================
// 九、展示六维（T02）
// ============================================================

/**
 * 库里 8 个 dim 归并为展示六维。
 * `from` 是归并口径：没映射到任何库维度的「人才薪酬」会一直是待采，
 * 这是真实覆盖情况，不用假数据填格子。
 */
export interface GapDim6Option {
  key: GapDim6Key
  label: string
  from: readonly GapDim[]
}

export const GAP_DIM6: readonly GapDim6Option[] = [
  { key: 'policy', label: '政策准入', from: ['policy', 'regulation'] },
  { key: 'price', label: '价格成本', from: ['cost'] },
  { key: 'supply', label: '供给产能', from: ['supply', 'channel'] },
  { key: 'capital', label: '资金交易', from: ['capital', 'capex'] },
  { key: 'talent', label: '人才薪酬', from: [] },
  { key: 'tech', label: '技术路线', from: ['tech'] }
] as const

export const GAP_DIM6_MAP: Readonly<Record<GapDim6Key, GapDim6Option>> = keyedByKey(GAP_DIM6)

/** 库维度 → 展示六维；用于筛选与矩阵归格 */
export const GAP_DIM6_OF: Readonly<Record<GapDim, GapDim6Key>> = {
  policy: 'policy',
  regulation: 'policy',
  cost: 'price',
  supply: 'supply',
  channel: 'supply',
  capital: 'capital',
  capex: 'capital',
  tech: 'tech'
}

// ============================================================
// 十、模块元数据（T02：13 PC + 5 移动，供侧栏 / 顶栏 / 路由壳共用）
// ============================================================

export interface GapModuleMeta {
  key: string
  label: string
  /** 分组名：看信息 / 分析 / 溯源 / 工作台 / 移动 */
  group: string
  /** 两位编号（mono 展示） */
  num: string
  scope: 'pc' | 'mb'
}

const MODULE_SEED: ReadonlyArray<Omit<GapModuleMeta, 'num'>> = [
  { key: 'brief', label: '今日简报', group: '看信息', scope: 'pc' },
  { key: 'latest', label: '最新信息', group: '看信息', scope: 'pc' },
  { key: 'source-risk', label: '信源分级', group: '看信息', scope: 'pc' },
  { key: 'echo', label: '命中率', group: '看信息', scope: 'pc' },
  { key: 'cycle', label: '周期视图', group: '看信息', scope: 'pc' },
  { key: 'profile', label: '行业档案', group: '分析', scope: 'pc' },
  { key: 'timeline', label: '时间线', group: '分析', scope: 'pc' },
  { key: 'matrix', label: '全景矩阵', group: '分析', scope: 'pc' },
  { key: 'spread', label: '传播路径', group: '分析', scope: 'pc' },
  { key: 'score', label: '评分模式', group: '分析', scope: 'pc' },
  { key: 'source', label: '单源情报', group: '溯源', scope: 'pc' },
  { key: 'archive', label: '归档检索', group: '溯源', scope: 'pc' },
  { key: 'ai', label: 'AI 研判', group: '溯源', scope: 'pc' },
  { key: 'alert', label: '订阅提醒', group: '工作台', scope: 'pc' },
  { key: 'report', label: '导出报告', group: '工作台', scope: 'pc' },
  { key: 'seats', label: '团队席位', group: '工作台', scope: 'pc' },
  { key: 'pricing', label: '价格', group: '工作台', scope: 'pc' },
  { key: 'detail', label: '详情', group: '二级', scope: 'pc' },
  { key: 'm-latest', label: '最新', group: '移动', scope: 'mb' },
  { key: 'm-profile', label: '行业', group: '移动', scope: 'mb' },
  { key: 'm-matrix', label: '全景', group: '移动', scope: 'mb' },
  { key: 'm-source', label: '单源', group: '移动', scope: 'mb' },
  { key: 'm-pricing', label: '价格', group: '移动', scope: 'mb' }
]

/** 13 个 PC 注册表 key（含二级 detail）+ 5 个移动 key 的元数据 */
export const GAP_MODULE_META: readonly GapModuleMeta[] = MODULE_SEED.map((m, i) => ({
  ...m,
  num: String(i).padStart(2, '0')
}))

export const GAP_MODULE_MAP: Readonly<Record<string, GapModuleMeta>> = Object.fromEntries(
  GAP_MODULE_META.map((m) => [m.key, m])
)

// ============================================================
// 十一、空态文案唯一真源（T02）
//     组件只读这里，禁止在各视图里另写一份「暂无数据」。
// ============================================================

export const EMPTY_ARCHIVE = '历史归档需二期（当前仅保留 48h）'
export const EMPTY_ECHO = '回打样本积累中'
export const EMPTY_EXPORT = '检索/导出 未接线'
export const EMPTY_MEMBERS = '无成员数据源，不造人'
export const EMPTY_LLM = '本段由真实事件按固定规则归纳，非大模型生成'
export const EMPTY_PUSH = '规则已存，真实推送待二期'
export const EMPTY_HISTORY = '历史序列需快照积累，不补假趋势'
export const EMPTY_WAIT = '待采'
export const EMPTY_DEMO = 'DEMO · 演示数据　未连上网关，以下内容不是实时源数据'

/** 空态组件的四态标题/说明也走这里，组件内零文案硬编码 */
export const EMPTY_LOADING = '采集任务每 30 分钟跑一轮，稍等片刻'
export const EMPTY_ERROR = '数据暂时取不到，已保留上一次成功加载的结果'
export const EMPTY_STALE = '当前展示的是本地镜像，分数与热度可能已过期'
export const EMPTY_GENERIC = '当前时间窗内没有可展示的差值'

/** 事件池为空：只说明当前筛选下无可展示事件，不替采集链路背书 */
export const EMPTY_WINDOW = '当前时间窗与筛选条件下没有达到展示阈值的事件；不补条目凑数'

/** 单条详情取不到：列表仍在，只是这条已过期或未加载 */
export const EMPTY_MISSING = '这条差值未加载或已过期（入库保留 48 小时），请回列表重试'

/** 空态组件的结构标签也放这里，避免组件里散落硬编码文案 */
export const EMPTY_WHY_TITLE = '为什么没有'
export const EMPTY_PHASE_TITLE = '二期标记'

// ============================================================
// 十二、T01 增量口径常量（新视图只读这里，组件内零硬编码）
// ============================================================

/** 供给序列空态：48h 内通常只有 1-3 个真实日点，不补假历史 */
export const EMPTY_SUPPLY = '供给序列积累中'

/** 网关不可用时的信源健康空态：运维依据不能填假数字 */
export const EMPTY_SR_GATEWAY = '网关未连接，读不到信源健康度。此处不展示演示数据——信源状态是运维依据，填假数字比空着更危险'

/** 兑现率口径：样本不足就不出数，宁可留白 */
export const EMPTY_ECHO_RULE = '样本≥30 才显示兑现率；只统计 L0/L1；同源跟发不计入；窗口未满记待验证、不计入分母'

/** AI 模块边界：有输入框但明确告知不会得到回答 */
export const EMPTY_AI_INPUT = '追问任意一条差值（本模块未接入对话模型，输入不会产生回答）'

/** 推送 / 在线学习的二期边界，避免把「已配置」说成「已接入」 */
export const EMPTY_AI_PUSH = '企微 / 钉钉 / 飞书定时推送尚未接入'
export const EMPTY_AI_WEIGHT = '按反馈在线更新权重尚未实现'

/**
 * 四维权重（T01 先落常量，视图只读不写）。
 * rare>1 鼓励孤证早报，action<1 抑制不可执行项。
 */
export const GAP_WEIGHTS = { time: 0.90, rare: 1.10, impact: 0.85, action: 0.75 } as const

/**
 * 信源层级 → 分级档位（唯一真源，composable 与视图共用）。
 * mass 只做出圈探针、不进情报池，但稳定性最好，故归可靠层；
 * tech 海外源波动大，归探针层；其余官方层。
 */
export const SR_TIER_OF: Readonly<Record<GapLayer, SourceGradeTier>> = {
  mass: 'reliable',
  tech: 'probe',
  insider: 'official',
  main: 'official',
  rare: 'official'
}

/** 分级展示顺序：汇总卡片按此顺序渲染，避免各视图自己排一遍 */
export const SR_TIERS: readonly SourceGradeTier[] = ['reliable', 'official', 'probe']
