-- 单词进度「学习日期」列迁移
-- 目的：把「今日已学」与「连续学习天数」从 localStorage 计数改为云端进度派生，
--       从而使 PC / 手机读同一份数据自动同步（修复跨端不同步）。
-- 做法：为三张单词进度表各加 first_learned / last_studied 两列（可空 date）。
--       每次评分由 reviewWord 写入这两个日期，看板指标再从云端进度计算。
--
-- 执行方式：在 Supabase 控制台 → SQL Editor 中粘贴本文件全文执行一次即可
--           （add column if not exists 幂等，重复执行安全）。
-- 注意：新建列对历史数据为空；这些用户下一次背词时 reviewWord 会自动补写，
--       旧统计会随学习自然恢复，无需回填。

-- 1) 学习中心「背单词卡」进度表
alter table public.learn_word_progress
  add column if not exists first_learned date,  -- 首次学习日期 YYYY-MM-DD
  add column if not exists last_studied date;   -- 最近一次学习日期 YYYY-MM-DD

-- 2) 学习中心「四六级单词」进度表（按 level 分库）
alter table public.cet_word_progress
  add column if not exists first_learned date,
  add column if not exists last_studied date;

-- 3) 备考台单词/词组进度表（词组 key 以 'ph:' 前缀隔离）
alter table public.degree_word_progress
  add column if not exists first_learned date,
  add column if not exists last_studied date;

-- 可选：为按日期查询/统计加索引（大表性能更稳，小表影响可忽略，建了无妨）
create index if not exists idx_learn_wp_first_learned on public.learn_word_progress(first_learned);
create index if not exists idx_learn_wp_last_studied on public.learn_word_progress(last_studied);
create index if not exists idx_cet_wp_first_learned on public.cet_word_progress(first_learned);
create index if not exists idx_cet_wp_last_studied on public.cet_word_progress(last_studied);
create index if not exists idx_degree_wp_first_learned on public.degree_word_progress(first_learned);
create index if not exists idx_degree_wp_last_studied on public.degree_word_progress(last_studied);
