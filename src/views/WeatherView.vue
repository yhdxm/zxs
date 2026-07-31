<template>
  <div class="weather-page">
    <header class="wp-page-head">
      <div>
        <h2>实时天气</h2>
        <p>选择或输入城市即可查询实时天气、未来 24 小时逐时与 7 天预报。已授权并配置高德 Key 时自动切换高德天气，否则使用 Open-Meteo 免费默认源（无需 Key）。</p>
      </div>
    </header>
    <div class="wp-page-body">
      <WeatherPanel />
    </div>
  </div>
</template>

<script setup lang="ts">
import WeatherPanel from '../components/WeatherPanel.vue'
</script>

<style scoped>
.weather-page {
  padding: 18px 24px;
  max-width: 1000px;
  margin: 0 auto;
  color: var(--text);
}
.wp-page-head { margin-bottom: 16px; }
.wp-page-head h2 { margin: 0 0 6px; font-size: 22px; color: var(--text-strong); }
.wp-page-head p { margin: 0; font-size: 13px; color: var(--text-muted); line-height: 1.6; max-width: 780px; }
.wp-page-body { min-width: 0; }

@media (max-width: 768px) {
  .weather-page { padding: 14px 14px; }
}
</style>
