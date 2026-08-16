-- ============================================================
-- 学位英语备考台 · 清理废弃表
-- 说明：前端已删除「资料中心 / 阅读器 / 我的」等页面，对应两张表已无业务读写
--       （无任何 .from() 读写，仅监测中心注册），从 scripts/degree-english-schema.sql
--       中移除其建表语句。
--       注意：degree_settings / degree_word_progress 等表仍被「背单词卡（SRS）」等
--       活跃页面使用，切勿DROP。
-- 执行位置：Supabase Dashboard → SQL Editor → 粘贴 → Run
-- 注意：执行前请确认这些表无需要保留的业务数据（已无前端入口写入）。
-- ============================================================

drop table if exists public.degree_materials    cascade;
drop table if exists public.degree_study_plans  cascade;
