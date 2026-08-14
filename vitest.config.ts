import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'

// 仅对纯逻辑做单测：vitest + vue 编译 + jsdom（提供 window/localStorage/DOMParser）
export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./test/setup.ts'],
    include: ['test/**/*.test.ts'],
    clearMocks: true,
    restoreMocks: true,
    // 修复管控/权限测试套件在并行线程池下偶发 ENOENT：
    // 各文件挂载组件时会实例化真实 Supabase Auth 客户端并写临时锁文件，
    // 多线程共享同一 os.tmpdir 产生竞态。改用 forks 池 + 单 fork，
    // 让所有测试在单一进程串行执行，彻底消除跨线程临时目录冲突。
    pool: 'forks',
    // Vitest 4：原 poolOptions.forks.* 已提升为顶层选项。
    // 保持单 fork 串行，避免各测试文件挂载组件时实例化真实 Supabase Auth
    // 客户端写 os.tmpdir 临时锁文件，多线程共享产生 ENOENT 竞态（管控/权限套件偶发飘红）。
    singleFork: true,
    // 单测环境注入占位 Supabase 变量：仅为满足 createClient 的非空校验，
    // 不会发出真实请求（客户端在 setup.ts 中已整体桩化）。
    env: {
      VITE_SUPABASE_URL: 'http://localhost:54321',
      VITE_SUPABASE_ANON_KEY: 'test-anon-key',
    },
  },
})
