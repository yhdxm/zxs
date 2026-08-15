-- ============================================================
-- 学位英语备考台 · 数据库结构（个人学习态 + 资料元数据）
-- 说明：
--   1. 内容数据（4400 词 / 题库 / 5 套模拟卷）为前端内置种子（TS 文件），
--      不入库，保证离线可用、不依赖远程加载（与四六级 4544 词 bundle 思路一致）。
--   2. 仅「个人进度 / 错题 / 收藏笔记 / 设置 / 资料元数据」入库，按 user_id 隔离。
--   3. 本项目为「自建账号表 + 纯前端」架构（非 Supabase Auth），
--      沿用既有表策略：对 anon / authenticated 放开增删改查 + grant，
--      由应用层按 user_id 过滤实现数据隔离（已知安全债务，与现有表一致）。
-- 执行位置：Supabase Dashboard → SQL Editor → New query → 粘贴 → Run
-- ============================================================

-- ---------- 1. 资料元数据（三本 PDF / 题库版本等） ----------
create table if not exists public.degree_materials (
  id          text        primary key,
  title       text        not null,
  author      text,
  kind        text        not null default 'pdf',   -- pdf | bank
  pages       int,
  file_path   text,                                  -- public/pdfs/degree/xxx.pdf
  remark      text,
  created_at  timestamptz not null default now()
);

-- ---------- 2. 用户设置（目标院校 / 考试日 / 每日新词 / 连续天数） ----------
create table if not exists public.degree_settings (
  user_id       text        primary key,
  target_school text,                                 -- 目标院校，如 商丘师范学院继续教育学院
  exam_date     date,
  new_per_day   int         not null default 15,
  manual_streak int,                                  -- 手动校准连续学习天数；null 时按打卡自动算
  linked_goal   text,
  updated_at    timestamptz not null default now()
);

-- ---------- 3. 单词进度（按 user_id 隔离，艾宾浩斯复习） ----------
create table if not exists public.degree_word_progress (
  user_id      text        not null,
  word         text        not null,
  status       text        not null default 'new',   -- new | learning | graduated
  level        int         not null default 0,
  due          date,
  wrong_streak int         not null default 0,
  weak         boolean     not null default false,
  updated_at   timestamptz not null default now(),
  primary key (user_id, word)
);

-- ---------- 4. 刷题 / 练习记录 ----------
create table if not exists public.degree_practice (
  id         text        not null,
  user_id    text        not null,
  type       text        not null,   -- dialogue | reading | vocab_grammar | translation | writing
  total      int         not null default 0,
  correct    int         not null default 0,
  date       date        not null,
  created_at timestamptz not null default now()
);
create index if not exists degree_practice_user_idx on public.degree_practice (user_id, date);
-- 唯一索引：使 cloudInsert 的 upsert(onConflict:'id') 幂等（离线重试不重复落库）
create unique index if not exists degree_practice_id_uidx on public.degree_practice (id);

-- ---------- 5. 错题本 ----------
create table if not exists public.degree_mistakes (
  id          text        primary key,
  user_id     text        not null,
  question_id text,
  type        text,
  user_answer text,
  reason      text,                                 -- 错因 / 正确思路
  due         date,
  removed     boolean     not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists degree_mistakes_user_idx on public.degree_mistakes (user_id, due);

-- ---------- 6. 收藏 / 笔记 / 生词本（统一表，kind 区分） ----------
create table if not exists public.degree_favorites (
  id         text        primary key,
  user_id    text        not null,
  kind       text        not null,   -- note | collection | word
  ref_id     text,                   -- 关联 word / question id
  title      text,
  content    text,
  removed    boolean     not null default false,  -- 软删兜底：跨设备/清缓存删除一致（A2 数据可靠性加固）
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index if not exists degree_favorites_user_idx on public.degree_favorites (user_id, kind);

-- ============================================================
-- RLS：对 anon / authenticated 放开 all + grant（纯前端自建账号架构）
-- ============================================================
alter table public.degree_materials      enable row level security;
alter table public.degree_settings       enable row level security;
alter table public.degree_word_progress  enable row level security;
alter table public.degree_practice       enable row level security;
alter table public.degree_mistakes       enable row level security;
alter table public.degree_favorites      enable row level security;

do $$
declare t text;
begin
  foreach t in array array[
    'degree_materials','degree_settings','degree_word_progress',
    'degree_practice','degree_mistakes','degree_favorites'
  ]
  loop
    execute format('drop policy if exists %I on public.%I;', t || '_all', t);
    execute format(
      'create policy %I on public.%I for all to anon, authenticated using (true) with check (true);',
      t || '_all', t
    );
  end loop;
end $$;

grant select, insert, update, delete on public.degree_materials      to anon, authenticated;
grant select, insert, update, delete on public.degree_settings       to anon, authenticated;
grant select, insert, update, delete on public.degree_word_progress  to anon, authenticated;
grant select, insert, update, delete on public.degree_practice       to anon, authenticated;
grant select, insert, update, delete on public.degree_mistakes       to anon, authenticated;
grant select, insert, update, delete on public.degree_favorites      to anon, authenticated;
