--- Smart Dashboard（ZXS）· 共享免费 API Key 表
--- 用途：超管统一配置天地图、天行数据等免费 Key，所有登录账号共享使用。
---       天气使用 Open-Meteo 无需 Key，也预留字段以便未来扩展。
--- 说明：本脚本幂等可重复执行；依赖 is_superadmin() 函数（已由 rls_secure.sql 创建）。
--- ============================================================

--- 0. 超级管理员判断函数（独立可运行，与 rls_secure.sql 实现一致）
create or replace function is_superadmin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.app_accounts
    where auth_user_id = auth.uid()
      and role = 'superadmin'
      and (disabled is null or disabled = false)
  );
$$;

--- 1. 共享免费 API Key 表
create table if not exists shared_free_api_keys (
  provider    text primary key,
  key_value   text not null default '',
  updated_at  timestamptz not null default now(),
  updated_by  uuid references auth.users(id) on delete set null
);

--- 2. 默认行：天地图 / 天行数据 / 天气（天气当前无需 Key，key_value 为空即可）
insert into shared_free_api_keys (provider, key_value) values
  ('tianditu', ''),
  ('tianxing', ''),
  ('weather', '')
on conflict (provider) do nothing;

--- 3. RLS：所有已登录用户可读，仅超管可写
alter table shared_free_api_keys enable row level security;

drop policy if exists "shared_free_api_keys read" on shared_free_api_keys;
create policy "shared_free_api_keys read"
  on shared_free_api_keys
  for select
  to authenticated
  using (true);

drop policy if exists "shared_free_api_keys write" on shared_free_api_keys;
create policy "shared_free_api_keys write"
  on shared_free_api_keys
  for all
  to authenticated
  using (is_superadmin())
  with check (is_superadmin());

--- 4. 授权（撤销 public 默认执行权，避免匿名可调用）
revoke execute on function is_superadmin() from public;
grant execute on function is_superadmin() to authenticated;
