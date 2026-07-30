-- ============================================================
-- Smart Dashboard · 登录 / 超管改密码 自检脚本
-- 用途：粘贴到 Supabase SQL Editor 执行，确认以下是否正常：
--   1) admin@zxs.local 在 auth.users 是否存在 + 密码是否为 bcrypt 密文
--   2) admin 在 app_accounts 的 role / auth_user_id / 是否禁用
--   3) 超管相关函数是否都已创建
-- 执行后看下方三个结果集，对照“期望”判断。
-- ============================================================

-- ① auth.users 里的 admin（期望：1 行；password_status 显示 OK）
select
  email,
  case
    when encrypted_password like '$2%' then 'OK · bcrypt密文'
    else '异常 · 疑似明文/未设置'
  end as password_status,
  email_confirmed_at,
  last_sign_in_at
from auth.users
where email = 'admin@zxs.local';

-- ② app_accounts 里的 admin（期望：role=superadmin，auth_user_id 不为空，disabled=false）
select id, username, role, auth_user_id, disabled
from app_accounts
where username = 'admin';

-- ③ 关键函数是否存在（期望：列出 admin_set_user_password / is_superadmin / update_account_by_admin 等）
select proname as function_name,
       pg_get_function_identity_arguments(oid) as args
from pg_proc
where proname in (
  'admin_set_user_password',
  'is_superadmin',
  'update_account_by_admin',
  'create_account_by_admin',
  'set_account_disabled',
  'delete_account_by_admin'
)
order by proname;
