<template>
  <div class="free-content">
    <div class="fc-header">
      <div>
        <h2>免费内容中心</h2>
        <p>天气 / 地图 / 新闻 —— 全部使用免费公开 API 前端直连，不经过云端、不消耗任何积分（天气 Open-Meteo；地图天地图+OSM 降级；新闻天行数据+RSS 降级）</p>
      </div>
    </div>

    <div class="fc-grid">
      <div class="fc-col">
        <WeatherPanel />
      </div>
      <div class="fc-col">
        <MapPanel />
      </div>
    </div>

    <div class="fc-news">
      <NewsPanel />
    </div>
  </div>
</template>

<script setup lang="ts">
import WeatherPanel from '../components/WeatherPanel.vue'
import MapPanel from '../components/MapPanel.vue'
import NewsPanel from '../components/NewsPanel.vue'
</script>

<style scoped>
.free-content {
  padding: 24px;
  max-width: 1200px;
  margin: 0 auto;
  color: var(--text);
}
.fc-header { margin-bottom: 18px; }
.fc-header h2 { margin: 0 0 6px; font-size: 22px; color: var(--text-strong); }
.fc-header p { margin: 0; font-size: 13px; color: var(--text-muted); line-height: 1.6; }

.fc-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 18px;
  margin-bottom: 18px;
}
.fc-col { min-width: 0; }
.fc-news { min-width: 0; }

@media (max-width: 900px) {
  .fc-grid { grid-template-columns: 1fr; }
}
@media (max-width: 768px) {
  .free-content { padding: 16px; }
}
</style>
