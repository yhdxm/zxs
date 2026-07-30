-- ============================================================
-- 账号级 AI API Key 云端存储（加密上云 + RLS 隔离）
-- 需求：每个账号自己配置自己的 Key，跨设备/下次登录留存；
--       超级管理员可查看并使用所有账号的 Key；
--       普通账号之间互相不可见，也用不到超管的 Key。
-- 说明：encrypted_key 为前端 AES-GCM 加密后的密文（v1:salt:iv:ct），
--       访问控制核心依赖 RLS（本人 + 超管），加密仅为纵深防御。
-- 依赖：is_superadmin() 函数（已由 rls_secure.sql 创建）。
-- ============================================================

create table if not exists ai_keys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null default '',
  base_url text not null default '',
  model text not null default '',
  encrypted_key text not null default '',
  updated_at timestamptz not null default now(),
  unique (user_id)
);

create index if not exists idx_ai_keys_user on ai_keys(user_id);

alter table ai_keys enable row level security;

-- 本人：完整读写自己的 Key
drop policy if exists "ai_keys self all" on ai_keys;
create policy "ai_keys self all"
  on ai_keys
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- 超管：可读取所有账号的 Key（只读，不允许替别人改）
drop policy if exists "ai_keys superadmin read" on ai_keys;
create policy "ai_keys superadmin read"
  on ai_keys
  for select
  using (is_superadmin());

-- ============================================================
-- model_usage 补充：超管可读取所有账号的用量（模型中心总览用）
-- ============================================================
drop policy if exists "model_usage superadmin read" on model_usage;
create policy "model_usage superadmin read"
  on model_usage
  for select
  using (is_superadmin());
