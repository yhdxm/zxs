// 学习中心数据层 — 全部免费、可降级。
//  - 学位英语：Free Dictionary API（免费无 key）
//  - 书籍阅读：Project Gutenberg（gutendex.com 免费 API）
//  - 各行业知识：内置知识库 + 已配置 AI 答疑
//  - AI 答疑：复用 callAi

import { fetchCorsJson, fetchCorsText } from './freeApi'
import { callAi, type AiConfig } from './aiService'

/* ===================== 学位英语 ===================== */

export interface WordMeaning {
  partOfSpeech: string
  definitions: { definition: string; example?: string }[]
}
export interface WordDefinition {
  word: string
  phonetics: { text?: string; audio?: string }[]
  meanings: WordMeaning[]
}

/** 查词（Free Dictionary API，免费无 key） */
export async function fetchDefinition(word: string): Promise<WordDefinition | null> {
  try {
    const data = await fetchCorsJson<WordDefinition[]>(
      `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word.trim().toLowerCase())}`
    )
    if (Array.isArray(data) && data.length) return data[0] ?? null
  } catch {
    /* 忽略，返回 null 由调用方降级 */
  }
  return null
}

/** 用已配置 AI 通俗讲解单词（面向学位英语/考研备考） */
export async function explainWord(word: string, def: WordDefinition | null, cfg: AiConfig): Promise<string> {
  const base = def ? JSON.stringify(def.meanings?.slice(0, 3)) : '（词典未返回释义）'
  const prompt =
    `请用通俗易懂的中文解释英文单词 "${word}"，面向学位英语/考研备考人群。\n` +
    `已知词典释义：${base}\n` +
    `请输出：1) 中文释义；2) 常见搭配（2-3 个）；3) 一个易记例句（含中英文）；4) 记忆小贴士。控制在 200 字内。`
  return callAi(cfg, prompt)
}

/* ===================== 各行业知识 ===================== */

export interface IndustryTopic {
  name: string
  desc: string
  keyPoints: string[]
}

/** 各行业知识库（零网络依赖，AI 可在此基础上追问；覆盖更全面，避免「显示不全」） */
export const INDUSTRY_KNOWLEDGE: IndustryTopic[] = [
  {
    name: '人工智能',
    desc: '研究如何让机器模拟人类智能的学科，含机器学习、深度学习、自然语言处理等方向。',
    keyPoints: ['机器学习：从数据中自动学习规律', '大模型：以 Transformer 为主的生成式 AI', '应用：推荐、风控、客服、创作']
  },
  {
    name: '新能源汽车',
    desc: '采用新型动力系统的汽车，含纯电、插混、增程，核心在电池与电控。',
    keyPoints: ['三电：电池/电机/电控', '补能：充电与换电', '趋势：智能化与电动化融合']
  },
  {
    name: '金融理财',
    desc: '对资产进行规划、投资与风险管理，实现保值增值。',
    keyPoints: ['复利：时间带来的指数增长', '资产配置：分散风险', '风险与收益成正比']
  },
  {
    name: '医疗健康',
    desc: '维护与促进健康的科学，含预防、诊断、治疗与康复。',
    keyPoints: ['三级预防：未病先防', '循证医学：以证据为准', '健康生活方式是基础']
  },
  {
    name: '编程开发',
    desc: '用编程语言让计算机按预期工作的过程，是现代数字社会的基础技能。',
    keyPoints: ['算法与数据结构是核心', '版本控制（Git）协作必备', '持续学习新技术']
  },
  {
    name: '法律常识',
    desc: '规范社会行为的规则体系，了解基础法律可更好保护自身权益。',
    keyPoints: ['合同法：约定双方权利义务', '民法典：民事关系总典', '证据意识很重要']
  },
  {
    name: '教育培训',
    desc: '有目的、有计划地传授知识与技能，成人教育与职业培训是终身学习的重要组成。',
    keyPoints: ['成人教育：工作与学习并行', '在线教育：突破时空限制', '能力本位：以实操为目标']
  },
  {
    name: '电子商务',
    desc: '通过互联网进行的商品与服务交易，涵盖平台、直播、跨境与供应链。',
    keyPoints: ['流量与转化：电商核心指标', '直播带货：内容驱动成交', '供应链：履约效率决定体验']
  },
  {
    name: '餐饮食品',
    desc: '从食材、烹饪到门店运营的服务业态，注重卫生、口味与复购。',
    keyPoints: ['食品安全：底线要求', '标准化：可复制的关键', '私域：提升复购率']
  },
  {
    name: '房地产建筑',
    desc: '房屋与基础设施建设行业，含开发、施工、物业与装修。',
    keyPoints: ['周期性强：受政策影响大', '施工安全：红线不可碰', '物业：长周期服务价值']
  },
  {
    name: '现代农业',
    desc: '以科技提升农业生产效率，含智慧农业、设施农业与农产品电商。',
    keyPoints: ['智慧农业：传感器与数据', '冷链：减少损耗', '品牌化：提升附加值']
  },
  {
    name: '能源电力',
    desc: '支撑社会运转的基础产业，正从化石能源向风、光、储等清洁能源转型。',
    keyPoints: ['双碳：碳达峰与碳中和', '新型电力系统：源网荷储协同', '储能：平抑波动']
  },
  {
    name: '物流供应链',
    desc: '商品从产地到消费者的流动网络，含仓储、运输、配送与跨境。',
    keyPoints: ['仓配一体：提效降本', '数字化：全程可视', '最后一公里：体验关键']
  },
  {
    name: '文化传媒',
    desc: '内容的生产、传播与消费，含出版、影视、短视频与新媒体运营。',
    keyPoints: ['内容为王：持续产出价值', '用户运营：社群与互动', '版权：核心资产']
  },
  {
    name: '旅游酒店',
    desc: '满足人们出行、住宿与体验需求的服务业，与文旅融合趋势明显。',
    keyPoints: ['体验经济：情绪价值', '淡旺季：精细化运营', '文旅融合：内容+场景']
  },
  {
    name: '人力资源',
    desc: '组织选、育、用、留人的管理职能，关乎团队效能与文化建设。',
    keyPoints: ['招聘：人岗匹配', '绩效：目标对齐', '培训：能力成长']
  },
  {
    name: '设计创意',
    desc: '以视觉与体验解决问题的专业领域，含平面、产品、UI/UX 与品牌。',
    keyPoints: ['用户中心：从需求出发', '一致性：建立认知', '可用性：先于美观']
  }
]

