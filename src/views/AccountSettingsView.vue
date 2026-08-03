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
    </div>
  </div>
</template>

<script setup lang="ts">
import { useKeyboardAvoid } from '../composables/useKeyboardAvoid'

useKeyboardAvoid()
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { User, Lock } from '@element-plus/icons-vue'
import {
  getSavedUser,
  updateAccount,
  changeOwnPassword,
  refreshSavedUser,
  type AppUser
} from '../services/appDataService'
import PageHeader from '../components/PageHeader.vue'

const currentUser = ref<AppUser | null>(null)
const saving = ref(false)
const form = reactive({
  nickname: '',
  password: '',
  confirmPassword: ''
})

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

@media (max-width: 768px) {
  .account-page { padding: 0 12px 12px; }
  .account-cards { grid-template-columns: 1fr; }
  .account-card { padding: 18px; }
}
</style>
