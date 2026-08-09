-- ============================================================
-- 四六级备考台 · 设置表字段迁移
-- 用途：为已创建的 cet4_prep_settings 表追加 manual_streak 列，
--       支持用户在「我的 → 备考设置」中手动校准连续背词天数。
-- 执行位置：Supabase Dashboard → SQL Editor → New query → 粘贴 → Run
-- ============================================================

alter table public.cet4_prep_settings
  add column if not exists manual_streak int;

comment on column public.cet4_prep_settings.manual_streak is
  '用户手动校准的连续背词天数；null 时按打卡记录自动计算';
