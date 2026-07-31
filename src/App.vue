<template>
  <!-- 初始化 loading：登录态确认前不渲染内部页面，避免未登录布局闪烁 -->
  <div v-if="initializing && route.name !== 'login'" class="app-loading">
    <el-icon class="loading-icon"><Loading /></el-icon>
    <span>加载中...</span>
  </div>

  <!-- 最外层登录页：未登录访问 /login 时仅渲染登录页（全屏，不带任何导航） -->
  <div v-else-if="route.name === 'login'" class="login-screen">
    <router-view />
  </div>

  <!-- 已登录：左侧全局侧边栏 + 主区域 -->
  <div v-else-if="isLoggedIn" class="app-shell is-authed">
    <aside class="app-sidebar">
      <div class="side-brand">
        <svg class="brand-logo-img" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Smart Dashboard">
          <rect x="6" y="6" width="52" height="52" rx="14" fill="#6366f1" />
          <g fill="#ffffff">
            <rect x="16" y="36" width="8" height="12" rx="2" />
            <rect x="28" y="28" width="8" height="20" rx="2" />
            <rect x="40" y="20" width="8" height="28" rx="2" />
          </g>
        </svg>
        <div class="brand-text">
          <span class="brand-name">Smart</span>
          <span class="brand-suffix">Dashboard</span>
        </div>
      </div>

      <div class="side-search">
        <el-input
          v-model="menuSearch"
          size="default"
          placeholder="搜索菜单"
          clearable
        >
          <template #prefix><el-icon><Search /></el-icon></template>
        </el-input>
      </div>

      <nav class="side-nav">
        <template v-for="item in filteredSideMenu" :key="item.key">
          <button
            v-if="!item.children"
            class="side-item"
            :class="{ active: isMenuActive(item.key) }"
            @click="goMenu(item)"
          >
            <el-icon><component :is="item.icon" /></el-icon>
            <span>{{ item.label }}</span>
          </button>

          <div v-else class="side-group">
            <button
              class="side-item side-group-title"
              :class="{ active: isMenuActive(item.key), expanded: item.expanded }"
              @click="toggleGroup(item.key)"
            >
              <el-icon><component :is="item.icon" /></el-icon>
              <span>{{ item.label }}</span>
              <el-icon class="group-arrow"><ArrowDown /></el-icon>
            </button>
            <div v-show="item.expanded" class="side-group-children">
              <button
                v-for="child in item.children"
                :key="child.key"
                class="side-item side-child"
                :class="{ active: isMenuActive(child.key) }"
                @click="goMenu(child)"
              >
                <span class="child-dot"></span>
                <span>{{ child.label }}</span>
              </button>
            </div>
          </div>
        </template>
      </nav>

      <div class="side-footer">
        <button class="theme-toggle" @click="toggleTheme" :title="theme === 'dark' ? '切换到浅色模式' : '切换到深色模式'">
          <el-icon><component :is="theme === 'dark' ? Sunny : Moon" /></el-icon>
          <span class="toggle-label">{{ theme === 'dark' ? '深色模式' : '浅色模式' }}</span>
          <span class="theme-switch" :class="{ on: theme === 'dark' }"></span>
        </button>
        <div class="commercial-card">
          <svg class="commercial-logo" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Smart Dashboard">
            <rect x="6" y="6" width="52" height="52" rx="14" fill="#6366f1" />
            <g fill="#ffffff">
              <rect x="16" y="36" width="8" height="12" rx="2" />
              <rect x="28" y="28" width="8" height="20" rx="2" />
              <rect x="40" y="20" width="8" height="28" rx="2" />
            </g>
          </svg>
          <span class="commercial-pro">PRO</span>
        </div>
      </div>
    </aside>

    <!-- 主区域 -->
    <div class="app-main">
      <header class="app-topbar">
        <div class="topbar-left">
          <el-button text class="menu-btn" @click="mobileNavVisible = true">
            <el-icon><Menu /></el-icon>
          </el-button>
          <span class="page-title">{{ currentTitle }}</span>
        </div>
        <div class="topbar-user">
          <span class="user-avatar">{{ avatarText }}</span>
          <div class="user-meta">
            <span class="user-nickname">{{ currentUser?.nickname || '用户' }}</span>
            <span class="user-role">{{ roleLabel }}</span>
          </div>
          <el-button class="user-logout" text circle @click="handleLogout">
            <el-icon><SwitchButton /></el-icon>
          </el-button>
        </div>
      </header>
      <main class="main-content authed-main">
        <router-view v-slot="{ Component }">
          <transition name="fade" mode="out-in">
            <component :is="Component" />
          </transition>
        </router-view>
      </main>
    </div>

    <!-- 已登录：移动端抽屉 -->
    <el-drawer v-model="mobileNavVisible" direction="ltr" size="280px" :with-header="false" class="mobile-drawer">
      <div class="drawer-brand">
        <svg class="brand-logo-img" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Smart Dashboard">
          <rect x="6" y="6" width="52" height="52" rx="14" fill="#6366f1" />
          <g fill="#ffffff">
            <rect x="16" y="36" width="8" height="12" rx="2" />
            <rect x="28" y="28" width="8" height="20" rx="2" />
            <rect x="40" y="20" width="8" height="28" rx="2" />
          </g>
        </svg>
        <div class="brand-text">
          <span class="brand-name">Smart</span>
          <span class="brand-suffix">Dashboard</span>
        </div>
      </div>
      <div class="drawer-search">
        <el-input v-model="menuSearch" size="default" placeholder="搜索菜单" clearable>
          <template #prefix><el-icon><Search /></el-icon></template>
        </el-input>
      </div>
      <nav class="side-nav">
        <template v-for="item in filteredSideMenu" :key="item.key">
          <button
            v-if="!item.children"
            class="side-item"
            :class="{ active: isMenuActive(item.key) }"
            @click="goMenu(item)"
          >
            <el-icon><component :is="item.icon" /></el-icon>
            <span>{{ item.label }}</span>
          </button>

          <div v-else class="side-group">
            <button
              class="side-item side-group-title"
              :class="{ active: isMenuActive(item.key), expanded: item.expanded }"
              @click="toggleGroup(item.key)"
            >
              <el-icon><component :is="item.icon" /></el-icon>
              <span>{{ item.label }}</span>
              <el-icon class="group-arrow"><ArrowDown /></el-icon>
            </button>
            <div v-show="item.expanded" class="side-group-children">
              <button
                v-for="child in item.children"
                :key="child.key"
                class="side-item side-child"
                :class="{ active: isMenuActive(child.key) }"
                @click="goMenu(child)"
              >
                <span class="child-dot"></span>
                <span>{{ child.label }}</span>
              </button>
            </div>
          </div>
        </template>
      </nav>
      <div class="drawer-footer">
        <button class="theme-toggle" @click="toggleTheme" :title="theme === 'dark' ? '切换到浅色模式' : '切换到深色模式'">
          <el-icon><component :is="theme === 'dark' ? Sunny : Moon" /></el-icon>
          <span class="toggle-label">{{ theme === 'dark' ? '深色模式' : '浅色模式' }}</span>
          <span class="theme-switch" :class="{ on: theme === 'dark' }"></span>
        </button>
        <div class="drawer-commercial">
          <svg class="commercial-logo" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Smart Dashboard">
            <rect x="6" y="6" width="52" height="52" rx="14" fill="#6366f1" />
            <g fill="#ffffff">
              <rect x="16" y="36" width="8" height="12" rx="2" />
              <rect x="28" y="28" width="8" height="20" rx="2" />
              <rect x="40" y="20" width="8" height="28" rx="2" />
            </g>
          </svg>
          <span class="commercial-pro">PRO</span>
        </div>
        <div class="drawer-user">
          <span class="user-avatar">{{ avatarText }}</span>
          <div class="user-meta">
            <span class="user-nickname">{{ currentUser?.nickname || '用户' }}</span>
            <span class="user-role">{{ roleLabel }}</span>
          </div>
        </div>
        <el-button type="danger" plain class="full" @click="handleLogout">
          <el-icon><SwitchButton /></el-icon> 退出登录
        </el-button>
      </div>
    </el-drawer>
  </div>

  <!-- 未登录：保留原全局侧边栏 + 移动端抽屉（公开页 / LandingView 等） -->
  <div v-else class="app-shell">
    <header class="mobile-topbar">
      <el-button text class="menu-btn" @click="drawerVisible = true">
        <span class="menu-icon">☰</span>
      </el-button>
      <div class="brand">Smart Dashboard</div>
      <div class="topbar-user">{{ currentUser?.nickname || '' }}</div>
    </header>

    <el-drawer v-model="drawerVisible" direction="ltr" size="230px" :with-header="false">
      <div class="drawer-brand">Smart Dashboard</div>
      <nav class="side-menu">
        <button
          v-for="item in menuItems"
          :key="item.path"
          class="menu-item"
          :class="{ active: isActive(item.path) }"
          @click="navigate(item.path)"
        >
          <span class="menu-item-icon">{{ item.icon }}</span>
          <span>{{ item.label }}</span>
        </button>
      </nav>
      <div class="drawer-footer">
        <el-button v-if="currentUser" type="danger" plain class="full" @click="handleLogout">退出登录</el-button>
        <el-button v-else type="primary" plain class="full" @click="navigate('/login')">登录 / 注册</el-button>
      </div>
    </el-drawer>

    <div class="layout">
      <aside class="sidebar">
        <div class="sidebar-brand">Smart Dashboard</div>
        <nav class="side-menu">
          <button
            v-for="item in menuItems"
            :key="item.path"
            class="menu-item"
            :class="{ active: isActive(item.path) }"
            @click="navigate(item.path)"
          >
            <span class="menu-item-icon">{{ item.icon }}</span>
            <span>{{ item.label }}</span>
          </button>
        </nav>
        <div class="sidebar-footer">
          <template v-if="currentUser">
            <div class="user-chip">{{ currentUser.nickname }}</div>
            <el-button type="danger" plain size="small" class="full" @click="handleLogout">退出登录</el-button>
          </template>
          <el-button v-else type="primary" plain size="small" class="full" @click="navigate('/login')">登录 / 注册</el-button>
        </div>
      </aside>

      <main class="main-content">
        <router-view v-slot="{ Component }">
          <transition name="fade" mode="out-in">
            <component :is="Component" />
          </transition>
        </router-view>
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import type { Component } from 'vue'
import {
  MagicStick,
  DataBoard,
  List,
  Location,
  Document,
  SwitchButton,
  Menu,
  Setting,
  User,
  Search,
  ArrowDown,
  Coin,
  Sunny,
  Moon,
  DataAnalysis,
  TrendCharts,
  Compass,
  Loading,
  Histogram
} from '@element-plus/icons-vue'
import {
  logoutUser, getSavedUser, refreshSavedUser,
  hasPermission, hasModulePermission, loadPermissionConfig, type PermissionConfig,
  type AppUser
} from './services/appDataService'

