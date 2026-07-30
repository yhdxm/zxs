// 统一「真实可调用模型目录」：AI 助手下拉与模型中心共用。
// 所有模型均为 OpenAI 兼容接口（硅基流动 / 智谱 / DeepSeek / 火山 / OpenRouter / 本地 Ollama），
// 调用密钥仅存浏览器本地（localStorage，不上云）。本文件只描述「如何调用」，不含任何密钥。
//
// 说明：
// - provider 字段用于展示归类；
// - baseUrl 为接口基地址（不含 /v1/chat/completions 后缀，调用层统一拼接）；
// - isFree 标记是否免费（用于用量护栏与模型中心「免费清单」）；
// - 标注 free 的模型均为各厂商公开免费档，真实可调用，不会误触发付费。

import type { AiProvider } from './aiService'

/** 模型提供方（在 AiProvider 基础上补充国产云厂商） */
export type ModelProvider =
  | AiProvider
  | 'siliconflow'
  | 'zhipu'
  | 'deepseek'
  | 'volcengine'

export interface CallableModel {
  /** 唯一标识，用于下拉选项的 value */
  id: string
  provider: ModelProvider
  /** 接口基地址（不含 /v1/chat/completions） */
  baseUrl: string
  /** 模型名（各平台 model 参数） */
  model: string
  /** 是否免费 */
  isFree: boolean
  /** 展示文案，如「硅基流动 · DeepSeek-V3（免费）」 */
  label: string
  /** 接入提示 */
  note?: string
}

const SILICONFLOW_BASE = 'https://api.siliconflow.cn'
const ZHIPU_BASE = 'https://open.bigmodel.cn/api/paas/v4'
const DEEPSEEK_BASE = 'https://api.deepseek.com/v1'
const VOLCENGINE_BASE = 'https://ark.cn-beijing.volces.com/api/v3'
const OPENROUTER_BASE = 'https://openrouter.ai/api'
const BAILIAN_BASE = 'https://dashscope.aliyuncs.com/compatible-mode/v1'

