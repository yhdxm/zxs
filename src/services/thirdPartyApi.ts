// 第三方 API 模块数据服务（免费优先）
// 账号隔离：所有读写都按「当前登录账号 id」过滤（与 learnDb.ts 的 uid() 一致）。
// 授权：超管在 ThirdPartyApiView 中调用 setGrant；isGranted 决定该账号能否使用第三方 API。

import { supabase, getSavedUser } from './appDataService'
import { loadSharedFreeApiKeys } from './geoService'

async function uid(): Promise<string> {
  const u = await getSavedUser()
  return u?.id || 'anonymous'
}

export type ApiService = 'weather' | 'map'
export type ApiProvider = 'amap' | 'tianditu' | 'open_meteo' | 'openweather' | 'custom'

/** 各 provider 的展示信息与默认地址（known providers） */
export const PROVIDER_META: Record<ApiProvider, { label: string; url: string; needKey: boolean; services: ApiService[] }> = {
  amap: { label: '高德开放平台（免费 · 天气+地图）', url: 'https://restapi.amap.com', needKey: true, services: ['weather', 'map'] },
  tianditu: { label: '天地图（免费 · 地图底图）', url: 'https://t{s}.tianditu.gov.cn', needKey: true, services: ['map'] },
  open_meteo: { label: 'Open-Meteo（免费 · 天气 · 无需 Key）', url: 'https://api.open-meteo.com', needKey: false, services: ['weather'] },
  openweather: { label: 'OpenWeatherMap（免费档 · 天气 · 需 Key）', url: 'https://api.openweathermap.org', needKey: true, services: ['weather'] },
  custom: { label: '自定义（自由填写地址）', url: '', needKey: false, services: ['weather', 'map'] }
}

export const SERVICE_LABEL: Record<ApiService, string> = {
  weather: '天气',
  map: '地图'
}

export interface ThirdPartyApiConfig {
  id?: string
  user_id: string
  service: ApiService
  provider: ApiProvider
  api_url: string
  api_key: string
  enabled: boolean
  updated_at?: string
}

export interface AccountBasic {
  id: string
  username: string
  nickname: string
  role: string
  disabled: boolean
}

export interface ApiGrantRow {
  id?: string
  grantor_id: string
  grantee_id: string
  service: ApiService | 'all'
  created_at?: string
}

export interface ResolvedApi {
  provider: ApiProvider
  apiKey: string
  apiUrl: string
  /** 是否来自超管共享 Key（否则为本人配置） */
  fromShared: boolean
}

/* ---------------- 本人 API 配置（账号隔离） ---------------- */
async function getMyApi(service: ApiService): Promise<ThirdPartyApiConfig | null> {
  const u = await uid()
  const { data } = await supabase
    .from('third_party_apis')
    .select('*')
    .eq('user_id', u)
    .eq('service', service)
    .maybeSingle()
  return (data as ThirdPartyApiConfig | null) || null
}

export async function listMyApis(): Promise<ThirdPartyApiConfig[]> {
  const u = await uid()
  const { data } = await supabase
    .from('third_party_apis')
    .select('*')
    .eq('user_id', u)
    .order('service', { ascending: true })
  return (data as ThirdPartyApiConfig[] | null) || []
}

export async function upsertMyApi(cfg: {
  service: ApiService
  provider: ApiProvider
  api_url: string
  api_key: string
  enabled: boolean
}): Promise<void> {
  const u = await uid()
  const { error } = await supabase
    .from('third_party_apis')
    .upsert(
      {
        user_id: u,
        service: cfg.service,
        provider: cfg.provider,
        api_url: cfg.api_url,
        api_key: cfg.api_key,
        enabled: cfg.enabled,
        updated_at: new Date().toISOString()
      },
      { onConflict: 'user_id,service' }
    )
  if (error) throw new Error('保存失败：' + error.message)
}

export async function removeMyApi(service: ApiService): Promise<void> {
  const u = await uid()
  const { error } = await supabase.from('third_party_apis').delete().eq('user_id', u).eq('service', service)
  if (error) throw new Error('删除失败：' + error.message)
}

/* ---------------- 授权（超管） ---------------- */
export async function listAllAccountsBasic(): Promise<AccountBasic[]> {
  const { data, error } = await supabase.rpc('list_accounts_basic')
  if (error) throw new Error('读取账号列表失败：' + error.message)
  return ((data || []) as AccountBasic[]) || []
}

export async function listGrants(): Promise<ApiGrantRow[]> {
  const { data } = await supabase.from('api_grants').select('*')
  return (data as ApiGrantRow[] | null) || []
}

export async function setGrant(granteeId: string, service: ApiService, granted: boolean): Promise<void> {
  const grantor = await uid()
  if (granted) {
    const { error } = await supabase
      .from('api_grants')
      .upsert({ grantor_id: grantor, grantee_id: granteeId, service }, { onConflict: 'grantee_id,service' })
    if (error) throw new Error('授权失败：' + error.message)
  } else {
    const { error } = await supabase.from('api_grants').delete().eq('grantee_id', granteeId).eq('service', service)
    if (error) throw new Error('取消授权失败：' + error.message)
  }
}

export async function isGranted(service: ApiService): Promise<boolean> {
  const u = await uid()
  const { data } = await supabase.from('api_grants').select('service').eq('grantee_id', u)
  const rows = (data as { service: string }[] | null) || []
  return rows.some((r) => r.service === 'all' || r.service === service)
}

/* ---------------- 解析：某服务最终使用哪个 API ---------------- */
/**
 * 返回该账号对某服务应使用的第三方 API；返回 null 表示「未授权/未配置」，
 * 调用方应回退到默认保底源（天气→Open-Meteo；地图→OSM）。
 * 优先级：本人配置 > 超管共享 Key > 默认保底。
 */
export async function resolveApi(service: ApiService): Promise<ResolvedApi | null> {
  const granted = await isGranted(service)
  if (!granted) return null

  const mine = await getMyApi(service)
  if (mine && mine.enabled && (mine.api_key || mine.api_url)) {
    return {
      provider: mine.provider,
      apiKey: mine.api_key || '',
      apiUrl: mine.api_url || PROVIDER_META[mine.provider]?.url || '',
      fromShared: false
    }
  }

  // 超管共享 Key：天气用 amap，地图用 tianditu
  const shared = await loadSharedFreeApiKeys()
  const sharedProvider: ApiProvider = service === 'weather' ? 'amap' : 'tianditu'
  const sharedKey = shared[sharedProvider]
  if (sharedKey) {
    return {
      provider: sharedProvider,
      apiKey: sharedKey,
      apiUrl: PROVIDER_META[sharedProvider]?.url || '',
      fromShared: true
    }
  }

  return null
}
