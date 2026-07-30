import { encryptSecret, decryptSecret } from './secret'
import { loadProfileAiConfig, saveProfileAiConfig } from './appDataService'
import { recordUsage } from './usageTracker'

export type AiProvider = 'ollama' | 'openrouter' | 'openai-compatible' | 'bailian'

export interface AiConfig {
  provider: AiProvider
  baseUrl: string
  model: string
  apiKey: string
  systemPrompt: string
}

const STORAGE_KEY = 'free-ai-config'
const SECRET_KEY = 'free-ai-config-secret'

// 各服务商预置模型列表：界面用下拉选择，支持自定义输入。
// 真实可调用模型统一见 services/modelCatalog.ts（CALLABLE_MODELS），此处仅作「高级手动配置」的常用候选。
export const MODEL_PRESETS: Record<AiProvider, string[]> = {
  ollama: ['llama3.2', 'llama3.1', 'qwen2.5', 'qwen2.5-coder', 'deepseek-r1', 'gemma2', 'phi3'],
  openrouter: [
    'deepseek/deepseek-chat-v3-0324:free',
    'meta-llama/llama-3.3-70b-instruct:free',
    'qwen/qwen-2.5-72b-instruct:free',
    'google/gemini-2.0-flash-exp:free',
    'openai/gpt-4o-mini'
  ],
  'openai-compatible': [
    'gpt-4o-mini',
    'gpt-4o',
    'deepseek-chat',
    'deepseek-reasoner',
    'deepseek-ai/DeepSeek-V3',
    'deepseek-ai/DeepSeek-R1',
    'glm-4-flash',
    'glm-4.7-flash',
    'Qwen/Qwen2.5-72B-Instruct',
    'doubao-seed-1.6-250615'
  ],
  bailian: ['qwen-turbo', 'qwen-plus', 'qwen-max', 'qwen-long', 'deepseek-v3']
}

// 各服务商默认接口地址
export const PROVIDER_DEFAULT_BASE_URL: Record<AiProvider, string> = {
  ollama: '/ollama',
  openrouter: 'https://openrouter.ai/api',
  'openai-compatible': 'https://api.openai.com',
  bailian: 'https://dashscope.aliyuncs.com/compatible-mode/v1'
}

// 混淆实现已迁移至 ./secret（本地存储与云端存储共用），此处不再重复定义

function sanitizeMessage(value: string): string {
  return value
    .replace(/(Bearer\s+)([A-Za-z0-9._-]+)/gi, '$1***')
    .replace(/(api[_-]?key|token|Authorization)\s*[:=]\s*([^\s,;]+)/gi, '$1=***')
    .replace(/(sk-[A-Za-z0-9_-]{4})[A-Za-z0-9_-]{8,}/g, '$1***')
}

function readConfigFromStorage(storage: Storage | null): Partial<AiConfig> | null {
  if (!storage) {
    return null
  }

  try {
    const raw = storage.getItem(STORAGE_KEY)
    if (!raw) {
      return null
    }

    const parsed = JSON.parse(raw)
    return typeof parsed === 'object' && parsed ? parsed as Partial<AiConfig> : null
  } catch {
    return null
  }
}

export const defaultAiConfig: AiConfig = {
  provider: 'ollama',
  baseUrl: '/ollama',
  model: 'llama3.2',
  apiKey: '',
  systemPrompt: '你是一个专业的智能工作助理，回答要简洁、结构化、可执行、重点先行；善用标题、列表、加粗让层次清晰，并始终给出可落地的建议。'
}

// 统一的「回答规范」：无论用户如何自定义系统提示，都附加此规则，
// 确保 AI 输出结构化且末尾带有「## 总结」，与本项目助理的回答风格一致。
const ANSWER_RULE =
  '\n\n【回答规范】请采用结构化方式作答：使用标题、列表、加粗让层次清晰；' +
  '在回答末尾以「## 总结」为小标题，用 2-4 条要点概括核心结论与可执行建议。'

function buildSystemPrompt(prompt: string): string {
  return (prompt || '') + ANSWER_RULE
}

/**
 * 记录一次真实 AI 调用用量（Fix #2）。
 * 若响应体携带 OpenAI 兼容的 usage（prompt_tokens / completion_tokens / total_tokens），
 * 则使用「真实 tokens」；否则按字符长度本地估算。阿里百炼、OpenAI 兼容接口均会返回 usage。
 * 所有记录仅存浏览器 localStorage，不写入云端、不消耗任何积分。
 */
function trackUsage(
  provider: string,
  model: string,
  prompt: string,
  completion: string,
  usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number }
): void {
  if (!usage || typeof usage.prompt_tokens !== 'number') {
    recordUsage({ provider, model, promptText: prompt, completionText: completion })
    return
  }
  recordUsage({
    provider,
    model,
    promptText: prompt,
    completionText: completion,
    realUsage: {
      promptTokens: Number(usage.prompt_tokens) || 0,
      completionTokens: Number(usage.completion_tokens) || 0,
      totalTokens:
        Number(usage.total_tokens) ||
        (Number(usage.prompt_tokens) || 0) + (Number(usage.completion_tokens) || 0)
    }
  })
}

