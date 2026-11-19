/* =========================================================
   GAPDESK 采集管道 · 关键词打标
   口径来源：server.mjs 第 39-100 行（行业/维度词表）、
             第 343-420 行（tagInd / tagDim / tagGB / guessKind / extractEntities）、
             第 1234 行（pickTags）。逻辑等价，注释按本管道重写。
   ---------------------------------------------------------
   ⚠️ 与前端 src/config/gapdeskConfig.ts 的关系：
   行业键 8 个完全一致；维度按库表 gap_events.dim 的 8 维口径落位
   （server.mjs 的 price→cost、talent 不再单列、新增 capex/channel/regulation）。
   ========================================================= */

/**
 * 行业归属关键词（8 个行业键，与库表 ind 一致）。
 * 英文词必须足够全：海外源条目若一条都不命中，会落到信源归属兜底，
 * 结果「人工智能」变成垃圾箱（历史真实故障：NTSB 跑道事故被贴成 AI）。
 */
export const IND_KEYWORDS = {
  ai: [
    'AI', '人工智能', '大模型', '算力', '智算', '芯片', 'GPU', '算法', '机器学习', '机器人', '智能体',
    'AIGC', '训练', '推理', '英伟达', 'NVIDIA', 'openai', '模型',
    'artificial intelligence', 'machine learning', 'deep learning', 'neural network', 'LLM', 'GPT',
    'ChatGPT', 'Anthropic', 'transformer', 'chatbot', 'autonomous', 'robotics', 'inference',
  ],
  fin: [
    '银行', '保险', '券商', '基金', '理财', '信贷', '利率', 'LPR', '债', '股票', 'A股', 'IPO', '证监会',
    '央行', '融资', '市值', 'ETF', 'REIT', '量化', '外汇', '人民币',
    'bank', 'banking', 'inflation', 'interest rate', 'stock', 'bond', 'yield', 'earnings', 'merger',
    'acquisition', 'valuation', 'hedge fund', 'private equity', 'dividend', 'revenue',
  ],
  med: [
    '医药', '医疗', '药', '疫苗', '临床', '仿制药', '集采', 'NMPA', 'FDA', '器械', '生物', '诊断',
    '健康', '减重', '肿瘤',
    'drug', 'clinical trial', 'vaccine', 'patient', 'disease', 'cancer', 'hospital', 'medicine',
    'pharma', 'therapy', 'diagnosis', 'biotech', 'tumor', 'health',
  ],
  en: [
    '电力', '电网', '光伏', '储能', '风电', '新能源', '核电', '煤', '石油', '天然气', '电价', '容量电价',
    '充电', '电池', '氢能', '消纳',
    'power grid', 'electricity', 'renewable', 'solar', 'wind farm', 'nuclear', 'battery', 'oil',
    'natural gas', 'pipeline', 'energy', 'utility', 'coal', 'hydropower',
  ],
  mfg: [
    '制造', '工厂', '产线', '供应链', '面板', '半导体', '模具', '零部件', '汽车', '车企', '钢铁', '水泥',
    '设备', '减速器', '代工',
    'manufacturer', 'manufacturing', 'factory', 'supply chain', 'semiconductor', 'automaker',
    'steel', 'cement', 'assembly line', 'supplier', 'chipmaker',
  ],
  agri: [
    '农业', '农产品', '粮食', '养殖', '畜牧', '大豆', '玉米', '咖啡', '茶', '果蔬', '水产', '食品',
    '餐饮', '种植',
    'agriculture', 'farm', 'crop', 'grain', 'livestock', 'harvest', 'fertilizer', 'dairy',
    'fishery', 'aquaculture', 'soybean',
  ],
  prop: [
    '地产', '房地产', '楼盘', '土拍', '保障房', '城市更新', '旧改', '物业', '建筑', '基建', '施工',
    '工程', '代建', '装配式',
    'real estate', 'housing', 'mortgage', 'commercial property', 'homebuilder', 'land sale',
  ],
  glob: [
    '跨境', '外贸', '出口', '出海', '海运', '港口', '货代', '海外仓', '清关', '关税', '汇率', '美元',
    '东南亚', '欧美', '跨境电商',
    'tariff', 'export', 'import', 'trade war', 'sanction', 'customs', 'cross-border', 'overseas',
    'freight', 'geopolit', 'diplomat', 'foreign ministry', 'alliance', 'NATO',
  ],
}

