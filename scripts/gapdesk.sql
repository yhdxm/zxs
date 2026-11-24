-- =============================================================
-- 差值台 GAPDESK · 数据层（第一批 · 数据层契约）
-- =============================================================
-- 运行位置：Supabase 控制台 → SQL Editor，整段粘贴执行。
-- 幂等性：全部 create table/index if not exists、drop policy if exists，
--         可重复执行，不需要先手动删表。
-- 架构约定（对齐 rls_secure.sql）：
--   - 用户身份用 text 型 user_id，写入时取 auth.uid()::text；
--   - 全局采集表（events / event_sources / event_platform / sources）
--     前端【只读】，写入统一由采集脚本用 service_role 绕过 RLS；
--   - 2 天滚动清理：gapdesk_purge() +（有 pg_cron 时）每 2 小时定时。
-- =============================================================

-- -------------------------------------------------------------
-- 1. 事件主表（全局共享，15 路信源聚合后的「事件」）
--    uniq_keep 的设计：Postgres 的唯一约束无法带 where 做「部分唯一」，
--    故用固定空串占位，靠 (event_key, uniq_keep) 双键唯一。
--    二期改为「标题指纹 + 行业」双键时，只需把 uniq_keep 写成 ind，
--    唯一约束本身与所有 upsert 语句都不用改。
-- -------------------------------------------------------------
create table if not exists public.gap_events (
  id            bigint      generated always as identity primary key,
  event_key     text        not null,                       -- 标题指纹（FNV-1a 32 位 hex，见 src/utils/gapdeskFormat.ts）
  uniq_keep     text        not null default '',            -- 唯一约束占位列，二期填行业键
  title         text        not null,
  summary       text        default '',                     -- 源站原文截断，不落地全文
  url           text        default '',
  ind           text        not null default 'glob',        -- ai/fin/med/en/mfg/agri/prop/glob
  dim           text        not null default 'policy',      -- policy/capex/cost/supply/tech/capital/channel/regulation
  kind          text        not null default 'insider',     -- insider/main/rare/tech
  gap           int         not null default 0,             -- 展示分（0-100）
  gap_raw       int         not null default 0,             -- 启发式原始分
  b_json        jsonb       not null default '[]'::jsonb,   -- 四维分解 [决策圈, 主流, 冷门, 海外]
  tags          jsonb       not null default '[]'::jsonb,
  ts_published  bigint      not null default 0,             -- epoch ms；0 = 源站无发布时间
  ts_first_seen bigint      not null,                       -- 本系统首次观测 epoch ms
  ins_heat      int         default 0,                      -- 决策圈热度（投票/评论）
  pub_heat      int         default 0,                      -- 主流媒体互动量
  mass_on       text,                                       -- 命中哪个人群榜（微博/知乎/抖音），未出圈为 null
  mass_heat     int         default 0,                      -- 大众榜真实热度；0 = 尚未出圈
  lag_h         numeric,                                    -- 事件簇内各源发布时间差（小时）
  src_count     int         not null default 1,
  reason        text        default '',                     -- 判定理由（由已算特征拼装，无幻觉风险）
  action        text        default '',                     -- 建议动作
  is_foreign    boolean     default false,
  expire_at     timestamptz not null default (now() + interval '48 hours'),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint gap_events_key_uniq unique (event_key, uniq_keep)
);

create index if not exists gap_events_ind_idx        on public.gap_events (ind);
create index if not exists gap_events_gap_idx        on public.gap_events (gap desc);
create index if not exists gap_events_first_seen_idx on public.gap_events (ts_first_seen desc);
create index if not exists gap_events_expire_idx     on public.gap_events (expire_at);

-- -------------------------------------------------------------
-- 2. 事件证据链：一个事件由哪些源、哪一层、什么时候报的
--    （前端「为什么这条分高」的展开面板即读此表）
-- -------------------------------------------------------------
create table if not exists public.gap_event_sources (
  id          bigint generated always as identity primary key,
  event_id    bigint not null references public.gap_events (id) on delete cascade,
  source_name text,                                    -- 如「华尔街见闻·电报」
  layer       text,                                    -- insider/main/rare/tech/mass
  url         text,
  publish_ts  bigint,                                  -- epoch ms；null = 源站无时间
  heat        int,                                     -- 该源上的真实互动量
  constraint gap_event_sources_uniq unique (event_id, url)
);

