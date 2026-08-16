-- ============================================================
-- 学位英语备考台 · 数据库结构（个人学习态 + 资料元数据）
-- 说明：
--   1. 内容数据（词库 / 题库 / 词组）已新增为内容表（degree_words/degree_questions/degree_phrases），
--      由前端「首次运行 lazy-seed」批量注入 Supabase；云端为空或不可达时回退前端内置种子（离线可用）。
--   2. 个人数据（进度 / 错题 / 收藏笔记 / 设置 / 资料元数据 / 模考记录 / 学习计划）入库，按 user_id 隔离。
--   3. 本项目为「自建账号表 + 纯前端」架构（非 Supabase Auth），
--      沿用既有表策略：对 anon / authenticated 放开增删改查 + grant，
--      由应用层按 user_id 过滤实现数据隔离（已知安全债务，与现有表一致）。
-- 执行位置：Supabase Dashboard → SQL Editor → New query → 粘贴 → Run
-- ============================================================

-- ---------- 1. 用户设置（目标院校 / 考试日 / 每日新词 / 连续天数） ----------
create table if not exists public.degree_settings (
  user_id       text        primary key,
  target_school text,                                 -- 目标院校，如 商丘师范学院继续教育学院
  exam_date     date,
  new_per_day   int         not null default 15,
  manual_streak int,                                  -- 手动校准连续学习天数；null 时按打卡自动算
  linked_goal   text,
  updated_at    timestamptz not null default now()
);

-- ---------- 2. 单词进度（按 user_id 隔离，艾宾浩斯复习） ----------
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
-- 学位英语 2.0 · 内容数据落地数据库（词库 / 题库 / 词组）
--   说明：原本词/题/词组为前端内置种子（TS 文件，不入库）。
--   现新增内容表，由前端「首次运行 lazy-seed」批量 upsert 注入 Supabase，
--   云端为空或不可达时回退前端种子（离线可用）。详见 src/prep/degreeDb.ts。
-- ============================================================

-- ---------- 7. 词库（内容数据） ----------
create table if not exists public.degree_words (
  word         text        primary key,
  phonetic     text        not null default '',
  pos          text        not null default '',
  definition   text        not null,
  productive   boolean     not null default false,   -- 复用式掌握（大纲词表带 * 号）
  source_page  int,
  source_books text[]      not null default '{}'     -- 来源 PDF 标签：考试大纲 / 复习指南 / 模拟试卷
);
create index if not exists degree_words_productive_idx on public.degree_words (productive);

-- ---------- 8. 题库（内容数据） ----------
create table if not exists public.degree_questions (
  id               text        primary key,
  type             text        not null,   -- dialogue | reading | vocab_grammar | translation | writing
  stem             text        not null,
  passage          text,                     -- 阅读/翻译原文（选择题可能含短文）
  options          text[],                   -- 选择题选项（A/B/C/D）
  answer           text        not null,     -- 选择题为选项字母；翻译/写作为参考答案
  explanation      text        not null default '',
  difficulty       int,
  paper_id         text,
  source_book      text,                      -- 来源 PDF 名
  source_page      int,
  source_section   text,                      -- 章节 / 题型 / 套卷
  source_generated boolean     not null default false,  -- true=依据大纲生成；false=PDF 原题
  source_basis     text                       -- 人类可读来源，如「模拟试卷 第1套 原题」
);
create index if not exists degree_questions_type_idx on public.degree_questions (type);
create index if not exists degree_questions_paper_idx on public.degree_questions (paper_id);

-- ---------- 9. 语句 / 词组（内容数据，来自大纲附录二~八） ----------
create table if not exists public.degree_phrases (
  id          text        primary key,
  category    text        not null,   -- phrase | spoken | affix | irregular
  en          text        not null,
  zh          text,
  extra       text,                    -- irregular=过去式/过去分词；affix=例词；spoken=分类名
  productive  boolean     not null default false,
  source_page int
);
create index if not exists degree_phrases_category_idx on public.degree_phrases (category);

-- ---------- 10. 模拟考试记录（个人数据，按 user_id 隔离） ----------
create table if not exists public.degree_exam_records (
  id         text        primary key,
  user_id    text        not null,
  paper_id   text,
  total      int         not null default 0,
  correct    int         not null default 0,
  duration   int,                      -- 用时（秒）
  answers    jsonb,                    -- { questionId: userAnswer }
  created_at timestamptz not null default now()
);
create index if not exists degree_exam_records_user_idx on public.degree_exam_records (user_id, created_at);

-- ============================================================
-- RLS（纯前端自建账号架构，与现有表一致）
--   - 个人数据表（materials/settings/.../exam_records/study_plans）：
--       对 anon/authenticated 放开 all + grant，由应用层按 user_id 过滤隔离（已知安全债务）。
--   - 内容数据表（words/questions/phrases）：
--       全局只读参考库，放开 select/insert/update（供首次 lazy-seed 注入），
--       不授权 delete，防止内容被任意清空。
-- ============================================================

-- 个人数据表：all + grant
alter table public.degree_settings       enable row level security;
alter table public.degree_word_progress  enable row level security;
alter table public.degree_practice       enable row level security;
alter table public.degree_mistakes       enable row level security;
alter table public.degree_favorites      enable row level security;
alter table public.degree_exam_records   enable row level security;

do $$
declare t text;
begin
  foreach t in array     array[
      'degree_settings','degree_word_progress',
      'degree_practice','degree_mistakes','degree_favorites',
      'degree_exam_records'
    ]
  loop
    execute format('drop policy if exists %I on public.%I;', t || '_all', t);
    execute format(
      'create policy %I on public.%I for all to anon, authenticated using (true) with check (true);',
      t || '_all', t
    );
  end loop;
end $$;

grant select, insert, update, delete on public.degree_settings       to anon, authenticated;
grant select, insert, update, delete on public.degree_word_progress  to anon, authenticated;
grant select, insert, update, delete on public.degree_practice       to anon, authenticated;
grant select, insert, update, delete on public.degree_mistakes       to anon, authenticated;
grant select, insert, update, delete on public.degree_favorites      to anon, authenticated;
grant select, insert, update, delete on public.degree_exam_records   to anon, authenticated;

-- 内容数据表：select / insert / update（无 delete）
alter table public.degree_words      enable row level security;
alter table public.degree_questions  enable row level security;
alter table public.degree_phrases    enable row level security;

do $$
declare t text;
begin
  foreach t in array array['degree_words','degree_questions','degree_phrases']
  loop
    execute format('drop policy if exists %I on public.%I;', t || '_select', t);
    execute format('drop policy if exists %I on public.%I;', t || '_insert', t);
    execute format('drop policy if exists %I on public.%I;', t || '_update', t);
    execute format('create policy %I on public.%I for select to anon, authenticated using (true);', t || '_select', t);
    execute format('create policy %I on public.%I for insert to anon, authenticated with check (true);', t || '_insert', t);
    execute format('create policy %I on public.%I for update to anon, authenticated using (true) with check (true);', t || '_update', t);
  end loop;
end $$;

grant select, insert, update on public.degree_words      to anon, authenticated;
grant select, insert, update on public.degree_questions  to anon, authenticated;
grant select, insert, update on public.degree_phrases    to anon, authenticated;
