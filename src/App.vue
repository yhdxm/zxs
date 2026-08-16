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
  <div v-else-if="isLoggedIn" class="app-shell is-authed" :class="{ collapsed: sidebarCollapsed }">
    <aside class="app-sidebar">
      <div class="side-brand">
        <CompassLogo :size="38" class="brand-logo-img" label="智习" />
        <div class="brand-text">
          <span class="brand-name">智习</span>
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
        <SideNavNode
          :items="filteredSideMenu"
          :is-active="isMenuActive"
          :navigate="goMenu"
          :toggle="toggleGroup"
        />
      </nav>

      <div class="side-footer">
        <button class="theme-toggle" @click="toggleTheme" :title="theme === 'dark' ? '切换到浅色模式' : '切换到深色模式'">
          <el-icon><component :is="theme === 'dark' ? Sunny : Moon" /></el-icon>
          <span class="toggle-label">{{ theme === 'dark' ? '深色模式' : '浅色模式' }}</span>
          <span class="theme-switch" :class="{ on: theme === 'dark' }"></span>
        </button>
        <!-- 用户身份 + 退出（原 PRO 卡片位置）；空间不足时 hover 显示完整身份 -->
        <el-tooltip
          :content="`${currentUser?.nickname || '用户'} · ${roleLabel}`"
          placement="right"
          :show-after="150"
          :offset="14"
        >
          <div class="side-user">
            <span class="su-avatar">{{ avatarText }}</span>
            <div class="su-meta">
              <span class="su-name">{{ currentUser?.nickname || '用户' }}</span>
              <span class="su-role">{{ roleLabel }}</span>
            </div>
            <button class="su-bell" type="button" title="消息中心" @click.stop="openNotif">
              <el-icon><Bell /></el-icon>
              <span v-if="unread > 0" class="su-badge">{{ unread > 99 ? '99+' : unread }}</span>
            </button>
            <button class="su-logout" type="button" title="退出登录" @click.stop="handleLogout">
              <el-icon><SwitchButton /></el-icon>
            </button>
          </div>
        </el-tooltip>
      </div>

      <!-- 折叠/展开侧边栏（PC 端，三角形按钮） -->
      <button class="side-collapse" @click="toggleSidebar" :title="sidebarCollapsed ? '展开侧边栏' : '收起侧边栏'">
        <el-icon><component :is="sidebarCollapsed ? ArrowRight : ArrowLeft" /></el-icon>
      </button>
    </aside>

    <!-- 移动端悬浮菜单按钮：放在 app-shell 直接子级，避免被侧边栏 display:none 隐藏 -->
    <button class="mobile-menu-fab" @click="mobileNavVisible = true" title="打开菜单">
      <el-icon><Menu /></el-icon>
    </button>

    <!-- 主区域（无独立顶栏，页面自身标题顶到最上方） -->
    <div class="app-main">
      <main class="main-content authed-main" :class="{ 'no-global-pad': isCetPrepRoute }">
        <router-view v-slot="{ Component }">
          <transition name="fade" mode="out-in">
            <component :is="Component" />
          </transition>
        </router-view>
      </main>
    </div>

    <!-- 移动端底部导航（高频场景原生 Tab 模式，替代悬浮菜单按钮） -->
    <nav class="mobile-bottom-nav" v-if="isMobile && !isCetPrepRoute">
      <button
        v-for="b in mobileBottomNav"
        :key="b.key"
        class="mbn-item"
        :class="{ active: b.active }"
        @click="onBottomNav(b)"
      >
        <span class="mbn-icon">
          <el-icon v-if="b.iconComp"><component :is="b.iconComp" /></el-icon>
          <span v-else class="mbn-emoji">{{ b.iconText }}</span>
        </span>
        <span class="mbn-label">{{ b.label }}</span>
      </button>
    </nav>

    <!-- 消息中心抽屉 -->
    <el-drawer v-model="notifDrawerVisible" direction="rtl" size="360px" :with-header="false" class="notif-drawer">
      <div class="notif-header">
        <span class="notif-header-title">消息中心</span>
        <span class="notif-header-sub">{{ unread > 0 ? unread + ' 条未读' : '全部已读' }}</span>
        <el-button text type="primary" size="small" :disabled="unread === 0" @click="markAllReadLocal">全部已读</el-button>
      </div>
      <div v-if="notifLoading" class="notif-loading"><el-icon class="notif-spin"><Loading /></el-icon></div>
      <div v-else-if="notifications.length === 0" class="notif-empty">暂无消息</div>
      <ul v-else class="notif-list">
        <li
          v-for="n in notifications"
          :key="n.id"
          :class="{ unread: !n.read }"
          @click="openNotification(n)"
        >
          <div class="notif-title">{{ n.title }}</div>
          <div class="notif-body">{{ n.body }}</div>
          <div class="notif-time">{{ formatNotifTime(n.created_at) }}</div>
        </li>
      </ul>
    </el-drawer>

    <!-- 已登录：移动端抽屉 -->
    <el-drawer v-model="mobileNavVisible" direction="ltr" size="280px" :with-header="false" class="mobile-drawer">
      <div class="drawer-brand">
        <CompassLogo :size="38" class="brand-logo-img" label="智习" />
        <div class="brand-text">
          <span class="brand-name">智习</span>
        </div>
      </div>
      <div class="drawer-search">
        <el-input v-model="menuSearch" size="default" placeholder="搜索菜单" clearable>
          <template #prefix><el-icon><Search /></el-icon></template>
        </el-input>
      </div>
      <nav class="side-nav">
        <SideNavNode
          :items="filteredSideMenu"
          :is-active="isMenuActive"
          :navigate="goMenu"
          :toggle="toggleGroup"
        />
      </nav>
      <div class="drawer-footer">
        <button class="theme-toggle" @click="toggleTheme" :title="theme === 'dark' ? '切换到浅色模式' : '切换到深色模式'">
          <el-icon><component :is="theme === 'dark' ? Sunny : Moon" /></el-icon>
          <span class="toggle-label">{{ theme === 'dark' ? '深色模式' : '浅色模式' }}</span>
          <span class="theme-switch" :class="{ on: theme === 'dark' }"></span>
        </button>
        <div class="side-user" :title="`${currentUser?.nickname || '用户'} · ${roleLabel}`">
          <span class="su-avatar">{{ avatarText }}</span>
          <div class="su-meta">
            <span class="su-name">{{ currentUser?.nickname || '用户' }}</span>
            <span class="su-role">{{ roleLabel }}</span>
          </div>
          <button class="su-bell" type="button" title="消息中心" @click.stop="openNotif">
            <el-icon><Bell /></el-icon>
            <span v-if="unread > 0" class="su-badge">{{ unread > 99 ? '99+' : unread }}</span>
          </button>
          <button class="su-logout" type="button" title="退出登录" @click.stop="handleLogout">
            <el-icon><SwitchButton /></el-icon>
          </button>
        </div>
      </div>
    </el-drawer>
  </div>

  <!-- 未登录访客分支已移除：路由守卫拦截所有未登录非 login 访问，此分支不可达 -->
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import type { Component } from 'vue'
import {
  SwitchButton,
  Menu,
  Search,
  Sunny,
  Moon,
  Loading,
  ArrowLeft,
  ArrowRight,
  Bell
} from '@element-plus/icons-vue'
import {
  logoutUser, getSavedUser, refreshSavedUser,
  hasPermission, hasModulePermission, loadPermissionConfig, type PermissionConfig,
  type AppUser
} from './services/appDataService'
import { APP_MENU, canManageSystem, type SideItem } from './config/appMenu'
import CompassLogo from './components/CompassLogo.vue'
import SideNavNode from './components/SideNavNode.vue'
import { clearRouterUserCache } from './router'
import {
  isPushSupported,
  fetchNotifications,
  unreadCount as fetchUnreadCount,
  markRead,
  markAllRead,
  autoRemindDue,
  type AppNotification
} from './services/pushService'

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

