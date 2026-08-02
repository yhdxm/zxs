// 星舆识途（汽车模块）数据层 — 全部免费、可降级。
// 数据源（2026-08 实测校准）：
//  - 汽车/品牌/优惠/新品热点：**东方财富全站资讯搜索**（免 KEY、CORS 允许跨域、国内直连稳定）为主源，
//    Google News RSS 为备源（需梯子，国内多不可达），内置精选为终极兜底。
//    ⚠️ 原 autohome.com.cn/rss、auto.sohu.com/rss 实测均已 302 失效，已移除。
//  - 行业宏观：ourworldindata 全球 EV 销量 CSV（CORS 友好、免费）；
//    ⚠️ 原 chinadata.live 实测已下线（返回 HTML 错误页），已移除。
//  - 销量排行榜：从真实财经新闻中正则抽取「厂商 + 销量数字 + 同比」，每条附原文链接可点击核查；
//    已配置 AI 时再做一次结构化增强（乘联会/懂车帝均未开放可跨域的免费结构化 API，
//    懂车帝 rank_data 接口实测屏蔽所有免费 CORS 代理 IP，浏览器端不可用）。
//  - 汽车知识/类型：内置知识库（静态，零网络依赖）

import { fetchNews, type NewsItem } from './newsService'
import { fetchCorsText } from './freeApi'
import { fetchEastmoneyNews } from './cnNewsApi'
import { callAi, type AiConfig } from './aiService'

export interface CarNewsItem extends NewsItem {}

/**
 * 汽车强相关词表：东财为全站财经搜索，必须做相关性过滤，
 * 否则「新车 上市」这类含泛词的检索会混入大量非汽车财经新闻（实测）。
 * 只收录汽车专属词，不含「上市 / 电池 / 出口」等易误命中的泛词。
 */
const CAR_CORE_WORDS = [
  '汽车', '车企', '车型', '新车', '整车', '乘用车', '商用车', '轿车', 'SUV', 'MPV',
  '新能源车', '纯电', '插混', '增程', '混动', '车市', '车展', '销量', '交付量', '上险',
  '比亚迪', '特斯拉', '蔚来', '理想', '小鹏', '零跑', '极氪', '问界', '小米汽车',
  '吉利', '长安', '奇瑞', '长城', '上汽', '广汽', '一汽', '东风', '北汽', '江淮',
  '丰田', '大众', '本田', '日产', '宝马', '奔驰', '奥迪', '沃尔沃',
  '乘联会', '中汽协', '4S 店', '经销商', '购置税', '以旧换新'
]

/** 国内车企集合（自主 + 合资在售）：用于「只看国内车企」过滤，排除纯进口/外资品牌 */
const DOMESTIC_BRANDS = new Set<string>([
  '比亚迪', '特斯拉中国', '蔚来', '理想汽车', '理想', '小鹏汽车', '小鹏', '零跑汽车', '零跑',
  '极氪', '问界', '鸿蒙智行', '小米汽车', '小米', '深蓝', '埃安', '昊铂', '腾势', '方程豹', '仰望',
  '吉利汽车', '吉利', '长安汽车', '长安', '奇瑞汽车', '奇瑞', '长城汽车', '长城', '哈弗', '坦克',
  '捷途', '星途', '江淮', '北汽', '上汽', '广汽', '一汽', '东风', '红旗', '荣威', '名爵', '五菱'
])

/** 品牌默认动力类型（用于销量榜新能源/燃油车分类）；正文出现新能源关键词时优先覆盖为 nev */
const BRAND_CAT: Record<string, 'nev' | 'fuel'> = {
  比亚迪: 'nev', '特斯拉中国': 'nev', 特斯拉: 'nev', 蔚来: 'nev', 理想汽车: 'nev', 理想: 'nev',
  小鹏汽车: 'nev', 小鹏: 'nev', 零跑汽车: 'nev', 零跑: 'nev', 极氪: 'nev', 问界: 'nev', 鸿蒙智行: 'nev',
  小米汽车: 'nev', 小米: 'nev', 深蓝: 'nev', 埃安: 'nev', 昊铂: 'nev', 腾势: 'nev', 方程豹: 'nev', 仰望: 'nev', 五菱: 'nev',
  吉利汽车: 'fuel', 吉利: 'fuel', 长安汽车: 'fuel', 长安: 'fuel', 奇瑞汽车: 'fuel', 奇瑞: 'fuel',
  长城汽车: 'fuel', 长城: 'fuel', 哈弗: 'fuel', 坦克: 'fuel', 捷途: 'fuel', 星途: 'fuel', 江淮: 'fuel',
  北汽: 'fuel', 上汽: 'fuel', 广汽: 'fuel', 一汽: 'fuel', 东风: 'fuel', 红旗: 'fuel', 荣威: 'fuel', 名爵: 'fuel'
}

const NEV_KEYWORDS = ['新能源', '纯电', '插混', '增程', '电动', '续航', '电池', '充电']

/**
 * 综合热度评分（0~100+，仅做排序用，非真实流量）：
 * 关键词密度 + 来源权重 + 时效衰减。内置精选降权，越新的新闻分越高。
 */
