import { createClient } from '@supabase/supabase-js'

// 隔离的 Supabase 客户端：仅用于后台管理员创建新用户时不污染当前登录会话。
// 使用内存 storage，不写入 localStorage，避免 signUp 后当前超管会话被顶替。
const memoryStorage = () => {
  const store: Record<string, string> = {}
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => {
      store[key] = value
    },
    removeItem: (key: string) => {
      delete store[key]
    }
  }
}

/**
 * 带超时的 fetch 包装：与 supabaseClient.ts 保持一致，避免后台管理请求在弱网/被墙时永久挂起。
 */
function createTimeoutFetch(timeoutMs: number): typeof fetch {
  return (input: RequestInfo | URL, init?: RequestInit) => {
    const controller = new AbortController()
    const id = setTimeout(() => controller.abort(), timeoutMs)
    return fetch(input, { ...(init || {}), signal: controller.signal })
      .finally(() => clearTimeout(id))
  }
}

export const isolatedSupabase = createClient(
  import.meta.env.VITE_SUPABASE_URL ?? '',
  import.meta.env.VITE_SUPABASE_ANON_KEY ?? '',
  {
    auth: {
      storageKey: 'isolated-auth-token',
      storage: memoryStorage(),
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false
    },
    global: { fetch: createTimeoutFetch(8000) }
  }
)
