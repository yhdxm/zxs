<template>
  <div class="weather-panel">
    <!-- 工具栏：城市搜索 + 刷新 -->
    <div class="wp-toolbar">
      <el-select
        v-model="city"
        filterable
        allow-create
        default-first-option
        placeholder="搜索或选择城市（全国）"
        size="large"
        class="wp-city"
        @change="load"
      >
        <el-option-group v-for="g in CHINA_CITY_GROUPS" :key="g.province" :label="g.province">
          <el-option v-for="c in g.cities" :key="c" :label="c" :value="c" />
        </el-option-group>
      </el-select>
      <el-button size="large" :loading="loading" @click="load">
        <el-icon><Refresh /></el-icon>
        <span class="btn-text">刷新</span>
      </el-button>
      <el-tag
        v-if="weather"
        :type="source === 'amap' ? 'success' : 'info'"
        effect="light"
        size="large"
        class="wp-source-tag"
      >{{ source === 'amap' ? '高德' : 'Open-Meteo' }}</el-tag>
    </div>

    <el-alert v-if="errorMsg" :title="errorMsg" type="warning" :closable="false" show-icon class="wp-err" />
    <el-alert
      v-if="fallbackReason && source !== 'amap'"
      :title="fallbackReason"
      type="info"
      :closable="false"
      show-icon
      class="wp-fallback-reason"
    />

    <div v-if="loading && !weather" class="wp-skeleton"><el-skeleton :rows="5" animated /></div>

    <template v-else-if="weather">
      <!-- 当前天气 Hero（扁平卡片） -->
      <div class="wp-hero">
        <div class="wp-hero-main">
          <div class="wp-hero-icon"><WeatherIcon :code="weather.current.weatherCode" /></div>
          <div class="wp-hero-text">
            <div class="wp-hero-temp">{{ Math.round(weather.current.temperature) }}<span class="wp-deg">°C</span></div>
            <div class="wp-hero-cond">{{ weatherText(weather.current.weatherCode) }}</div>
            <div v-if="geoName" class="wp-hero-loc">
              <el-icon><Location /></el-icon> {{ geoName }}
            </div>
            <div v-if="source === 'amap' && weather.current.reportTime" class="wp-hero-update">
              数据更新于 {{ weather.current.reportTime }}
            </div>
          </div>
        </div>

        <!-- 指标小卡 -->
        <div class="wp-hero-stats">
          <div class="stat">
            <span class="stat-label">湿度</span>
            <b class="stat-value">{{ weather.current.humidity }}%</b>
          </div>
          <div class="stat" v-if="source === 'amap'">
            <span class="stat-label">风向风力</span>
            <b class="stat-value">{{ windInfo }}</b>
          </div>
          <div class="stat" v-else>
            <span class="stat-label">风速</span>
            <b class="stat-value">{{ Math.round(weather.current.windSpeed) }} <i>km/h</i></b>
          </div>
          <div class="stat" v-if="source === 'amap'">
            <span class="stat-label">更新时间</span>
            <b class="stat-value">{{ reportShort }}</b>
          </div>
          <div class="stat" v-else>
            <span class="stat-label">体感</span>
            <b class="stat-value">{{ Math.round(weather.current.apparentTemperature) }}°</b>
          </div>
        </div>
      </div>

      <!-- 24 小时逐时 -->
      <div class="wp-card">
        <div class="wp-card-title">
          未来 24 小时
          <span v-if="source === 'amap'" class="wp-card-note">（高德免费接口无逐时数据，以下为昼夜温差估算趋势）</span>
        </div>
        <div class="wp-hourly">
          <div v-for="(h, i) in weather.hourly" :key="h.time" class="wp-hour" :class="{ 'is-now': i === 0 }">
            <div class="wp-hour-time">{{ hourLabel(h.time, i === 0) }}</div>
            <div class="wp-hour-icon"><WeatherIcon :code="h.weatherCode" /></div>
            <div class="wp-hour-temp">{{ Math.round(h.temperature) }}°</div>
          </div>
          <div v-if="weather.hourly.length === 0" class="wp-hour-empty">该数据源无逐时数据</div>
        </div>
      </div>

      <!-- 预报 -->
      <div class="wp-card">
        <div class="wp-card-title">
          {{ source === 'amap' ? `未来 ${weather.daily.length} 天预报` : '未来 7 天预报' }}
          <span v-if="source === 'amap'" class="wp-card-note">（高德提供「白天 / 夜间」分时段天气）</span>
        </div>
        <div class="wp-daily">
          <div v-for="(d, i) in weather.daily" :key="d.date" class="wp-day">
            <div class="wp-day-name">{{ dayLabel(d.date, i) }}</div>

            <!-- 高德：昼 / 夜 分时段 -->
            <div v-if="source === 'amap' && d.dayWeather" class="wp-day-split">
              <div class="wp-day-half">
                <span class="half-tag">昼</span>
                <span class="half-icon"><WeatherIcon :code="gaodeTextToWmo(d.dayWeather)" /></span>
                <span class="half-text">{{ d.dayWeather }}</span>
              </div>
              <div class="wp-day-half">
                <span class="half-tag">夜</span>
                <span class="half-icon"><WeatherIcon :code="gaodeTextToWmo(d.nightWeather || d.dayWeather)" /></span>
                <span class="half-text">{{ d.nightWeather || d.dayWeather }}</span>
              </div>
            </div>

            <!-- Open-Meteo：单一天气 -->
            <template v-else>
              <div class="wp-day-icon"><WeatherIcon :code="d.weatherCode" /></div>
              <div class="wp-day-cond">{{ weatherText(d.weatherCode) }}</div>
            </template>

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
        <span v-else class="wp-source-tip">（高德开放平台 · Web 服务 Key · 含风向风力与昼夜分时段）</span>
      </div>
    </template>

    <el-empty v-else description="暂无天气数据" :image-size="60" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { Refresh, Location } from '@element-plus/icons-vue'