export function scoreCarHeat(n: CarNewsItem): number {
  let s = 0
  const hay = (n.title + ' ' + n.description).toLowerCase()
  s += CAR_CORE_WORDS.filter((w) => hay.includes(w.toLowerCase())).length * 4
  if (n.source === '内置精选') s -= 6
  const ts = n.pubTimestamp || 0
  if (ts) {
    const hrs = (Date.now() - ts) / 3600000
    s += Math.max(0, 30 - hrs * 0.6)
  }
  if (n.title.length >= 12 && n.title.length <= 40) s += 4
  return Math.round(s)
}

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
  /** 分类，用于筛选 */
  cat: string
  title: string
  /** 一句话速览 */
  content: string
  /** 展开后的详细讲解（要点式） */
  detail?: string[]
}
export const CAR_KNOWLEDGE: CarKnowledge[] = [
  {
    cat: '三电与技术',
    title: '什么是「三电系统」',
    content: '指电池、电机、电控，是新能源汽车的核心，直接决定续航、动力与安全。',
    detail: [
      '电池：决定续航与补能速度。主流是磷酸铁锂（安全、便宜、循环寿命长、低温衰减略大）与三元锂（能量密度高、低温表现好、成本高）。',
      '电机：决定动力。永磁同步电机效率高（国内主流），交流异步电机高速表现好，四驱车型常见「前异步 + 后永磁」组合。',
      '电控：负责功率分配、能量回收与热管理。热管理做得好，冬季续航衰减明显更小。',
      '看车要点：别只看电池容量（kWh），要结合「百公里电耗」判断效率——同样 60kWh，电耗 12kWh/100km 比 15kWh 多跑近 100 公里。'
    ]
  },
  {
    cat: '三电与技术',
    title: '续航与「续航虚标」到底怎么回事',
    content: 'CLTC/WLTC 是实验室工况值，实际续航受气温、车速、空调影响，冬季打 6-8 折属正常。',
    detail: [
      'CLTC（中国工况）平均车速低、加减速温和，得出的数字最乐观，是国内标称的主流口径。',
      'WLTP（欧洲）比 CLTC 严格约 10-15%，EPA（美国）最接近真实，通常比 CLTC 低 20-30%。',
      '高速最费电：120km/h 巡航的电耗可能是 60km/h 的 1.6-1.8 倍，因为风阻随速度平方增长。',
      '冬季衰减来自三方面：电池低温活性下降、电池加热耗电、空调制热耗电。带热泵空调的车型冬季表现明显更好。',
      '实用判断：把标称 CLTC 续航 × 0.7 作为日常预期，× 0.55 作为冬季高速预期，基本不会失望。'
    ]
  },
  {
    cat: '三电与技术',
    title: '纯电 / 插混 / 增程怎么选',
    content: '有家充桩且以市区通勤为主选纯电；没桩或常跑长途选插混、增程。',
    detail: [
      '纯电（BEV）：使用成本最低（家充约 0.3 元/公里以内），驾驶质感最好，但依赖补能网络，长途需规划。',
      '插混（PHEV）：有电走电、没电走油，发动机可直驱，高速工况油耗更低，适合高速占比高的用户。',
      '增程（EREV）：发动机只发电不直驱，全程电驱质感，市区最舒服；亏电高速时因「油→电→驱动」多一次转换，油耗通常略高于插混。',
      '决策顺序：先问「能否装家充桩」→ 再问「每月长途几次」。有桩 + 长途少 → 纯电；无桩或长途多 → 插混/增程。'
    ]
  },
  {
    cat: '买车决策',
    title: '新能源购置税政策（2024-2027）',
    content: '2024-2025 年免征车辆购置税；2026-2027 年减半征收并设免税额上限。',
    detail: [
      '2024.1.1—2025.12.31：新能源乘用车免征购置税，单车免税额上限 3 万元。',
      '2026.1.1—2027.12.31：减半征收（即按 5% 计），单车减税额上限 1.5 万元。',
      '计税价格 = 发票价 ÷ 1.13（不含增值税价），购置税 = 计税价格 × 税率。',
      '注意：车辆须进入《减免车辆购置税的新能源汽车车型目录》才享受优惠，购车前可让销售出示目录截图。',
      '燃油车购置税固定 10%，无优惠——这是新能源与燃油车落地价差距的重要一环。'
    ]
  },
  {
    cat: '买车决策',
    title: '落地价怎么算（别只看裸车价）',
    content: '落地价 = 裸车成交价 + 购置税 + 保险 + 上牌 + 服务费，通常比裸车价高 8%-15%。',
    detail: [
      '裸车价：指导价减去终端优惠后的实际成交价，是谈判的核心。',
      '购置税：燃油车 = 裸车价 ÷ 1.13 × 10%；新能源按当年政策（见购置税条目）。',
      '保险：交强险约 950 元起，商业险（三者险建议 200 万以上 + 车损险）首年通常 4000-8000 元，新能源略高。',
      '上牌：自己办约 150 元，代办常收 500-2000 元，可以拒绝。',
      '常见坑：金融服务费、出库费、装潢强搭。谈判时直接要「一口价落地，含哪些项写进合同」。'
    ]
  },
  {
    cat: '买车决策',
    title: '保值率怎么看，为什么重要',
    content: '三年保值率 = 三年后二手车价 ÷ 新车开票价。它决定你真实的用车成本。',
    detail: [
      '真实持有成本 ≈（购入价 − 卖出价）+ 使用费用。保值率高的车，即便贵一点也可能更划算。',
      '一般规律：头部日系燃油车与主流混动保值率较高；部分纯电因技术迭代快、电池衰减顾虑，三年保值率偏低。',
      '影响因素：品牌口碑、保有量（越大越好卖）、是否频繁改款降价、有无重大质量事件。',
      '提示：新车上市即大幅官降会直接打击保值率，买「刚降过价」的车型往往比买「即将降价」的更安全。'
    ]
  },
  {
    cat: '智能驾驶',
    title: 'L2 / L2+ 辅助驾驶的边界',
    content: 'L2 是「辅助」不是「自动」，驾驶员必须全程监管并承担责任。',
    detail: [
      'L0-L2 属驾驶辅助，L3 及以上才是自动驾驶。目前国内量产车绝大多数仍是 L2 / L2+。',
      'L2 基础能力：自适应巡航（ACC）+ 车道居中（LCC），能在高速跟车与保持车道。',
      'L2+ / NOA：可自动变道、上下匝道，部分支持城区领航，但**责任仍在驾驶员**。',
      '安全提醒：辅助驾驶对静止障碍物（事故车、施工锥桶）识别能力有限，切勿脱手脱眼。',
      '选购要点：关注是否带激光雷达、算力平台、是否需要额外付费订阅、能否 OTA 升级。'
    ]
  },
  {
    cat: '智能驾驶',
    title: '看懂智驾硬件参数',
    content: '芯片算力（TOPS）、传感器方案（纯视觉 vs 激光雷达）是两个核心指标。',
    detail: [
      '算力 TOPS：代表每秒可做多少万亿次运算，是能力上限而非实际表现，软件优化同样关键。',
      '纯视觉方案：成本低、依赖摄像头与算法，恶劣天气与逆光场景挑战大。',
      '激光雷达方案：主动测距、夜间与异形障碍物识别更稳，成本更高。',
      '毫米波雷达：全天候测速测距，但分辨率低；超声波雷达用于泊车近距离探测。',
      '判断方法：不要只对比参数表，优先看该车型在你常走路况下的真实实测视频。'
    ]
  },
  {
    cat: '用车养车',
    title: '新能源日常充电与电池养护',
    content: '日常充到 80%、长途再充满；避免长期亏电停放，可显著延缓电池衰减。',
    detail: [
      '磷酸铁锂电池建议每周充满一次（帮助 BMS 校准电量显示），三元锂日常充到 80%-90% 即可。',
      '尽量减少高频快充，长期只用直流快充会加速衰减；家用慢充最友好。',
      '低电量长期停放最伤电池，长期不用建议保持 50%-60% 电量并每月补电一次。',
      '冬季出发前用 App 提前预热座舱与电池（充电桩连接状态下），可减少续航损失。',
      '电池质保：多数厂商提供 8 年 / 12-16 万公里三电质保，注意首任车主与非首任的差异条款。'
    ]
  },
  {
    cat: '用车养车',
    title: '燃油车常规保养节奏',
    content: '常规为每 5000-10000 公里换机油机滤，具体以保养手册为准。',
    detail: [
      '机油：矿物油约 5000 公里，半合成 7500 公里，全合成 10000 公里（涡轮增压车建议缩短）。',
      '空气滤芯 / 空调滤芯：约每 1-2 万公里更换，空调滤在多尘城市可缩短。',
      '刹车油：一般 2 年或 4 万公里更换（吸湿会导致沸点下降、制动衰减）。',
      '火花塞：普通镍合金约 3 万公里，铂金/铱金 6-10 万公里。',
      '变速箱油：AT/DCT 一般 6-8 万公里检查更换，CVT 需严格按手册。'
    ]
  },
  {
    cat: '看懂数据',
    title: '看懂销量：批发 / 零售 / 上险',
    content: '批发＝厂到经销商；零售＝经销商到用户；上险＝实际注册登记，最贴近真实需求。',
    detail: [
      '批发量（厂家口径）：车从工厂发到经销商即计入，可能存在「压库」，未必卖到用户手里。',
      '零售量（乘联会口径）：经销商开票给用户，更接近终端。',
      '上险量（保险口径）：车辆实际注册上保险，最真实，但滞后约 1-2 周，且含展车、试驾车。',
      '看到「销量破万」的宣传时，先确认是哪个口径——不同口径同一车型可能差 20% 以上。',
      '交付量：新势力常用词，通常指实际交付给用户，接近零售口径。'
    ]
  },
  {
    cat: '看懂数据',
    title: '乘联会 vs 中汽协，数据为何对不上',
    content: '两家统计范围与口径不同：乘联会偏乘用车零售，中汽协覆盖乘用车 + 商用车产销。',
    detail: [
      '中汽协（CAAM）：行业协会口径，覆盖乘用车与商用车的产量、销量（批发口径），发布月度全行业数据。',
      '乘联会（CPCA）：主要统计狭义乘用车（轿车/SUV/MPV），同时发布批发与零售，月度快讯更及时。',
      '差异来源：是否含商用车、是否含出口、是否含微客，都会造成数字不同。',
      '引用建议：讨论「行业大盘」用中汽协，讨论「消费者实际买了什么」用乘联会零售数据。'
    ]
  },
  {
    cat: '买车决策',
    title: '终端优惠、以旧换新与补贴叠加',
    content: '终端优惠 = 指导价 − 实际成交价，可与国家/地方以旧换新补贴叠加。',
    detail: [
      '终端优惠形式：现金直降、置换补贴、金融贴息、赠送保养或充电桩，价值差异很大，优先争取现金直降。',
      '以旧换新补贴：需报废或转让旧车并购买新车，凭材料申领，国补与地方补贴通常可叠加，额度以当年政策为准。',
      '申领要点：新车发票、旧车报废/过户证明、行驶证等材料必须齐全，且旧车登记在本人名下。',
      '注意时间差：补贴多为「先买后补」，资金到账有周期，别把补贴算进首付预算。',
      '砍价时点：季度末、年末冲量与新款上市前，往往是终端优惠力度最大的时候。'
    ]
  },
  {
    cat: '安全常识',
    title: '车辆安全配置该关注什么',
    content: '主动安全（AEB、ESP）比被动安全（气囊数量）更能避免事故发生。',
    detail: [
      'ESP 车身稳定系统：湿滑路面防侧滑，是最重要的主动安全配置，务必确认标配。',
      'AEB 自动紧急制动：识别前方碰撞风险并自动刹车，关注其对行人、两轮车的识别能力与生效车速区间。',
      '气囊：数量不是唯一，覆盖范围（含侧气帘、膝部气囊）与触发逻辑更关键。',
      '车身结构：关注高强度钢占比与碰撞测试成绩（C-NCAP / C-IASI），C-IASI 更严格。',
      '儿童安全：确认是否配备 ISOFIX 接口与后排儿童锁。'
    ]
  }
]

