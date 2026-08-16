import './assets/main.css'
import './assets/markdown.css'
import './assets/theme.css'

import { createApp } from 'vue'
import App from './App.vue'
// 引入路由（你刚建好的router/index.ts）
import router from './router'
// 应用启动时确保当前用户的工作台数据行存在（Supabase 不可达时降级本地）
import { initDatabase } from './services/dbInit'
// 全局同步看门狗：保证学位英语/四六级个人数据在 PC 与移动端最终一致（离线队列自动补发）
import { startSyncWatcher } from './prep/syncWatcher'

// PC端UI组件 Element Plus
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import 'element-plus/theme-chalk/dark/css-vars.css'
// 中文语言包（日期选择器、分页等组件中文化）
import zhCn from 'element-plus/es/locale/lang/zh-cn'
// 移动端UI组件 Vant4
import Vant from 'vant'
import 'vant/lib/index.css'

const app = createApp(App)
// 注册路由，页面跳转功能靠这行
app.use(router)
app.use(ElementPlus, { locale: zhCn })
app.use(Vant)

// 全局运行时错误兜底层：任何渲染/逻辑异常都变为可见红条，避免静默白屏（如移动端崩溃难以排查）
app.config.errorHandler = (err, _instance, info) => {
  const msg = err instanceof Error ? err.message : String(err)
  console.error('[全局错误]', info, err)
  if (typeof document !== 'undefined') {
    let bar = document.getElementById('global-error-bar')
    if (!bar) {
      bar = document.createElement('div')
      bar.id = 'global-error-bar'
      bar.style.cssText =
        'position:fixed;top:0;left:0;right:0;z-index:99999;background:#ef4444;color:#fff;' +
        'font-size:13px;line-height:1.5;padding:10px 14px;box-shadow:0 2px 8px rgba(0,0,0,.25);' +
        'font-family:system-ui,-apple-system,"PingFang SC","Microsoft YaHei",sans-serif;'
      document.body.appendChild(bar)
    }
    bar.textContent = `页面运行出错（请截图反馈）：${msg} 〔${info || ''}〕`
  }
}

// 静默初始化工作台数据（优雅降级，失败不影响页面渲染）
void initDatabase()
// 启动全局同步看门狗（离线队列自动补发，覆盖 PC/移动端）
startSyncWatcher()

app.mount('#app')