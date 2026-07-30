-- ============================================================
-- 重置默认管理员（admin@zxs.local）登录密码
-- 适用场景：忘记密码 / 在别处改过但登录失败（密码没写进 Supabase Auth）
-- 用法：
--   1) 打开 Supabase 控制台 → SQL Editor
--   2) 把下面 <在此填入你想设置的新密码> 替换成你的新密码（保留两侧单引号）
--   3) 执行本脚本
--   4) 回到应用用 admin + 新密码登录，立即生效
-- 注意：本脚本直接更新 auth.users 的 bcrypt 密文。
--       千万不要用 UPDATE ... SET encrypted_password = '明文'，
--       那会让密码永远不匹配，导致登录失败。
-- ============================================================
update auth.users
set encrypted_password = crypt('<在此填入你想设置的新密码>', gen_salt('bf')),
    updated_at = now(),
    -- 清除可能的"邮箱未确认"拦截（首次部署时常见）
    email_confirmed_at = coalesce(email_confirmed_at, now())
where email = 'admin@zxs.local';

-- 验证：应返回 1 行（admin@zxs.local），且 email_confirmed_at 不为空
select email, email_confirmed_at
from auth.users
where email = 'admin@zxs.local';
