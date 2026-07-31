-- ============================================================================
-- 新增模块用户数据表（星舆识途 / AI模型知识 / 学习中心）
-- 免费档 Supabase；按 user_id 列隔离（应用层过滤，见 src/services/learnDb.ts）。
--
-- 安全说明：本项目当前为「自建账号表 + 纯前端」认证（非 Supabase Auth），
-- 因此 auth.uid() 恒为 NULL，无法在数据库层做真正的行级隔离。
-- 下列 RLS 沿用现有架构：对 anon 开放读写，由前端始终按当前登录账号 id 过滤。
-- 真正严格的 RLS（auth.uid() = user_id）需在「迁移到 Supabase Auth 免费档」后启用，
-- 该整改项已列入安全清单，届时只需把策略改为 using(auth.uid() = user_id) 即可。
-- ============================================================================

-- 1) 星舆识途：自选车 / 关注品牌
create table if not exists public.car_watchlist (
  id          uuid primary key default gen_random_uuid(),
  user_id     text not null,
  name        text not null,
  ref         text default '',
  note        text default '',
  created_at  timestamptz default now()
);
create index if not exists idx_car_watchlist_uid on public.car_watchlist(user_id);

-- 2) AI模型知识：模型收藏
create table if not exists public.model_bookmarks (
  id          uuid primary key default gen_random_uuid(),
  user_id     text not null,
  model_id    text not null,
  model_name  text not null,
  note        text default '',
  created_at  timestamptz default now()
);
create index if not exists idx_model_bookmarks_uid on public.model_bookmarks(user_id);

-- 3) 学习中心：学习进度
create table if not exists public.learn_progress (
  id          uuid primary key default gen_random_uuid(),
  user_id     text not null,
  module      text not null,
  item_id     text not null,
  status      text default 'learning',
  score       int default 0,
  updated_at  timestamptz default now(),
  unique (user_id, module, item_id)
);

-- 4) 学习中心：书签（生词 / 行业知识点 / 书籍）
create table if not exists public.learn_bookmarks (
  id          uuid primary key default gen_random_uuid(),
  user_id     text not null,
  kind        text not null,   -- word | topic | book
  ref_id      text not null,
  title       text not null,
  note        text default '',
  created_at  timestamptz default now()
);
create index if not exists idx_learn_bookmarks_uid on public.learn_bookmarks(user_id);

-- 5) 学习中心：阅读记录
create table if not exists public.learn_reading (
  id          uuid primary key default gen_random_uuid(),
  user_id     text not null,
  book_id     int not null,
  book_title  text not null,
  progress    int default 0,
  last_pos    int default 0,
  updated_at  timestamptz default now(),
  unique (user_id, book_id)
);

-- ===================== RLS（与现有架构一致） =====================
alter table public.car_watchlist   enable row level security;
alter table public.model_bookmarks enable row level security;
alter table public.learn_progress  enable row level security;
alter table public.learn_bookmarks enable row level security;
alter table public.learn_reading   enable row level security;

do $$
declare t text;
begin
  foreach t in array array['car_watchlist','model_bookmarks','learn_progress','learn_bookmarks','learn_reading'] loop
    execute format('drop policy if exists %I on public.%I;', t || '_anon', t);
    execute format(
      'create policy %I on public.%I for all to anon using (true) with check (true);',
      t || '_anon', t
    );
  end loop;
end $$;
