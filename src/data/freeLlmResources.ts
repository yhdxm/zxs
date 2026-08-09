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
    freeNote: '永久免费层，无需信用卡。Gemini 2.5/3 Flash + Gemma，约 10 RPM / 250 RPD（Flash），1M 上下文。',
    url: 'https://aistudio.google.com',
    lastChecked: '2026-08-02',
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
    freeNote: '免费模型标 :free，无需信用卡即可开始。单 key 汇聚 30+ 免费模型，约 50–200 RPD。',
    url: 'https://openrouter.ai',
    lastChecked: '2026-08-02',
    tags: ['聚合', 'OpenAI 兼容', '无需信用卡']
  },
  {
    id: 'nvidia-nim',
    name: 'NVIDIA NIM',
    category: 'api',
    freeNote: '循环免费层，约 40 RPM 且无每日上限。DeepSeek、Llama、Qwen、Nemotron 等，需手机验证。',
    url: 'https://build.nvidia.com',
    lastChecked: '2026-08-02',
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
    freeNote: '免费「Experiment」层，无需信用卡。Large / Medium / Small / Codestral / Devstral。',
    url: 'https://mistral.ai',
    lastChecked: '2026-08-02',
    tags: ['欧洲', '代码模型', '无需信用卡']
  },
  {
    id: 'huggingface-inference',
    name: 'Hugging Face Inference API',
    category: 'api',
    freeNote: '数千开源模型经统一 OpenAI 兼容端点免费调用，无需信用卡。共享配额约 300 次/小时。',
    url: 'https://huggingface.co',
    lastChecked: '2026-08-02',
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
    freeNote: '用 GitHub 个人令牌免费调用 GPT-4.1 / o3 / Llama 等，无需信用卡，需 GitHub 账号。',
    url: 'https://github.com/marketplace/models',
    lastChecked: '2026-08-02',
    tags: ['GPT', '开源友好', '无需信用卡']
  },
  {
    id: 'deepseek',
    name: 'DeepSeek 官方 API',
    category: 'api',
    freeNote: '官方提供免费调用额度，无需信用卡。DeepSeek-V3 / R1 等。',
    url: 'https://platform.deepseek.com',
    lastChecked: '2026-08-02',
    tags: ['推理', '无需信用卡']
  },

  /* ===================== 评测 / 信息查询平台 ===================== */
  {
    id: 'lmarena',
    name: 'LMArena（Chatbot Arena）',
    category: 'eval',
    freeNote: '完全免费。全球引用最广的人类偏好盲测榜单，覆盖文本/代码/视觉/视频。',
    url: 'https://lmarena.ai',
    lastChecked: '2026-08-02',
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
  }
]
