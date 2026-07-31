<template>
  <div class="map-page">
    <PageHeader title="地图定位" subtitle="底图优先使用已配置的天地图 Key；未配置时自动降级为 OpenStreetMap 公开底图。支持行政区下钻、标注测距，全部前端直连，不消耗任何积分。" />
    <div class="mp-page-body">
      <MapPanel />
    </div>
  </div>
</template>

<script setup lang="ts">
import MapPanel from '../components/MapPanel.vue'
import PageHeader from '../components/PageHeader.vue'
</script>

<style scoped>
.map-page {
  padding: 0 24px 24px;
  max-width: 1280px;
  margin: 0 auto;
  color: var(--text);
}
.mp-page-body {
  min-width: 0;
}
/* 让内部地图组件占满整页高度，交互更舒展 */
.mp-page-body :deep(.map-panel) {
  height: calc(100vh - 220px);
  min-height: 480px;
}

@media (max-width: 768px) {
  .map-page { padding: 0 16px 16px; }
  .mp-page-body :deep(.map-panel) { height: calc(100vh - 200px); min-height: 420px; }
}
</style>
