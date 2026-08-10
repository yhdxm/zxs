<template>
  <div class="account-page">
    <PageHeader
      title="个人设置"
      subtitle="管理你的昵称与登录密码，修改后立即生效。"
      :icon="User"
    >
      <el-button type="primary" :loading="saving" @click="save">保存修改</el-button>
    </PageHeader>

    <div class="account-cards">
      <!-- 基本资料 -->
      <section class="account-card">
        <header class="ac-head">
          <span class="ac-ico"><el-icon><User /></el-icon></span>
          <div class="ac-head-txt">
            <h3>基本资料</h3>
            <p>头像与昵称展示</p>
          </div>
        </header>
        <div class="ac-profile">
          <div class="account-avatar">{{ avatarText }}</div>
          <div class="ac-profile-meta">
            <div class="ac-nick">{{ currentUser?.nickname || '用户' }}</div>
            <div class="ac-uname">@{{ currentUser?.username }}</div>
            <el-tag size="small" :type="roleTagType" effect="light">{{ roleLabel }}</el-tag>
          </div>
        </div>
        <el-form label-position="top">
          <el-form-item label="昵称">
            <el-input v-model="form.nickname" placeholder="请输入昵称" maxlength="32" show-word-limit />
          </el-form-item>
        </el-form>
      </section>

      <!-- 安全设置 -->
      <section class="account-card">
        <header class="ac-head">
          <span class="ac-ico"><el-icon><Lock /></el-icon></span>
          <div class="ac-head-txt">
            <h3>安全设置</h3>
            <p>修改登录密码</p>
          </div>
        </header>
        <el-form label-position="top">
          <el-form-item label="新密码（留空则不修改）">
            <el-input v-model="form.password" type="password" show-password placeholder="6-32 位密码" />
          </el-form-item>
          <el-form-item label="确认新密码">
            <el-input v-model="form.confirmPassword" type="password" show-password placeholder="再次输入新密码" />
          </el-form-item>
        </el-form>
      </section>

      <!-- 消息推送订阅 -->
      <section class="account-card">
        <header class="ac-head">
          <span class="ac-ico"><el-icon><Bell /></el-icon></span>
          <div class="ac-head-txt">
            <h3>消息推送订阅</h3>
            <p>开启后可在手机锁屏收到系统通知</p>
          </div>
        </header>

        <div v-if="!pushSupported" class="ac-tip warn">当前浏览器不支持系统推送（如 iQOO / vivo 自带浏览器）。请用 Chrome / Edge / Firefox 打开本页订阅；或直接使用右上角「铃铛」站内消息中心，消息仍会实时收到（每 30 秒刷新）。</div>
        <template v-else>
          <div class="ac-row">
            <span>通知权限：<b>{{ permLabel }}</b></span>
            <span v-if="subRow">已订阅</span>
            <span v-else>未订阅</span>
          </div>
          <div class="ac-modules">
            <span class="ac-modules-label">接收模块：</span>
            <el-checkbox-group v-model="subModules">
              <el-checkbox v-for="m in PUSH_MODULES" :key="m.key" :value="m.key">{{ m.label }}</el-checkbox>
            </el-checkbox-group>
          </div>
          <div class="ac-actions">
            <el-button v-if="!subRow" type="success" :loading="subLoading" @click="onSub">订阅本机通知</el-button>
            <el-button v-else :loading="subLoading" @click="onSaveModules">保存模块选择</el-button>
            <el-button v-if="subRow" text type="danger" @click="onUnsub">退订</el-button>
          </div>
          <div v-if="subMsg" class="ac-tip">{{ subMsg }}</div>
        </template>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useKeyboardAvoid } from '../composables/useKeyboardAvoid'

useKeyboardAvoid()
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { User, Lock, Bell } from '@element-plus/icons-vue'
import {
  getSavedUser,
  updateAccount,
  changeOwnPassword,
  refreshSavedUser,
  type AppUser
} from '../services/appDataService'
import PageHeader from '../components/PageHeader.vue'
import {
  PUSH_MODULES,
  isPushSupported,
  currentPermission,
  subscribe as pushSubscribe,
  updateModules,
  unsubscribe as pushUnsubscribe,
  getSubscriptionRow,
  type PushSubscriptionRow
} from '../services/pushService'

const currentUser = ref<AppUser | null>(null)
const saving = ref(false)
const form = reactive({
  nickname: '',
  password: '',
  confirmPassword: ''
})

/* ===== 消息推送订阅 ===== */
const pushSupported = isPushSupported()
const perm = ref<NotificationPermission>('default')
const subRow = ref<PushSubscriptionRow | null>(null)
const subModules = ref<string[]>(PUSH_MODULES.map((m) => m.key))
const subLoading = ref(false)
const subMsg = ref('')
const permLabel = computed(() =>
  perm.value === 'granted' ? '已授权' : perm.value === 'denied' ? '已拒绝' : '未授权'
)

