// AI 模型实时趋势 —— Hugging Face 公共 API（免费、无需 Key）
// 纯前端直连，失败时静默返回空数组，由调用方自行降级。

import { fetchCorsJson } from './freeApi'

export interface TrendModel {
  id: string
  likes: number
  downloads: number
  pipelineTag: string
  updatedAt: string
}

export async function fetchHfTrending(limit = 8): Promise<TrendModel[]> {
  const data = await fetchCorsJson<Array<{
    id?: string
    likes?: number
    downloads?: number
    pipeline_tag?: string
    lastModified?: string
  }>>(
    `https://huggingface.co/api/models?sort=trendingScore&direction=-1&limit=${limit}&full=false`,
    { timeout: 10000 }
  )
  if (!Array.isArray(data)) return []
  return data
    .filter((m) => m.id)
    .map((m) => ({
      id: m.id as string,
      likes: m.likes ?? 0,
      downloads: m.downloads ?? 0,
      pipelineTag: m.pipeline_tag || '模型',
      updatedAt: m.lastModified || ''
    }))
}
