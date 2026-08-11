import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'

// 生产构建剔除 console.* / debugger 调用。
// 说明：本环境为 rolldown-vite（vite 8 + oxc 压缩），OxcOptions 的 minify 类型未暴露 drop 配置，
// 且 terser 不可用，故用自定义 rollup 插件在 renderChunk 阶段（仅生产环境）按括号平衡扫描删除
// console.* 调用及 debugger 语句，避免调试信息进入生产包。
function dropConsolePlugin() {
  const CONSOLE_RE = /\bconsole\.(log|info|warn|error|debug|trace)\s*\(/g
  const stripConsole = (code: string): string => {
    let result = ''
    let last = 0
    let m: RegExpExecArray | null
    CONSOLE_RE.lastIndex = 0
    while ((m = CONSOLE_RE.exec(code)) !== null) {
      const start = m.index
      result += code.slice(last, start)
      // 从 '(' 之后做括号平衡扫描，正确处理嵌套与跨行
      let i = start + m[0].length - 1 // 指向 '('
      let depth = 0
      let inStr: string | null = null
      let escaped = false
      let closed = false
      for (i = i + 1; i < code.length; i++) {
        const ch = code[i]
        if (inStr) {
          if (escaped) escaped = false
          else if (ch === '\\') escaped = true
          else if (ch === inStr) inStr = null
          continue
        }
        if (ch === '"' || ch === "'" || ch === '`') {
          inStr = ch
          continue
        }
        if (ch === '(') depth++
        else if (ch === ')') {
          if (depth === 0) {
            closed = true
            break
          }
          depth--
        }
      }
      if (closed) last = i + 1
      else {
        last = start
        break
      }
    }
    result += code.slice(last)
    return result
  }
  return {
    name: 'drop-console',
    apply: 'build' as const,
    enforce: 'post' as const,
    renderChunk(code: string) {
      return stripConsole(code).replace(/\bdebugger\s*;/g, '')
    }
  }
}

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
    // 第三方库（element-plus / echarts 等）已单独拆成 vendor chunk 且路由懒加载，体积不计入首屏，放宽告警阈值
    chunkSizeWarningLimit: 1000,
    // 注意：本项目 rolldown-vite 环境下 oxc 压缩 + 自定义 dropConsolePlugin 会导致生产包入口 chunk 损坏、
    // 页面白屏（#app 为空、无任何报错）。已验证 minify:false（且移除 dropConsolePlugin）可正常挂载渲染。
    // 暂用 minify:false 保证可上线；后续如需压缩，需在 Linux CI 单独验证挂载后再启用。
    minify: false,
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