const router = useRouter()
const route = useRoute()
const drawerVisible = ref(false)
const mobileNavVisible = ref(false)
const currentUser = ref<AppUser | null>(null)
const menuSearch = ref('')
const permissionConfig = ref<PermissionConfig | null>(null)
const isMobile = ref(false)
const initializing = ref(true)
const platform = computed(() => (isMobile.value ? 'mobile' : 'pc'))

const isLoggedIn = computed(() => Boolean(currentUser.value))
const avatarText = computed(() => (currentUser.value?.nickname || '用').slice(0, 1).toUpperCase())

/* ===== 主题切换（浅色 / 深色） ===== */
const theme = ref<'light' | 'dark'>(
  (typeof localStorage !== 'undefined' && localStorage.getItem('zxs-theme') === 'dark') ? 'dark' : 'light'
)
function applyTheme(t: 'light' | 'dark') {
  const root = document.documentElement
  root.classList.toggle('dark', t === 'dark')
  root.setAttribute('data-theme', t)
  try { localStorage.setItem('zxs-theme', t) } catch { /* ignore */ }
}
function toggleTheme() {
  theme.value = theme.value === 'dark' ? 'light' : 'dark'
  applyTheme(theme.value)
}
const roleLabel = computed(() => {
  const role = currentUser.value?.role
  if (role === 'superadmin') return '超级管理员'
  if (role === 'admin') return '管理员'
  return '普通用户'
})

