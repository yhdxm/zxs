// AI 模型知识库 —— 本地写死数据（不依赖任何付费/远程接口，纯静态，零额度消耗）
// 用途：供「AI 模型知识」页面的国内模型 / 国外模型 / 国内应用 / 国外应用四个模块展示。
// 说明：以下信息为公开资料整理，供学习了解使用，实际参数与价格以各厂商官方页面为准。

export type Region = 'cn' | 'global'

/** 模型条目 */
export interface KnowModel {
  id: string
  /** 模型名（含系列） */
  name: string
  /** 研发机构 */
  org: string
  /** 参数规模 */
  scale: string
  /** 主要用途标签 */
  uses: string[]
  /** 免费调用渠道 */
  freeChannels: string[]
  /** 开源许可证 / 商用形态 */
  license: string
  /** 首次发布时间 */
  released: string
  /** 资料来源 */
  source: string
  /** 一句话定位 */
  intro: string
  /** 学习要点（AI 分析面板默认展示） */
  points: string[]
  /** 典型应用（应用名 · 发布时间 · 来源） */
  apps: Array<{ name: string; date: string; from: string }>
}

/** 应用条目 */
export interface KnowApp {
  id: string
  name: string
  /** 厂商 */
  vendor: string
  /** 分类 key，对应 APP_CATEGORIES */
  cat: string
  /** 发布时间 */
  released: string
  /** 消息来源 */
  source: string
  /** 官网 */
  site: string
  /** 产品介绍 */
  intro: string
  /** 免费策略说明 */
  freeNote: string
  /** 底层模型（关联 KnowModel.id，可为空） */
  modelId?: string
  /** 关键时间线 */
  timeline: Array<{ date: string; event: string }>
}

/** 应用分类（已扩展至 10 类） */
export const APP_CATEGORIES: Array<{ key: string; label: string; color: string }> = [
  { key: 'all', label: '全部', color: '#6366f1' },
  { key: 'chat', label: '对话助手', color: '#6366f1' },
  { key: 'code', label: '编程开发', color: '#0ea5e9' },
  { key: 'image', label: '绘画设计', color: '#ec4899' },
  { key: 'video', label: '视频生成', color: '#f97316' },
  { key: 'audio', label: '音频语音', color: '#14b8a6' },
  { key: 'office', label: '办公效率', color: '#22c55e' },
  { key: 'search', label: '搜索问答', color: '#eab308' },
  { key: 'agent', label: '智能体平台', color: '#a855f7' },
  { key: 'study', label: '教育学习', color: '#f43f5e' },
  { key: 'role', label: '数字人陪伴', color: '#8b5cf6' }
]

export function categoryLabel(key: string): string {
  return APP_CATEGORIES.find((c) => c.key === key)?.label || key
}
export function categoryColor(key: string): string {
  return APP_CATEGORIES.find((c) => c.key === key)?.color || '#6366f1'
}

