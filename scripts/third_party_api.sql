-- ============================================================
-- Smart Dashboard · 第三方 API 模块建表与函数
-- 用途：「第三方 API」页面 —— 各账号自行填写天气/地图等免费 API 地址与 Key，
--        超级管理员可授权哪些账号可使用第三方 API 调用（授权后该账号才能用高德等）。
-- 用法：在 Supabase 后台 → SQL Editor 粘贴执行本文件（一次性）。
-- 说明：本项目为「自建账号表 + 纯前端」架构，客户端以 anon 角色连接，
--        行级隔离统一在【应用层】按当前登录账号 id 过滤（与 learnDb.ts 一致）。
--        数据库层 RLS 对 anon 开放读写，仅保证表存在、策略不阻断；
--        真正的授权判定在 ThirdPartyApiView 前端按 role 控制（与全站一致）。
-- ============================================================

-- 1. 第三方 API 配置（按账号隔离）
--    user_id 为账号隔离键；应用层始终 .eq('user_id', 当前账号id)
--    service ∈ {weather, map}  service+user 唯一
create table if not exists third_party_apis (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  service text not null,
  provider text not null,
  api_url text,
  api_key text,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists third_party_apis_uniq on third_party_apis(user_id, service);
alter table third_party_apis enable row level security;
drop policy if exists "third_party_apis anon rw" on third_party_apis;
create policy "third_party_apis anon rw"
  on third_party_apis for all
  using (true) with check (true);

-- 2. 第三方 API 授权（超级管理员 → 账号）
--    grantee_id 为被授权账号；service ∈ {all, weather, map}
--    授权判定在应用层（isGranted）：grantee_id=当前账号 且 service∈('all', service)
create table if not exists api_grants (
  id uuid primary key default gen_random_uuid(),
  grantor_id text not null,
  grantee_id text not null,
  service text not null default 'all',
  created_at timestamptz not null default now()
);
create unique index if not exists api_grants_uniq on api_grants(grantee_id, service);
alter table api_grants enable row level security;
drop policy if exists "api_grants anon rw" on api_grants;
create policy "api_grants anon rw"
  on api_grants for all
  using (true) with check (true);

-- 3. 枚举账号基础信息（供超管授权界面选择账号）
--    与 get_database_stats 同理：客户端一律 anon，需授权给 anon 才能被前端调用。
--    仅返回非敏感字段（id/用户名/昵称/角色/禁用），不返回密码与邮箱。
create or replace function list_accounts_basic()
returns json
language sql
security definer
set search_path = public
as $$
  select coalesce(
    json_agg(json_build_object(
      'id', id,
      'username', username,
      'nickname', nickname,
      'role', role,
      'disabled', disabled
    ) order by created_at desc),
    '[]'::json
  )
  from app_accounts;
$$;

revoke execute on function list_accounts_basic() from public;
grant execute on function list_accounts_basic() to anon;
