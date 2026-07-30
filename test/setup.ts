import { vi } from 'vitest'

// Supabase 客户端在浏览器侧创建，本环境无 VITE_SUPABASE_URL/KEY。
// 所有纯逻辑单测都不应触达真实网络，这里把 lib/supabaseClient 整体桩化，
// 返回可任意链式调用的代理，避免模块加载期 createClient 报错。
vi.mock('../src/lib/supabaseClient', () => {
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  const chain = new Proxy(function () {} as unknown as object, {
    get: () => chain,
    apply: () => chain,
  })
  return { supabase: chain }
})