/* ===== 已登录：左侧全局侧边栏菜单 ===== */
interface SideItem {
  key: string
  label: string
  icon?: Component
  to?: string | { path: string; query: Record<string, string> }
  visible?: (user: AppUser | null) => boolean
  permissionKey?: string
  children?: SideItem[]
  expanded?: boolean
}
const canManageSystem = (u: AppUser | null) => u?.role === 'superadmin' || u?.role === 'admin'

const sideMenu = reactive<SideItem[]>([
  { key: 'database', label: '数据库监测', icon: Coin, permissionKey: 'database', to: '/database' },
  {
    key: 'lianzhicang',
    label: '联智舱',
    icon: MagicStick,
    expanded: true,
    permissionKey: 'ai',
    children: [
      { key: 'ai', label: 'AI 助手', icon: MagicStick, permissionKey: 'ai', to: '/ai' },
      { key: 'models', label: '模型中心', icon: DataAnalysis, permissionKey: 'ai', to: '/models' }
    ]
  },
  {
    key: 'fanjingzhixie',
    label: '凡境智协',
    icon: Compass,
    expanded: true,
    permissionKey: 'dashboard',
    children: [
      {
        key: 'news',
        label: '新闻聚合',
        icon: TrendCharts,
        permissionKey: 'dashboard',
        expanded: true,
        children: [
          { key: 'news-main', label: '新闻', icon: TrendCharts, permissionKey: 'dashboard', to: '/news' },
          { key: 'yingcang', label: '影仓智核', icon: Histogram, permissionKey: 'dashboard', to: '/yingcang' }
        ]
      },
      { key: 'weather', label: '天气', icon: Sunny, permissionKey: 'dashboard', to: '/weather' },
      { key: 'map', label: '地图', icon: Location, permissionKey: 'dashboard', to: '/map' },
      { key: 'automation-info', label: '自动化信息', icon: Document, permissionKey: 'automation', to: '/automation' }
    ]
  },
  { key: 'requirements', label: '需求收集', icon: TrendCharts, permissionKey: 'dashboard', to: '/requirements' },
  {
    key: 'worktasks',
    label: '工作任务',
    icon: List,
    expanded: true,
    permissionKey: 'worktasks',
    children: [
      { key: 'overview', label: '数据看板', icon: DataBoard, permissionKey: 'dashboard', to: { path: '/dashboard', query: { view: 'overview' } } },
      { key: 'todos', label: '待办', icon: List, permissionKey: 'todos', to: { path: '/dashboard', query: { view: 'todos' } } },
      { key: 'points', label: '点位', icon: Location, permissionKey: 'points', to: { path: '/dashboard', query: { view: 'points' } } },
      { key: 'contents', label: '内容', icon: Document, permissionKey: 'contents', to: { path: '/dashboard', query: { view: 'contents' } } }
    ]
  },
  {
    key: 'system',
    label: '权限管理',
    icon: Setting,
    expanded: false,
    visible: canManageSystem,
    permissionKey: 'system',
    children: [
      { key: 'system-accounts', label: '账号管理', permissionKey: 'system.accounts', to: '/system?view=accounts' },
      { key: 'system-roles', label: '角色权限', permissionKey: 'system.roles', to: '/system?view=roles' }
    ]
  },
  { key: 'account', label: '个人设置', icon: User, to: '/account' }
])

