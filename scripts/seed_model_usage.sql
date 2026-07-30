-- =============================================================
-- 阿里百炼免费模型额度初始化（精确设置「已用」数量）
-- 运行方式：Supabase 控制台 → SQL Editor → New query → 粘贴本文件 → Run
-- 幂等：重复运行不会累加，直接 SET 精确值（ON CONFLICT DO UPDATE）。
-- 作用对象：所有 role = 'superadmin' 的账号。
--   说明：模型中心按账号隔离显示，超管为主视角；其余账号各自独立，不共享此额度。
-- 计算规则：剩余 = 免费额度(1,000,000) - 已用(used_tokens)
-- =============================================================

insert into model_usage (user_id, model_id, used_tokens, free_quota, free_until)
select
  a.auth_user_id,
  v.model_id,
  v.used,
  1000000,
  '2026-09-20 23:59:59+08'
from app_accounts a
cross join (values
  ('bailian:qwen3.7-plus',                      992192),  -- 剩 7,808（已含一次 4,048 tokens 真实调用）
  ('bailian:deepseek-v4-pro',                   71761),   -- 剩 928,239
  ('bailian:qwen-max',                         27907),   -- 剩 972,093
  ('bailian:qwen-plus',                        24171),   -- 剩 975,829
  ('bailian:deepseek-r1',                      19852),   -- 剩 980,148
  ('bailian:qwen-turbo',                       14905),   -- 剩 985,095
  ('bailian:qwen-math-turbo',                  10512),   -- 剩 989,488
  ('bailian:deepseek-v3',                       7424),   -- 剩 992,576
  ('bailian:qwen-flash-character-2026-02-26',    2907),  -- 剩 997,093
  ('bailian:qwen-long',                          1994),  -- 剩 998,006
  ('bailian:qwen3.5-ocr',                        1026)   -- 剩 998,974
) as v(model_id, used)
where a.role = 'superadmin'
  and a.auth_user_id is not null
on conflict (user_id, model_id)
do update set
  used_tokens = excluded.used_tokens,
  free_quota  = excluded.free_quota,
  free_until  = excluded.free_until,
  updated_at  = now();

-- 校验：列出已写入的 11 个模型（剩余 = free_quota - used_tokens）
select
  u.user_id,
  u.model_id,
  u.used_tokens,
  u.free_quota,
  (u.free_quota - u.used_tokens) as remaining,
  case
    when u.used_tokens = 0 then '未使用'
    when (u.free_quota - u.used_tokens) < 10000 then '快用完(红)'
    else '正常'
  end as status
from model_usage u
where u.model_id in (
  'bailian:qwen3.7-plus',
  'bailian:deepseek-v4-pro',
  'bailian:qwen-max',
  'bailian:qwen-plus',
  'bailian:deepseek-r1',
  'bailian:qwen-turbo',
  'bailian:qwen-math-turbo',
  'bailian:deepseek-v3',
  'bailian:qwen-flash-character-2026-02-26',
  'bailian:qwen-long',
  'bailian:qwen3.5-ocr'
)
order by u.model_id;
