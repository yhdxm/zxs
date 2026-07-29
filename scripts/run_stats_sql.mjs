// 执行 Supabase 统计函数 SQL（需在 Supabase 后台手动执行同款时可用此脚本替代）
// 用法：SUPABASE_DB_URL="postgresql://postgres:密码@db.xxx.supabase.co:5432/postgres" node scripts/run_stats_sql.mjs
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import pg from 'pg'

const __dirname = dirname(fileURLToPath(import.meta.url))
const sqlPath = join(__dirname, 'supabase_stats.sql')
const sql = readFileSync(sqlPath, 'utf-8')

const url = process.env.SUPABASE_DB_URL
if (!url) {
  console.error('缺少环境变量 SUPABASE_DB_URL')
  process.exit(2)
}

const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } })
try {
  await client.connect()
  await client.query(sql)
  const { rows } = await client.query('select get_database_stats() as result')
  console.log('SQL 执行成功，函数已创建。')
  console.log('当前统计预览：', JSON.stringify(rows[0].result, null, 2))
} catch (err) {
  console.error('执行失败：', err.message)
  process.exit(1)
} finally {
  await client.end()
}
