-- ============================================================
-- 消息推送（Web Push / 浏览器通知）所需数据表与权限
-- 执行方式：Supabase 控制台 → SQL Editor 粘贴全部运行一次
--
-- 前置：app_accounts 表已存在（本项目既有）。
-- VAPID 密钥【不】存在库里，而是配置到 Edge Function 的 Secrets：
--   VAPID_PRIVATE_KEY = <32 字节原始私钥 base64url>
--   VAPID_SUBJECT     = mailto:push@zxs.local
-- 前端 public/index.html 或 .env 配置 VITE_VAPID_PUBLIC_KEY = <未压缩公钥 base64url>
-- ============================================================

-- 管理员判定：app_accounts.role in (superadmin, admin)
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.app_accounts
    where auth_user_id = auth.uid()
      and role in ('superadmin', 'admin')
  );
$$;

-- ---------- 1. 设备订阅表（每个浏览器/设备一条） ----------
create table if not exists public.push_subscriptions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  username    text,
  modules     text[] not null default '{}',   -- 该设备订阅的模块（待办/点位/内容/...）
  subscription jsonb not null,                 -- PushSubscription 对象（endpoint/keys）
  endpoint    text unique not null,            -- 订阅唯一标识
  updated_at  timestamptz not null default now()
);
create index if not exists idx_push_subscriptions_user on public.push_subscriptions(user_id);

alter table public.push_subscriptions enable row level security;

drop policy if exists "push_owner_manage" on public.push_subscriptions;
create policy "push_owner_manage" on public.push_subscriptions
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "push_admin_read" on public.push_subscriptions;
create policy "push_admin_read" on public.push_subscriptions
  for select
  using (public.is_admin());

-- ---------- 2. 站内消息中心（收件箱） ----------
create table if not exists public.notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  title      text not null,
  body       text not null default '',
  module     text,
  url        text,
  sender     text,
  read       boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists idx_notifications_user on public.notifications(user_id, created_at desc);

alter table public.notifications enable row level security;

drop policy if exists "notif_recipient_all" on public.notifications;
create policy "notif_recipient_all" on public.notifications
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "notif_admin_insert" on public.notifications;
create policy "notif_admin_insert" on public.notifications
  for insert
  with check (public.is_admin());

-- ---------- 3. 自动提醒去重日志 ----------
create table if not exists public.push_reminder_log (
  user_id    uuid not null references auth.users(id) on delete cascade,
  ref_type   text not null,
  ref_id     text not null,
  reminded_at timestamptz not null default now(),
  primary key (user_id, ref_type, ref_id)
);
alter table public.push_reminder_log enable row level security;
drop policy if exists "reminder_log_owner" on public.push_reminder_log;
create policy "reminder_log_owner" on public.push_reminder_log
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
