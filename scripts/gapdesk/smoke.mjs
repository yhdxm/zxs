#!/usr/bin/env node
/* =========================================================
   GAPDESK 采集管道 · 冒烟测试（不写库）
   ---------------------------------------------------------
   用法：
     node scripts/gapdesk/smoke.mjs                  # 全量 25 路，只跑链路，不写库（默认）
     node scripts/gapdesk/smoke.mjs --limit 8        # 只跑注册表前 8 路（快速验通）
     node scripts/gapdesk/smoke.mjs --fixture x.json # 用本地 raw 快照做回归，不碰网络
     node scripts/gapdesk/smoke.mjs --live           # 真实写库（需 SUPABASE_* + CI=true 或 --force）
   ---------------------------------------------------------
   输出：漏斗 → 前 10 条（标题/行业/gap/差值/时差）→ 各源健康（失败的如实标 DOWN）
        → 末尾跑 eventKeyOf 一致性断言（mjs 版 vs src/utils/gapdeskFormat.ts 的期望值）
   ========================================================= */
import { readFile } from 'node:fs/promises'

import { runPipeline, collectOnce, GAP_MIN_SHOW } from './collect.mjs'
import { eventKeyOf } from './cluster.mjs'

/**
 * eventKeyOf 一致性基线。
 * 期望值由 `src/utils/gapdeskFormat.ts` 的 eventKeyOf() 逐条算出后**写死**在这里，
 * 目的：任何一侧（mjs / ts）改动归一化或哈希实现，冒烟立刻报红。
 * 归一化口径：小写 → 去所有空白 → 取前 28 字符 → FNV-1a 32 位 → (h>>>0).toString(16)（不补零）
 */
const KEY_BASELINE = [
  ['券商交易外接新规首次明确私募接入标准', 'dab9c9b1'],
  ['OpenAI 发布 GPT-5 新模型', '16ea9c52'],
  ['长鑫存储', '1cf39577'],
  ['国家能源局：2027 年光伏装机目标上调至 3.5 亿千瓦', 'c94821e4'],
  ['TSMC to build new fab in Arizona', 'e629cafd'],
]

function parseArgs(argv) {
  const args = argv.slice(2)
  const get = (flag, def = null) => {
    const i = args.indexOf(flag)
    return i >= 0 && args[i + 1] ? args[i + 1] : def
  }
  return {
    live: args.includes('--live'),
    limit: Number(get('--limit', '0')) || 0,
    fixture: get('--fixture'),
  }
}

/** 打印一行事件（紧凑，便于 Actions 日志里扫读） */
function row(i, e) {
  const ind = String(e.ind).padEnd(4)
  const div = String(e.div).padStart(3)
  const lag = `${e.lag_h.toFixed(1)}h`.padStart(5)
  const srcN = `${e.src_count}源`.padStart(3)
  const title = e.title.length > 42 ? `${e.title.slice(0, 42)}…` : e.title
  const tag = e.tier === 'L0' ? '★' : ' '
  return `${String(i).padStart(2)} ${tag} gap=${String(e.gap).padStart(2)} 差值=${div} 时差=${lag} ${ind} ${srcN} ${title}`
}

function printSources(health) {
  const ok = health.filter((h) => h.status === 'ok')
  const down = health.filter((h) => h.status !== 'ok')
  console.log(`\n[源健康] ok=${ok.length} DOWN=${down.length} / 共 ${health.length} 路`)
  for (const h of health) {
    const mark = h.status === 'ok' ? '✔' : '✘'
    const layer = String(h.layer).padEnd(7)
    const name = h.name.padEnd(22)
    const lat = `${h.latency_ms}ms`.padStart(8)
    const cnt = `${h.items}条`.padStart(5)
    const msg = h.status === 'ok' ? '' : ` ← DOWN: ${h.msg}`
    console.log(`  ${mark} ${layer} ${name} ${cnt} ${lat}${msg}`)
  }
}

