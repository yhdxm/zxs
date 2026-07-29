-- ============================================================
-- Smart Dashboard · 数据库精确统计函数
-- 用途：「数据库检测」页面读取真实的数据库大小与各表行数
-- 用法：在 Supabase 后台 → SQL Editor 中粘贴执行本文件
-- 说明：未执行本文件时，前端会自动降级为「逐表估算」，不影响使用
-- ============================================================

create or replace function get_database_stats()
returns json
language sql
security definer
as $$
  select json_build_object(
    'db_size_bytes', pg_database_size(current_database()),
    'tables', coalesce((
      select json_agg(json_build_object(
        'name', relname,
        'rows', n_live_tup::bigint,
        'size_bytes', pg_total_relation_size(relid)::bigint
      ) order by pg_total_relation_size(relid) desc)
      from pg_stat_user_tables
    ), '[]'::json)
  );
$$;

-- 授权：仅允许已登录用户调用，防止未登录者读取全库表结构（信息泄露）
grant execute on function get_database_stats() to authenticated;