import {
  getWeatherByCity,
  weatherText,
  gaodeTextToWmo,
  type WeatherResult
} from '../services/weatherService'
import { CHINA_CITY_GROUPS } from '../data/chinaCities'
import WeatherIcon from './WeatherIcon.vue'

const emit = defineEmits<{ weatherChange: [code: number] }>()

const city = ref('杭州')
const weather = ref<WeatherResult | null>(null)
const loading = ref(false)
const geoName = ref('')
const errorMsg = ref('')
const fallbackReason = ref('')
const source = ref<'amap' | 'open-meteo'>('open-meteo')
const sourceLabel = ref('Open-Meteo')

/** 高德：风向风力，如「西风 ≤3级」 */
const windInfo = computed(() => {
  if (source.value !== 'amap' || !weather.value) return ''
  const d = weather.value.current.windDirection || ''
  const p = weather.value.current.windPower || ''
  return `${d}风 ${p}级`.replace(/\s+/g, ' ').trim()
})

/** 高德：发布时间缩写，如「08-01 10:00」 */
const reportShort = computed(() => {
  const rt = weather.value?.current.reportTime
  if (!rt) return ''
  const m = /(\d{4})-(\d{2})-(\d{2}) (\d{2}:\d{2})/.exec(rt)
  return m ? `${m[2]}-${m[3]} ${m[4]}` : rt
})

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
    const { result, source: src, fallbackReason: reason } = await getWeatherByCity(q)
    weather.value = result
    source.value = src
    sourceLabel.value = src === 'amap' ? '高德天气' : 'Open-Meteo'
    fallbackReason.value = reason || ''
    if (src === 'amap') {
      ElMessage.success('数据来源：高德天气')
    } else {
      const tip = reason ? ` · ${reason}` : ''
      ElMessage.info(`数据来源：Open-Meteo（默认保底源${tip}）`)
    }
    if (src === 'amap' && result.current.province) {
      geoName.value = [result.current.province, result.current.cityName].filter(Boolean).join('·')
    } else {
      geoName.value = q
    }
    emit('weatherChange', result.current.weatherCode)
  } catch (e) {
    errorMsg.value = e instanceof Error ? e.message : '天气加载失败'
    if (!weather.value) weather.value = null
  } finally {
    loading.value = false
  }
}

watch(() => weather.value?.current.weatherCode, (code) => {
  if (code !== undefined) emit('weatherChange', code)
}, { immediate: true })

</script>

<style scoped>
.weather-panel {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 16px;
  padding: 14px;
  box-shadow: var(--shadow-card);
  box-sizing: border-box;
}
.wp-toolbar {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 12px;
  flex-wrap: wrap;
}
.wp-city { flex: 1; min-width: 220px; }
.wp-city :deep(.el-select__wrapper) { border-radius: 12px; }
.btn-text { margin-left: 4px; }
.wp-source-tag { flex-shrink: 0; font-weight: 600; }
.wp-err { margin-bottom: 14px; }
.wp-fallback-reason { margin-bottom: 14px; }
.wp-skeleton { padding: 10px 0; }

/* Hero 当前天气 —— 扁平卡片（去渐变） */
.wp-hero {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  flex-wrap: wrap;
  padding: 22px 24px;
  border-radius: 16px;
  background: color-mix(in srgb, var(--primary) 6%, var(--surface));
  border: 1px solid var(--border);
  margin-bottom: 16px;
}
.wp-hero-main { display: flex; align-items: center; gap: 20px; min-width: 0; }
.wp-hero-icon { font-size: 80px; line-height: 1; filter: drop-shadow(0 4px 8px rgba(15, 23, 42, 0.12)); }
.wp-hero-icon svg { display: block; }
.wp-hero-text { min-width: 0; }
.wp-hero-temp { font-size: 52px; font-weight: 800; color: var(--text-strong); line-height: 1; font-variant-numeric: tabular-nums; }
.wp-deg { font-size: 24px; font-weight: 700; margin-left: 2px; color: var(--text-muted); }
.wp-hero-cond { font-size: 16px; color: var(--text); margin-top: 6px; font-weight: 600; }
.wp-hero-loc { display: inline-flex; align-items: center; gap: 4px; font-size: 13px; color: var(--text-muted); margin-top: 8px; padding: 3px 10px; background: var(--surface); border: 1px solid var(--border); border-radius: 999px; }
.wp-hero-loc :deep(svg) { font-size: 14px; }
.wp-hero-update { font-size: 11px; color: var(--text-faint); margin-top: 8px; }

