// 地理服务（M9b）—— 天地图瓦片 URL、DataV 行政区划 GeoJSON 下钻、haversine 测距。
// 天地图免费 Key：优先使用超管在云端配置的共享 Key，其次回退到本浏览器 localStorage。
// 公里测距使用本地 haversine，不引入第三方库。

import { supabase } from './appDataService'

const FREE_API_KEY = 'zxs_free_apis'
const FETCH_TIMEOUT = 9000

// 内存缓存共享 Key，避免每次读取都请求 Supabase（页面内多次调用地图/新闻）
let sharedKeyCache: Record<string, string> | null = null
let sharedKeyLoadTs = 0
const SHARED_KEY_TTL_MS = 60_000

/** 读取本地保存的免费 API Key（JSON 形式：{ tianditu?, tianxing? }） */
function readLocalFreeApiKey(provider: string): string {
  if (typeof window === 'undefined') return ''
  try {
    const raw = window.localStorage.getItem(FREE_API_KEY)
    if (!raw) return ''
    const obj = JSON.parse(raw) as Record<string, string>
    return obj[provider] || ''
  } catch {
    return ''
  }
}

/** 从 Supabase 读取超管配置的共享免费 API Key */
export async function loadSharedFreeApiKeys(): Promise<Record<string, string>> {
  const now = Date.now()
  if (sharedKeyCache && now - sharedKeyLoadTs < SHARED_KEY_TTL_MS) {
    return sharedKeyCache
  }
  try {
    const { data, error } = await supabase.from('shared_free_api_keys').select('provider, key_value')
    if (error) {
      console.warn('[geoService] 读取共享 Key 失败', error.message)
      return sharedKeyCache || {}
    }
    const map: Record<string, string> = {}
    for (const r of (data || []) as Array<{ provider: string; key_value: string }>) {
      map[r.provider] = r.key_value || ''
    }
    sharedKeyCache = map
    sharedKeyLoadTs = now
    return map
  } catch (e) {
    console.warn('[geoService] 读取共享 Key 异常', e)
    return sharedKeyCache || {}
  }
}

/** 公开读取入口：优先共享 Key，无共享则回退本地 Key */
export async function readFreeApiKey(provider: 'tianditu' | 'tianxing' | 'weather' | 'amap'): Promise<string> {
  const shared = await loadSharedFreeApiKeys()
  const sharedVal = shared[provider]
  if (sharedVal) return sharedVal
  return readLocalFreeApiKey(provider)
}

/** 写入本地免费 API Key（合并写入，避免覆盖其它 provider） */
export function writeFreeApiKey(provider: 'tianditu' | 'tianxing' | 'weather' | 'amap', value: string): void {
  if (typeof window === 'undefined') return
  try {
    const raw = window.localStorage.getItem(FREE_API_KEY)
    const obj = raw ? (JSON.parse(raw) as Record<string, string>) : {}
    obj[provider] = value
    window.localStorage.setItem(FREE_API_KEY, JSON.stringify(obj))
  } catch {
    /* 忽略写入异常 */
  }
}

/** 超管保存共享免费 API Key 到云端 */
export async function saveSharedFreeApiKey(
  provider: 'tianditu' | 'tianxing' | 'weather' | 'amap',
  value: string
): Promise<void> {
  const { error } = await supabase
    .from('shared_free_api_keys')
    .upsert(
      { provider, key_value: value.trim(), updated_at: new Date().toISOString(), updated_by: undefined },
      { onConflict: 'provider' }
    )
  if (error) {
    throw new Error('保存共享 Key 失败：' + error.message)
  }
  // 刷新内存缓存
  sharedKeyCache = null
  await loadSharedFreeApiKeys()
}

/** 清空共享 Key 内存缓存（登录切换时调用） */
export function clearSharedFreeApiKeyCache(): void {
  sharedKeyCache = null
  sharedKeyLoadTs = 0
}