export async function loadAiConfig(userId?: string): Promise<AiConfig> {
  if (typeof window === 'undefined') {
    return defaultAiConfig
  }

  const localConfig = readConfigFromStorage(window.localStorage) || {}
  // 密钥单独混淆存储，输入一次后长期有效
  const encodedSecret = window.localStorage.getItem(SECRET_KEY) || ''
  const localApiKey = encodedSecret ? await decryptSecret(encodedSecret) : ''

  // 本地配置始终作为「当前会话的事实来源」，确保模型/厂商切换即时生效
  const merged: AiConfig = {
    ...defaultAiConfig,
    ...localConfig,
    apiKey: localApiKey
  }

  // 已登录：仅用云端「填补本地缺失的字段」，云端为跨设备备份，绝不覆盖本地主动修改
  // （修复缺陷：旧逻辑云端优先覆盖本地，导致云端 ai_config 因 RLS 未更新时切换看似失效）
  if (userId) {
    try {
      const serverConfig = await loadProfileAiConfig(userId)
      if (serverConfig && serverConfig.provider) {
        merged.provider = (localConfig.provider as AiProvider) || serverConfig.provider
        merged.baseUrl = localConfig.baseUrl || serverConfig.baseUrl || merged.baseUrl
        merged.model = localConfig.model || serverConfig.model || merged.model
        merged.systemPrompt = localConfig.systemPrompt || serverConfig.systemPrompt || merged.systemPrompt
      }
    } catch (error) {
      console.warn('[ai] 读取云端配置失败，使用本地配置', error)
    }
  }

  return merged
}

export function saveAiConfig(config: AiConfig, userId?: string) {
  if (typeof window === 'undefined') {
    return
  }

  const apiKey = config.apiKey.trim()
  // 配置正文不含密钥；密钥混淆后单独存储（本地）
  const rest = {
    provider: config.provider,
    baseUrl: config.baseUrl,
    model: config.model,
    systemPrompt: config.systemPrompt
  }
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(rest))
  if (apiKey) {
    void encryptSecret(apiKey)
      .then((enc) => {
        try {
          window.localStorage.setItem(SECRET_KEY, enc)
        } catch {
          /* ignore */
        }
      })
      .catch(() => {
        /* ignore */
      })
  }

  // 已登录：同步到云端（账号级配置，跨 PC / 移动端自动带出）
  if (userId) {
    void saveProfileAiConfig(userId, config)
  }
}

export async function callAi(config: AiConfig, userPrompt: string): Promise<string> {
  const baseUrl = config.baseUrl.replace(/\/$/, '')

  if (config.provider === 'ollama') {
    const response = await fetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: config.model,
        stream: false,
        messages: [
          { role: 'system', content: buildSystemPrompt(config.systemPrompt) },
          { role: 'user', content: userPrompt }
        ]
      })
    })

    const data = await response.json().catch(() => ({}))
    if (!response.ok) {
      throw new Error(sanitizeMessage(data?.error?.message || `Ollama 请求失败，状态码：${response.status}`))
    }

    const content = data?.message?.content || data?.response || ''
    if (typeof content === 'string' && content.trim()) {
      trackUsage('ollama', config.model, userPrompt, content)
      return content
    }

    throw new Error('Ollama 返回内容为空，请确认模型已经安装并启动。')
  }

  if (config.provider === 'bailian') {
    const endpoint = (config.baseUrl || 'https://dashscope.aliyuncs.com/compatible-mode/v1').trim()
    const url = endpoint.endsWith('/chat/completions') ? endpoint : `${endpoint.replace(/\/$/, '')}/chat/completions`

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`
      },
      body: JSON.stringify({
        model: config.model || 'qwen-turbo',
        messages: [
          { role: 'system', content: buildSystemPrompt(config.systemPrompt) },
          { role: 'user', content: userPrompt }
        ]
      })
    })

    const data = await response.json().catch(() => ({}))
    if (!response.ok) {
      throw new Error(sanitizeMessage(data?.error?.message || data?.message || `百炼请求失败，状态码：${response.status}`))
    }

    const content = data?.choices?.[0]?.message?.content || ''
    if (typeof content === 'string' && content.trim()) {
      trackUsage('bailian', config.model || 'qwen-turbo', userPrompt, content, data?.usage)
      return content
    }

    throw new Error('百炼返回内容为空，请检查模型名或 API Key。')
  }

  const url = `${baseUrl}/v1/chat/completions`
  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  }

  if (config.apiKey) {
    headers.Authorization = `Bearer ${config.apiKey}`
  }

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: config.model,
      messages: [
        { role: 'system', content: config.systemPrompt },
        { role: 'user', content: userPrompt }
      ]
    })
  })

  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(sanitizeMessage(data?.error?.message || data?.message || `请求失败，状态码：${response.status}`))
  }

  const content = data?.choices?.[0]?.message?.content || ''
  if (typeof content === 'string' && content.trim()) {
    trackUsage(config.provider, config.model, userPrompt, content, data?.usage)
    return content
  }

  throw new Error('返回内容为空，请检查接口地址、模型名或授权信息。')
}

export function getProviderHint(provider: AiProvider) {
  if (provider === 'ollama') {
    return '推荐：先安装 Ollama，再执行 ollama pull llama3.2。'
  }

  if (provider === 'openrouter') {
    return '可直接使用 OpenRouter 的免费模型，但通常需要填写 API Key。'
  }

  if (provider === 'bailian') {
    return '可接入阿里百炼（DashScope）模型，推荐使用 qwen-turbo / qwen-plus，并填入你的 DashScope API Key。'
  }

  return '适配 OpenAI 风格的兼容接口。'
}
