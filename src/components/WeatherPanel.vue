<template>
  <div class="weather-panel">
    <!-- 工具栏：城市搜索 + 刷新 -->
    <div class="wp-toolbar">
      <el-select
        v-model="city"
        filterable
        allow-create
        default-first-option
        placeholder="选择或输入城市"
        size="large"
        class="wp-city"
        @change="load"
      >
        <el-option v-for="c in CITY_PRESETS" :key="c" :label="c" :value="c" />
      </el-select>
      <el-button size="large" :loading="loading" @click="load">
        <el-icon><Refresh /></el-icon>
        <span class="btn-text">刷新</span>
      </el-button>
    </div>

    <el-alert v-if="errorMsg" :title="errorMsg" type="warning" :closable="false" show-icon class="wp-err" />

    <div v-if="loading && !weather" class="wp-skeleton"><el-skeleton :rows="5" animated /></div>

    <template v-else-if="weather">
      <!-- 当前天气 Hero -->
      <div class="wp-hero">
        <div class="wp-hero-main">
          <div class="wp-hero-emoji">{{ weatherEmoji(weather.current.weatherCode) }}</div>
          <div class="wp-hero-info">
            <div class="wp-hero-temp">{{ Math.round(weather.current.temperature) }}<span class="wp-deg">°C</span></div>
            <div class="wp-hero-cond">{{ weatherText(weather.current.weatherCode) }}</div>
            <div v-if="geoName" class="wp-hero-loc">
              <el-icon><Location /></el-icon> {{ geoName }}
            </div>
          </div>
        </div>
        <div class="wp-hero-meta">
          <div class="meta-item">
            <span class="meta-label">体感</span>
            <b>{{ Math.round(weather.current.apparentTemperature) }}°</b>
          </div>
          <div class="meta-item">
            <span class="meta-label">湿度</span>
            <b>{{ weather.current.humidity }}%</b>
          </div>
          <div class="meta-item">
            <span class="meta-label">风速</span>
            <b>{{ Math.round(weather.current.windSpeed) }} <i>km/h</i></b>
          </div>
        </div>
      </div>

      <!-- 24 小时逐时 -->
      <div class="wp-card">
        <div class="wp-card-title">未来 24 小时</div>
        <div class="wp-hourly">
          <div v-for="(h, i) in weather.hourly" :key="h.time" class="wp-hour">
            <div class="wp-hour-time">{{ hourLabel(h.time, i === 0) }}</div>
            <div class="wp-hour-emoji">{{ weatherEmoji(h.weatherCode) }}</div>
            <div class="wp-hour-temp">{{ Math.round(h.temperature) }}°</div>
          </div>
          <div v-if="weather.hourly.length === 0" class="wp-hour-empty">该数据源无逐时数据</div>
        </div>
      </div>

      <!-- 7 天预报 -->
      <div class="wp-card">
        <div class="wp-card-title">未来 7 天</div>
        <div class="wp-daily">
          <div v-for="(d, i) in weather.daily" :key="d.date" class="wp-day">
            <div class="wp-day-name">{{ dayLabel(d.date, i) }}</div>
            <div class="wp-day-emoji">{{ weatherEmoji(d.weatherCode) }}</div>
            <div class="wp-day-cond">{{ weatherText(d.weatherCode) }}</div>
            <div class="wp-day-temp">
              <span class="t-max">{{ Math.round(d.tempMax) }}°</span>
              <span class="t-min">{{ Math.round(d.tempMin) }}°</span>
            </div>
          </div>
        </div>
      </div>

      <div class="wp-source">
        数据来源：<b>{{ sourceLabel }}</b>
        <span v-if="source === 'open-meteo'" class="wp-source-tip">（默认保底 · 免费无 Key · 前端直连）</span>
        <span v-else class="wp-source-tip">（第三方 API · 已授权账号配置）</span>
      </div>
    </template>

    <el-empty v-else description="暂无天气数据" :image-size="60" />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { Refresh, Location } from '@element-plus/icons-vue'
import {
  getWeatherByCity,
  weatherText,
  weatherEmoji,
  type WeatherResult
} from '../services/weatherService'

const CITY_PRESETS = ['杭州', '北京', '上海', '广州', '深圳', '成都', '武汉', '西安', '南京', '重庆', 'Shanghai', 'Beijing', 'Tokyo', 'Singapore']

const city = ref('杭州')
const weather = ref<WeatherResult | null>(null)
const loading = ref(false)
const geoName = ref('')
const errorMsg = ref('')
const source = ref<'amap' | 'open-meteo'>('open-meteo')
const sourceLabel = ref('Open-Meteo')

