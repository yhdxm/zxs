-- =============================================
-- Smart Dashboard 数据库初始化脚本
-- 使用方法：Supabase 控制台 → SQL Editor → 粘贴本文件全部内容 → Run
-- 脚本可重复执行（幂等），不会破坏已有数据
-- =============================================

-- 1. 账号表：用户名 + 密码哈希登录
create table if not exists app_accounts (
  id text primary key,
  username text not null unique,
  -- 已废弃：登录已切换至 Supabase Auth（auth.users），此列仅保留以兼容历史数据，不再参与校验
  password_hash text,
  nickname text,
  -- 角色：superadmin 超级管理员 / admin 管理员 / user 普通用户
  role text default 'user',
  -- 是否禁用：true 禁止登录
  disabled boolean default false,
  -- 创建者 user_id，后台手动创建时记录
  created_by text,
  created_at timestamptz default now(),
  -- 关联 Supabase Auth 用户（auth.users.id），用于 RLS 按本人隔离
  auth_user_id uuid
);

-- 1.1 权限字段（幂等，兼容旧库）
alter table app_accounts add column if not exists role text default 'user';
alter table app_accounts add column if not exists disabled boolean default false;
alter table app_accounts add column if not exists created_by text;

-- 1.2 默认超级管理员
-- 安全约定：不再在 SQL 中写死弱口令（原 admin/admin123 已移除）。
-- 默认管理员改由应用首次运行时通过 initDefaultAdmin() 创建，
-- 密码取自环境变量 VITE_ADMIN_DEFAULT_PASSWORD；未配置则随机生成并打印到控制台，请登录后立即修改。
-- 如需纯 SQL 预置，请在此处自行 INSERT 一个强密码哈希（SHA-256，与应用 hashPassword 算法一致）。

-- 2. 用户资料表
create table if not exists profiles (
  user_id text primary key,
  nickname text,
  created_at timestamptz default now()
);

-- 2.1 账号级 AI 配置（登录后跨设备自动带出，幂等可重复执行）
alter table profiles add column if not exists ai_config jsonb;

-- 3. 工作台数据表（待办/点位/内容整体存 payload）
create table if not exists app_dashboard_data (
  user_id text primary key,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz default now()
);

-- 3.1 全局键值配置表（角色权限、系统级开关等）
create table if not exists app_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz default now()
);

-- 3.2 每日新闻 / 自动化信息缓存表
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

-- 4. 启用行级安全
alter table app_accounts enable row level security;
alter table app_dashboard_data enable row level security;
alter table profiles enable row level security;
alter table app_settings enable row level security;
alter table news_daily enable row level security;

-- 5. 行级安全策略（仅本人可访问，根治「全网可读写」）
--    本脚本已切换到 Supabase Auth 模型：auth_user_id 关联 auth.users(id)，
--    普通 anon key 不再持有全表访问权。管理员能力由 rls_secure.sql 的
--    SECURITY DEFINER 函数提供。Postgres 不支持 create policy if not exists，先删后建保证幂等。
drop policy if exists "Allow anonymous access to accounts" on app_accounts;
drop policy if exists "accounts self access" on app_accounts;
create policy "accounts self access"
  on app_accounts
  for all
  using (auth.uid() = auth_user_id)
  with check (auth.uid() = auth_user_id);

drop policy if exists "Allow anonymous access to dashboard" on app_dashboard_data;
drop policy if exists "dashboard self access" on app_dashboard_data;
create policy "dashboard self access"
  on app_dashboard_data
  for all
  using (auth.uid()::text = user_id)
  with check (auth.uid()::text = user_id);

drop policy if exists "Allow anonymous access to profiles" on profiles;
drop policy if exists "profiles self access" on profiles;
create policy "profiles self access"
  on profiles
  for all
  using (auth.uid()::text = user_id)
  with check (auth.uid()::text = user_id);

-- 5.1 缺失表的读策略：已登录用户可读（写策略由 rls_secure.sql / schema_missing.sql 提供，依赖 is_superadmin）
drop policy if exists "app_settings read" on app_settings;
create policy "app_settings read"
  on app_settings for select
  using (auth.role() = 'authenticated');

drop policy if exists "news_daily read" on news_daily;
create policy "news_daily read"
  on news_daily for select
  using (auth.role() = 'authenticated');

-- 6. 启用实时同步（跨 PC / 移动端实时推送变更，实现数据自动同步）
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'app_dashboard_data'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE app_dashboard_data;
  END IF;
END $$;

-- 7. 完成后可在项目根目录运行 npm run verify:supabase 验证三张表均为 OK
