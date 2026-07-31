import { encryptSecret, decryptSecret } from './secret'
import {
  loadProfileAiConfig,
  saveProfileAiConfig,
  addModelUsage,
  loadOwnAiKey,
  saveOwnAiKey,
  getSavedUser
} from './appDataService'
import { recordUsage } from './usageTracker'

export type AiProvider = 'ollama' | 'openrouter' | 'openai-compatible' | 'bailian'

export interface AiConfig {
  provider: AiProvider
  baseUrl: string
  model: string
  apiKey: string
  systemPrompt: string
}

// 旧版全局存储键（不分账号，历史遗留）：仅用于把老数据迁移给超管，之后不再写入
const LEGACY_STORAGE_KEY = 'free-ai-config'
const LEGACY_SECRET_KEY = 'free-ai-config-secret'

// 账号级隔离：每个账号一套独立本地缓存键，互相不可见。
// 未登录时不读写任何持久化配置（返回默认值），杜绝蹭到别人的 Key。
const cfgKeyFor = (uid: string) => `free-ai-config:${uid}`
const secretKeyFor = (uid: string) => `free-ai-config-secret:${uid}`

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

/** 将百炼常见英文报错转换为中文，降低普通用户理解成本 */
function translateBailianError(message: string): string {
  const m = message || ''
  if (/Free quota exhausted|quota exhausted|free tier/i.test(m)) {
    return '该模型免费额度已用完。如需继续使用，请更换其他免费模型，或前往百炼控制台关闭「仅使用免费额度」模式并充值。'
  }
  if (/Insufficient balance|insufficient balance|balance insufficient/i.test(m)) {
    return '账户余额不足。请前往百炼控制台充值，或切换至其他免费模型。'
  }
  if (/Invalid API key|invalid api[-_]?key|incorrect api key/i.test(m)) {
    return 'API Key 无效或已过期。请在「AI 助手 → 配置」中重新填写正确的百炼 API Key。'
  }
  if (/Rate limit|rate limit|too many requests/i.test(m)) {
    return '请求过于频繁，已触发百炼限流。请稍后再试，或降低调用频率。'
  }
  if (/model not found|model does not exist|unsupported model/i.test(m)) {
    return '模型不存在或暂不可用。请检查模型名称，或切换到支持的模型。'
  }
  return m
}

