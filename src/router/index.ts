import { createRouter, createWebHashHistory } from 'vue-router'
import { hasPermission, loadPermissionConfig, getSavedUser, DEFAULT_ROLE_CONFIG, type AppUser } from '../services/appDataService'

/** 给可能走网络的 Promise 包超时兜底：超时即 resolve fallback，避免路由守卫永久 pending（移动端弱网一直加载）。 */
function withTimeout<T>(p: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([p, new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms))])
}

// 路由守卫高频调用 getSavedUser，加短周期内存缓存避免每次导航都请求 Supabase
//（ especially 移动端弱网/被墙时，supabase.auth.getSession 可能触发网络刷新）。
let cachedUser: AppUser | null | undefined
let cachedUserAt = 0
const USER_CACHE_TTL_MS = 3000

export function clearRouterUserCache(): void {
  cachedUser = undefined
  cachedUserAt = 0
}

async function getCachedSavedUser(): Promise<AppUser | null> {
  if (cachedUser !== undefined && Date.now() - cachedUserAt < USER_CACHE_TTL_MS) {
    return cachedUser
  }
  const user = await getSavedUser()
  cachedUser = user
  cachedUserAt = Date.now()
  return user
}

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
      component: () => import('../views/AiAssistantView.vue'),
      meta: { requirePermission: 'ai' }
    },
    {
      path: '/landing',
      name: 'landing',
      component: () => import('../views/LandingView.vue')
    },
    {
      path: '/login',
      name: 'login',
      component: () => import('../views/LoginView.vue')
    },
    {
      path: '/dashboard',
      name: 'dashboard',
      component: () => import('../views/DashboardView.vue'),
      meta: { requirePermission: 'dashboard' }
    },
    {
      path: '/system',
      name: 'system',
      component: () => import('../views/SystemManageView.vue'),
      meta: { requirePermission: 'system' }
    },
    {
      path: '/account',
      name: 'account',
      component: () => import('../views/AccountSettingsView.vue')
    },
    {
      path: '/database',
      name: 'database',
      component: () => import('../views/DatabaseCheckView.vue'),
      meta: { requirePermission: 'database' }
    },
    {
      path: '/automation',
      name: 'automation',
      component: () => import('../views/AutomationInfoView.vue'),
      meta: { requirePermission: 'automation' }
    },
    {
      path: '/models',
      name: 'models',
      component: () => import('../views/ModelCenterView.vue'),
      meta: { requirePermission: 'models' }
    },
    {
      path: '/requirements',
      name: 'requirements',
      component: () => import('../views/RequirementCollectView.vue'),
      meta: { requirePermission: 'requirements' }
    },
    {
      path: '/weather',
      name: 'weather',
      component: () => import('../views/WeatherView.vue'),
      meta: { requirePermission: 'weather' }
    },
    {
      path: '/map',
      name: 'map',
      component: () => import('../views/MapView.vue'),
      meta: { requirePermission: 'map' }
    },
    {
      path: '/news',
      name: 'news',
      component: () => import('../views/NewsAggregateView.vue'),
      meta: { requirePermission: 'news' }
    },
    {
      path: '/yingcang',
      name: 'yingcang',
      component: () => import('../views/YingCangView.vue'),
      meta: { requirePermission: 'yingcang' }
    },
    {
      path: '/xingyu',
      name: 'xingyu',
      component: () => import('../views/XingYuView.vue'),
      meta: { requirePermission: 'xingyu' }
    },
    {
      path: '/aimodels',
      name: 'aimodels',
      component: () => import('../views/AiModelsView.vue'),
      meta: { requirePermission: 'aimodels' }
    },
    {
      path: '/learn/english',
      name: 'learn-english',
      component: () => import('../views/LearnEnglishView.vue'),
      meta: { requirePermission: 'learn-english' }
    },
    {
      path: '/learn/industry',
      name: 'learn-industry',
      component: () => import('../views/LearnIndustryView.vue'),
      meta: { requirePermission: 'learn-industry' }
    },
    {
      path: '/learn/books',
      name: 'learn-books',
      component: () => import('../views/LearnBooksView.vue'),
      meta: { requirePermission: 'learn-books' }
    },
    {
      path: '/learn/goals',
      name: 'learn-goals',
      component: () => import('../views/LearningGoalsView.vue'),
      meta: { requirePermission: 'learn-goals' }
    },
    {
      path: '/learn/cet-prep',
      name: 'cet-prep',
      component: () => import('../views/CetPrepView.vue'),
      meta: { requirePermission: 'cet-prep' }
    },
    {
      path: '/learn/degree-english',
      name: 'degree-english',
      component: () => import('../views/DegreeEnglishView.vue'),
      meta: { requirePermission: 'learn-english' }
    },
    // ===== 学位英语备考台 2.0 模块（数据已落地数据库，见 scripts/degree-english-schema.sql） =====
    {
      path: '/degree/home',
      name: 'degree-home',
      component: () => import('../views/learn/degree/DegreePrepHome.vue'),
      meta: { requirePermission: 'learn-english' }
    },
    {
      path: '/degree/materials',
      name: 'degree-materials',
      component: () => import('../views/learn/degree/DegreeMaterialsView.vue'),
      meta: { requirePermission: 'learn-english' }
    },
    {
      path: '/degree/reader',
      name: 'degree-reader',
      component: () => import('../views/learn/degree/DegreeReaderView.vue'),
      meta: { requirePermission: 'learn-english' }
    },
    {
      path: '/degree/words',
      name: 'degree-words',
      component: () => import('../views/learn/degree/DegreeWordsView.vue'),
      meta: { requirePermission: 'learn-english' }
    },
    {
      path: '/degree/training',
      name: 'degree-training',
      component: () => import('../views/learn/degree/DegreeTrainingView.vue'),
      meta: { requirePermission: 'learn-english' }
    },
    {
      path: '/degree/practice',
      name: 'degree-practice',
      component: () => import('../views/learn/degree/DegreePracticeView.vue'),
      meta: { requirePermission: 'learn-english' }
    },
    {
      path: '/degree/exam',
      name: 'degree-exam',
      component: () => import('../views/learn/degree/DegreeExamView.vue'),
      meta: { requirePermission: 'learn-english' }
    },
    {
      path: '/degree/mine',
      name: 'degree-mine',
      component: () => import('../views/learn/degree/DegreeMineView.vue'),
      meta: { requirePermission: 'learn-english' }
    },
    {
      path: '/degree/weakness',
      name: 'degree-weakness',
      component: () => import('../views/learn/degree/DegreeWeaknessView.vue'),
      meta: { requirePermission: 'learn-english' }
    },
    {
      path: '/learn/weakness',
      name: 'weakness',
      component: () => import('../views/WeaknessView.vue'),
      meta: { requirePermission: 'weakness' }
    },
    {
      path: '/third-api',
      name: 'third-api',
      component: () => import('../views/ThirdPartyApiView.vue'),
      meta: { requirePermission: 'third-api' }
    },
    {
      path: '/feedback',
      name: 'feedback',
      component: () => import('../views/FeedbackView.vue'),
      meta: { requirePermission: 'feedback' }
    },
    {
      path: '/feedback-admin',
      name: 'feedback-admin',
      component: () => import('../views/FeedbackAdminView.vue'),
      meta: { requirePermission: 'feedback.admin' }
    },
    {
      path: '/push',
      name: 'push',
      component: () => import('../views/PushManageView.vue'),
      meta: { requirePermission: 'system' }
    },
    {
      path: '/welcome',
      name: 'welcome',
      component: () => import('../views/WelcomeView.vue')
    }
  ]
})

// ===== 全站登录门禁 =====
// 未登录访问任何非登录页都重定向到 /login（最外层登录页）；
// 已登录访问 /login 则直接进入工作台（登录后默认落地页，实现“工作台前移”）。
// 注意：这里必须真实验证 Supabase 会话，不能只看 localStorage，否则 token 过期后仍会进入内部页。
router.beforeEach(async (to, _from, next) => {
  const user = await getCachedSavedUser()
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
    // 权限配置首次加载仍走 Supabase 网络，包超时兜底，避免弱网下守卫卡死（配合 appDataService 内 30s 缓存，后续命中缓存秒回）。
    const config = await withTimeout(loadPermissionConfig(), 3000, DEFAULT_ROLE_CONFIG)
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