function hourLabel(iso: string, isNow: boolean): string {
  if (isNow) return '现在'
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  return `${String(d.getHours()).padStart(2, '0')}:00`
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
    const { result, source: src } = await getWeatherByCity(q)
    weather.value = result
    source.value = src
    sourceLabel.value = src === 'amap' ? '高德天气' : 'Open-Meteo'
    // 地理名从当前实况定位（高德 live 含 city；Open-Meteo 用查询词）
    geoName.value = q
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
  border-radius: 16px;
  padding: 20px;
  box-shadow: var(--shadow-card);
  box-sizing: border-box;
}
.wp-toolbar {
  display: flex;
  gap: 10px;
  margin-bottom: 16px;
}
.wp-city { flex: 1; }
.wp-city :deep(.el-select__wrapper) { border-radius: 12px; }
.btn-text { margin-left: 4px; }
.wp-err { margin-bottom: 14px; }
.wp-skeleton { padding: 10px 0; }

/* Hero 当前天气 */
.wp-hero {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
  padding: 18px 20px;
  border-radius: 14px;
  background: linear-gradient(135deg, color-mix(in srgb, var(--primary) 12%, var(--surface)), color-mix(in srgb, var(--primary) 4%, var(--surface)));
  border: 1px solid var(--border);
  margin-bottom: 16px;
}
.wp-hero-main { display: flex; align-items: center; gap: 18px; min-width: 0; }
.wp-hero-emoji { font-size: 64px; line-height: 1; }
.wp-hero-info { min-width: 0; }
.wp-hero-temp { font-size: 44px; font-weight: 800; color: var(--text-strong); line-height: 1; font-variant-numeric: tabular-nums; }
.wp-deg { font-size: 22px; font-weight: 700; margin-left: 2px; color: var(--text-muted); }
.wp-hero-cond { font-size: 15px; color: var(--text); margin-top: 6px; font-weight: 600; }
.wp-hero-loc { display: flex; align-items: center; gap: 4px; font-size: 12px; color: var(--text-muted); margin-top: 6px; }
.wp-hero-loc :deep(svg) { font-size: 13px; }
.wp-hero-meta { display: flex; gap: 22px; }
.meta-item { display: flex; flex-direction: column; gap: 2px; }
.meta-label { font-size: 12px; color: var(--text-muted); }
.meta-item b { font-size: 16px; color: var(--text-strong); font-variant-numeric: tabular-nums; }
.meta-item b i { font-style: normal; font-size: 11px; color: var(--text-faint); }

/* 通用卡片 */
.wp-card {
  background: var(--surface-soft);
  border: 1px solid var(--border);
  border-radius: 14px;
  padding: 16px;
  margin-bottom: 16px;
}
.wp-card:last-of-type { margin-bottom: 0; }
.wp-card-title { font-size: 14px; font-weight: 700; color: var(--text-strong); margin-bottom: 12px; }

/* 24h */
.wp-hourly { display: flex; gap: 8px; overflow-x: auto; padding-bottom: 6px; }
.wp-hour {
  flex: 0 0 auto; width: 64px; text-align: center;
  background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 10px 4px;
}
.wp-hour-time { font-size: 11px; color: var(--text-muted); }
.wp-hour-emoji { font-size: 22px; margin: 6px 0; }
.wp-hour-temp { font-size: 14px; font-weight: 700; color: var(--text-strong); }
.wp-hour-empty { font-size: 12px; color: var(--text-faint); padding: 12px 0; }

/* 7 天 */
.wp-daily { display: grid; grid-template-columns: repeat(7, 1fr); gap: 8px; }
.wp-day {
  text-align: center;
  background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 12px 4px;
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}
.wp-day:hover { transform: translateY(-2px); box-shadow: var(--shadow-card); }
.wp-day-name { font-size: 12px; color: var(--text-muted); font-weight: 600; }
.wp-day-emoji { font-size: 26px; margin: 8px 0; }
.wp-day-cond { font-size: 11px; color: var(--text); line-height: 1.3; min-height: 28px; }
.wp-day-temp { font-size: 12px; font-variant-numeric: tabular-nums; margin-top: 4px; }
.t-max { color: var(--text-strong); font-weight: 700; margin-right: 4px; }
.t-min { color: var(--text-faint); }

.wp-source { margin-top: 14px; font-size: 12px; color: var(--text-muted); }
.wp-source b { color: var(--text-strong); }
.wp-source-tip { color: var(--text-faint); margin-left: 4px; }

@media (max-width: 768px) {
  .weather-panel { padding: 14px; }
  .wp-hero { padding: 14px; }
  .wp-hero-temp { font-size: 38px; }
  .wp-hero-emoji { font-size: 52px; }
  .wp-hero-meta { gap: 16px; width: 100%; justify-content: space-around; }
  .wp-daily { grid-template-columns: repeat(7, minmax(40px, 1fr)); gap: 5px; }
  .wp-day-cond { font-size: 9px; min-height: 24px; }
  .btn-text { display: none; }
}
</style>