function fmtNowShort(): string {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

/** 判断一条新闻是否与汽车强相关 */
function isCarRelated(n: NewsItem): boolean {
  const hay = n.title + n.description
  return CAR_CORE_WORDS.some((w) => hay.includes(w))
}

/**
 * 抓取汽车相关新闻（热点/优惠/新品/品牌）。
 * 顺序：东财搜索（国内直连、主力）→ Google News（备源，需梯子）→ 内置精选兜底。
 * 保证任何网络状况下都有内容，且不同关键词返回不同结果（不再所有 Tab 共用一份兜底）。
 */
export async function fetchCarNews(keyword: string, limit = 20): Promise<CarNewsItem[]> {
  const seen = new Set<string>()
  const out: CarNewsItem[] = []
  const push = (items: NewsItem[]): void => {
    for (const it of items) {
      const key = it.title.slice(0, 30)
      if (!it.title || seen.has(key)) continue
      seen.add(key)
      out.push(it)
      if (out.length >= limit) break
    }
  }

  // 1) 主源：东方财富资讯搜索（免 KEY，Access-Control-Allow-Origin: *，国内可直连）
  try {
    push(await fetchEastmoneyNews(keyword, { limit, sort: 'time', mustInclude: CAR_CORE_WORDS }))
  } catch {
    /* 忽略，继续备源 */
  }
  if (out.length >= limit) return out.slice(0, limit)

  // 2) 备源：Google News RSS（有梯子时可用，国内多不可达）
  try {
    push((await fetchNews({ keyword, limit })).filter(isCarRelated))
  } catch {
    /* 忽略，走兜底 */
  }
  if (out.length) return out.slice(0, limit)

  // 3) 终极兜底：内置精选（保证页面永不空白）
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

/**
 * 直连 bitefu 车型库（免 KEY 免费源），4 秒超时快速失败。
 * 浏览器端通常因 CORS 直接失败，此时上层立即回落内置车型库，保证"车型库查询"永远有数据。
 */
async function bitefuJson<T>(url: string): Promise<T | null> {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), 4000)
  try {
    const res = await fetch(url, { signal: ctrl.signal })
    if (!res.ok) return null
    const txt = await res.text()
    if (!txt) return null
    const json = JSON.parse(txt) as T | { data?: T }
    const list = (Array.isArray(json) ? json : (json as { data?: T })?.data) as unknown
    return (Array.isArray(list) && (list as unknown[]).length ? list : null) as T | null
  } catch {
    return null
  } finally {
    clearTimeout(t)
  }
}

