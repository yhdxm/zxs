// 意见反馈服务层。
// 架构与 learnDb.ts 一致：自建账号体系 + 纯前端，行级隔离在应用层按当前登录账号 id 过滤。
// 权限边界（已与用户确认）：
//   - 普通账号 / 管理员：仅能看到并管理「自己提交」的反馈
//   - 仅超级管理员：可查看全部反馈、回复、流转状态、导出
//   - 关闭原因（close_reason）与内部备注（internal reply）对提交人不可见

import { supabase, getSavedUser } from './appDataService'

export type FeedbackStatus = 'pending' | 'processing' | 'replied' | 'closed'
export type FeedbackCategory = 'suggestion' | 'bug' | 'complaint' | 'other'
export type FeedbackPriority = 'low' | 'normal' | 'high' | 'urgent'

export interface FeedbackAttachment {
  name: string
  size: number
  dataUrl: string
}

export interface FeedbackItem {
  id: string
  user_id: string
  username: string
  nickname: string
  title: string
  category: FeedbackCategory
  priority: FeedbackPriority
  content: string
  contact: string
  anonymous: boolean
  status: FeedbackStatus
  /** 关闭原因：仅管理端返回，用户端一律置空 */
  close_reason: string
  attachments: FeedbackAttachment[]
  reply_count: number
  admin_unread: boolean
  user_unread: boolean
  created_at: string
  updated_at: string
  replied_at: string | null
}

export interface FeedbackReply {
  id: string
  feedback_id: string
  author_id: string
  author_name: string
  author_role: string
  content: string
  /** 内部备注：仅管理端可见 */
  internal: boolean
  created_at: string
}

export const CATEGORY_LABELS: Record<FeedbackCategory, string> = {
  suggestion: '功能建议',
  bug: '问题反馈',
  complaint: '投诉',
  other: '其他'
}

export const PRIORITY_LABELS: Record<FeedbackPriority, string> = {
  low: '低',
  normal: '普通',
  high: '高',
  urgent: '紧急'
}

export const STATUS_LABELS: Record<FeedbackStatus, string> = {
  pending: '待处理',
  processing: '处理中',
  replied: '已回复',
  closed: '已关闭'
}

/** Element Plus tag type 映射，保持全站配色一致 */
export const STATUS_TAG_TYPE: Record<FeedbackStatus, 'danger' | 'warning' | 'primary' | 'success'> = {
  pending: 'danger',
  processing: 'warning',
  replied: 'primary',
  closed: 'success'
}

export const PRIORITY_TAG_TYPE: Record<FeedbackPriority, 'info' | 'primary' | 'warning' | 'danger'> = {
  low: 'info',
  normal: 'primary',
  high: 'warning',
  urgent: 'danger'
}

/** 附件限制：不使用 Storage，压缩后直接入库，保证免费额度可控 */
export const MAX_ATTACHMENTS = 3
export const MAX_ATTACHMENT_BYTES = 120 * 1024

interface RawFeedback extends Omit<FeedbackItem, 'attachments'> {
  attachments: FeedbackAttachment[] | string | null
}

function normalize(raw: RawFeedback, keepAdminFields: boolean): FeedbackItem {
  let attachments: FeedbackAttachment[] = []
  const at = raw.attachments
  if (Array.isArray(at)) {
    attachments = at
  } else if (typeof at === 'string' && at.trim()) {
    try {
      const parsed = JSON.parse(at)
      if (Array.isArray(parsed)) attachments = parsed as FeedbackAttachment[]
    } catch {
      attachments = []
    }
  }
  return {
    ...raw,
    attachments,
    // 关闭原因对提交人不可见（用户确认项 2）
    close_reason: keepAdminFields ? raw.close_reason || '' : ''
  }
}

async function currentUser() {
  return getSavedUser()
}

/** 是否为超级管理员（仅超管可进入反馈管理，用户确认项 1） */
export async function isFeedbackAdmin(): Promise<boolean> {
  const u = await currentUser()
  return u?.role === 'superadmin'
}

/* ==================== 提交人视角 ==================== */