const hasMenuPermission = (item: SideItem): boolean => {
  if (!item.permissionKey) return true
  // 父菜单：只要任一子菜单有权限就显示
  if (item.children && item.children.length > 0) {
    return item.children.some((child) => hasMenuPermission(child))
  }
  return hasPermission(currentUser.value, item.permissionKey, platform.value, permissionConfig.value || undefined)
}

const filteredSideMenu = computed(() => {
  const kw = menuSearch.value.trim().toLowerCase()
  const visible = sideMenu
    .filter((item) => !item.visible || item.visible(currentUser.value))
    .filter((item) => hasMenuPermission(item))
    .map((item) => {
      if (!item.children) return item
      const filteredChildren = item.children.filter((child) => hasMenuPermission(child))
      return { ...item, children: filteredChildren }
    })
  if (!kw) return visible
  return visible.filter((item) => {
    if (item.label.toLowerCase().includes(kw)) return true
    if (item.children && item.children.length > 0) {
      const matchedChildren = item.children.filter((child) => child.label.toLowerCase().includes(kw))
      if (matchedChildren.length > 0) {
        item.children = matchedChildren
        return true
      }
    }
    return false
  })
})

const toggleGroup = (key: string) => {
  const item = sideMenu.find((i) => i.key === key)
  if (item) {
    item.expanded = !item.expanded
  }
}

