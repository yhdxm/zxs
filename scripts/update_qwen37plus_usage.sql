-- 补丁：把 qwen3.7-plus 已用额度更新为 992,192（剩余 7,808）
-- 适用场景：已经跑过 seed_model_usage.sql 后，又发生了一次 4,048 tokens 的真实调用
update model_usage
set
  used_tokens = 992192,
  updated_at  = now()
where model_id = 'bailian:qwen3.7-plus'
  and free_quota = 1000000;

-- 校验
select
  model_id,
  used_tokens,
  (free_quota - used_tokens) as remaining
from model_usage
where model_id = 'bailian:qwen3.7-plus';
