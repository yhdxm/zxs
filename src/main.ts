import './assets/main.css'
import './assets/markdown.css'
import './assets/theme.css'

import { createApp } from 'vue'
import App from './App.vue'
// 引入路由（你刚建好的router/index.ts）
import router from './router'
// 应用启动时确保当前用户的工作台数据行存在（Supabase 不可达时降级本地）
import { initDatabase } from './services/dbInit'

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

// 静默初始化工作台数据（优雅降级，失败不影响页面渲染）
void initDatabase()

app.mount('#app')