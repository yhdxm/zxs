// 天气服务（M9a）—— 封装 Open-Meteo（免费、无需 Key、前端直连）
// 提供城市地理编码 + 当前实况 + 24h 逐时 + 7 天预报。
// 高德（免费 Web 服务档）作为可选第三方源：当本账号已获授权且配置了高德 Key 时优先使用，
// 否则自动回退到 Open-Meteo（默认保底，免费无 Key）。

import { resolveApi } from './thirdPartyApi'

export interface WeatherNow {
  /** ISO 时间 */
  time: string
  /** 气温 ℃ */
  temperature: number
  /** 体感温度 ℃ */
  apparentTemperature: number
  /** 相对湿度 % */
  humidity: number
  /** 风速 km/h */
  windSpeed: number
  /** WMO 天气代码 */
  weatherCode: number
}

export interface HourlyPoint {
  time: string
  temperature: number
  weatherCode: number
}

export interface DailyPoint {
  /** YYYY-MM-DD */
  date: string
  weatherCode: number
  tempMin: number
  tempMax: number
  /** 降水概率 % */
  precipProb: number
}

export interface WeatherResult {
  current: WeatherNow
  hourly: HourlyPoint[]
  daily: DailyPoint[]
}

export interface GeoResult {
  lat: number
  lon: number
  name: string
}

const FETCH_TIMEOUT = 9000

function timeoutFetch(url: string): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT)
  return fetch(url, { signal: controller.signal }).finally(() => clearTimeout(timer))
}

