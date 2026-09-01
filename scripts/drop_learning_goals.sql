-- 删除「学习目标」模块后清理孤儿表（按需手动执行）
-- 注意：此表数据即用户的目标/打卡/周报，删除不可逆，请确认不再需要再执行
-- 来源：local_modules_cloud.sql 中定义的 public.learning_goals 表
DROP TABLE IF EXISTS public.learning_goals;