/**
 * 构造天地图 WMTS 瓦片模板（Leaflet TileLayer 用）。
 * layer: 'vec' 矢量底图 / 'cva' 注记层。
 * 注意：URL 路径段为 `${layer}_w`（如 vec_w），但 WMTS 的 LAYER 参数必须为
 * `vec` / `cva`（不含 _w），否则天地图会返回 400/403 导致地图空白。
 * {s} 由 subdomains '01234567' 替换。
 */
export function tiandituTileUrl(layer: 'vec' | 'cva', tk: string): string {
  const sub = layer === 'vec' ? 'vec_w' : 'cva_w'
  return (
    `https://t{s}.tianditu.gov.cn/${sub}/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0` +
    `&LAYER=${layer}&STYLE=default&TILEMATRIXSET=w&FORMAT=tiles&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}&tk=${tk}`
  )
}

/** OSM 瓦片（无 Key 降级底图） */
export const OSM_TILE_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'

/* ==================== 底图多源兜底（哪个能用先用哪个） ==================== */

export type TileSourceId = 'tianditu' | 'amap' | 'amapSat' | 'geoq' | 'osm'
export type TileProbeState = 'idle' | 'probing' | 'ok' | 'fail' | 'nokey'

export interface TileSource {
  id: TileSourceId
  name: string
  desc: string
  /** 坐标系：gcj02 需要把 WGS84 的 GeoJSON 边界做火星坐标偏移纠正 */
  crs: 'wgs84' | 'gcj02'
  requireKey: boolean
  subdomains: string
  maxZoom: number
  attribution: string
  /** 瓦片模板，key 仅天地图需要 */
  url: (key?: string) => string
  /** 可选注记层（天地图矢量底图需要单独叠加注记） */
  label?: (key?: string) => string
}

/**
 * 底图源优先级：国内源优先，OSM 仅作最后兜底。
 * 全部免费、无需付费额度；高德/GeoQ 为公开瓦片服务，免 Key。
 */
export const TILE_SOURCES: TileSource[] = [
  {
    id: 'tianditu',
    name: '天地图',
    desc: '国家地理信息公共服务平台（需配置免费 Key）',
    crs: 'wgs84',
    requireKey: true,
    subdomains: '01234567',
    maxZoom: 18,
    attribution: '© 天地图',
    url: (key) => tiandituTileUrl('vec', key || ''),
    label: (key) => tiandituTileUrl('cva', key || '')
  },
  {
    id: 'amap',
    name: '高德矢量',
    desc: '高德公开瓦片，国内直连速度快，免 Key',
    crs: 'gcj02',
    requireKey: false,
    subdomains: '1234',
    maxZoom: 18,
    attribution: '© 高德地图',
    url: () =>
      'https://webrd0{s}.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=8&x={x}&y={y}&z={z}'
  },
  {
    id: 'amapSat',
    name: '高德卫星',
    desc: '高德卫星影像图层，免 Key',
    crs: 'gcj02',
    requireKey: false,
    subdomains: '1234',
    maxZoom: 18,
    attribution: '© 高德地图',
    url: () => 'https://webst0{s}.is.autonavi.com/appmaptile?style=6&x={x}&y={y}&z={z}'
  },
  {
    id: 'geoq',
    name: 'GeoQ 智图',
    desc: '国内 ArcGIS 免费公开底图，免 Key',
    crs: 'gcj02',
    requireKey: false,
    subdomains: '',
    maxZoom: 18,
    attribution: '© GeoQ 智图',
    url: () =>
      'https://map.geoq.cn/ArcGIS/rest/services/ChinaOnlineCommunity/MapServer/tile/{z}/{y}/{x}'
  },
  {
    id: 'osm',
    name: 'OpenStreetMap',
    desc: '海外开放底图，国内可能连接受限，仅作最后兜底',
    crs: 'wgs84',
    requireKey: false,
    subdomains: 'abc',
    maxZoom: 19,
    attribution: '© OpenStreetMap',
    url: () => OSM_TILE_URL
  }
]

