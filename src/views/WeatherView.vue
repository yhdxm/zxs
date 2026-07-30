<template>
  <div class="weather-page">
    <header class="wp-page-head">
      <div>
        <h2>实时天气</h2>
        <p>数据来自 Open-Meteo 免费开放接口，前端直连，无需 Key、不消耗任何积分。选择或输入城市即可查询实时天气、24 小时逐时与未来 7 天预报。</p>
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
  padding: 24px;
  max-width: 980px;
  margin: 0 auto;
  color: var(--text);
}
.wp-page-head { margin-bottom: 18px; }
.wp-page-head h2 { margin: 0 0 6px; font-size: 22px; color: var(--text-strong); }
.wp-page-head p { margin: 0; font-size: 13px; color: var(--text-muted); line-height: 1.6; max-width: 760px; }
.wp-page-body { min-width: 0; }

@media (max-width: 768px) {
  .weather-page { padding: 16px; }
}
</style>
