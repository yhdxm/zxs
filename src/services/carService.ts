// 星舆识途（汽车模块）数据层 — 全部免费、可降级。
// 数据源：
//  - 汽车/品牌/优惠/新品热点：复用 newsService（Google News RSS + 三级代理兜底）
//  - 行业宏观（中汽协/乘联会）：chinadata.live（免费无 key），失败降级 ourworldindata 全球 EV CSV
//  - 销量排行榜：新闻聚合 + 已配置 AI 结构化提炼（乘联会未开放免费结构化 API）
//  - 汽车知识/类型：内置知识库（静态，零网络依赖）

import { fetchNews, fetchRssViaProxies, type NewsItem } from './newsService'
import { fetchCorsJson, fetchCorsText } from './freeApi'
import { callAi, type AiConfig } from './aiService'

export interface CarNewsItem extends NewsItem {}

/** 常见汽车品牌（用于品牌热点切换） */
export const CAR_BRANDS = [
  '比亚迪', '特斯拉', '丰田', '大众', '本田', '日产', '蔚来', '小鹏', '理想',
  '长城', '吉利', '长安', '宝马', '奔驰', '奥迪', '华为问界', '小米汽车', '奇瑞'
]

/** 汽车类型知识库 */
export interface CarType {
  name: string
  desc: string
}
export const CAR_TYPES: CarType[] = [
  { name: '轿车 (Sedan)', desc: '三厢四门、重心低、操控与舒适性均衡，适合家用与商务。按轴距分 A00/A0/A/B/C 级。' },
  { name: 'SUV（运动型多用途车）', desc: '空间大、视野高、通过性好，是国内销量最大的品类，含燃油/混动/纯电。' },
  { name: 'MPV（多用途车）', desc: '侧滑门、2+2+3 布局，主打家用多人出行与商务接待，如别克 GL8、腾势 D9。' },
  { name: '新能源纯电 (BEV)', desc: '电池驱动、零排放、使用成本低；续航与补能网络是核心考量。' },
  { name: '插电混动 (PHEV)', desc: '可油可电、无续航焦虑，短途用电、长途用油，绿牌政策友好。' },
  { name: '增程式 (EREV)', desc: '电机驱动 + 小排量发动机发电，纯电驾感兼顾长续航，理想/问界主推。' },
  { name: '皮卡 (Pickup)', desc: '货箱+座舱，工具与玩乐属性兼具；国内多地已放宽进城限制。' },
  { name: '跑车 / 性能车', desc: '强调动力与操控，多为小众高价，电动化后加速性能大幅跃升。' }
]

/** 汽车通识知识库（小白可读） */
export interface CarKnowledge {
  title: string
  content: string
}
export const CAR_KNOWLEDGE: CarKnowledge[] = [
  { title: '什么是「三电系统」', content: '指电池、电机、电控，是新能源汽车的核心。电池决定续航，电机决定动力，电控负责能量调度与热管理。' },
  { title: '续航与「续航虚标」', content: 'CLTC/WLTC 为实验室工况续航，实际受气温、车速、空调影响。冬季续航通常打 6-8 折，属正常现象。' },
  { title: '新能源购置税政策', content: '2024-2025 年购置新能源汽车免征车辆购置税；2026-2027 年减半征收（设免税上限），以发票价计税。' },
  { title: '保值率怎么看', content: '三年保值率 = 三年后二手车价 / 新车开票价的比值。混动与头部燃油车通常更保值，部分纯电因技术迭代较快保值率偏低。' },
  { title: 'L2 / L2+ 辅助驾驶', content: 'L2 为组合驾驶辅助（ACC+车道保持），驾驶员须全程监管；L2+ 增加自动变道等，仍属辅助而非自动驾驶。' },
  { title: '终端优惠与「裸车价」', content: '终端优惠 = 指导价 - 实际成交价，含现金直降、置换补贴、金融贴息。落地价还需加购置税、保险、上牌。' },
  { title: '乘联会 vs 中汽协', content: '乘联会(CPCA)偏零售/批发口径、月度快讯多；中汽协(CAAM)覆盖乘用车+商用车产销。两者统计口径略有差异。' },
  { title: '看懂销量「批发/零售/上险」', content: '批发量=厂→经销商；零售量=经销商→用户；上险量=实际注册登记，最贴近真实终端需求。' }
]

