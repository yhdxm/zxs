-- 修复 learn_progress / learn_bookmarks RLS 写入报错
-- 适用场景：Supabase 已启用 RLS 但策略未正确覆盖 anon/authenticated 两种角色，
--          导致插入/更新/删除时报 "violates row-level security policy"。
-- 执行后：两个表对 public（所有请求角色）开放所有操作，由前端始终按 user_id 过滤。
-- 注意：本项目当前为「自建账号表 + 纯前端」架构；未来迁移到 Supabase Auth 后，
--       应把策略收窄为 using/auth.uid() = user_id。

alter table if exists public.learn_progress  enable row level security;
alter table if exists public.learn_bookmarks enable row level security;

-- 先清理旧策略，避免同名冲突或策略叠加导致行为不一致
drop policy if exists learn_progress_anon        on public.learn_progress;
drop policy if exists learn_progress_authenticated on public.learn_progress;
drop policy if exists learn_progress_public      on public.learn_progress;
drop policy if exists learn_progress             on public.learn_progress;

drop policy if exists learn_bookmarks_anon        on public.learn_bookmarks;
drop policy if exists learn_bookmarks_authenticated on public.learn_bookmarks;
drop policy if exists learn_bookmarks_public      on public.learn_bookmarks;
drop policy if exists learn_bookmarks             on public.learn_bookmarks;

-- 创建对 public（anon + authenticated 均包含）的完全开放策略
create policy learn_progress_public
  on public.learn_progress
  for all to public
  using (true)
  with check (true);

create policy learn_bookmarks_public
  on public.learn_bookmarks
  for all to public
  using (true)
  with check (true);