/**
 * 维度关键词（8 维，与库表 dim 一致）。
 * 相对 server.mjs 的映射说明：
 *   price → cost（成本与价格合一，库表口径）
 *   talent 不单列（人力信息在差值台里归「成本」，避免第 9 个维度破坏契约）
 *   capex / channel / regulation 为库表新增维度的词表
 */
export const DIM_KEYWORDS = {
  policy: [
    '政策', '通知', '意见', '办法', '规定', '条例', '征求', '公示', '备案', '审批', '许可', '监管',
    '细则', '目录', '名单', '规划', '部署', '补贴', '试点', 'government', 'policy', 'ministry',
  ],
  capex: [
    '资本开支', '投资计划', '扩产', '投产', '开工', '装机', '并网', '产能建设', '设备采购', '预算',
    '招标', '中标', '新建', '扩建', '项目投资', 'capex', 'capital expenditure', 'investment plan',
    'capacity expansion', 'plant', 'greenfield',
  ],
  cost: [
    '价格', '涨价', '降价', '报价', '成本', '费用', '费率', '电价', '油价', '金价', '铜价', '锂价',
    '汇率', '毛利', '亏损', '涨', '跌', 'price', 'cost', 'margin', 'pricing', 'inflation',
  ],
  supply: [
    '产能', '供给', '产量', '库存', '缺货', '交付', '停产', '扩产', '订单', '装机', '并网', '开工',
    '排产', 'shipment', 'capacity', 'supply', 'inventory', 'shortage', 'delivery',
  ],
  tech: [
    '技术', '研发', '专利', '论文', '开源', '算法', '模型', '突破', '发布', '测试', '量产', '工艺',
    '架构', 'patent', 'paper', 'open source', 'model', 'breakthrough', 'prototype', 'benchmark',
  ],
  capital: [
    '融资', '投资', '并购', '收购', '上市', 'IPO', '股权', '减持', '回购', '定增', '发债', '资金',
    '注资', '估值', 'funding', 'fundraise', 'acquisition', 'merger', 'valuation', 'stake',
  ],
  channel: [
    '跨境', '出口', '进口', '出海', '海运', '港口', '货代', '海外仓', '清关', '关税', '渠道', '经销',
    '代理', '海外市场', 'export', 'import', 'cross-border', 'channel', 'distributor', 'freight',
    'customs', 'overseas', 'go global',
  ],
  regulation: [
    '合规', '准入', '牌照', '许可', '资质', '认证', '处罚', '罚款', '约谈', '反垄断', '制裁',
    '出口管制', '禁令', '标准', 'compliance', 'regulator', 'antitrust', 'sanction', 'license',
    'licence', 'penalty', 'ban', 'export control',
  ],
}

/** 库表 dim 的兜底值（8 维里最中性的一维） */
export const DIM_DEFAULT = 'policy'

/* ---------- 关键词匹配：纯 ASCII 必须按词边界判 ---------- */
/* 踩过的坑（真实错标）：
     · GB 门类 'ore' 子串匹配命中 **More** → 「OpenAI 未发表数学」被判成 B 采矿业
     · 'port' 命中 support / report / important / opportunity
     · ai 的 'AI' 命中 TRAIN / MAIN / SAID / AGAIN
   中文无词边界问题，仍走 includes。 */