create index if not exists gap_event_sources_event_idx on public.gap_event_sources (event_id);

-- -------------------------------------------------------------
-- 3. 平台首触/热度（只增不改）：first_touch_ts 一旦写入不再回退，
--    用于「先见于决策圈、N 小时后才出圈」的滞后量化。
-- -------------------------------------------------------------
create table if not exists public.gap_event_platform (
  id             bigint generated always as identity primary key,
  event_id       bigint not null references public.gap_events (id) on delete cascade,
  platform       text,                                 -- 微博/知乎/抖音/行业决策圈
  first_touch_ts bigint,                               -- epoch ms；0 = 未触达
  heat           int,
  updated_at     timestamptz not null default now(),
  constraint gap_event_platform_uniq unique (event_id, platform)
);

-- -------------------------------------------------------------
-- 4. 信源健康（15 路免费源，表结构对齐 /api/health 返回）
-- -------------------------------------------------------------
create table if not exists public.gap_sources (
  id         text primary key,                        -- wallstreetcn / eastmoney / ...
  name       text not null,
  layer      text not null,                           -- insider/main/rare/tech/mass
  ttl        int,                                     -- 建议缓存 TTL（分钟）
  ok         int default 0,                           -- 连续成功次数
  fail       int default 0,                           -- 连续失败次数
  last_ok    timestamptz,
  last_fail  timestamptz,
  latency_ms int,                                     -- 最近一次实测延迟
  items      int,                                     -- 最近一次单轮条数
  status     text default 'unknown',                  -- unknown/ok/warn/fail
  msg        text default ''                          -- 失败原因（短文案）
);

create index if not exists gap_sources_layer_idx on public.gap_sources (layer);

-- -------------------------------------------------------------
-- 5. 用户级表：收藏 / 已读 / 行业订阅
-- -------------------------------------------------------------
create table if not exists public.gap_favorites (
  user_id    text not null,
  event_id   bigint not null references public.gap_events (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, event_id)
);

create table if not exists public.gap_reads (
  user_id  text not null,
  event_id bigint not null references public.gap_events (id) on delete cascade,
  read_at  timestamptz default now(),
  primary key (user_id, event_id)
);

create table if not exists public.gap_subscriptions (
  user_id    text not null,
  ind        text not null,                           -- 订阅的行业键
  created_at timestamptz not null default now(),
  primary key (user_id, ind)
);

-- -------------------------------------------------------------
-- 6. 预警规则（用户级 DSL，二期告警引擎读此表）
-- -------------------------------------------------------------
create table if not exists public.gap_rules (
  id         text primary key,
  user_id    text not null,
  name       text,
  dsl        jsonb not null default '{}'::jsonb,      -- { ind[], dim[], gapMin, srcMax, windowH, channels[] }
  channels   jsonb default '[]'::jsonb,
  enabled    boolean default true,
  hits       int default 0,
  created_at timestamptz not null default now()
);

create index if not exists gap_rules_user_idx on public.gap_rules (user_id);

-- -------------------------------------------------------------
-- 7. 席位与用量（商用套餐计费口径）
-- -------------------------------------------------------------
create table if not exists public.gap_seats (
  user_id     text primary key,
  plan        text default 'trial',                   -- trial/insight/team/business/enterprise
  seats       int default 1,
  quota_used  int default 0,
  quota_total int default 1000,
  updated_at  timestamptz not null default now()
);

-- =============================================================
-- 显式授权（幂等）
--   不依赖 Supabase 的 schema 默认权限，换环境重跑也成立。
--   读权限给 authenticated；写权限由 RLS 进一步收窄到「仅本人」。
--   service_role 用于采集脚本写入，本身绕过 RLS。
-- =============================================================
grant select on public.gap_events         to authenticated;
grant select on public.gap_event_sources  to authenticated;
grant select on public.gap_event_platform to authenticated;
grant select on public.gap_sources        to authenticated;