/** 查询品牌列表（keyword 可空，用于搜索品牌名） */
export async function fetchCarBrands(keyword = ''): Promise<BitefuBrand[]> {
  try {
    const url = `https://tool.bitefu.net/car/?type=brand${keyword ? '&keyword=' + encodeURIComponent(keyword) : ''}`
    const ext = await bitefuJson<BitefuBrand[]>(url)
    if (ext) return ext
  } catch {
    /* 接口/代理失败，降级内置 */
  }
  return keyword ? BUILTIN_BRANDS.filter((b) => b.name.includes(keyword)) : BUILTIN_BRANDS
}

/** 查询某品牌的车系 */
export async function fetchCarSeries(brandId: number): Promise<BitefuSeries[]> {
  try {
    const url = `https://tool.bitefu.net/car/?type=series&brand_id=${brandId}`
    const ext = await bitefuJson<BitefuSeries[]>(url)
    if (ext) return ext
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
    const ext = await bitefuJson<BitefuModel[]>(url)
    if (ext) return ext
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
    const ext = await bitefuJson<BitefuDetail>(url)
    if (ext && Object.keys(ext).length) return ext
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
  { id: 1010, name: '吉利', firstletter: 'J' },
  { id: 1011, name: '长安', firstletter: 'C' },
  { id: 1012, name: '宝马', firstletter: 'B' },
  { id: 1013, name: '奔驰', firstletter: 'B' },
  { id: 1014, name: '奥迪', firstletter: 'A' },
  { id: 1015, name: '奇瑞', firstletter: 'Q' }
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
    { id: 2103, name: '汉兰达', brand_id: 1002 },
    { id: 2104, name: '赛那', brand_id: 1002 }
  ],
  1003: [
    { id: 2201, name: '帕萨特', brand_id: 1003 },
    { id: 2202, name: '迈腾', brand_id: 1003 },
    { id: 2203, name: '朗逸', brand_id: 1003 },
    { id: 2204, name: '途观 L', brand_id: 1003 }
  ],
  1004: [
    { id: 2301, name: '雅阁', brand_id: 1004 },
    { id: 2302, name: '思域', brand_id: 1004 },
    { id: 2303, name: 'CR-V', brand_id: 1004 }
  ],
  1005: [
    { id: 2501, name: 'Model 3', brand_id: 1005 },
    { id: 2502, name: 'Model Y', brand_id: 1005 }
  ],
  1006: [{ id: 2601, name: 'ES6', brand_id: 1006 }, { id: 2602, name: 'ET5', brand_id: 1006 }],
  1007: [{ id: 2701, name: 'L7', brand_id: 1007 }, { id: 2702, name: 'L9', brand_id: 1007 }, { id: 2703, name: 'L6', brand_id: 1007 }],
  1008: [{ id: 2801, name: 'P7', brand_id: 1008 }, { id: 2802, name: 'G9', brand_id: 1008 }, { id: 2803, name: 'X9', brand_id: 1008 }],
  1009: [{ id: 2901, name: '哈弗 H6', brand_id: 1009 }, { id: 2902, name: '坦克 300', brand_id: 1009 }, { id: 2903, name: '欧拉好猫', brand_id: 1009 }],
  1010: [{ id: 2911, name: '星越 L', brand_id: 1010 }, { id: 2912, name: '帝豪', brand_id: 1010 }, { id: 2913, name: '极氪 001', brand_id: 1010 }],
  1011: [{ id: 2921, name: 'CS75 PLUS', brand_id: 1011 }, { id: 2922, name: '逸动', brand_id: 1011 }, { id: 2923, name: '深蓝 SL03', brand_id: 1011 }],
  1012: [{ id: 2931, name: '3 系', brand_id: 1012 }, { id: 2932, name: '5 系', brand_id: 1012 }, { id: 2933, name: 'X3', brand_id: 1012 }],
  1013: [{ id: 2941, name: 'C 级', brand_id: 1013 }, { id: 2942, name: 'E 级', brand_id: 1013 }, { id: 2943, name: 'GLC', brand_id: 1013 }],
  1014: [{ id: 2951, name: 'A4L', brand_id: 1014 }, { id: 2952, name: 'A6L', brand_id: 1014 }, { id: 2953, name: 'Q5L', brand_id: 1014 }],
  1015: [{ id: 2961, name: '瑞虎 8', brand_id: 1015 }, { id: 2962, name: '艾瑞泽 8', brand_id: 1015 }, { id: 2963, name: '捷途旅行者', brand_id: 1015 }]
}