/** 把瓦片模板替换成一个具体可请求的探测 URL（默认取中国中部 z4 瓦片） */
function buildProbeUrl(src: TileSource, key?: string): string {
  const sub = src.subdomains.charAt(0)
  return src
    .url(key)
    .replace('{s}', sub)
    .replace('{z}', '4')
    .replace('{x}', '13')
    .replace('{y}', '6')
    // 天地图 WMTS 用的是 TILEMATRIX/TILEROW/TILECOL，上面已按占位符替换
    .replace('{TileMatrix}', '4')
}

/**
 * 探测单个底图源是否可用：用 Image 加载一张真实瓦片，成功即可用。
 * 用 Image 而非 fetch 是为了绕开跨域限制（瓦片服务通常不带 CORS 头）。
 */
export function probeTileSource(src: TileSource, key?: string, timeoutMs = 6000): Promise<boolean> {
  if (src.requireKey && !key) return Promise.resolve(false)
  if (typeof window === 'undefined') return Promise.resolve(false)
  return new Promise<boolean>((resolve) => {
    const img = new Image()
    let settled = false
    const done = (ok: boolean) => {
      if (settled) return
      settled = true
      img.onload = null
      img.onerror = null
      resolve(ok)
    }
    const timer = setTimeout(() => done(false), timeoutMs)
    img.onload = () => {
      clearTimeout(timer)
      // 部分服务返回 1x1 占位图表示失败
      done(img.naturalWidth > 4 && img.naturalHeight > 4)
    }
    img.onerror = () => {
      clearTimeout(timer)
      done(false)
    }
    img.src = buildProbeUrl(src, key)
  })
}

/** 并发探测全部底图源，返回每个源的可用性 */
export async function probeAllTileSources(key?: string): Promise<Record<TileSourceId, boolean>> {
  const entries = await Promise.all(
    TILE_SOURCES.map(async (s) => [s.id, await probeTileSource(s, key)] as const)
  )
  return Object.fromEntries(entries) as Record<TileSourceId, boolean>
}

/* ==================== WGS84 → GCJ-02 火星坐标纠偏 ==================== */
// 高德/GeoQ 底图为 GCJ-02，而 DataV 行政区 GeoJSON 为 WGS84，
// 直接叠加会有数百米偏移，此处做标准偏移纠正（纯前端算法，免费）。

const GCJ_A = 6378245.0
const GCJ_EE = 0.00669342162296594323

function outOfChina(lng: number, lat: number): boolean {
  return lng < 72.004 || lng > 137.8347 || lat < 0.8293 || lat > 55.8271
}
function transformLat(x: number, y: number): number {
  let ret = -100 + 2 * x + 3 * y + 0.2 * y * y + 0.1 * x * y + 0.2 * Math.sqrt(Math.abs(x))
  ret += ((20 * Math.sin(6 * x * Math.PI) + 20 * Math.sin(2 * x * Math.PI)) * 2) / 3
  ret += ((20 * Math.sin(y * Math.PI) + 40 * Math.sin((y / 3) * Math.PI)) * 2) / 3
  ret += ((160 * Math.sin((y / 12) * Math.PI) + 320 * Math.sin((y * Math.PI) / 30)) * 2) / 3
  return ret
}
function transformLng(x: number, y: number): number {
  let ret = 300 + x + 2 * y + 0.1 * x * x + 0.1 * x * y + 0.1 * Math.sqrt(Math.abs(x))
  ret += ((20 * Math.sin(6 * x * Math.PI) + 20 * Math.sin(2 * x * Math.PI)) * 2) / 3
  ret += ((20 * Math.sin(x * Math.PI) + 40 * Math.sin((x / 3) * Math.PI)) * 2) / 3
  ret += ((150 * Math.sin((x / 12) * Math.PI) + 300 * Math.sin((x / 30) * Math.PI)) * 2) / 3
  return ret
}

