<template>
  <div class="ai-page" :class="isAuthed ? 'ai-fixed' : 'ai-flow'">
    <PageHeader
      title="AI 助手"
      subtitle="配置一次即可长期使用，密钥自动加密隐藏显示。对话历史按账号隔离。"
      :icon="MagicStick"
    >
      <el-button text @click="onClear">
        <el-icon><Delete /></el-icon> 清空对话
      </el-button>
      <el-button type="primary" @click="onConfig">
        <el-icon><Setting /></el-icon> 配置
      </el-button>
    </PageHeader>

    <AiChatPanel ref="chatRef" hide-header />
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { MagicStick, Delete, Setting } from '@element-plus/icons-vue'
import AiChatPanel from '../components/AiChatPanel.vue'
import PageHeader from '../components/PageHeader.vue'

// 登录态用固定布局占满主区域；未登录态走常规文档流
const isAuthed = ref(typeof window !== 'undefined' && Boolean(window.localStorage.getItem('smart-dashboard-user')))
const chatRef = ref<InstanceType<typeof AiChatPanel> | null>(null)

const onClear = () => chatRef.value?.clearChat()
const onConfig = () => chatRef.value?.openConfig()
</script>

<style scoped>
.ai-page {
  display: flex;
  flex-direction: column;
  min-width: 0;
  max-width: 1400px;
  margin: 0 auto;
  padding: 0 18px 18px;
  width: 100%;
  box-sizing: border-box;
}
.ai-page.ai-fixed {
  position: relative;
  height: 100%;
  min-height: 0;
}
.ai-page.ai-flow {
  position: relative;
  height: 100%;
  min-height: 100vh;
  min-height: 100dvh;
}
</style>
