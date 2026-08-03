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
    // 单测环境注入占位 Supabase 变量：仅为满足 createClient 的非空校验，
    // 不会发出真实请求（客户端在 setup.ts 中已整体桩化）。
    env: {
      VITE_SUPABASE_URL: 'http://localhost:54321',
      VITE_SUPABASE_ANON_KEY: 'test-anon-key',
    },
  },
})