/* ==================== 国内模型 ==================== */
export const CN_MODELS: KnowModel[] = [
  {
    id: 'qwen3',
    name: 'Qwen3（通义千问）',
    org: '阿里巴巴通义实验室',
    scale: '0.6B – 235B（含 MoE）',
    uses: ['通用对话', '代码', '多模态', '工具调用'],
    freeChannels: ['魔搭 ModelScope 免费推理', '硅基流动免费额度', 'Hugging Face', 'Ollama 本地部署'],
    license: 'Apache-2.0',
    released: '2025-04',
    source: '阿里云官方博客 / Qwen GitHub',
    intro: '国内下载量最高的开源模型系列，从 0.6B 端侧到 235B MoE 全尺寸覆盖，中英文与代码能力均衡。',
    points: [
      '全尺寸开源：手机端 0.6B 到服务器 235B MoE 都有对应版本，选型自由度最高',
      'Apache-2.0 协议可商用，是国内二次开发与微调生态最活跃的底座',
      '支持「思考 / 非思考」双模式切换，复杂题走深度推理、简单题走快答省算力',
      '衍生系列丰富：Qwen-Coder（代码）、Qwen-VL（视觉）、Qwen-Audio（语音）'
    ],
    apps: [
      { name: '通义千问 App', date: '2023-04-11', from: '阿里云峰会发布' },
      { name: '通义灵码（编程助手）', date: '2023-10-31', from: '云栖大会' },
      { name: '夸克 AI 搜索', date: '2024-08', from: '夸克官方公告' }
    ]
  },
  {
    id: 'deepseek-v3',
    name: 'DeepSeek-V3',
    org: '深度求索 DeepSeek',
    scale: '671B MoE（激活 37B）',
    uses: ['通用对话', '代码', '长文本'],
    freeChannels: ['DeepSeek 开放平台赠额', '硅基流动', 'OpenRouter 免费档'],
    license: 'MIT',
    released: '2024-12',
    source: 'DeepSeek 官方技术报告',
    intro: '以极低训练成本达到同期一线闭源模型水平的 MoE 大模型，推理性价比是最大卖点。',
    points: [
      'MoE 架构：总参数 671B 但每 token 只激活 37B，推理成本大幅下降',
      'MIT 协议，权重与论文完全公开，允许商用与蒸馏',
      '训练成本公开透明（约 557 万美元），带动业内对算力效率的重新讨论',
      '中文语料占比高，中文写作与代码补全表现突出'
    ],
    apps: [
      { name: 'DeepSeek App', date: '2025-01-11', from: 'DeepSeek 官方上线公告' },
      { name: '硅基流动免费 API', date: '2025-01', from: 'SiliconFlow 平台公告' }
    ]
  },
  {
    id: 'deepseek-r1',
    name: 'DeepSeek-R1',
    org: '深度求索 DeepSeek',
    scale: '671B MoE + 1.5B~70B 蒸馏版',
    uses: ['深度推理', '数学', '代码', '逻辑'],
    freeChannels: ['DeepSeek 开放平台', '硅基流动', 'Ollama 本地跑蒸馏版'],
    license: 'MIT',
    released: '2025-01',
    source: 'DeepSeek-R1 论文（arXiv）',
    intro: '国内首个大规模开源的「思维链推理」模型，输出完整推理过程，蒸馏小模型可在个人电脑运行。',
    points: [
      '纯强化学习训练出推理能力，无需大量人工标注思维链',
      '开放思考过程（<think> 标签），非常适合用来学习模型如何拆解问题',
      '蒸馏出 1.5B/7B/8B/14B/32B/70B 六个小模型，笔记本也能本地跑',
      '数学与竞赛题表现对标当时的一线闭源推理模型'
    ],
    apps: [
      { name: 'DeepSeek App「深度思考」模式', date: '2025-01-20', from: 'DeepSeek 官方' },
      { name: '各大云平台一键部署', date: '2025-02', from: '腾讯云/阿里云/华为云公告' }
    ]
  },
  {
    id: 'glm4',
    name: 'GLM-4 / GLM-4.5',
    org: '智谱 AI（清华系）',
    scale: '9B – 355B MoE',
    uses: ['通用对话', '智能体', '长文本', '代码'],
    freeChannels: ['智谱开放平台免费额度', 'GLM-4-Flash 免费 API', 'Hugging Face 开源权重'],
    license: 'MIT（开源版本）',
    released: '2024-06 / 2025-07',
    source: '智谱 AI 官网 / GLM GitHub',
    intro: '清华技术路线的国产代表模型，Agent 与工具调用能力强，开放平台长期提供免费档模型。',
    points: [
      'GLM-4-Flash 系列长期免费开放 API，适合个人学习和小项目',
      '原生支持函数调用、代码解释器、联网检索三件套，Agent 生态成熟',
      '长上下文版本支持百万级 token，用于长文档分析',
      'ChatGLM 系列是国内最早开源的中文大模型之一，社区教程丰富'
    ],
    apps: [
      { name: '智谱清言', date: '2023-08-31', from: '智谱 AI 官方发布' },
      { name: 'AutoGLM（手机自动操作）', date: '2024-10-25', from: '智谱 DevDay' },
      { name: 'CodeGeeX 编程助手', date: '2022-09', from: '清华 KEG 实验室' }
    ]
  },
  {
    id: 'kimi-k2',
    name: 'Kimi K2',
    org: '月之暗面 Moonshot AI',
    scale: '1T MoE（激活 32B）',
    uses: ['智能体', '代码', '工具调用', '长文本'],
    freeChannels: ['Kimi 网页/App 免费使用', 'Hugging Face 开源权重', 'OpenRouter'],
    license: '修改版 MIT',
    released: '2025-07',
    source: 'Moonshot AI 官方发布',
    intro: '万亿参数开源 MoE 模型，专为 Agent 场景优化，工具调用与多步任务执行是强项。',
    points: [
      '万亿总参数但只激活 32B，是当时开源规模最大的模型之一',
      '主打 Agentic 能力：自动拆解任务、连续调用工具、写代码验证',
      'Kimi 产品线以「超长上下文」起家，长文档问答体验成熟',
      '开源权重可自行部署，协议基本等同 MIT（仅要求超大规模商用署名）'
    ],
    apps: [
      { name: 'Kimi 智能助手', date: '2023-10-09', from: '月之暗面官方上线' },
      { name: 'Kimi 探索版', date: '2024-10-10', from: '月之暗面产品发布会' }
    ]
  },
  {
    id: 'minimax-m1',
    name: 'MiniMax-M1 / abab',
    org: 'MiniMax 稀宇科技',
    scale: '456B MoE（激活 45B）',
    uses: ['长上下文', '推理', '多模态'],
    freeChannels: ['MiniMax 开放平台赠额', 'Hugging Face 开源权重'],
    license: 'Apache-2.0',
    released: '2025-06',
    source: 'MiniMax 官方技术报告',
    intro: '主打超长上下文与线性注意力的开源推理模型，百万级上下文下推理成本明显低于同级。',
    points: [
      '采用闪电注意力（Lightning Attention），长文本推理算力消耗显著降低',
      '原生支持 100 万 token 上下文输入，适合整本书、整个代码仓分析',
      'MiniMax 同时布局语音与视频，模型矩阵覆盖多模态',
      'Apache-2.0 完全开源可商用'
    ],
    apps: [
      { name: '海螺 AI', date: '2024-09', from: 'MiniMax 官方' },
      { name: '星野（AI 角色）', date: '2022-09', from: 'MiniMax 产品线' }
    ]
  },
  {
    id: 'doubao',
    name: '豆包大模型 Doubao',
    org: '字节跳动',
    scale: '未完全公开（多尺寸矩阵）',
    uses: ['通用对话', '多模态', '语音', '视频理解'],
    freeChannels: ['豆包 App/网页免费', '火山方舟新用户免费额度'],
    license: '闭源商用',
    released: '2024-05',
    source: '火山引擎发布会',
    intro: '字节旗下模型矩阵，凭借极低的 API 定价与庞大 C 端入口，成为国内调用量最大的模型之一。',
    points: [
      '以「降价」推动普及，把大模型推理价格拉到厘级，行业影响大',
      '模型矩阵齐全：语言、视觉、语音合成、视频生成分工明确',
      'C 端豆包 App 免费不限量使用，是观察产品化落地的好样本',
      '闭源，只能通过火山方舟 API 调用，不能本地部署'
    ],
    apps: [
      { name: '豆包 App', date: '2023-08-17', from: '字节跳动上线' },
      { name: '即梦 AI（图像视频）', date: '2023-08', from: '剪映团队' },
      { name: 'Trae AI IDE', date: '2025-01', from: '字节跳动官方' }
    ]
  },
  {
    id: 'hunyuan',
    name: '混元 Hunyuan',
    org: '腾讯',
    scale: '0.5B – 389B MoE',
    uses: ['通用对话', '文生图', '文生 3D', '视频'],
    freeChannels: ['腾讯元宝免费', '腾讯云新用户额度', 'Hugging Face 开源权重'],
    license: '腾讯混元开源协议',
    released: '2024-11',
    source: '腾讯云官方 / Hunyuan GitHub',
    intro: '腾讯自研模型矩阵，除语言模型外，开源的 3D 生成与视频生成模型在社区口碑较好。',
    points: [
      'Hunyuan3D 系列是目前少数开源可用的文生 3D 模型，独特性强',
      'HunyuanVideo 开源视频生成模型，支持本地部署出片',
      '语言模型走 MoE 路线，同时提供 0.5B~7B 端侧小尺寸',
      '与微信/QQ 生态结合紧密，落地场景多'
    ],
    apps: [
      { name: '腾讯元宝', date: '2024-05-30', from: '腾讯官方上线' },
      { name: 'ima 知识库', date: '2024-10', from: '腾讯官方' },
      { name: '微信 AI 搜索', date: '2025-01', from: '微信公开课' }
    ]
  },
  {
    id: 'ernie',
    name: '文心大模型 ERNIE 4.5',
    org: '百度',
    scale: '0.3B – 424B MoE',
    uses: ['通用对话', '多模态', '检索增强'],
    freeChannels: ['文心一言免费版', '百度千帆平台免费额度', 'Hugging Face（4.5 开源版）'],
    license: 'Apache-2.0（4.5 开源部分）',
    released: '2023-03 / 2025-06 开源',
    source: '百度世界大会 / 千帆平台',
    intro: '国内最早对公众开放的大模型产品，2025 年 6 月起 ERNIE 4.5 系列转向开源。',
    points: [
      '中文知识与检索增强是传统强项，与百度搜索深度绑定',
      '2025 年开源 4.5 系列共 10 款模型，含多模态版本',
      '千帆平台提供完整的模型微调与部署工具链',
      '闭源旗舰与开源版本并行的双轨策略'
    ],
    apps: [
      { name: '文心一言', date: '2023-03-16', from: '百度官方发布会' },
      { name: '文心一格（AI 绘画）', date: '2022-08', from: '百度飞桨' },
      { name: '百度文库 AI', date: '2023-11', from: '百度官方' }
    ]
  },
  {
    id: 'internlm',
    name: 'InternLM 书生·浦语',
    org: '上海人工智能实验室',
    scale: '1.8B / 7B / 8B / 20B',
    uses: ['通用对话', '推理', '长文本', '教学研究'],
    freeChannels: ['书生·浦语开放平台', 'Hugging Face', 'ModelScope', 'Ollama'],
    license: 'Apache-2.0',
    released: '2023-07 / 2025-01（InternLM3）',
    source: '上海 AI Lab 官方 GitHub',
    intro: '国家级实验室开源模型，配套 XTuner 微调、LMDeploy 部署、OpenCompass 评测全链路工具。',
    points: [
      '最适合入门学习：从数据、训练、微调、评测到部署有完整开源工具链',
      'OpenCompass 评测榜单是国内公认的第三方模型能力参考',
      '20B 以内的中等尺寸，单张消费级显卡即可微调',
      '书生系列还包含 InternVL（多模态）等分支'
    ],
    apps: [
      { name: '书生·浦语对话平台', date: '2023-09', from: '上海 AI Lab' },
      { name: 'OpenCompass 评测榜', date: '2023-08', from: '上海 AI Lab 开源' }
    ]
  },
  {
    id: 'yi',
    name: 'Yi-1.5 / Yi-Lightning',
    org: '零一万物',
    scale: '6B / 9B / 34B',
    uses: ['通用对话', '中英双语', '长文本'],
    freeChannels: ['零一万物开放平台赠额', 'Hugging Face', 'ModelScope'],
    license: 'Apache-2.0',
    released: '2023-11 / 2024-05',
    source: '零一万物官方 / Yi GitHub',
    intro: '中英双语能力均衡的开源模型，34B 尺寸在单卡部署场景中曾长期是热门选择。',
    points: [
      '34B 是「单张 A100 能跑、效果又够用」的经典甜点尺寸',
      '中英双语训练配比讲究，英文能力在国产模型中偏强',
      '开源社区微调版本多，适合作为垂直领域微调底座',
      'Yi-Lightning 为闭源高速版本，主打低延迟'
    ],
    apps: [
      { name: '万知（办公 AI）', date: '2024-05', from: '零一万物官方' },
      { name: 'PopAi（海外办公）', date: '2023-12', from: '零一万物出海产品' }
    ]
  },
  {
    id: 'spark',
    name: '星火大模型 Spark',
    org: '科大讯飞',
    scale: '未公开（闭源）',
    uses: ['通用对话', '语音识别', '语音合成', '教育'],
    freeChannels: ['讯飞星火 App 免费', '讯飞开放平台 Lite 版免费 API'],
    license: '闭源商用',
    released: '2023-05-06',
    source: '科大讯飞发布会',
    intro: '语音技术底子最深的国产模型，在教育、医疗、政务等 B 端场景落地较早。',
    points: [
      '讯飞开放平台的 Spark Lite 长期免费，适合做语音类小项目',
      '语音识别 / 合成 / 翻译能力是全栈自研，端到端体验完整',
      '全国产算力（华为昇腾）训练，供应链自主',
      '教育硬件（AI 学习机）是其最大商业化场景'
    ],
    apps: [
      { name: '讯飞星火 App', date: '2023-05-06', from: '科大讯飞发布会' },
      { name: '讯飞听见（转写）', date: '2016', from: '科大讯飞' },
      { name: '讯飞 AI 学习机', date: '2020', from: '科大讯飞硬件线' }
    ]
  }
]

