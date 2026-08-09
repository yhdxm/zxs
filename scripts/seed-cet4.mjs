// 四六级备考台 · 一键灌入四级词库
// 用法（在项目根目录执行，需先配置 .env 中的 VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY）：
//   node scripts/seed-cet4.mjs
// 说明：读取 scripts/cet4_words.csv，按 word 去重 upsert 进 public.cet4_words。
//       重复执行安全（已存在则更新）。纯前端依赖 @supabase/supabase-js，免费。

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')

// 简易读取项目根 .env（不覆盖已存在的进程环境变量）
function loadEnv() {
  const p = path.join(root, '.env')
  if (!fs.existsSync(p)) return
  for (const line of fs.readFileSync(p, 'utf-8').split('\n')) {
    const m = line.match(/^\s*([\w.-]+)\s*=\s*(.*)\s*$/)
    if (!m) continue
    const k = m[1]
    let v = m[2].trim()
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
    if (!(k in process.env)) process.env[k] = v
  }
}
loadEnv()

const url = process.env.VITE_SUPABASE_URL
const key = process.env.VITE_SUPABASE_ANON_KEY
if (!url || !key) {
  console.error('❌ 缺少 VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY，请在项目根 .env 配置后重试。')
  process.exit(1)
}

const supabase = createClient(url, key, { auth: { persistSession: false } })

// RFC4180 感知的 CSV 行解析：正确处理双引号包裹字段内的逗号
function splitCsvLine(line) {
  const out = []
  let cur = ''
  let inQ = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (inQ) {
      if (c === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++ } else inQ = false
      } else cur += c
    } else {
      if (c === '"') inQ = true
      else if (c === ',') { out.push(cur); cur = '' } else cur += c
    }
  }
  out.push(cur)
  return out
}

const csvPath = path.join(root, 'scripts', 'cet4_words.csv')
if (!fs.existsSync(csvPath)) {
  console.error('❌ 找不到', csvPath, '——请先确保词库 CSV 已生成。')
  process.exit(1)
}

const text = fs.readFileSync(csvPath, 'utf-8').replace(/^\uFEFF/, '')
const lines = text.split(/\r?\n/).filter((l) => l.trim())
const header = splitCsvLine(lines[0]).map((h) => h.trim().toLowerCase())
const wi = header.indexOf('word')
const pi = header.indexOf('phonetic')
const posi = header.indexOf('pos')
const di = header.indexOf('definition')
const ci = header.indexOf('collocation')
if (wi < 0) { console.error('❌ CSV 缺少 word 列'); process.exit(1) }

const rows = []
for (let i = 1; i < lines.length; i++) {
  const c = splitCsvLine(lines[i])
  const word = (c[wi] || '').trim()
  if (!word) continue
  rows.push({
    word,
    phonetic: pi >= 0 ? (c[pi] || '').trim() || null : null,
    pos: posi >= 0 ? (c[posi] || '').trim() || null : null,
    definition: di >= 0 ? (c[di] || '').trim() || null : null,
    collocation: ci >= 0 ? (c[ci] || '').trim() || null : null
  })
}
console.log('📚 待导入词条：', rows.length)

const CHUNK = 500
let done = 0
for (let i = 0; i < rows.length; i += CHUNK) {
  const chunk = rows.slice(i, i + CHUNK)
  const { error } = await supabase.from('cet4_words').upsert(chunk, { onConflict: 'word' })
  if (error) {
    console.error('❌ 第', i, '块写入失败：', error.message)
    process.exit(1)
  }
  done += chunk.length
  console.log(`✓ 已写入 ${done}/${rows.length}`)
}
console.log('🎉 完成，共导入', done, '个四级单词到 public.cet4_words')
