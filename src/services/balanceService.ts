// 供应商账户额度查询（模型中心「实时额度卡片」依赖）。
// 当前仅硅基流动 SiliconFlow 暴露完整的余额接口：GET {baseUrl}/v1/user/info/balance。
// 其他厂商（智谱 / DeepSeek / 火山 / OpenRouter / 百炼）未提供统一免费额度接口，
// 统一返回「不支持 / 需到各自控制台查看」的兜底结果，绝不伪造余额。
//
// 安全约定：apiKey 仅在此浏览器内存中使用，用于发起带 Bearer 的请求，绝不写入 localStorage 或云端。

import type { AiProvider } from './aiService'

export interface ProviderBalance {
  /** 供应商标识，如 siliconflow / zhipu / openrouter */
  provider: string
  /** 总余额（硅基流动返回） */
  totalBalance: number
  /** 免费额度（若有） */
  freeBalance?: number
  /** 货币单位，如 CNY / USD */
  currency?: string
  /** 查询时间戳（毫秒） */
  fetchedAt: number
  /** 是否成功取到真实余额 */
  supported: boolean
  /** 不支持时的提示文案 */
  hint?: string
}

const SILICONFLOW_BASE = 'https://api.siliconflow.cn'

/**
 * 查询供应商额度。
 * @param provider 供应商（AiProvider 或扩展名）
 * @param baseUrl 接口基地址（不含 /v1/... 后缀）
 * @param apiKey 用户本地保存的密钥（仅用于本次请求，不持久化到本地/云端）
 */
export async function getProviderBalance(
  provider: string,
  baseUrl: string,
  apiKey: string
): Promise<ProviderBalance> {
  const fetchedAt = Date.now()
  const base = (baseUrl || '').replace(/\/$/, '')

  // 仅硅基流动支持公开余额接口
  if (provider === 'siliconflow' || (base.includes('siliconflow') && !apiKey)) {
    if (!apiKey) {
      return {
        provider,
        totalBalance: 0,
        fetchedAt,
        supported: false,
        hint: '请先在「AI 助手」配置中填入硅基流动 API Key 后再查看额度'
      }
    }
    return await querySiliconFlow(base || SILICONFLOW_BASE, apiKey, fetchedAt)
  }

  // 其他厂商暂不支持统一余额接口
  return {
    provider,
    totalBalance: 0,
    fetchedAt,
    supported: false,
    hint: '该供应商未提供统一的免费额度查询接口，请前往其控制台查看使用情况'
  }
}

async function querySiliconFlow(baseUrl: string, apiKey: string, fetchedAt: number): Promise<ProviderBalance> {
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 8000)
    const res = await fetch(`${baseUrl}/v1/user/info/balance`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: controller.signal
    })
    clearTimeout(timer)

    if (!res.ok) {
      return {
        provider: 'siliconflow',
        totalBalance: 0,
        fetchedAt,
        supported: false,
        hint: res.status === 401 ? '密钥无效或未授权（401），请检查硅基流动 API Key' : `查询失败，状态码 ${res.status}`
      }
    }

    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>
    // 硅基流动返回结构示例：{ code, message, data: { totalBalance, totalBalanceUSD, freeBalance, ... } }
    const d = (data?.data ?? {}) as Record<string, unknown>
    const total = Number(d.totalBalance ?? d.balance ?? 0)
    const free = Number(d.freeBalance ?? 0)
    return {
      provider: 'siliconflow',
      totalBalance: Number.isFinite(total) ? total : 0,
      freeBalance: Number.isFinite(free) ? free : undefined,
      currency: 'CNY',
      fetchedAt,
      supported: true
    }
  } catch (error) {
    const msg = error instanceof Error && error.name === 'AbortError' ? '请求超时（8s）' : '网络错误，请确认网络或 CORS 设置'
    return {
      provider: 'siliconflow',
      totalBalance: 0,
      fetchedAt,
      supported: false,
      hint: msg
    }
  }
}

/** 供模型中心「已配置模型」卡片使用：从本地配置读取当前激活的 provider / baseUrl / apiKey 来源 */
export function resolveConfiguredModel(
  config: { provider: AiProvider | string; baseUrl: string; model: string }
): { provider: string; baseUrl: string; model: string } {
  return {
    provider: config.provider,
    baseUrl: config.baseUrl,
    model: config.model
  }
}
