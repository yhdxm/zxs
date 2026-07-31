// AI 模型知识数据层 — 全部免费、可降级。
//  - 全球模型：Hugging Face 公共 API（免费、无需 key，按下载量排序）
//  - 模型热点：复用 newsService（Google News RSS + 三级代理兜底）

import { fetchNews, type NewsItem } from './newsService'
import { fetchCorsJson } from './freeApi'

export interface GlobalModel {
  id: string
  author: string
  model: string
  downloads: number
  likes: number
  task: string
  tags: string[]
  updated: string
  gated: boolean
}

interface HfModel {
  id?: string
  downloads?: number
  likes?: number
  pipeline_tag?: string
  tags?: string[]
  lastModified?: string
  gated?: boolean | string
}

/** 模型任务/类型分类（用于前端筛选标签） */
export const MODEL_TASKS = [
  'text-generation', 'text2text-generation', 'image-text-to-text', 'automatic-speech-recognition',
  'text-to-speech', 'image-classification', 'object-detection', 'sentence-similarity',
  'fill-mask', 'translation', 'summarization', 'question-answering', 'visual-question-answering'
]

/** 知名全球模型兜底清单（HF 不可达时展示，全部为公开知名模型） */
export const FALLBACK_MODELS: GlobalModel[] = [
  { id: 'openai/gpt-4o', author: 'OpenAI', model: 'GPT-4o', downloads: 0, likes: 0, task: '多模态', tags: ['LLM', '多模态'], updated: '', gated: false },
  { id: 'anthropic/claude-3-5-sonnet', author: 'Anthropic', model: 'Claude 3.5 Sonnet', downloads: 0, likes: 0, task: '多模态', tags: ['LLM', '多模态'], updated: '', gated: false },
  { id: 'google/gemini-1.5-pro', author: 'Google', model: 'Gemini 1.5 Pro', downloads: 0, likes: 0, task: '多模态', tags: ['LLM', '多模态'], updated: '', gated: false },
  { id: 'meta-llama/llama-3.1-70b', author: 'Meta', model: 'Llama 3.1 70B', downloads: 0, likes: 0, task: 'text-generation', tags: ['LLM', '开源'], updated: '', gated: false },
  { id: 'mistralai/mixtral-8x7b', author: 'Mistral', model: 'Mixtral 8x7B', downloads: 0, likes: 0, task: 'text-generation', tags: ['LLM', '开源', 'MoE'], updated: '', gated: false },
  { id: 'Qwen/Qwen2.5-72B', author: '阿里通义', model: 'Qwen2.5-72B', downloads: 0, likes: 0, task: 'text-generation', tags: ['LLM', '开源', '中文'], updated: '', gated: false },
  { id: 'deepseek-ai/DeepSeek-V3', author: 'DeepSeek', model: 'DeepSeek-V3', downloads: 0, likes: 0, task: 'text-generation', tags: ['LLM', '开源', '中文'], updated: '', gated: false },
  { id: 'stabilityai/stable-diffusion-3', author: 'Stability', model: 'Stable Diffusion 3', downloads: 0, likes: 0, task: 'text-to-image', tags: ['图像', '开源'], updated: '', gated: false },
  { id: 'openai/whisper-large-v3', author: 'OpenAI', model: 'Whisper Large v3', downloads: 0, likes: 0, task: 'automatic-speech-recognition', tags: ['语音', '开源'], updated: '', gated: false },
  { id: 'sentence-transformers/all-MiniLM-L6-v2', author: 'sentence-transformers', model: 'all-MiniLM-L6-v2', downloads: 0, likes: 0, task: 'sentence-similarity', tags: ['嵌入', '开源'], updated: '', gated: false }
]

/** 拉取 Hugging Face 全球模型榜单（按下载量），失败返回兜底清单。 */
export async function fetchGlobalModels(limit = 30): Promise<GlobalModel[]> {
  try {
    const data = await fetchCorsJson<HfModel[]>(
      `https://huggingface.co/api/models?sort=downloads&limit=${limit}&full=false`
    )
    if (Array.isArray(data) && data.length) {
      return data
        .filter((m) => m.id)
        .map((m) => {
          const parts = (m.id as string).split('/')
          const author = parts.length > 1 ? (parts[0] ?? 'community') : 'community'
          const model = parts.length > 1 ? parts.slice(1).join('/') : (m.id as string)
          return {
            id: m.id as string,
            author,
            model,
            downloads: m.downloads ?? 0,
            likes: m.likes ?? 0,
            task: m.pipeline_tag ?? (m.tags?.includes('text-generation') ? 'text-generation' : '其他'),
            tags: (m.tags ?? []).slice(0, 6),
            updated: m.lastModified ? m.lastModified.slice(0, 10) : '',
            gated: Boolean(m.gated)
          }
        })
    }
  } catch {
    /* 走兜底 */
  }
  return FALLBACK_MODELS
}

/** 模型相关热点新闻 */
export async function fetchModelNews(keyword = 'AI 大模型', limit = 20): Promise<NewsItem[]> {
  try {
    return await fetchNews({ keyword, limit })
  } catch {
    return []
  }
}
