-- 修复：learn_word_progress / cet_word_progress 因 RLS 只开放 anon 角色，
-- 当客户端被 Supabase 识别为 authenticated 时 upsert 返回 403。
-- 本脚本幂等：可重复执行。

-- 1) 为 learn_word_progress 补列并修正 RLS
ALTER TABLE public.learn_word_progress
  ADD COLUMN IF NOT EXISTS first_learned date,
  ADD COLUMN IF NOT EXISTS last_studied date;

ALTER TABLE public.learn_word_progress ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS learn_word_progress_anon ON public.learn_word_progress;
DROP POLICY IF EXISTS learn_word_progress_all ON public.learn_word_progress;
CREATE POLICY learn_word_progress_all ON public.learn_word_progress
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.learn_word_progress TO anon, authenticated;

-- 2) 为 cet_word_progress 补列并修正 RLS
ALTER TABLE public.cet_word_progress
  ADD COLUMN IF NOT EXISTS first_learned date,
  ADD COLUMN IF NOT EXISTS last_studied date;

ALTER TABLE public.cet_word_progress ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS cet_word_progress_anon ON public.cet_word_progress;
DROP POLICY IF EXISTS cet_word_progress_all ON public.cet_word_progress;
CREATE POLICY cet_word_progress_all ON public.cet_word_progress
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.cet_word_progress TO anon, authenticated;

-- 3) 为 degree_word_progress 补列（RLS 原本已正确，保持不变）
ALTER TABLE public.degree_word_progress
  ADD COLUMN IF NOT EXISTS first_learned date,
  ADD COLUMN IF NOT EXISTS last_studied date;

-- 4) 确认策略
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('learn_word_progress', 'cet_word_progress', 'degree_word_progress')
ORDER BY tablename, policyname;