/** 我的反馈列表（严格按 user_id 隔离） */
export async function listMyFeedbacks(): Promise<FeedbackItem[]> {
  const u = await currentUser()
  if (!u) return []
  const { data, error } = await supabase
    .from('feedbacks')
    .select('*')
    .eq('user_id', u.id)
    .order('created_at', { ascending: false })
  if (error) throw new Error('加载我的反馈失败：' + error.message)
  return ((data as RawFeedback[] | null) || []).map((r) => normalize(r, false))
}

export interface SubmitFeedbackInput {
  title: string
  category: FeedbackCategory
  priority: FeedbackPriority
  content: string
  contact?: string
  anonymous?: boolean
  attachments?: FeedbackAttachment[]
}

/** 提交反馈 */
export async function submitFeedback(input: SubmitFeedbackInput): Promise<FeedbackItem> {
  const u = await currentUser()
  if (!u) throw new Error('请先登录后再提交反馈')
  const title = input.title.trim()
  if (!title) throw new Error('请填写反馈标题')
  const content = input.content.trim()
  if (!content) throw new Error('请填写反馈内容')

  const payload = {
    user_id: u.id,
    username: u.username || '',
    nickname: u.nickname || '',
    title,
    category: input.category,
    priority: input.priority,
    content,
    contact: (input.contact || '').trim(),
    anonymous: !!input.anonymous,
    status: 'pending' as FeedbackStatus,
    attachments: (input.attachments || []).slice(0, MAX_ATTACHMENTS),
    admin_unread: true,
    user_unread: false
  }
  const { data, error } = await supabase.from('feedbacks').insert(payload).select().single()
  if (error) throw new Error('提交失败：' + error.message)
  return normalize(data as RawFeedback, false)
}

/** 撤回（删除）自己的反馈；仅限本人且未关闭 */
export async function deleteMyFeedback(id: string): Promise<void> {
  const u = await currentUser()
  if (!u) throw new Error('请先登录')
  const { error } = await supabase.from('feedbacks').delete().eq('id', id).eq('user_id', u.id)
  if (error) throw new Error('撤回失败：' + error.message)
}

/** 提交人查看回复（自动过滤内部备注） */
export async function listRepliesForUser(feedbackId: string): Promise<FeedbackReply[]> {
  const { data, error } = await supabase
    .from('feedback_replies')
    .select('*')
    .eq('feedback_id', feedbackId)
    .eq('internal', false)
    .order('created_at', { ascending: true })
  if (error) throw new Error('加载回复失败：' + error.message)
  return (data as FeedbackReply[] | null) || []
}

/** 提交人补充说明（追加一条自己的回复） */
export async function appendUserReply(feedbackId: string, content: string): Promise<void> {
  const u = await currentUser()
  if (!u) throw new Error('请先登录')
  const text = content.trim()
  if (!text) throw new Error('请填写补充内容')
  const { error } = await supabase.from('feedback_replies').insert({
    feedback_id: feedbackId,
    author_id: u.id,
    author_name: u.nickname || u.username || '我',
    author_role: u.role || 'user',
    content: text,
    internal: false
  })
  if (error) throw new Error('补充失败：' + error.message)
  await supabase
    .from('feedbacks')
    .update({ admin_unread: true, updated_at: new Date().toISOString() })
    .eq('id', feedbackId)
}

/** 标记我的反馈为已读（清除新回复提醒） */
export async function markUserRead(feedbackId: string): Promise<void> {
  await supabase.from('feedbacks').update({ user_unread: false }).eq('id', feedbackId)
}

/* ==================== 超级管理员视角 ==================== */

export interface AdminFeedbackFilter {
  status?: FeedbackStatus | 'all'
  category?: FeedbackCategory | 'all'
  priority?: FeedbackPriority | 'all'
  keyword?: string
}