/* ===== 消息中心（站内收件箱 + Web Push 未读角标） ===== */
const notifDrawerVisible = ref(false)
const notifications = ref<AppNotification[]>([])
const unread = ref(0)
const notifLoading = ref(false)
let unreadTimer: number | undefined
let remindTimer: number | undefined

async function refreshUnread() {
  try {
    unread.value = await fetchUnreadCount()
  } catch {
    unread.value = 0
  }
}
async function loadNotifications() {
  notifLoading.value = true
  try {
    notifications.value = await fetchNotifications(50)
  } catch {
    notifications.value = []
  } finally {
    notifLoading.value = false
  }
  await refreshUnread()
}
async function openNotif() {
  notifDrawerVisible.value = true
  await loadNotifications()
}
async function openNotification(n: AppNotification) {
  if (!n.read) {
    await markRead(n.id)
    n.read = true
    await refreshUnread()
  }
  if (n.url) router.push(n.url)
}
async function markAllReadLocal() {
  await markAllRead()
  await loadNotifications()
}
function formatNotifTime(iso: string): string {
  const d = new Date(iso)
  const diff = Date.now() - d.getTime()
  if (diff < 60_000) return '刚刚'
  if (diff < 3_600_000) return Math.floor(diff / 60_000) + ' 分钟前'
  if (diff < 86_400_000) return Math.floor(diff / 3_600_000) + ' 小时前'
  return d.toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
}
function onSwMessage(e: MessageEvent) {
  if (e.data && e.data.type === 'zxs-push-click' && e.data.url) {
    router.push(e.data.url)
  }
}
function refreshUnreadIfLoggedIn() {
  if (isLoggedIn.value) refreshUnread().catch(() => {})
}
function triggerAutoRemind() {
  if (isLoggedIn.value && isPushSupported()) autoRemindDue().catch(() => {})
}

