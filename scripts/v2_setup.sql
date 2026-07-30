-- ============================================================
-- Smart Dashboard（ZXS）V2 改版 · 建表与收尾迁移脚本
-- 模块：M5 外部灵感聚合 / M8 自动化信息缓存 / M4 免费模型目录
-- 用法：Supabase 控制台 → SQL Editor → 粘贴本文件全部内容 → Run
-- 说明：本脚本幂等可重复执行；自带 is_superadmin() 定义，可独立运行。
--       执行后还需部署 scripts/supabase_stats.sql 以启用数据库真实占用统计。
-- ============================================================

-- 0. 超级管理员判断函数（与 rls_secure.sql / schema_missing.sql 一致，create or replace 幂等）
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

-- ============================================================
-- 1. external_ideas：外部灵感聚合（M5）
--    数据来源：Hacker News / Dev.to / Reddit / Product Hunt / 公共 RSS
-- ============================================================
create table if not exists external_ideas (
  id text primary key,
  user_id text not null,
  source text,
  title text,
  url text,
  summary text,
  tags jsonb default '[]'::jsonb,
  fetched_at timestamptz default now(),
  bookmarked boolean default false,
  related_module text,
  raw jsonb,
  constraint chk_external_ideas_related check (
    related_module is null or related_module in ('todo', 'point', 'content')
  )
);

create index if not exists idx_external_ideas_user on external_ideas (user_id);
create index if not exists idx_external_ideas_fetched on external_ideas (user_id, fetched_at desc);

alter table external_ideas enable row level security;

drop policy if exists "external_ideas self access" on external_ideas;
create policy "external_ideas self access"
  on external_ideas for all
  using (auth.uid()::text = user_id)
  with check (auth.uid()::text = user_id);

-- ============================================================
-- 2. automation_info：自动化信息缓存（M8）
--    保留天数默认 7 天，由 app_settings.automation_cache_days 控制
-- ============================================================
create table if not exists automation_info (
  id text primary key,
  user_id text not null,
  category text,
  title text not null,
  content text,
  url text,
  source text,
  extra jsonb,
  fetched_at timestamptz default now(),
  expire_at timestamptz
);

create index if not exists idx_automation_info_user on automation_info (user_id);
create index if not exists idx_automation_info_expire on automation_info (user_id, expire_at);

alter table automation_info enable row level security;

drop policy if exists "automation_info self access" on automation_info;
create policy "automation_info self access"
  on automation_info for all
  using (auth.uid()::text = user_id)
  with check (auth.uid()::text = user_id);

-- ============================================================
-- 3. free_model_catalog：免费模型目录（M4）
--    登录可读；仅超管可写
-- ============================================================
create table if not exists free_model_catalog (
  provider text not null,
  model text not null,
  endpoint text,
  is_free boolean default false,
  free_quota text,
  status text default 'unknown',
  last_checked timestamptz,
  note text,
  primary key (provider, model)
);

alter table free_model_catalog enable row level security;

drop policy if exists "free_model_catalog read" on free_model_catalog;
create policy "free_model_catalog read"
  on free_model_catalog for select
  using (auth.role() = 'authenticated');

drop policy if exists "free_model_catalog write" on free_model_catalog;
create policy "free_model_catalog write"
  on free_model_catalog for all
  using (is_superadmin())
  with check (is_superadmin());

-- ============================================================
-- 4. app_settings 种子：自动化缓存默认保留 7 天
--    （仅当未配置时写入，已配置则保留用户/超管设置）
-- ============================================================
insert into app_settings (key, value, updated_at)
values ('automation_cache_days', to_jsonb(7), now())
on conflict (key) do nothing;

-- ============================================================
-- 5. Realtime 发布：将三张新表加入 supabase_realtime，便于跨端同步
--    用 DO 块包裹，避免重复加入时报错
-- ============================================================
do $$
declare
  t text;
begin
  foreach t in array array['external_ideas', 'automation_info', 'free_model_catalog']
  loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table %I', t);
    end if;
  end loop;
end $$;

-- ============================================================
-- 6. 授权超管函数给已登录用户
-- ============================================================
grant execute on function is_superadmin() to authenticated;

-- ============================================================
-- 完成提示（仅注释，不返回结果）
-- 部署清单：
--   1) 本文件 v2_setup.sql
--   2) scripts/supabase_stats.sql（启用 get_database_stats() 真实占用统计）
-- ============================================================