/** 内置车型（按车系 id 映射） */
const BUILTIN_MODELS_MAP: Record<number, BitefuModel[]> = {
  2001: [{ id: 3001, name: '秦 PLUS DM-i 2024款', year: '2024' }, { id: 3002, name: '秦 PLUS EV 2024款', year: '2024' }],
  2002: [{ id: 3101, name: '汉 EV 2024款', year: '2024' }, { id: 3102, name: '汉 DM-p 2024款', year: '2024' }],
  2003: [{ id: 3201, name: '宋 PLUS DM-i', year: '2024' }, { id: 3202, name: '宋 PLUS EV', year: '2024' }],
  2004: [{ id: 3301, name: '海豹 EV', year: '2024' }, { id: 3302, name: '海豹 DM-i', year: '2024' }],
  2005: [{ id: 3401, name: '唐 DM-p', year: '2024' }, { id: 3402, name: '唐 EV', year: '2024' }],
  2101: [{ id: 3501, name: '凯美瑞 2.0G 豪华版', year: '2024' }, { id: 3502, name: '凯美瑞 双擎 2.5HG', year: '2024' }],
  2102: [{ id: 3511, name: '卡罗拉 1.2T 精英版', year: '2024' }, { id: 3512, name: '卡罗拉 双擎 1.8L', year: '2024' }],
  2103: [{ id: 3521, name: '汉兰达 2.5L 双擎四驱', year: '2024' }],
  2201: [{ id: 3531, name: '帕萨特 330TSI 精英', year: '2024' }, { id: 3532, name: '帕萨特 380TSI 豪华', year: '2024' }],
  2203: [{ id: 3541, name: '朗逸 1.5L 自动满逸', year: '2024' }],
  2301: [{ id: 3551, name: '雅阁 260TURBO 智享', year: '2024' }, { id: 3552, name: '雅阁 e:PHEV', year: '2024' }],
  2303: [{ id: 3561, name: 'CR-V 240TURBO 两驱锋尚', year: '2024' }, { id: 3562, name: 'CR-V e:PHEV', year: '2024' }],
  2501: [{ id: 3601, name: 'Model 3 后轮驱动版', year: '2024' }, { id: 3602, name: 'Model 3 高性能版', year: '2024' }],
  2502: [{ id: 3611, name: 'Model Y 后轮驱动版', year: '2024' }, { id: 3612, name: 'Model Y 长续航版', year: '2024' }],
  2601: [{ id: 3621, name: '蔚来 ES6 75kWh', year: '2024' }],
  2602: [{ id: 3631, name: '蔚来 ET5 75kWh', year: '2024' }],
  2701: [{ id: 3701, name: '理想 L7 Air', year: '2024' }, { id: 3702, name: '理想 L7 Pro', year: '2024' }],
  2702: [{ id: 3711, name: '理想 L9 Pro', year: '2024' }, { id: 3712, name: '理想 L9 Ultra', year: '2024' }],
  2801: [{ id: 3801, name: '小鹏 P7i 550 Pro', year: '2024' }, { id: 3802, name: '小鹏 P7i 702 Max', year: '2024' }],
  2802: [{ id: 3811, name: '小鹏 G9 570 Pro', year: '2024' }],
  2901: [{ id: 3901, name: '哈弗 H6 1.5T 自动两驱', year: '2024' }],
  2902: [{ id: 3911, name: '坦克 300 2.0T 征服者', year: '2024' }],
  2911: [{ id: 3921, name: '星越 L 2.0TD 自动两驱', year: '2024' }],
  2913: [{ id: 3931, name: '极氪 001 WE版 100kWh', year: '2024' }],
  2921: [{ id: 3941, name: '长安 CS75 PLUS 1.5T', year: '2024' }],
  2923: [{ id: 3951, name: '深蓝 SL03 增程 200Max', year: '2024' }],
  2931: [{ id: 3961, name: '宝马 325Li M运动套装', year: '2024' }],
  2941: [{ id: 3971, name: '奔驰 C 260 L 运动版', year: '2024' }],
  2951: [{ id: 3981, name: '奥迪 A4L 40 TFSI 豪华', year: '2024' }],
  2961: [{ id: 3991, name: '瑞虎 8 PRO 1.6TGDI', year: '2024' }]
}