/* ===== 侧边栏折叠（PC 端，三角形按钮） ===== */
const sidebarCollapsed = ref(
  typeof localStorage !== 'undefined' && localStorage.getItem('zxs-sidebar-collapsed') === '1'
)
function toggleSidebar() {
  sidebarCollapsed.value = !sidebarCollapsed.value
  try { localStorage.setItem('zxs-sidebar-collapsed', sidebarCollapsed.value ? '1' : '0') } catch { /* ignore */ }
}

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

/* ===== 已登录：左侧全局侧边栏菜单（由全局菜单配置 APP_MENU 派生，与权限树自动同步） ===== */
// 保留可变的 expanded 状态，同时保留 visible 函数引用（APP_MENU 已内联 canManageSystem）
function cloneMenu(items: SideItem[], depth = 0): SideItem[] {
  return items.map((it) => ({
    ...it,
    // 顶层分组默认闭合；嵌套分组（如「学习中心 → 学位英语」）保留数据源展开态，减少点击层级
    expanded: depth === 0 ? false : (it.expanded ?? false),
    children: it.children ? cloneMenu(it.children, depth + 1) : undefined
  }))
}
const sideMenu = reactive(cloneMenu(APP_MENU))

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
  function filterMenu(items: SideItem[]): SideItem[] {
    return items
      .filter((item) => !item.visible || item.visible(currentUser.value))
      .filter((item) => hasMenuPermission(item))
      .map((item) => {
        if (!item.children) return item
        return { ...item, children: filterMenu(item.children) }
      })
  }
  const visible = filterMenu(sideMenu)
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
  if (key === 'learn-english') return route.path.startsWith('/degree') || route.path === '/learn/english'
  if (key === 'degree-legacy') return route.path === '/learn/english'
  if (key.startsWith('degree-') && key !== 'degree-legacy') return route.path === '/degree/' + key.slice('degree-'.length)
  if (key === 'welcome') return route.path === '/welcome'
  if (key === 'database') return route.path === '/database'
  if (key === 'lianzhicang') return route.path === '/ai' || route.path === '/models' || route.path === '/aimodels'
  if (key === 'ai') return route.path === '/ai'
  if (key === 'models') return route.path === '/models'
  if (key === 'aimodels') return route.path === '/aimodels'
  if (key === 'fanjingzhixie') return ['/news', '/weather', '/map', '/automation', '/yingcang', '/xingyu', '/third-api'].includes(route.path)
  if (key === 'xingyu') return route.path === '/xingyu'
  if (key === 'learncenter') return route.path.startsWith('/learn') || route.path.startsWith('/degree')
  if (key === 'learn-industry') return route.path === '/learn/industry'
  if (key === 'learn-books') return route.path === '/learn/books'
  if (key === 'learn-goals') return route.path === '/learn/goals'
  if (key === 'news') return route.path === '/news' || route.path === '/yingcang'
  if (key === 'news-main') return route.path === '/news'
  if (key === 'yingcang') return route.path === '/yingcang'
  if (key === 'weather') return route.path === '/weather'
  if (key === 'map') return route.path === '/map'
  if (key === 'third-api') return route.path === '/third-api'
  if (key === 'requirements') return route.path === '/requirements'
  if (key === 'automation') return route.path === '/automation'
  if (key === 'worktasks') return route.path === '/dashboard' && ['overview', 'todos', 'points', 'contents'].includes((route.query.view as string) || '')
  if (key === 'system') return route.path === '/system' || route.path === '/feedback-admin'
  if (key === 'system-accounts') return route.path === '/system' && (route.query.view || 'accounts') === 'accounts'
  if (key === 'system-roles') return route.path === '/system' && route.query.view === 'roles'
  if (key === 'feedback') return route.path === '/feedback'
  if (key === 'feedback-admin') return route.path === '/feedback-admin'
  if (key === 'push') return route.path === '/push'
  if (key === 'account') return route.path === '/account'
  if (key === 'overview') return route.path === '/dashboard' && (route.query.view || 'overview') === 'overview'
  return route.path === '/dashboard' && route.query.view === key
}