const ASCII_WORD = /^[A-Za-z0-9][A-Za-z0-9 ._\-]*$/
const reCache = new Map()
function wordRe(w) {
  let re = reCache.get(w)
  if (!re) {
    const esc = w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    // 允许单复数（ore→ores、IPO→IPOs），但前后不得紧邻其他字母
    re = new RegExp(`(?<![A-Za-z])${esc}(?:s|es)?(?![A-Za-z])`, 'i')
    reCache.set(w, re)
  }
  return re
}

/** 单个关键词是否命中（ASCII 走词边界，中文走 includes） */
export function kwHit(text, w) {
  if (!text) return false
  return ASCII_WORD.test(w) ? wordRe(w).test(text) : text.includes(w)
}

/**
 * 行业归属：命中数最多者胜（by='kw'）；一个都不命中按信源归属兜底（by='src'）。
 * by 必须如实下发：海外科技源里的事故/文化类条目只是「来源在那儿」，
 * 界面不能说成「内容判定为人工智能」。
 */
export function tagInd(text, hint = 'ai') {
  let best = hint || 'ai'
  let bs = 0
  for (const k of Object.keys(IND_KEYWORDS)) {
    let c = 0
    for (const w of IND_KEYWORDS[k]) if (kwHit(text, w)) c++
    if (c > bs) {
      bs = c
      best = k
    }
  }
  return { k: best, by: bs > 0 ? 'kw' : 'src' }
}

/** 维度归属：命中数最多者胜；全不命中回落到 DIM_DEFAULT */
export function tagDim(text) {
  let best = DIM_DEFAULT
  let bs = 0
  for (const k of Object.keys(DIM_KEYWORDS)) {
    let c = 0
    for (const w of DIM_KEYWORDS[k]) if (kwHit(text, w)) c++
    if (c > bs) {
      bs = c
      best = k
    }
  }
  return best
}

/* =========================================================
   国标行业门类（GB/T 4754-2017 · 20 个门类）
   用途：建筑(E)/批零(F)/交通(G)/餐饮(H)/水利环境(N)/居民服务(O) 等门类
        没有可用的免费垂直 RSS，改由关键词归属；只做字面命中，不做语义猜测。
        命中数为 0 就如实为空，不硬塞。
   ========================================================= */