function readConfigFromStorage(storage: Storage | null, key: string): Partial<AiConfig> | null {
  if (!storage) {
    return null
  }

  try {
    const raw = storage.getItem(key)
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

/** 解析当前登录账号（未显式传 userId 时自动识别），返回 uid 与角色 */
async function resolveCurrentUser(userId?: string): Promise<{ uid: string; role: string }> {
  try {
    const user = await getSavedUser()
    if (user?.id && (!userId || userId === user.id)) {
      return { uid: user.id, role: user.role || 'user' }
    }
    return { uid: userId || '', role: 'user' }
  } catch {
    return { uid: userId || '', role: 'user' }
  }
}

/**
 * 一次性迁移：旧版全局（不分账号）本地配置只归属超级管理员。
 * 超管登录且尚无自己的命名空间配置时，把旧数据搬进超管专属键并删除旧键；
 * 普通账号一律无视旧全局数据，从零开始自行配置，杜绝蹭用超管 Key。
 */
function migrateLegacyForSuperadmin(uid: string, role: string): void {
  if (role !== 'superadmin') return
  try {
    const ls = window.localStorage
    if (ls.getItem(cfgKeyFor(uid)) || ls.getItem(secretKeyFor(uid))) return
    const legacyCfg = ls.getItem(LEGACY_STORAGE_KEY)
    const legacySecret = ls.getItem(LEGACY_SECRET_KEY)
    if (legacyCfg) {
      ls.setItem(cfgKeyFor(uid), legacyCfg)
      ls.removeItem(LEGACY_STORAGE_KEY)
    }
    if (legacySecret) {
      ls.setItem(secretKeyFor(uid), legacySecret)
      ls.removeItem(LEGACY_SECRET_KEY)
    }
  } catch {
    /* ignore */
  }
}

export async function loadAiConfig(userId?: string): Promise<AiConfig> {
  if (typeof window === 'undefined') {
    return defaultAiConfig
  }

  const { uid, role } = await resolveCurrentUser(userId)

  // 未登录：不读取任何持久化配置，返回默认值（不含任何 Key）
  if (!uid) {
    return { ...defaultAiConfig }
  }

  // 旧全局数据只归超管（一次性迁移）
  migrateLegacyForSuperadmin(uid, role)

  const localConfig = readConfigFromStorage(window.localStorage, cfgKeyFor(uid)) || {}
  // 密钥单独加密存储（账号独立命名空间），输入一次后长期有效
  const encodedSecret = window.localStorage.getItem(secretKeyFor(uid)) || ''
  let apiKey = encodedSecret ? await decryptSecret(encodedSecret) : ''

  // 本地配置始终作为「当前会话的事实来源」，确保模型/厂商切换即时生效
  const merged: AiConfig = {
    ...defaultAiConfig,
    ...localConfig,
    apiKey
  }

  // 云端 ai_keys：本地没有 Key 时（换电脑 / 清缓存）从云端带出自己的 Key，
  // RLS 保证只能拿到自己账号那一行，永远不可能读到别人的 Key。
  if (!apiKey) {
    try {
      const cloudKey = await loadOwnAiKey(uid)
      if (cloudKey?.encryptedKey) {
        apiKey = await decryptSecret(cloudKey.encryptedKey)
        if (apiKey) {
          merged.apiKey = apiKey
          // 回填本地缓存，下次免请求
          try {
            window.localStorage.setItem(secretKeyFor(uid), cloudKey.encryptedKey)
          } catch { /* ignore */ }
          // 本地无配置正文时，一并带出云端记录的厂商/地址/模型
          if (!localConfig.provider && cloudKey.provider) {
            merged.provider = cloudKey.provider as AiProvider
            merged.baseUrl = cloudKey.baseUrl || merged.baseUrl
            merged.model = cloudKey.model || merged.model
          }
        }
      }
    } catch (error) {
      console.warn('[ai] 读取云端密钥失败，使用本地配置', error)
    }
  }

  // 云端 profiles.ai_config：仅用来「填补本地缺失的非敏感字段」，绝不覆盖本地主动修改
  try {
    const serverConfig = await loadProfileAiConfig(uid)
    if (serverConfig && serverConfig.provider) {
      merged.provider = (localConfig.provider as AiProvider) || (merged.provider !== defaultAiConfig.provider ? merged.provider : serverConfig.provider)
      merged.baseUrl = localConfig.baseUrl || merged.baseUrl || serverConfig.baseUrl || ''
      merged.model = localConfig.model || merged.model || serverConfig.model || ''
      merged.systemPrompt = localConfig.systemPrompt || serverConfig.systemPrompt || merged.systemPrompt
    }
  } catch (error) {
    console.warn('[ai] 读取云端配置失败，使用本地配置', error)
  }

  return merged
}

export function saveAiConfig(config: AiConfig, userId?: string) {
  if (typeof window === 'undefined') {
    return
  }

  void (async () => {
    const { uid } = await resolveCurrentUser(userId)
    // 未登录：不落任何持久化存储，防止配置串号
    if (!uid) return

    const apiKey = config.apiKey.trim()
    // 配置正文不含密钥；密钥加密后单独存储（账号独立命名空间）
    const rest = {
      provider: config.provider,
      baseUrl: config.baseUrl,
      model: config.model,
      systemPrompt: config.systemPrompt
    }
    try {
      window.localStorage.setItem(cfgKeyFor(uid), JSON.stringify(rest))
    } catch { /* ignore */ }

    if (apiKey) {
      try {
        const enc = await encryptSecret(apiKey)
        try {
          window.localStorage.setItem(secretKeyFor(uid), enc)
        } catch { /* ignore */ }
        // 云端留存（密文）：配置一次，下次登录 / 换设备自动带出；删除账号时级联清除
        void saveOwnAiKey(uid, {
          provider: config.provider,
          baseUrl: config.baseUrl,
          model: config.model,
          encryptedKey: enc
        })
      } catch { /* ignore */ }
    }

    // 非敏感配置同步到云端 profiles（跨 PC / 移动端自动带出）
    void saveProfileAiConfig(uid, config)
  })()
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
      const raw = data?.error?.message || data?.message || `百炼请求失败，状态码：${response.status}`
      throw new Error(translateBailianError(sanitizeMessage(raw)))
    }

    const content = data?.choices?.[0]?.message?.content || ''
    if (typeof content === 'string' && content.trim()) {
      trackUsage('bailian', config.model || 'qwen-turbo', userPrompt, content, data?.usage)
      // 扣减阿里百炼免费额度（真实用量优先，取不到则按字符数 / 4 估算）
      const used =
        Number(data?.usage?.total_tokens) || Math.ceil((userPrompt.length + content.length) / 4)
      void addModelUsage(`bailian:${config.model || 'qwen-turbo'}`, used)
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

/** 实时新闻种子（传入 AI 用于提炼） */
export interface NewsSeed {
  title: string
  source: string
  pubDate: string
}

/** AI 基于新闻提炼出的热点结果 */
export interface HotspotResult {
  title: string
  summary: string
  source: string
  pubDate: string
  rank: number
}

/**
 * 沸爻机核心：把「实时新闻种子」+「用户想提取的信息要求」交给 AI 提炼。
 * 强约束：只能引用传入的新闻素材，必须保留来源与时间，杜绝编造/旧闻。
 * 返回结构化 HotspotResult 数组（按重要度排序）。
 */
export async function extractHotspotsFromNews(
  config: AiConfig,
  seeds: NewsSeed[],
  instruction: string,
  topN = 8
): Promise<HotspotResult[]> {
  if (!seeds.length) {
    throw new Error('没有可分析的实时新闻，请先在新闻聚合刷新或切换分类')
  }
  const material = seeds
    .slice(0, 40)
    .map((s, i) => `${i + 1}. [${s.pubDate}] ${s.title}（来源：${s.source}）`)
    .join('\n')

  const prompt =
    `你是一名专业的信息分析助手。下面是一批来自 Google News 的实时中文新闻素材（已按时间排序，均为近期新闻）：\n\n` +
    `${material}\n\n` +
    `用户希望从中提取的信息要求如下：\n"""${instruction}"""\n\n` +
    `请严格基于上述新闻素材进行提取与归纳，遵守以下规则：\n` +
    `1. 只能引用给定素材中的新闻，不得编造、不得使用素材之外的旧闻或记忆内容；\n` +
    `2. 每条结果必须标注其依据的「来源」和「时间(pubDate)」，以便用户追溯原文；\n` +
    `3. 输出一个 JSON 数组（不要任何代码块标记、不要额外解释），最多 ${topN} 条；` +
    `每条对象字段：\n` +
    `   - "title": 提炼后的标题（简洁，25 字内）\n` +
    `   - "summary": 一句话要点（50 字内）\n` +
    `   - "source": 来源媒体（从素材中选取，原样保留）\n` +
    `   - "pubDate": 时间（原样保留素材中的 pubDate）\n` +
    `   - "rank": 重要度排序（1 为最相关/最重要）\n` +
    `若素材不足以回答用户要求，返回空数组 []。`

  const reply = await callAi(config, prompt)
  return parseHotspotReply(reply, topN)
}

function parseHotspotReply(text: string, topN: number): HotspotResult[] {
  let raw = (text || '').trim()
  const fence = raw.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fence) raw = fence[1].trim()
  try {
    const arr = JSON.parse(raw)
    if (Array.isArray(arr)) {
      return arr
        .map((it: any) => ({
          title: String(it.title || it.标题 || '').trim(),
          summary: String(it.summary || it.摘要 || it.要点 || '').trim(),
          source: String(it.source || it.来源 || '').trim(),
          pubDate: String(it.pubDate || it.时间 || '').trim(),
          rank: Number(it.rank || it.排名) || 0
        }))
        .filter((it: HotspotResult) => it.title)
        .slice(0, topN)
    }
  } catch {
    /* 非 JSON，回退空 */
  }
  return []
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