/** 用已配置 AI 通俗讲解行业/专业知识点（零基础向） */
export async function explainTopic(topic: string, cfg: AiConfig): Promise<string> {
  const prompt =
    `请用通俗中文讲解「${topic}」这一行业/专业知识，面向零基础学习者：\n` +
    `1) 一句话定义；2) 核心要点（3 条）；3) 一个生活化类比；4) 常见误区。控制在 250 字内，不要编造未经证实的数据。`
  return callAi(cfg, prompt)
}

/* ===================== 书籍阅读（Project Gutenberg） ===================== */

export interface GutenbergBook {
  id: number
  title: string
  authors: { name: string }[]
  formats: Record<string, string>
  download_count: number
  subjects?: string[]
  languages?: string[]
}
export interface BookSearchResult {
  count: number
  next: string | null
  previous: string | null
  results: GutenbergBook[]
}

/** 维基文库中文 API（免费无 key），用于检索国内公版书 */
const WIKI_BASE = 'https://zh.wikisource.org/w/api.php'

/** 字符串转稳定数字 id（维基文库条目无数字 id，用标题 hash 生成） */
function hashId(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0
  return Math.abs(h)
}

/**
 * 检索国内公版书：优先维基文库中文搜索（免费、国内友好），
 * 失败或为空则降级到内置中国经典书目，保证「只显示国内书籍」且有数据。
 */
export async function fetchBooks(query: string, page = 1): Promise<BookSearchResult> {
  const q = query.trim()
  if (!q) {
    return { count: BUILTIN_BOOKS.length, next: null, previous: null, results: BUILTIN_BOOKS }
  }
  try {
    const url = `${WIKI_BASE}?action=query&list=search&srsearch=${encodeURIComponent(q)}&srnamespace=0&srlimit=12&format=json`
    const data = await fetchCorsJson<{ query?: { search?: { title: string }[] } }>(url)
    const list = data?.query?.search || []
    if (list.length) {
      const results: GutenbergBook[] = list.map((it) => ({
        id: hashId(it.title),
        title: it.title,
        authors: [{ name: '—' }],
        download_count: 0,
        languages: ['zh'],
        subjects: ['公版书'],
        formats: { wikisource: `https://zh.wikisource.org/wiki/${encodeURIComponent(it.title)}` }
      }))
      return { count: results.length, next: null, previous: null, results }
    }
  } catch {
    /* 维基文库不可达，降级到内置中国书目 */
  }
  return { count: BUILTIN_BOOKS.length, next: null, previous: null, results: BUILTIN_BOOKS }
}

