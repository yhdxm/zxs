<template>
  <div class="weather-panel">
    <div class="wp-head">
      <div>
        <h3>实时天气</h3>
        <p v-if="geoName" class="wp-geo">{{ geoName }}</p>
      </div>
      <el-button size="small" :loading="loading" @click="load">
        <el-icon><Refresh /></el-icon> 刷新
      </el-button>
    </div>

    <div class="wp-controls">
      <el-select
        v-model="city"
        filterable
        allow-create
        default-first-option
        placeholder="选择或输入城市"
        size="default"
        class="wp-city"
        @change="load"
      >
        <el-option v-for="c in CITY_PRESETS" :key="c" :label="c" :value="c" />
      </el-select>
    </div>

    <el-alert v-if="errorMsg" :title="errorMsg" type="warning" :closable="false" show-icon class="wp-err" />

    <div v-if="loading && !weather" class="wp-skeleton"><el-skeleton :rows="4" animated /></div>

    <template v-else-if="weather">
      <!-- 当前实况 -->
      <div class="wp-now">
        <div class="wp-now-icon">{{ weatherEmoji(weather.current.weatherCode) }}</div>
        <div class="wp-now-main">
          <div class="wp-temp">{{ Math.round(weather.current.temperature) }}°C</div>
          <div class="wp-cond">{{ weatherText(weather.current.weatherCode) }}</div>
        </div>
        <div class="wp-now-sub">
          <div>体感 {{ Math.round(weather.current.apparentTemperature) }}°</div>
          <div>湿度 {{ weather.current.humidity }}%</div>
          <div>风速 {{ Math.round(weather.current.windSpeed) }} km/h</div>
        </div>
      </div>

      <!-- 24h 逐时 -->
      <div class="wp-block">
        <div class="wp-block-title">未来 24 小时</div>
        <div class="wp-hourly">
          <div v-for="(h, i) in weather.hourly" :key="h.time" class="wp-hour">
            <div class="wp-hour-time">{{ hourLabel(h.time, i === 0) }}</div>
            <div class="wp-hour-emoji">{{ weatherEmoji(h.weatherCode) }}</div>
            <div class="wp-hour-temp">{{ Math.round(h.temperature) }}°</div>
          </div>
        </div>
      </div>

      <!-- 7 天 -->
      <div class="wp-block">
        <div class="wp-block-title">未来 7 天</div>
        <div class="wp-daily">
          <div v-for="(d, i) in weather.daily" :key="d.date" class="wp-day">
            <div class="wp-day-name">{{ dayLabel(d.date, i) }}</div>
            <div class="wp-day-emoji">{{ weatherEmoji(d.weatherCode) }}</div>
            <div class="wp-day-cond">{{ weatherText(d.weatherCode) }}</div>
            <div class="wp-day-temp">{{ Math.round(d.tempMin) }}° / {{ Math.round(d.tempMax) }}°</div>
            <div class="wp-day-precip">降水 {{ d.precipProb }}%</div>
          </div>
        </div>
      </div>
    </template>

    <el-empty v-else description="暂无天气数据" :image-size="50" />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { Refresh } from '@element-plus/icons-vue'
import {
  geocode,
  getWeather,
  weatherText,
  weatherEmoji,
  type WeatherResult
} from '../services/weatherService'

const CITY_PRESETS = ['杭州', '北京', '上海', '广州', '深圳', '成都', '武汉', '西安', 'Shanghai', 'Beijing', 'Tokyo', 'Singapore']

const city = ref('杭州')
const weather = ref<WeatherResult | null>(null)
const loading = ref(false)
const geoName = ref('')
const errorMsg = ref('')

function hourLabel(iso: string, isNow: boolean): string {
  if (isNow) return '现在'
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  return `${d.getHours()}:00`
}

function dayLabel(iso: string, idx: number): string {
  if (idx === 0) return '今天'
  if (idx === 1) return '明天'
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  const w = ['日', '一', '二', '三', '四', '五', '六'][d.getDay()]
  return `周${w}`
}

async function load() {
  const q = city.value.trim()
  if (!q) return
  loading.value = true
  errorMsg.value = ''
  try {
    const geo = await geocode(q)
    geoName.value = geo.name
    weather.value = await getWeather(geo.lat, geo.lon)
  } catch (e) {
    errorMsg.value = e instanceof Error ? e.message : '天气加载失败'
    if (!weather.value) weather.value = null
  } finally {
    loading.value = false
  }
}

onMounted(load)
</script>

<style scoped>
.weather-panel {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 14px;
  padding: 18px;
  box-shadow: var(--shadow-card);
  height: 100%;
  box-sizing: border-box;
}
.wp-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; margin-bottom: 12px; }
.wp-head h3 { margin: 0; font-size: 15px; color: var(--text-strong); }
.wp-geo { margin: 2px 0 0; font-size: 12px; color: var(--text-faint); }

.wp-controls { margin-bottom: 12px; }
.wp-city { width: 100%; }
.wp-err { margin-bottom: 12px; }

.wp-now {
  display: flex; align-items: center; gap: 16px;
  padding: 14px 0; border-bottom: 1px dashed var(--border); margin-bottom: 14px;
}
.wp-now-icon { font-size: 46px; line-height: 1; }
.wp-now-main { flex: 1; }
.wp-temp { font-size: 34px; font-weight: 800; color: var(--primary); line-height: 1; }
.wp-cond { font-size: 14px; color: var(--text-strong); margin-top: 4px; }
.wp-now-sub { display: flex; flex-direction: column; gap: 4px; font-size: 12px; color: var(--text-muted); text-align: right; }

.wp-block { margin-bottom: 16px; }
.wp-block:last-child { margin-bottom: 0; }
.wp-block-title { font-size: 13px; color: var(--text-strong); margin-bottom: 10px; font-weight: 600; }

.wp-hourly { display: flex; gap: 8px; overflow-x: auto; padding-bottom: 6px; }
.wp-hour {
  flex: 0 0 auto; width: 64px; text-align: center;
  background: var(--surface-soft); border-radius: 10px; padding: 8px 4px;
}
.wp-hour-time { font-size: 11px; color: var(--text-muted); }
.wp-hour-emoji { font-size: 20px; margin: 4px 0; }
.wp-hour-temp { font-size: 13px; font-weight: 600; color: var(--text-strong); }

.wp-daily { display: grid; grid-template-columns: repeat(7, 1fr); gap: 6px; }
.wp-day { text-align: center; background: var(--surface-soft); border-radius: 10px; padding: 10px 2px; }
.wp-day-name { font-size: 11px; color: var(--text-muted); }
.wp-day-emoji { font-size: 22px; margin: 5px 0; }
.wp-day-cond { font-size: 10px; color: var(--text); line-height: 1.3; min-height: 26px; }
.wp-day-temp { font-size: 11px; font-weight: 600; color: var(--text-strong); font-variant-numeric: tabular-nums; }
.wp-day-precip { font-size: 10px; color: var(--text-faint); margin-top: 2px; }

@media (max-width: 768px) {
  .weather-panel { padding: 14px; }
  .wp-daily { grid-template-columns: repeat(7, minmax(40px, 1fr)); }
  .wp-day-cond { font-size: 9px; }
}
</style>