export const GB_KEYS = {
  A: ['农业', '农村', '粮食', '种植', '养殖', '渔业', '林业', '畜牧', '乡村振兴', '农产品', '耕地', '春耕', '秋收', '丰收', '三农', '农田'],
  B: ['矿产', '煤炭', '煤矿', '采矿', '采掘', '矿山', '矿区', '矿业', '稀土', '矿石', '铁矿', '铜矿', '锂矿', '焦煤', '尾矿', '选矿', '矿价', '页岩', '油气田', '矿井', 'mining', 'coal', 'lithium', 'ore'],
  C: ['制造业', '工业', '工厂', '产能', '生产线', '半导体', '芯片', '汽车制造', '家电', '化工', '装备', '机械', '钢材', '纺织', '食品加工', '锂电池', '光伏组件', 'manufactur', 'semiconductor', 'chip', 'factory'],
  D: ['电力', '电网', '燃气', '供水', '供热', '发电', '光伏', '风电', '储能', '电价', '核电', '氢能', '充电桩', '天然气', 'power grid', 'electricity', 'hydrogen'],
  E: ['建筑', '建筑业', '施工', '工地', '基建', '装修', '竣工', '中标', '棚改', '城市更新', '保障房', '装配式', '工程', '招标', '房屋', '施工许可', 'construction', 'infrastructure'],
  F: ['零售', '批发', '商超', '超市', '电商', '消费', '百货', '门店', '连锁', '带货', '促销', '以旧换新', '网购', '快递柜', 'retail', 'e-commerce', 'consumer'],
  G: ['铁路', '高铁', '公路', '高速', '航空', '航运', '港口', '物流', '快递', '邮政', '运输', '地铁', '机场', '货运', '仓储', '班列', '航线', '通车', 'airline', 'shipping', 'port', 'rail', 'logistics'],
  H: ['酒店', '餐饮', '民宿', '饭店', '住宿', '餐厅', '外卖', '食品安全', '菜系', '婚宴', 'hotel', 'restaurant'],
  I: ['互联网', '软件', '信息技术', '数据要素', '人工智能', '算力', '云计算', '网络安全', '5G', '通信', '大模型', '智能体', '芯片', '算法', 'software', 'internet', 'cloud', 'AI model'],
  J: ['金融', '银行', '证券', '保险', '基金', '信贷', '债券', 'IPO', '融资', '贷款', '利率', '股市', '支付', '上市', '市值', 'bank', 'funding', 'insurance'],
  K: ['楼市', '房价', '房贷', '土地出让', '商品房', '不动产', '住宅', '购房', '房地产', '楼盘', '物业', '住房', 'real estate', 'housing', 'mortgage'],
  L: ['租赁', '商务服务', '咨询', '会计', '律师', '广告', '会展', '人力资源', '旅游', '旅行社', '景区', '酒店管理', 'leasing', 'consulting'],
  M: ['科研', '研发', '实验室', '专利', '科技成果', '创新中心', '检验检测', '认证', '院士', '技术攻关', '中试', '标准制定', 'research', 'patent', 'laboratory', 'study'],
  N: ['水利', '环保', '环境治理', '污染', '生态', '碳达峰', '碳中和', '减排', '固废', '污水', '垃圾', '园林', '市政', '节能', '排污', 'climate', 'emission', 'carbon', 'pollution', 'recycl'],
  O: ['社区', '养老', '家政', '维修', '美容', '居民服务', '便民', '殡葬', '物业服务', '托育', '社区服务'],
  P: ['教育', '学校', '学生', '教师', '考试', '高校', '招生', '培训', '课程', '学位', '开学', '职教', '双减', '考研', 'education', 'school', 'student', 'university'],
  Q: ['医疗', '医院', '卫生', '疾病', '疫苗', '药品', '医保', '公共卫生', '疾控', '救助', '社会工作', '诊所', '医护', 'health', 'medical', 'vaccine', 'hospital', 'disease'],
  R: ['文化', '体育', '娱乐', '电影', '演出', '赛事', '文旅', '博物馆', '图书', '游戏', '音乐', '非遗', '演唱会', '联赛', '票房', 'culture', 'museum', 'sport', 'film'],
  S: ['国务院', '政府', '政策', '部门', '部署', '会议', '通知', '意见', '规划', '社保', '就业', '民政', '应急', '监管', '条例', '立法', '补贴', '审批', 'government', 'policy', 'regulation'],
  T: ['国际组织', '联合国', '世卫组织', '世界卫生组织', '世界银行', '国际货币基金', '世贸组织', '世贸', '博鳌', '进博会', '服贸会', '上合', '金砖', '二十国集团', '多边', '双边', '外交', 'United Nations', 'WHO', 'WTO', 'IMF'],
}

const GB_ORDER = Object.keys(GB_KEYS)

/** 返回命中的门类代码（最多 3 个，按命中数降序）；命中 0 → [] */
export function tagGB(text) {
  const t = String(text || '')
  if (!t) return []
  const hits = []
  for (const code of GB_ORDER) {
    let n = 0
    for (const w of GB_KEYS[code]) if (kwHit(t, w)) n++
    if (n) hits.push([code, n])
  }
  hits.sort((a, b) => b[1] - a[1])
  return hits.slice(0, 3).map((h) => h[0])
}

/* ---------- 影响面 / 可执行动作 词表（打分用，放这里便于一处调参） ---------- */
export const impactWord =
  /(政策|监管|约谈|处罚|罚款|备案|审批|中标|成交|签约|扩产|停产|涨价|降价|电价|收购|并购|退市|违约|破产|降准|降息|下调|上调|禁止|试点)/
