import { createClient } from '@supabase/supabase-js'

// 仅从环境变量读取（node --env-file=.env），禁止硬编码
const url = process.env.VITE_SUPABASE_URL
const key = process.env.VITE_SUPABASE_ANON_KEY
if (!url || !key) {
  console.error('[verify-rpc] 缺少 VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY')
  process.exit(1)
}
const supabase = createClient(url, key)

// 复刻前端 getDatabaseStats 的取数逻辑（不再用 maybeSingle，防御性解析两种形状）
const { data, error } = await supabase.rpc('get_database_stats')
const raw = data ?? null
const payload =
  raw && typeof raw === 'object' && 'get_database_stats' in raw && raw.get_database_stats
    ? raw.get_database_stats
    : raw

console.log('=== RPC 调用结果 ===')
if (error) {
  console.log('RPC error:', error.message)
  process.exit(2)
}
if (!payload) {
  console.log('RPC 返回空 payload（函数可能未创建或权限不足）')
  process.exit(3)
}

const dbSize = Number(payload.db_size_bytes) || 0
let tables = Array.isArray(payload.tables) ? payload.tables : []
// 复刻前端逻辑：RPC 已按 schemaname='public' 过滤；再做同名去重（优先 rls=true）+ 跳过 Supabase 系统表
const SYSTEM_TABLES = new Set([
  'schema_migrations', 'supabase_migrations', 'migrations', 'audit_log_entries', 'instances',
  'users', 'refresh_tokens', 'one_time_tokens', 'sessions', 'identities', 'mfa_factors',
  'mfa_amr_claims', 'mfa_challenges', 'flow_state', 'saml_providers', 'saml_relay_states',
  'sso_providers', 'sso_domains', 'oauth_providers', 'oauth_clients', 'oauth_consents',
  'oauth_authorizations', 'oauth_client_states', 'custom_oauth_providers', 'webauthn_credentials',
  'webauthn_challenges', 'subscription', 'secrets', 'objects', 'buckets', 'buckets_analytics',
  'buckets_vectors', 's3_multipart_uploads', 's3_multipart_uploads_parts', 'vector_indexes', 'user_info'
])
const byName = new Map()
for (const t of tables) {
  if (SYSTEM_TABLES.has(t.name)) continue
  const prev = byName.get(t.name)
  if (!prev || (prev.rls_enabled !== true && t.rls_enabled === true)) byName.set(t.name, t)
}
tables = [...byName.values()]
console.log('db_size_bytes :', dbSize, '(', (dbSize / 1024 / 1024).toFixed(2), 'MB )')
console.log('业务表数量（已过滤系统表+去重） :', tables.length)
console.log('--- 各表 (name / rows / size_bytes / rls_enabled) ---')
for (const t of tables) {
  console.log(
    `  ${String(t.name).padEnd(22)} rows=${String(t.rows).padStart(6)}  size=${String(t.size_bytes || 0).padStart(10)}  rls=${t.rls_enabled}`
  )
}

// 校验前端会怎么解析：rls_enabled 是否为布尔
const rlsTrue = tables.filter((t) => t.rls_enabled === true).length
const rlsFalse = tables.filter((t) => t.rls_enabled === false).length
const rlsUnknown = tables.length - rlsTrue - rlsFalse
console.log('--- 前端解析校验（仅业务表） ---')
console.log(`  RLS 已启用: ${rlsTrue}  未启用(真问题): ${rlsFalse}  未知: ${rlsUnknown}`)
console.log('  未开 RLS 的业务表:', rlsFalse ? tables.filter((t) => t.rls_enabled === false).map((t) => t.name).join(', ') : '无')
console.log('  结论:', dbSize > 0 && tables.length > 0 ? '✅ RPC 正常，全面监测数据链路已通' : '⚠️ 数据为空，请确认 SQL 已执行')
