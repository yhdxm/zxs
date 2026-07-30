// 免费可调用模型目录 + 实时可用性监测（模型中心「免费模型清单」依赖）。
// 数据源：OpenRouter 公开模型 API（无需 Key，前端直连）+ 各厂商公开免费档枚举。
// 全程纯前端调用，不消耗任何积分/额度，不写入云端。

import { CALLABLE_MODELS, type CallableModel } from './modelCatalog'

/** 模型状态：可调用 / 受限 / 不可用 / 未知 */
export type FreeModelStatusKind = 'callable' | 'limited' | 'unavailable' | 'unknown'

/** 免费模型目录项（与 free_model_catalog 表结构对齐） */
export interface FreeModelCatalogEntry {
  provider: string
  model: string
  endpoint?: string
  isFree: boolean
  freeQuota?: string
  status: FreeModelStatusKind
  note?: string
}

/** 免费模型状态（含检测时间），供前端表格渲染 */
export interface FreeModelStatusV2 extends FreeModelCatalogEntry {
  lastChecked: number | null
  source: 'curated' | 'live'
}

/** 经人工筛选的稳定免费模型（多厂商：硅基流动 / 智谱 / DeepSeek / 火山 / OpenRouter / Ollama） */
export const CURATED_FREE_MODELS: FreeModelCatalogEntry[] = CALLABLE_MODELS.filter((m) => m.isFree).map(
  (m: CallableModel): FreeModelCatalogEntry => ({
    provider: m.provider,
    model: m.model,
    endpoint: m.baseUrl,
    isFree: true,
    freeQuota: m.note,
    status: 'callable',
    note: m.label
  })
)

/** 旧版接口类型（保留兼容） */
export interface FreeModelEntry {
  id: string
  provider: string
  model: string
  description: string
  note: string
}
export interface FreeModelStatus extends FreeModelEntry {
  available: boolean | null
  lastChecked: number | null
  source: 'curated' | 'live'
}

/**
 * 多厂商免费模型清单检测（V2）。
 * - 以各厂商公开免费档为基准（curated），状态标记为 callable / limited。
 * - 对 OpenRouter 额外尝试拉取公开模型列表（pricing 全 0 即免费）做 live 可用性标注。
 * 注意：仅做目录级可用性监测，不发起真实推理调用，因此不消耗任何积分。
 */
export async function checkFreeModelsV2(): Promise<FreeModelStatusV2[]> {
  const list: FreeModelStatusV2[] = CURATED_FREE_MODELS.map((m) => ({
    ...m,
    lastChecked: Date.now(),
    source: 'curated' as const
  }))

  // 仅在 OpenRouter 存在时尝试 live 检测
  const orItems = list.filter((m) => m.provider === 'openrouter')
  if (orItems.length > 0) {
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
        const arr = Array.isArray(data) ? data : data?.data || []
        liveFree = new Set<string>()
        for (const m of arr) {
          const p = m?.pricing
          if (p && String(p.prompt) === '0' && String(p.completion) === '0') {
            liveFree.add(m.id)
          }
        }
      }
    } catch {
      liveFree = null
    }

    if (liveFree) {
      for (const item of orItems) {
        item.source = 'live'
        item.status = liveFree.has(item.model) ? 'callable' : 'unavailable'
      }
    }
  }

  return list
}

/** 旧版检测函数（保留，供兼容）；内部复用 V2 并映射回旧结构 */
export async function checkFreeModels(): Promise<FreeModelStatus[]> {
  const v2 = await checkFreeModelsV2()
  const idMap = new Map(CALLABLE_MODELS.map((m) => [m.model, m.id]))
  return v2.map((m) => ({
    id: idMap.get(m.model) || m.model,
    provider: m.provider,
    model: m.model,
    description: m.note || '',
    note: m.freeQuota || '',
    available: m.status === 'callable' ? true : m.status === 'unavailable' ? false : null,
    lastChecked: m.lastChecked,
    source: m.source
  }))
}