const goMenu = (item: SideItem) => {
  // 外部独立页面（单文件 HTML）：在新标签打开，按部署 base 解析绝对路径
  if (item.href) {
    const base = import.meta.env.BASE_URL || '/'
    const url = item.href.startsWith('http') || item.href.startsWith('/')
      ? item.href
      : base.replace(/\/$/, '') + '/' + item.href
    window.open(url, '_blank', 'noopener')
    mobileNavVisible.value = false
    return
  }
  if (!item.to) return
  mobileNavVisible.value = false
  router.push(item.to)
}

/* ===== 移动端底部导航（高频场景原生 Tab 模式，替代悬浮菜单按钮） ===== */
interface BottomNavItem {
  key: string
  label: string
  iconComp?: Component
  iconText?: string
  to?: string | { path: string; query: Record<string, string> }
  isMore?: boolean
  active?: boolean
}
function findMenuItem(key: string, items: SideItem[] = filteredSideMenu.value): SideItem | undefined {
  for (const it of items) {
    if (it.key === key) return it
    if (it.children && it.children.length) {
      const f = findMenuItem(key, it.children)
      if (f) return f
    }
  }
  return undefined
}
// 高频核心入口：首页 / 工作数据看板 / AI 助手 / 新闻聚合 / 个人设置，末位「更多」打开全量抽屉
const MOBILE_NAV_PRIORITY = ['welcome', 'overview', 'ai', 'news', 'account']
const mobileBottomNav = computed<BottomNavItem[]>(() => {
  const items: BottomNavItem[] = []
  for (const k of MOBILE_NAV_PRIORITY) {
    const found = findMenuItem(k)
    // 二次校验：即使父菜单展开导致子项存在，也必须拥有该模块任一平台权限才显示
    if (found && hasModulePermission(currentUser.value, found.permissionKey || found.key, permissionConfig.value || undefined)) {
      items.push({
        key: found.key,
        label: found.label,
        iconComp: found.icon,
        to: found.to,
        active: isMenuActive(found.key)
      })
    }
  }
  items.push({ key: 'more', label: '更多', iconComp: Menu, isMore: true })
  return items
})
function onBottomNav(item: BottomNavItem) {
  if (item.isMore) {
    mobileNavVisible.value = true
    return
  }
  if (item.to) {
    mobileNavVisible.value = false
    router.push(item.to)
  }
}

// 备考台（四六级）自带 fixed 底部导航（今日/刷题/错本/我的），层级较低；
// 进入该路由时隐藏全局移动端底部导航，避免双导航重叠遮挡、点击不到备考台自身按钮。
const isCetPrepRoute = computed(() => route.path === '/learn/cet-prep')