/** WGS84 坐标转 GCJ-02（火星坐标） */
export function wgs84ToGcj02(lng: number, lat: number): [number, number] {
  if (outOfChina(lng, lat)) return [lng, lat]
  let dLat = transformLat(lng - 105.0, lat - 35.0)
  let dLng = transformLng(lng - 105.0, lat - 35.0)
  const radLat = (lat / 180.0) * Math.PI
  let magic = Math.sin(radLat)
  magic = 1 - GCJ_EE * magic * magic
  const sqrtMagic = Math.sqrt(magic)
  dLat = (dLat * 180.0) / (((GCJ_A * (1 - GCJ_EE)) / (magic * sqrtMagic)) * Math.PI)
  dLng = (dLng * 180.0) / ((GCJ_A / sqrtMagic) * Math.cos(radLat) * Math.PI)
  return [lng + dLng, lat + dLat]
}

/** GCJ-02（火星坐标）→ WGS84，迭代反算（高德/GeoQ 底图上点击的点需先转 WGS84 再给 OSRM） */
export function gcj02ToWgs84(lng: number, lat: number): [number, number] {
  if (outOfChina(lng, lat)) return [lng, lat]
  let wgsLng = lng
  let wgsLat = lat
  for (let i = 0; i < 6; i++) {
    const [gcjLng, gcjLat] = wgs84ToGcj02(wgsLng, wgsLat)
    const dLng = gcjLng - lng
    const dLat = gcjLat - lat
    if (Math.abs(dLng) < 1e-7 && Math.abs(dLat) < 1e-7) break
    wgsLng -= dLng
    wgsLat -= dLat
  }
  return [wgsLng, wgsLat]
}

/** 把当前底图坐标系的点转成 WGS84（给路由/搜索等外部服务用） */
export function mapPointToWgs84(
  lng: number,
  lat: number,
  crs: 'wgs84' | 'gcj02' = 'wgs84'
): [number, number] {
  return crs === 'gcj02' ? gcj02ToWgs84(lng, lat) : [lng, lat]
}

/** 把 WGS84 点转成当前底图坐标系（外部服务结果回显到地图用） */
export function wgs84ToMapPoint(
  lng: number,
  lat: number,
  crs: 'wgs84' | 'gcj02' = 'wgs84'
): [number, number] {
  return crs === 'gcj02' ? wgs84ToGcj02(lng, lat) : [lng, lat]
}

/** 递归转换 GeoJSON 坐标（WGS84 → GCJ-02），返回新对象，不改原数据 */
export function shiftGeoJsonToGcj02<T>(geo: T): T {
  const convert = (coords: unknown): unknown => {
    if (!Array.isArray(coords)) return coords
    if (coords.length >= 2 && typeof coords[0] === 'number' && typeof coords[1] === 'number') {
      return wgs84ToGcj02(coords[0] as number, coords[1] as number)
    }
    return coords.map(convert)
  }
  const clone = JSON.parse(JSON.stringify(geo)) as {
    features?: Array<{ geometry?: { coordinates?: unknown } }>
  }
  if (Array.isArray(clone.features)) {
    clone.features.forEach((f) => {
      if (f.geometry && f.geometry.coordinates) {
        f.geometry.coordinates = convert(f.geometry.coordinates)
      }
    })
  }
  return clone as unknown as T
}

