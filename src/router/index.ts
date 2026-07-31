import { createRouter, createWebHashHistory } from 'vue-router'
import LandingView from '../views/LandingView.vue'
import LoginView from '../views/LoginView.vue'
import DashboardView from '../views/DashboardView.vue'
import AiAssistantView from '../views/AiAssistantView.vue'
import SystemManageView from '../views/SystemManageView.vue'
import AccountSettingsView from '../views/AccountSettingsView.vue'
import DatabaseCheckView from '../views/DatabaseCheckView.vue'
import AutomationInfoView from '../views/AutomationInfoView.vue'
import ModelCenterView from '../views/ModelCenterView.vue'
import RequirementCollectView from '../views/RequirementCollectView.vue'
import WeatherView from '../views/WeatherView.vue'
import MapView from '../views/MapView.vue'
import NewsAggregateView from '../views/NewsAggregateView.vue'
import YingCangView from '../views/YingCangView.vue'
import { hasPermission, loadPermissionConfig, getSavedUser } from '../services/appDataService'

const router = createRouter({
  history: createWebHashHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      redirect: '/dashboard'
    },
    {
      path: '/ai',
      name: 'ai',
      component: AiAssistantView,
      meta: { requirePermission: 'ai' }
    },
    {
      path: '/landing',
      name: 'landing',
      component: LandingView
    },
    {
      path: '/login',
      name: 'login',
      component: LoginView
    },
    {
      path: '/dashboard',
      name: 'dashboard',
      component: DashboardView,
      meta: { requirePermission: 'dashboard' }
    },
    {
      path: '/system',
      name: 'system',
      component: SystemManageView,
      meta: { requirePermission: 'system' }
    },
    {
      path: '/account',
      name: 'account',
      component: AccountSettingsView
    },
    {
      path: '/database',
      name: 'database',
      component: DatabaseCheckView,
      meta: { requirePermission: 'database' }
    },
    {
      path: '/automation',
      name: 'automation',
      component: AutomationInfoView,
      meta: { requirePermission: 'automation' }
    },
    {
      path: '/models',
      name: 'models',
      component: ModelCenterView,
      meta: { requirePermission: 'ai' }
    },
    {
      path: '/requirements',
      name: 'requirements',
      component: RequirementCollectView,
      meta: { requirePermission: 'dashboard' }
    },
    {
      path: '/weather',
      name: 'weather',
      component: WeatherView,
      meta: { requirePermission: 'dashboard' }
    },
    {
      path: '/map',
      name: 'map',
      component: MapView,
      meta: { requirePermission: 'dashboard' }
    },
    {
      path: '/news',
      name: 'news',
      component: NewsAggregateView,
      meta: { requirePermission: 'dashboard' }
    },
    {
      path: '/yingcang',
      name: 'yingcang',
      component: YingCangView,
      meta: { requirePermission: 'dashboard' }
    }
  ]
})

// ===== 全站登录门禁 =====
// 未登录访问任何非登录页都重定向到 /login（最外层登录页）；
// 已登录访问 /login 则直接进入工作台（登录后默认落地页，实现“工作台前移”）。
// 注意：这里必须真实验证 Supabase 会话，不能只看 localStorage，否则 token 过期后仍会进入内部页。
router.beforeEach(async (to, _from, next) => {
  const user = await getSavedUser()
  const isAuthenticated = Boolean(user)

  if (!isAuthenticated && to.name !== 'login') {
    next({ name: 'login' })
    return
  }

  if (isAuthenticated && to.name === 'login') {
    next({ name: 'dashboard' })
    return
  }

  // 权限校验（优先于角色校验，支持按 PC/移动端动态判断）
  const requirePermission = to.meta.requirePermission as string | undefined
  if (requirePermission && user) {
    const platform = typeof window !== 'undefined' && window.innerWidth <= 768 ? 'mobile' : 'pc'
    const config = await loadPermissionConfig()
    if (!hasPermission(user, requirePermission, platform, config)) {
      next({ name: 'dashboard' })
      return
    }
  }

  // 保留角色校验（向后兼容）
  const requiredRole = to.meta.requireRole as string | string[] | undefined
  if (requiredRole) {
    const allowed = Array.isArray(requiredRole) ? requiredRole : [requiredRole]
    if (!allowed.includes(user?.role || '')) {
      next({ name: 'dashboard' })
      return
    }
  }

  next()
})

export default router