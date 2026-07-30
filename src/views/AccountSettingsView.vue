<template>
  <div class="account-page">
    <div class="account-card">
      <header class="account-head">
        <div class="account-avatar">{{ avatarText }}</div>
        <div class="account-meta">
          <h2>{{ currentUser?.nickname || '用户' }}</h2>
          <p>@{{ currentUser?.username }}</p>
          <el-tag size="small" :type="roleTagType" effect="light">{{ roleLabel }}</el-tag>
        </div>
      </header>

      <el-form label-position="top" class="account-form">
        <el-form-item label="昵称">
          <el-input v-model="form.nickname" placeholder="请输入昵称" maxlength="32" show-word-limit />
        </el-form-item>

        <el-form-item label="新密码（留空则不修改）">
          <el-input v-model="form.password" type="password" show-password placeholder="6-32 位密码" />
        </el-form-item>

        <el-form-item label="确认新密码">
          <el-input v-model="form.confirmPassword" type="password" show-password placeholder="再次输入新密码" />
        </el-form-item>

        <div class="account-actions">
          <el-button type="primary" :loading="saving" @click="save">保存修改</el-button>
        </div>
      </el-form>
    </div>

    <!-- 免费 API Key 设置（Fix #7）：天地图 / 天行数据，仅存本地 -->
    <div class="account-card free-key-card">
      <header class="account-head">
        <div>
          <h2>免费 API Key 设置</h2>
          <p>用于地图（天地图）与新闻（天行数据）的免费公开 API；密钥仅保存在本浏览器 localStorage，绝不上传云端。</p>
        </div>
      </header>

      <el-form label-position="top" class="account-form">
        <el-form-item label="天地图 Key（地图底图，可选）">
          <el-input v-model="tiandituKey" placeholder="未配置则自动降级为 OpenStreetMap" clearable />
        </el-form-item>

        <el-form-item label="天行数据 Key（新闻，可选）">
          <el-input v-model="tianxingKey" placeholder="未配置则新闻降级为公共 RSS" clearable />
        </el-form-item>

        <div class="account-actions">
          <el-button type="primary" :loading="savingKeys" @click="saveFreeKeys">保存 Key</el-button>
        </div>
      </el-form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import {
  getSavedUser,
  updateAccount,
  changeOwnPassword,
  refreshSavedUser,
  type AppUser
} from '../services/appDataService'
import { readFreeApiKey, writeFreeApiKey } from '../services/geoService'

const currentUser = ref<AppUser | null>(null)
const saving = ref(false)
const form = reactive({
  nickname: '',
  password: '',
  confirmPassword: ''
})

/* 免费 API Key 设置（Fix #7）：天地图 / 天行数据，仅存本地 localStorage，不上云 */
const tiandituKey = ref('')
const tianxingKey = ref('')
const savingKeys = ref(false)

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

const loadFreeKeys = () => {
  tiandituKey.value = readFreeApiKey('tianditu')
  tianxingKey.value = readFreeApiKey('tianxing')
}

const saveFreeKeys = () => {
  savingKeys.value = true
  try {
    writeFreeApiKey('tianditu', tiandituKey.value.trim())
    writeFreeApiKey('tianxing', tianxingKey.value.trim())
    ElMessage.success('免费 API Key 已保存（仅存本地，不上云）')
  } catch {
    ElMessage.error('保存失败')
  } finally {
    savingKeys.value = false
  }
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
  loadFreeKeys()
})
</script>

<style scoped>
.account-page {
  padding: 20px;
  max-width: 680px;
  margin: 0 auto;
}
.account-card {
  background: #fff;
  border: 1px solid #eef0f4;
  border-radius: 18px;
  padding: 28px;
  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.05);
}
.account-head {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 24px;
  padding-bottom: 20px;
  border-bottom: 1px solid #f1f5f9;
}
.account-avatar {
  width: 64px;
  height: 64px;
  border-radius: 18px;
  background: linear-gradient(135deg, #4f46e5, #6366f1);
  color: #fff;
  display: grid;
  place-items: center;
  font-size: 24px;
  font-weight: 800;
  flex-shrink: 0;
}
.account-meta h2 {
  margin: 0 0 4px;
  font-size: 20px;
  color: #0f172a;
}
.account-meta p {
  margin: 0 0 8px;
  font-size: 13px;
  color: #64748b;
}
.account-actions {
  display: flex;
  justify-content: flex-end;
  margin-top: 8px;
}

@media (max-width: 768px) {
  .account-page { padding: 12px; }
  .account-card { padding: 20px; }
}

.free-key-card { margin-top: 20px; }
.free-key-card .account-head { margin-bottom: 16px; }
.free-key-card p { margin: 0; font-size: 13px; color: #64748b; line-height: 1.6; }
</style>
