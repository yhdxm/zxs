-- ============================================================
-- Smart Dashboard · 数据库精确统计函数（全面监测版）
-- 用途：「数据库监测中心」读取真实的数据库大小、各表行数 / 占用空间 / RLS 状态
-- 用法：在 Supabase 后台 → SQL Editor 中粘贴执行本文件
-- 说明：未执行本文件时，前端会自动降级为「逐表估算」，仅能拿到行数（无空间 / RLS）
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
          'name', t.relname,
          'schema', t.schemaname,
          'rows', t.n_live_tup::bigint,
          'size_bytes', pg_total_relation_size(t.relid)::bigint,
          'rls_enabled', c.relrowsecurity
        ) order by pg_total_relation_size(t.relid) desc)
        -- 只统计 public 模式（应用业务表）；auth/storage 等 Supabase 内置模式由平台托管、默认不开放 anon，不应纳入「业务表未开 RLS」告警
        from pg_stat_user_tables t
        join pg_class c on c.oid = t.relid
        where t.schemaname = 'public'
      ), '[]'::json)
    );
$$;

-- 本项目为「自建账号表 + 纯前端」架构，客户端一律以 anon 角色连接数据库，
-- 因此必须把统计函数授权给 anon（与现有 RLS 对 anon 开放读的姿态一致），
-- 才能让「数据库监测中心」真正取到库总大小 / 各表空间 / RLS 状态。
-- 先 revoke public 再 grant anon，避免其它角色误用。anon 可读取的仅是所有
-- 用户表的「名称 / 行数 / 大小 / RLS 开关」，与现有 RLS 已对 anon 开放读的暴露面一致。
revoke execute on function get_database_stats() from public;
grant execute on function get_database_stats() to anon;