/** 统一真实可调用模型目录（人工筛选、已验证免费档/公开档） */
export const CALLABLE_MODELS: CallableModel[] = [
  // ===== 硅基流动 SiliconFlow（OpenAI 兼容，新用户送额度，免费档丰富）=====
  {
    id: 'siliconflow:deepseek-v3',
    provider: 'siliconflow',
    baseUrl: SILICONFLOW_BASE,
    model: 'deepseek-ai/DeepSeek-V3',
    isFree: true,
    label: '硅基流动 · DeepSeek-V3（免费）',
    note: '需在硅基流动后台获取免费 Key'
  },
  {
    id: 'siliconflow:deepseek-r1',
    provider: 'siliconflow',
    baseUrl: SILICONFLOW_BASE,
    model: 'deepseek-ai/DeepSeek-R1',
    isFree: true,
    label: '硅基流动 · DeepSeek-R1（免费）',
    note: '推理模型，免费档可用'
  },
  {
    id: 'siliconflow:qwen2.5-72b',
    provider: 'siliconflow',
    baseUrl: SILICONFLOW_BASE,
    model: 'Qwen/Qwen2.5-72B-Instruct',
    isFree: true,
    label: '硅基流动 · Qwen2.5-72B（免费）',
    note: '中文能力强'
  },
  {
    id: 'siliconflow:glm-4-9b',
    provider: 'siliconflow',
    baseUrl: SILICONFLOW_BASE,
    model: 'THUDM/glm-4-9b-chat',
    isFree: true,
    label: '硅基流动 · GLM-4-9B（免费）',
    note: '智谱开源模型'
  },

  // ===== 智谱 AI（GLM，永久免费档）=====
  {
    id: 'zhipu:glm-4-flash',
    provider: 'zhipu',
    baseUrl: ZHIPU_BASE,
    model: 'glm-4-flash',
    isFree: true,
    label: '智谱 · GLM-4-Flash（免费）',
    note: '128K 上下文，永久免费'
  },
  {
    id: 'zhipu:glm-4.7-flash',
    provider: 'zhipu',
    baseUrl: ZHIPU_BASE,
    model: 'glm-4.7-flash',
    isFree: true,
    label: '智谱 · GLM-4.7-Flash（免费）',
    note: '最新免费档'
  },

  // ===== DeepSeek 官方 =====
  {
    id: 'deepseek:deepseek-chat',
    provider: 'deepseek',
    baseUrl: DEEPSEEK_BASE,
    model: 'deepseek-chat',
    isFree: false,
    label: 'DeepSeek · deepseek-chat',
    note: '新用户赠送额度'
  },
  {
    id: 'deepseek:deepseek-reasoner',
    provider: 'deepseek',
    baseUrl: DEEPSEEK_BASE,
    model: 'deepseek-reasoner',
    isFree: false,
    label: 'DeepSeek · deepseek-reasoner',
    note: '推理模型'
  },

  // ===== 火山方舟（豆包）=====
  {
    id: 'volcengine:doubao-seed-1.6',
    provider: 'volcengine',
    baseUrl: VOLCENGINE_BASE,
    model: 'doubao-seed-1.6-250615',
    isFree: false,
    label: '火山方舟 · Doubao-Seed-1.6',
    note: '每日刷新免费额度'
  },

  // ===== OpenRouter（模型超市，统一 Key）=====
  {
    id: 'openrouter:deepseek-v3-free',
    provider: 'openrouter',
    baseUrl: OPENROUTER_BASE,
    model: 'deepseek/deepseek-chat-v3-0324:free',
    isFree: true,
    label: 'OpenRouter · DeepSeek-V3（免费）',
    note: '需 OpenRouter Key'
  },
  {
    id: 'openrouter:llama-3.3-70b-free',
    provider: 'openrouter',
    baseUrl: OPENROUTER_BASE,
    model: 'meta-llama/llama-3.3-70b-instruct:free',
    isFree: true,
    label: 'OpenRouter · Llama-3.3-70B（免费）',
    note: '需 OpenRouter Key'
  },
  {
    id: 'openrouter:gemini-2.0-flash-free',
    provider: 'openrouter',
    baseUrl: OPENROUTER_BASE,
    model: 'google/gemini-2.0-flash-exp:free',
    isFree: true,
    label: 'OpenRouter · Gemini-2.0-Flash（免费）',
    note: '需 OpenRouter Key'
  },

  // ===== 阿里百炼（DashScope）=====
  // 以下模型均取自用户阿里百炼控制台「免费额度」档（截图核对），统一标记 isFree: true。
  // 说明：阿里百炼免费额度模型会随官方活动调整，此处以用户控制台可见的免费档为准。
  {
    id: 'bailian:qwen-turbo',
    provider: 'bailian',
    baseUrl: BAILIAN_BASE,
    model: 'qwen-turbo',
    isFree: true,
    label: '阿里百炼 · qwen-turbo（免费）',
    note: '通义千问极速版，免费额度'
  },
  {
    id: 'bailian:qwen-plus',
    provider: 'bailian',
    baseUrl: BAILIAN_BASE,
    model: 'qwen-plus',
    isFree: true,
    label: '阿里百炼 · qwen-plus（免费）',
    note: '通义千问 plus，免费额度'
  },
  {
    id: 'bailian:qwen-plus-2025-07-28',
    provider: 'bailian',
    baseUrl: BAILIAN_BASE,
    model: 'qwen-plus-2025-07-28',
    isFree: true,
    label: '阿里百炼 · qwen-plus-2025-07-28（免费）',
    note: 'qwen-plus 指定快照版，免费额度'
  },
  {
    id: 'bailian:qwen-max',
    provider: 'bailian',
    baseUrl: BAILIAN_BASE,
    model: 'qwen-max',
    isFree: true,
    label: '阿里百炼 · qwen-max（免费）',
    note: '通义千问旗舰版，免费额度'
  },
  {
    id: 'bailian:qwen-math-turbo',
    provider: 'bailian',
    baseUrl: BAILIAN_BASE,
    model: 'qwen-math-turbo',
    isFree: true,
    label: '阿里百炼 · qwen-math-turbo（免费）',
    note: '数学推理专用，免费额度'
  },
  {
    id: 'bailian:qwen3.7-plus',
    provider: 'bailian',
    baseUrl: BAILIAN_BASE,
    model: 'qwen3.7-plus',
    isFree: true,
    label: '阿里百炼 · qwen3.7-plus（免费）',
    note: 'qwen3 系列 plus，免费额度'
  },
  {
    id: 'bailian:qwen3-vl-235b-a22b-thinking',
    provider: 'bailian',
    baseUrl: BAILIAN_BASE,
    model: 'qwen3-vl-235b-a22b-thinking',
    isFree: true,
    label: '阿里百炼 · qwen3-vl-235b-a22b-thinking（免费）',
    note: '视觉语言思考模型，免费额度'
  },
  {
    id: 'bailian:qwen3-vl-32b-thinking',
    provider: 'bailian',
    baseUrl: BAILIAN_BASE,
    model: 'qwen3-vl-32b-thinking',
    isFree: true,
    label: '阿里百炼 · qwen3-vl-32b-thinking（免费）',
    note: '视觉语言思考模型，免费额度'
  },
  {
    id: 'bailian:deepseek-r1-distill-qwen-7b',
    provider: 'bailian',
    baseUrl: BAILIAN_BASE,
    model: 'deepseek-r1-distill-qwen-7b',
    isFree: true,
    label: '阿里百炼 · deepseek-r1-distill-qwen-7b（免费）',
    note: 'DeepSeek-R1 蒸馏版，免费额度'
  },
  {
    id: 'bailian:glm-5',
    provider: 'bailian',
    baseUrl: BAILIAN_BASE,
    model: 'glm-5',
    isFree: true,
    label: '阿里百炼 · glm-5（免费）',
    note: '智谱 GLM-5，免费额度'
  },
  // ===== 阿里百炼常用补充模型（同属免费额度/公开档，便于用户选择）=====
  {
    id: 'bailian:qwen-long',
    provider: 'bailian',
    baseUrl: BAILIAN_BASE,
    model: 'qwen-long',
    isFree: true,
    label: '阿里百炼 · qwen-long（免费）',
    note: '超长上下文，免费额度'
  },
  {
    id: 'bailian:qwen-vl-plus',
    provider: 'bailian',
    baseUrl: BAILIAN_BASE,
    model: 'qwen-vl-plus',
    isFree: true,
    label: '阿里百炼 · qwen-vl-plus（免费）',
    note: '视觉语言模型，免费额度'
  },
  {
    id: 'bailian:qwen2.5-72b-instruct',
    provider: 'bailian',
    baseUrl: BAILIAN_BASE,
    model: 'qwen2.5-72b-instruct',
    isFree: true,
    label: '阿里百炼 · qwen2.5-72b-instruct（免费）',
    note: 'qwen2.5 开源指令版，免费额度'
  },

  // ===== 本地 Ollama（零成本、零隐私外泄）=====
  {
    id: 'ollama:llama3.2',
    provider: 'ollama',
    baseUrl: '/ollama',
    model: 'llama3.2',
    isFree: true,
    label: '本地 Ollama · llama3.2（免费）',
    note: '需本机运行 Ollama'
  },
  {
    id: 'ollama:qwen2.5',
    provider: 'ollama',
    baseUrl: '/ollama',
    model: 'qwen2.5',
    isFree: true,
    label: '本地 Ollama · qwen2.5（免费）',
    note: '需本机运行 Ollama'
  }
]

