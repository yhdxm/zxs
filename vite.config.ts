import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'

// https://vite.dev/config/
export default defineConfig({
  base: './',
  plugins: [
    vue(),
    vueDevTools(),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  build: {
    rollupOptions: {
      output: {
        // 代码分割：把大依赖拆成独立 chunk，首屏只加载当前路由需要的部分，
        // 显著降低移动端首次进入的 JS 解析/下载压力。
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('element-plus')) return 'vendor-element-plus'
            if (id.includes('vant')) return 'vendor-vant'
            if (id.includes('@supabase')) return 'vendor-supabase'
            if (id.includes('echarts')) return 'vendor-echarts'
            if (id.includes('leaflet')) return 'vendor-leaflet'
            if (id.includes('vue') || id.includes('vue-router') || id.includes('pinia')) return 'vendor-vue'
            return 'vendor'
          }
        }
      }
    }
  },
  server: {
    // 安全默认：仅监听本机。需要手机/局域网联调时运行 npm run dev:lan
    host: 'localhost',
    port: 5173,
    strictPort: true,
    proxy: {
      '/ollama': {
        target: 'http://localhost:11434',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/ollama/, '')
      }
    }
  }
})