/** 内置全国省级行政区兜底（DataV 不可达时仍能展示数据，中心点为公开经纬度） */
export const BUILTIN_PROVINCES: RegionNode[] = [
  { adcode: '110000', name: '北京市', center: [116.405285, 39.904989] },
  { adcode: '120000', name: '天津市', center: [117.190182, 39.125596] },
  { adcode: '130000', name: '河北省', center: [114.502461, 38.045474] },
  { adcode: '140000', name: '山西省', center: [112.549248, 37.857014] },
  { adcode: '150000', name: '内蒙古自治区', center: [111.670801, 40.818311] },
  { adcode: '210000', name: '辽宁省', center: [123.429096, 41.796767] },
  { adcode: '220000', name: '吉林省', center: [125.3245, 43.886841] },
  { adcode: '230000', name: '黑龙江省', center: [126.642464, 45.756967] },
  { adcode: '310000', name: '上海市', center: [121.472644, 31.231706] },
  { adcode: '320000', name: '江苏省', center: [118.767413, 32.041544] },
  { adcode: '330000', name: '浙江省', center: [120.153576, 30.287459] },
  { adcode: '340000', name: '安徽省', center: [117.283042, 31.86119] },
  { adcode: '350000', name: '福建省', center: [119.306239, 26.075302] },
  { adcode: '360000', name: '江西省', center: [115.892151, 28.676493] },
  { adcode: '370000', name: '山东省', center: [117.000923, 36.675807] },
  { adcode: '410000', name: '河南省', center: [113.665412, 34.757975] },
  { adcode: '420000', name: '湖北省', center: [114.298572, 30.584355] },
  { adcode: '430000', name: '湖南省', center: [112.982279, 28.19409] },
  { adcode: '440000', name: '广东省', center: [113.280637, 23.125178] },
  { adcode: '450000', name: '广西壮族自治区', center: [108.320004, 22.82402] },
  { adcode: '460000', name: '海南省', center: [110.33119, 20.031971] },
  { adcode: '500000', name: '重庆市', center: [106.504962, 29.533155] },
  { adcode: '510000', name: '四川省', center: [104.065735, 30.659462] },
  { adcode: '520000', name: '贵州省', center: [106.713478, 26.578343] },
  { adcode: '530000', name: '云南省', center: [102.712251, 25.040609] },
  { adcode: '540000', name: '西藏自治区', center: [91.132212, 29.660361] },
  { adcode: '610000', name: '陕西省', center: [108.948024, 34.263161] },
  { adcode: '620000', name: '甘肃省', center: [103.823557, 36.058039] },
  { adcode: '630000', name: '青海省', center: [101.778916, 36.623178] },
  { adcode: '640000', name: '宁夏回族自治区', center: [106.278179, 38.46637] },
  { adcode: '650000', name: '新疆维吾尔自治区', center: [87.617733, 43.792818] },
  { adcode: '710000', name: '中国台湾', center: [121.509062, 25.044332] },
  { adcode: '810000', name: '中国香港', center: [114.173355, 22.320048] },
  { adcode: '820000', name: '中国澳门', center: [113.54909, 22.198951] }
]

function timeoutFetch(url: string, ms: number = FETCH_TIMEOUT): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), ms)
  return fetch(url, { signal: controller.signal }).finally(() => clearTimeout(timer))
}

/**
 * 免费 CORS 代理（部署在境外，可代访问国内直连不通的 OSM 系服务）。
 * 实测：国内直连 router.project-osrm.org / nominatim.openstreetmap.org 均不可达，
 * 经 allorigins 代理后可正常返回，故作为主力通路之一。
 */
const CORS_PROXIES = [
  (u: string) => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`,
  (u: string) => `https://api.codetabs.com/v1/proxy/?quest=${encodeURIComponent(u)}`
]