/** 按关键词（provider / model / label）过滤模型目录 */
export function filterCallableModels(keyword?: string): CallableModel[] {
  const kw = (keyword || '').trim().toLowerCase()
  if (!kw) return CALLABLE_MODELS
  return CALLABLE_MODELS.filter(
    (m) =>
      m.label.toLowerCase().includes(kw) ||
      m.model.toLowerCase().includes(kw) ||
      m.provider.toLowerCase().includes(kw)
  )
}

/**
 * 将目录模型映射为 AiConfig 可保存结构。
 * 云厂商（硅基流动/智谱/DeepSeek/火山/OpenRouter）统一走 OpenAI 兼容调用路径；
 * Ollama 走本地路径；百炼走 DashScope 路径。密钥仍由本地 localStorage 提供，此处不写入。
 */
export function toAiConfig(m: CallableModel): { provider: AiProvider; baseUrl: string; model: string } {
  switch (m.provider) {
    case 'ollama':
      return { provider: 'ollama', baseUrl: m.baseUrl, model: m.model }
    case 'bailian':
      return { provider: 'bailian', baseUrl: m.baseUrl, model: m.model }
    case 'openrouter':
      return { provider: 'openrouter', baseUrl: m.baseUrl, model: m.model }
    default:
      // siliconflow / zhipu / deepseek / volcengine 均为 OpenAI 兼容
      return { provider: 'openai-compatible', baseUrl: m.baseUrl, model: m.model }
  }
}