/* 指标小卡（2x2） */
.wp-hero-stats { display: grid; grid-template-columns: repeat(2, minmax(96px, 1fr)); gap: 10px; }
.stat {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 10px 14px;
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
}
.stat-label { font-size: 12px; color: var(--text-muted); }
.stat-value { font-size: 16px; font-weight: 700; color: var(--text-strong); font-variant-numeric: tabular-nums; text-align: left; line-height: 1.2; }
.stat-value i { font-style: normal; font-size: 11px; color: var(--text-faint); font-weight: 500; }

/* 通用卡片 */
.wp-card {
  background: var(--surface-soft);
  border: 1px solid var(--border);
  border-radius: 16px;
  padding: 16px;
  margin-bottom: 16px;
}
.wp-card:last-of-type { margin-bottom: 0; }
.wp-card-title {
  font-size: 14px; font-weight: 700; color: var(--text-strong);
  margin-bottom: 12px; padding-left: 10px; position: relative;
}
.wp-card-title::before {
  content: ''; position: absolute; left: 0; top: 2px; bottom: 2px; width: 3px;
  border-radius: 3px; background: var(--primary);
}
.wp-card-note { font-size: 11px; font-weight: 400; color: var(--text-faint); margin-left: 6px; }

/* 24h */
.wp-hourly { display: flex; gap: 8px; overflow-x: auto; padding-bottom: 6px; }
.wp-hour {
  flex: 0 0 auto; width: 66px; text-align: center;
  background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 12px 4px;
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}
.wp-hour:hover { transform: translateY(-2px); box-shadow: var(--shadow-card); }
.wp-hour.is-now { border-color: var(--border-strong); background: color-mix(in srgb, var(--primary) 8%, var(--surface)); }
.wp-hour-time { font-size: 11px; color: var(--text-muted); }
.wp-hour-icon { font-size: 24px; margin: 6px 0; }
.wp-hour-temp { font-size: 14px; font-weight: 700; color: var(--text-strong); }
.wp-hour-empty { font-size: 12px; color: var(--text-faint); padding: 12px 0; }

/* 预报 */
.wp-daily { display: grid; grid-template-columns: repeat(7, 1fr); gap: 8px; }
.wp-day {
  text-align: center;
  background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 14px 4px;
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}
.wp-day:hover { transform: translateY(-2px); box-shadow: var(--shadow-card); }
.wp-day-name { font-size: 12px; color: var(--text-muted); font-weight: 600; }
.wp-day-icon { font-size: 32px; margin: 8px 0; }
.wp-day-cond { font-size: 11px; color: var(--text); line-height: 1.3; min-height: 28px; }

/* 高德：昼 / 夜 分时段 */
.wp-day-split { display: flex; flex-direction: column; gap: 4px; margin: 8px 0; }
.wp-day-half { display: flex; align-items: center; gap: 4px; justify-content: center; font-size: 11px; color: var(--text); }
.half-tag {
  font-size: 10px; color: var(--text-faint);
  background: var(--surface-soft); border: 1px solid var(--border);
  border-radius: 6px; padding: 0 4px; line-height: 16px;
}
.half-icon { font-size: 16px; }
.half-text { font-size: 11px; }

.wp-day-temp { font-size: 12px; font-variant-numeric: tabular-nums; margin-top: 4px; }
.t-max { color: var(--text-strong); font-weight: 700; margin-right: 4px; }
.t-min { color: var(--text-faint); }

.wp-source {
  margin-top: 14px; font-size: 12px; color: var(--text-muted);
  display: inline-flex; align-items: center; gap: 4px;
  padding: 6px 12px; background: var(--surface-soft); border: 1px solid var(--border); border-radius: 999px;
}
.wp-source b { color: var(--text-strong); }
.wp-source-tip { color: var(--text-faint); }

@media (max-width: 768px) {
  .weather-panel { padding: 14px; }
  .wp-hero { padding: 16px; gap: 14px; }
  .wp-hero-main { gap: 14px; }
  .wp-hero-icon { font-size: 64px; }
  .wp-hero-temp { font-size: 42px; }
  .wp-hero-stats { width: 100%; grid-template-columns: repeat(2, 1fr); }
  .wp-daily { grid-template-columns: repeat(7, minmax(40px, 1fr)); gap: 5px; }
  .wp-day { padding: 10px 2px; }
  .wp-day-cond { font-size: 9px; min-height: 24px; }
  .wp-day-icon { font-size: 26px; }
  .half-icon { font-size: 13px; }
  .half-text { font-size: 9px; }
  .btn-text { display: none; }
}
</style>
