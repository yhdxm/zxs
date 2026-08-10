// 消息推送服务：封装 Web Push 的订阅、退订、按模块更新，以及
// 管理员发消息（调用 Edge Function）、站内消息中心读写、自动提醒。
import { supabase } from '../lib/supabaseClient'

/** 可订阅的业务模块（与后台发送时的 targetModules 对应）。 */
export interface PushModuleOption {
  key: string
  label: string
}
export const PUSH_MODULES: PushModuleOption[] = [
  { key: 'todos', label: '待办' },
  { key: 'points', label: '点位' },
  { key: 'contents', label: '内容' },
  { key: 'ai', label: 'AI助手' },
  { key: 'news', label: '新闻聚合' },
  { key: 'weather', label: '天气' },
  { key: 'map', label: '地图' },
  { key: 'learn', label: '学习中心' },
  { key: 'system', label: '系统通知' }
]

const VAPID_PUBLIC_KEY = (import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined) || ''

export function isPushSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  )
}

export function currentPermission(): NotificationPermission {
  if (!('Notification' in window)) return 'denied'
  return Notification.permission
}

/** URL-safe base64 → Uint8Array（applicationServerKey 需要） */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  const output = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i)
  return output
}

async function registerServiceWorker(): Promise<ServiceWorkerRegistration> {
  const base = import.meta.env.BASE_URL || '/'
  const swUrl = (base.endsWith('/') ? base : base + '/') + 'sw.js'
  const reg = await navigator.serviceWorker.register(swUrl)
  return navigator.serviceWorker.ready
}

async function getCurrentUserId(): Promise<string | null> {
  try {
    const { data } = await supabase.auth.getUser()
    return data.user?.id ?? null
  } catch {
    return null
  }
}

export interface PushSubscriptionRow {
  id: string
  user_id: string
  username: string | null
  modules: string[]
  subscription: Record<string, unknown>
  endpoint: string
  updated_at: string
}

/** 获取当前用户已保存的订阅行 */
export async function getSubscriptionRow(): Promise<PushSubscriptionRow | null> {
  const uid = await getCurrentUserId()
  if (!uid) return null
  const { data, error } = await supabase
    .from('push_subscriptions')
    .select('*')
    .eq('user_id', uid)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return (data as PushSubscriptionRow) || null
}

/** 请求通知权限 */
export async function requestPermission(): Promise<NotificationPermission> {
  if (!('Notification' in window)) return 'denied'
  return Notification.requestPermission()
}

/**
 * 订阅推送并保存到云端，同时记录该设备订阅的模块。
 * @param modules 该设备希望接收的模块 key 列表
 */
export async function subscribe(modules: string[]): Promise<PushSubscriptionRow> {
  if (!isPushSupported()) throw new Error('当前浏览器不支持 Web Push')
  if (!VAPID_PUBLIC_KEY) throw new Error('未配置 VITE_VAPID_PUBLIC_KEY，无法订阅推送')
  const permission = await requestPermission()
  if (permission !== 'granted') throw new Error('未授予通知权限，无法订阅')

  const reg = await registerServiceWorker()
  const sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as BufferSource
  })

  const uid = await getCurrentUserId()
  if (!uid) throw new Error('未登录，无法保存订阅')

  const username = await getCurrentUsername()
  const row = {
    user_id: uid,
    username,
    modules,
    subscription: sub.toJSON(),
    endpoint: sub.endpoint
  }
  const { data, error } = await supabase
    .from('push_subscriptions')
    .upsert(row, { onConflict: 'endpoint' })
    .select()
    .single()
  if (error) throw new Error(error.message)
  return data as PushSubscriptionRow
}

async function getCurrentUsername(): Promise<string | null> {
  const uid = await getCurrentUserId()
  if (!uid) return null
  const { data } = await supabase
    .from('app_accounts')
    .select('username')
    .eq('auth_user_id', uid)
    .maybeSingle()
  return (data?.username as string) || null
}

/**
 * 更新本设备订阅的模块（保留已有订阅，不重新生成端点）。
 */
