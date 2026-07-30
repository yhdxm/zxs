-- ============================================================
-- 超级管理员重置任意用户密码（仅 superadmin 可调用）
-- 背景：前端只有 anon key，无法直接调用 Supabase Auth 的
--       service_role admin API 改他人密码。
-- 本函数以 SECURITY DEFINER（postgres 权限）执行，
-- 在函数内部用 auth.uid() 校验调用者是否为 superadmin，
-- 通过后才更新 auth.users 的 bcrypt 密文。
-- 用法：在 Supabase SQL Editor 执行一次即可（幂等，可重复运行）。
-- 前端：账号管理 → 编辑账号 → 填新密码 → 保存，会调用此函数。
-- ============================================================
create or replace function public.admin_set_user_password(
  p_target_user_id uuid,
  p_new_password text
)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_caller_role text;
begin
  -- 必须是已登录会话（JWT 携带 uid）
  if auth.uid() is null then
    raise exception '未登录或会话无效';
  end if;

  -- 调用者必须是超级管理员
  select role into v_caller_role
  from public.app_accounts
  where id = auth.uid();

  if v_caller_role is distinct from 'superadmin' then
    raise exception '仅超级管理员可重置他人密码';
  end if;

  -- 目标用户必须存在
  if not exists (select 1 from auth.users where id = p_target_user_id) then
    raise exception '目标用户不存在';
  end if;

  -- 密码强度校验
  if p_new_password is null or length(p_new_password) < 6 or length(p_new_password) > 32 then
    raise exception '密码长度需为 6-32 位';
  end if;

  -- 直接更新 Supabase Auth 的密码（bcrypt 密文，立即生效）
  update auth.users
  set encrypted_password = crypt(p_new_password, gen_salt('bf')),
      updated_at = now()
  where id = p_target_user_id;
end;
$$;

-- 仅允许已登录（携带有效 JWT）的调用；函数内部再做 superadmin 校验
grant execute on function public.admin_set_user_password(uuid, text) to authenticated;
