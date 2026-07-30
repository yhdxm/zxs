<template>
  <div class="news-page">
    <header class="np-page-head">
      <div>
        <h2>新闻聚合</h2>
        <p>聚合多源免费新闻（天行数据 topnews / 公共 RSS），前端直连、无需 Key、不消耗任何积分。支持关键词筛选，点击卡片跳转原文。</p>
      </div>
    </header>
    <div class="np-page-body">
      <NewsPanel />
    </div>
  </div>
</template>

<script setup lang="ts">
import NewsPanel from '../components/NewsPanel.vue'
</script>

<style scoped>
.news-page {
  padding: 24px;
  max-width: 1180px;
  margin: 0 auto;
  color: var(--text);
}
.np-page-head { margin-bottom: 18px; }
.np-page-head h2 { margin: 0 0 6px; font-size: 22px; color: var(--text-strong); }
.np-page-head p { margin: 0; font-size: 13px; color: var(--text-muted); line-height: 1.6; max-width: 820px; }
.np-page-body { min-width: 0; }

@media (max-width: 768px) {
  .news-page { padding: 16px; }
}
</style>
