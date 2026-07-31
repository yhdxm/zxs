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
  daily_limit: number
  monthly_limit: number
  quota_protection: boolean
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
  daily_limit?: number
  monthly_limit?: number
  quota_protection?: boolean
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
        daily_limit: cfg.daily_limit ?? 5000,
        monthly_limit: cfg.monthly_limit ?? 5000,
        quota_protection: cfg.quota_protection ?? true,
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

/* ---------------- 调用日志与配额保护 ---------------- */

export interface ApiUsageLog {
  id?: string
  user_id: string
  service: ApiService
  provider: ApiProvider
  endpoint: string
  status: 'success' | 'error'
  created_at?: string
}

/** 记录一次第三方 API 调用 */
export async function logApiUsage(params: {
  service: ApiService
  provider: ApiProvider
  endpoint?: string
  status?: 'success' | 'error'
}): Promise<void> {
  const u = await uid()
  const { error } = await supabase.from('api_usage_logs').insert({
    user_id: u,
    service: params.service,
    provider: params.provider,
    endpoint: params.endpoint || '',
    status: params.status || 'success'
  })
  if (error) console.warn('[logApiUsage] 写入调用日志失败', error)
}

/** 查询今日调用量 */
export async function countApiUsageToday(service: ApiService, provider: ApiProvider): Promise<number> {
  const u = await uid()
  try {
    const { data, error } = await supabase.rpc('count_api_usage_today', {
      p_user_id: u,
      p_service: service,
      p_provider: provider
    })
    if (error) throw error
    return Number(data) || 0
  } catch (e) {
    // RPC 不存在时降级：前端按当天 00:00 至今直接计数
    console.warn('[countApiUsageToday] RPC 失败，降级前端计数', e)
    const start = new Date()
    start.setHours(0, 0, 0, 0)
    const { count, error: err2 } = await supabase
      .from('api_usage_logs')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', u)
      .eq('service', service)
      .eq('provider', provider)
      .eq('status', 'success')
      .gte('created_at', start.toISOString())
    if (err2) throw err2
    return Number(count) || 0
  }
}

/** 查询本月调用量 */
export async function countApiUsageThisMonth(service: ApiService, provider: ApiProvider): Promise<number> {
  const u = await uid()
  const start = new Date()
  start.setDate(1)
  start.setHours(0, 0, 0, 0)
  const { count, error } = await supabase
    .from('api_usage_logs')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', u)
    .eq('service', service)
    .eq('provider', provider)
    .eq('status', 'success')
    .gte('created_at', start.toISOString())
  if (error) throw error
  return Number(count) || 0
}

/** 查询最近一段时间内的调用日志（用于折线图） */
export async function listApiUsageLogs(params: {
  service: ApiService
  provider: ApiProvider
  from: string
  to: string
}): Promise<ApiUsageLog[]> {
  const u = await uid()
  const { data, error } = await supabase
    .from('api_usage_logs')
    .select('*')
    .eq('user_id', u)
    .eq('service', params.service)
    .eq('provider', params.provider)
    .gte('created_at', params.from)
    .lte('created_at', params.to)
    .order('created_at', { ascending: true })
  if (error) throw new Error('读取调用日志失败：' + error.message)
  return (data as ApiUsageLog[] | null) || []
}

/** 禁用某项第三方 API 服务（配额不足时由系统自动调用） */
export async function disableMyApi(service: ApiService): Promise<void> {
  const u = await uid()
  const { error } = await supabase
    .from('third_party_apis')
    .update({ enabled: false, updated_at: new Date().toISOString() })
    .eq('user_id', u)
    .eq('service', service)
  if (error) throw new Error('自动禁用服务失败：' + error.message)
}

const QUOTA_THRESHOLD = 100

/* ---------------- 解析：某服务最终使用哪个 API ---------------- */
/**
 * 返回该账号对某服务应使用的第三方 API；返回 null 表示「未授权/未配置」，
 * 调用方应回退到默认保底源（天气→Open-Meteo；地图→OSM）。
 * 优先级：本人配置 > 超管共享 Key > 默认保底。
 */
export async function resolveApi(
  service: ApiService
): Promise<{ api: ResolvedApi | null; disabledReason?: string }> {
  const granted = await isGranted(service)
  if (!granted) return { api: null, disabledReason: '当前账号未获得第三方 API 使用授权' }

  const mine = await getMyApi(service)
  if (mine && mine.enabled && (mine.api_key || mine.api_url)) {
    // 配额保护：高德 Key 在剩余 < 100 时自动禁用并回退默认源
    if (mine.provider === 'amap' && mine.quota_protection) {
      try {
        const used = await countApiUsageToday(service, mine.provider)
        const dailyLimit = Number(mine.daily_limit) || 5000
        const remaining = dailyLimit - used
        if (remaining < QUOTA_THRESHOLD) {
          await disableMyApi(service)
          return {
            api: null,
            disabledReason: `配额保护：今日已用 ${used} 次，日额度 ${dailyLimit}，剩余 ${remaining} 次（< 100），高德已自动禁用`
          }
        }
      } catch (e) {
        console.warn('[resolveApi] 配额检查失败，继续允许调用', e)
      }
    }
    return {
      api: {
        provider: mine.provider,
        apiKey: mine.api_key || '',
        apiUrl: mine.api_url || PROVIDER_META[mine.provider]?.url || '',
        fromShared: false
      }
    }
  }

  // 超管共享 Key：天气用 amap，地图用 tianditu
  const shared = await loadSharedFreeApiKeys()
  const sharedProvider: ApiProvider = service === 'weather' ? 'amap' : 'tianditu'
  const sharedKey = shared[sharedProvider]
  if (sharedKey) {
    return {
      api: {
        provider: sharedProvider,
        apiKey: sharedKey,
        apiUrl: PROVIDER_META[sharedProvider]?.url || '',
        fromShared: true
      }
    }
  }

  return { api: null, disabledReason: '未配置高德 Key，将使用 Open-Meteo 默认源' }
}
