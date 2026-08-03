import { vi } from 'vitest'

// Supabase 客户端在浏览器侧创建，本环境无真实后端。
// 所有纯逻辑单测都不应触达真实网络，这里把两个客户端模块整体桩化，
// 返回可任意链式调用的代理，避免模块加载期 createClient 报错。
//
// 注意：代理对 'then' 返回 undefined，否则它会被当成 thenable，
// 导致 `await supabase.from(x).select()` 永久挂起。

vi.mock('../src/lib/supabaseClient', () => {
  const chain: unknown = new Proxy(function () {} as unknown as object, {
    get: (_t, prop) => (prop === 'then' ? undefined : chain),
    apply: () => chain,
  })
  return { supabase: chain }
})

// 隔离客户端（后台创建账号时避免顶替当前会话）同样在模块加载期 createClient，
// 必须一并桩化，否则 appDataService / externalIdeas / geoService 等测试会在 import 阶段崩溃。
vi.mock('../src/lib/supabaseIsolated', () => {
  const chain: unknown = new Proxy(function () {} as unknown as object, {
    get: (_t, prop) => (prop === 'then' ? undefined : chain),
    apply: () => chain,
  })
  return { isolatedSupabase: chain }
})
