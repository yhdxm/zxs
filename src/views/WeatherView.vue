<template>
  <div class="weather-page">
    <PageHeader title="实时天气" subtitle="选择或输入城市即可查询实时天气、未来 24 小时逐时与多天预报。已授权并配置高德 Key 时自动切换高德天气（含风向风力、数据更新时间与白天/夜间分时段预报），否则使用 Open-Meteo 免费默认源（无需 Key）。" :icon="Sunny" />
    <WeatherEffects :code="mainWeatherCode" />
    <div class="wp-page-body">
      <WeatherPanel @weather-change="onWeatherChange" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { Sunny } from '@element-plus/icons-vue'
import WeatherPanel from '../components/WeatherPanel.vue'
import PageHeader from '../components/PageHeader.vue'
import WeatherEffects from '../components/WeatherEffects.vue'

const mainWeatherCode = ref(0)

function onWeatherChange(code: number) {
  mainWeatherCode.value = Number(code) || 0
}
</script>

<style scoped>
.weather-page {
  position: relative;
  z-index: 1;
  padding: 0 18px 18px;
  max-width: 1400px;
  margin: 0 auto;
  color: var(--text);
}
.wp-page-body { position: relative; z-index: 1; min-width: 0; }

@media (max-width: 768px) {
  .weather-page { padding: 0 14px 14px; }
}
</style>