/** 内置配置详情（按车型 id 映射，关键参数示例） */
const BUILTIN_DETAIL_MAP: Record<number, BitefuDetail> = {
  3001: { name: '秦 PLUS DM-i 2024款', 动力类型: '插电混动', 纯电续航: '55/120km', 综合油耗: '约1.2L/100km', 指导价: '7.98万起' },
  3002: { name: '秦 PLUS EV 2024款', 动力类型: '纯电', '续航(CLTC)': '420/510km', 零百加速: '9s', 指导价: '10.98万起' },
  3101: { name: '汉 EV 2024款', 动力类型: '纯电', '续航(CLTC)': '506/605/715km', 零百加速: '3.9s', 指导价: '17.98万起' },
  3201: { name: '宋 PLUS DM-i', 动力类型: '插电混动', 纯电续航: '110/150km', 指导价: '12.98万起' },
  3301: { name: '海豹 EV', 动力类型: '纯电', '续航(CLTC)': '550/700km', 零百加速: '3.8s', 指导价: '18.98万起' },
  3501: { name: '凯美瑞 2.0G 豪华版', 动力类型: '燃油', 发动机: '2.0L 自然吸气', 变速箱: 'CVT', 指导价: '19.98万' },
  3511: { name: '卡罗拉 1.2T 精英版', 动力类型: '燃油', 发动机: '1.2T 涡轮增压', 变速箱: 'CVT', 指导价: '12.88万' },
  3531: { name: '帕萨特 330TSI 精英', 动力类型: '燃油', 发动机: '2.0T 低功', 变速箱: '7DCT', 指导价: '20.59万' },
  3541: { name: '朗逸 1.5L 自动满逸', 动力类型: '燃油', 发动机: '1.5L 自然吸气', 变速箱: '6AT', 指导价: '12.09万' },
  3551: { name: '雅阁 260TURBO 智享', 动力类型: '燃油', 发动机: '1.5T 涡轮增压', 变速箱: 'CVT', 指导价: '19.68万' },
  3561: { name: 'CR-V 240TURBO 两驱锋尚', 动力类型: '燃油', 发动机: '1.5T 涡轮增压', 变速箱: 'CVT', 指导价: '21.09万' },
  3601: { name: 'Model 3 后轮驱动版', 动力类型: '纯电', '续航(CLTC)': '606km', 零百加速: '6.1s', 指导价: '23.19万' },
  3611: { name: 'Model Y 后轮驱动版', 动力类型: '纯电', '续航(CLTC)': '554km', 零百加速: '5.9s', 指导价: '24.99万' },
  3621: { name: '蔚来 ES6 75kWh', 动力类型: '纯电', '续航(CLTC)': '490km', 换电: '支持', 指导价: '33.80万' },
  3701: { name: '理想 L7 Air', 动力类型: '增程式', 纯电续航: '210km', 综合续航: '1315km', 指导价: '30.18万' },
  3711: { name: '理想 L9 Pro', 动力类型: '增程式', 纯电续航: '215km', 综合续航: '1360km', 指导价: '42.98万' },
  3801: { name: '小鹏 P7i 550 Pro', 动力类型: '纯电', '续航(CLTC)': '550km', 零百加速: '6.4s', 指导价: '22.39万' },
  3811: { name: '小鹏 G9 570 Pro', 动力类型: '纯电', '续航(CLTC)': '570km', 指导价: '26.39万' },
  3901: { name: '哈弗 H6 1.5T 自动两驱', 动力类型: '燃油', 发动机: '1.5T', 变速箱: '7DCT', 指导价: '11.59万' },
  3911: { name: '坦克 300 2.0T 征服者', 动力类型: '燃油', 发动机: '2.0T', 变速箱: '8AT', 指导价: '21.58万' },
  3921: { name: '星越 L 2.0TD 自动两驱', 动力类型: '燃油', 发动机: '2.0T', 变速箱: '7DCT', 指导价: '15.77万' },
  3931: { name: '极氪 001 WE版 100kWh', 动力类型: '纯电', '续航(CLTC)': '741km', 零百加速: '5.9s', 指导价: '26.90万' },
  3941: { name: '长安 CS75 PLUS 1.5T', 动力类型: '燃油', 发动机: '1.5T', 变速箱: '8AT', 指导价: '12.19万' },
  3951: { name: '深蓝 SL03 增程 200Max', 动力类型: '增程式', 纯电续航: '200km', 指导价: '15.69万' },
  3961: { name: '宝马 325Li M运动套装', 动力类型: '燃油', 发动机: '2.0T 中功', 变速箱: '8AT', 指导价: '35.39万' },
  3971: { name: '奔驰 C 260 L 运动版', 动力类型: '燃油', 发动机: '1.5T+48V', 变速箱: '9AT', 指导价: '35.50万' },
  3981: { name: '奥迪 A4L 40 TFSI 豪华', 动力类型: '燃油', 发动机: '2.0T 低功', 变速箱: '7DCT', 指导价: '34.38万' },
  3991: { name: '瑞虎 8 PRO 1.6TGDI', 动力类型: '燃油', 发动机: '1.6T', 变速箱: '7DCT', 指导价: '13.39万' }
}

/** 内置车型库（bitefu 不可达时保证有数据，视图层可先用它即时渲染） */
export const BUILTIN_CAR_LIBRARY = {
  brands: BUILTIN_BRANDS,
  seriesMap: BUILTIN_SERIES_MAP,
  modelsMap: BUILTIN_MODELS_MAP,
  detailMap: BUILTIN_DETAIL_MAP
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

/**
 * 行业宏观：ourworldindata 全球 EV 销量 CSV（免费、CORS 友好）。
 * CSV 结构为 `Entity,Code,Year,Electric cars sold`（每行一个国家一年），
 * 需按 Entity 筛出 China / United States 后再按年份对齐 —— 原实现按列位置直接取值，
 * 会把国家名当成日期、把 ISO 代码当成销量，属实测确认的 BUG，此处已修正。
 * 数据不可用时降级内置参考数据。
 */
export async function fetchCarMacro(): Promise<CarMacro> {
  try {
    const csv = await fetchCorsText('https://ourworldindata.org/grapher/electric-car-sales.csv?v=1&csvType=full', {
      maxBytes: 400000
    })
    const lines = csv.split('\n')
    const byYear = new Map<string, { china?: number; usa?: number }>()
    // 首行为表头，从第 2 行开始
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i]
      if (!line || !line.trim()) continue
      const cols = line.split(',')
      if (cols.length < 4) continue
      const entity = cols[0]?.trim()
      const year = cols[2]?.trim()
      const sold = Number(cols[3])
      if (!year || !Number.isFinite(sold)) continue
      if (entity !== 'China' && entity !== 'United States') continue
      const slot = byYear.get(year) ?? {}
      if (entity === 'China') slot.china = sold
      else slot.usa = sold
      byYear.set(year, slot)
    }
    const series: MacroPoint[] = [...byYear.entries()]
      .filter(([, v]) => v.china != null || v.usa != null)
      .sort((a, b) => Number(a[0]) - Number(b[0]))
      .slice(-10)
      .map(([year, v]) => ({ date: year, china: v.china, usa: v.usa }))
    if (series.length) {
      return {
        source: 'ourworldindata.org（IEA 口径 · 年度纯电+插混销量 · 中/美对比）',
        title: '电动汽车年度销量（中国 / 美国）',
        series
      }
    }
  } catch {
    /* 网络不可达，走内置兜底 */
  }
  return BUILTIN_CAR_MACRO
}

export interface SalesRankItem {
  rank: number
  name: string
  sales: string
  yoy: string
  note: string
  /** 动力类型：新能源 / 燃油车（用于分榜展示） */
  cat?: 'nev' | 'fuel'
  /** 原文链接，供用户点击核查数据真伪（内置兜底数据为空） */
  link?: string
  /** 该数字的新闻发布时间 */
  date?: string
  /** 报道媒体 */
  source?: string
}

