import { createClient } from '@supabase/supabase-js'

// 仅从环境变量读取，禁止硬编码任何 URL / key
const url = process.env.VITE_SUPABASE_URL
const key = process.env.VITE_SUPABASE_ANON_KEY

if (!url || !key) {
  console.error('[verify] 缺少环境变量 VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY，请先配置 .env')
  process.exit(1)
}
const supabase = createClient(url, key)

const tables = ['app_accounts', 'profiles', 'app_dashboard_data']

for (const table of tables) {
  const { data, error } = await supabase.from(table).select('*').limit(1)
  if (error) {
    console.log(`[${table}] ERROR:`, error.message)
  } else {
    console.log(`[${table}] OK:`, data)
  }
}