/** 内置中国公版书兜底（维基文库不可达时保证有国内书可读，均为真实书目，维基文库在线阅读） */
export const BUILTIN_BOOKS: GutenbergBook[] = [
  { id: 1, title: '红楼梦', authors: [{ name: '曹雪芹' }], download_count: 99999, languages: ['zh'], subjects: ['古典小说'], formats: { wikisource: 'https://zh.wikisource.org/wiki/紅樓夢' } },
  { id: 2, title: '三国演义', authors: [{ name: '罗贯中' }], download_count: 99999, languages: ['zh'], subjects: ['古典小说'], formats: { wikisource: 'https://zh.wikisource.org/wiki/三國演義' } },
  { id: 3, title: '水浒传', authors: [{ name: '施耐庵' }], download_count: 99999, languages: ['zh'], subjects: ['古典小说'], formats: { wikisource: 'https://zh.wikisource.org/wiki/水滸傳' } },
  { id: 4, title: '西游记', authors: [{ name: '吴承恩' }], download_count: 99999, languages: ['zh'], subjects: ['古典小说'], formats: { wikisource: 'https://zh.wikisource.org/wiki/西遊記' } },
  { id: 5, title: '论语', authors: [{ name: '孔子' }], download_count: 99999, languages: ['zh'], subjects: ['先秦诸子'], formats: { wikisource: 'https://zh.wikisource.org/wiki/論語' } },
  { id: 6, title: '道德经', authors: [{ name: '老子' }], download_count: 99999, languages: ['zh'], subjects: ['先秦诸子'], formats: { wikisource: 'https://zh.wikisource.org/wiki/道德經' } },
  { id: 7, title: '史记', authors: [{ name: '司马迁' }], download_count: 99999, languages: ['zh'], subjects: ['史书'], formats: { wikisource: 'https://zh.wikisource.org/wiki/史記' } },
  { id: 8, title: '唐诗三百首', authors: [{ name: '蘅塘退士 编' }], download_count: 99999, languages: ['zh'], subjects: ['诗词'], formats: { wikisource: 'https://zh.wikisource.org/wiki/唐詩三百首' } },
  { id: 9, title: '资治通鉴', authors: [{ name: '司马光' }], download_count: 99999, languages: ['zh'], subjects: ['史书'], formats: { wikisource: 'https://zh.wikisource.org/wiki/資治通鑑' } },
  { id: 10, title: '儒林外史', authors: [{ name: '吴敬梓' }], download_count: 99999, languages: ['zh'], subjects: ['古典小说'], formats: { wikisource: 'https://zh.wikisource.org/wiki/儒林外史' } },
  { id: 11, title: '呐喊', authors: [{ name: '鲁迅' }], download_count: 99999, languages: ['zh'], subjects: ['现代文学'], formats: { wikisource: 'https://zh.wikisource.org/wiki/吶喊' } },
  { id: 12, title: '围城', authors: [{ name: '钱锺书' }], download_count: 99999, languages: ['zh'], subjects: ['现代文学'], formats: { wikisource: 'https://zh.wikisource.org/wiki/圍城' } }
]

/** 选取适合在线阅读的纯文本 URL */
export function pickTextUrl(book: GutenbergBook): string | null {
  return (
    book.formats['text/plain; charset=utf-8'] ||
    book.formats['text/plain; charset=us-ascii'] ||
    book.formats['text/plain'] ||
    null
  )
}
export function pickEpubUrl(book: GutenbergBook): string | null {
  return book.formats['application/epub+zip'] || null
}
/** 选取阅读地址：优先纯文本，其次维基文库在线阅读外链（国内书籍） */
export function pickReadUrl(book: GutenbergBook): string | null {
  return pickTextUrl(book) || book.formats['wikisource'] || null
}

/** 拉取书籍正文（限制长度，避免超大文件卡顿） */
export async function fetchBookText(textUrl: string, maxBytes = 80000): Promise<string> {
  return fetchCorsText(textUrl, { maxBytes })
}

/* ===================== 学位英语：大纲知识库 + 学习计划 ===================== */

export interface EnglishOutlineItem {
  key: string
  name: string
  desc: string
  keyPoints: string[]
}

/**
 * 按《成人高等教育本科生学士学位英语水平考试大纲》（高等教育出版社第二版）分门别类。
 * 题型结构：完成对话 / 阅读理解 / 词汇与语法 / 完形填空 / 英译汉 / 写作。
 */
