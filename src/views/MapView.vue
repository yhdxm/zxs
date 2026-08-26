<template>
  <div class="map-page">
    <PageHeader
      title="地图定位"
      subtitle="底图多源自动兜底：天地图（需免费 Key）→ 高德矢量 / 卫星 → GeoQ 智图 → OpenStreetMap；行政区边界来自阿里云 DataV；地名搜索与逆地址主用 Photon（国内可直连），驾车路线用 OSRM（直连不通时自动切免费代理）。全部免费接口，不消耗任何积分。可稳定下钻到省/市/区（县），乡镇/村级依赖开放数据覆盖，不保证完整。"
      :icon="Location"
    />
    <div class="mp-page-body">
      <MapPanel />
    </div>
  </div>
</template>

<script setup lang="ts">
import { Location } from '@element-plus/icons-vue'
import MapPanel from '../components/MapPanel.vue'
import PageHeader from '../components/PageHeader.vue'
</script>

<style scoped>
.map-page {
  padding: 0 18px 18px;
  max-width: 1400px;
  margin: 0 auto;
  color: var(--text);
}
.mp-page-body {
  min-width: 0;
}
/* 让内部地图组件占满整页高度，交互更舒展 */
.mp-page-body :deep(.map-panel) {
  height: calc(100vh - 210px);
  height: calc(100dvh - 210px);
  min-height: 620px;
}

@media (max-width: 1024px) {
  .mp-page-body :deep(.map-panel) { height: auto; min-height: 0; }
}
@media (max-width: 768px) {
  .map-page { padding: 0 16px 16px; }
}
</style>
