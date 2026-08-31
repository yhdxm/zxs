-- ============================================================================
-- 纯 localStorage 模块上云：建表 + RLS + Realtime
--
-- 执行位置：Supabase Dashboard → SQL Editor → 粘贴执行（整段运行）
-- 配套说明：D:\龙虾产物\分析报告\local-storage-to-cloud-plan-20260831.md
--
-- 建表清单：
--   1) public.learning_goals        —— 学习目标完整 JSON（每个用户一条）
--   2) public.study_module_settings —— 三模块学习设置（learn/cet/degree）
--   3) public.user_json_blobs       —— 通用 KV（自选股 / 学习掌握 / 模拟盘 / AI 用量）
-- ============================================================================

-- 1) 学习目标：整个目标、打卡记录、周报存为一个 JSON blob
--    每个 user_id 只有一条记录，前端读取后反序列化到现有内存模型
CREATE TABLE IF NOT EXISTS public.learning_goals (
  user_id     TEXT PRIMARY KEY,
  data        JSONB NOT NULL DEFAULT '{}'::JSONB,
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_learning_goals_updated
  ON public.learning_goals(updated_at DESC);

-- 2) 学习设置：三模块（learn / cet / degree）各自的设置项
CREATE TABLE IF NOT EXISTS public.study_module_settings (
  user_id           TEXT NOT NULL,
  module            TEXT NOT NULL, -- 'learn' | 'cet' | 'degree'
  new_per_day       INT NOT NULL DEFAULT 15,
  remind_due        BOOLEAN NOT NULL DEFAULT TRUE,
  graduated_return  BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at        TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, module)
);
CREATE INDEX IF NOT EXISTS idx_study_module_settings_uid
  ON public.study_module_settings(user_id);
CREATE INDEX IF NOT EXISTS idx_study_module_settings_updated
  ON public.study_module_settings(updated_at DESC);

-- 3) 通用 KV blobs：自选股 / 学习掌握 / 模拟盘 / AI 用量
CREATE TABLE IF NOT EXISTS public.user_json_blobs (
  user_id     TEXT NOT NULL,
  key         TEXT NOT NULL, -- 'watchlist' | 'learn_mastery' | 'simtrade' | 'ai_usage'
  value       JSONB NOT NULL DEFAULT '{}'::JSONB,
  updated_at  TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, key)
);
CREATE INDEX IF NOT EXISTS idx_user_json_blobs_uid
  ON public.user_json_blobs(user_id);
CREATE INDEX IF NOT EXISTS idx_user_json_blobs_updated
  ON public.user_json_blobs(updated_at DESC);

-- ============================================================================
-- RLS 策略
-- ============================================================================
-- 安全说明：本项目为「自建账号表 + 纯前端」认证，auth.uid() 恒为 NULL，
-- 无法在数据库层做真正的行级隔离。下列策略沿用现有架构：对 anon 开放读写，
-- 由前端始终按当前登录账号 id 过滤。迁移到 Supabase Auth 后，只需把策略改为
-- using(auth.uid() = user_id) with check(auth.uid() = user_id) 即可。
ALTER TABLE public.learning_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.study_module_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_json_blobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS allow_all_learning_goals ON public.learning_goals;
CREATE POLICY allow_all_learning_goals ON public.learning_goals
  FOR ALL USING (TRUE) WITH CHECK (TRUE);

DROP POLICY IF EXISTS allow_all_study_module_settings ON public.study_module_settings;
CREATE POLICY allow_all_study_module_settings ON public.study_module_settings
  FOR ALL USING (TRUE) WITH CHECK (TRUE);

DROP POLICY IF EXISTS allow_all_user_json_blobs ON public.user_json_blobs;
CREATE POLICY allow_all_user_json_blobs ON public.user_json_blobs
  FOR ALL USING (TRUE) WITH CHECK (TRUE);

-- ============================================================================
-- 开启 Realtime（PC 端写入后手机端实时同步）
-- ============================================================================
DO $$
DECLARE
  t TEXT;
  tables TEXT[] := ARRAY['learning_goals', 'study_module_settings', 'user_json_blobs'];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    -- 关键：REPLICA IDENTITY FULL，否则 UPDATE/DELETE 推送的 old record 没有 user_id，
    -- 前端按 user_id 过滤时会把本用户的变更误判为别人的而丢弃。
    EXECUTE FORMAT('ALTER TABLE public.%I REPLICA IDENTITY FULL', t);

    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = t
    ) THEN
      EXECUTE FORMAT('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
      RAISE NOTICE '已开启实时：%', t;
    ELSE
      RAISE NOTICE '跳过（已在 publication 中）：%', t;
    END IF;
  END LOOP;
END $$;

-- ============================================================================
-- 验证：执行完后跑下面这条查询，确认三张表都在列表里
-- ============================================================================
-- SELECT schemaname, tablename
-- FROM pg_publication_tables
-- WHERE pubname = 'supabase_realtime' AND schemaname = 'public'
-- ORDER BY tablename;