export const ENGLISH_OUTLINE: EnglishOutlineItem[] = [
  {
    key: 'dialogue',
    name: '会话技能（完成对话）',
    desc: '从备选选项中选出最符合语境的应答，考查日常交际用语与语用能力。',
    keyPoints: ['问候、介绍、告别', '邀约、道歉、道谢、请求', '打电话、问路与指路、购物就餐']
  },
  {
    key: 'vocabulary',
    name: '词汇（词语用法）',
    desc: '考查词语的辨析、搭配与语境中最恰当用词，约 3000 核心词汇量。',
    keyPoints: ['近义词/形近词辨析', '固定搭配与短语动词', '一词多义与熟词生义']
  },
  {
    key: 'grammar',
    name: '语法结构',
    desc: '考查时态语态、非谓语、从句、虚拟语气、主谓一致等核心语法点。',
    keyPoints: ['时态与被动语态', '非谓语动词（不定式/分词/动名词）', '定语从句/名词性从句/虚拟语气']
  },
  {
    key: 'reading',
    name: '阅读理解',
    desc: '考查快速获取主旨、细节、推理与作者态度，通常 4 篇，约 1000-1200 词。',
    keyPoints: ['主旨大意与标题', '细节定位与推理判断', '词义猜测与作者态度']
  },
  {
    key: 'cloze',
    name: '完形填空',
    desc: '一篇约 200 词短文挖空，综合考查词汇、语法与语篇逻辑。',
    keyPoints: ['语篇连贯与逻辑', '上下文线索复现', '固定搭配与常识']
  },
  {
    key: 'translation',
    name: '英译汉（翻译）',
    desc: '将一段英文（约 100-120 词）译成通顺准确的中文，考查理解与表达。',
    keyPoints: ['长难句拆分', '定语从句/非谓语的处理', '直译与意译的平衡']
  },
  {
    key: 'writing',
    name: '写作',
    desc: '按要求写一篇约 100-120 词的短文（提纲/图画/情景作文），考查组织与表达。',
    keyPoints: ['三段式结构（引入-展开-结论）', '常用句式与连接词', '书写规范与卷面']
  },
  {
    key: 'vocab-list',
    name: '高频核心词汇',
    desc: '学位英语常考核心词与易混词，建议结合生词本循环记忆。',
    keyPoints: ['academic / certificate / requirement / benefit', 'significant / environment / economy', 'responsibility / opportunity / communication']
  },
  {
    key: 'phrases',
    name: '常考短语搭配',
    desc: '完形与写作高频固定搭配，记搭配比记单词更高效。',
    keyPoints: ['take advantage of / make a difference', 'in terms of / with regard to', 'play a role in / contribute to']
  },
  {
    key: 'templates',
    name: '写作模板与万能句',
    desc: '常用开头、衔接、结尾句式，考场上快速成文。',
    keyPoints: ['开头：When it comes to …, opinions vary.', '衔接：On the one hand …, on the other hand …', '结尾：Only in this way can we …']
  },
  {
    key: 'tips',
    name: '真题示例与应试技巧',
    desc: '各题型时间与得分策略，按权重分配精力。',
    keyPoints: ['阅读 4 篇分值高，先读题干再定位', '完形先看首尾把握主旨', '写作留足 20 分钟，卷面工整']
  }
]

/** 内置学位英语高频词兜底（Free Dictionary API 不可达时使用，保证查词页有数据） */
export const BUILTIN_WORDS: Record<string, { phonetic: string; pos: string; def: string; example?: string }> = {
  vocabulary: { phonetic: '/vəˈkæbjələri/', pos: 'n.', def: '词汇；某人掌握的全部词语。', example: 'Reading widely builds your vocabulary.' },
  sustainable: { phonetic: '/səˈsteɪnəbl/', pos: 'adj.', def: '可持续的；能长期维持的。', example: 'We need sustainable development.' },
  analysis: { phonetic: '/əˈnæləsɪs/', pos: 'n.', def: '分析；对事物构成的研究。', example: 'Data analysis helps decision-making.' },
  significant: { phonetic: '/sɪɡˈnɪfɪkənt/', pos: 'adj.', def: '重要的；有意义的。', example: 'There was a significant change.' },
  environment: { phonetic: '/ɪnˈvaɪrənmənt/', pos: 'n.', def: '环境；周围条件。', example: 'We should protect the environment.' },
  economy: { phonetic: '/ɪˈkɒnəmi/', pos: 'n.', def: '经济；节约。', example: 'The economy is recovering.' },
  technology: { phonetic: '/tekˈnɒlədʒi/', pos: 'n.', def: '技术；科技。', example: 'Technology changes our life.' },
  responsibility: { phonetic: '/rɪˌspɒnsəˈbɪləti/', pos: 'n.', def: '责任；职责。', example: 'He has a lot of responsibility.' },
  communication: { phonetic: '/kəˌmjuːnɪˈkeɪʃn/', pos: 'n.', def: '交流；沟通。', example: 'Good communication matters.' },
  opportunity: { phonetic: '/ˌɒpəˈtjuːnəti/', pos: 'n.', def: '机会；时机。', example: 'It is a good opportunity.' },
  certificate: { phonetic: '/səˈtɪfɪkət/', pos: 'n.', def: '证书；证明。', example: 'He got a degree certificate.' },
  graduate: { phonetic: '/ˈɡrædʒueɪt/', pos: 'v./n.', def: '毕业；毕业生。', example: 'She will graduate next year.' },
  academic: { phonetic: '/ˌækəˈdemɪk/', pos: 'adj.', def: '学术的；学院的。', example: 'Academic performance is important.' },
  requirement: { phonetic: '/rɪˈkwaɪəmənt/', pos: 'n.', def: '要求；必要条件。', example: 'Meet the requirement first.' },
  benefit: { phonetic: '/ˈbenɪfɪt/', pos: 'n./v.', def: '好处；受益。', example: 'Exercise benefits health.' }
}