/** 依次尝试「直连 → 各免费代理」拉取 JSON，任一成功即返回 */
async function fetchJsonWithProxyFallback<T>(
  url: string,
  opts: { directTimeout?: number; proxyTimeout?: number; validate?: (data: T) => boolean } = {}
): Promise<T> {
  const directTimeout = opts.directTimeout ?? 4500
  const proxyTimeout = opts.proxyTimeout ?? 12000
  const validate = opts.validate ?? ((d: T) => d != null)

  const tries: Array<{ url: string; timeout: number }> = [
    { url, timeout: directTimeout },
    ...CORS_PROXIES.map((p) => ({ url: p(url), timeout: proxyTimeout }))
  ]

  let lastErr: unknown
  for (const t of tries) {
    try {
      const res = await timeoutFetch(t.url, t.timeout)
      if (!res.ok) continue
      const text = await res.text()
      if (!text || text.trimStart().startsWith('<')) continue // 代理错误页多为 HTML
      const data = JSON.parse(text) as T
      if (validate(data)) return data
    } catch (e) {
      lastErr = e
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error('请求失败：' + url)
}

/**
 * 地区名称合规归一化。
 * OSM 数据中港澳台标注不规范（如「臺灣」「Hong Kong」），
 * 统一显示为「中国台湾 / 中国香港 / 中国澳门」。
 */
function normalizeRegionName(name: string): string {
  if (!name) return name
  const map: Array<[RegExp, string]> = [
    [/^(臺灣|台灣|台湾|Taiwan)$/i, '中国台湾'],
    [/^(香港|Hong ?Kong|香港特別行政區|香港特别行政区)$/i, '中国香港'],
    [/^(澳門|澳门|Macao|Macau|澳門特別行政區|澳门特别行政区)$/i, '中国澳门'],
    [/^(中国|中國|China|People's Republic of China)$/i, '中国']
  ]
  for (const [re, val] of map) {
    if (re.test(name.trim())) return val
  }
  return name
}

/** 对一整段地址文本做港澳台表述归一化 */
function normalizeAddressText(text: string): string {
  if (!text) return text
  return text
    .replace(/(^|[,，\s])(臺灣|台灣|台湾)([,，\s]|$)/g, '$1中国台湾$3')
    .replace(/(^|[,，\s])(香港特別行政區|香港特别行政区|香港)([,，\s]|$)/g, '$1中国香港$3')
    .replace(/(^|[,，\s])(澳門特別行政區|澳门特别行政区|澳門|澳门)([,，\s]|$)/g, '$1中国澳门$3')
}

/** 加载行政区划边界 GeoJSON（DataV）。adcode 不带后缀取当前区域边界。 */
export async function loadGeoJson(adcode: string): Promise<GeoJSON.FeatureCollection> {
  const url = `https://geo.datav.aliyun.com/areas_v3/bound/${adcode}.json`
  const res = await timeoutFetch(url)
  if (!res.ok) throw new Error('行政区划边界加载失败')
  return (await res.json()) as GeoJSON.FeatureCollection
}

export interface RegionNode {
  adcode: string
  name: string
  /** [经度, 纬度]，可能为 null */
  center: [number, number] | null
}

/** 加载下级行政区划列表（DataV _full），用于省→市→县下钻。 */
export async function loadRegionChildren(adcode: string): Promise<RegionNode[]> {
  const url = `https://geo.datav.aliyun.com/areas_v3/bound/${adcode}_full.json`
  const res = await timeoutFetch(url)
  if (!res.ok) throw new Error('下级行政区划加载失败')
  const data = (await res.json()) as { features?: Array<{ properties: Record<string, unknown> }> }
  const features = data.features || []
  return features
    .map((f) => {
      const p = f.properties || {}
      const center = Array.isArray(p.center) && p.center.length === 2
        ? ([Number(p.center[0]), Number(p.center[1])] as [number, number])
        : null
      return {
        adcode: String(p.adcode ?? ''),
        name: String(p.name ?? ''),
        center
      }
    })
    .filter((n) => n.adcode && n.name)
}

/**
 * 带兜底的下级行政区加载：DataV 不可达时，全国层级回退到内置省级清单，
 * 保证「地图页永远有数据」，不会出现整页空白。
 */
export async function loadRegionChildrenSafe(
  adcode: string
): Promise<{ list: RegionNode[]; fallback: boolean }> {
  try {
    const list = await loadRegionChildren(adcode)
    if (list.length) return { list, fallback: false }
  } catch {
    /* 走兜底 */
  }
  if (adcode === '100000') return { list: [...BUILTIN_PROVINCES], fallback: true }
  return { list: [], fallback: false }
}

/** haversine 球面距离，返回公里数 */
export function haversine(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const R = 6371
  const toRad = (x: number) => (x * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLon = toRad(b.lon - a.lon)
  const lat1 = toRad(a.lat)
  const lat2 = toRad(b.lat)
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

/* ==================== 免费公开路由服务 OSRM ==================== */

export interface OsrmRouteResult {
  distanceKm: number
  durationMin: number
  geometry: GeoJSON.LineString
}

interface OsrmResponse {
  code?: string
  routes?: Array<{ distance: number; duration: number; geometry: GeoJSON.LineString }>
}

/**
 * 调用 OSRM 公开路由服务查询驾车路线（免费、无 Key）。
 * start/end 为 WGS84 [经度, 纬度]。
 *
 * ⚠️ 实测：router.project-osrm.org 在国内网络下直连不可达（连接被重置），
 * 这是「路线规划无任何数据」的根因。现改为「直连（短超时快速失败）→ 免费 CORS 代理」，
 * 代理位于境外可正常访问 OSRM，实测北京→上海可返回 1208.9km 的真实路线。
 */
export async function osrmRoute(
  start: [number, number],
  end: [number, number]
): Promise<OsrmRouteResult> {
  const url =
    `https://router.project-osrm.org/route/v1/driving/` +
    `${start[0]},${start[1]};${end[0]},${end[1]}?overview=full&geometries=geojson&steps=false`

  let data: OsrmResponse
  try {
    data = await fetchJsonWithProxyFallback<OsrmResponse>(url, {
      directTimeout: 4000,
      proxyTimeout: 15000,
      validate: (d) => d?.code === 'Ok' && Array.isArray(d.routes) && d.routes.length > 0
    })
  } catch {
    throw new Error('路线规划服务暂时不可达（已尝试直连与免费代理），请稍后重试')
  }

  const r = data.routes?.[0]
  if (!r) throw new Error('未找到可用路线，可能两点之间无道路连通')
  return {
    distanceKm: r.distance / 1000,
    durationMin: Math.round(r.duration / 60),
    geometry: r.geometry
  }
}

/* ==================== 免费公开地名服务 Nominatim ==================== */

export interface NominatimAddress {
  country?: string
  state?: string
  city?: string
  district?: string
  suburb?: string
  town?: string
  village?: string
  municipality?: string
  region?: string
  county?: string
}

export interface NominatimResult {
  placeId: number
  name: string
  displayName: string
  lat: number
  lon: number
  boundingbox: [number, number, number, number]
}

export interface NominatimReverseResult {
  displayName: string
  lat: number
  lon: number
  address: NominatimAddress
}

/* ---------- Photon（OSM 生态、免 KEY、国内可直连，Nominatim 的替代主源） ---------- */

/** 中国范围 bbox，避免搜到境外同名地点 */
const CN_BBOX = '73.5,18.0,135.1,53.6'

interface PhotonFeature {
  geometry?: { coordinates?: [number, number] }
  properties?: {
    osm_id?: number
    name?: string
    street?: string
    housenumber?: string
    district?: string
    city?: string
    county?: string
    state?: string
    country?: string
    countrycode?: string
    type?: string
    extent?: number[]
  }
}

/** 由 Photon 属性拼出可读的中文地址串 */
function photonDisplayName(p: NonNullable<PhotonFeature['properties']>): string {
  const parts = [
    normalizeRegionName(p.country ?? ''),
    normalizeRegionName(p.state ?? ''),
    p.city,
    p.county,
    p.district,
    p.street,
    p.housenumber,
    p.name
  ]
    .filter((s): s is string => Boolean(s && s.trim()))
    // 去掉相邻重复（如 city 与 state 同为「北京市」）
    .filter((s, i, arr) => i === 0 || s !== arr[i - 1])
  return normalizeAddressText(parts.join(' '))
}

async function photonSearch(query: string, limit: number): Promise<NominatimResult[]> {
  const url =
    `https://photon.komoot.io/api/?q=${encodeURIComponent(query)}` +
    `&limit=${limit}&lang=default&bbox=${CN_BBOX}`
  const data = await fetchJsonWithProxyFallback<{ features?: PhotonFeature[] }>(url, {
    directTimeout: 8000,
    validate: (d) => Array.isArray(d?.features)
  })
  const seen = new Set<string>()
  const out: NominatimResult[] = []
  for (const f of data.features ?? []) {
    const p = f.properties
    const c = f.geometry?.coordinates
    if (!p || !Array.isArray(c) || c.length < 2) continue
    const lon = Number(c[0])
    const lat = Number(c[1])
    if (!Number.isFinite(lon) || !Number.isFinite(lat)) continue
    const key = `${p.name ?? ''}@${lon.toFixed(4)},${lat.toFixed(4)}`
    if (seen.has(key)) continue
    seen.add(key)
    // Photon extent = [minLon, maxLat, maxLon, minLat]，转成 Nominatim 的 [minLat, maxLat, minLon, maxLon]
    const e = p.extent
    const bbox: [number, number, number, number] =
      Array.isArray(e) && e.length === 4
        ? [Number(e[3]), Number(e[1]), Number(e[0]), Number(e[2])]
        : [lat, lat, lon, lon]
    out.push({
      placeId: p.osm_id ?? out.length,
      name: normalizeRegionName(p.name ?? ''),
      displayName: photonDisplayName(p),
      lat,
      lon,
      boundingbox: bbox
    })
  }
  return out
}

/**
 * 地名搜索（免费、无 Key）。
 *
 * ⚠️ 实测：nominatim.openstreetmap.org 在国内直连超时、经免费代理也返回 500，
 * 这是「地名搜索无数据」的根因。现主源改为 Photon（同为 OSM 数据、
 * 带 Access-Control-Allow-Origin: *、国内可直连、支持中文），Nominatim 降为备源。
 * 港澳台名称统一归一化为「中国台湾 / 中国香港 / 中国澳门」。
 */
export async function nominatimSearch(q: string, limit = 5): Promise<NominatimResult[]> {
  const query = q.trim()
  if (!query) return []

  // 1) 主源：Photon（国内可直连）
  try {
    const list = await photonSearch(query, limit)
    if (list.length) return list
  } catch {
    /* 主源失败，走备源 */
  }

  // 2) 备源：Nominatim（有梯子时可用）
  const url =
    `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}` +
    `&format=json&limit=${limit}&countrycodes=cn&accept-language=zh-CN`
  try {
    const data = await fetchJsonWithProxyFallback<
      Array<{
        place_id: number
        name?: string
        display_name?: string
        lat?: string
        lon?: string
        boundingbox?: string[]
      }>
    >(url, { directTimeout: 4000, validate: (d) => Array.isArray(d) })
    return data.map((item) => ({
      placeId: item.place_id,
      name: normalizeRegionName(item.name || ''),
      displayName: normalizeAddressText(item.display_name || ''),
      lat: Number(item.lat || 0),
      lon: Number(item.lon || 0),
      boundingbox: (item.boundingbox || []).map(Number) as [number, number, number, number]
    }))
  } catch {
    return []
  }
}

/**
 * 逆地址解析（坐标 → 省/市/区/街道等层级，免费无 Key）。
 * 主源 Photon reverse（国内可直连），备源 Nominatim reverse。
 */
export async function nominatimReverse(
  lat: number,
  lon: number
): Promise<NominatimReverseResult> {
  // 1) 主源：Photon reverse
  try {
    const url = `https://photon.komoot.io/reverse?lat=${lat}&lon=${lon}&lang=default`
    const data = await fetchJsonWithProxyFallback<{ features?: PhotonFeature[] }>(url, {
      directTimeout: 8000,
      validate: (d) => Array.isArray(d?.features)
    })
    const p = data.features?.[0]?.properties
    if (p) {
      return {
        displayName: photonDisplayName(p),
        lat,
        lon,
        address: {
          country: normalizeRegionName(p.country ?? ''),
          state: normalizeRegionName(p.state ?? ''),
          city: p.city,
          district: p.district,
          county: p.county
        }
      }
    }
  } catch {
    /* 主源失败，走备源 */
  }

  // 2) 备源：Nominatim reverse
  const url =
    `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}` +
    `&format=json&accept-language=zh-CN`
  try {
    const data = await fetchJsonWithProxyFallback<{
      display_name?: string
      lat?: string | number
      lon?: string | number
      address?: NominatimAddress
    }>(url, { directTimeout: 4000, validate: (d) => d != null })
    const addr = data.address || {}
    return {
      displayName: normalizeAddressText(data.display_name || ''),
      lat: Number(data.lat || lat),
      lon: Number(data.lon || lon),
      address: {
        ...addr,
        country: normalizeRegionName(addr.country ?? ''),
        state: normalizeRegionName(addr.state ?? '')
      }
    }
  } catch {
    throw new Error('逆地址解析服务暂时不可达，请稍后重试')
  }
}
