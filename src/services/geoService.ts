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

function timeoutFetch(url: string): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT)
  return fetch(url, { signal: controller.signal }).finally(() => clearTimeout(timer))
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