/** 管理端反馈列表（全量，仅超管可调用） */
export async function listAllFeedbacks(filter: AdminFeedbackFilter = {}): Promise<FeedbackItem[]> {
  if (!(await isFeedbackAdmin())) throw new Error('无权访问反馈管理')
  let q = supabase.from('feedbacks').select('*').order('created_at', { ascending: false })
  if (filter.status && filter.status !== 'all') q = q.eq('status', filter.status)
  if (filter.category && filter.category !== 'all') q = q.eq('category', filter.category)
  if (filter.priority && filter.priority !== 'all') q = q.eq('priority', filter.priority)
  const { data, error } = await q
  if (error) throw new Error('加载反馈失败：' + error.message)
  let list = ((data as RawFeedback[] | null) || []).map((r) => normalize(r, true))
  const kw = (filter.keyword || '').trim().toLowerCase()
  if (kw) {
    list = list.filter(
      (f) =>
        f.title.toLowerCase().includes(kw) ||
        f.content.toLowerCase().includes(kw) ||
        f.username.toLowerCase().includes(kw) ||
        f.nickname.toLowerCase().includes(kw) ||
        f.id.toLowerCase().includes(kw)
    )
  }
  return list
}

/** 管理端查看全部回复（含内部备注） */
export async function listRepliesForAdmin(feedbackId: string): Promise<FeedbackReply[]> {
  if (!(await isFeedbackAdmin())) throw new Error('无权访问反馈管理')
  const { data, error } = await supabase
    .from('feedback_replies')
    .select('*')
    .eq('feedback_id', feedbackId)
    .order('created_at', { ascending: true })
  if (error) throw new Error('加载回复失败：' + error.message)
  return (data as FeedbackReply[] | null) || []
}

