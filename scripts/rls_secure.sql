-- =============================================================
-- 安全版行级安全（RLS）迁移脚本 —— 第二阶段（根治"数据库裸奔"）
-- =============================================================
-- 运行前置（务必先做）：
--   1. 应用已改用 Supabase Auth（supabase.auth.signUp / signInWithPassword），
--      前端登录/注册逻辑见 src/services/appDataService.ts。
--   2. Supabase 控制台 → Authentication → Providers → Email：
--      关闭 "Confirm email"（否则合成邮箱收不到验证码，登录会被拒）。
--   3. 本脚本可重复执行（幂等）。
--
-- 效果：
--   - 删除所有 using(true) 的「全网可读写」策略（P0 根因）
--   - app_accounts / profiles / app_dashboard_data 改为仅本人(auth.uid())可访问
--   - 管理员账号管理通过 SECURITY DEFINER 函数提供，仅 superadmin 可调
-- =============================================================

-- 0. 启用行级安全（幂等）
alter table app_accounts enable row level security;
alter table profiles enable row level security;
alter table app_dashboard_data enable row level security;

-- 1. 账号表新增 auth_user_id，关联 auth.users(id)
alter table app_accounts add column if not exists auth_user_id uuid;

-- 1b. 补全旧表可能缺失的管理员字段
alter table app_accounts add column if not exists role text default 'user';
alter table app_accounts add column if not exists disabled boolean default false;

-- 2. 删除「全网可读写」的匿名策略（P0 根因）
drop policy if exists "Allow anonymous access to accounts" on app_accounts;
drop policy if exists "Allow anonymous access to dashboard" on app_dashboard_data;
drop policy if exists "Allow anonymous access to profiles" on profiles;

-- 3. 账号表：仅本人可访问自己的行（auth.uid() = auth_user_id）
create policy "accounts self access"
  on app_accounts
  for all
  using (auth.uid() = auth_user_id)
  with check (auth.uid() = auth_user_id);

-- 4. 资料表：仅本人可访问（auth.uid() 文本化后与 user_id 比对）
create policy "profiles self access"
  on profiles
  for all
  using (auth.uid()::text = user_id)
  with check (auth.uid()::text = user_id);

-- 5. 工作台数据：仅本人可访问
create policy "dashboard self access"
  on app_dashboard_data
  for all
  using (auth.uid()::text = user_id)
  with check (auth.uid()::text = user_id);

-- 6. 回填：若旧数据行的 id 已是合法 uuid，则同步到 auth_user_id
update app_accounts
set auth_user_id = id::uuid
where auth_user_id is null
  and id ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$';

-- 6b. 回填旧管理员角色（兼容旧表无 role 列的情况）
update app_accounts
set role = 'superadmin', disabled = false
where username = 'admin' and role is null;

-- 7. 清理旧的非 uuid 主键孤儿行（迁移后无法被 RLS 命中，留着只会造成混淆）
delete from profiles
where user_id is null or user_id !~ '^[0-9a-fA-F-]{36}$';
delete from app_dashboard_data
where user_id is null or user_id !~ '^[0-9a-fA-F-]{36}$';

-- =============================================================
-- 8. 管理员专用函数（SECURITY DEFINER，仅 superadmin 可调）
--    纯前端架构下，普通 anon 无法读取他人数据；管理员功能通过
--    受信任的函数实现，函数内部校验调用者是否为 superadmin。
-- =============================================================

-- 判断当前登录用户是否为超级管理员
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

-- 列出全部账号（仅超管）
create or replace function list_accounts_for_admin()
returns setof app_accounts
language sql
security definer
set search_path = public
as $$
  select * from app_accounts
  where is_superadmin()
  order by created_at desc;
$$;

-- 按用户名搜索账号（仅超管）
create or replace function search_accounts_for_admin(kw text)
returns setof app_accounts
language sql
security definer
set search_path = public
as $$
  select * from app_accounts
  where is_superadmin()
    and (kw is null or kw = '' or username ilike '%' || kw || '%')
  order by created_at desc;
$$;

-- 创建子账号档案（仅超管；认证用户需由前端先 signUp 得到 uid 传入）
create or replace function create_account_by_admin(
  p_auth_user_id uuid,
  p_username text,
  p_nickname text,
  p_role text,
  p_disabled boolean
)
returns void
language sql
security definer
set search_path = public
as $$
  insert into app_accounts (id, auth_user_id, username, nickname, role, disabled)
  select p_auth_user_id, p_auth_user_id, p_username, p_nickname,
         coalesce(p_role, 'user'), coalesce(p_disabled, false)
  where is_superadmin()
  on conflict (username) do nothing;
$$;

-- 更新子账号档案（仅超管）
create or replace function update_account_by_admin(
  p_auth_user_id uuid,
  p_nickname text,
  p_role text,
  p_disabled boolean
)
returns void
language sql
security definer
set search_path = public
as $$
  update app_accounts
  set nickname = coalesce(p_nickname, nickname),
      role = coalesce(p_role, role),
      disabled = coalesce(p_disabled, disabled)
  where auth_user_id = p_auth_user_id and is_superadmin();
$$;

-- 启用/禁用账号（仅超管）
create or replace function set_account_disabled(p_auth_user_id uuid, p_disabled boolean)
returns void
language sql
security definer
set search_path = public
as $$
  update app_accounts set disabled = p_disabled
  where auth_user_id = p_auth_user_id and is_superadmin();
$$;

-- 删除账号档案（仅超管；认证用户行需另行在 Auth 后台清理）
create or replace function delete_account_by_admin(p_auth_user_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  delete from app_accounts
  where auth_user_id = p_auth_user_id and is_superadmin();
$$;

-- 9. 授权给 authenticated 角色（已登录用户）
-- 撤销 public（含 anon 匿名角色）默认执行权，避免未登录者调用管理函数（信息泄露/越权）
revoke execute on function is_superadmin() from public;
revoke execute on function list_accounts_for_admin() from public;
revoke execute on function search_accounts_for_admin(text) from public;
revoke execute on function create_account_by_admin(uuid, text, text, text, boolean) from public;
revoke execute on function update_account_by_admin(uuid, text, text, boolean) from public;
revoke execute on function set_account_disabled(uuid, boolean) from public;
revoke execute on function delete_account_by_admin(uuid) from public;
grant execute on function is_superadmin() to authenticated;
grant execute on function list_accounts_for_admin() to authenticated;
grant execute on function search_accounts_for_admin(text) to authenticated;
grant execute on function create_account_by_admin(uuid, text, text, text, boolean) to authenticated;
grant execute on function update_account_by_admin(uuid, text, text, boolean) to authenticated;
grant execute on function set_account_disabled(uuid, boolean) to authenticated;
grant execute on function delete_account_by_admin(uuid) to authenticated;

-- 10. 补全缺失表（app_settings / news_daily）的超管写策略
--     建表、读策略、is_superadmin、外键由 schema_missing.sql 提供；此处仅同步写策略，
--     保证重跑本脚本后所有表的策略一致。
drop policy if exists "app_settings write" on app_settings;
create policy "app_settings write"
  on app_settings for all
  using (is_superadmin())
  with check (is_superadmin());

drop policy if exists "news_daily write" on news_daily;
create policy "news_daily write"
  on news_daily for all
  using (is_superadmin())
  with check (is_superadmin());
