<template>
  <div class="ai-page" :class="isAuthed ? 'ai-fixed' : 'ai-flow'">
    <AiChatPanel title="AI 助手" subtitle="配置一次即可长期使用，密钥自动加密隐藏显示。" />
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import AiChatPanel from '../components/AiChatPanel.vue'

// 登录态用固定布局占满主区域；未登录态走常规文档流
const isAuthed = ref(typeof window !== 'undefined' && Boolean(window.localStorage.getItem('smart-dashboard-user')))
</script>

<style scoped>
.ai-page {
  display: flex;
  flex-direction: column;
  min-width: 0;
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
}
</style>
