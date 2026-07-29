<template>
  <div class="free-content">
    <div class="fc-header">
      <div>
        <h2>免费内容中心</h2>
        <p>天气 / 地图 / 新闻 —— 全部使用免费公开 API 前端直连，不经过云端、不消耗任何积分</p>
      </div>
    </div>

    <!-- 城市选择 -->
    <div class="fc-city">
      <el-input v-model="city" placeholder="输入城市，如 杭州 / 北京 / Shanghai" class="fc-city-input" @keyup.enter="loadAll">
        <template #prepend>城市</template>
      </el-input>
      <el-button type="primary" :loading="loading" @click="loadAll">
        <el-icon><Search /></el-icon> 查询
      </el-button>
    </div>

    <div v-if="errorMsg" class="fc-error">{{ errorMsg }}</div>

    <div class="fc-grid">
      <!-- 天气 -->
      <div class="fc-card">
        <h3>实时天气</h3>
        <div v-if="weather" class="fc-weather">
          <div class="fc-now">
            <div class="fc-temp">{{ Math.round(weather.current.temperature_2m) }}°C</div>
            <div class="fc-cond">{{ weatherText(weather.current.weather_code) }}</div>
            <div class="fc-sub">湿度 {{ weather.current.relative_humidity_2m }}% · 风速 {{ Math.round(weather.current.wind_speed_10m) }} km/h</div>
          </div>
          <div class="fc-forecast">
            <div v-for="(d, i) in weather.daily.time.slice(0, 3)" :key="d" class="fc-fc-item">
              <div class="fc-fc-day">{{ i === 0 ? '今天' : i === 1 ? '明天' : formatDay(d) }}</div>
              <div class="fc-fc-cond">{{ weatherText(weather.daily.weather_code[i] ?? 0) }}</div>
              <div class="fc-fc-temp">{{ Math.round(weather.daily.temperature_2m_min[i] ?? 0) }}° / {{ Math.round(weather.daily.temperature_2m_max[i] ?? 0) }}°</div>
            </div>
          </div>
        </div>
        <el-skeleton v-else-if="loading" :rows="4" animated />
        <el-empty v-else description="暂无天气数据" :image-size="50" />
      </div>

      <!-- 地图 -->
      <div class="fc-card">
        <h3>地图定位</h3>
        <div v-if="coords" class="fc-map-wrap">
          <iframe
            class="fc-map"
            :src="mapSrc"
            title="OpenStreetMap"
            loading="lazy"
            referrerpolicy="no-referrer-when-downgrade"
          ></iframe>
          <div class="fc-map-coord">{{ coords.lat.toFixed(4) }}, {{ coords.lon.toFixed(4) }} · {{ geoName }}</div>
        </div>
        <el-empty v-else description="暂无地图数据" :image-size="50" />
      </div>
    </div>

    <!-- 新闻 -->
    <div class="fc-card fc-news">
      <div class="fc-news-head">
        <h3>免费新闻聚合</h3>
        <el-button size="small" :loading="newsLoading" @click="loadNews">
          <el-icon><Refresh /></el-icon> 刷新
        </el-button>
      </div>
      <div v-if="news.length" class="fc-news-list">
        <a
          v-for="n in news"
          :key="n.link + n.title"
          :href="n.link"
          target="_blank"
          rel="noopener"
          class="fc-news-item"
        >
          <span class="fc-news-title">{{ n.title }}</span>
          <span class="fc-news-src">{{ n.source }}</span>
        </a>
      </div>
      <el-skeleton v-else-if="newsLoading" :rows="6" animated />
      <el-empty v-else description="暂无可获取的新闻（代理可能限流，请稍后刷新）" :image-size="50" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { Search, Refresh } from '@element-plus/icons-vue'

const city = ref('杭州')
const loading = ref(false)
const newsLoading = ref(false)
const errorMsg = ref('')

interface WeatherNow { temperature_2m: number; relative_humidity_2m: number; weather_code: number; wind_speed_10m: number }
interface WeatherData {
  current: WeatherNow
  daily: { time: string[]; weather_code: number[]; temperature_2m_min: number[]; temperature_2m_max: number[] }
}
const weather = ref<WeatherData | null>(null)
const coords = ref<{ lat: number; lon: number } | null>(null)
const geoName = ref('')

interface NewsItem { title: string; link: string; source: string }
const news = ref<NewsItem[]>([])

const NEWS_SOURCES: { url: string; name: string }[] = [
  { url: 'https://sspai.com/feed', name: '少数派' },
  { url: 'https://www.ithome.com/rss/', name: 'IT之家' },
  { url: 'https://rsshub.app/zhihu/daily', name: '知乎日报' },
  { url: 'https://www.36kr.com/feed', name: '36氪' }
]

const mapSrc = computed(() => {
  if (!coords.value) return ''
  const { lat, lon } = coords.value
  const d = 0.06
  const bbox = [lon - d, lat - d, lon + d, lat + d].join(',')
  return `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat},${lon}`
})

function weatherText(code: number): string {
  const m: Record<number, string> = {
    0: '晴', 1: '大致晴朗', 2: '局部多云', 3: '阴',
    45: '雾', 48: '雾凇', 51: '小毛毛雨', 53: '毛毛雨', 55: '大毛毛雨',
    61: '小雨', 63: '中雨', 65: '大雨', 71: '小雪', 73: '中雪', 75: '大雪',
    80: '阵雨', 81: '强阵雨', 82: '暴雨', 95: '雷阵雨', 96: '雷阵雨伴冰雹', 99: '强雷暴'
  }
  return m[code] || '未知'
}

