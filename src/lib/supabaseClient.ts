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

/**
 * 带超时的 fetch 包装：Supabase 默认 fetch 无超时，移动端弱网/被墙时请求会永久 pending，
 * 导致加载中遮罩永远不消失。这里统一限制单次请求最长 8 秒，超时后 AbortController 触发 abort，
 * 让上层 try/catch 能走降级逻辑。
 */
function createTimeoutFetch(timeoutMs: number): typeof fetch {
  return (input: RequestInfo | URL, init?: RequestInit) => {
    const controller = new AbortController()
    const id = setTimeout(() => controller.abort(), timeoutMs)
    return fetch(input, { ...(init || {}), signal: controller.signal })
      .finally(() => clearTimeout(id))
  }
}

export const supabase = createClient(
  supabaseUrl ?? '',
  supabaseKey ?? '',
  { global: { fetch: createTimeoutFetch(8000) } }
)
