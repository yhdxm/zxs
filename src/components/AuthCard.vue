<template>
  <div class="auth-card">
    <div class="title-row">
      <div>
        <h2>{{ isLogin ? '登录' : '注册' }}</h2>
        <p class="subtitle">{{ isLogin ? '欢迎回来，登录后进入工作台' : '注册一个新账号，数据云端同步' }}</p>
      </div>
      <el-button text type="primary" @click="toggleMode">{{ isLogin ? '去注册' : '去登录' }}</el-button>
    </div>

    <el-form
      ref="formRef"
      :model="form"
      :rules="rules"
      :label-position="isMobile ? 'top' : 'right'"
      :label-width="isMobile ? 'auto' : '84px'"
      @submit.prevent="submit"
    >
      <el-form-item v-if="!isLogin" label="昵称" prop="nickname">
        <el-input v-model="form.nickname" placeholder="展示用昵称，2-20 个字符" maxlength="20" @keyup.enter="submit" />
      </el-form-item>
      <el-form-item label="用户名" prop="username">
        <el-input v-model="form.username" placeholder="4-20 位字母、数字或下划线" maxlength="20" @keyup.enter="submit" />
      </el-form-item>
      <el-form-item label="密码" prop="password">
        <el-input v-model="form.password" type="password" placeholder="至少 6 位" show-password maxlength="32" @keyup.enter="submit" />
      </el-form-item>
      <el-form-item v-if="!isLogin" label="确认密码" prop="confirmPassword">
        <el-input v-model="form.confirmPassword" type="password" placeholder="再次输入密码" show-password maxlength="32" @keyup.enter="submit" />
      </el-form-item>
      <el-form-item>
        <el-button type="primary" class="full" :loading="loading" @click="submit">
          {{ isLogin ? '登录' : '注册' }}
        </el-button>
      </el-form-item>
    </el-form>

  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, reactive, ref } from 'vue'
import { useKeyboardAvoid } from '../composables/useKeyboardAvoid'

useKeyboardAvoid()
import { useRouter } from 'vue-router'
import { ElMessage, type FormInstance, type FormRules } from 'element-plus'
import { loginUser, registerUser, bootstrapAdminIfNeeded } from '../services/appDataService'

const router = useRouter()
const isLogin = ref(true)
const loading = ref(false)
const formRef = ref<FormInstance>()
const form = reactive({ nickname: '', username: '', password: '', confirmPassword: '' })

// 移动端表单标签置顶
const isMobile = ref(false)
const updateIsMobile = () => {
  if (typeof window !== 'undefined') {
    isMobile.value = window.innerWidth <= 768
  }
}
if (typeof window !== 'undefined') {
  window.addEventListener('resize', updateIsMobile)
  updateIsMobile()
}
onBeforeUnmount(() => {
  if (typeof window !== 'undefined') {
    window.removeEventListener('resize', updateIsMobile)
  }
})

const validateConfirm = (_rule: unknown, value: string, callback: (error?: Error) => void) => {
  if (isLogin.value) {
    callback()
    return
  }
  if (!value) {
    callback(new Error('请再次输入密码'))
  } else if (value !== form.password) {
    callback(new Error('两次输入的密码不一致'))
  } else {
    callback()
  }
}

const rules: FormRules = {
  nickname: [
    { required: true, message: '请输入昵称', trigger: 'blur' },
    { min: 2, max: 20, message: '昵称长度为 2-20 个字符', trigger: 'blur' }
  ],
  username: [
    { required: true, message: '请输入用户名', trigger: 'blur' },
    { pattern: /^[A-Za-z0-9_]{4,20}$/, message: '用户名为 4-20 位字母、数字或下划线', trigger: 'blur' }
  ],
  password: [
    { required: true, message: '请输入密码', trigger: 'blur' },
    { min: 6, max: 32, message: '密码长度为 6-32 位', trigger: 'blur' }
  ],
  confirmPassword: [{ validator: validateConfirm, trigger: 'blur' }]
}

const toggleMode = () => {
  isLogin.value = !isLogin.value
  form.nickname = ''
  form.confirmPassword = ''
  formRef.value?.clearValidate()
}

const submit = async () => {
  if (!formRef.value || loading.value) {
    return
  }

  const valid = await formRef.value.validate().catch(() => false)
  if (!valid) {
    return
  }

  loading.value = true
  try {
    if (isLogin.value) {
      try {
        await loginUser(form.username, form.password)
      } catch (err) {
        const isAdmin = form.username.trim().toLowerCase() === 'admin'
        const msg = err instanceof Error ? err.message : ''
        // 首次使用：管理员不存在时自动初始化，并返回初始密码引导登录
        if (isAdmin && /账号或密码错误|账号不存在/.test(msg)) {
          const boot = await bootstrapAdminIfNeeded()
          if (boot.needed) {
            ElMessage({
              message: `已初始化默认管理员，初始密码：${boot.password}（请登录后立即修改）`,
              type: 'success',
              duration: 10000
            })
            return
          }
        }
        throw err
      }
    } else {
      await registerUser(form.username, form.password, form.nickname.trim())
      ElMessage.success('注册成功，已自动登录')
    }
    router.replace('/dashboard')
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '操作失败')
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.auth-card {
  background: white;
  border-radius: 20px;
  padding: 24px;
  box-shadow: 0 10px 30px rgba(15, 23, 42, 0.08);
}

.title-row {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 16px;
}

.title-row h2 {
  margin: 0;
}

.subtitle {
  margin: 4px 0 0;
  color: #6b7280;
  font-size: 13px;
}

.full {
  width: 100%;
}

@media (max-width: 768px) {
  .auth-card {
    padding: 18px 14px;
  }
}
</style>