function formatDay(iso: string): string {
  const d = new Date(iso)
  return `${d.getMonth() + 1}/${d.getDate()}`
}

async function loadWeatherAndMap() {
  errorMsg.value = ''
  const q = encodeURIComponent(city.value.trim())
  if (!q) return
  // 1) 地理编码（Open-Meteo，免费无 Key）
  const geoRes = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${q}&count=1&language=zh&format=json`)
  if (!geoRes.ok) throw new Error('地理编码请求失败')
  const geo = await geoRes.json()
  const hit = geo?.results?.[0]
  if (!hit) throw new Error(`未找到城市「${city.value}」`)
  const lat = Number(hit.latitude)
  const lon = Number(hit.longitude)
  coords.value = { lat, lon }
  geoName.value = `${hit.name}${hit.country ? '·' + hit.country : ''}`

  // 2) 天气预报（Open-Meteo，免费无 Key）
  const wRes = await fetch(
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
    `&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m` +
    `&daily=weather_code,temperature_2m_min,temperature_2m_max&timezone=auto&forecast_days=3`
  )
  if (!wRes.ok) throw new Error('天气请求失败')
  weather.value = await wRes.json()
}

async function loadNews() {
  newsLoading.value = true
  const items: NewsItem[] = []
  await Promise.all(
    NEWS_SOURCES.map(async (src) => {
      try {
        const proxy = `https://api.allorigins.win/raw?url=${encodeURIComponent(src.url)}`
        const res = await fetch(proxy)
        if (!res.ok) return
        const xml = await res.text()
        const doc = new DOMParser().parseFromString(xml, 'text/xml')
        const nodes = Array.from(doc.querySelectorAll('item, entry')).slice(0, 5)
        for (const n of nodes) {
          const title = n.querySelector('title')?.textContent?.trim()
          const link = n.querySelector('link')?.textContent?.trim() ||
            n.querySelector('link')?.getAttribute('href') || ''
          if (title && link) items.push({ title, link, source: src.name })
        }
      } catch { /* 单个源失败不影响其他 */ }
    })
  )
  news.value = items.slice(0, 20)
  newsLoading.value = false
}

async function loadAll() {
  loading.value = true
  try {
    await loadWeatherAndMap()
  } catch (e) {
    errorMsg.value = e instanceof Error ? e.message : '加载失败'
  } finally {
    loading.value = false
  }
  await loadNews()
}

onMounted(loadAll)
</script>

<style scoped>
.free-content {
  padding: 24px;
  max-width: 1080px;
  margin: 0 auto;
  color: var(--text);
}
.fc-header { margin-bottom: 18px; }
.fc-header h2 { margin: 0 0 6px; font-size: 22px; color: var(--text-strong); }
.fc-header p { margin: 0; font-size: 13px; color: var(--text-muted); }

.fc-city { display: flex; gap: 12px; margin-bottom: 16px; flex-wrap: wrap; }
.fc-city-input { max-width: 360px; }

.fc-error {
  background: rgba(220, 38, 38, 0.1); color: #b91c1c;
  border-radius: 10px; padding: 10px 14px; font-size: 13px; margin-bottom: 16px;
}

.fc-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 18px;
  margin-bottom: 18px;
}
.fc-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 14px;
  padding: 18px;
  box-shadow: var(--shadow-card);
}
.fc-card h3 { margin: 0 0 14px; font-size: 15px; color: var(--text-strong); }

.fc-weather { }
.fc-now { text-align: center; padding: 6px 0 14px; }
.fc-temp { font-size: 40px; font-weight: 800; color: var(--primary); line-height: 1; }
.fc-cond { font-size: 15px; color: var(--text-strong); margin-top: 6px; }
.fc-sub { font-size: 12px; color: var(--text-muted); margin-top: 4px; }
.fc-forecast { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; border-top: 1px dashed var(--border); padding-top: 14px; }
.fc-fc-item { text-align: center; }
.fc-fc-day { font-size: 12px; color: var(--text-muted); }
.fc-fc-cond { font-size: 12px; color: var(--text); margin: 4px 0; }
.fc-fc-temp { font-size: 13px; font-weight: 600; color: var(--text-strong); font-variant-numeric: tabular-nums; }

.fc-map-wrap { }
.fc-map {
  width: 100%; height: 260px; border: 0; border-radius: 10px;
  background: var(--surface-soft);
}
.fc-map-coord { font-size: 12px; color: var(--text-muted); margin-top: 8px; text-align: center; font-variant-numeric: tabular-nums; }

.fc-news { }
.fc-news-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }
.fc-news-head h3 { margin: 0; }
.fc-news-list { display: flex; flex-direction: column; gap: 2px; }
.fc-news-item {
  display: flex; align-items: center; justify-content: space-between; gap: 12px;
  padding: 10px 12px; border-radius: 10px; text-decoration: none; color: var(--text);
  transition: background 0.15s;
}
.fc-news-item:hover { background: var(--nav-hover); }
.fc-news-title { font-size: 13px; line-height: 1.5; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.fc-news-src {
  flex-shrink: 0; font-size: 11px; color: var(--text-faint);
  background: var(--surface-soft); padding: 2px 8px; border-radius: 6px;
}

@media (max-width: 860px) {
  .fc-grid { grid-template-columns: 1fr; }
}
@media (max-width: 768px) {
  .free-content { padding: 16px; }
  .fc-city-input { max-width: 100%; }
}
</style>