const isMenuActive = (key: string) => {
  if (key === 'database') return route.path === '/database'
  if (key === 'lianzhicang') return route.path === '/ai' || route.path === '/models'
  if (key === 'ai') return route.path === '/ai'
  if (key === 'models') return route.path === '/models'
  if (key === 'fanjingzhixie') return ['/news', '/weather', '/map', '/automation', '/yingcang'].includes(route.path)
  if (key === 'news') return route.path === '/news' || route.path === '/yingcang'
  if (key === 'news-main') return route.path === '/news'
  if (key === 'yingcang') return route.path === '/yingcang'
  if (key === 'weather') return route.path === '/weather'
  if (key === 'map') return route.path === '/map'
  if (key === 'requirements') return route.path === '/requirements'
  if (key === 'automation' || key === 'automation-info') return route.path === '/automation'
  if (key === 'worktasks') return route.path === '/dashboard' && ['overview', 'todos', 'points', 'contents'].includes((route.query.view as string) || '')
  if (key === 'system') return route.path === '/system'
  if (key === 'system-accounts') return route.path === '/system' && (route.query.view || 'accounts') === 'accounts'
  if (key === 'system-roles') return route.path === '/system' && route.query.view === 'roles'
  if (key === 'account') return route.path === '/account'
  if (key === 'overview') return route.path === '/dashboard' && (route.query.view || 'overview') === 'overview'
  return route.path === '/dashboard' && route.query.view === key
}

const goMenu = (item: SideItem) => {
  if (!item.to) return
  mobileNavVisible.value = false
  router.push(item.to)
}

const currentTitle = computed(() => {
  if (route.path === '/ai') return 'AI 助手'
  if (route.path === '/models') return '模型中心'
  if (route.path === '/requirements') return '需求收集'
  if (route.path === '/database') return '数据库监测中心'
  if (route.path === '/news') return '新闻聚合'
  if (route.path === '/yingcang') return '影仓智核'
  if (route.path === '/weather') return '实时天气'
  if (route.path === '/map') return '地图定位'
  if (route.path === '/automation') return '自动化信息'
  if (route.path === '/system') {
    const v = route.query.view || 'accounts'
    if (v === 'roles') return '角色权限'
    return '账号管理'
  }
  if (route.path === '/account') return '个人设置'
  if (route.path === '/dashboard') {
    const v = route.query.view || 'overview'
    if (v === 'todos') return '待办'
    if (v === 'points') return '点位'
    if (v === 'contents') return '内容'
    return '数据看板'
  }
  return 'Smart Dashboard'
})

/* ===== 未登录：全局侧边栏菜单 ===== */
const menuItems = computed(() => [
  { path: '/dashboard?view=overview', label: '数据看板', icon: '📊' },
  { path: '/ai', label: 'AI 助手', icon: '🤖' }
])

const isActive = (path: string) => {
  const [base, query] = path.split('?')
  if (route.path !== base) return false
  if (!query) return true
  const want = new URLSearchParams(query).get('view')
  const cur = Array.isArray(route.query.view) ? route.query.view[0] : route.query.view
  return want === cur
}

const navigate = (path: string) => {
  drawerVisible.value = false
  router.push(path)
}

const refreshUser = async () => {
  permissionConfig.value = await loadPermissionConfig()
  try {
    // 优先从 Supabase 会话刷新用户（可检测账号禁用/角色变更）
    currentUser.value = await refreshSavedUser()
  } catch (err) {
    console.error('[App] refresh user failed:', err)
  }
  // 兜底：刷新失败时尝试读取本地缓存 + 会话，避免网络抖动导致登录态丢失、
  // 已登录用户看到未登录侧边栏而子页面已渲染的异常布局。
  if (!currentUser.value) {
    try {
      currentUser.value = await getSavedUser()
    } catch (err) {
      console.error('[App] getSavedUser fallback failed:', err)
    }
  }
}

const updatePlatform = () => {
  isMobile.value = window.innerWidth <= 768
}

const handleLogout = async () => {
  await logoutUser()
  currentUser.value = null
  drawerVisible.value = false
  mobileNavVisible.value = false
  router.replace('/login')
}