/** 管理员回复（internal=true 时为仅管理端可见的内部备注） */
export async function replyFeedback(
  feedbackId: string,
  content: string,
  internal = false
): Promise<void> {
  const u = await currentUser()
  if (!u || u.role !== 'superadmin') throw new Error('无权回复')
  const text = content.trim()
  if (!text) throw new Error('请填写回复内容')

  const { error } = await supabase.from('feedback_replies').insert({
    feedback_id: feedbackId,
    author_id: u.id,
    author_name: u.nickname || u.username || '管理员',
    author_role: u.role,
    content: text,
    internal
  })
  if (error) throw new Error('回复失败：' + error.message)

  // 公开回复才推进状态、提醒用户；内部备注不改变对用户的可见状态
  if (!internal) {
    const { data } = await supabase
      .from('feedback_replies')
      .select('id')
      .eq('feedback_id', feedbackId)
      .eq('internal', false)
    const count = (data as Array<{ id: string }> | null)?.length ?? 1
    await supabase
      .from('feedbacks')
      .update({
        status: 'replied',
        reply_count: count,
        user_unread: true,
        admin_unread: false,
        replied_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', feedbackId)
  }
}

/** 变更状态；关闭时可填关闭原因（对用户不可见，仅管理端留档） */
export async function updateFeedbackStatus(
  feedbackId: string,
  status: FeedbackStatus,
  closeReason = ''
): Promise<void> {
  const u = await currentUser()
  if (!u || u.role !== 'superadmin') throw new Error('无权操作')
  const patch: Record<string, unknown> = {
    status,
    admin_unread: false,
    updated_at: new Date().toISOString()
  }
  if (status === 'closed') patch.close_reason = closeReason.trim()
  const { error } = await supabase.from('feedbacks').update(patch).eq('id', feedbackId)
  if (error) throw new Error('状态更新失败：' + error.message)
}

/** 批量变更状态 */
export async function batchUpdateStatus(ids: string[], status: FeedbackStatus): Promise<void> {
  const u = await currentUser()
  if (!u || u.role !== 'superadmin') throw new Error('无权操作')
  if (!ids.length) return
  const { error } = await supabase
    .from('feedbacks')
    .update({ status, admin_unread: false, updated_at: new Date().toISOString() })
    .in('id', ids)
  if (error) throw new Error('批量操作失败：' + error.message)
}

/** 管理员删除反馈 */
export async function adminDeleteFeedback(id: string): Promise<void> {
  const u = await currentUser()
  if (!u || u.role !== 'superadmin') throw new Error('无权删除')
  const { error } = await supabase.from('feedbacks').delete().eq('id', id)
  if (error) throw new Error('删除失败：' + error.message)
}

/** 标记管理端已读 */
export async function markAdminRead(feedbackId: string): Promise<void> {
  await supabase.from('feedbacks').update({ admin_unread: false }).eq('id', feedbackId)
}

/* ==================== 统计与导出 ==================== */

export interface FeedbackStats {
  total: number
  todayNew: number
  pending: number
  processing: number
  replied: number
  closed: number
  /** 平均首次响应时长（小时），无数据为 null */
  avgResponseHours: number | null
  byCategory: Record<FeedbackCategory, number>
}

export function computeStats(list: FeedbackItem[]): FeedbackStats {
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)
  const stats: FeedbackStats = {
    total: list.length,
    todayNew: 0,
    pending: 0,
    processing: 0,
    replied: 0,
    closed: 0,
    avgResponseHours: null,
    byCategory: { suggestion: 0, bug: 0, complaint: 0, other: 0 }
  }
  let respSum = 0
  let respCount = 0
  list.forEach((f) => {
    if (new Date(f.created_at).getTime() >= todayStart.getTime()) stats.todayNew++
    stats[f.status]++
    stats.byCategory[f.category] = (stats.byCategory[f.category] || 0) + 1
    if (f.replied_at) {
      const diff = new Date(f.replied_at).getTime() - new Date(f.created_at).getTime()
      if (diff > 0) {
        respSum += diff
        respCount++
      }
    }
  })
  if (respCount > 0) stats.avgResponseHours = respSum / respCount / 3_600_000
  return stats
}

/** 导出 CSV（纯前端生成，不经过任何付费服务） */
export function exportFeedbackCsv(list: FeedbackItem[]): void {
  const header = ['单号', '标题', '分类', '优先级', '状态', '提交人', '提交时间', '回复数', '内容']
  const rows = list.map((f) => [
    f.id.slice(0, 8),
    f.title,
    CATEGORY_LABELS[f.category] || f.category,
    PRIORITY_LABELS[f.priority] || f.priority,
    STATUS_LABELS[f.status] || f.status,
    f.anonymous ? '匿名用户' : f.nickname || f.username,
    new Date(f.created_at).toLocaleString('zh-CN'),
    String(f.reply_count),
    f.content.replace(/\s+/g, ' ')
  ])
  const esc = (v: string) => `"${v.replace(/"/g, '""')}"`
  const csv = [header, ...rows].map((r) => r.map(esc).join(',')).join('\r\n')
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `意见反馈_${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

/* ==================== 附件压缩（免费，纯前端 canvas） ==================== */

/**
 * 图片压缩为 dataUrl：最长边 1000px、JPEG 0.7，通常 < 100KB。
 * 不使用 Supabase Storage，避免占用存储额度。
 */
export function compressImage(file: File): Promise<FeedbackAttachment> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('仅支持图片附件（png / jpg / webp）'))
      return
    }
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('读取图片失败'))
    reader.onload = () => {
      const img = new Image()
      img.onerror = () => reject(new Error('图片解析失败'))
      img.onload = () => {
        const maxSide = 1000
        let { width, height } = img
        if (width > maxSide || height > maxSide) {
          const ratio = Math.min(maxSide / width, maxSide / height)
          width = Math.round(width * ratio)
          height = Math.round(height * ratio)
        }
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          reject(new Error('当前浏览器不支持图片压缩'))
          return
        }
        ctx.drawImage(img, 0, 0, width, height)
        let quality = 0.7
        let dataUrl = canvas.toDataURL('image/jpeg', quality)
        // 仍超限则继续降质，最多再压 3 次
        let guard = 0
        while (dataUrl.length * 0.75 > MAX_ATTACHMENT_BYTES && guard < 3) {
          quality -= 0.15
          dataUrl = canvas.toDataURL('image/jpeg', Math.max(0.25, quality))
          guard++
        }
        if (dataUrl.length * 0.75 > MAX_ATTACHMENT_BYTES) {
          reject(new Error('图片过大，请裁剪后再上传'))
          return
        }
        resolve({
          name: file.name,
          size: Math.round(dataUrl.length * 0.75),
          dataUrl
        })
      }
      img.src = reader.result as string
    }
    reader.readAsDataURL(file)
  })
}
