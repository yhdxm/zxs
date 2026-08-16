-- 学习中心「背单词卡」独立进度表
-- 与 degree_word_progress 结构一致，但独立存储，避免与备考台背单词卡互相影响。
create table if not exists public.learn_word_progress (
  id           uuid primary key default gen_random_uuid(),
  user_id      text not null,
  word         text not null,
  status       text default 'new',     -- 'new' | 'learning' | 'graduated'
  level        int default 0,          -- SRS 盒子等级
  due          date,                   -- 下次复习日期（UTC 零点）
  weak         boolean default false,
  wrong_streak int default 0,
  updated_at   timestamptz default now(),
  unique (user_id, word)
);
create index if not exists idx_learn_word_progress_uid on public.learn_word_progress(user_id);

alter table public.learn_word_progress enable row level security;
drop policy if exists learn_word_progress_anon on public.learn_word_progress;
-- 同时开放 anon / authenticated，与 degree_word_progress 保持一致，避免某些客户端被识别为 authenticated 时报 403
create policy learn_word_progress_all on public.learn_word_progress for all to anon, authenticated using (true) with check (true);

grant select, insert, update, delete on public.learn_word_progress to anon, authenticated;
