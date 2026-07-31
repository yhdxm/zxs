-- ============================================================
-- Smart Dashboard · 第三方 API 调用统计与配额保护
-- 用途：记录每次第三方 API 调用，实现实时用量统计、配额保护。
-- 用法：在 Supabase 后台 → SQL Editor 粘贴执行本文件（一次性）。
-- 说明：
--   1. 在高德等第三方 API 每次调用后写入 api_usage_logs，按账号隔离。
--   2. third_party_apis 增加 monthly_limit（每月额度，默认 5000）、
--      daily_limit（每日额度，默认 5000）与
--      quota_protection（配额保护开关，默认开启）。
--   3. 当日已用量 = count_api_usage_today()；剩余 < 100 且配额保护开启时，
--      应用层自动禁用该服务并回退到默认保底源。
--   4. 与全站一致：anon 角色可读写，应用层按 user_id 过滤。
-- ============================================================

-- 1. 给 third_party_apis 增加配额字段
alter table third_party_apis
  add column if not exists daily_limit integer not null default 5000,
  add column if not exists monthly_limit integer not null default 5000,
  add column if not exists quota_protection boolean not null default true;

-- 2. 调用日志表（按账号/服务/provider/时间索引）
create table if not exists api_usage_logs (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  provider text not null,
  service text not null,
  endpoint text not null default '',
  status text not null default 'success',
  created_at timestamptz not null default now()
);

-- 索引：按账号+服务+provider+时间快速统计
create index if not exists api_usage_logs_user_service_provider_time_idx
  on api_usage_logs(user_id, service, provider, created_at);

-- 索引：按时间范围查询（用于折线图）
create index if not exists api_usage_logs_time_idx
  on api_usage_logs(created_at);

alter table api_usage_logs enable row level security;
drop policy if exists "api_usage_logs anon rw" on api_usage_logs;
create policy "api_usage_logs anon rw"
  on api_usage_logs for all
  using (true) with check (true);

-- 3. 统计今日调用量（应用层实时计算用）
create or replace function count_api_usage_today(
  p_user_id text,
  p_service text,
  p_provider text
) returns integer
language sql
security definer
set search_path = public
as $$
  select count(*)::integer
  from api_usage_logs
  where user_id = p_user_id
    and service = p_service
    and provider = p_provider
    and created_at >= date_trunc('day', now())
    and created_at < date_trunc('day', now()) + interval '1 day';
$$;

revoke execute on function count_api_usage_today(text, text, text) from public;
grant execute on function count_api_usage_today(text, text, text) to anon;