/**
 * 销量排行榜内置兜底（网络/AI 全部不可用时保证有数据展示）。
 * 按用户要求：**只看国内车企**，且**分新能源 / 燃油车**两榜。
 * ⚠️ 这是 2024 年月度量级的**参考数据**（自主品牌口径），用于展示市场格局，
 * 不代表最新月份销量，视图层会以醒目提示标注，避免用户误认为实时数据。
 */
const DOMESTIC_NEV_RANK: SalesRankItem[] = [
  { rank: 1, name: '比亚迪', sales: '约 34 万辆', yoy: '+35%', cat: 'nev', note: '【2024 参考】新能源全产业链，多价位车型齐发' },
  { rank: 2, name: '特斯拉中国', sales: '约 7.2 万辆', yoy: '+8%', cat: 'nev', note: '【2024 参考】上海超级工厂 Model 3 / Y' },
  { rank: 3, name: '上汽通用五菱(新能源)', sales: '约 5.0 万辆', yoy: '+12%', cat: 'nev', note: '【2024 参考】宏光 MINI / 缤果 / 星光' },
  { rank: 4, name: '理想汽车', sales: '约 4.8 万辆', yoy: '+47%', cat: 'nev', note: '【2024 参考】增程式 SUV 路线持续热销' },
  { rank: 5, name: '广汽埃安', sales: '约 3.5 万辆', yoy: '+25%', cat: 'nev', note: '【2024 参考】AION S / Y 主力' },
  { rank: 6, name: '问界(鸿蒙智行)', sales: '约 3.0 万辆', yoy: '+120%', cat: 'nev', note: '【2024 参考】智驾口碑驱动' },
  { rank: 7, name: '零跑汽车', sales: '约 2.5 万辆', yoy: '+60%', cat: 'nev', note: '【2024 参考】性价比增程 / 纯电' },
  { rank: 8, name: '极氪', sales: '约 1.8 万辆', yoy: '+90%', cat: 'nev', note: '【2024 参考】001 / 007 / MIX' },
  { rank: 9, name: '蔚来汽车', sales: '约 2.0 万辆', yoy: '+30%', cat: 'nev', note: '【2024 参考】换电 + BaaS 体系' },
  { rank: 10, name: '小鹏汽车', sales: '约 1.8 万辆', yoy: '+20%', cat: 'nev', note: '【2024 参考】MONA 系列走量' },
  { rank: 11, name: '小米汽车', sales: '约 1.5 万辆', yoy: '新车', cat: 'nev', note: '【2024 参考】SU7 产能爬坡' },
  { rank: 12, name: '深蓝汽车', sales: '约 1.5 万辆', yoy: '+40%', cat: 'nev', note: '【2024 参考】增程 + 纯电双线' }
]

const DOMESTIC_FUEL_RANK: SalesRankItem[] = [
  { rank: 1, name: '奇瑞汽车(燃油)', sales: '约 13 万辆', yoy: '+24%', cat: 'fuel', note: '【2024 参考】瑞虎 / 艾瑞泽 + 出口拉动' },
  { rank: 2, name: '吉利汽车(燃油)', sales: '约 11 万辆', yoy: '+10%', cat: 'fuel', note: '【2024 参考】星瑞 / 缤越 / 博越' },
  { rank: 3, name: '长安汽车(燃油)', sales: '约 10 万辆', yoy: '+12%', cat: 'fuel', note: '【2024 参考】CS 系列 + UNI 序列' },
  { rank: 4, name: '长城汽车(燃油)', sales: '约 8 万辆', yoy: '-1%', cat: 'fuel', note: '【2024 参考】哈弗 H6 / 坦克系列' },
  { rank: 5, name: '上汽乘用车(燃油)', sales: '约 5 万辆', yoy: '-5%', cat: 'fuel', note: '【2024 参考】荣威 / 名爵' },
  { rank: 6, name: '捷途汽车', sales: '约 4 万辆', yoy: '+80%', cat: 'fuel', note: '【2024 参考】旅行者 / 山海系列' },
  { rank: 7, name: '广汽传祺', sales: '约 3.5 万辆', yoy: '+6%', cat: 'fuel', note: '【2024 参考】M8 / M6 / 影豹' },
  { rank: 8, name: '红旗', sales: '约 3.5 万辆', yoy: '+15%', cat: 'fuel', note: '【2024 参考】H5 / H9 / HS 系列' },
  { rank: 9, name: '星途', sales: '约 1.2 万辆', yoy: '+35%', cat: 'fuel', note: '【2024 参考】高端燃油序列' },
  { rank: 10, name: '荣威', sales: '约 2 万辆', yoy: '-8%', cat: 'fuel', note: '【2024 参考】i5 / RX5' }
]

/** 行业宏观内置兜底 */
const BUILTIN_CAR_MACRO: CarMacro = {
  source: '内置参考数据',
  title: '中国新能源汽车销量（月度参考）',
  series: [
    { date: '2024-01', value: 72.9 },
    { date: '2024-02', value: 47.7 },
    { date: '2024-03', value: 88.3 },
    { date: '2024-04', value: 85.0 },
    { date: '2024-05', value: 95.5 },
    { date: '2024-06', value: 104.9 },
    { date: '2024-07', value: 99.1 }
  ]
}

/** 销量抽取时用于识别主体的厂商 / 品牌词表（长词在前，避免「上汽」抢先匹配「上汽大众」） */
const SALES_ENTITIES = [
  '一汽-大众', '一汽丰田', '上汽大众', '上汽通用', '上汽集团', '广汽丰田', '广汽本田', '广汽埃安',
  '东风日产', '东风本田', '北京现代', '华晨宝马', '北京奔驰', '一汽奥迪',
  '比亚迪', '特斯拉中国', '特斯拉', '蔚来', '理想汽车', '理想', '小鹏汽车', '小鹏', '零跑汽车', '零跑',
  '极氪', '问界', '鸿蒙智行', '小米汽车', '小米', '深蓝', '埃安', '昊铂', '腾势', '方程豹', '仰望',
  '吉利汽车', '吉利', '长安汽车', '长安', '奇瑞汽车', '奇瑞', '长城汽车', '长城', '哈弗', '坦克',
  '五菱', '荣威', '名爵', '捷途', '星途', '江淮', '北汽', '东风', '上汽', '广汽', '一汽',
  '丰田', '大众', '本田', '日产', '宝马', '奔驰', '奥迪', '沃尔沃', '别克', '雪佛兰', '福特'
]