// 页面标题由各视图自身渲染（单一标题铁律），顶部 topbar 不再重复展示

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
  clearRouterUserCache()
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
  // 角色权限变更后实时刷新侧边栏权限与当前用户权限（与权限管理页联动）
  window.addEventListener('permission-config-updated', () => {
    refreshUser().catch((err) => console.error('[App] permission refresh failed:', err))
  })

  /**
   * 启动初始化：最多等待 3 秒。
   * 若 Supabase 网络极慢/被墙导致 refreshUser 挂起，超时后强制关闭加载遮罩，
   * 避免用户永远看到"加载中"。超时时 currentUser 可能为 null，router 守卫会引导到登录页。
   */
  const INIT_TIMEOUT_MS = 3000
  try {
    await Promise.race([
      refreshUser(),
      new Promise<void>((_, reject) => {
        setTimeout(() => reject(new Error('init timeout')), INIT_TIMEOUT_MS)
      })
    ])
  } catch (err) {
    console.error('[App] init failed or timeout:', err)
    currentUser.value = null
  } finally {
    initializing.value = false
    // 消息中心：未读轮询 + 自动提醒 + SW 点击跳转
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', onSwMessage)
    }
    refreshUnreadIfLoggedIn()
    unreadTimer = window.setInterval(refreshUnreadIfLoggedIn, 30_000)
    remindTimer = window.setInterval(triggerAutoRemind, 5 * 60_000)
    // 登录后稍等片刻触发一次自动提醒，捕捉到期待办
    window.setTimeout(triggerAutoRemind, 12_000)
    // 学位英语内容数据：登录后后台触发一次 lazy-seed（无论用户先打开哪个 2.0 页面都生效）
    if (isLoggedIn.value) {
      import('./prep/degreeDb')
        .then((m) => m.ensureContentSeeded().catch(() => {}))
        .catch(() => {})
    }
  }
})