grant select, insert, update, delete on public.gap_favorites     to authenticated;
grant select, insert, update, delete on public.gap_reads         to authenticated;
grant select, insert, update, delete on public.gap_subscriptions to authenticated;
grant select, insert, update, delete on public.gap_rules         to authenticated;
grant select, insert, update, delete on public.gap_seats         to authenticated;

grant all on public.gap_events         to service_role;
grant all on public.gap_event_sources  to service_role;
grant all on public.gap_event_platform to service_role;
grant all on public.gap_sources        to service_role;
grant all on public.gap_favorites      to service_role;
grant all on public.gap_reads          to service_role;
grant all on public.gap_subscriptions  to service_role;
grant all on public.gap_rules          to service_role;
grant all on public.gap_seats          to service_role;

-- identity 列自带序列，写入方需要序列权限（service_role 采集脚本走 insert 时会用到）
grant usage, select on sequence public.gap_events_id_seq         to service_role;
grant usage, select on sequence public.gap_event_sources_id_seq  to service_role;
grant usage, select on sequence public.gap_event_platform_id_seq to service_role;

-- =============================================================
-- RLS：行级安全
-- =============================================================
alter table public.gap_events         enable row level security;
alter table public.gap_event_sources  enable row level security;
alter table public.gap_event_platform enable row level security;
alter table public.gap_sources        enable row level security;
alter table public.gap_favorites      enable row level security;
alter table public.gap_reads          enable row level security;
alter table public.gap_subscriptions  enable row level security;
alter table public.gap_rules          enable row level security;
alter table public.gap_seats          enable row level security;

-- 7.1 全局 4 张表：登录用户只读；故意不建 insert/update/delete 策略
--     （前端任何写尝试都会被 RLS 拒绝；采集脚本用 service_role 绕过 RLS 写入）
drop policy if exists gap_events_read         on public.gap_events;
drop policy if exists gap_event_sources_read  on public.gap_event_sources;
drop policy if exists gap_event_platform_read on public.gap_event_platform;
drop policy if exists gap_sources_read        on public.gap_sources;

create policy gap_events_read         on public.gap_events         for select to authenticated using (true);
create policy gap_event_sources_read  on public.gap_event_sources  for select to authenticated using (true);
create policy gap_event_platform_read on public.gap_event_platform for select to authenticated using (true);
create policy gap_sources_read        on public.gap_sources        for select to authenticated using (true);

-- 7.2 用户级 5 张表：只能操作自己的行（auth.uid()::text = user_id）
drop policy if exists gap_favorites_self     on public.gap_favorites;
drop policy if exists gap_reads_self         on public.gap_reads;
drop policy if exists gap_subscriptions_self on public.gap_subscriptions;
drop policy if exists gap_rules_self         on public.gap_rules;
drop policy if exists gap_seats_self         on public.gap_seats;

create policy gap_favorites_self     on public.gap_favorites     for all to authenticated
  using (auth.uid()::text = user_id) with check (auth.uid()::text = user_id);
create policy gap_reads_self         on public.gap_reads         for all to authenticated
  using (auth.uid()::text = user_id) with check (auth.uid()::text = user_id);
create policy gap_subscriptions_self on public.gap_subscriptions for all to authenticated
  using (auth.uid()::text = user_id) with check (auth.uid()::text = user_id);
create policy gap_rules_self         on public.gap_rules         for all to authenticated
  using (auth.uid()::text = user_id) with check (auth.uid()::text = user_id);
create policy gap_seats_self         on public.gap_seats         for all to authenticated
  using (auth.uid()::text = user_id) with check (auth.uid()::text = user_id);

-- 7.3 席位表：只允许本人（for all 策略见上）。
--     历史版本这里曾用 `for select to authenticated using (true)` 放开「读全量」，
--     那是一条真实的 IDOR：任何登录用户 select * 就能拿到全站 user_id / 套餐 / 席位 / 配额，
--     前端「只显示自己那行」不构成 API 收口。已删除该策略，管理员改走下方 security definer 函数。
drop policy if exists gap_seats_read_all on public.gap_seats;

