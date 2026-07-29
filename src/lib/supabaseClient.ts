import { createClient } from '@supabase/supabase-js'

// Supabase 客户端统一入口：仅从环境变量读取（.env 中的 VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY）
// 安全约定：禁止在此硬编码任何 URL / key。生产构建必须在 .env 中提供，否则连接将失败。
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error(
    '[supabase] 缺少环境变量 VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY，' +
    '请在项目根目录 .env 中配置后重新构建（密钥严禁硬编码进代码）。'
  )
}

export const supabase = createClient(supabaseUrl ?? '', supabaseKey ?? '')