/** 城市名 → 经纬度（Open-Meteo Geocoding，免费无 Key，支持中英文） */
export async function geocode(city: string): Promise<GeoResult> {
  const q = encodeURIComponent((city || '').trim())
  if (!q) throw new Error('请输入城市名称')
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${q}&count=1&language=zh&format=json`
  const res = await timeoutFetch(url)
  if (!res.ok) throw new Error('地理编码请求失败')
  const data = (await res.json().catch(() => ({}))) as {
    results?: Array<{ latitude: number; longitude: number; name: string; country?: string; admin1?: string }>
  }
  const hit = data.results && data.results[0]
  if (!hit) throw new Error(`未找到城市「${city}」`)
  const name = [hit.name, hit.admin1, hit.country].filter(Boolean).join('·')
  return { lat: Number(hit.latitude), lon: Number(hit.longitude), name }
}

/** 经纬度 → 当前实况 + 24h 逐时 + 7 天预报 */
export async function getWeather(lat: number, lon: number): Promise<WeatherResult> {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) throw new Error('经纬度无效')
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
    `&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m` +
    `&hourly=temperature_2m,weather_code` +
    `&daily=weather_code,temperature_2m_min,temperature_2m_max,precipitation_probability_max` +
    `&timezone=auto&forecast_days=7&past_days=0`

  const res = await timeoutFetch(url)
  if (!res.ok) throw new Error('天气请求失败')
  const d = (await res.json().catch(() => ({}))) as {
    current?: Record<string, number | string>
    hourly?: { time?: string[]; temperature_2m?: number[]; weather_code?: number[] }
    daily?: {
      time?: string[]
      weather_code?: number[]
      temperature_2m_min?: number[]
      temperature_2m_max?: number[]
      precipitation_probability_max?: number[]
    }
  }

  if (!d.current || !d.hourly || !d.daily) throw new Error('天气数据解析失败')

  const current: WeatherNow = {
    time: String(d.current.time ?? ''),
    temperature: Number(d.current.temperature_2m ?? 0),
    apparentTemperature: Number(d.current.apparent_temperature ?? 0),
    humidity: Number(d.current.relative_humidity_2m ?? 0),
    windSpeed: Number(d.current.wind_speed_10m ?? 0),
    weatherCode: Number(d.current.weather_code ?? 0)
  }

  const hTime = d.hourly.time || []
  const hTemp = d.hourly.temperature_2m || []
  const hCode = d.hourly.weather_code || []
  const hourly: HourlyPoint[] = []
  for (let i = 0; i < hTime.length; i++) {
    hourly.push({
      time: hTime[i] ?? '',
      temperature: Number(hTemp[i] ?? 0),
      weatherCode: Number(hCode[i] ?? 0)
    })
  }
  // 仅保留未来 24 小时
  const now = Date.now()
  const upcoming = hourly.filter((h) => new Date(h.time).getTime() >= now - 3600_000).slice(0, 24)

  const dTime = d.daily.time || []
  const dCode = d.daily.weather_code || []
  const dMin = d.daily.temperature_2m_min || []
  const dMax = d.daily.temperature_2m_max || []
  const dProb = d.daily.precipitation_probability_max || []
  const daily: DailyPoint[] = []
  for (let i = 0; i < dTime.length; i++) {
    daily.push({
      date: dTime[i] ?? '',
      weatherCode: Number(dCode[i] ?? 0),
      tempMin: Number(dMin[i] ?? 0),
      tempMax: Number(dMax[i] ?? 0),
      precipProb: Number(dProb[i] ?? 0)
    })
  }

  return {
    current,
    hourly: upcoming.length ? upcoming : hourly.slice(0, 24),
    daily: daily.slice(0, 7)
  }
}

/** WMO 天气代码 → 中文描述 */
export function weatherText(code: number): string {
  const m: Record<number, string> = {
    0: '晴',
    1: '大致晴朗',
    2: '局部多云',
    3: '阴',
    45: '雾',
    48: '雾凇',
    51: '小毛毛雨',
    53: '毛毛雨',
    55: '大毛毛雨',
    56: '冻毛毛雨',
    57: '强冻毛毛雨',
    61: '小雨',
    63: '中雨',
    65: '大雨',
    66: '冻雨',
    67: '强冻雨',
    71: '小雪',
    73: '中雪',
    75: '大雪',
    77: '雪粒',
    80: '阵雨',
    81: '强阵雨',
    82: '暴雨',
    85: '阵雪',
    86: '强阵雪',
    95: '雷阵雨',
    96: '雷阵雨伴冰雹',
    99: '强雷暴伴冰雹'
  }
  return m[code] || '未知'
}

/** 天气代码 → Emoji 图标（移动端/卡片友好） */
export function weatherEmoji(code: number): string {
  if (code === 0) return '☀️'
  if (code === 1) return '🌤️'
  if (code === 2) return '⛅'
  if (code === 3) return '☁️'
  if (code === 45 || code === 48) return '🌫️'
  if (code >= 51 && code <= 57) return '🌦️'
  if (code >= 61 && code <= 67) return '🌧️'
  if (code >= 71 && code <= 77) return '🌨️'
  if (code >= 80 && code <= 82) return '🌧️'
  if (code >= 85 && code <= 86) return '🌨️'
  if (code >= 95) return '⛈️'
  return '🌡️'
}

/* ============================================================
 * 高德天气（免费 Web 服务档）—— 可选第三方源
 * 端点：https://restapi.amap.com/v3/weather/weatherInfo
 * 免费个人开发者配额（气象查询），需「Web 服务」类型 Key。
 * 仅在 resolveApi('weather') 返回 amap + key 时使用；任何失败都回退 Open-Meteo。
 * ============================================================ */
interface AmapLive {
  weather: string
  temperature: string
  winddirection: string
  windpower: string
  humidity: string
  reporttime: string
  city: string
  adcode: string
}
interface AmapCast {
  date: string
  dayweather: string
  nightweather: string
  daytemp: string
  nighttemp: string
  daywind: string
  daypower: string
}
interface AmapWeatherResp {
  status: string
  info?: string
  lives?: AmapLive[]
  forecasts?: Array<{ city: string; adcode: string; casts: AmapCast[] }>
}

/** 高德天气中文描述 → WMO 代码（用于复用现有 weatherText/Emoji 映射） */
function amapWeatherToWmo(text: string): number {
  const t = (text || '').trim()
  const map: Record<string, number> = {
    晴: 0, 少云: 1, 晴间多云: 1, 多云: 2, 阴: 3,
    阵雨: 80, 强阵雨: 81, 雷阵雨: 95, 雷阵雨伴大风: 95,
    小雨: 61, 中雨: 63, 大雨: 65, 暴雨: 82, 大暴雨: 82, 特大暴雨: 82,
    小雪: 71, 中雪: 73, 大雪: 75, 暴雪: 75, 雨夹雪: 85, 阵雪: 85,
    雾: 45, 浓雾: 45, 霾: 45, 沙尘: 45, 浮尘: 45, 扬沙: 45, 强沙尘暴: 45,
    飑: 75, 龙卷风: 95, 弱高吹雪: 73, 高吹雪: 73, 轻雾: 45
  }
  return map[t] ?? 0
}

/** 高德风力等级（如 "≤3"、"4"）近似换算为 km/h */
function amapWindPowerToSpeed(power: string): number {
  const m = /(\d+)/.exec(power || '')
  const lvl = m ? Number(m[1]) : 0
  if (!lvl) return 0
  // 蒲福风级近似：等级 * 4.5 km/h
  return Math.round(lvl * 4.5)
}

/** 用首日昼夜温差近似合成 24h 逐时曲线（高德免费接口无逐时数据，仅供趋势展示） */
function buildHourlyFromCast(dayTemp: number, nightTemp: number): HourlyPoint[] {
  const out: HourlyPoint[] = []
  const now = new Date()
  const base = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0)
  for (let h = 0; h < 24; h++) {
    const t = new Date(base.getTime() + h * 3600_000)
    // 白天 14 点最暖、凌晨 4 点最冷，余弦曲线近似
    const phase = Math.cos(((h - 14) / 24) * 2 * Math.PI)
    const temp = Math.round(nightTemp + ((dayTemp - nightTemp) * (1 - phase)) / 2)
    out.push({ time: t.toISOString(), temperature: temp, weatherCode: 0 })
  }
  return out
}

function mapAmapToWeather(resp: AmapWeatherResp): WeatherResult | null {
  const live = resp.lives && resp.lives[0]
  if (!live) return null
  const code = amapWeatherToWmo(live.weather)
  const temp = Number(live.temperature) || 0
  const current: WeatherNow = {
    time: live.reporttime || new Date().toISOString(),
    temperature: temp,
    apparentTemperature: temp,
    humidity: Number(live.humidity) || 0,
    windSpeed: amapWindPowerToSpeed(live.windpower),
    weatherCode: code
  }

  const casts = resp.forecasts && resp.forecasts[0]?.casts
  const daily: DailyPoint[] = []
  let dayT = temp
  let nightT = temp
  if (casts && casts.length) {
    for (const c of casts) {
      daily.push({
        date: c.date,
        weatherCode: amapWeatherToWmo(c.dayweather || c.nightweather),
        tempMin: Number(c.nighttemp) || 0,
        tempMax: Number(c.daytemp) || 0,
        precipProb: 0
      })
    }
    // 逐时：用首日昼夜温差近似
    const first = casts[0]!
    dayT = Number(first.daytemp) || temp
    nightT = Number(first.nighttemp) || temp
  }
  const hourly = casts && casts.length ? buildHourlyFromCast(dayT, nightT) : []

  return { current, hourly, daily: daily.slice(0, 7) }
}

async function fetchAmapWeather(city: string, key: string): Promise<WeatherResult> {
  const q = encodeURIComponent((city || '').trim())
  const url = `https://restapi.amap.com/v3/weather/weatherInfo?city=${q}&key=${encodeURIComponent(key)}&extensions=all`
  const res = await timeoutFetch(url)
  if (!res.ok) throw new Error('高德天气请求失败')
  const data = (await res.json().catch(() => ({}))) as AmapWeatherResp
  if (data.status !== '1') throw new Error('高德：' + (data.info || '请求异常'))
  const mapped = mapAmapToWeather(data)
  if (!mapped) throw new Error('高德天气数据解析失败')
  return mapped
}

export interface WeatherByCityResult {
  result: WeatherResult
  /** 实际数据来源 */
  source: 'amap' | 'open-meteo'
}

/**
 * 按城市获取天气：优先使用本账号已授权且配置的高德 Key；
 * 否则（未授权 / 未配置 / 高德失败）回退 Open-Meteo（默认保底，免费无 Key）。
 */
export async function getWeatherByCity(city: string): Promise<WeatherByCityResult> {
  const resolved = await resolveApi('weather')
  if (resolved && resolved.provider === 'amap' && resolved.apiKey) {
    try {
      const result = await fetchAmapWeather(city, resolved.apiKey)
      return { result, source: 'amap' }
    } catch (e) {
      console.warn('[weather] 高德获取失败，回退 Open-Meteo：', e)
    }
  }
  const geo = await geocode(city)
  const result = await getWeather(geo.lat, geo.lon)
  return { result, source: 'open-meteo' }
}
