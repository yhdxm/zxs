<template>
  <div class="panel-card">
    <div class="panel-header">
      <div>
        <h3>AI 聊天助手配置</h3>
        <p>配置修改后自动保存；API Key 输入一次即长期有效，界面始终密文显示。</p>
      </div>
      <span class="save-state" :class="{ visible: savedTipVisible }">✓ 已自动保存</span>
    </div>

    <el-form :model="form" :label-width="isMobile ? 'auto' : '110px'" :label-position="isMobile ? 'top' : 'right'" class="ai-form">
      <el-form-item label="服务商">
        <el-select v-model="form.provider" style="width: 100%">
          <el-option label="Ollama（本地免费）" value="ollama" />
          <el-option label="OpenRouter" value="openrouter" />
          <el-option label="OpenAI 兼容接口" value="openai-compatible" />
          <el-option label="阿里百炼（DashScope）" value="bailian" />
        </el-select>
      </el-form-item>

      <el-form-item label="接口地址">
        <el-input v-model="form.baseUrl" :placeholder="form.provider === 'bailian' ? '可留空，系统会直接使用阿里百炼接口' : '例如 http://localhost:11434'" />
      </el-form-item>

      <el-form-item label="模型名称">
        <el-select v-model="form.model" filterable allow-create default-first-option style="width: 100%" placeholder="下拉选择模型，也可输入自定义模型名">
          <el-option v-for="name in modelOptions" :key="name" :label="name" :value="name" />
        </el-select>
      </el-form-item>

      <el-form-item label="API Key">
        <el-input
          v-model="form.apiKey"
          type="password"
          show-password
          :placeholder="hasStoredKey ? '已保存（密文），如需更换直接输入新 Key' : '填入你的 API Key，保存后无需重复输入'"
        />
      </el-form-item>

      <el-form-item label="系统提示词">
        <el-input v-model="form.systemPrompt" type="textarea" :rows="3" />
      </el-form-item>
    </el-form>

    <div class="hint-box">
      <strong>提示：</strong>
      <div>{{ providerHint }}</div>
    </div>

    <div class="action-row">
      <el-button type="success" :loading="testLoading" @click="sendTest">测试连接</el-button>
      <el-button @click="resetConfig">恢复默认</el-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import {
  MODEL_PRESETS,
  PROVIDER_DEFAULT_BASE_URL,
  callAi,
  defaultAiConfig,
  getProviderHint,
  loadAiConfig,
  saveAiConfig,
  type AiConfig
} from '../services/aiService'
import { getSavedUser } from '../services/appDataService'

const form = ref<AiConfig>({ ...defaultAiConfig })
const hasStoredKey = ref(false)
const ready = ref(false)
const savedTipVisible = ref(false)
const testLoading = ref(false)
const currentUserId = ref<string | null>(null)
let saveTimer: ReturnType<typeof setTimeout> | null = null
let tipTimer: ReturnType<typeof setTimeout> | null = null

const providerHint = computed(() => getProviderHint(form.value.provider))
const modelOptions = computed(() => MODEL_PRESETS[form.value.provider] || [])

// 移动端表单标签置顶，避免窄屏挤压输入框
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

// 配置变更后自动保存（防抖 500ms），无需手动点击保存
watch(form, () => {
  if (!ready.value) {
    return
  }

  if (saveTimer) {
    clearTimeout(saveTimer)
  }
  saveTimer = setTimeout(() => {
    saveAiConfig(form.value, currentUserId.value || undefined)
    hasStoredKey.value = Boolean(form.value.apiKey.trim())
    savedTipVisible.value = true
    if (tipTimer) {
      clearTimeout(tipTimer)
    }
    tipTimer = setTimeout(() => {
      savedTipVisible.value = false
    }, 1500)
  }, 500)
}, { deep: true })

// 切换服务商时自动带出默认接口地址和推荐模型
watch(() => form.value.provider, (provider, oldProvider) => {
  if (!ready.value || provider === oldProvider) {
    return
  }

  form.value.baseUrl = PROVIDER_DEFAULT_BASE_URL[provider]
  form.value.model = MODEL_PRESETS[provider]?.[0] || ''
})

const resetConfig = () => {
  form.value = { ...defaultAiConfig }
  saveAiConfig(form.value)
  ElMessage.success('已恢复默认配置')
}

const sendTest = async () => {
  testLoading.value = true
  try {
    const reply = await callAi(form.value, '请用一句话说明你正在工作。')
    ElMessage.success('连接成功：' + reply.slice(0, 40) + (reply.length > 40 ? '…' : ''))
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '连接失败')
  } finally {
    testLoading.value = false
  }
}

onMounted(async () => {
  try {
    const user = await getSavedUser()
    currentUserId.value = user?.id || null
    // 已登录则优先从云端带出账号级配置（跨设备免重复输入）
    form.value = await loadAiConfig(currentUserId.value || undefined)
    hasStoredKey.value = Boolean(form.value.apiKey.trim())
  } catch (error) {
    console.warn('[AiConfigPanel] 加载配置失败', error)
  }
  // 初始化完成后再启用自动保存，避免加载时误触发
  setTimeout(() => {
    ready.value = true
  }, 0)
})

onBeforeUnmount(() => {
  if (typeof window !== 'undefined') {
    window.removeEventListener('resize', updateIsMobile)
  }
})
</script>

<style scoped>
.panel-card {
  background: #fff;
  border-radius: 16px;
  padding: 20px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.06);
}

.panel-header {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: flex-start;
  margin-bottom: 16px;
}

.panel-header h3 {
  margin: 0 0 4px;
  font-size: 16px;
}

.panel-header p {
  margin: 0;
  font-size: 13px;
  color: #6b7280;
}

.save-state {
  color: #10b981;
  font-size: 13px;
  font-weight: 600;
  opacity: 0;
  transition: opacity 0.3s;
  white-space: nowrap;
}

.save-state.visible {
  opacity: 1;
}

.ai-form {
  margin-top: 10px;
}

.hint-box {
  margin: 12px 0;
  padding: 12px;
  border-radius: 8px;
  background: #f5f7fb;
  font-size: 13px;
  color: #4b5563;
  line-height: 1.6;
}

.action-row {
  display: flex;
  gap: 10px;
  margin-top: 12px;
}

@media (max-width: 640px) {
  .panel-card {
    padding: 16px;
  }
}
</style>
