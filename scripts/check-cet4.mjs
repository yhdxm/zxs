// 验证 Supabase 中 cet4_prep 相关表是否已创建，以及 cet4_words 是否已灌入词库。
// 仅做只读查询，不修改任何数据。不依赖 dotenv，自行解析 .env。
import { createClient } from '@supabase/supabase-js'
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

const envPath = resolve(process.cwd(), '.env')
let url = '', key = ''
if (existsSync(envPath)) {
  const txt = readFileSync(envPath, 'utf-8')
  for (const line of txt.split(/\r?\n/)) {
    const m = line.match(/^\s*(VITE_SUPABASE_[A-Z_]+)\s*=\s*(.*)\s*$/)
    if (m) {
      let v = m[2].trim()
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
        v = v.slice(1, -1)
      }
      if (m[1] === 'VITE_SUPABASE_URL') url = v
      if (m[1] === 'VITE_SUPABASE_ANON_KEY') key = v
    }
  }
}

if (!url || !key) {
  console.error('缺少 VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY，请在 .env 中配置')
  process.exit(2)
}

const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false }
})

const TABLES = [
  'cet4_words',
  'cet4_prep_progress',
  'cet4_prep_practice',
  'cet4_prep_mistakes',
  'cet4_prep_checkins',
  'cet4_prep_settings'
]

let allOk = true
console.log('=== 表存在性 / 行数检查 ===')
for (const t of TABLES) {
  try {
    const { count, error } = await supabase
      .from(t)
      .select('*', { count: 'exact', head: true })
    if (error) {
      console.log(`[缺失/错误] ${t}: ${error.message}`)
      allOk = false
    } else {
      console.log(`[OK]       ${t}: ${count} 行`)
    }
  } catch (e) {
    console.log(`[异常]     ${t}: ${e.message}`)
    allOk = false
  }
}

process.exit(allOk ? 0 : 1)