/** 带兜底地查词：API 不可达时返回内置高频词释义 */
export async function fetchDefinitionSafe(word: string): Promise<{ def: WordDefinition | null; builtin?: { phonetic: string; pos: string; def: string; example?: string } }> {
  const def = await fetchDefinition(word)
  if (def) return { def }
  const key = word.trim().toLowerCase()
  if (BUILTIN_WORDS[key]) return { def: null, builtin: BUILTIN_WORDS[key] }
  return { def: null }
}

/* ----- 学习计划 ----- */
export interface StudyPlanPhase {
  title: string
  days: string
  goals: string[]
  methods: string[]
}
export interface StudyPlan {
  examDate: string
  totalDays: number
  focus: string[]
  phases: StudyPlanPhase[]
  tips: string[]
}
export interface StudyPlanInput {
  materialText?: string
  examDate: string
  currentLevel?: string
  target?: string
  focusModules?: string[]
}

/**
 * 调用已配置 AI 生成学位英语备考计划（依据大纲第二版）。
 * 资料文本本地解析后传入（不存服务器原文件），计划结构返回后由页面存入云端。
 */
export async function generateStudyPlan(cfg: AiConfig, input: StudyPlanInput): Promise<StudyPlan> {
  const focus = input.focusModules && input.focusModules.length
    ? input.focusModules.join('、')
    : '会话/词汇/语法/阅读/完形/翻译/写作（按大纲）'
  const material = input.materialText
    ? `考生上传的备考资料（节选）：\n${input.materialText.slice(0, 3000)}\n`
    : '（未提供资料，按通用学位英语大纲备考）'
  const prompt =
    '你是成人本科学位英语备考规划师。请严格依据《成人高等教育本科生学士学位英语水平考试大纲》（高等教育出版社第二版）。\n' +
    '基于以下信息制定一份合理、可执行的备考学习计划。\n' +
    `# 考生资料：\n${material}\n` +
    `# 考试时间：${input.examDate}\n` +
    `# 当前水平：${input.currentLevel || '未说明'}\n` +
    `# 目标：${input.target || '通过考试'}\n` +
    `# 重点模块：${focus}\n\n` +
    '只输出严格 JSON（不要任何解释文字），结构如下：\n' +
    '{\n' +
    '  "examDate": "' + input.examDate + '",\n' +
    '  "totalDays": 数字(距考试天数),\n' +
    '  "focus": ["模块1","模块2"],\n' +
    '  "phases": [{"title":"阶段名","days":"第X-Y天","goals":["目标"],"methods":["方法"]}],\n' +
    '  "tips": ["提示1","提示2","提示3"]\n' +
    '}\n' +
    '阶段按时间由近到远合理划分，总量适中、可执行；若距考试较近应突出高频考点与真题。'
  const text = await callAi(cfg, prompt)
  const jsonStr = text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1)
  return JSON.parse(jsonStr) as StudyPlan
}

/** 前端本地解析上传的资料文件（txt/md 全量；docx 暂提示另存为 txt） */
export async function parseMaterialFile(file: File): Promise<string> {
  const name = file.name.toLowerCase()
  if (name.endsWith('.txt') || name.endsWith('.md') || name.endsWith('.text')) {
    return await file.text()
  }
  if (name.endsWith('.docx')) {
    throw new Error('暂仅支持 .txt/.md，请在 Word 中「另存为」纯文本(.txt)后重新上传。')
  }
  throw new Error('不支持的文件类型，请上传 .txt 或 .md 文本文件。')
}