// 路由变化时刷新登录态（登录/退出后导航同步）
watch(() => route.fullPath, refreshUser)
onMounted(async () => {
  applyTheme(theme.value)
  updatePlatform()
  window.addEventListener('resize', updatePlatform)
  try {
    await refreshUser()
  } catch (err) {
    console.error('[App] refresh user failed:', err)
    currentUser.value = null
  } finally {
    initializing.value = false
  }
})
</script>

<style scoped>
/* 初始化 loading：登录态确认前全屏遮挡，避免未登录布局闪烁 */
.app-loading {
  position: fixed;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  background: var(--bg-app, #f8fafc);
  color: var(--text-secondary, #64748b);
  z-index: 9999;
}
.app-loading .loading-icon {
  font-size: 32px;
  animation: spin 1s linear infinite;
}
@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

/* 最外层登录页：全屏渲染，不带任何全局导航 */
.login-screen {
  min-height: 100vh;
  min-height: 100dvh;
}

.app-shell {
  min-height: 100vh;
  background: var(--bg-app);
}

.main-content.authed-main {
  padding: 0;
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
}

/* ===== 已登录：左侧全局侧边栏 ===== */
.app-shell.is-authed {
  display: flex;
  --side-w: 250px;
  --topbar-h: 60px;
}
.app-sidebar {
  width: var(--side-w);
  flex-shrink: 0;
  background: var(--sidebar-bg);
  border-right: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  position: sticky;
  top: 0;
  height: 100vh;
  color: var(--text);
  box-shadow: var(--shadow-sidebar);
  overflow: hidden;
}
.app-sidebar::before {
  content: '';
  position: absolute;
  top: -120px;
  left: -80px;
  width: 320px;
  height: 320px;
  background: radial-gradient(circle, var(--nav-hover) 0%, transparent 70%);
  pointer-events: none;
}
.app-sidebar::after {
  content: '';
  position: absolute;
  bottom: -80px;
  right: -80px;
  width: 260px;
  height: 260px;
  background: radial-gradient(circle, var(--nav-hover) 0%, transparent 70%);
  pointer-events: none;
}
.side-brand {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 24px 20px 18px;
}
.brand-logo-img {
  width: 38px;
  height: 38px;
  border-radius: 50%;
  object-fit: contain;
  background: var(--nav-hover);
  padding: 4px;
  box-sizing: border-box;
  filter: drop-shadow(0 0 14px var(--accent-glow));
  position: relative;
  z-index: 1;
}
.brand-text {
  display: flex;
  flex-direction: column;
  line-height: 1.15;
  position: relative;
  z-index: 1;
}
.brand-name {
  font-size: 18px;
  font-weight: 800;
  color: var(--text-strong);
  letter-spacing: -0.02em;
}
.brand-suffix {
  font-size: 11px;
  font-weight: 600;
  color: var(--text-muted);
  letter-spacing: 0.06em;
}
.side-search {
  padding: 0 16px 16px;
  position: relative;
  z-index: 1;
}
.side-search :deep(.el-input__wrapper) {
  background: var(--surface-soft);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
  border: 1px solid var(--border-strong);
  border-radius: 12px;
  transition: all 0.2s ease;
}
.side-search :deep(.el-input__wrapper:hover),
.side-search :deep(.el-input__wrapper.is-focus) {
  background: var(--surface);
  border-color: var(--primary);
  box-shadow: 0 0 14px var(--shadow-card);
}
.side-search :deep(.el-input__inner) {
  color: var(--text);
}
.side-search :deep(.el-input__inner::placeholder) {
  color: var(--text-faint);
}
.side-search :deep(.el-input__prefix) {
  color: var(--text-faint);
}
.side-nav {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 6px 12px;
  overflow-y: auto;
  position: relative;
  z-index: 1;
}
.side-item {
  display: flex;
  align-items: center;
  gap: 10px;
  border: none;
  background: transparent;
  padding: 10px 14px;
  border-radius: 12px;
  font-size: 14px;
  font-weight: 500;
  color: var(--text);
  cursor: pointer;
  text-align: left;
  transition: all 0.2s ease;
  position: relative;
}
.side-item :deep(svg) { font-size: 17px; }
.side-item:hover {
  background: var(--nav-hover);
  color: var(--text-strong);
}
.side-item.active {
  background: var(--nav-active-bg);
  color: var(--nav-active-text);
  font-weight: 600;
  box-shadow: 0 0 18px var(--nav-active-glow), inset 0 0 0 1px var(--border-strong);
}
.side-item:active {
  transform: scale(0.96);
}
.side-child:active {
  transform: scale(0.96);
}
.side-item.active::before {
  content: '';
  position: absolute;
  left: 0;
  top: 50%;
  transform: translateY(-50%);
  width: 3px;
  height: 20px;
  border-radius: 0 3px 3px 0;
  background: linear-gradient(180deg, var(--primary-2), var(--primary));
  box-shadow: 0 0 10px var(--accent-glow-2);
}
.side-group-title {
  justify-content: flex-start;
}
.side-group-title .group-arrow {
  margin-left: auto;
  font-size: 12px;
  transition: transform 0.2s;
  color: var(--text-faint);
}
.side-group-title.expanded .group-arrow {
  transform: rotate(180deg);
}
.side-group-children {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding-left: 12px;
  margin-top: 2px;
}
.side-child {
  padding: 8px 14px;
  font-size: 13px;
  color: var(--text-muted);
}
.side-child .child-dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: var(--text-faint);
  flex-shrink: 0;
}
.side-child.active .child-dot {
  background: var(--primary-2);
}
.side-child.active {
  color: var(--text);
}

/* 路由切换淡入淡出过渡 */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.18s ease, transform 0.18s ease;
}
.fade-enter-from {
  opacity: 0;
  transform: translateY(8px);
}
.fade-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}