/* ==================== 国外模型 ==================== */
export const GLOBAL_MODELS: KnowModel[] = [
  {
    id: 'gpt',
    name: 'GPT-5 / GPT-4o',
    org: 'OpenAI',
    scale: '未公开（闭源）',
    uses: ['通用对话', '多模态', '代码', '推理'],
    freeChannels: ['ChatGPT 免费档', 'Microsoft Copilot 免费', 'Poe 免费额度'],
    license: '闭源商用',
    released: '2024-05（4o）/ 2025-08（GPT-5）',
    source: 'OpenAI 官方博客',
    intro: '定义了现代大模型产品形态的系列，多模态实时交互与生态完整度目前仍是行业参考标准。',
    points: [
      'GPT-4o 首次把语音、图像、文本做成端到端统一模型，延迟接近真人对话',
      '函数调用 / 结构化输出 / Assistants API 等接口范式被全行业模仿',
      '闭源，只能通过 API 或产品使用，无法本地部署',
      'ChatGPT 免费档即可体验，是了解一线水平的最低成本方式'
    ],
    apps: [
      { name: 'ChatGPT', date: '2022-11-30', from: 'OpenAI 官方上线' },
      { name: 'Sora（视频生成）', date: '2024-02-15', from: 'OpenAI 预览发布' },
      { name: 'GPT Store', date: '2024-01-10', from: 'OpenAI 官方' }
    ]
  },
  {
    id: 'claude',
    name: 'Claude 4（Opus / Sonnet）',
    org: 'Anthropic',
    scale: '未公开（闭源）',
    uses: ['代码', '长文本', '智能体', '写作'],
    freeChannels: ['Claude.ai 免费档', 'Poe 免费额度'],
    license: '闭源商用',
    released: '2023-03 / 2025-05（Claude 4）',
    source: 'Anthropic 官方公告',
    intro: '以代码能力与长文本处理见长，是目前程序员群体口碑最好的闭源模型之一。',
    points: [
      'Artifacts 功能把模型输出变成可交互的代码/网页预览，产品创新明显',
      'MCP（模型上下文协议）由其提出，正在成为工具接入的事实标准',
      '「宪法 AI」训练方法强调安全对齐，拒答风格偏保守',
      '长上下文稳定性好，适合整份文档/整个仓库分析'
    ],
    apps: [
      { name: 'Claude（网页/App）', date: '2023-03-14', from: 'Anthropic 发布' },
      { name: 'Claude Code（命令行编程）', date: '2025-02', from: 'Anthropic 官方' }
    ]
  },
  {
    id: 'gemini',
    name: 'Gemini 2.5 Pro',
    org: 'Google DeepMind',
    scale: '未公开（闭源）',
    uses: ['多模态', '超长上下文', '推理', '代码'],
    freeChannels: ['Gemini 网页免费档', 'Google AI Studio 免费 API', 'NotebookLM 免费'],
    license: '闭源商用',
    released: '2023-12 / 2025-03（2.5 Pro）',
    source: 'Google DeepMind 官方博客',
    intro: '原生多模态设计，百万级上下文与 Google 生态整合是核心优势，AI Studio 提供慷慨免费额度。',
    points: [
      'Google AI Studio 提供免费 API Key，是学习者最容易拿到的一线模型额度',
      '原生支持视频输入，可直接理解长视频内容',
      '与搜索、Workspace、Android 深度整合，落地面最广',
      '1M~2M token 上下文，超长文档场景优势明显'
    ],
    apps: [
      { name: 'Gemini（原 Bard）', date: '2023-03-21', from: 'Google 发布，2023-12 更名' },
      { name: 'NotebookLM', date: '2023-07-12', from: 'Google Labs' },
      { name: 'Google AI Studio', date: '2023-12', from: 'Google 开发者平台' }
    ]
  },
  {
    id: 'llama',
    name: 'Llama 4 / Llama 3.x',
    org: 'Meta',
    scale: '1B – 400B（含 MoE）',
    uses: ['通用对话', '多模态', '端侧', '微调底座'],
    freeChannels: ['Hugging Face 权重下载', 'Ollama 本地部署', 'Groq 免费 API', 'OpenRouter'],
    license: 'Llama 社区许可（有条件商用）',
    released: '2023-02 / 2025-04（Llama 4）',
    source: 'Meta AI 官方博客',
    intro: '开源大模型生态的奠基者，绝大多数开源微调模型与推理框架都以它为第一适配对象。',
    points: [
      '生态最广：llama.cpp、Ollama、vLLM 等推理框架都优先支持',
      '1B/3B 端侧版本可在手机运行，是学习端侧部署的首选',
      '许可证并非标准开源，月活超 7 亿的产品需单独授权',
      'Llama 4 引入 MoE 与原生多模态，上下文最长可达千万级'
    ],
    apps: [
      { name: 'Meta AI 助手', date: '2024-04-18', from: 'Meta 官方' },
      { name: 'Ollama 本地模型', date: '2023-07', from: 'Ollama 开源项目' }
    ]
  },
  {
    id: 'mistral',
    name: 'Mistral Large / Mixtral',
    org: 'Mistral AI（法国）',
    scale: '7B / 8x7B / 8x22B / 123B',
    uses: ['通用对话', '代码', '欧洲多语种'],
    freeChannels: ['Mistral 平台免费档', 'Hugging Face 权重', 'Ollama'],
    license: 'Apache-2.0（开源系列）',
    released: '2023-09 / 2024-02',
    source: 'Mistral AI 官方',
    intro: '欧洲最具代表性的模型公司，Mixtral 是最早证明 MoE 架构可行性的开源模型之一。',
    points: [
      'Mistral 7B 是当年「小模型打大模型」的标志性作品，微调教程极多',
      'Mixtral 8x7B 让 MoE 稀疏架构在开源社区普及',
      'Apache-2.0 无附加限制，商用最省心',
      '欧洲语种（法/德/西/意）能力强于多数美系模型'
    ],
    apps: [
      { name: 'Le Chat', date: '2024-02-26', from: 'Mistral AI 官方' },
      { name: 'Codestral（代码模型）', date: '2024-05-29', from: 'Mistral AI' }
    ]
  },
  {
    id: 'gemma',
    name: 'Gemma 3',
    org: 'Google',
    scale: '1B / 4B / 12B / 27B',
    uses: ['端侧', '通用对话', '多模态', '微调'],
    freeChannels: ['Hugging Face', 'Ollama', 'Kaggle', 'Google AI Studio'],
    license: 'Gemma 使用条款（可商用）',
    released: '2024-02 / 2025-03（Gemma 3）',
    source: 'Google 开发者博客',
    intro: 'Gemini 同源技术的开源小模型，单卡甚至单张消费级显卡即可运行，端侧场景性价比高。',
    points: [
      '27B 版本可在单张 24G 显卡运行，是本地部署的性能上限甜点',
      'Gemma 3 加入视觉理解与 140+ 语言支持',
      '官方提供量化版本（QAT），显存需求进一步降低',
      '适合作为学习「如何在本地跑一个像样的模型」的入门对象'
    ],
    apps: [
      { name: 'Google AI Edge 端侧推理', date: '2024-05', from: 'Google 开发者大会' },
      { name: 'Ollama Gemma 系列', date: '2024-02', from: 'Ollama 模型库' }
    ]
  },
  {
    id: 'phi',
    name: 'Phi-4 系列',
    org: 'Microsoft Research',
    scale: '3.8B / 14B',
    uses: ['小模型推理', '数学', '端侧', '教学'],
    freeChannels: ['Hugging Face', 'Ollama', 'Azure AI Foundry 免费档'],
    license: 'MIT',
    released: '2023-06 / 2024-12（Phi-4）',
    source: 'Microsoft Research 论文',
    intro: '「小而精」的代表，用高质量合成数据训练，14B 尺寸在数学推理上能对标更大模型。',
    points: [
      '核心思路是「教科书级数据」而非堆量，训练数据质量优先',
      'MIT 协议完全自由，商用无门槛',
      '14B 在数学与逻辑基准上表现超过许多 70B 模型',
      '非常适合研究「数据质量 vs 参数规模」这一命题'
    ],
    apps: [
      { name: 'Windows Copilot Runtime', date: '2024-05-21', from: 'Microsoft Build' },
      { name: 'Azure AI Foundry', date: '2024-11', from: 'Microsoft Ignite' }
    ]
  },
  {
    id: 'grok',
    name: 'Grok 3 / Grok 4',
    org: 'xAI',
    scale: '未公开（闭源，Grok-1 已开源 314B）',
    uses: ['通用对话', '实时信息', '推理'],
    freeChannels: ['X 平台免费档', 'grok.com 有限免费'],
    license: '闭源（Grok-1 为 Apache-2.0）',
    released: '2023-11 / 2025',
    source: 'xAI 官方公告',
    intro: '与 X（原 Twitter）实时数据打通，强调对当下热点的即时掌握与相对宽松的对话风格。',
    points: [
      'Grok-1（314B MoE）曾以 Apache-2.0 开源，是当时最大的开源权重',
      '实时接入 X 平台数据，热点响应速度是差异化优势',
      '自建超算集群 Colossus，算力扩张速度受业界关注',
      '内容风格相对宽松，适合观察对齐策略的不同取向'
    ],
    apps: [
      { name: 'Grok（X 内置）', date: '2023-11-04', from: 'xAI 发布' },
      { name: 'Grok 独立 App', date: '2025-01', from: 'xAI 官方' }
    ]
  },
  {
    id: 'whisper',
    name: 'Whisper large-v3',
    org: 'OpenAI',
    scale: '1.5B',
    uses: ['语音识别', '语音翻译', '字幕生成'],
    freeChannels: ['Hugging Face 权重', 'faster-whisper 本地', 'Groq 免费 API'],
    license: 'MIT',
    released: '2022-09 / 2023-11（v3）',
    source: 'OpenAI 官方 GitHub',
    intro: '事实上的开源语音识别标准，支持 99 种语言，本地部署即可做出可用的字幕与转写工具。',
    points: [
      'MIT 协议 + 效果好，几乎所有开源字幕工具都基于它',
      'faster-whisper / whisper.cpp 等优化版可在 CPU 上实时转写',
      '中文识别准确率在开源方案中长期领先',
      '是「用开源模型做一个完整小产品」最容易上手的方向'
    ],
    apps: [
      { name: 'Whisper API', date: '2023-03-01', from: 'OpenAI 官方' },
      { name: 'whisper.cpp 本地推理', date: '2022-12', from: 'ggerganov 开源项目' }
    ]
  },
  {
    id: 'sd',
    name: 'Stable Diffusion 3.5 / FLUX',
    org: 'Stability AI / Black Forest Labs',
    scale: '2B – 12B',
    uses: ['文生图', '图生图', '设计创作'],
    freeChannels: ['Hugging Face 权重', 'ComfyUI 本地部署', 'Civitai 社区模型'],
    license: 'Stability 社区许可 / FLUX schnell 为 Apache-2.0',
    released: '2022-08 / 2024-08（FLUX）',
    source: 'Stability AI / BFL 官方',
    intro: '开源图像生成的两大主线，本地部署 + 社区微调模型（LoRA）构成了庞大的创作生态。',
    points: [
      'ComfyUI 工作流是学习图像生成流程（采样器、ControlNet、LoRA）的最佳入口',
      'Civitai 上有数万个社区微调模型，风格覆盖极广',
      'FLUX.1 schnell 为 Apache-2.0，商用完全自由',
      '本地部署对显卡有要求，8G 显存起步'
    ],
    apps: [
      { name: 'DreamStudio', date: '2022-08-22', from: 'Stability AI' },
      { name: 'ComfyUI', date: '2023-01', from: '开源社区项目' }
    ]
  },
  {
    id: 'command-r',
    name: 'Command R+',
    org: 'Cohere（加拿大）',
    scale: '104B',
    uses: ['RAG 检索增强', '工具调用', '企业问答'],
    freeChannels: ['Cohere 试用 Key（限速免费）', 'Hugging Face 权重（非商用）'],
    license: 'CC-BY-NC 4.0（研究用途）',
    released: '2024-04',
    source: 'Cohere 官方博客',
    intro: '专为检索增强生成（RAG）优化的模型，引用溯源能力是同期开源权重中做得最扎实的。',
    points: [
      '原生支持带引用的回答，能标出答案来自哪段原文',
      '多步工具调用能力设计完善，适合企业知识库场景',
      '权重开放但仅限非商业用途，商用需走 API',
      '想学 RAG 的引用与溯源实现，它是最好的参考对象'
    ],
    apps: [
      { name: 'Cohere Chat', date: '2023-07', from: 'Cohere 官方' },
      { name: 'Oracle / Notion 企业集成', date: '2024', from: 'Cohere 合作公告' }
    ]
  },
  {
    id: 'olmo',
    name: 'OLMo 2',
    org: 'Allen Institute for AI（AI2）',
    scale: '7B / 13B / 32B',
    uses: ['学术研究', '完全开源复现', '教学'],
    freeChannels: ['Hugging Face 权重 + 训练数据', 'Ollama'],
    license: 'Apache-2.0',
    released: '2024-02 / 2024-11（OLMo 2）',
    source: 'AI2 官方论文与 GitHub',
    intro: '唯一把训练数据、代码、中间检查点全部公开的大模型，研究与教学价值远大于实用性能。',
    points: [
      '「真开源」：数据集 Dolma、训练代码、每个 checkpoint 全部公开',
      '想搞清楚大模型到底是怎么训出来的，这是唯一可完整复现的样本',
      '性能不如同尺寸商业模型，但透明度无可替代',
      '配套 Tulu 指令微调数据集，可学习完整对齐流程'
    ],
    apps: [
      { name: 'OLMo Playground', date: '2024-02-01', from: 'AI2 官方' },
      { name: 'Dolma 开源数据集', date: '2023-08', from: 'AI2 发布' }
    ]
  }
]

