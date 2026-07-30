// 阿里百炼免费模型清单（自动生成，请勿手改）
// 由 scripts/genBailianModels.mjs 依据 scripts/bailian_models_input.txt 生成。
// 每个模型统一标记 isFree=true，并带免费额度(freeQuota)与有效期(freeUntil)。
// 免费额度以阿里百炼控制台「免费额度」档为准：1,000,000 tokens / 模型，有效期至 2026-09-20。
import type { CallableModel } from './modelCatalog'

const BAILIAN_BASE = 'https://dashscope.aliyuncs.com/compatible-mode/v1'
const FREE_QUOTA = 1000000
const FREE_UNTIL = '2026-09-20'

function bailian(id: string, model: string, label: string): CallableModel {
  return {
    id: `bailian:${id}`,
    provider: 'bailian',
    baseUrl: BAILIAN_BASE,
    model,
    isFree: true,
    label: `阿里百炼 · ${label}（免费）`,
    note: `免费额度 ${FREE_QUOTA.toLocaleString()} · 有效期至 ${FREE_UNTIL}`,
    freeQuota: FREE_QUOTA,
    freeUntil: FREE_UNTIL
  }
}

export const BAILIAN_MODELS: CallableModel[] = [
  bailian("qwen-turbo", "qwen-turbo", "qwen-turbo"),
  bailian("qwen-plus", "qwen-plus", "qwen-plus"),
  bailian("qwen-plus-2025-07-28", "qwen-plus-2025-07-28", "qwen-plus-2025-07-28"),
  bailian("qwen-max", "qwen-max", "qwen-max"),
  bailian("qwen-math-turbo", "qwen-math-turbo", "qwen-math-turbo"),
  bailian("qwen3.7-plus", "qwen3.7-plus", "qwen3.7-plus"),
  bailian("qwen3-vl-235b-a22b-thinking", "qwen3-vl-235b-a22b-thinking", "qwen3-vl-235b-a22b-thinking"),
  bailian("qwen3-vl-32b-thinking", "qwen3-vl-32b-thinking", "qwen3-vl-32b-thinking"),
  bailian("deepseek-r1-distill-qwen-7b", "deepseek-r1-distill-qwen-7b", "deepseek-r1-distill-qwen-7b"),
  bailian("glm-5", "glm-5", "glm-5"),
  bailian("qwen-long", "qwen-long", "qwen-long"),
  bailian("qwen-vl-plus", "qwen-vl-plus", "qwen-vl-plus"),
  bailian("qwen2.5-72b-instruct", "qwen2.5-72b-instruct", "qwen2.5-72b-instruct"),
  bailian("qwen3-235b-a22b", "qwen3-235b-a22b", "qwen3-235b-a22b")
]
