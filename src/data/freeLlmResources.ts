// 免费大模型资源清单（全程免费：无需信用卡、不消耗积分/额度）
// 仅收录「真·免费」条目：永久免费层 / 每月自动刷新的免费额度 / 完全免费开源。
// 数据由 WebSearch 每日检索更新（见自动化任务），lastChecked 为最近核查日期。

export type FreeResourceCategory = 'api' | 'eval' | 'learn'

export interface FreeResource {
  id: string
  name: string
  category: FreeResourceCategory
  /** 免费说明：额度 / 是否需信用卡 / 限制 */
  freeNote: string
  url: string
  /** 最近核查日期 YYYY-MM-DD */
  lastChecked: string
  tags?: string[]
}

export const FREE_RESOURCE_CATEGORY_LABEL: Record<FreeResourceCategory, string> = {
  api: '免费调用 API',
  eval: '评测 / 信息查询平台',
  learn: '免费学习资源'
}

export const FREE_LLM_RESOURCES: FreeResource[] = [
  /* ===================== 免费调用 API ===================== */
  {
    id: 'google-ai-studio',
    name: 'Google AI Studio（Gemini）',
    category: 'api',
    freeNote: '永久免费层，无需信用卡。Gemini 3.6/3.5 Flash + Gemma，1M 上下文、多模态，约 10 RPM / 250 RPD（Flash）。（Gemini Pro 系列自 2026-04 起已移除免费层。）',
    url: 'https://aistudio.google.com',
    lastChecked: '2026-08-15',
    tags: ['Gemini', '多模态', '无需信用卡']
  },
  {
    id: 'groq',
    name: 'Groq',
    category: 'api',
    freeNote: '开发者免费层，无需信用卡。LPU 极速推理，约 30 RPM：Llama、Qwen、DeepSeek、Whisper 等。',
    url: 'https://console.groq.com',
    lastChecked: '2026-08-02',
    tags: ['极速推理', 'Llama', '无需信用卡']
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    category: 'api',
    freeNote: '免费模型标 :free，无需信用卡即可开始。单 key 汇聚 35+ 免费模型，约 50–200 RPD。',
    url: 'https://openrouter.ai',
    lastChecked: '2026-08-15',
    tags: ['聚合', 'OpenAI 兼容', '无需信用卡']
  },
  {
    id: 'nvidia-nim',
    name: 'NVIDIA NIM',
    category: 'api',
    freeNote: '循环免费层，约 40 RPM 且无每日上限。DeepSeek、Llama、Qwen、Nemotron 等，需手机验证。',
    url: 'https://build.nvidia.com',
    lastChecked: '2026-08-15',
    tags: ['无日上限', '开源权重', '需手机验证']
  },
  {
    id: 'cloudflare-workers-ai',
    name: 'Cloudflare Workers AI',
    category: 'api',
    freeNote: '每日 10,000 Neurons 免费，无需信用卡。Llama、Qwen、Mistral、GLM 及图像模型。',
    url: 'https://developers.cloudflare.com/workers-ai/',
    lastChecked: '2026-08-02',
    tags: ['边缘推理', '无需信用卡']
  },
  {
    id: 'mistral',
    name: 'Mistral AI',
    category: 'api',
    freeNote: '免费「Experiment」层，无需信用卡（需手机号验证）。约 10 亿 tokens/月（~1 RPS / 500K TPM），Large / Medium / Small / Codestral / Devstral 全模型可用。',
    url: 'https://mistral.ai',
    lastChecked: '2026-08-11',
    tags: ['欧洲', '代码模型', '无需信用卡']
  },
  {
    id: 'huggingface-inference',
    name: 'Hugging Face Inference API',
    category: 'api',
    freeNote: '数千开源模型经统一 OpenAI 兼容端点免费调用，无需信用卡。共享配额约 300 次/小时。平台亦托管 Meta Muse Glimmer、Kimi K3 等最新 Apache 2.0 开源权重，可免费下载自部署。',
    url: 'https://huggingface.co',
    lastChecked: '2026-08-11',
    tags: ['模型最全', '开源', '无需信用卡']
  },
  {
    id: 'cerebras',
    name: 'Cerebras',
    category: 'api',
    freeNote: '约 1,000,000 tokens/天 免费，无需信用卡。GPT-OSS、GLM 等，破纪录硬件推理。',
    url: 'https://cerebras.ai',
    lastChecked: '2026-08-02',
    tags: ['大上下文', '无需信用卡']
  },
  {
    id: 'cohere',
    name: 'Cohere',
    category: 'api',
    freeNote: '免费试用 key，约 1,000 次/月，无需信用卡（开发/评测）。Command / Aya / rerank / embed。',
    url: 'https://cohere.com',
    lastChecked: '2026-08-02',
    tags: ['Rerank', 'Embed', '无需信用卡']
  },
  {
    id: 'zai-glm',
    name: 'Z.ai（智谱 GLM）',
    category: 'api',
    freeNote: '国际端点免费 GLM Flash 模型，无需中国手机号。GLM-4.5/4.6/4.7 Flash。',
    url: 'https://z.ai',
    lastChecked: '2026-08-02',
    tags: ['GLM', '无需手机号', '无需信用卡']
  },
  {
    id: 'siliconflow',
    name: '硅基流动 SiliconFlow',
    category: 'api',
    freeNote: '免费额度层，无需信用卡，国内直连友好。DeepSeek、Qwen 等，OpenAI 兼容。',
    url: 'https://siliconflow.cn',
    lastChecked: '2026-08-02',
    tags: ['国内可用', '无需信用卡']
  },
  {
    id: 'github-models',
    name: 'GitHub Models',
    category: 'api',
    freeNote: '用 GitHub 个人令牌免费调用 GPT-5 / GPT-4.1 / o3 / Llama 等（限额随 Copilot 档位），无需信用卡，需 GitHub 账号。',
    url: 'https://github.com/marketplace/models',
    lastChecked: '2026-08-15',
    tags: ['GPT', '开源友好', '无需信用卡']
  },
  {
    id: 'deepseek',
    name: 'DeepSeek 官方 API',
    category: 'api',
    freeNote: '官方提供免费调用额度，无需信用卡。DeepSeek-V4 / V3-Lite（永久免费不限量）/ R1 等；网页端 chat.deepseek.com 永久免费。',
    url: 'https://platform.deepseek.com',
    lastChecked: '2026-08-11',
    tags: ['推理', '无需信用卡']
  },
  {
    id: 'aliyun-bailian',
    name: '阿里云百炼（通义千问 DashScope）',
    category: 'api',
    freeNote: '新用户赠免费额度（千万级 tokens，无需绑卡），Qwen 系列可免费调用；实名认证后可用，国内直连友好，OpenAI 兼容。',
    url: 'https://bailian.console.aliyun.com',
    lastChecked: '2026-08-11',
    tags: ['国内可用', 'Qwen', '无需信用卡']
  },
  {
    id: 'scnet-llm',
    name: '国家超算互联网（SCNet）',
    category: 'api',
    freeNote: '国家级公共算力平台，2026-08-02 起免费开放 DeepSeek-V4-Flash-0731 等大模型 API 调用，无需信用卡。聚合 1700+ 开源模型（DeepSeek / GLM / Qwen / Kimi / MiniMax），MaaS 统一入口一键调用，适配政企与国内开发者。',
    url: 'https://www.scnet.cn/ui/console/index.html#/llm/models',
    lastChecked: '2026-08-11',
    tags: ['国内可用', '国家级算力', '无需信用卡']
  },
  {
    id: 'ovhcloud-ai-endpoints',
    name: 'OVHcloud AI Endpoints',
    category: 'api',
    freeNote: '永久免费层，无需信用卡；匿名层连账号都不用（约 2 RPM）。欧盟数据中心（GDPR 合规），托管 Qwen3-Coder / Mistral / Llama / DeepSeek 等开源模型，OpenAI 兼容。',
    url: 'https://endpoints.ai.cloud.ovh.net',
    lastChecked: '2026-08-15',
    tags: ['欧洲', 'GDPR', '匿名可用', '无需信用卡']
  },
  {
    id: 'llm7',
    name: 'LLM7.io',
    category: 'api',
    freeNote: '免费聚合网关，无需信用卡。罕见地提供免费 GPT-4o-mini，外加 DeepSeek-R1 / Qwen / Llama 等，30 RPM（注册 token 提至 120 RPM），OpenAI 兼容。小型独立服务，适合原型。',
    url: 'https://llm7.io',
    lastChecked: '2026-08-11',
    tags: ['GPT-4o-mini', '无需信用卡', 'OpenAI兼容']
  },
  {
    id: 'modelscope',
    name: '魔搭 ModelScope',
    category: 'api',
    freeNote: '阿里开源社区，绑定阿里云账号 + 实名后每日 2000 次免费 API-Inference（单模型≤500/天），无需信用卡。覆盖 Qwen / DeepSeek / GLM 等近 3000 模型，OpenAI 与 Anthropic 双兼容。',
    url: 'https://modelscope.cn',
    lastChecked: '2026-08-11',
    tags: ['国内可用', 'Qwen', '无需信用卡']
  },
  {
    id: 'chutes',
    name: 'Chutes.ai',
    category: 'api',
    freeNote: '免费层，无需信用卡。托管 DeepSeek、Qwen 等开源模型的 OpenAI 兼容端点，适合个人项目与原型验证。',
    url: 'https://chutes.ai',
    lastChecked: '2026-08-11',
    tags: ['开源', '无需信用卡', 'OpenAI兼容']
  },
  {
    id: 'glhf',
    name: 'Glhf.chat',
    category: 'api',
    freeNote: '免费层，无需信用卡。提供若干开源模型的 OpenAI 兼容 API，适合轻量调用与评测。',
    url: 'https://glhf.chat',
    lastChecked: '2026-08-11',
    tags: ['开源', '无需信用卡', 'OpenAI兼容']
  },
  {
    id: 'ollama-cloud',
    name: 'Ollama Cloud',
    category: 'api',
    freeNote: '永久免费层，无需信用卡（邮箱注册）。Ollama 官方云端推理，通过熟悉的 Ollama API 格式（含 OpenAI 兼容端点）调用 Llama、Qwen、Gemma、DeepSeek、Kimi 等；免费用户并发 1、按 session/周限额。',
    url: 'https://ollama.com',
    lastChecked: '2026-08-15',
    tags: ['Ollama', '开源', '无需信用卡']
  },
  {
    id: 'sambanova',
    name: 'SambaNova Cloud',
    category: 'api',
    freeNote: '永久免费层，无需信用卡。约 200,000 tokens/天/模型，高速推理 Llama、Qwen、DeepSeek 等开源大模型。',
    url: 'https://cloud.sambanova.ai',
    lastChecked: '2026-08-15',
    tags: ['高速推理', '开源', '无需信用卡']
  },

  /* ===================== 评测 / 信息查询平台 ===================== */
  {
    id: 'lmarena',
    name: 'LMArena / Arena（Chatbot Arena）',
    category: 'eval',
    freeNote: '完全免费，无需注册。前身 Chatbot Arena，2026 年初更名 Arena；全球引用最广的人类偏好盲测榜单，覆盖文本/代码/视觉/视频等 9 大类别。',
    url: 'https://arena.ai',
    lastChecked: '2026-08-15',
    tags: ['人类偏好', '盲测', '免费']
  },
  {
    id: 'artificial-analysis',
    name: 'Artificial Analysis',
    category: 'eval',
    freeNote: '完全免费。Intelligence Index 跨 100+ 模型对比质量/价格/速度，每日更新。',
    url: 'https://artificialanalysis.ai',
    lastChecked: '2026-08-02',
    tags: ['综合指数', '每日更新', '免费']
  },
  {
    id: 'livebench',
    name: 'LiveBench',
    category: 'eval',
    freeNote: '完全免费。抗数据污染的标准化基准，实时更新榜单。',
    url: 'https://livebench.ai',
    lastChecked: '2026-08-02',
    tags: ['抗污染', '免费']
  },
  {
    id: 'open-llm-leaderboard',
    name: 'Open LLM Leaderboard（HF）',
    category: 'eval',
    freeNote: '完全免费开源。Hugging Face 开源大模型性能排行榜。',
    url: 'https://huggingface.co/spaces/open-llm-leaderboard',
    lastChecked: '2026-08-02',
    tags: ['开源', '免费']
  },
  {
    id: 'superclue',
    name: 'SuperCLUE',
    category: 'eval',
    freeNote: '完全免费。第三方中文大模型综合评测基准，覆盖 70+ 子能力，定期发榜。',
    url: 'https://www.superclueai.com',
    lastChecked: '2026-08-02',
    tags: ['中文', '免费']
  },
  {
    id: 'opencompass',
    name: 'OpenCompass',
    category: 'eval',
    freeNote: '完全免费开源。上海AI实验室出品的大模型评测系统，支持语言与多模态。',
    url: 'https://opencompass.org.cn',
    lastChecked: '2026-08-02',
    tags: ['中文', '开源', '免费']
  },
  {
    id: 'c-eval',
    name: 'C-Eval',
    category: 'eval',
    freeNote: '完全免费。清华等出品的中文大模型评测套件，52 学科 4 难度。',
    url: 'https://cevalbenchmark.com',
    lastChecked: '2026-08-02',
    tags: ['中文', '免费']
  },
  {
    id: 'cmnlu',
    name: 'CMMLU',
    category: 'eval',
    freeNote: '完全免费。覆盖 67 主题的中文语言模型评测基准。',
    url: 'https://cmmlu-benchmark.github.io',
    lastChecked: '2026-08-02',
    tags: ['中文', '免费']
  },
  {
    id: 'agi-eval',
    name: 'AGI-Eval',
    category: 'eval',
    freeNote: '免费开放。学术与开发者可用评测榜单、公开数据集与基础评测功能。',
    url: 'https://agi-eval.cn',
    lastChecked: '2026-08-02',
    tags: ['中文', '数据集', '免费']
  },
  {
    id: 'flageval',
    name: 'FlagEval（天秤）',
    category: 'eval',
    freeNote: '完全免费。智源研究院出品，三维评测框架，600+ 维度。',
    url: 'https://flageval.baai.ac.cn',
    lastChecked: '2026-08-02',
    tags: ['中文', '多维度', '免费']
  },
  {
    id: 'vellum-leaderboard',
    name: 'Vellum LLM Leaderboard',
    category: 'eval',
    freeNote: '完全免费。聚焦仍能区分前沿模型的基准（GPQA / SWE-Bench 等），含价格与延迟。',
    url: 'https://www.vellum.ai/llm-leaderboard',
    lastChecked: '2026-08-02',
    tags: ['前沿', '免费']
  },
  {
    id: 'lm-eval-harness',
    name: 'EleutherAI lm-evaluation-harness',
    category: 'eval',
    freeNote: '免费开源（MIT）。可复现的模型基准框架，200+ 评测任务。',
    url: 'https://github.com/EleutherAI/lm-evaluation-harness',
    lastChecked: '2026-08-02',
    tags: ['开源', '研究', '免费']
  },
  {
    id: 'epoch-ai',
    name: 'Epoch AI Benchmarks',
    category: 'eval',
    freeNote: '完全免费。研究级基准数据库与 Capabilities Index，追踪前沿进展。',
    url: 'https://epoch.ai',
    lastChecked: '2026-08-02',
    tags: ['研究', '免费']
  },
  {
    id: 'llm-stats',
    name: 'LLM-Stats Benchmarks',
    category: 'eval',
    freeNote: '完全免费。汇总 600+ AI/LLM 基准（推理 / 代码 / 数学 / 视觉 / 工具调用等），每条基准直连实时排行榜与独立验证分数，持续更新。',
    url: 'https://llm-stats.com',
    lastChecked: '2026-08-11',
    tags: ['基准索引', '实时榜单', '免费']
  },
  {
    id: 'aib-vote',
    name: 'AIB（AI 模型对比平台）',
    category: 'eval',
    freeNote: '完全免费，无需注册即可比对主流模型（ChatGPT / Claude / Gemini / Grok / DeepSeek / Mistral / Kimi / GLM / MiniMax 等）。基于真实用户投票与评测，含中日韩多语言实际表现；2026-06 公测上线。',
    url: 'https://www.aib.vote',
    lastChecked: '2026-08-15',
    tags: ['真实用户投票', '多语言', '免费']
  },
  {
    id: 'coarena',
    name: 'Coarena（计算机操作任务竞技场）',
    category: 'eval',
    freeNote: '完全免费，无使用上限。2026-08 上线，面向 Computer Use（计算机操作）任务的模型竞技场：发布真实浏览器任务，多个前沿智能体（Claude Opus 5、GPT-5.6、Gemini 3.6 等）同态执行，盲选投票评估真实任务执行能力。',
    url: 'https://coarena.ai',
    lastChecked: '2026-08-15',
    tags: ['Computer Use', '盲测', '免费']
  },

  /* ===================== 免费学习资源 ===================== */
  {
    id: 'elements-of-ai',
    name: 'Elements of AI（赫尔辛基大学）',
    category: 'learn',
    freeNote: '完全免费，多数地区证书也免费。零基础 AI 通识，20+ 语言。',
    url: 'https://www.elementsofai.com',
    lastChecked: '2026-08-02',
    tags: ['零基础', '免费证书']
  },
  {
    id: 'google-genai-path',
    name: 'Google 生成式 AI 学习路径',
    category: 'learn',
    freeNote: '完全免费，完成可得免费徽章。覆盖 LLM、Gemini API、图像生成、负责任的 AI。',
    url: 'https://developers.google.com/learn/pathways/generative-ai',
    lastChecked: '2026-08-02',
    tags: ['徽章', '免费']
  },
  {
    id: 'fastai',
    name: 'fast.ai 实用深度学习',
    category: 'learn',
    freeNote: '完全免费。代码优先、自上而下，第一节就训练可用神经网络。',
    url: 'https://www.fast.ai',
    lastChecked: '2026-08-02',
    tags: ['实战', '免费']
  },
  {
    id: 'ai-for-everyone',
    name: 'AI for Everyone（Andrew Ng / Coursera）',
    category: 'learn',
    freeNote: '可免费旁听（audit），无编程无数学。面向管理者与非技术同学。',
    url: 'https://www.coursera.org/learn/ai-for-everyone',
    lastChecked: '2026-08-02',
    tags: ['通识', '免费旁听']
  },
  {
    id: 'stanford-cs229',
    name: 'Stanford CS229 机器学习',
    category: 'learn',
    freeNote: 'YouTube 完整课程，无需注册，完全免费。数学基础最扎实。',
    url: 'https://www.youtube.com/watch?v=jGwO_UgTS7I',
    lastChecked: '2026-08-02',
    tags: ['进阶', '免费', '无注册']
  },
  {
    id: 'kaggle-learn',
    name: 'Kaggle Learn',
    category: 'learn',
    freeNote: '完全免费微课程，浏览器内运行，含免费 GPU Notebook，无需登录。',
    url: 'https://www.kaggle.com/learn',
    lastChecked: '2026-08-02',
    tags: ['动手', '免费 GPU']
  },
  {
    id: 'google-mlcc',
    name: 'Google 机器学习速成课（MLCC）',
    category: 'learn',
    freeNote: '完全免费，无需登录。含 Colab 交互练习，2025 更新加入 LLM/嵌入章节。',
    url: 'https://developers.google.com/machine-learning/crash-course',
    lastChecked: '2026-08-02',
    tags: ['基础', '免费']
  },
  {
    id: 'hf-nlp-course',
    name: 'Hugging Face NLP 课程',
    category: 'learn',
    freeNote: '完全免费，含动手 Notebook 与完成证书。Transformer、微调、部署。',
    url: 'https://huggingface.co/learn/nlp-course',
    lastChecked: '2026-08-02',
    tags: ['NLP', '免费证书']
  },
  {
    id: 'deeplearning-ai',
    name: 'DeepLearning.AI 短课程',
    category: 'learn',
    freeNote: '多数短课程（1–2 小时专题）免费学习，无需付费。',
    url: 'https://www.deeplearning.ai',
    lastChecked: '2026-08-02',
    tags: ['专题', '免费']
  },
  {
    id: 'mit-6036',
    name: 'MIT 6.036 机器学习导论',
    category: 'learn',
    freeNote: 'Open Learning Library 全部讲义/习题免费，无需证书。',
    url: 'https://openlearninglibrary.mit.edu/courses/course-v1:MITx+6.036+1T2019/about',
    lastChecked: '2026-08-02',
    tags: ['大学级', '免费']
  },
  {
    id: 'harvard-cs50-ai',
    name: 'Harvard CS50 AI',
    category: 'learn',
    freeNote: 'edX / YouTube 免费旁听，顶级授课，无证书。',
    url: 'https://cs50.harvard.edu/ai/',
    lastChecked: '2026-08-02',
    tags: ['大学级', '免费']
  },
  {
    id: 'pytorch-tutorials',
    name: 'PyTorch 官方教程',
    category: 'learn',
    freeNote: '完全免费，可在 Google Colab 运行。从基础到自定义模型。',
    url: 'https://pytorch.org/tutorials/',
    lastChecked: '2026-08-02',
    tags: ['框架', '免费']
  },
  {
    id: 'ibm-skillsbuild',
    name: 'IBM SkillsBuild',
    category: 'learn',
    freeNote: '完全免费课程与数字徽章，无隐藏费用。覆盖 ML/DL/NLP/CV。',
    url: 'https://skillsbuild.org',
    lastChecked: '2026-08-02',
    tags: ['徽章', '免费']
  },
  {
    id: 'anthropic-academy',
    name: 'Anthropic Academy',
    category: 'learn',
    freeNote: '完全免费，含完成证书。2026 年 3 月上线，20+ 门课程覆盖 Claude、Claude Code、Claude API 与 MCP 实战。',
    url: 'https://academy.anthropic.com',
    lastChecked: '2026-08-11',
    tags: ['Claude', '证书', '免费']
  },
  {
    id: 'ms-generative-ai-beginners',
    name: 'Microsoft 生成式 AI 入门（21 课）',
    category: 'learn',
    freeNote: '完全免费开源（MIT）。从提示工程到 RAG、Agent 的 21 节动手课程，GitHub 仓库持续维护。',
    url: 'https://github.com/microsoft/generative-ai-for-beginners',
    lastChecked: '2026-08-11',
    tags: ['开源', '提示工程', '免费']
  },
  {
    id: 'ms-ai-agents-beginners',
    name: 'Microsoft AI Agents 入门（15 课）',
    category: 'learn',
    freeNote: '完全免费开源。15 节以代码为主的 AI Agent 课程，覆盖构建与编排智能体。',
    url: 'https://github.com/microsoft/ai-agents-for-beginners',
    lastChecked: '2026-08-11',
    tags: ['Agent', '开源', '免费']
  },
  {
    id: 'hf-agents-course',
    name: 'Hugging Face Agents 课程',
    category: 'learn',
    freeNote: '完全免费，含完成证书。面向 Agent 构建的动手课程，配套 Notebook 与示例。',
    url: 'https://huggingface.co/learn/agents-course',
    lastChecked: '2026-08-11',
    tags: ['Agent', '证书', '免费']
  },
  {
    id: 'karpathy-nn-zero-to-hero',
    name: 'Neural Networks: Zero to Hero（Karpathy）',
    category: 'learn',
    freeNote: '完全免费。8 集视频从反向传播手搓到完整 GPT，深入理解 LLM 工作原理。',
    url: 'https://www.youtube.com/playlist?list=PLAqhIrjkxbuWI23v9cThsA9GvCAUhRvKZ',
    lastChecked: '2026-08-11',
    tags: ['原理', '免费', '无注册']
  },
  {
    id: 'mit-6s191',
    name: 'MIT 6.S191 深度学习导论',
    category: 'learn',
    freeNote: '完全免费开放。2026 版讲义、幻灯片与实验全部公开，无需注册。',
    url: 'https://introtodeeplearning.com',
    lastChecked: '2026-08-11',
    tags: ['大学级', '免费']
  }
]
