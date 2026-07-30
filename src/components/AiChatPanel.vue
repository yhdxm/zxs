<template>
  <div class="ai-chat-panel" :class="{ 'panel-compact': compact }">
    <header class="ai-header">
      <div class="ai-title">
        <span class="ai-title-icon"><el-icon><MagicStick /></el-icon></span>
        <div class="ai-title-text">
          <h2>{{ title }}</h2>
          <p v-if="subtitle">{{ subtitle }}</p>
        </div>
      </div>
      <div class="ai-header-actions">
        <el-button text @click="clearChat"><el-icon><Delete /></el-icon> 清空</el-button>
        <el-button type="primary" @click="configVisible = true"><el-icon><Setting /></el-icon> 配置</el-button>
      </div>
    </header>

    <div class="chat-scroll" ref="scrollRef">
      <div v-if="messages.length === 0" class="empty-chat">
        <div class="empty-orb"><el-icon><MagicStick /></el-icon></div>
        <p>输入你的问题，AI 会直接回复。点击右上角「配置」可切换模型与密钥。</p>
      </div>
      <div v-for="(message, index) in messages" :key="index" class="message-row" :class="message.role">
        <div class="avatar">{{ message.role === 'user' ? '我' : 'AI' }}</div>
        <div v-if="message.role === 'assistant'" class="message-bubble">
          <div class="md" v-html="parts(message.content).bodyHtml"></div>
          <div v-if="parts(message.content).hasSummary" class="md-summary">
            <div class="md-summary-head"><el-icon><Memo /></el-icon> 总结</div>
            <div class="md" v-html="parts(message.content).summaryHtml"></div>
          </div>
          <div class="msg-actions">
            <button
              v-if="isErrorReply(message.content)"
              class="md-retry"
              type="button"
              :disabled="loading"
              @click="retry(index)"
            >
              <el-icon><RefreshRight /></el-icon> 重试
            </button>
            <button class="md-copy" type="button" @click="copyText(message.content)">
              <el-icon><CopyDocument /></el-icon> 复制全文
            </button>
          </div>
        </div>
        <div v-else class="message-bubble">{{ message.content }}</div>
      </div>
    </div>

    <div class="chat-input-bar">
      <el-input
        v-model="prompt"
        type="textarea"
        :rows="isMobile ? 2 : 3"
        resize="none"
        placeholder="例如：帮我生成一个 Vue3 的登录页组件"
        @keydown.enter.exact.prevent="sendPrompt"
      />
      <el-button type="primary" class="send-btn" :loading="loading" @click="sendPrompt">
        <el-icon><Promotion /></el-icon>
        <span class="send-text">发送</span>
      </el-button>
    </div>

    <el-dialog v-model="configVisible" title="AI 配置" width="640px" class="ai-config-dialog" align-center>
      <AiConfigPanel />
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { MagicStick, Setting, Delete, Promotion, Memo, CopyDocument, RefreshRight } from '@element-plus/icons-vue'
import { callAi, loadAiConfig } from '../services/aiService'
import { recordUsage } from '../services/usageTracker'
import { renderMarkdown, splitSummary } from '../lib/markdown'
import AiConfigPanel from './AiConfigPanel.vue'

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

const props = withDefaults(defineProps<{
  title?: string
  subtitle?: string
  compact?: boolean
}>(), {
  title: 'AI 助手',
  subtitle: '配置一次即可长期使用，密钥自动加密隐藏显示。',
  compact: false
})

const prompt = ref('')
const messages = ref<ChatMessage[]>([])
const loading = ref(false)
const configVisible = ref(false)
const scrollRef = ref<HTMLElement | null>(null)
const STORAGE_KEY = 'ai-chat-history'

const isMobile = ref(false)
const keyboardOffset = ref(0)
const adjustForKeyboard = () => {
  if (typeof window === 'undefined' || !window.visualViewport) return
  const vv = window.visualViewport
  const offset = window.innerHeight - vv.height - vv.offsetTop
  keyboardOffset.value = offset > 0 ? offset : 0
}
const updateIsMobile = () => {
  if (typeof window !== 'undefined') {
    isMobile.value = window.innerWidth <= 768
  }
}