const refreshSub = async () => {
  perm.value = currentPermission()
  if (!pushSupported) return
  try {
    subRow.value = await getSubscriptionRow()
    if (subRow.value) {
      subModules.value = subRow.value.modules?.length ? subRow.value.modules : PUSH_MODULES.map((m) => m.key)
    }
  } catch {
    subRow.value = null
  }
}
const onSub = async () => {
  subLoading.value = true
  subMsg.value = ''
  try {
    await pushSubscribe(subModules.value)
    subMsg.value = '订阅成功，将接收所选模块的消息'
    await refreshSub()
  } catch (e) {
    subMsg.value = '订阅失败：' + (e instanceof Error ? e.message : String(e))
  } finally {
    subLoading.value = false
  }
}
const onSaveModules = async () => {
  subLoading.value = true
  subMsg.value = ''
  try {
    await updateModules(subModules.value)
    subMsg.value = '模块选择已保存'
    await refreshSub()
  } catch (e) {
    subMsg.value = '保存失败：' + (e instanceof Error ? e.message : String(e))
  } finally {
    subLoading.value = false
  }
}
const onUnsub = async () => {
  subLoading.value = true
  subMsg.value = ''
  try {
    await pushUnsubscribe()
    subRow.value = null
    subMsg.value = '已退订'
  } catch (e) {
    subMsg.value = '退订失败：' + (e instanceof Error ? e.message : String(e))
  } finally {
    subLoading.value = false
  }
}

const isSuperadmin = computed(() => currentUser.value?.role === 'superadmin')

const avatarText = computed(() => (currentUser.value?.nickname || '用').slice(0, 1).toUpperCase())
const roleLabel = computed(() => {
  const role = currentUser.value?.role
  if (role === 'superadmin') return '超级管理员'
  if (role === 'admin') return '管理员'
  return '普通用户'
})
const roleTagType = computed(() => {
  const role = currentUser.value?.role
  if (role === 'superadmin') return 'danger'
  if (role === 'admin') return 'warning'
  return 'info'
})

const loadUser = async () => {
  currentUser.value = await refreshSavedUser()
  form.nickname = currentUser.value?.nickname || ''
}

const save = async () => {
  if (!currentUser.value) return
  if (form.password && form.password !== form.confirmPassword) {
    ElMessage.error('两次输入的密码不一致')
    return
  }
  if (form.password && (form.password.length < 6 || form.password.length > 32)) {
    ElMessage.error('密码长度为 6-32 位')
    return
  }

  saving.value = true
  try {
    // 1) 改自己的登录密码：直接作用于 Supabase Auth（auth.users），立即生效
    if (form.password) {
      await changeOwnPassword(form.password)
    }
    // 2) 改昵称等资料（密码不再经 updateAccount，避免被丢弃不生效）
    await updateAccount({
      id: currentUser.value.authUserId || currentUser.value.id,
      nickname: form.nickname
    })
    await loadUser()
    ElMessage.success(form.password ? '保存成功，新密码已立即生效' : '保存成功')
    form.password = ''
    form.confirmPassword = ''
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '保存失败')
  } finally {
    saving.value = false
  }
}

onMounted(() => {
  loadUser()
  refreshSub()
})
</script>

<style scoped>
.account-page {
  padding: 0 18px 18px;
  max-width: 920px;
  margin: 0 auto;
}
.account-cards {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
  align-items: stretch;
}
.account-card {
  background: #fff;
  border: 1px solid #eef0f4;
  border-radius: 18px;
  padding: 22px;
  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.05);
  display: flex;
  flex-direction: column;
}
.ac-head {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 18px;
  padding-bottom: 14px;
  border-bottom: 1px solid #f1f5f9;
}
.ac-ico {
  width: 38px;
  height: 38px;
  border-radius: 11px;
  display: grid;
  place-items: center;
  color: #fff;
  flex-shrink: 0;
  background: linear-gradient(135deg, #4f46e5, #6366f1);
}
.ac-ico :deep(svg) { font-size: 18px; }
.ac-head-txt h3 {
  margin: 0 0 2px;
  font-size: 15px;
  font-weight: 600;
  color: var(--text-strong);
}
.ac-head-txt p {
  margin: 0;
  font-size: 12px;
  color: #64748b;
}
.ac-profile {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 12px 14px;
  margin-bottom: 16px;
  background: #f8fafc;
  border: 1px solid #eef0f4;
  border-radius: 12px;
}
.account-avatar {
  width: 48px;
  height: 48px;
  border-radius: 14px;
  background: linear-gradient(135deg, #4f46e5, #6366f1);
  color: #fff;
  display: grid;
  place-items: center;
  font-size: 18px;
  font-weight: 800;
  flex-shrink: 0;
}
.ac-profile-meta { min-width: 0; }
.ac-nick { font-size: 15px; font-weight: 600; color: var(--text-strong); }
.ac-uname { font-size: 12px; color: #64748b; margin: 2px 0 6px; }
.ac-tip { font-size: 13px; color: #64748b; margin-bottom: 10px; }
.ac-tip.warn { color: #ef4444; }
.ac-row { display: flex; gap: 16px; flex-wrap: wrap; font-size: 13px; color: var(--text); margin-bottom: 12px; }
.ac-modules { display: flex; align-items: flex-start; gap: 8px; flex-wrap: wrap; margin-bottom: 14px; }
.ac-modules-label { font-size: 13px; color: #64748b; padding-top: 6px; }
.ac-modules :deep(.el-checkbox-group) { display: flex; flex-wrap: wrap; gap: 4px 14px; }
.ac-actions { display: flex; gap: 10px; flex-wrap: wrap; }

@media (max-width: 768px) {
  .account-page { padding: 0 12px 12px; }
  .account-cards { grid-template-columns: 1fr; }
  .account-card { padding: 18px; }
}
</style>