export const actionWord =
  /(申报|受理|实施|生效|执行|招标|询价|报价|库存|交货|并网|开工|交付|落地|施行|报名|材料)/

/**
 * 语义分类（政策/价格/资本/供给/人事/技术/动态）。
 * 注意：这不是库表 gap_events.kind —— kind 存的是信源主层（insider/main/rare/tech），
 * 本函数结果作为辅助字段 topic，供前端图标/分组使用，不入库。
 */
export function guessKind(text) {
  const t = String(text || '')
  if (impactWord.test(t) && /政策|监管|备案|审批|试点|施行|名单|公示/.test(t)) return '政策'
  if (/涨价|降价|价格|报价|电价|成交|拍下|中标/.test(t)) return '价格'
  if (/融资|投资|并购|收购|IPO|轮|增持|减持/.test(t)) return '资本'
  if (/产能|扩产|停产|并网|装机|库存|交付|交货/.test(t)) return '供给'
  if (/招聘|裁员|薪酬|涨薪|岗位/.test(t)) return '人事'
  if (/开源|模型|论文|专利|技术|算法|量产/.test(t)) return '技术'
  return '动态'
}

/**
 * 实体识别：从标题/摘要抽公司/机构/产品实体（零依赖，正则 + 高频速查表）。
 * 用途：跨层时差（先见于前沿/决策圈、后被主流报道）需要稳定的实体键。
 */
export function extractEntities(text) {
  const t = String(text || '')
  const ents = new Set()
  const zh =
    /(?:[\u4e00-\u9fa5]{2,})(?:公司|集团|股份|控股|科技|技术|生物|能源|银行|证券|保险|传媒|网络|智能|制药|医疗|电子|汽车|地产|航空|钢铁|石化|电力|化工|食品|医药|芯片|半导体|新能源|互联网|数据|信息|投资|基金|工业|材料|通信|装备)/g
  let m
  while ((m = zh.exec(t))) ents.add(m[0])
  const en = /[A-Z][a-zA-Z]+(?:\s[A-Z][a-zA-Z]+)*\s(?:Inc|Corp|Labs|AI|Technologies|Pharma|Bio|Group|Holdings)/g
  while ((m = en.exec(t))) ents.add(m[0].replace(/\s+/g, ' ').trim())
  const KNOWN = [
    'OpenAI', 'Google', 'Microsoft', 'Meta', 'Apple', 'Nvidia', 'Tesla', 'Amazon', 'Intel', 'AMD',
    'Tencent', '腾讯', 'Alibaba', '阿里', '阿里巴巴', '华为', 'ByteDance', '字节跳动', 'Baidu', '百度',
    'JD', '京东', 'Meituan', '美团', 'BYD', '比亚迪', 'CATL', '宁德时代', 'Xiaomi', '小米',
    'Samsung', '三星', 'TSMC', '台积电', 'Anthropic', 'Perplexity', 'DeepSeek', '深度求索', '快手',
    'NetEase', '网易', 'Bilibili', '哔哩哔哩', 'Pfizer', '辉瑞', 'Oracle', 'IBM', 'Salesforce',
    'Siemens', 'Boeing', 'SpaceX', 'Toyota', 'Ford', 'Sony',
  ]
  for (const k of KNOWN) if (t.includes(k)) ents.add(k)
  return [...ents].slice(0, 10)
}

/** 标签提取（最多 3 个，供卡片打标） */
export function pickTags(text) {
  const t = String(text || '')
  const map = {
    算力: '算力', 融资: '融资', 政策: '政策', 出口: '出口', 价格: '价格', 电池: '电池', 芯片: '芯片',
    医药: '医药', 光伏: '光伏', 储能: '储能', 机器人: '机器人', 跨境: '跨境', 地产: '地产',
    模型: '大模型', 数据: '数据',
  }
  const arr = []
  for (const k of Object.keys(map)) if (t.includes(k)) arr.push(map[k])
  return [...new Set(arr)].slice(0, 3)
}