const scrollToBottom = async () => {
  await nextTick()
  if (scrollRef.value) {
    scrollRef.value.scrollTop = scrollRef.value.scrollHeight
  }
}

const syncHistory = () => {
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(messages.value))
  }
}

const loadHistory = () => {
  if (typeof window === 'undefined') return
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) messages.value = parsed as ChatMessage[]
    }
  } catch {
    messages.value = []
  }
}

const parts = (content: string) => {
  const { body, summary } = splitSummary(content)
  return {
    bodyHtml: renderMarkdown(body),
    summaryHtml: summary ? renderMarkdown(summary) : '',
    hasSummary: Boolean(summary)
  }
}

const copyText = async (text: string) => {
  try {
    await navigator.clipboard.writeText(text)
    ElMessage.success('已复制到剪贴板')
  } catch {
    ElMessage.warning('复制失败，请手动选择文本')
  }
}

const sendPrompt = async () => {
  const text = prompt.value.trim()
  if (!text || loading.value) return

  const latestConfig = await loadAiConfig()
  messages.value.push({ role: 'user', content: text })
  syncHistory()
  prompt.value = ''
  // 先占位一条 assistant 消息，索引固定，便于重试时原地更新
  const assistantIndex = messages.value.length
  messages.value.push({ role: 'assistant', content: '正在思考…' })
  loading.value = true
  await scrollToBottom()

  await callAndUpdate(latestConfig, text, assistantIndex)
}

/** 复用 callAi 发起一次调用，并将结果原地写入 assistantIndex 位置的消息 */
const callAndUpdate = async (config: Awaited<ReturnType<typeof loadAiConfig>>, userText: string, assistantIndex: number) => {
  loading.value = true
  try {
    const reply = await callAi(config, userText)
    messages.value[assistantIndex] = { role: 'assistant', content: reply }
    // 记录本次调用用量（本地统计，不消耗积分、不上云）
    recordUsage({
      provider: config.provider,
      model: config.model,
      promptText: userText,
      completionText: reply
    })
  } catch (error) {
    messages.value[assistantIndex] = {
      role: 'assistant',
      content: '⚠️ 调用失败：' + (error instanceof Error ? error.message : '未知错误') + '\n\n点击「重试」可重新发送上一条消息。'
    }
  } finally {
    loading.value = false
    syncHistory()
    await scrollToBottom()
  }
}

/** 判断助手回复是否为错误回退提示（用于展示重试按钮） */
const isErrorReply = (content: string): boolean => content.startsWith('⚠️ 调用失败：')

/** 重试某条助手消息：找到其紧邻的上一条用户消息，重新发起调用 */
const retry = async (assistantIndex: number) => {
  if (loading.value) return
  let userText = ''
  for (let i = assistantIndex - 1; i >= 0; i -= 1) {
    if (messages.value[i]?.role === 'user') {
      userText = messages.value[i]?.content ?? ''
      break
    }
  }
  if (!userText) {
    ElMessage.warning('未找到可重试的原始提问')
    return
  }
  const config = await loadAiConfig()
  await callAndUpdate(config, userText, assistantIndex)
}

const clearChat = () => {
  messages.value = []
  syncHistory()
  ElMessage.success('对话已清空')
}

watch(messages, () => syncHistory(), { deep: true })

onMounted(() => {
  loadHistory()
  scrollToBottom()
  if (typeof window !== 'undefined') {
    window.addEventListener('resize', updateIsMobile)
    updateIsMobile()
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', adjustForKeyboard)
      window.visualViewport.addEventListener('scroll', adjustForKeyboard)
    }
    adjustForKeyboard()
  }
})

onBeforeUnmount(() => {
  if (typeof window !== 'undefined') {
    window.removeEventListener('resize', updateIsMobile)
    if (window.visualViewport) {
      window.visualViewport.removeEventListener('resize', adjustForKeyboard)
      window.visualViewport.removeEventListener('scroll', adjustForKeyboard)
    }
  }
})
</script>