onUnmounted(() => {
  if (unreadTimer) clearInterval(unreadTimer)
  if (remindTimer) clearInterval(remindTimer)
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.removeEventListener('message', onSwMessage)
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
  min-height: 100dvh;
  background: var(--bg-app);
}

.main-content.authed-main {
  padding: 14px 0 0;
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
}

/* ===== 已登录：左侧全局侧边栏 ===== */
.app-shell.is-authed {
  display: flex;
  --side-w: 250px;
}
.app-shell.is-authed.collapsed {
  --side-w: 64px;
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
  height: 100dvh;
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

/* 折叠/展开按钮（PC 端，侧边栏垂直居中悬浮按钮） */
.side-collapse {
  position: absolute;
  top: 50%;
  right: 0;
  transform: translateY(-50%);
  z-index: 5;
  width: 22px;
  height: 46px;
  border: 1px solid var(--border);
  border-right: none;
  border-radius: 10px 0 0 10px;
  background: var(--surface);
  color: var(--text-muted);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  box-shadow: var(--shadow-card);
  transition: all 0.2s ease;
}
.side-collapse:hover {
  background: var(--nav-hover);
  color: var(--primary);
  border-color: var(--primary);
}
.side-collapse :deep(svg) { font-size: 15px; transition: transform 0.2s ease; }

/* 折叠态：仅显示图标，隐藏文字 */
.app-shell.is-authed.collapsed .side-brand { justify-content: center; padding: 14px 0 10px; }
.app-shell.is-authed.collapsed .brand-text { display: none; }
.app-shell.is-authed.collapsed .side-search { display: none; }
.app-shell.is-authed.collapsed .side-item { justify-content: center; padding: 12px 0; }
.app-shell.is-authed.collapsed .side-item > span:not(.child-dot) { display: none; }
.app-shell.is-authed.collapsed .group-arrow { display: none; }
.app-shell.is-authed.collapsed .side-group-children { padding-left: 0; }
.app-shell.is-authed.collapsed .side-child { justify-content: center; padding: 10px 0; }
.app-shell.is-authed.collapsed .side-child .child-dot { display: none; }
.app-shell.is-authed.collapsed .side-footer .toggle-label { display: none; }
.app-shell.is-authed.collapsed .theme-toggle { justify-content: center; padding: 9px 0; }
.app-shell.is-authed.collapsed .theme-switch { display: none; }
/* 折叠态：用户卡片只留头像 + 退出图标，纵向堆叠；身份由 tooltip 展示 */
.app-shell.is-authed.collapsed .side-user {
  flex-direction: column;
  gap: 8px;
  padding: 8px 0;
}
.app-shell.is-authed.collapsed .su-meta { display: none; }
.app-shell.is-authed.collapsed .side-collapse {
  left: 50%;
  right: auto;
  transform: translate(-50%, -50%);
  width: 34px;
  height: 42px;
  border: 1px solid var(--border);
  border-radius: 10px;
}
.app-shell.is-authed.collapsed .side-collapse :deep(svg) { transform: scale(1.1); }
.side-brand {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 18px 10px;
}
.brand-logo-img {
  width: 38px;
  height: 38px;
  border-radius: 12px;
  object-fit: contain;
  background: var(--nav-hover);
  padding: 3px;
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
/* 侧边栏导航项（.side-item / .side-child / .side-group* / .child-dot 等样式已迁移至
   src/components/SideNavNode.vue，因递归组件需各自作用域内的 scoped 样式） */

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
/* 侧栏底部：用户身份 + 退出（替代原 PRO 卡片） */
.side-user {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  background: var(--surface-mute);
  border: 1px solid var(--border-strong);
  border-radius: 14px;
  min-width: 0;
  transition: border-color 0.2s ease, background 0.2s ease;
}
.side-user:hover {
  border-color: var(--primary);
  background: var(--nav-hover);
}
.su-avatar {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--primary), var(--primary-2));
  color: var(--primary-contrast);
  display: grid;
  place-items: center;
  font-size: 14px;
  font-weight: 700;
  flex-shrink: 0;
  box-shadow: 0 3px 10px var(--accent-glow);
}
.su-meta {
  display: flex;
  flex-direction: column;
  line-height: 1.25;
  min-width: 0;
  flex: 1;
}
.su-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-strong);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.su-role {
  font-size: 11px;
  color: var(--text-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.su-logout {
  width: 30px;
  height: 30px;
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 9px;
  border: 1px solid transparent;
  background: transparent;
  color: var(--text-faint);
  cursor: pointer;
  transition: all 0.18s ease;
}
.su-logout:hover {
  color: #ef4444;
  border-color: #ef4444;
  background: rgba(239, 68, 68, 0.08);
}
.su-logout:active { transform: scale(0.92); }
.su-logout :deep(svg) { font-size: 16px; }
.su-bell {
  position: relative;
  width: 30px;
  height: 30px;
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 9px;
  border: 1px solid transparent;
  background: transparent;
  color: var(--text-faint);
  cursor: pointer;
  transition: all 0.18s ease;
}
.su-bell:hover { color: var(--primary); border-color: var(--primary); background: rgba(99, 102, 241, 0.08); }
.su-bell:active { transform: scale(0.92); }
.su-bell :deep(svg) { font-size: 16px; }
.su-badge {
  position: absolute;
  top: -4px;
  right: -4px;
  min-width: 16px;
  height: 16px;
  padding: 0 4px;
  border-radius: 999px;
  background: #ef4444;
  color: #fff;
  font-size: 11px;
  line-height: 16px;
  text-align: center;
  font-weight: 700;
  box-shadow: 0 0 0 2px var(--surface-mute);
}

/* 主区域 */
.app-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  height: 100vh;
  height: 100dvh;
  overflow: hidden;
  background: var(--bg-main-grad);
}
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
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.mobile-drawer :deep(.el-drawer__body) {
  background: var(--bg-app-grad);
  padding: 0;
  color: var(--text);
}
.full { width: 100%; }

/* ===== 未登录：侧边栏 + 移动端 ===== */
.layout { display: flex; min-height: 100vh; min-height: 100dvh; }
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
  height: 100dvh;
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

/* 移动端悬浮菜单按钮（PC 端侧栏常驻，隐藏） */
.mobile-menu-fab {
  display: none;
  position: fixed;
  left: calc(14px + env(safe-area-inset-left));
  bottom: calc(18px + env(safe-area-inset-bottom));
  z-index: 40;
  width: 48px;
  height: 48px;
  border-radius: 50%;
  border: none;
  background: var(--primary);
  color: var(--primary-contrast);
  align-items: center;
  justify-content: center;
  cursor: pointer;
  box-shadow: 0 6px 18px rgba(99, 102, 241, 0.45);
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}
.mobile-menu-fab:hover { transform: translateY(-2px); box-shadow: 0 10px 24px rgba(99, 102, 241, 0.55); }
.mobile-menu-fab:active { transform: scale(0.94); }
.mobile-menu-fab :deep(svg) { font-size: 22px; }

/* 移动端底部导航：原生 Tab 模式，替代悬浮菜单按钮（高频场景） */
.mobile-bottom-nav {
  display: none;
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 45;
  height: calc(58px + env(safe-area-inset-bottom));
  padding-bottom: env(safe-area-inset-bottom);
  background: var(--surface);
  background: color-mix(in srgb, var(--surface) 92%, transparent);
  backdrop-filter: saturate(160%) blur(14px);
  -webkit-backdrop-filter: saturate(160%) blur(14px);
  border-top: 1px solid var(--border);
  box-shadow: 0 -4px 18px rgba(15, 23, 42, 0.06);
}
.mobile-bottom-nav .mbn-item {
  flex: 1 1 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 3px;
  min-height: 48px;
  border: none;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  padding: 4px 2px;
  transition: color 0.15s ease, transform 0.12s ease;
}
.mobile-bottom-nav .mbn-item.active { color: var(--primary); }
.mobile-bottom-nav .mbn-item:active { transform: scale(0.93); }
.mobile-bottom-nav .mbn-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 21px;
  line-height: 1;
}
.mobile-bottom-nav .mbn-emoji { font-size: 19px; }
.mobile-bottom-nav .mbn-icon :deep(svg) { font-size: 21px; }
.mobile-bottom-nav .mbn-label { font-size: 11px; font-weight: 600; line-height: 1.1; }
.mobile-bottom-nav .mbn-item.active .mbn-label { font-weight: 700; }

