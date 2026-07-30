-- 模型额度账本（阿里百炼免费模型额度扣减记录）
-- 每个用户每个模型一行，记录已用 tokens；剩余 = 免费额度 - 已用。
-- 免费额度以阿里百炼控制台「免费额度」档为准：1,000,000 tokens / 模型，有效期至 2026-09-20。

create table if not exists model_usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  model_id text not null,
  used_tokens bigint not null default 0,
  free_quota bigint not null default 1000000,
  free_until timestamptz not null default '2026-09-20 23:59:59+08',
  updated_at timestamptz not null default now(),
  unique (user_id, model_id)
);

create index if not exists idx_model_usage_user on model_usage(user_id);

alter table model_usage enable row level security;

drop policy if exists "model_usage self access" on model_usage;
create policy "model_usage self access"
  on model_usage
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- 原子递增已用 tokens（避免并发覆盖），并默认写入免费额度与有效期
create or replace function add_model_usage(p_model_id text, p_tokens bigint)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception '未登录，无法记录额度';
  end if;
  insert into model_usage (user_id, model_id, used_tokens, free_quota, free_until)
  values (auth.uid(), p_model_id, p_tokens, 1000000, '2026-09-20 23:59:59+08')
  on conflict (user_id, model_id)
  do update set used_tokens = model_usage.used_tokens + p_tokens, updated_at = now();
end;
$$;

-- 收紧权限：函数默认对 public 可执行，撤销后仅 authenticated 可调用（未登录不可扣减）
revoke execute on function add_model_usage(text, bigint) from public;
grant execute on function add_model_usage(text, bigint) to authenticated;
