<template>
  <div class="dash-shell">
    <!-- 数据看板（默认主页，置顶第一行） -->
    <DashboardBoard v-if="view === 'overview'" :dashboard="dashboard" />

    <!-- 模块管理：待办 / 点位 / 内容 -->
    <ModuleManager
      v-else
      :type="view"
      :dashboard="dashboard"
      :on-save="save"
    />
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import {
  getSavedUser,
  loadDashboardData,
  saveDashboardData,
  subscribeDashboardChanges,
  type AppDashboardData,
  type AppUser,
  type DashboardChangeEvent
} from '../services/appDataService'
import DashboardBoard from '../components/DashboardBoard.vue'
import ModuleManager from '../components/ModuleManager.vue'

type ViewMode = 'overview' | 'todos' | 'points' | 'contents'

const router = useRouter()
const route = useRoute()
const user = reactive<AppUser>({ id: '', email: '', username: '', nickname: '', role: 'user', disabled: false })
const dashboard = reactive<AppDashboardData>({ todos: [], points: [], contents: [] })

/* ============ 视图模式：数据看板 / 模块管理 ============ */
const view = ref<ViewMode>('overview')

const initViewFromRoute = () => {
  const q = Array.isArray(route.query.view) ? route.query.view[0] : route.query.view
  view.value = q === 'todos' || q === 'points' || q === 'contents' ? (q as ViewMode) : 'overview'
}
watch(() => route.query.view, initViewFromRoute)

/* ============ 跨端同步状态 ============ */
const saving = ref(false)
let pendingSave: AppDashboardData | null = null
let unsubscribe: (() => void) | null = null

/* ============ 持久化 + 跨端同步 ============ */
const save = async () => {
  if (!user.id) return
  saving.value = true
  const ok = await saveDashboardData(user.id, {
    todos: dashboard.todos,
    points: dashboard.points,
    contents: dashboard.contents
  })
  saving.value = false

  if (ok) {
    pendingSave = null
  } else {
    pendingSave = {
      todos: dashboard.todos,
      points: dashboard.points,
      contents: dashboard.contents
    }
    ElMessage.warning('云端同步失败，恢复网络后将自动重试')
  }
}

const reloadFromServer = async () => {
  if (!user.id) return
  const data = await loadDashboardData(user.id)
  dashboard.todos = data.todos
  dashboard.points = data.points
  dashboard.contents = data.contents
}

const onRemoteChange = (_event: DashboardChangeEvent) => {
  if (saving.value) return
  reloadFromServer()
}
const onVisibility = () => {
  if (typeof document !== 'undefined' && document.visibilityState === 'visible') reloadFromServer()
}
const onFocus = () => reloadFromServer()
const onOnline = () => {
  if (pendingSave && user.id) save()
}

onMounted(async () => {
  const currentUser = await getSavedUser()
  if (!currentUser) {
    router.replace('/login')
    return
  }
  user.id = currentUser.id
  user.email = currentUser.email
  user.username = currentUser.username
  user.nickname = currentUser.nickname

  initViewFromRoute()

  const data = await loadDashboardData(currentUser.id)
  dashboard.todos = data.todos
  dashboard.points = data.points
  dashboard.contents = data.contents

  unsubscribe = subscribeDashboardChanges(currentUser.id, onRemoteChange)

  if (typeof window !== 'undefined') {
    window.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('focus', onFocus)
    window.addEventListener('online', onOnline)
  }
})

onBeforeUnmount(() => {
  if (unsubscribe) {
    unsubscribe()
    unsubscribe = null
  }
  if (typeof window !== 'undefined') {
    window.removeEventListener('visibilitychange', onVisibility)
    window.removeEventListener('focus', onFocus)
    window.removeEventListener('online', onOnline)
  }
})
</script>

<style scoped>
.dash-shell {
  padding: 0 18px 18px;
  font-family: 'Inter', system-ui, -apple-system, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif;
  background: var(--bg-app);
  min-height: calc(100vh - var(--nav-h, 56px));
}

@media (max-width: 768px) {
  .dash-shell { padding: 0 14px 14px; }
}
</style>