/* ===== 响应式切换 ===== */
/* 中屏（1024~1280）：侧栏收窄，用户卡片同步紧凑 */
@media (max-width: 1180px) {
  .app-shell.is-authed { --side-w: 226px; }
  .side-user { padding: 7px 8px; gap: 8px; }
  .su-avatar { width: 30px; height: 30px; font-size: 13px; }
  .su-name { font-size: 12px; }
  .su-role { font-size: 10px; }
}

@media (max-width: 768px) {
  .app-sidebar { display: none; }
  .sidebar { display: none; }
  .mobile-topbar { display: flex; }
  .mobile-bottom-nav { display: flex; }
  .mobile-menu-fab { display: none; }
  .app-shell.is-authed .app-main {
    height: 100vh;
    height: 100dvh;
    width: 100%;
    flex: 1 1 auto;
    min-width: 0;
  }
  /* 主内容底部留白：避开悬浮菜单按钮 + 系统手势条，避免内容被遮挡 */
  .main-content.authed-main {
    padding-bottom: calc(84px + env(safe-area-inset-bottom));
  }
  .main-content {
    padding-bottom: calc(84px + env(safe-area-inset-bottom));
  }
  /* 备考台自带底部导航，进入该路由时去掉全局底部留白，避免双重留白 */
  .main-content.authed-main.no-global-pad {
    padding-bottom: 0;
  }
  /* 未登录顶栏避让刘海/状态栏安全区 */
  .mobile-topbar {
    padding-top: calc(10px + env(safe-area-inset-top));
  }
  /* 抽屉内用户卡片：手机上放宽显示，昵称仍截断避免撑破 */
  .drawer-footer .side-user { padding: 9px 10px; }
  .drawer-footer .su-name { font-size: 13px; }
}

/* 消息中心抽屉（teleport 到 body，需全局样式） */
:global(.notif-drawer .el-drawer__body) {
  background: var(--bg-app-grad);
  color: var(--text);
  padding: 0;
  display: flex;
  flex-direction: column;
}
:global(.notif-header) {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 14px 16px;
  border-bottom: 1px solid var(--border);
}
:global(.notif-header-title) { font-size: 15px; font-weight: 700; color: var(--text-strong); }
:global(.notif-header-sub) { font-size: 12px; color: var(--text-muted); flex: 1; }
:global(.notif-loading), :global(.notif-empty) {
  padding: 40px 16px; text-align: center; color: var(--text-muted); font-size: 13px;
}
:global(.notif-spin) { animation: spin 1s linear infinite; font-size: 24px; }
:global(.notif-list) { list-style: none; margin: 0; padding: 0; overflow-y: auto; flex: 1; }
:global(.notif-list li) {
  padding: 12px 16px;
  border-bottom: 1px solid var(--border);
  cursor: pointer;
  transition: background 0.15s;
}
:global(.notif-list li:hover) { background: var(--nav-hover); }
:global(.notif-list li.unread) { background: color-mix(in srgb, var(--primary) 6%, transparent); }
:global(.notif-title) { font-size: 14px; font-weight: 600; color: var(--text-strong); margin-bottom: 4px; position: relative; padding-left: 10px; }
:global(.notif-list li.unread .notif-title::before) {
  content: ''; position: absolute; left: 0; top: 7px; width: 6px; height: 6px; border-radius: 50%; background: var(--primary);
}
:global(.notif-body) { font-size: 13px; color: var(--text-muted); line-height: 1.5; word-break: break-word; }
:global(.notif-time) { font-size: 11px; color: var(--text-faint); margin-top: 4px; }
</style>