<style scoped>
.ai-chat-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  min-width: 0;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 16px;
  overflow: hidden;
  box-shadow: var(--shadow-card);
}

.ai-header {
  flex-shrink: 0;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  padding: 14px 20px;
  background: var(--surface-soft);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border-bottom: 1px solid var(--border);
}
.ai-title { display: flex; align-items: center; gap: 12px; min-width: 0; }
.ai-title-icon {
  width: 40px; height: 40px; border-radius: 12px;
  display: grid; place-items: center;
  background: linear-gradient(135deg, var(--primary-3), var(--primary-2));
  color: #fff; flex-shrink: 0;
  box-shadow: 0 8px 18px var(--accent-glow);
}
.ai-title-icon :deep(svg) { font-size: 20px; }
.ai-title-text { min-width: 0; }
.ai-title h2 { margin: 0; font-size: 18px; font-weight: 800; color: var(--text-strong); }
.ai-title p { margin: 2px 0 0; font-size: 12px; color: var(--text-muted); }
.ai-header-actions { display: flex; gap: 8px; flex-shrink: 0; }
.ai-header-actions :deep(.el-button) { display: inline-flex; align-items: center; gap: 4px; }

.ai-body,
.chat-scroll {
  flex: 1;
  overflow-y: auto;
  padding: 22px 20px;
  display: flex;
  flex-direction: column;
  gap: 14px;
  min-width: 0;
  align-items: stretch;
  background: var(--bg-app);
}

.empty-chat { margin: auto; text-align: center; color: var(--text-faint); max-width: 360px; }
.empty-orb {
  width: 64px; height: 64px; margin: 0 auto 14px; border-radius: 20px;
  display: grid; place-items: center;
  background: linear-gradient(135deg, var(--primary-3), var(--primary-2));
  color: #fff; box-shadow: 0 14px 32px var(--accent-glow);
}
.empty-orb :deep(svg) { font-size: 30px; }
.empty-chat p { font-size: 14px; line-height: 1.7; }