/** 抓取汽车相关新闻（热点/优惠/新品/品牌） */
export async function fetchCarNews(keyword: string, limit = 20): Promise<CarNewsItem[]> {
  try {
    const items = await fetchNews({ keyword, limit })
    if (items.length) return items
  } catch {
    /* 主源失败，走兜底 */
  }
  // 兜底：汽车专属免费 RSS（Jalopnik / The Verge Cars 等，经 CORS 代理）
  const fb = await fetchCarFallback(limit)
  return fb
}

/** 汽车专属免费 RSS 托底源（仅国内源，免 Key、前端直连），Google News 不可达时使用。 */
const CAR_FALLBACK_FEEDS = [
  'https://www.autohome.com.cn/rss/',
  'https://auto.sohu.com/rss/auto.xml'
]

function fmtNowShort(): string {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

/**
 * 兜底抓取：优先尝试国内免费 RSS；若仍为空，返回内置国内精选（保证页面永不空白）。
 * 严格只看国内源（用户要求「只要国内的」），不拉取国际资讯。
 */
async function fetchCarFallback(limit: number): Promise<CarNewsItem[]> {
  const seen = new Set<string>()
  const out: CarNewsItem[] = []
  for (const url of CAR_FALLBACK_FEEDS) {
    try {
      const items = await fetchRssViaProxies(url)
      for (const it of items) {
        if (!it.title || seen.has(it.id)) continue
        seen.add(it.id)
        out.push(it)
      }
      if (out.length >= limit) break
    } catch {
      /* 忽略单个源失败 */
    }
  }
  if (out.length) return out.slice(0, limit)
  // 终极兜底：内置国内精选（实时源全部不可达时，至少保证有内容）
  return BUILTIN_CAR_NEWS.slice(0, limit)
}

/* ============================================================
 * 车型库查询（bitefu / 汽车之家离线数据源，免 KEY 免费）
 * 官方接口：https://tool.bitefu.net/car/
 * 流程：品牌(type=brand) → 车系(type=series&brand_id) → 车型(type=info&series_id) → 配置(type=detail&id)
 * 该接口数据源默认汽车之家，纯国内。CORS 不确定，走代理；失败则降级内置车型库。
 * ============================================================ */

export interface BitefuBrand {
  id: number
  name: string
  firstletter?: string
  logo?: string
}
export interface BitefuSeries {
  id: number
  name: string
  brand_id?: number
  brand_name?: string
}
export interface BitefuModel {
  id: number
  name: string
  year?: string
}
export interface BitefuDetail {
  name?: string
  [k: string]: unknown
}

/** 查询品牌列表（keyword 可空，用于搜索品牌名） */
export async function fetchCarBrands(keyword = ''): Promise<BitefuBrand[]> {
  try {
    const url = `https://tool.bitefu.net/car/?type=brand${keyword ? '&keyword=' + encodeURIComponent(keyword) : ''}`
    const json = await fetchCorsJson<{ data?: BitefuBrand[] } | BitefuBrand[]>(url)
    const list = Array.isArray(json) ? json : (json as any)?.data
    if (Array.isArray(list) && list.length) return list as BitefuBrand[]
  } catch {
    /* 接口/代理失败，降级内置 */
  }
  return BUILTIN_BRANDS
}

/** 查询某品牌的车系 */
export async function fetchCarSeries(brandId: number): Promise<BitefuSeries[]> {
  try {
    const url = `https://tool.bitefu.net/car/?type=series&brand_id=${brandId}`
    const json = await fetchCorsJson<{ data?: BitefuSeries[] } | BitefuSeries[]>(url)
    const list = Array.isArray(json) ? json : (json as any)?.data
    if (Array.isArray(list) && list.length) return list as BitefuSeries[]
  } catch {
    /* 接口/代理失败，降级内置 */
  }
  const found = BUILTIN_SERIES_MAP[brandId]
  return found ? found : []
}

/** 查询某车系的车型（年份款） */
export async function fetchCarModels(seriesId: number): Promise<BitefuModel[]> {
  try {
    const url = `https://tool.bitefu.net/car/?type=info&series_id=${seriesId}`
    const json = await fetchCorsJson<{ data?: BitefuModel[] } | BitefuModel[]>(url)
    const list = Array.isArray(json) ? json : (json as any)?.data
    if (Array.isArray(list) && list.length) return list as BitefuModel[]
  } catch {
    /* 接口/代理失败，降级内置 */
  }
  const found = BUILTIN_MODELS_MAP[seriesId]
  return found ? found : []
}

/** 查询车型配置详情 */
export async function fetchCarDetail(modelId: number): Promise<BitefuDetail | null> {
  try {
    const url = `https://tool.bitefu.net/car/?type=detail&id=${modelId}`
    const json = await fetchCorsJson<BitefuDetail>(url)
    if (json && Object.keys(json).length) return json
  } catch {
    /* 接口/代理失败 */
  }
  return BUILTIN_DETAIL_MAP[modelId] || null
}

/** 内置品牌（bitefu 不可达时保证有数据） */
const BUILTIN_BRANDS: BitefuBrand[] = [
  { id: 1001, name: '比亚迪', firstletter: 'B' },
  { id: 1002, name: '丰田', firstletter: 'F' },
  { id: 1003, name: '大众', firstletter: 'D' },
  { id: 1004, name: '本田', firstletter: 'B' },
  { id: 1005, name: '特斯拉', firstletter: 'T' },
  { id: 1006, name: '蔚来', firstletter: 'W' },
  { id: 1007, name: '理想', firstletter: 'L' },
  { id: 1008, name: '小鹏', firstletter: 'X' },
  { id: 1009, name: '长城', firstletter: 'C' },
  { id: 1010, name: '吉利', firstletter: 'J' }
]

/** 内置车系（按品牌 id 映射） */
const BUILTIN_SERIES_MAP: Record<number, BitefuSeries[]> = {
  1001: [
    { id: 2001, name: '秦 PLUS', brand_id: 1001 },
    { id: 2002, name: '汉', brand_id: 1001 },
    { id: 2003, name: '宋 PLUS', brand_id: 1001 },
    { id: 2004, name: '海豹', brand_id: 1001 },
    { id: 2005, name: '唐', brand_id: 1001 }
  ],
  1002: [
    { id: 2101, name: '凯美瑞', brand_id: 1002 },
    { id: 2102, name: '卡罗拉', brand_id: 1002 },
    { id: 2103, name: '汉兰达', brand_id: 1002 }
  ],
  1005: [
    { id: 2501, name: 'Model 3', brand_id: 1005 },
    { id: 2502, name: 'Model Y', brand_id: 1005 }
  ],
  1006: [{ id: 2601, name: 'ES6', brand_id: 1006 }, { id: 2602, name: 'ET5', brand_id: 1006 }],
  1007: [{ id: 2701, name: 'L7', brand_id: 1007 }, { id: 2702, name: 'L9', brand_id: 1007 }],
  1008: [{ id: 2801, name: 'P7', brand_id: 1008 }, { id: 2802, name: 'G9', brand_id: 1008 }]
}

/** 内置车型（按车系 id 映射） */
const BUILTIN_MODELS_MAP: Record<number, BitefuModel[]> = {
  2001: [{ id: 3001, name: '秦 PLUS DM-i 2024款', year: '2024' }, { id: 3002, name: '秦 PLUS EV 2024款', year: '2024' }],
  2002: [{ id: 3101, name: '汉 EV 2024款', year: '2024' }, { id: 3102, name: '汉 DM-p 2024款', year: '2024' }],
  2501: [{ id: 3501, name: 'Model 3 后轮驱动版', year: '2024' }, { id: 3502, name: 'Model 3 高性能版', year: '2024' }],
  2502: [{ id: 3601, name: 'Model Y 后轮驱动版', year: '2024' }, { id: 3602, name: 'Model Y 长续航版', year: '2024' }],
  2701: [{ id: 3701, name: '理想 L7 Air', year: '2024' }, { id: 3702, name: '理想 L7 Pro', year: '2024' }]
}

/** 内置配置详情（按车型 id 映射，关键参数示例） */
const BUILTIN_DETAIL_MAP: Record<number, BitefuDetail> = {
  3001: { name: '秦 PLUS DM-i 2024款', 动力类型: '插电混动', 纯电续航: '55/120km', 综合油耗: '约1.2L/100km', 指导价: '7.98万起' },
  3501: { name: 'Model 3 后轮驱动版', 动力类型: '纯电', '续航(CLTC)': '606km', 零百加速: '6.1s', 指导价: '25.99万' },
  3601: { name: 'Model Y 后轮驱动版', 动力类型: '纯电', '续航(CLTC)': '554km', 零百加速: '5.9s', 指导价: '26.39万' },
  3701: { name: '理想 L7 Air', 动力类型: '增程式', 纯电续航: '210km', 综合续航: '1315km', 指导价: '30.18万' }
}

/** 内置精选（实时源全部不可达时的兜底，来源标注「内置精选」） */
const BUILTIN_CAR_NEWS: CarNewsItem[] = [
  {
    id: 'builtin-1',
    title: '新能源汽车购置税减免延续：2026—2027 年减半征收（设免税上限）',
    link: 'https://www.gov.cn/',
    source: '内置精选',
    pubDate: fmtNowShort(),
    pubTimestamp: Date.now(),
    description: '国家延续新能源购置税优惠，2024—2025 免征，2026—2027 减半，以发票价计税。',
    thumbnail: ''
  },
  {
    id: 'builtin-2',
    title: '比亚迪持续领跑国内新能源销量，多款车型月销破纪录',
    link: 'https://www.byd.com/',
    source: '内置精选',
    pubDate: fmtNowShort(),
    pubTimestamp: Date.now(),
    description: '比亚迪凭借完整产业链与多价位布局，长期位居国内新能源销量榜首。',
    thumbnail: ''
  },
  {
    id: 'builtin-3',
    title: '小米汽车 SU7 热度不减，产能与交付节奏成关注焦点',
    link: 'https://www.xiaomiev.com/',
    source: '内置精选',
    pubDate: fmtNowShort(),
    pubTimestamp: Date.now(),
    description: '小米 SU7 上市后订单旺盛，市场关注其产能爬坡与后续车型矩阵。',
    thumbnail: ''
  },
  {
    id: 'builtin-4',
    title: '华为问界系列依托智驾口碑走俏，鸿蒙智行生态扩容',
    link: 'https://www.huawei.com/',
    source: '内置精选',
    pubDate: fmtNowShort(),
    pubTimestamp: Date.now(),
    description: '问界凭借智能驾驶体验获得市场认可，鸿蒙智行联合多家车企扩大产品矩阵。',
    thumbnail: ''
  },
  {
    id: 'builtin-5',
    title: '理想、蔚来、小鹏角逐增程与纯电，高端市场格局生变',
    link: 'https://www.lixiang.com/',
    source: '内置精选',
    pubDate: fmtNowShort(),
    pubTimestamp: Date.now(),
    description: '新势力三强在增程与纯电路线上各有侧重，持续推动智能与补能体验升级。',
    thumbnail: ''
  },
  {
    id: 'builtin-6',
    title: '终端优惠加大：多地以旧换新补贴叠加，刺激消费需求',
    link: 'https://www.mofcom.gov.cn/',
    source: '内置精选',
    pubDate: fmtNowShort(),
    pubTimestamp: Date.now(),
    description: '汽车以旧换新补贴政策持续发力，叠加终端现金直降与金融贴息，提振购车需求。',
    thumbnail: ''
  }
]

export interface MacroPoint {
  date: string
  china?: number
  usa?: number
  value?: number
  label?: string
}
export interface CarMacro {
  source: string
  title: string
  series: MacroPoint[]
}

/** 行业宏观：先试 chinadata.live（中汽协口径，免费无 key），失败降级 ourworldindata 全球 EV CSV。 */
export async function fetchCarMacro(): Promise<CarMacro> {
  // 1) chinadata.live 新能源销量（中汽协口径，免费）
  try {
    const json = await fetchCorsJson<{ success?: boolean; data?: { title?: string; data?: MacroPoint[] } }>(
      'https://chinadata.live/api/v2/data/china-nev-sales'
    )
    const arr = json?.data?.data
    if (Array.isArray(arr) && arr.length) {
      return { source: 'chinadata.live（中汽协口径）', title: json.data?.title || '中国新能源汽车销量', series: arr.slice(-12) }
    }
  } catch {
    /* 直连/代理均失败，走降级 */
  }
  // 2) 降级：ourworldindata 全球 EV 销量 CSV（CORS 友好、免费）
  try {
    const csv = await fetchCorsText('https://ourworldindata.org/grapher/electric-car-sales.csv?v=1&csvType=full', { maxBytes: 20000 })
    const rows = csv.split('\n').filter((r) => r.trim().length).map((r) => r.split(','))
    const series: MacroPoint[] = []
    for (let i = 1; i < rows.length && i < 14; i++) {
      const row = rows[i]
      if (!row) continue
      const [date, china, usa] = row
      if (date && china) series.push({ date, china: Number(china), usa: usa ? Number(usa) : undefined })
    }
    if (series.length) {
      return { source: 'ourworldindata.org（全球 EV 销量，中/美对比）', title: '全球电动汽车销量', series }
    }
  } catch {
    /* 忽略 */
  }
  return { source: '暂无', title: '行业宏观数据暂不可用', series: [] }
}

export interface SalesRankItem {
  rank: number
  name: string
  sales: string
  yoy: string
  note: string
}

/**
 * 销量排行榜：基于近期乘联会/汽车销量新闻，交由已配置 AI 结构化提炼。
 * 乘联会未开放免费结构化 API，故走「新闻 + AI」免费路线；AI 不可用时返回空并附说明。
 */
export async function fetchSalesRanking(cfg: AiConfig | null): Promise<{ items: SalesRankItem[]; note: string }> {
  const news = await fetchCarNews('乘联会 汽车 销量 排行榜', 15)
  if (!news.length) return { items: [], note: '暂未抓取到乘联会销量新闻，稍后重试。' }
  if (!cfg) return { items: [], note: '未检测到 AI 配置，无法结构化提炼销量榜；请先到「AI 助手」配置密钥。' }
  const ctx = news
    .slice(0, 10)
    .map((n, i) => `${i + 1}. ${n.title}（来源：${n.source}）`)
    .join('\n')
  const prompt =
    '你是汽车数据分析助手。下面是从新闻中整理的近期中国汽车销量相关信息（可能含厂商/车型销量、同比环比）。\n' +
    '请仅基于以下素材，提炼出「厂商或车型销量 TOP10 排行榜」，输出严格 JSON 数组，字段：\n' +
    'rank(数字), name(厂商或车型名), sales(销量原文，如 "约25万辆"), yoy(同比，如 "+12%" 或 "未披露"), note(一句话依据)。\n' +
    '若素材不足以确认某项，请标注"未披露"，不要编造数字。只输出 JSON，不要解释。\n\n素材：\n' +
    ctx
  try {
    const text = await callAi(cfg, prompt)
    const jsonStr = text.slice(text.indexOf('['), text.lastIndexOf(']') + 1)
    const parsed = JSON.parse(jsonStr) as SalesRankItem[]
    return { items: parsed.slice(0, 10), note: `基于 ${news.length} 条近期新闻由 AI 提炼，数据仅供参考。` }
  } catch {
    return { items: [], note: 'AI 提炼失败，可稍后重试，或查看下方「汽车热点信息」获取原始销量新闻。' }
  }
}
