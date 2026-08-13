<template>
  <header class="page-header-card">
    <div class="ph-inner">
      <div class="ph-brand">
        <span class="ph-icon">
          <slot name="icon">
            <el-icon><component :is="icon" /></el-icon>
          </slot>
        </span>
        <div class="ph-text">
          <h2 class="ph-title">{{ title }}</h2>
          <p v-if="subtitle" class="ph-sub">{{ subtitle }}</p>
          <slot name="sub" />
        </div>
      </div>
      <div v-if="$slots.actions || $slots.default" class="ph-actions">
        <slot name="actions" />
        <slot />
      </div>
    </div>
  </header>
</template>

<script setup lang="ts">
import { Grid } from '@element-plus/icons-vue'
import type { Component } from 'vue'

withDefaults(defineProps<{
  title: string
  subtitle?: string
  icon?: Component
}>(), {
  // 对象/组件类型的默认值必须使用工厂函数形式
  icon: () => Grid as unknown as Component
})
</script>

<style scoped>
.page-header-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 12px;
  box-shadow: var(--shadow-card);
  margin-bottom: 14px;
}
.ph-inner {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  padding: 14px 20px;
  min-width: 0;
}
.ph-brand {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}
.ph-icon {
  width: 40px;
  height: 40px;
  border-radius: 12px;
  display: grid;
  place-items: center;
  flex-shrink: 0;
  background: linear-gradient(135deg, var(--primary-3), var(--primary-2));
  color: #fff;
  box-shadow: 0 8px 18px var(--accent-glow);
}
.ph-icon :deep(svg) { font-size: 20px; }
.ph-text { min-width: 0; }
.ph-title {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: var(--text-strong);
  line-height: 1.3;
  /* 防止中文标题在窄屏竖排 */
  word-break: keep-all;
  white-space: nowrap;
}
.ph-sub {
  margin: 2px 0 0;
  font-size: 12px;
  font-weight: 400;
  color: var(--text-muted);
  line-height: 1.6;
  max-width: 820px;
}
.ph-actions {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 10px;
}
@media (max-width: 768px) {
  .page-header-card { margin-bottom: 10px; }
  .ph-inner {
    flex-direction: column;
    align-items: stretch;
    gap: 10px;
    padding: 12px 14px;
  }
  .ph-brand { flex-direction: row; align-items: center; gap: 10px; }
  .ph-title { font-size: 16px; overflow: hidden; text-overflow: ellipsis; }
  .ph-sub {
    font-size: 11.5px;
    line-height: 1.4;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
    word-break: break-word;
  }
  .ph-actions {
    flex-wrap: wrap;
    justify-content: flex-end;
    gap: 8px;
  }
}
@media (max-width: 480px) {
  .ph-inner { padding: 10px 12px; gap: 8px; }
  .ph-icon { width: 36px; height: 36px; border-radius: 10px; }
  .ph-title { font-size: 15px; }
  .ph-sub { -webkit-line-clamp: 1; font-size: 11px; }
  .ph-actions { flex-direction: column; align-items: stretch; gap: 6px; }
  .ph-actions :deep(.el-button) { width: 100%; justify-content: center; }
}
</style>