/* ==================== 国内应用 ==================== */
export const CN_APPS: KnowApp[] = [
  {
    id: 'tongyi', name: '通义千问', vendor: '阿里巴巴', cat: 'chat', released: '2023-04-11',
    source: '阿里云峰会发布', site: 'https://tongyi.aliyun.com', modelId: 'qwen3',
    intro: '阿里官方 AI 助手，覆盖对话、文档解析、PPT 生成、会议纪要、翻译等场景，网页与 App 双端免费。',
    freeNote: '基础功能完全免费，文档与音视频解析有每日次数限制。',
    timeline: [
      { date: '2023-04-11', event: '阿里云峰会首次亮相' },
      { date: '2023-09-13', event: '通过备案向全社会开放' },
      { date: '2024-06', event: '升级 Qwen2 底座，开放长文档解析' }
    ]
  },
  {
    id: 'doubao-app', name: '豆包', vendor: '字节跳动', cat: 'chat', released: '2023-08-17',
    source: '字节跳动官方上线', site: 'https://www.doubao.com', modelId: 'doubao',
    intro: '字节旗下 C 端 AI 助手，主打聊天、写作、AI 通话与视频通话，用户量位居国内前列。',
    freeNote: '全部核心功能免费，无次数限制。',
    timeline: [
      { date: '2023-08-17', event: '以「Grace」项目上线，后更名豆包' },
      { date: '2024-05-15', event: '豆包大模型正式发布并大幅降价' },
      { date: '2025', event: '接入视频通话与实时语音' }
    ]
  },
  {
    id: 'kimi-app', name: 'Kimi 智能助手', vendor: '月之暗面', cat: 'chat', released: '2023-10-09',
    source: '月之暗面官方发布', site: 'https://kimi.moonshot.cn', modelId: 'kimi-k2',
    intro: '以超长上下文起家的 AI 助手，可一次读完整本书或数十份 PDF，学术与资料整理场景口碑好。',
    freeNote: '网页与 App 免费使用，高峰期可能排队。',
    timeline: [
      { date: '2023-10-09', event: '支持 20 万字上下文上线' },
      { date: '2024-03-18', event: '升级至 200 万字无损上下文' },
      { date: '2024-10-10', event: '发布探索版，支持自主搜索推理' }
    ]
  },
  {
    id: 'deepseek-app', name: 'DeepSeek', vendor: '深度求索', cat: 'chat', released: '2025-01-11',
    source: 'DeepSeek 官方上线公告', site: 'https://chat.deepseek.com', modelId: 'deepseek-r1',
    intro: '开源推理模型 R1 的官方入口，可查看完整思考过程，是理解「模型如何推理」的直观窗口。',
    freeNote: '网页与 App 完全免费，含深度思考与联网搜索。',
    timeline: [
      { date: '2025-01-11', event: 'App 上线各大应用商店' },
      { date: '2025-01-20', event: 'R1 深度思考模式开放' },
      { date: '2025-01', event: '登顶多国应用商店免费榜' }
    ]
  },
  {
    id: 'chatglm', name: '智谱清言', vendor: '智谱 AI', cat: 'chat', released: '2023-08-31',
    source: '智谱 AI 官方发布', site: 'https://chatglm.cn', modelId: 'glm4',
    intro: '清华系模型的 C 端产品，内置数据分析、绘图、联网、文档解析等工具，智能体生态较完整。',
    freeNote: '基础对话免费，高级模型有额度限制。',
    timeline: [
      { date: '2023-08-31', event: '首批通过备案上线' },
      { date: '2024-01', event: '上线 GLMs 智能体商店' },
      { date: '2024-10-25', event: '发布 AutoGLM 手机自动操作' }
    ]
  },
  {
    id: 'yuanbao', name: '腾讯元宝', vendor: '腾讯', cat: 'chat', released: '2024-05-30',
    source: '腾讯官方上线', site: 'https://yuanbao.tencent.com', modelId: 'hunyuan',
    intro: '腾讯 AI 助手，可同时选择混元与 DeepSeek 双模型，深度整合微信公众号内容检索。',
    freeNote: '免费使用，含联网搜索与文档解析。',
    timeline: [
      { date: '2024-05-30', event: '正式上线' },
      { date: '2025-02', event: '接入 DeepSeek-R1，支持双模型切换' }
    ]
  },
  {
    id: 'wenxin', name: '文心一言', vendor: '百度', cat: 'chat', released: '2023-03-16',
    source: '百度官方发布会', site: 'https://yiyan.baidu.com', modelId: 'ernie',
    intro: '国内首个面向公众开放的大模型产品，与百度搜索、文库、网盘等生态深度打通。',
    freeNote: '基础版免费，旗舰模型需订阅。',
    timeline: [
      { date: '2023-03-16', event: '国内首个大模型产品发布' },
      { date: '2023-08-31', event: '全面开放注册' },
      { date: '2025-04', event: '文心 4.5 / X1 免费开放' }
    ]
  },
  {
    id: 'lingma', name: '通义灵码', vendor: '阿里巴巴', cat: 'code', released: '2023-10-31',
    source: '云栖大会发布', site: 'https://lingma.aliyun.com', modelId: 'qwen3',
    intro: '基于 Qwen-Coder 的编程助手，支持行级补全、单元测试生成、代码解释与仓库级问答。',
    freeNote: '个人版长期免费，支持 VS Code / JetBrains。',
    timeline: [
      { date: '2023-10-31', event: '云栖大会发布' },
      { date: '2024-06', event: '支持企业级代码库检索增强' },
      { date: '2025', event: '升级 Agent 模式，可自主改多文件' }
    ]
  },
  {
    id: 'codegeex', name: 'CodeGeeX', vendor: '智谱 AI / 清华 KEG', cat: 'code', released: '2022-09',
    source: '清华 KEG 实验室开源', site: 'https://codegeex.cn', modelId: 'glm4',
    intro: '国内最早开源的代码大模型与插件，支持多语言补全、翻译与注释生成。',
    freeNote: '插件免费，模型权重开源可自部署。',
    timeline: [
      { date: '2022-09', event: '开源 13B 代码模型' },
      { date: '2023-07', event: 'CodeGeeX2 发布，性能大幅提升' },
      { date: '2024', event: '升级至 GLM-4 底座' }
    ]
  },
  {
    id: 'trae', name: 'Trae', vendor: '字节跳动', cat: 'code', released: '2025-01',
    source: '字节跳动官方发布', site: 'https://www.trae.ai', modelId: 'doubao',
    intro: '字节推出的 AI 原生 IDE，支持自然语言直接构建项目，Builder 模式可自动完成多文件改动。',
    freeNote: '当前免费，内置模型免费调用。',
    timeline: [
      { date: '2025-01', event: '海外版发布' },
      { date: '2025-03', event: '国内版上线，接入豆包与 DeepSeek' }
    ]
  },
  {
    id: 'jimeng', name: '即梦 AI', vendor: '字节跳动（剪映团队）', cat: 'image', released: '2023-08',
    source: '剪映团队产品线', site: 'https://jimeng.jianying.com', modelId: 'doubao',
    intro: '一站式 AI 创作工具，涵盖文生图、图生视频、智能画布与数字人，与剪映工作流打通。',
    freeNote: '每日赠送积分，基础生成免费。',
    timeline: [
      { date: '2023-08', event: '以 Dreamina 名义上线' },
      { date: '2024-05', event: '更名即梦，加入视频生成' },
      { date: '2025', event: '接入 Seedance 视频模型' }
    ]
  },
  {
    id: 'kling', name: '可灵 AI', vendor: '快手', cat: 'video', released: '2024-06-06',
    source: '快手官方发布', site: 'https://klingai.kuaishou.com',
    intro: '国内最早对公众开放的高质量视频生成产品，支持文生视频、图生视频与首尾帧控制。',
    freeNote: '每日赠送免费积分，高清与长视频需付费。',
    timeline: [
      { date: '2024-06-06', event: '内测上线，引发国内视频生成热潮' },
      { date: '2024-07-24', event: '面向全球开放' },
      { date: '2025', event: '可灵 2.0 发布，画质与一致性提升' }
    ]
  },
  {
    id: 'hailuo', name: '海螺 AI', vendor: 'MiniMax', cat: 'video', released: '2024-09',
    source: 'MiniMax 官方', site: 'https://hailuoai.com', modelId: 'minimax-m1',
    intro: '集对话、语音、视频生成于一体的产品，其视频生成在动态镜头表现上口碑较好。',
    freeNote: '每日免费额度，视频生成按次消耗。',
    timeline: [
      { date: '2024-09', event: '视频生成功能上线' },
      { date: '2024-10', event: '海外版 Hailuo AI 全球开放' }
    ]
  },
  {
    id: 'wanxiang', name: '通义万相', vendor: '阿里巴巴', cat: 'image', released: '2023-07',
    source: '阿里云官方', site: 'https://tongyi.aliyun.com/wanxiang', modelId: 'qwen3',
    intro: '阿里的图像与视频生成平台，Wan 系列视频模型已开源，可本地部署。',
    freeNote: '每日免费额度；Wan 开源权重可自行部署，完全免费。',
    timeline: [
      { date: '2023-07', event: '文生图上线' },
      { date: '2025-02', event: 'Wan 2.1 视频模型开源' }
    ]
  },
  {
    id: 'xunfei-tingjian', name: '讯飞听见', vendor: '科大讯飞', cat: 'audio', released: '2016',
    source: '科大讯飞产品线', site: 'https://www.iflyrec.com', modelId: 'spark',
    intro: '语音转写与会议记录工具，支持实时字幕、多语种翻译与说话人分离。',
    freeNote: '每月赠送免费转写时长，超出按量付费。',
    timeline: [
      { date: '2016', event: '产品上线' },
      { date: '2023-05', event: '接入星火大模型，支持智能摘要' }
    ]
  },
  {
    id: 'metaso', name: '秘塔 AI 搜索', vendor: '秘塔科技', cat: 'search', released: '2024-03',
    source: '秘塔科技官方', site: 'https://metaso.cn',
    intro: '无广告的 AI 搜索引擎，自动生成带引用的结构化答案与思维导图，学术检索场景好用。',
    freeNote: '完全免费，无广告。',
    timeline: [
      { date: '2024-03', event: 'AI 搜索上线' },
      { date: '2024-06', event: '加入学术模式与脑图输出' }
    ]
  },
  {
    id: 'nano-ai', name: '纳米 AI 搜索', vendor: '360', cat: 'search', released: '2024-06',
    source: '360 官方发布', site: 'https://www.n.cn',
    intro: '360 推出的多模型 AI 搜索，可同时调用多个大模型交叉验证答案，支持慢思考模式。',
    freeNote: '免费使用。',
    timeline: [
      { date: '2024-06', event: '以「360AI 搜索」上线' },
      { date: '2024-11', event: '更名纳米 AI，支持多模型协同' }
    ]
  },
  {
    id: 'coze', name: '扣子 Coze', vendor: '字节跳动', cat: 'agent', released: '2024-02',
    source: '字节跳动官方', site: 'https://www.coze.cn', modelId: 'doubao',
    intro: '零代码智能体开发平台，可拖拽编排工作流、挂知识库与插件，一键发布到多个渠道。',
    freeNote: '个人开发免费，含免费模型额度。',
    timeline: [
      { date: '2024-02', event: '国内版上线' },
      { date: '2024-05', event: '支持工作流与多智能体编排' },
      { date: '2025-07', event: '核心引擎开源' }
    ]
  },
  {
    id: 'ima', name: 'ima 知识库', vendor: '腾讯', cat: 'study', released: '2024-10',
    source: '腾讯官方发布', site: 'https://ima.qq.com', modelId: 'hunyuan',
    intro: '个人知识管理工具，可收藏网页、导入文档建立知识库，并基于公众号内容做检索问答。',
    freeNote: '免费使用。',
    timeline: [
      { date: '2024-10', event: '内测上线' },
      { date: '2025-01', event: '支持共享知识库与微信生态检索' }
    ]
  },
  {
    id: 'wps-ai', name: 'WPS AI', vendor: '金山办公', cat: 'office', released: '2023-04',
    source: '金山办公发布会', site: 'https://ai.wps.cn',
    intro: '国内首个嵌入办公套件的大模型能力，支持文档生成、表格公式、PPT 一键成稿。',
    freeNote: '部分能力免费体验，深度使用需会员。',
    timeline: [
      { date: '2023-04', event: '首次演示' },
      { date: '2023-11', event: '面向公众开放' },
      { date: '2024', event: 'WPS AI 2.0 支持知识库问答' }
    ]
  },
  {
    id: 'xingye', name: '星野 / 猫箱', vendor: 'MiniMax / 字节跳动', cat: 'role', released: '2022-09',
    source: '各厂商官方产品线', site: 'https://www.xingyeai.com', modelId: 'minimax-m1',
    intro: 'AI 角色扮演与陪伴类产品代表，可自定义人设、语音与剧情走向，年轻用户占比高。',
    freeNote: '基础对话免费，语音与高级人设有额度。',
    timeline: [
      { date: '2022-09', event: 'Glow（星野前身）上线' },
      { date: '2023-09', event: '星野正式发布' },
      { date: '2024', event: '猫箱等同类产品跟进' }
    ]
  },
  {
    id: 'xinghuo-app', name: '讯飞星火', vendor: '科大讯飞', cat: 'study', released: '2023-05-06',
    source: '科大讯飞发布会', site: 'https://xinghuo.xfyun.cn', modelId: 'spark',
    intro: '偏教育与办公场景的 AI 助手，语音交互、作文批改、口语陪练是特色能力。',
    freeNote: '免费使用，开放平台提供 Lite 免费 API。',
    timeline: [
      { date: '2023-05-06', event: '发布会正式亮相' },
      { date: '2024-06', event: '星火 4.0 发布' },
      { date: '2025', event: '全国产算力训练版本上线' }
    ]
  }
]

