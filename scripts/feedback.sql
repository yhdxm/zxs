-- ============================================================
-- Smart Dashboard · 意见反馈模块建表
-- 用途：子账号提交意见反馈；超级管理员查看、回复、流转状态。
-- 用法：Supabase 后台 → SQL Editor 粘贴执行本文件（一次性，可重复执行）。
-- 说明：本项目为「自建账号表 + 纯前端」架构，客户端以 anon 角色连接，
--        行级隔离统一在【应用层】按当前登录账号 id 过滤（与 learnDb.ts / third_party_api.sql 一致）。
--        数据库层 RLS 对 anon 开放读写，仅保证表存在、策略不阻断。
-- 免费：不使用 Supabase Storage，附件为前端压缩后的小图 base64，直接存 jsonb，
--        单张 ≤120KB、每条反馈最多 3 张，容量可控，不产生任何付费额度。
-- ============================================================

-- 1. 反馈主表
--    user_id      提交人账号 id（应用层隔离键；普通账号只查自己的）
--    status       pending 待处理 / processing 处理中 / replied 已回复 / closed 已关闭
--    category     suggestion 功能建议 / bug 问题反馈 / complaint 投诉 / other 其他
--    priority     low 低 / normal 普通 / high 高 / urgent 紧急
--    close_reason 关闭原因：仅管理端可见，用户端不查询该字段
--    attachments  jsonb 数组：[{ name, size, dataUrl }]
create table if not exists feedbacks (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  username text not null default '',
  nickname text not null default '',
  title text not null,
  category text not null default 'suggestion',
  priority text not null default 'normal',
  content text not null default '',
  contact text not null default '',
  anonymous boolean not null default false,
  status text not null default 'pending',
  close_reason text not null default '',
  attachments jsonb not null default '[]'::jsonb,
  reply_count integer not null default 0,
  admin_unread boolean not null default true,
  user_unread boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  replied_at timestamptz
);
create index if not exists feedbacks_user_idx on feedbacks(user_id, created_at desc);
create index if not exists feedbacks_status_idx on feedbacks(status, created_at desc);
alter table feedbacks enable row level security;
drop policy if exists "feedbacks anon rw" on feedbacks;
create policy "feedbacks anon rw"
  on feedbacks for all
  using (true) with check (true);

-- 2. 反馈回复表
--    internal = true 为内部备注，仅管理端可见，用户端不查询
create table if not exists feedback_replies (
  id uuid primary key default gen_random_uuid(),
  feedback_id uuid not null references feedbacks(id) on delete cascade,
  author_id text not null,
  author_name text not null default '',
  author_role text not null default 'user',
  content text not null,
  internal boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists feedback_replies_fid_idx on feedback_replies(feedback_id, created_at asc);
alter table feedback_replies enable row level security;
drop policy if exists "feedback_replies anon rw" on feedback_replies;
create policy "feedback_replies anon rw"
  on feedback_replies for all
  using (true) with check (true);

-- 3. 说明：新表已同步登记到「数据库监测中心」
--    - appDataService.ts getDatabaseStats 降级清单
--    - DatabaseCheckView.vue TABLE_DESC 中文说明
--    get_database_stats() RPC 通过 pg_stat_user_tables 自动枚举，无需改动。
