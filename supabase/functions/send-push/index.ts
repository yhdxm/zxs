// Edge Function: send-push
// 管理员发送一条消息推送：解析目标设备订阅 → 通过 Web Push 投递到手机/浏览器 → 写入站内消息中心。
// 部署：supabase functions deploy send-push
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

    // 仅管理员可群发
    const { data: acct } = await supabase
      .from("app_accounts")
      .select("role")
      .eq("auth_user_id", user.id)
      .maybeSingle()
    const isAdmin = acct && ["superadmin", "admin"].includes(acct.role)
    if (!isAdmin) return json({ error: "无权限发送消息" }, 403)

    const vapidPublic = Deno.env.get("VAPID_PUBLIC_KEY")
    const vapidPrivate = Deno.env.get("VAPID_PRIVATE_KEY")
    const vapidSubject = Deno.env.get("VAPID_SUBJECT") || "mailto:push@zxs.local"
    if (!vapidPublic || !vapidPrivate) {
      return json({ error: "服务端未配置 VAPID 密钥" }, 500)
    }
    webpush.setVapidDetails(vapidSubject, vapidPublic, vapidPrivate)

    const body = await req.json()
    const title = String(body.title || "").trim()
    const message = String(body.body || "").trim()
    const module = body.module ? String(body.module) : null
    const url = body.url ? String(body.url) : "/"
    const targetType = body.targetType || "all"
    const targetModules = Array.isArray(body.targetModules) ? body.targetModules : []
    const targetUsernames = Array.isArray(body.targetUsernames) ? body.targetUsernames : []

    if (!title) return json({ error: "标题不能为空" }, 400)

    // 解析目标订阅
    let query = supabase.from("push_subscriptions").select("*")
    if (targetType === "modules" && targetModules.length) {
      query = query.overlaps("modules", targetModules)
    } else if (targetType === "users" && targetUsernames.length) {
      query = query.in("username", targetUsernames)
    }
    const { data: subs, error: subErr } = await query
    if (subErr) return json({ error: subErr.message }, 500)

    let sent = 0
    const notifRows: unknown[] = []
    const payload = JSON.stringify({
      title,
      body: message,
      module,
      url,
      tag: (module || "zxs") + ":" + Date.now(),
    })

    for (const s of subs || []) {
      try {
        await webpush.sendNotification(s.subscription as webpush.PushSubscription, payload, {
          TTL: 60 * 60 * 24,
        })
        sent++
        notifRows.push({
          user_id: s.user_id,
          title,
          body: message,
          module,
          url,
          sender: user.email || user.id,
          read: false,
        })
      } catch (e) {
        const code = (e as { statusCode?: number }).statusCode
        // 订阅已失效（注销/卸载）：清理
        if (code === 410 || code === 404) {
          await supabase.from("push_subscriptions").delete().eq("endpoint", s.endpoint)
        }
      }
    }

    if (notifRows.length) {
      await supabase.from("notifications").insert(notifRows as never)
    }

    return json({ sent, notified: notifRows.length })
  } catch (e) {
    return json({ error: String(e) }, 500)
  }
})
