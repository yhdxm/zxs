-- 学习中心「四六级单词」独立进度表
-- 与 degree_word_progress 结构对齐，但按 level(cet4/cet6) 再分库，避免与学位英语进度混淆。
create table if not exists public.cet_word_progress (
  id           uuid primary key default gen_random_uuid(),
  user_id      text not null,
  level        text not null,          -- 'cet4' | 'cet6'
  word         text not null,
  status       text default 'new',     -- 'new' | 'learning' | 'graduated'
  score        int default 0,          -- 对应 SRS level
  due          date,                   -- 下次复习日期（UTC 零点）
  weak         boolean default false,
  wrong_streak int default 0,
  updated_at   timestamptz default now(),
  unique (user_id, level, word)
);
create index if not exists idx_cet_word_progress_uid_level on public.cet_word_progress(user_id, level);

alter table public.cet_word_progress enable row level security;
drop policy if exists cet_word_progress_anon on public.cet_word_progress;
create policy cet_word_progress_anon on public.cet_word_progress for all to anon using (true) with check (true);
