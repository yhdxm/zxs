-- =============================================================
-- GAPDESK · 稍后读跨设备同步表（增量迁移，可重复执行）
-- 运行位置：Supabase 控制台 → SQL Editor → 整段粘贴执行
-- 说明：
--   1) localStorage 仍是离线镜像；登录后以本表为准，PC / 移动端共用同一份稍后读队列；
--   2) user_id 必须是 Supabase Auth 的 uid 文本（auth.uid()::text），
--      不是 app_accounts 的业务 id；前端 resolveUserId() 已按此返回；
--   3) 未登录不写表，行为留在浏览器本地，不受影响。
-- =============================================================

create table if not exists public.gap_later (
  user_id    text not null,
  event_id   bigint not null references public.gap_events (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, event_id)
);

create index if not exists gap_later_user_created_idx
  on public.gap_later (user_id, created_at desc);

-- 显式授权（幂等）：登录用户可增删改查自己的行；service_role 全权。
grant select, insert, update, delete on public.gap_later to authenticated;
grant all on public.gap_later to service_role;

alter table public.gap_later enable row level security;

drop policy if exists gap_later_self on public.gap_later;
create policy gap_later_self on public.gap_later for all to authenticated
  using (auth.uid()::text = user_id)
  with check (auth.uid()::text = user_id);