/** 断言 mjs 与 ts 的指纹算法逐位一致 */
function assertKeys() {
  let pass = 0
  const failed = []
  for (const [title, want] of KEY_BASELINE) {
    const got = eventKeyOf(title)
    if (got === want) pass++
    else failed.push({ title, want, got })
  }
  if (failed.length) {
    console.log(`\n[eventKeyOf] ✘ ${pass}/${KEY_BASELINE.length} 一致`)
    for (const f of failed) {
      console.log(`  ✘ ${JSON.stringify(f.title)}  期望=${f.want} 实际=${f.got}`)
    }
    return false
  }
  console.log(`\n[eventKeyOf] ✔ ${pass}/${KEY_BASELINE.length} 与 src/utils/gapdeskFormat.ts 逐位一致`)
  return true
}

async function main() {
  const opts = parseArgs(process.argv)
  const t0 = Date.now()

  let fixture = null
  if (opts.fixture) {
    const raw = JSON.parse(await readFile(opts.fixture, 'utf8'))
    fixture = { items: raw.items || [], health: raw.health || [] }
    console.log(`[fixture] 载入 ${opts.fixture}（${fixture.items.length} 条 raw）`)
  }

  // --live 走真实写库路径；其余情况一律只跑链路
  if (opts.live) {
    const summary = await collectOnce({ dryRun: false, limit: opts.limit })
    console.log(JSON.stringify(summary, null, 2))
    const pass = assertKeys()
    process.exit(pass ? 0 : 1)
  }

  const pipe = await runPipeline({
    limit: opts.limit,
    fixture,
    healthMap: {},
    forceAll: true,
  })

  console.log(
    `\nGAPDESK smoke · dry-run · ${pipe.health.length} 路 · 墙钟 ${Date.now() - t0}ms` +
      `（链路内 ${pipe.wallMs}ms）`
  )
  console.log(
    `[漏斗] raw=${pipe.funnel.raw} → 闸门丢 ${pipe.funnel.gated_dropped} → 候选 ${pipe.funnel.candidates}` +
      ` → 精确 ${pipe.funnel.exact} → 近似 ${pipe.funnel.approx} → 事件 ${pipe.funnel.event}` +
      `（gap≥${GAP_MIN_SHOW}: ${pipe.funnel.shown}）`
  )
  const staleBy = Object.entries(pipe.funnel.gated_by_source || {})
  if (staleBy.length) {
    console.log(`[闸门] 供陈旧内容的源：${staleBy.map(([k, v]) => `${k}×${v}`).join('、')}`)
  }

  console.log(`\n[前 10 条]`)
  for (const [i, e] of pipe.events.slice(0, 10).entries()) console.log(row(i + 1, e))

  const dist = { L0: 0, L1: 0, L2: 0 }
  for (const e of pipe.events) dist[e.tier] = (dist[e.tier] || 0) + 1
  const avgHeat = pipe.events.length
    ? Math.round(pipe.events.reduce((a, e) => a + e.ins_heat, 0) / pipe.events.length)
    : 0
  console.log(
    `\n[分布] L0=${dist.L0} L1=${dist.L1} L2=${dist.L2} · 平均决策圈热度 ${avgHeat} · ` +
      `出圈(已上大众榜) ${pipe.events.filter((e) => e.mass_heat > 0).length} 条`
  )

  printSources(pipe.health)

  const pass = assertKeys()
  const rawOk = pipe.funnel.raw > 0
  if (!rawOk) console.log('\n[warn] raw=0：本轮一条都没抓到，检查网络或源可用性')

  const rawTxt = pipe.funnel.raw >= 10000 ? `${(pipe.funnel.raw / 10000).toFixed(1)}万` : String(pipe.funnel.raw)
  console.log(`\n[结论] ${rawOk && pass ? 'PASS' : 'FAIL'} · raw=${rawTxt} · ${new Date(pipe.now).toISOString()}`)
  process.exit(rawOk && pass ? 0 : 1)
}

main().catch((e) => {
  console.error('[fatal]', (e && e.stack) || e)
  process.exit(1)
})