/* 左下角：主题切换 + 商业版卡片 */
.side-footer {
  padding: 12px 14px 14px;
  border-top: 1px solid var(--border);
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.theme-toggle {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  border: 1px solid var(--border-strong);
  background: var(--toggle-bg);
  padding: 9px 14px;
  border-radius: 12px;
  font-size: 13px;
  font-weight: 600;
  color: var(--text);
  cursor: pointer;
  transition: all 0.2s ease;
  backdrop-filter: blur(8px);
}
.theme-toggle:hover {
  background: var(--nav-hover);
  border-color: var(--primary);
  color: var(--text-strong);
}
.theme-toggle :deep(svg) { font-size: 16px; color: var(--primary); }
.theme-toggle .toggle-label { flex: 1; text-align: left; }
.theme-switch {
  position: relative;
  width: 36px;
  height: 20px;
  border-radius: 999px;
  background: var(--toggle-track);
  transition: background 0.25s ease;
  flex-shrink: 0;
}
.theme-switch::after {
  content: '';
  position: absolute;
  top: 2px;
  left: 2px;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
  transition: transform 0.25s ease;
}
.theme-switch.on {
  background: var(--primary);
}
.theme-switch.on::after {
  transform: translateX(16px);
}
.commercial-card {
  background: var(--surface-mute);
  border-radius: 14px;
  height: 64px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  border: 1px solid var(--border-strong);
  position: relative;
  overflow: hidden;
  backdrop-filter: blur(8px);
}
.commercial-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: -100%;
  width: 100%;
  height: 100%;
  background: linear-gradient(90deg, transparent, rgba(99, 102, 241, 0.06), transparent);
  animation: proShine 3s infinite;
}
@keyframes proShine {
  0% { left: -100%; }
  100% { left: 100%; }
}
.commercial-logo {
  width: 38px;
  height: 38px;
  object-fit: contain;
  border-radius: 50%;
  position: relative;
  z-index: 1;
  filter: drop-shadow(0 0 10px var(--accent-glow));
}
.commercial-pro {
  font-size: 13px;
  font-weight: 800;
  letter-spacing: 0.16em;
  color: var(--primary);
  position: relative;
}

