-- =============================================
-- Smart Dashboard · 补建缺失表（app_settings / news_daily）
-- 用途：app_settings 存全局角色权限配置；news_daily 存自动化信息生成结果缓存
-- 使用方法：Supabase 控制台 → SQL Editor → 粘贴本文件全部内容 → Run
-- 脚本幂等可重复执行；自带 is_superadmin 定义，可独立运行（无需先跑 rls_secure.sql）
-- =============================================

-- 0. 超级管理员判断函数（与 rls_secure.sql 实现一致，create or replace 幂等）
create or replace function is_superadmin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from app_accounts
    where auth_user_id = auth.uid()
      and role = 'superadmin'
      and (disabled is null or disabled = false)
  );
$$;

-- 1. app_settings：全局键值配置表（角色权限、系统级开关等）
create table if not exists app_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz default now()
);

-- 2. news_daily：每日新闻 / 自动化信息缓存表
create table if not exists news_daily (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  url text,
  source text,
  summary text,
  extra jsonb,
  published_at timestamptz,
  fetched_at timestamptz default now()
);

-- 3. 启用行级安全
alter table app_settings enable row level security;
alter table news_daily enable row level security;

-- 4. 已登录用户可读；仅超管可写
drop policy if exists "app_settings read" on app_settings;
create policy "app_settings read"
  on app_settings for select
  using (auth.role() = 'authenticated');

drop policy if exists "app_settings write" on app_settings;
create policy "app_settings write"
  on app_settings for all
  using (is_superadmin())
  with check (is_superadmin());

drop policy if exists "news_daily read" on news_daily;
create policy "news_daily read"
  on news_daily for select
  using (auth.role() = 'authenticated');

drop policy if exists "news_daily write" on news_daily;
create policy "news_daily write"
  on news_daily for all
  using (is_superadmin())
  with check (is_superadmin());

-- 5. 授权超管函数给已登录用户
grant execute on function is_superadmin() to authenticated;

-- 6. 外键：auth_user_id 关联 auth.users(id)（允许 null，兼容未绑定账号）
--    用 DO block 包裹并吞掉异常，避免 Supabase 权限或孤儿数据导致整脚本中断。
do $$
begin
  if not exists (
    select 1 from information_schema.table_constraints
    where constraint_name = 'fk_accounts_auth_user' and table_name = 'app_accounts'
  ) then
    alter table app_accounts
      add constraint fk_accounts_auth_user
      foreign key (auth_user_id) references auth.users(id);
  end if;
exception when others then
  -- 跳过：权限不足或存在孤儿数据时不影响建表与策略
  null;
end $$;
