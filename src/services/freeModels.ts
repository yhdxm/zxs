// 免费可调用模型目录 + 实时可用性监测（功能4）
// 数据源：OpenRouter 公开模型 API（无需 Key，前端直连）+ 本地 Ollama。
// 全程纯前端调用，不消耗任何积分/额度，不写入云端。

export interface FreeModelEntry {
  id: string
  provider: string
  model: string
  description: string
  note: string
}

// 经人工筛选的稳定免费模型（OpenRouter 免费档 + 本地 Ollama）
export const CURATED_FREE_MODELS: FreeModelEntry[] = [
  {
    id: 'ollama:llama3.2',
    provider: 'Ollama',
    model: 'llama3.2',
    description: '本地运行，零成本、零隐私外泄',
    note: '需本机安装 Ollama 并执行 ollama pull llama3.2'
  },
  {
    id: 'ollama:qwen2.5',
    provider: 'Ollama',
    model: 'qwen2.5',
    description: '本地运行，中文能力强',
    note: 'ollama pull qwen2.5'
  },
  {
    id: 'ollama:deepseek-r1',
    provider: 'Ollama',
    model: 'deepseek-r1',
    description: '本地推理模型，可思考链',
    note: 'ollama pull deepseek-r1'
  },
  {
    id: 'openrouter:deepseek/deepseek-chat-v3-0324:free',
    provider: 'OpenRouter',
    model: 'deepseek/deepseek-chat-v3-0324:free',
    description: '免费对话模型',
    note: '需 OpenRouter API Key，模型本身免费'
  },
  {
    id: 'openrouter:meta-llama/llama-3.3-70b-instruct:free',
    provider: 'OpenRouter',
    model: 'meta-llama/llama-3.3-70b-instruct:free',
    description: '免费大模型',
    note: '需 OpenRouter API Key'
  },
  {
    id: 'openrouter:qwen/qwen-2.5-72b-instruct:free',
    provider: 'OpenRouter',
    model: 'qwen/qwen-2.5-72b-instruct:free',
    description: '免费中文大模型',
    note: '需 OpenRouter API Key'
  },
  {
    id: 'openrouter:google/gemini-2.0-flash-exp:free',
    provider: 'OpenRouter',
    model: 'google/gemini-2.0-flash-exp:free',
    description: '免费多模态模型',
    note: '需 OpenRouter API Key'
  }
]

export interface FreeModelStatus extends FreeModelEntry {
  available: boolean | null
  lastChecked: number | null
  source: 'curated' | 'live'
}

/**
 * 检测免费模型可用性。
 * - 优先拉取 OpenRouter 公开模型列表（pricing 全 0 即免费），标注 live 可用状态。
 * - 拉取失败（如 CORS / 离线）则降级为 curated，Ollama 类标记「未知」。
 * 注意：仅做目录级可用性监测，不发起真实推理调用，因此不消耗任何积分。
 */
export async function checkFreeModels(): Promise<FreeModelStatus[]> {
  let liveFree: Set<string> | null = null
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 8000)
    const res = await fetch('https://openrouter.ai/api/v1/models', {
      headers: { Accept: 'application/json' },
      signal: controller.signal
    })
    clearTimeout(timer)
    if (res.ok) {
      const data = await res.json()
      const list = Array.isArray(data) ? data : data?.data || []
      liveFree = new Set<string>()
      for (const m of list) {
        const p = m?.pricing
        if (p && String(p.prompt) === '0' && String(p.completion) === '0') {
          liveFree.add(m.id)
        }
      }
    }
  } catch {
    liveFree = null
  }

  return CURATED_FREE_MODELS.map((m) => {
    let available: boolean | null = null
    let source: 'curated' | 'live' = 'curated'
    if (liveFree) {
      source = 'live'
      available = liveFree.has(m.id)
    } else if (m.provider === 'Ollama') {
      available = null
    }
    return { ...m, available, lastChecked: Date.now(), source }
  })
}