/* ==================== 国外应用 ==================== */
export const GLOBAL_APPS: KnowApp[] = [
  {
    id: 'chatgpt', name: 'ChatGPT', vendor: 'OpenAI', cat: 'chat', released: '2022-11-30',
    source: 'OpenAI 官方上线', site: 'https://chat.openai.com', modelId: 'gpt',
    intro: '引爆全球生成式 AI 浪潮的产品，两个月破亿用户，定义了对话式 AI 的交互范式。',
    freeNote: '免费档可用主力模型，有速率限制。',
    timeline: [
      { date: '2022-11-30', event: '以研究预览形式上线' },
      { date: '2023-03-14', event: 'GPT-4 发布' },
      { date: '2024-05-13', event: 'GPT-4o 实时语音发布' }
    ]
  },
  {
    id: 'claude-app', name: 'Claude', vendor: 'Anthropic', cat: 'chat', released: '2023-03-14',
    source: 'Anthropic 官方发布', site: 'https://claude.ai', modelId: 'claude',
    intro: '以长文本与代码见长的 AI 助手，Artifacts 可把回答直接渲染成可运行的网页或图表。',
    freeNote: '免费档每日有对话额度。',
    timeline: [
      { date: '2023-03-14', event: 'Claude 首次发布' },
      { date: '2024-06-20', event: 'Artifacts 功能上线' },
      { date: '2024-11', event: 'MCP 协议开源' }
    ]
  },
  {
    id: 'gemini-app', name: 'Gemini', vendor: 'Google', cat: 'chat', released: '2023-03-21',
    source: 'Google 官方（原 Bard）', site: 'https://gemini.google.com', modelId: 'gemini',
    intro: 'Google 的 AI 助手，深度整合搜索、Gmail、Docs 与 Android，多模态与超长上下文是强项。',
    freeNote: '免费档可用，AI Studio 另提供免费 API Key。',
    timeline: [
      { date: '2023-03-21', event: '以 Bard 名义发布' },
      { date: '2023-12-06', event: 'Gemini 模型发布并更名' },
      { date: '2025-03', event: 'Gemini 2.5 Pro 推理模型上线' }
    ]
  },
  {
    id: 'copilot-ms', name: 'Microsoft Copilot', vendor: 'Microsoft', cat: 'office', released: '2023-02-07',
    source: 'Microsoft 官方发布', site: 'https://copilot.microsoft.com', modelId: 'gpt',
    intro: '嵌入 Windows 与 Office 全家桶的 AI 助手，可在 Word、Excel、PowerPoint 内直接生成内容。',
    freeNote: '网页版与 Windows 内置免费；Office 内嵌需订阅。',
    timeline: [
      { date: '2023-02-07', event: '新必应集成 GPT-4' },
      { date: '2023-11-01', event: 'Microsoft 365 Copilot 商用' },
      { date: '2024-05-21', event: 'Copilot+ PC 端侧 AI 发布' }
    ]
  },
  {
    id: 'github-copilot', name: 'GitHub Copilot', vendor: 'GitHub / Microsoft', cat: 'code', released: '2021-06-29',
    source: 'GitHub 官方博客', site: 'https://github.com/features/copilot', modelId: 'gpt',
    intro: '最早规模化落地的 AI 编程助手，从行级补全发展到 Agent 模式自动完成完整任务。',
    freeNote: '学生与开源维护者免费；2024 年底起提供个人免费档。',
    timeline: [
      { date: '2021-06-29', event: '技术预览发布' },
      { date: '2023-03', event: 'Copilot Chat 发布' },
      { date: '2024-12', event: '推出免费档，每月限量补全' }
    ]
  },
  {
    id: 'cursor', name: 'Cursor', vendor: 'Anysphere', cat: 'code', released: '2023-03',
    source: 'Anysphere 官方', site: 'https://cursor.com', modelId: 'claude',
    intro: 'AI 原生代码编辑器，基于 VS Code 二次开发，Composer 模式可跨文件自动重构。',
    freeNote: '免费档每月有限次高级模型请求。',
    timeline: [
      { date: '2023-03', event: '首个版本发布' },
      { date: '2024-08', event: 'Composer 多文件编辑上线' },
      { date: '2025', event: 'Agent 模式支持自主执行终端命令' }
    ]
  },
  {
    id: 'midjourney', name: 'Midjourney', vendor: 'Midjourney Inc.', cat: 'image', released: '2022-07-12',
    source: 'Midjourney 官方', site: 'https://midjourney.com',
    intro: '以审美质量著称的图像生成服务，早期通过 Discord 使用，现已推出独立网页版。',
    freeNote: '需付费订阅，免费试用已取消。',
    timeline: [
      { date: '2022-07-12', event: '公开测试版发布' },
      { date: '2023-03', event: 'V5 发布，写实度大幅提升' },
      { date: '2024-08', event: '网页版全面开放' }
    ]
  },
  {
    id: 'sora', name: 'Sora', vendor: 'OpenAI', cat: 'video', released: '2024-02-15',
    source: 'OpenAI 官方预览', site: 'https://sora.com', modelId: 'gpt',
    intro: 'OpenAI 的视频生成模型与产品，2024 年 2 月的演示视频重新定义了行业对视频生成的预期。',
    freeNote: '需 ChatGPT Plus/Pro 订阅。',
    timeline: [
      { date: '2024-02-15', event: '技术预览公布，引发全球关注' },
      { date: '2024-12-09', event: '正式面向订阅用户开放' }
    ]
  },
  {
    id: 'runway', name: 'Runway', vendor: 'Runway AI', cat: 'video', released: '2023-02',
    source: 'Runway 官方', site: 'https://runwayml.com',
    intro: '面向专业创作者的 AI 视频工具，Gen 系列模型支持文生视频、视频风格迁移与运动笔刷。',
    freeNote: '注册赠送一次性额度，持续使用需订阅。',
    timeline: [
      { date: '2023-02', event: 'Gen-1 视频到视频发布' },
      { date: '2023-06', event: 'Gen-2 文生视频开放' },
      { date: '2024-06', event: 'Gen-3 Alpha 发布' }
    ]
  },
  {
    id: 'elevenlabs', name: 'ElevenLabs', vendor: 'ElevenLabs', cat: 'audio', released: '2023-01',
    source: 'ElevenLabs 官方', site: 'https://elevenlabs.io',
    intro: '语音合成与克隆的标杆产品，情感表现与多语种自然度领先，广泛用于有声书与配音。',
    freeNote: '免费档每月赠送一定字符数。',
    timeline: [
      { date: '2023-01', event: 'Beta 版上线' },
      { date: '2023-08', event: '支持 29 种语言' },
      { date: '2024', event: '推出配音工作室与音效生成' }
    ]
  },
  {
    id: 'perplexity', name: 'Perplexity', vendor: 'Perplexity AI', cat: 'search', released: '2022-12',
    source: 'Perplexity 官方', site: 'https://perplexity.ai',
    intro: 'AI 搜索引擎的代表产品，答案带来源引用，Pro 搜索支持多轮追问式深度检索。',
    freeNote: '免费档可用基础搜索，Pro 搜索每日限次。',
    timeline: [
      { date: '2022-12', event: '产品上线' },
      { date: '2024-04', event: '推出 Pages 研究报告功能' },
      { date: '2024-12', event: '推出购物与金融检索' }
    ]
  },
  {
    id: 'notebooklm', name: 'NotebookLM', vendor: 'Google', cat: 'study', released: '2023-07-12',
    source: 'Google Labs 发布', site: 'https://notebooklm.google.com', modelId: 'gemini',
    intro: '基于自有资料的 AI 笔记工具，可把上传的文档一键生成双人播客音频，学习场景极受欢迎。',
    freeNote: '完全免费，有每日生成次数限制。',
    timeline: [
      { date: '2023-07-12', event: '以 Project Tailwind 名义发布' },
      { date: '2024-09-11', event: 'Audio Overview 播客功能上线' },
      { date: '2025', event: '支持中文播客与思维导图' }
    ]
  },
  {
    id: 'notion-ai', name: 'Notion AI', vendor: 'Notion Labs', cat: 'office', released: '2023-02-22',
    source: 'Notion 官方发布', site: 'https://notion.so/product/ai',
    intro: '嵌入 Notion 工作区的 AI 能力，可自动整理会议纪要、生成表格、跨页面检索问答。',
    freeNote: '需额外订阅 AI 套餐。',
    timeline: [
      { date: '2023-02-22', event: '正式发布' },
      { date: '2024-06', event: '推出 Q&A 全局问答' },
      { date: '2025', event: '整合企业级搜索' }
    ]
  },
  {
    id: 'hf', name: 'Hugging Face', vendor: 'Hugging Face', cat: 'agent', released: '2016',
    source: 'Hugging Face 官方', site: 'https://huggingface.co',
    intro: '全球最大的开源模型社区与托管平台，模型、数据集、Spaces 演示应用一站式获取。',
    freeNote: '模型下载、Spaces 部署与推理 API 均有免费额度。',
    timeline: [
      { date: '2016', event: '公司成立，最初做聊天机器人' },
      { date: '2018', event: 'Transformers 库开源' },
      { date: '2021-10', event: 'Spaces 演示托管上线' }
    ]
  },
  {
    id: 'grok-app', name: 'Grok', vendor: 'xAI', cat: 'chat', released: '2023-11-04',
    source: 'xAI 官方发布', site: 'https://grok.com', modelId: 'grok',
    intro: '与 X 平台实时数据打通的 AI 助手，热点事件响应快，回答风格相对直接。',
    freeNote: 'X 平台内提供有限免费额度。',
    timeline: [
      { date: '2023-11-04', event: '面向 X Premium+ 用户发布' },
      { date: '2024-03-17', event: 'Grok-1 权重开源' },
      { date: '2025-01', event: '独立 App 上线' }
    ]
  },
  {
    id: 'character-ai', name: 'Character.AI', vendor: 'Character Technologies', cat: 'role', released: '2022-09',
    source: 'Character.AI 官方', site: 'https://character.ai',
    intro: 'AI 角色扮演的开创性产品，用户可创建并分享角色，青少年用户活跃度极高。',
    freeNote: '免费使用，付费档去排队。',
    timeline: [
      { date: '2022-09', event: '公测上线' },
      { date: '2023-05', event: '移动端 App 发布，首周破百万下载' },
      { date: '2024-08', event: '核心团队加入 Google' }
    ]
  },
  {
    id: 'ollama', name: 'Ollama', vendor: 'Ollama（开源）', cat: 'code', released: '2023-07',
    source: 'Ollama 开源项目', site: 'https://ollama.com', modelId: 'llama',
    intro: '一条命令在本地运行开源大模型的工具，是学习本地部署与隐私优先方案的首选入口。',
    freeNote: '完全免费开源，模型全部本地运行、零 API 费用。',
    timeline: [
      { date: '2023-07', event: 'macOS 版首发' },
      { date: '2024-02', event: 'Windows 版发布' },
      { date: '2024-07', event: '兼容 OpenAI API 格式' }
    ]
  },
  {
    id: 'comfyui', name: 'ComfyUI', vendor: 'Comfy Org（开源）', cat: 'image', released: '2023-01',
    source: '开源社区项目', site: 'https://comfy.org', modelId: 'sd',
    intro: '节点式图像生成工作流工具，可精细控制采样、ControlNet 与 LoRA，是进阶创作者标配。',
    freeNote: '完全免费开源，本地运行不消耗任何额度。',
    timeline: [
      { date: '2023-01', event: '项目开源' },
      { date: '2024', event: '成立 Comfy Org，推出桌面版' },
      { date: '2025', event: '原生支持视频与 3D 生成节点' }
    ]
  },
  {
    id: 'poe', name: 'Poe', vendor: 'Quora', cat: 'chat', released: '2022-12',
    source: 'Quora 官方发布', site: 'https://poe.com',
    intro: '多模型聚合平台，一个界面可切换 GPT、Claude、Gemini 等数十个模型，便于横向对比。',
    freeNote: '免费档每日赠送积分，可体验多个一线模型。',
    timeline: [
      { date: '2022-12', event: 'iOS 版率先上线' },
      { date: '2023-02', event: '全平台开放' },
      { date: '2023-10', event: '支持自定义机器人与创作者分成' }
    ]
  },
  {
    id: 'openrouter', name: 'OpenRouter', vendor: 'OpenRouter', cat: 'agent', released: '2023-05',
    source: 'OpenRouter 官方', site: 'https://openrouter.ai',
    intro: '统一 API 网关，一个 Key 调用数百个模型，含多个长期免费的开源模型端点。',
    freeNote: '提供多个 :free 后缀的免费模型端点，适合学习与小项目。',
    timeline: [
      { date: '2023-05', event: '平台上线' },
      { date: '2024', event: '免费模型端点大幅扩充' },
      { date: '2025', event: '成为开源模型调用的主要入口之一' }
    ]
  }
]

/** 统计：各模块条目数（用于入口卡动态角标） */
export function knowledgeCounts(): Record<string, number> {
  return {
    cnModel: CN_MODELS.length,
    globalModel: GLOBAL_MODELS.length,
    cnApp: CN_APPS.length,
    globalApp: GLOBAL_APPS.length
  }
}
