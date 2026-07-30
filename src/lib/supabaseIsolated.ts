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
    }
  }
)
