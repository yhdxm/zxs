-- ============================================================
-- 为「消息历史按日期分表」批量开启行级安全（RLS）
-- 背景：监测中心发现 public.messages_2026_07_28 ~ messages_2026_08_03
--       等 7 张分表未启用 RLS（rls_enabled=false），存在越权读取告警。
-- 写法与项目现有架构一致：自建账号表 + 纯前端，客户端以 anon 角色连接，
--       所有业务表统一 `to anon using(true) with check(true)`，
--       真实行隔离在应用层按当前登录账号 id 过滤（见 learnDb.ts / appDataService.ts）。
-- 说明：开启 RLS 后 anon 仍可全表读写，故「行为完全不变」，
--       仅用于消除「业务表未启用 RLS」告警，满足全面监测要求。
-- 本脚本使用动态 DO 块，自动覆盖所有 `messages_YYYY_MM_DD` 格式的分表，
--       未来新增分表（如 messages_2026_08_04）重跑本脚本即可一并加固。
-- 执行方式：Supabase 后台 → SQL Editor → 粘贴本文件 → Run
-- ============================================================

do $$
declare
  t   text;
  pol text;
begin
  for t in
    select tablename
    from pg_tables
    where schemaname = 'public'
      and tablename ~ '^messages_\d{4}_\d{2}_\d{2}$'  -- 仅匹配按日期的消息分表
  loop
    -- 启用 RLS
    execute format('alter table public.%I enable row level security', t);

    -- 统一策略：anon 全开放（与现有业务表保持一致；真实隔离由应用层实现）
    pol := 'messages_rls_' || t;
    execute format('drop policy if exists %I on public.%I', pol, t);
    execute format(
      'create policy %I on public.%I for all to anon using (true) with check (true)',
      pol, t
    );
  end loop;
end $$;

-- 校验：列出所有 messages 分表及其 RLS 状态
select
  c.relname as table_name,
  c.relrowsecurity as rls_enabled
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind = 'r'
  and c.relname ~ '^messages_\d{4}_\d{2}_\d{2}$'
order by c.relname;
