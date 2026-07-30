-- ============================================================
-- Smart Dashboard · 登录 / 超管改密码 自检（单结果集版）
-- 说明：Supabase SQL Editor 默认只显示【最后一个】SELECT 的结果，
--       所以把三处检查合并成一个结果集，一次 Run 全部可见。
-- 用法：粘贴全部内容到 SQL Editor → Run → 看下方一张表（5 行）。
-- ============================================================
with base as ( select 1 as x )

select '① admin密码状态' as 检查项,
       case
         when u.encrypted_password like '$2%' then 'OK · bcrypt密文'
         when u.email is null then '异常 · admin账号不存在'
         else '异常 · 疑似明文/未设置'
       end as 结果
from base
left join auth.users u on u.email = 'admin@zxs.local'

union all
select '② admin角色',
       coalesce(a.role, '缺失 · 无此账号')
from base
left join app_accounts a on a.username = 'admin'

union all
select '② 是否禁用',
       case when a.disabled then '危险 · 已禁用' else '正常 · 未禁用' end
from base
left join app_accounts a on a.username = 'admin'

union all
select '② auth_user_id绑定',
       case when a.auth_user_id is not null then '已绑定' else '危险 · 未绑定' end
from base
left join app_accounts a on a.username = 'admin'

union all
select '③ 关键函数',
       (select count(*)::text from pg_proc
        where proname in ('admin_set_user_password','is_superadmin',
                          'update_account_by_admin','create_account_by_admin',
                          'set_account_disabled','delete_account_by_admin'))
       || ' / 6 已创建'
from base;