.message-row { display: flex; gap: 10px; align-items: flex-start; min-width: 0; max-width: 100%; width: 100%; }
.message-row.user { align-self: flex-end; flex-direction: row-reverse; max-width: min(760px, 100%); width: auto; }
.avatar {
  width: 34px; height: 34px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  font-size: 12px; font-weight: 700; color: #fff;
  background: linear-gradient(135deg, var(--primary), var(--primary-3));
  flex-shrink: 0;
}
.message-row.assistant .avatar { background: linear-gradient(135deg, #10b981, #14b8a6); }
.message-bubble {
  padding: 11px 14px; border-radius: 14px;
  background: var(--surface); border: 1px solid var(--border);
  white-space: pre-wrap; word-break: break-word; overflow-wrap: anywhere;
  line-height: 1.7; font-size: 14px; color: var(--text-strong);
  box-shadow: 0 4px 14px rgba(15, 23, 42, 0.05);
  min-width: 0; max-width: 100%; width: 100%; box-sizing: border-box;
}
.message-row.user .message-bubble { width: auto; background: linear-gradient(120deg, var(--primary), var(--primary-3)); color: #fff; border-color: transparent; }

.message-bubble :deep(.md) { white-space: normal; word-break: break-word; }
.message-bubble :deep(.md-h1), .message-bubble :deep(.md-h2), .message-bubble :deep(.md-h3),
.message-bubble :deep(.md-h4), .message-bubble :deep(.md-h5), .message-bubble :deep(.md-h6) {
  margin: 12px 0 6px; line-height: 1.35; font-weight: 800; color: var(--text-strong);
}
.message-bubble :deep(.md-h1) { font-size: 19px; }
.message-bubble :deep(.md-h2) { font-size: 17px; }
.message-bubble :deep(.md-h3) { font-size: 15px; }
.message-bubble :deep(.md-h4), .message-bubble :deep(.md-h5), .message-bubble :deep(.md-h6) { font-size: 14px; }
.message-bubble :deep(.md-p) { margin: 6px 0; }
.message-bubble :deep(.md-ul), .message-bubble :deep(.md-ol) { margin: 6px 0; padding-left: 20px; }
.message-bubble :deep(.md-li) { margin: 2px 0; }
.message-bubble :deep(.md-a) { color: var(--primary); text-decoration: underline; }
.message-bubble :deep(.md-code) {
  background: var(--surface-soft); color: var(--primary);
  padding: 1px 5px; border-radius: 5px;
  font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace; font-size: 12.5px;
}
.message-bubble :deep(.md-pre) {
  background: #0f172a; color: #e2e8f0; padding: 12px 14px; border-radius: 10px;
  overflow: auto; overflow-x: auto; overflow-y: hidden; margin: 8px 0;
  font-size: 12.5px; line-height: 1.6; max-width: 100%; width: 100%; box-sizing: border-box; min-width: 0;
}
.message-bubble :deep(.md-pre .md-code) { background: transparent; color: inherit; padding: 0; white-space: pre; display: block; word-break: normal; max-width: 100%; }
.message-bubble :deep(.md-quote) { border-left: 3px solid var(--border-strong); padding-left: 10px; margin: 6px 0; color: var(--text-muted); }
.message-bubble :deep(.md-hr) { border: none; border-top: 1px solid var(--border); margin: 10px 0; }

.md-summary {
  margin-top: 12px; border: 1px solid var(--border-strong);
  background: linear-gradient(135deg, rgba(99, 102, 241, 0.06), rgba(6, 182, 212, 0.06));
  border-radius: 12px; padding: 10px 12px;
}
.md-summary-head { display: flex; align-items: center; gap: 6px; font-weight: 700; color: var(--primary); font-size: 13px; margin-bottom: 6px; }
.md-summary-head :deep(svg) { font-size: 15px; }
.md-summary :deep(.md-p) { margin: 4px 0; }
.msg-actions {
  margin-top: 10px; display: flex; align-items: center; gap: 14px; flex-wrap: wrap;
}
.md-copy {
  display: inline-flex; align-items: center; gap: 4px; font-size: 12px;
  color: var(--text-faint); background: transparent; border: none; cursor: pointer; padding: 0; transition: color 0.2s;
}
.md-retry {
  display: inline-flex; align-items: center; gap: 4px; font-size: 12px;
  color: var(--primary); background: transparent; border: none; cursor: pointer; padding: 0; transition: opacity 0.2s;
}
.md-retry:hover { opacity: 0.7; }
.md-retry:disabled { opacity: 0.45; cursor: not-allowed; }
.md-copy:hover { color: var(--primary); }

.chat-input-bar {
  flex-shrink: 0; display: flex; gap: 10px; align-items: flex-end;
  padding: 14px 20px calc(14px + env(safe-area-inset-bottom, 0px));
  background: var(--surface-soft);
  backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);
  border-top: 1px solid var(--border);
}
.chat-input-bar :deep(.el-textarea) { flex: 1; }
.send-btn {
  height: 44px; padding: 0 18px; display: inline-flex; align-items: center; gap: 6px;
  background: linear-gradient(120deg, var(--primary), var(--primary-3)); border: none;
  box-shadow: 0 8px 18px var(--accent-glow);
}
.send-btn :deep(svg) { font-size: 16px; }

:deep(.ai-config-dialog .el-dialog) { border-radius: 18px; overflow: hidden; }

/* 紧凑模式（嵌入看板/监测模块时） */
.panel-compact .ai-header { padding: 10px 16px; }
.panel-compact .ai-title-icon { width: 34px; height: 34px; }
.panel-compact .ai-title h2 { font-size: 16px; }
.panel-compact .chat-scroll { padding: 16px 16px; }

@media (max-width: 640px) {
  .ai-header { padding: 12px 14px; }
  .ai-title p { display: none; }
  .chat-scroll { padding: 16px 14px; }
  .chat-input-bar { padding: 12px 14px calc(12px + env(safe-area-inset-bottom, 0px)); }
  .message-row { max-width: 94%; }
  .send-text { display: none; }
  .send-btn { padding: 0 14px; }
}
</style>
