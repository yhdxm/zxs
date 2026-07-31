<template>
  <header class="page-header">
    <div class="ph-left">
      <h2 class="ph-title">{{ title }}</h2>
      <p v-if="subtitle" class="ph-sub">{{ subtitle }}</p>
      <slot name="sub" />
    </div>
    <div v-if="$slots.actions || $slots.default" class="ph-actions">
      <slot name="actions" />
      <slot />
    </div>
  </header>
</template>

<script setup lang="ts">
defineProps<{
  title: string
  subtitle?: string
}>()
</script>

<style scoped>
/* 统一页头：标题字号/颜色全局一致，紧凑一行布局 */
.page-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 18px;
}
.ph-left {
  min-width: 0;
  flex: 1;
}
.ph-title {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: var(--text-strong);
  line-height: 1.3;
}
.ph-sub {
  margin: 4px 0 0;
  font-size: 13px;
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
  padding-top: 2px;
}
@media (max-width: 768px) {
  .page-header {
    flex-direction: column;
    align-items: stretch;
    gap: 12px;
  }
  .ph-actions {
    flex-wrap: wrap;
  }
}
</style>