export async function updateModules(modules: string[]): Promise<PushSubscriptionRow> {
  const reg = await navigator.serviceWorker.ready
  const sub = await reg.pushManager.getSubscription()
  if (!sub) {
    // 尚未订阅则直接订阅
    return subscribe(modules)
  }
  const uid = await getCurrentUserId()
  if (!uid) throw new Error('未登录，无法更新订阅')

  const username = await getCurrentUsername()
  const { data, error } = await supabase
    .from('push_subscriptions')
    .upsert(
      {
        user_id: uid,
        username,
        modules,
        subscription: sub.toJSON(),
        endpoint: sub.endpoint
      },
      { onConflict: 'endpoint' }
    )
    .select()
    .single()
  if (error) throw new Error(error.message)
  return data as PushSubscriptionRow
}

/** 退订：取消浏览器订阅并删除云端记录 */
export async function unsubscribe(): Promise<void> {
  try {
    const reg = await navigator.serviceWorker.ready
    const sub = await reg.pushManager.getSubscription()
    if (sub) {
      const endpoint = sub.endpoint
      await sub.unsubscribe()
      const uid = await getCurrentUserId()
      if (uid) {
        await supabase.from('push_subscriptions').delete().eq('user_id', uid).eq('endpoint', endpoint)
      }
    }
  } catch (err) {
    throw new Error(err instanceof Error ? err.message : '退订失败')
  }
}

export interface AccountOption {
  username: string
  nickname: string | null
  role: string
}

/** 管理员：列出可接收消息的账号（用于指定接收人） */
export async function listTargetUsers(): Promise<AccountOption[]> {
  const { data, error } = await supabase
    .from('app_accounts')
    .select('username, nickname, role')
    .order('username', { ascending: true })
  if (error) throw new Error(error.message)
  return (data as AccountOption[]) || []
}

export type PushTargetType = 'all' | 'modules' | 'users'

export interface SendPushPayload {
  title: string
  body: string
  module?: string
  url?: string
  targetType: PushTargetType
  targetModules?: string[]
  targetUsernames?: string[]
}

/** 管理员：发送一条推送消息（调用 Edge Function，由它完成 Web Push 投递 + 写入站内消息） */
export async function sendMessage(payload: SendPushPayload): Promise<{ sent: number; notified: number }> {
  const { data, error } = await supabase.functions.invoke('send-push', { body: payload })
  if (error) throw new Error(error.message || '发送失败')
  return (data as { sent: number; notified: number }) || { sent: 0, notified: 0 }
}

export interface AppNotification {
  id: string
  user_id: string
  title: string
  body: string
  module: string | null
  url: string | null
  sender: string | null
  read: boolean
  created_at: string
}

/** 读取当前用户的站内消息 */
export async function fetchNotifications(limit = 50): Promise<AppNotification[]> {
  const uid = await getCurrentUserId()
  if (!uid) return []
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', uid)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw new Error(error.message)
  return (data as AppNotification[]) || []
}

export async function unreadCount(): Promise<number> {
  const uid = await getCurrentUserId()
  if (!uid) return 0
  const { count, error } = await supabase
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', uid)
    .eq('read', false)
  if (error) return 0
  return count || 0
}

export async function markRead(id: string): Promise<void> {
  const uid = await getCurrentUserId()
  if (!uid) return
  await supabase.from('notifications').update({ read: true }).eq('id', id).eq('user_id', uid)
}

export async function markAllRead(): Promise<void> {
  const uid = await getCurrentUserId()
  if (!uid) return
  await supabase.from('notifications').update({ read: true }).eq('user_id', uid).eq('read', false)
}

/** 自动提醒：扫描当前用户到期待办/内容并通过 Edge Function 推送（应用打开时由定时器触发） */
export async function autoRemindDue(): Promise<{ reminded: number }> {
  const { data, error } = await supabase.functions.invoke('send-reminders', { body: {} })
  if (error) return { reminded: 0 }
  return (data as { reminded: number }) || { reminded: 0 }
}
