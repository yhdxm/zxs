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
import XingYuView from '../views/XingYuView.vue'
import AiModelsView from '../views/AiModelsView.vue'
import LearnEnglishView from '../views/LearnEnglishView.vue'
import LearnIndustryView from '../views/LearnIndustryView.vue'
import LearnBooksView from '../views/LearnBooksView.vue'
import LearningGoalsView from '../views/LearningGoalsView.vue'
import ThirdPartyApiView from '../views/ThirdPartyApiView.vue'
import FeedbackView from '../views/FeedbackView.vue'
import FeedbackAdminView from '../views/FeedbackAdminView.vue'
import ResponsiveShowcaseView from '../views/ResponsiveShowcaseView.vue'
import WelcomeView from '../views/WelcomeView.vue'
import { hasPermission, loadPermissionConfig, getSavedUser } from '../services/appDataService'

// 数据看板（同一路由 /dashboard 通过 query.view 区分）的细粒度权限映射
const DASHBOARD_VIEW_PERM: Record<string, string> = {
  overview: 'dashboard',
  todos: 'todos',
  points: 'points',
  contents: 'contents'
}

const router = createRouter({
  history: createWebHashHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      redirect: '/welcome'
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
      meta: { requirePermission: 'models' }
    },
    {
      path: '/requirements',
      name: 'requirements',
      component: RequirementCollectView,
      meta: { requirePermission: 'requirements' }
    },
    {
      path: '/weather',
      name: 'weather',
      component: WeatherView,
      meta: { requirePermission: 'weather' }
    },
    {
      path: '/map',
      name: 'map',
      component: MapView,
      meta: { requirePermission: 'map' }
    },
    {
      path: '/news',
      name: 'news',
      component: NewsAggregateView,
      meta: { requirePermission: 'news' }
    },
    {
      path: '/yingcang',
      name: 'yingcang',
      component: YingCangView,
      meta: { requirePermission: 'yingcang' }
    },
    {
      path: '/xingyu',
      name: 'xingyu',
      component: XingYuView,
      meta: { requirePermission: 'xingyu' }
    },
    {
      path: '/aimodels',
      name: 'aimodels',
      component: AiModelsView,
      meta: { requirePermission: 'aimodels' }
    },
    {
      path: '/learn/english',
      name: 'learn-english',
      component: LearnEnglishView,
      meta: { requirePermission: 'learn-english' }
    },
    {
      path: '/learn/industry',
      name: 'learn-industry',
      component: LearnIndustryView,
      meta: { requirePermission: 'learn-industry' }
    },
    {
      path: '/learn/books',
      name: 'learn-books',
      component: LearnBooksView,
      meta: { requirePermission: 'learn-books' }
    },
    {
      path: '/learn/goals',
      name: 'learn-goals',
      component: LearningGoalsView
    },
    {
      path: '/third-api',
      name: 'third-api',
      component: ThirdPartyApiView,
      meta: { requirePermission: 'third-api' }
    },
    {
      path: '/feedback',
      name: 'feedback',
      component: FeedbackView,
      meta: { requirePermission: 'feedback' }
    },
    {
      path: '/feedback-admin',
      name: 'feedback-admin',
      component: FeedbackAdminView,
      meta: { requirePermission: 'feedback.admin' }
    },
    {
      path: '/responsive',
      name: 'responsive',
      component: ResponsiveShowcaseView
    },
    {
      path: '/welcome',
      name: 'welcome',
      component: WelcomeView
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
    next({ name: 'welcome' })
    return
  }

  // 权限校验（优先于角色校验，支持按 PC/移动端动态判断）
  const requirePermission = to.meta.requirePermission as string | undefined
  if (requirePermission && user) {
    // 数据看板按 query.view 细分权限（数据看板/待办/点位/内容）
    let moduleKey = requirePermission
    if (to.path === '/dashboard') {
      const view = (to.query.view as string) || 'overview'
      moduleKey = DASHBOARD_VIEW_PERM[view] || 'dashboard'
    }
    const platform = typeof window !== 'undefined' && window.innerWidth <= 768 ? 'mobile' : 'pc'
    const config = await loadPermissionConfig()
    if (!hasPermission(user, moduleKey, platform, config)) {
      // 权限不足：跳转到「用户有权限的第一个页面」，避免无限重定向到被拒页面（白屏/无反应）。
      // 优先回主页 dashboard；若连 dashboard 都无权限，则回 account（已登录恒可访问），杜绝死循环。
      if (moduleKey !== 'dashboard' && hasPermission(user, 'dashboard', platform, config)) {
        next({ name: 'dashboard' })
      } else {
        next({ name: 'account' })
      }
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