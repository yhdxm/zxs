// Edge Function: send-reminders
// 自动提醒：扫描当前登录用户「到期待办 / 到期内容」，向该用户自己的订阅设备推送并写入站内消息。
// 触发方式：
//   1) 前端定时器（应用打开时）调用 supabase.functions.invoke('send-reminders')
//   2) 服务端后台（应用关闭也能推）：pg_cron 周期调用此函数（需以 service_role 携带用户 JWT，见脚本说明）
// 需配置 Secrets：VAPID_PUBLIC_KEY、VAPID_PRIVATE_KEY、VAPID_SUBJECT
import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "jsr:@supabase/supabase-js@2"
import webpush from "npm:web-push"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}

function json(body: unknown, status = 200, headers = corsHeaders) {
  return new Response(JSON.stringify(body), { status, headers: { ...headers, "Content-Type": "application/json" } })
}

// 距现在 ±窗口内的待办视为“待提醒”：未来 24h 内到期，且不过期超过 3 天
const WINDOW_AHEAD_MS = 24 * 3600 * 1000
const WINDOW_BEHIND_MS = 3 * 24 * 3600 * 1000

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders })
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!
    const authHeader = req.headers.get("Authorization") ?? ""
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    })

    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser()
    if (userErr || !user) return json({ error: "未登录" }, 401)

    const vapidPublic = Deno.env.get("VAPID_PUBLIC_KEY")
    const vapidPrivate = Deno.env.get("VAPID_PRIVATE_KEY")
    const vapidSubject = Deno.env.get("VAPID_SUBJECT") || "mailto:push@zxs.local"
    if (!vapidPublic || !vapidPrivate) {
      return json({ error: "服务端未配置 VAPID 密钥" }, 500)
    }
    webpush.setVapidDetails(vapidSubject, vapidPublic, vapidPrivate)

    // 该用户的所有订阅设备
    const { data: subs } = await supabase
      .from("push_subscriptions")
      .select("*")
      .eq("user_id", user.id)
    if (!subs || !subs.length) return json({ reminded: 0 })

    // 读取工作台数据（todos / contents）
    const { data: dash } = await supabase
      .from("app_dashboard_data")
      .select("payload")
      .eq("user_id", user.id)
      .maybeSingle()
    const todos: any[] = (dash?.payload as any)?.todos || []
    const now = Date.now()

    const due = todos.filter((t) => {
      if (!t || t.status === "done" || !t.date) return false
      const ts = new Date(t.date).getTime()
      return ts <= now + WINDOW_AHEAD_MS && ts >= now - WINDOW_BEHIND_MS
    })

    // 去重：已提醒过的不再重复
    const { data: log } = await supabase
      .from("push_reminder_log")
      .select("ref_id")
      .eq("user_id", user.id)
    const logged = new Set((log || []).map((l: { ref_id: string }) => l.ref_id))
    const toRemind = due.filter((t) => !logged.has(t.id))

    let reminded = 0
    for (const t of toRemind) {
      const payload = JSON.stringify({
        title: "待办提醒",
        body: t.title || "你有一条待办快到时间了",
        module: "todos",
        url: "/dashboard?view=todos",
        tag: "remind:" + t.id,
      })
      for (const s of subs) {
        try {
          await webpush.sendNotification(s.subscription as webpush.PushSubscription, payload, {
            TTL: 60 * 60 * 12,
          })
        } catch {
          // 忽略单设备失败
        }
      }
      await supabase.from("notifications").insert({
        user_id: user.id,
        title: "待办提醒",
        body: t.title || "你有一条待办快到时间了",
        module: "todos",
        url: "/dashboard?view=todos",
        sender: "系统",
        read: false,
      })
      await supabase.from("push_reminder_log").insert({
        user_id: user.id,
        ref_type: "todo",
        ref_id: t.id,
      })
      reminded++
    }

    return json({ reminded })
  } catch (e) {
    return json({ error: String(e) }, 500)
  }
})
