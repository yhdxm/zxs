-- 自定义免费模型表：用户自行添加的免费模型，按账号隔离（RLS 仅本人可读写）。
-- 数据来自模型中心「免费模型清单」的「+ 添加自定义」功能，方便用户把可用免费 AI（如 WorkBuddy HY3 等）登记进来调用。

create table if not exists public.custom_free_models (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null,
  model text not null,
  base_url text,
  note text,
  created_at timestamptz not null default now()
);

create index if not exists idx_custom_free_models_user on public.custom_free_models(user_id);

alter table public.custom_free_models enable row level security;

drop policy if exists "custom_free_models_self_rw" on public.custom_free_models;
create policy "custom_free_models_self_rw"
  on public.custom_free_models
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
