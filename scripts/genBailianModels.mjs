// 阿里百炼免费模型清单生成器
// 读取 scripts/bailian_models_input.txt（每行一个模型： 模型名 或 模型名|展示名）
// 生成 src/services/bailianModels.generated.ts
// 用法：node scripts/genBailianModels.mjs
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const INPUT = resolve(ROOT, 'scripts/bailian_models_input.txt')
const OUTPUT = resolve(ROOT, 'src/services/bailianModels.generated.ts')

const FREE_QUOTA = 1000000
const FREE_UNTIL = '2026-09-20'

function parse() {
  const raw = readFileSync(INPUT, 'utf8')
  const rows = []
  for (const line of raw.split(/\r?\n/)) {
    const t = line.trim()
    if (!t || t.startsWith('#')) continue
    const [model, label] = t.split('|').map((s) => s.trim())
    if (!model) continue
    rows.push({ model, label: label || model })
  }
  return rows
}

function gen(rows) {
  const items = rows
    .map(
      (r) =>
        `  bailian(${JSON.stringify(r.model)}, ${JSON.stringify(r.model)}, ${JSON.stringify(r.label)})`
    )
    .join(',\n')

  return `// 阿里百炼免费模型清单（自动生成，请勿手改）
// 由 scripts/genBailianModels.mjs 依据 scripts/bailian_models_input.txt 生成。
// 每个模型统一标记 isFree=true，并带免费额度(freeQuota)与有效期(freeUntil)。
// 免费额度以阿里百炼控制台「免费额度」档为准：1,000,000 tokens / 模型，有效期至 2026-09-20。
import type { CallableModel } from './modelCatalog'

const BAILIAN_BASE = 'https://dashscope.aliyuncs.com/compatible-mode/v1'
const FREE_QUOTA = ${FREE_QUOTA}
const FREE_UNTIL = '${FREE_UNTIL}'

function bailian(id: string, model: string, label: string): CallableModel {
  return {
    id: \`bailian:\${id}\`,
    provider: 'bailian',
    baseUrl: BAILIAN_BASE,
    model,
    isFree: true,
    label: \`阿里百炼 · \${label}（免费）\`,
    note: \`免费额度 \${FREE_QUOTA.toLocaleString()} · 有效期至 \${FREE_UNTIL}\`,
    freeQuota: FREE_QUOTA,
    freeUntil: FREE_UNTIL
  }
}

export const BAILIAN_MODELS: CallableModel[] = [
${items}
]
`
}

const rows = parse()
if (!rows.length) {
  console.error('未解析到任何模型，请检查 scripts/bailian_models_input.txt')
  process.exit(1)
}
writeFileSync(OUTPUT, gen(rows), 'utf8')
console.log(`已生成 ${rows.length} 个百炼免费模型 -> src/services/bailianModels.generated.ts`)
