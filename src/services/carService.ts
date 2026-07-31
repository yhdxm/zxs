// 星舆识途（汽车模块）数据层 — 全部免费、可降级。
// 数据源：
//  - 汽车/品牌/优惠/新品热点：复用 newsService（Google News RSS + 三级代理兜底）
//  - 行业宏观（中汽协/乘联会）：chinadata.live（免费无 key），失败降级 ourworldindata 全球 EV CSV
//  - 销量排行榜：新闻聚合 + 已配置 AI 结构化提炼（乘联会未开放免费结构化 API）
//  - 汽车知识/类型：内置知识库（静态，零网络依赖）

import { fetchNews, type NewsItem } from './newsService'
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
    return items
  } catch {
    return []
  }
}

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
