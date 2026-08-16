-- 为 profiles 表补充 ai_config 列（账号级 AI 配置，仅含非敏感项）
-- 幂等：重复执行不会报错

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS ai_config jsonb;

-- 确认列已存在
SELECT table_name, column_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'profiles'
  AND column_name = 'ai_config';