-- =============================================================
-- 管理员看全量席位：security definer + 函数内自行校验角色
--   RLS 无法「提权」返回别人的行，只有在函数里以 definer 身份查询才安全；
--   角色判定以 app_accounts.auth_user_id = auth.uid() 为准。
-- =============================================================
create or replace function public.gapdesk_seats_admin()
returns setof public.gap_seats
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1
      from public.app_accounts a
     where a.auth_user_id = auth.uid()
       and a.role in ('admin', 'superadmin')
       and coalesce(a.disabled, false) = false
  ) then
    raise exception 'forbidden';
  end if;

  return query select * from public.gap_seats order by user_id;
end $$;

-- 前端（authenticated）可调，anon 不可调；函数内部还有一次角色校验
revoke all on function public.gapdesk_seats_admin() from public, anon;
grant execute on function public.gapdesk_seats_admin() to authenticated;

-- =============================================================
-- 清理函数：2 天滚动（事件过期即删，证据链随外键 cascade 一起走）
--   security definer：定时任务没有 auth 上下文，必须提权执行；
--   同时 revoke 全部执行权，任何前端角色都调不到。
-- =============================================================
create or replace function public.gapdesk_purge()
returns integer language plpgsql security definer
set search_path = public
as $$
declare n integer;
begin
  delete from public.gap_events where expire_at < now();
  get diagnostics n = row_count;

  -- 平台首触记录超过 48h 的也一并清（事件已被删时这里是兜底）
  delete from public.gap_event_platform
   where first_touch_ts > 0
     and first_touch_ts < (extract(epoch from now()) - 172800) * 1000;

  -- 信源健康：7 天没成功过的死源记录清掉，避免健康面板长期挂红
  delete from public.gap_sources
   where last_ok is not null and last_ok < now() - interval '7 days';

  return n;
end $$;

revoke all on function public.gapdesk_purge() from public, anon, authenticated;

-- 管理员手动清理入口：本体继续只对 service_role / security definer 开放，
-- 这里包一层函数内二次校验角色，认证用户可调用但不能越权。
-- 不改动 gapdesk_purge() 本体与它的 revoke 句。
create or replace function public.gapdesk_purge_admin()
returns integer language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  if not exists (select 1 from public.app_accounts a
      where a.auth_user_id = auth.uid()
        and a.role in ('admin','superadmin')
        and coalesce(a.disabled,false)=false) then
    raise exception 'forbidden';
  end if;
  n := public.gapdesk_purge();
  return n;
end $$;
revoke all on function public.gapdesk_purge_admin() from public, anon;
grant execute on function public.gapdesk_purge_admin() to authenticated;

-- 挂定时任务（每 30 分钟）：没有 pg_cron 就静默跳过，不报错
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    begin
      perform cron.unschedule('gapdesk_purge');   -- 重跑脚本时先卸载旧任务
    exception when others then
      null;                                        -- 旧版 pg_cron 卸载不存在的任务会抛错，忽略
    end;
    perform cron.schedule('gapdesk_purge', '*/30 * * * *', 'select public.gapdesk_purge();');
  else
    raise notice 'gapdesk: 未启用 pg_cron，跳过定时清理注册（可手动 select public.gapdesk_purge();）';
  end if;
exception when others then
  raise notice 'gapdesk: 定时任务注册失败（%），已跳过', sqlerrm;
end $$;

-- =============================================================
-- Realtime 发布：前端订阅事件/证据链/收藏/已读/订阅的实时变更
--   逐表判断是否已在发布中，避免重复 add 报错。
-- =============================================================
do $$
declare t text;
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    raise notice 'gapdesk: 未找到 supabase_realtime 发布，跳过 Realtime 注册';
    return;
  end if;

  foreach t in array array[
    'gap_events',
    'gap_event_sources',
    'gap_favorites',
    'gap_reads',
    'gap_subscriptions'
  ]
  loop
    if not exists (
      select 1 from pg_publication_tables
       where pubname = 'supabase_realtime'
         and schemaname = 'public'
         and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
exception when others then
  raise notice 'gapdesk: Realtime 注册失败（%），已跳过（不影响读写）', sqlerrm;
end $$;

-- =============================================================
-- 自检（可选，执行后看一眼结果即可，不需要保留）
-- =============================================================
-- select tablename, policyname, cmd from pg_policies where tablename like 'gap_%' order by tablename, policyname;
-- select * from pg_publication_tables where pubname = 'supabase_realtime';