/** 把 "3.5 万辆" / "35934辆" 归一为数值（单位：辆），用于排序 */
function toVehicleCount(numText: string, hasWan: boolean): number {
  const n = Number(numText.replace(/[,\s]/g, ''))
  if (!Number.isFinite(n)) return 0
  return hasWan ? Math.round(n * 10000) : Math.round(n)
}

interface ExtractedFact {
  name: string
  cat: 'nev' | 'fuel'
  sales: string
  count: number
  yoy: string
  note: string
  link: string
  date: string
  source: string
}

/**
 * 从真实新闻标题/摘要中抽取「厂商 + 销量 + 同比」。
 * 仅保留国内车企（DOMESTIC_BRANDS），并按正文关键词 / 品牌默认类型归类为新能源或燃油车，
 * 每条保留原文链接供核查，不做任何推算或编造。
 */
function extractSalesFacts(news: CarNewsItem[]): ExtractedFact[] {
  const facts: ExtractedFact[] = []
  const used = new Set<string>()

  for (const n of news) {
    const text = `${n.title} ${n.description}`
    // 必须同时出现销量语义词与「N 辆」，否则跳过
    if (!/(销量|销售|交付|上险|批发|零售)/.test(text)) continue

    const salesMatch = text.match(/([\d][\d,.]*)\s*(万)?\s*辆/)
    if (!salesMatch) continue
    const numText = salesMatch[1] ?? ''
    const hasWan = Boolean(salesMatch[2])
    const count = toVehicleCount(numText, hasWan)
    if (count <= 0) continue

    const entity = SALES_ENTITIES.find((e) => text.includes(e))
    if (!entity || used.has(entity)) continue
    // 只看国内车企：剔除纯外资/进口品牌
    if (!DOMESTIC_BRANDS.has(entity)) continue
    used.add(entity)

    // 动力类型：正文出现新能源关键词 → 新能源；否则取品牌默认类型
    let cat: 'nev' | 'fuel' = BRAND_CAT[entity] ?? 'fuel'
    if (NEV_KEYWORDS.some((k) => text.includes(k))) cat = 'nev'

    // 同比：支持「同比增长 31.74%」「同比下滑 11%」「同比+12%」
    let yoy = '未披露'
    const yoyMatch = text.match(/同比\s*(增长|上涨|增加|下滑|下降|减少)?\s*([+-]?[\d.]+)\s*%/)
    if (yoyMatch) {
      const dir = yoyMatch[1] ?? ''
      const val = yoyMatch[2] ?? ''
      const negative = /下滑|下降|减少/.test(dir) || val.startsWith('-')
      yoy = (negative ? '-' : '+') + val.replace(/^[+-]/, '') + '%'
    }

    facts.push({
      name: entity,
      cat,
      sales: `${numText}${hasWan ? '万' : ''}辆`,
      count,
      yoy,
      note: n.title,
      link: n.link,
      date: n.pubDate,
      source: n.source
    })
  }

  return facts.sort((a, b) => b.count - a.count)
}

function toRankItems(facts: ExtractedFact[], cat: 'nev' | 'fuel'): SalesRankItem[] {
  return facts
    .filter((f) => f.cat === cat)
    .slice(0, 12)
    .map((f, i) => ({
      rank: i + 1,
      name: f.name,
      sales: f.sales,
      yoy: f.yoy,
      cat: f.cat,
      note: f.note,
      link: f.link,
      date: f.date,
      source: f.source
    }))
}

export interface SalesRankResult {
  nev: SalesRankItem[]
  fuel: SalesRankItem[]
  note: string
}

/**
 * 销量排行榜（免费可核查方案，按用户要求：**只看国内车企 + 分新能源/燃油车**）：
 *  1) 抓取近期真实销量新闻（东财源，国内直连）；
 *  2) 正则抽取「国内车企 + 销量 + 同比」，按新能源/燃油车分类，每条附原文链接供核查；
 *  3) 两榜均不足时回落内置**国内车企参考榜**（已按新能源/燃油车分类、标注为参考口径）。
 * 说明：乘联会/懂车帝均无可跨域调用的免费结构化 API（懂车帝 rank_data 屏蔽免费代理 IP，实测不可用），
 * 因此以「真实报道原文 + 可点击核查链接」替代不可验证的结构化数字，保证数据可信度。
 */
export async function fetchSalesRanking(_cfg: AiConfig | null): Promise<SalesRankResult> {
  const news = await fetchCarNews('汽车 销量 交付 车企 比亚迪 吉利 长安 长城', 30)

  // 1) 正则抽取真实数字，并按动力类型分榜
  const facts = extractSalesFacts(news)
  const nev = toRankItems(facts, 'nev')
  const fuel = toRankItems(facts, 'fuel')

  if (nev.length >= 3 && fuel.length >= 3) {
    const latest = facts[0]?.date ?? ''
    return {
      nev,
      fuel,
      note: `以下均摘自公开财经报道原文（最新 ${latest}），点击「查看原文」可逐条核查；按报道中出现的销量数值降序排列，不同厂商统计口径（批发/零售/交付）可能不一致。新能源与燃油车已分榜展示。`
    }
  }

  // 2) 内置国内车企参考榜（新能源 / 燃油车 两榜）
  return {
    nev: DOMESTIC_NEV_RANK,
    fuel: DOMESTIC_FUEL_RANK,
    note: '实时数据源暂不可达，当前展示国内车企参考榜（2024 年月度量级，自主品牌口径，分新能源/燃油车；不代表最新销量，仅供了解市场格局）。'
  }
}