/* 主区域 */
.app-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  height: 100vh;
  overflow: hidden;
  background: var(--bg-main-grad);
}
.app-topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  height: var(--topbar-h);
  padding: 0 24px;
  background: var(--topbar-bg);
  backdrop-filter: blur(18px);
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
  z-index: 30;
  min-width: 0;
  width: 100%;
  box-sizing: border-box;
}
.topbar-left {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}
.menu-btn { padding: 4px 8px; display: none; }
.page-title {
  font-size: 17px;
  font-weight: 700;
  color: var(--text-strong);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.topbar-user {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
  flex-shrink: 0;
}
.user-avatar {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  background: linear-gradient(135deg, var(--primary), var(--primary-2));
  color: var(--primary-contrast);
  display: grid;
  place-items: center;
  font-size: 13px;
  font-weight: 700;
  flex-shrink: 0;
  box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3);
}
.user-meta {
  display: flex;
  flex-direction: column;
  line-height: 1.2;
  text-align: right;
  min-width: 0;
  max-width: 150px;
}
.user-nickname {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-strong);
  max-width: 120px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.user-role {
  font-size: 11px;
  color: var(--text-muted);
  max-width: 120px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.user-logout {
  color: var(--text-faint);
  margin-left: 4px;
  flex-shrink: 0;
}
.user-logout:hover { color: #ef4444; }

.drawer-brand {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 22px 18px 18px;
}
.drawer-search {
  padding: 0 14px 12px;
}
.drawer-footer {
  padding: 14px;
  border-top: 1px solid var(--border);
}
.drawer-commercial {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  background: var(--nav-hover);
  border: 1px solid var(--border-strong);
  border-radius: 14px;
  height: 56px;
  margin-bottom: 12px;
  position: relative;
  overflow: hidden;
}
.drawer-commercial::before {
  content: '';
  position: absolute;
  top: 0;
  left: -100%;
  width: 100%;
  height: 100%;
  background: linear-gradient(90deg, transparent, rgba(99, 102, 241, 0.05), transparent);
  animation: proShine 3s infinite;
}
.drawer-user {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 12px;
}
.mobile-drawer :deep(.el-drawer__body) {
  background: var(--bg-app-grad);
  padding: 0;
  color: var(--text);
}
.full { width: 100%; }

/* ===== 未登录：侧边栏 + 移动端 ===== */
.layout { display: flex; min-height: 100vh; }
.sidebar {
  width: 220px;
  flex-shrink: 0;
  background: var(--surface);
  border-right: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  position: sticky;
  top: 0;
  height: 100vh;
}
.sidebar-brand { font-size: 18px; font-weight: 700; color: var(--primary); padding: 20px 18px 14px; }
.side-menu { display: flex; flex-direction: column; gap: 4px; padding: 8px 10px; flex: 1; }
.menu-item {
  display: flex;
  align-items: center;
  gap: 10px;
  border: none;
  background: transparent;
  padding: 11px 14px;
  border-radius: 10px;
  font-size: 14px;
  color: var(--text);
  cursor: pointer;
  text-align: left;
  transition: background 0.15s, color 0.15s;
}
.menu-item:hover { background: var(--nav-hover); color: var(--primary); }
.menu-item.active { background: var(--nav-active-bg); color: var(--primary); font-weight: 600; }
.menu-item-icon { font-size: 16px; }
.sidebar-footer { padding: 14px; border-top: 1px solid var(--border); }
.user-chip {
  font-size: 13px;
  color: var(--text);
  background: var(--surface-soft);
  border-radius: 8px;
  padding: 8px 10px;
  margin-bottom: 8px;
  text-align: center;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.main-content { flex: 1; min-width: 0; }

.mobile-topbar {
  display: none;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  background: var(--surface);
  border-bottom: 1px solid var(--border);
  position: sticky;
  top: 0;
  z-index: 20;
}
.mobile-topbar .brand { font-size: 16px; font-weight: 700; color: var(--primary); flex: 1; }
.topbar-user { font-size: 13px; color: var(--text-muted); max-width: 90px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

/* ===== 响应式切换 ===== */
@media (max-width: 768px) {
  .app-sidebar { display: none; }
  .menu-btn { display: inline-flex; }
  .app-topbar { padding: 0 14px; height: 56px; }
  .page-title { font-size: 15px; }
  .user-nickname { max-width: 80px; }
  .sidebar { display: none; }
  .mobile-topbar { display: flex; }
  .app-shell.is-authed .main-content.authed-main {
    height: calc(100vh - 56px);
  }
}
@media (max-width: 640px) {
  .app-topbar { padding: 0 12px; }
  .user-meta { display: none; }
}
</style>
