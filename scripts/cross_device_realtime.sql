-- ============================================================================
-- 跨设备实时同步：为学习三模块的云端表开启 Supabase Realtime
--
-- 执行位置：Supabase Dashboard → SQL Editor → New query → 粘贴执行（整段运行）
--
-- 【为什么要执行】
-- 前端已接入统一云端刷新通道（src/composables/useCloudSync.ts），但 Supabase 默认
-- 只把部分表加入 realtime publication。未加入的表：
--   · 不执行本脚本 → PC 端写入后，手机端要「切回前台 / 聚焦 / 联网恢复」才会刷新（可用，但非实时）
--   · 执行本脚本   → PC 端写入，手机端当场自动更新，无需任何操作
--
-- 【脚本特性】
-- 幂等：已加入 publication 的表会自动跳过，重复执行不会报错，可放心多跑几次。
-- ============================================================================

do $$
declare
  t text;
  -- 需要开启实时的表（均含 user_id 列，前端按 user_id 过滤）
  tables text[] := array[
    -- 学位英语备考台
    'degree_settings',
    'degree_word_progress',
    'degree_practice',
    'degree_mistakes',
    'degree_favorites',
    'degree_exam_records',
    -- 四六级备考台
    'cet4_prep_progress',
    'cet4_prep_practice',
    'cet4_prep_mistakes',
    'cet4_prep_checkins',
    'cet4_prep_settings',
    -- 学习中心（通用学习）
    'learn_word_progress',
    'learn_progress',
    'learn_bookmarks',
    'learn_reading',
    -- 工作台（待办 / 点位 / 内容）
    'app_dashboard_data'
  ];
begin
  foreach t in array tables loop
    if not exists (
      select 1 from information_schema.tables
      where table_schema = 'public' and table_name = t
    ) then
      raise notice '跳过（表不存在，可能尚未建）：%', t;
      continue;
    end if;

    -- 关键：REPLICA IDENTITY FULL
    -- 默认的 REPLICA IDENTITY 只记录主键，UPDATE / DELETE 推送的 old record 里
    -- 只有 id、没有 user_id，前端按 user_id 过滤时会把本用户的变更误判为「别人的」而丢弃。
    -- 设为 FULL 后 old record 含所有列，过滤才准确。（代价是 WAL 略增，这些表都很小，可忽略）
    execute format('alter table public.%I replica identity full', t);

    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
      raise notice '已开启实时：%', t;
    else
      raise notice '跳过（已在 realtime publication 中）：%', t;
    end if;
  end loop;
end $$;

-- ============================================================================
-- 验证：执行完后跑下面这条查询，确认目标表都在列表里
-- ============================================================================
-- select schemaname, tablename
-- from pg_publication_tables
-- where pubname = 'supabase_realtime' and schemaname = 'public'
-- order by tablename;
