-- ============================================================
-- 四六级备考台 · RLS 策略修复
-- 用途：为 6 张备考表建立对所有角色生效的 all 策略，解决
--       "new row violates row-level security policy" / 403 Forbidden。
-- 执行位置：Supabase Dashboard → SQL Editor → New query → 粘贴 → Run
-- ============================================================

-- 确保 RLS 已开启
alter table if exists public.cet4_words            enable row level security;
alter table if exists public.cet4_prep_progress    enable row level security;
alter table if exists public.cet4_prep_practice    enable row level security;
alter table if exists public.cet4_prep_mistakes    enable row level security;
alter table if exists public.cet4_prep_checkins    enable row level security;
alter table if exists public.cet4_prep_settings    enable row level security;

-- 删除旧策略，避免冲突
DO $$
declare t text;
begin
  foreach t in array array[
    'cet4_words',
    'cet4_prep_progress',
    'cet4_prep_practice',
    'cet4_prep_mistakes',
    'cet4_prep_checkins',
    'cet4_prep_settings'
  ]
  loop
    execute format('drop policy if exists %I on public.%I;', t || '_anon_all', t);
    execute format('drop policy if exists %I on public.%I;', t || '_all', t);
  end loop;
end $$;

-- 创建对所有角色生效的策略
DO $$
declare t text;
begin
  foreach t in array array[
    'cet4_words',
    'cet4_prep_progress',
    'cet4_prep_practice',
    'cet4_prep_mistakes',
    'cet4_prep_checkins',
    'cet4_prep_settings'
  ]
  loop
    execute format(
      'create policy %I on public.%I for all using (true) with check (true);',
      t || '_all', t
    );
  end loop;
end $$;

-- 确保 anon / authenticated 都有表级增删改查权限
grant select, insert, update, delete on public.cet4_words            to anon, authenticated;
grant select, insert, update, delete on public.cet4_prep_progress    to anon, authenticated;
grant select, insert, update, delete on public.cet4_prep_practice    to anon, authenticated;
grant select, insert, update, delete on public.cet4_prep_mistakes    to anon, authenticated;
grant select, insert, update, delete on public.cet4_prep_checkins    to anon, authenticated;
grant select, insert, update, delete on public.cet4_prep_settings    to anon, authenticated;
