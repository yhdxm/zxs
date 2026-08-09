-- ============================================================
-- 四六级备考台 · 数据库结构
-- 说明：本脚本仅创建表 / 索引 / RLS 策略。词库（cet4_words）的
--       全量数据通过应用内「我的 → 管理员导入词库」上传（见
--       src/services/cetPrepService.ts 的 seedMasterWords），
--       不在此处手工 INSERT（避免 4000 行硬编码）。
-- ============================================================

-- ---------- 1. 主词表（全量四级词，公开只读，仅管理员写入） ----------
create table if not exists public.cet4_words (
  id          bigint generated always as identity primary key,
  word        text        not null unique,
  phonetic    text,
  pos         text,
  definition  text,
  collocation text,
  created_at  timestamptz not null default now()
);
create index if not exists cet4_words_word_idx on public.cet4_words (word);

-- ---------- 2. 用户单词进度（按 user_id 隔离） ----------
create table if not exists public.cet4_prep_progress (
  user_id           text        not null,
  word              text        not null,
  status            text        not null default 'new',   -- new | learning | graduated
  level             int         not null default 0,
  due               date,
  wrong_streak      int         not null default 0,
  wrong_streak_date date,
  weak              boolean     not null default false,
  first_issued      date,
  last_reviewed     date,
  updated_at        timestamptz not null default now(),
  primary key (user_id, word)
);

-- ---------- 3. 刷题记录 ----------
create table if not exists public.cet4_prep_practice (
  id         text        not null,
  user_id    text        not null,
  type       text        not null,   -- listening | reading | writing | translate
  total      int         not null default 0,
  correct    int         not null default 0,
  date       date        not null,
  sample     boolean     not null default false,
  created_at timestamptz not null default now()
);
create index if not exists cet4_prep_practice_user_idx on public.cet4_prep_practice (user_id, date);

-- ---------- 4. 错题本 ----------
create table if not exists public.cet4_prep_mistakes (
  id         text        not null,
  user_id    text        not null,
  type       text,
  reason     text,
  approach   text,
  level      int         not null default 0,
  due        date,
  removed    boolean     not null default false,
  sample     boolean     not null default false,
  date       date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists cet4_prep_mistakes_user_idx on public.cet4_prep_mistakes (user_id, due);

-- ---------- 5. 打卡（按 日期 聚合） ----------
create table if not exists public.cet4_prep_checkins (
  user_id text    not null,
  date    date    not null,
  words   int     not null default 0,
  practice int    not null default 0,
  primary key (user_id, date)
);

-- ---------- 6. 用户设置（每日新词数 / 考试日 / 关联目标） ----------
create table if not exists public.cet4_prep_settings (
  user_id      text        primary key,
  new_per_day  int         not null default 10,
  exam_date    date,
  linked_goal  text,
  updated_at   timestamptz not null default now()
);

-- ============================================================
-- RLS：本项目为「自建账号表 + 纯前端」架构（非 Supabase Auth），
--      故沿用既有表的策略——对 anon 放开增删改查，由应用层按
--      user_id 过滤实现数据隔离。这是已知安全债务（与现有表一致），
--      后续若迁移到 Supabase Auth 可收紧为 auth.uid() = user_id。
-- ============================================================
alter table public.cet4_words            enable row level security;
alter table public.cet4_prep_progress    enable row level security;
alter table public.cet4_prep_practice    enable row level security;
alter table public.cet4_prep_mistakes    enable row level security;
alter table public.cet4_prep_checkins    enable row level security;
alter table public.cet4_prep_settings    enable row level security;

do $$
declare t text;
begin
  foreach t in array array['cet4_words','cet4_prep_progress','cet4_prep_practice','cet4_prep_mistakes','cet4_prep_checkins','cet4_prep_settings']
  loop
    execute format('drop policy if exists %I on public.%I;', t||'_anon_all', t);
    execute format(
      'create policy %I on public.%I for all to anon using (true) with check (true);',
      t||'_anon_all', t
    );
  end loop;
end $$;

-- 主词表允许匿名只读（读词库无需登录）；写由应用层管理员导入时仍走 anon。
-- 如需更严格，可把 cet4_words 的 select 策略单独收紧，此处保持与项目一致。
