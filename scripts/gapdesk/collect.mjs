#!/usr/bin/env node
/* =========================================================
   GAPDESK 采集编排（GitHub Actions 每 30 分钟跑一次）
   ---------------------------------------------------------
   一条命令做完：清理过期 → 算到期源 → 并发抓取 → 归一 → 新鲜度闸门
                → 大众出圈探针 → 三遍聚类 → 四维打分 → 写库 → 打 summary
   零 npm 依赖：PostgREST 用内置 fetch 直连（不引 supabase-js）。

   环境变量：
     SUPABASE_URL               必填（真实写库时）
     SUPABASE_SERVICE_ROLE_KEY  必填，service_role JWT 或 sb_secret_ 开头的新版 secret key
     CI=true                    Actions 里自动为 true；本地必须显式 --force 才写库

   命令行：
     node scripts/gapdesk/collect.mjs [--force] [--dry-run] [--limit N]
   ========================================================= */
import { pathToFileURL } from 'node:url'

import {
  DEFAULT_TIMEOUT_MS,
  isCooling,
  parseRSS,
  timedFetch,
  freshnessGate,
} from './fetch.mjs'
import { SOURCES, dueSources, layerCount, nameOf } from './sources.mjs'
import { dedupe, probeMass } from './cluster.mjs'
import { scoreEvents } from './score.mjs'

/** 采集侧事件保留时长（小时）——与库表 expire_at 默认值、清理函数保持一致 */
export const TTL_HOURS = 48

/** 每批写入条数：200 是 PostgREST 单请求体积与失败重试成本的经验平衡点 */
const BATCH = 200

/** 子表每批插入条数 */
const CHILD_BATCH = 500

/**
 * 前端「值得打扰」的差值下限。
 * ⚠️ 必须与 src/config/gapdeskConfig.ts 的 GAP_GAP_MIN 保持同一个数（现为 85）。
 * 为什么是 85：展示分是池内分位映射（54-97），75 落在中位数附近等于「全都推」；
 * 85 对应池内约前 25%，summary 里的 shown 才是用户真正会看到的条数。
 */
export const GAP_MIN_SHOW = 85

const clamp = (v, a, b) => Math.max(a, Math.min(b, v))

/* =========================================================
   一、抓取与归一
   ========================================================= */

/**
 * 热度归一化。
 * rank 源（微博/知乎/抖音/头条）：真实热度取对数压到 0-100；无热度字段（抖音）按榜位折算。
 * 非 rank 源：互动量（HN points / 见闻投票+评论）取对数压到 0-70，避免互动量直接决定分数。
 */
function normalizeHeat(src, raw, index, total) {
  const h = Number(raw && raw.h) || 0
  if (src.rank) {
    return h > 0
      ? clamp(Math.round(Math.log10(1 + h) * 15), 0, 100)
      : Math.max(0, Math.round(100 - index * (95 / (total || 1))))
  }
  return clamp(Math.round(Math.log10(1 + h) * 9), 0, 70)
}

/**
 * 抓单源。任何异常都转成 health 记账，绝不 throw（一轮 25 路，不能让一路拖死全场）。
 * @returns {Promise<{items:object[], health:object}>}
 */
async function grabSource(src) {
  const t0 = Date.now()
  const url = typeof src.url === 'function' ? src.url() : src.url
  const base = {
    id: src.id,
    name: src.name,
    layer: src.layer,
    ttl: src.ttl,
    latency_ms: 0,
    items: 0,
    status: 'unknown',
    msg: '',
  }

  if (isCooling(url)) {
    return {
      items: [],
      health: { ...base, status: 'warn', msg: '冷却中（上轮 429/5xx）', latency_ms: Date.now() - t0 },
    }
  }

  try {
    const { body } = await timedFetch(url, src.timeout || DEFAULT_TIMEOUT_MS, {
      headers: src.headers || {},
    })
    let arr
    if (src.kind === 'json') {
      const json = typeof body === 'string' ? JSON.parse(body) : body
      arr = src.pick(json) || []
    } else {
      arr = parseRSS(typeof body === 'string' ? body : JSON.stringify(body), src.limit || 20)
    }

    /* 归一：过滤空标题；大众榜标题常只有 4 字，长度门槛按层放宽（否则探针恒 0 命中） */
    const minLen = src.layer === 'mass' ? 2 : 6
    const items = []
    arr.forEach((x, i) => {
      if (!x) return
      const t = String(x.t || '').trim()
      if (!t || t.length <= minLen) return
      const raw = Number(x.h) || 0
      items.push({
        srcId: src.id,
        srcName: src.name,
        layer: src.layer,
        ind: src.ind,
        t,
        s: String(x.s || t).slice(0, 170),
        u: String(x.u || ''),
        ts: Number(x.ts) || 0,
        h: normalizeHeat(src, { h: raw }, i, arr.length),
        raw,
        host: x.u ? String(x.u).replace(/^https?:\/\//, '').split('/')[0] : '',
        text: `${t} ${String(x.s || '')}`,
      })
    })

    return {
      items,
      health: {
        ...base,
        latency_ms: Date.now() - t0,
        items: items.length,
        status: 'ok',
        msg: `${items.length} 条`,
        lastOkAt: new Date().toISOString(),
      },
    }
  } catch (e) {
    return {
      items: [],
      health: {
        ...base,
        latency_ms: Date.now() - t0,
        status: 'fail',
        msg: String((e && e.message) || e).slice(0, 60),
        lastFailAt: new Date().toISOString(),
      },
    }
  }
}

/**
 * 并发抓取。
 * @param {object[]} sources 本轮要抓的源
 * @returns {Promise<{items:object[], health:object[], raw:number}>}
 */
export async function gatherSources(sources) {
  const results = await Promise.all(
    sources.map((s) =>
      grabSource(s).catch((e) => ({
        items: [],
        health: { id: s.id, name: s.name, layer: s.layer, ttl: s.ttl, status: 'fail', msg: String(e && e.message).slice(0, 60), latency_ms: 0, items: 0 },
      }))
    )
  )
  const items = []
  const health = []
  for (const r of results) {
    items.push(...r.items)
    health.push(r.health)
  }
  return { items, health, raw: items.length }
}

/**
 * 全链路（不写库）：抓取 → 闸门 → 探针 → 聚类 → 打分。
 * @param {{limit?:number, fixture?:{items:object[],health?:object[]}, healthMap?:object, forceAll?:boolean, firstSeen?:Map<string,number>}} opts
 */
export async function runPipeline(opts = {}) {
  const now = Date.now()
  const t0 = now
  const errors = []

  let items = []
  let health = []
  let raw = 0
  let skipped = []

  if (opts.fixture) {
    // 回归模式：读本地 raw 快照，不碰网络
    items = Array.isArray(opts.fixture.items) ? opts.fixture.items : []
    health = Array.isArray(opts.fixture.health) ? opts.fixture.health : []
    raw = items.length
  } else {
    const due = dueSources(opts.healthMap || {}, now, {
      forceAll: opts.forceAll !== false,
      limit: opts.limit || 0,
    })
    skipped = due.skipped
    const r = await gatherSources(due.due)
    items = r.items
    health = r.health
    raw = r.raw
  }

  /* 中央新鲜度闸门：按发布时间丢弃陈年条目（防停更僵尸源） */
  const gated = freshnessGate(items, 168)
  const fresh = gated.items

  /* 分池：大众榜只做探针，不进情报池 */
  const mass = fresh.filter((i) => i.layer === 'mass')
  const pool = fresh.filter((i) => i.layer !== 'mass')

  /* 大众出圈探针（就地给候选打 massHeat / massOn） */
  probeMass(pool, mass)

  /* 三遍聚类 */
  const { events: clusters, funnel: clusterFunnel } = dedupe(pool)

  /* 四维打分 + 分位映射 */
  const scored = scoreEvents(clusters, { now, firstSeen: opts.firstSeen || new Map() })

  const shown = scored.filter((e) => e.gap >= GAP_MIN_SHOW).length

  return {
    now,
    wallMs: Date.now() - t0,
    raw,
    fresh: fresh.length,
    massCount: mass.length,
    poolCount: pool.length,
    skipped,
    health,
    items: fresh,
    events: scored,
    errors,
    funnel: {
      raw,
      gated_dropped: gated.dropped,
      gated_by_source: gated.bySource,
      candidates: clusterFunnel.candidates,
      exact: clusterFunnel.exact,
      approx: clusterFunnel.approx,
      event: clusterFunnel.event,
      shown,
    },
  }
}

/* =========================================================
   二、极简 PostgREST 客户端（不引 supabase-js）
   ========================================================= */
export function createClient({ url, key }) {
  const base = String(url || '').replace(/\/+$/, '')
  /* 新版 sb_secret_ key 不是 JWT：Supabase 官方要求只放 apikey 头，若同时带
     Authorization: Bearer，网关会尝试按 JWT 解析并可能返回 401 Invalid JWT。
     旧版 service_role JWT 仍需两个头都发，故按 key 形态分别构造。 */
  const headers = {
    apikey: key,
    'content-type': 'application/json',
  }
  if (!isSecretKey(key)) headers.Authorization = `Bearer ${key}`

  async function req(path, { method = 'GET', body, prefer } = {}) {
    const res = await fetch(base + path, {
      method,
      headers: { ...headers, ...(prefer ? { Prefer: prefer } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
    const text = await res.text()
    if (!res.ok) {
      throw new Error(`PostgREST ${method} ${path} → ${res.status} ${text.slice(0, 300)}`)
    }
    if (!text) return null
    try {
      return JSON.parse(text)
    } catch {
      return text
    }
  }

  return {
    /** 查询：select('gap_events', 'select=id&limit=1') */
    select: (table, query = '') => req(`/rest/v1/${table}${query ? `?${query}` : ''}`),
    /** 插入（冲突忽略/报错由 prefer 决定） */
    insert: (table, rows) =>
      req(`/rest/v1/${table}`, {
        method: 'POST',
        body: rows,
        prefer: 'return=representation',
      }),
    /**
     * upsert：onConflict 必须精确对应库里的唯一约束列。
     * 注意：gap_events 的唯一键是 (event_key, uniq_keep)（uniq_keep 恒为空串），
     * 所以这里传 'event_key,uniq_keep' —— 语义与「只按 event_key 合并」完全等价。
     */
    upsert: (table, rows, onConflict, { returning = true } = {}) =>
      req(`/rest/v1/${table}?on_conflict=${encodeURIComponent(onConflict)}`, {
        method: 'POST',
        body: rows,
        prefer: `resolution=merge-duplicates,${returning ? 'return=representation' : 'return=minimal'}`,
      }),
    /** 删除：remove('gap_reads', 'event_id=eq.1') */
    remove: (table, query) =>
      req(`/rest/v1/${table}?${query}`, { method: 'DELETE', prefer: 'return=minimal' }),
    /** RPC：rpc('gapdesk_purge') */
    rpc: (fn, args = {}) => req(`/rest/v1/rpc/${fn}`, { method: 'POST', body: args }),
  }
}

/** 新版 Supabase secret key 前缀（形如 sb_secret_3Vth_...）：不是 JWT，但等价于 service_role */
const SECRET_KEY_PREFIX = 'sb_secret_'
/** 前缀 10 字符 + 至少 10 字符密钥体；挡住「只填前缀」这类手滑输入 */
const SECRET_KEY_MIN_LENGTH = 20

/**
 * 是否为新版 Supabase secret key。
 * 官方定义：secret key 解析到 Postgres 的 service_role 角色并带 BYPASSRLS，本身不是 JWT，
 * 因此只校验前缀 + 长度，绝不再尝试解 payload（解不开正是旧逻辑误判的根因）。
 * @param {string} key 待校验密钥
 * @returns {boolean}
 */
export function isSecretKey(key) {
  const k = String(key || '')
  return k.startsWith(SECRET_KEY_PREFIX) && k.length >= SECRET_KEY_MIN_LENGTH
}

/**
 * 取密钥对应的 Postgres role（只解 payload，不验签 —— 验签是服务端的责任）。
 * 兼容两种形态：
 *   1) 新版 sb_secret_xxx：非 JWT，语义上就是 service_role，直接返回该 role；
 *   2) 旧版 JWT：解 payload 取 role。
 * 无法识别（空串 / 乱串 / anon JWT 之外的坏格式）时返回 null。
 * @param {string} token 待解析密钥
 * @returns {string|null}
 */
export function jwtRole(token) {
  const k = String(token || '')
  if (isSecretKey(k)) return 'service_role'
  const parts = k.split('.')
  if (parts.length !== 3) return null
  try {
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'))
    return payload.role || null
  } catch {
    return null
  }
}

/**
 * 服务端密钥形态总校验：只接受 service_role JWT 或 sb_secret_ 开头的 secret key。
 * anon JWT、空串、乱填一律拒绝。不打印也不返回任何密钥内容。
 * @param {string} key 待校验密钥
 * @returns {boolean}
 */
export function isServiceRoleKey(key) {
  if (isSecretKey(key)) return true
  return jwtRole(key) === 'service_role'
}

/* =========================================================
   三、写库
   ========================================================= */

/** 切成固定大小的批 */
function chunk(arr, size) {
  const out = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

/**
 * 事件 → gap_events 行（只映射库里真实存在的列，多一个字段都会 400）。
 *
 * expire_at 规则（产品硬要求：库里只留 2 天，且**不续期**）：
 *   1) 已存在（event_key 命中且未过期）→ 原样沿用库里的 expire_at，不覆盖。
 *      早期版本每轮写 now+48h，会让常驻 RSS 里的旧文章永远不过期 —— 那是 bug。
 *   2) 新事件 + 有发布时间 → ts_published + 48h（按「事实发生时间」滚动）。
 *   3) 新事件 + 无发布时间（榜单类 ts=0）→ 首次入库时刻 + 48h。
 * @param {object} e 打分后的事件
 * @param {number} now 本轮时间戳
 * @param {{expire_at?:string}|undefined} prev 库里同 event_key 的旧行
 */
function toEventRow(e, now, prev) {
  let expireAt
  if (prev && prev.expire_at) expireAt = prev.expire_at
  else if (e.ts_published > 0) expireAt = new Date(e.ts_published + TTL_HOURS * 3600 * 1000).toISOString()
  else expireAt = new Date(now + TTL_HOURS * 3600 * 1000).toISOString()

  return {
    event_key: e.event_key,
    uniq_keep: '',
    title: e.title,
    summary: e.summary,
    url: e.url,
    ind: e.ind,
    dim: e.dim,
    kind: e.kind,
    gap: e.gap,
    gap_raw: e.gap_raw,
    b_json: e.b_json,
    tags: e.tags,
    ts_published: e.ts_published,
    ts_first_seen: e.ts_first_seen,
    ins_heat: e.ins_heat,
    pub_heat: e.pub_heat,
    mass_on: e.mass_on ? e.mass_on : null,
    mass_heat: e.mass_heat,
    lag_h: e.lag_h,
    src_count: e.src_count,
    reason: e.reason,
    action: e.action,
    is_foreign: e.is_foreign,
    expire_at: expireAt,
    updated_at: new Date(now).toISOString(),
  }
}

/**
 * 证据链行去重：
 * 库里有 unique (event_id, url)，而多数条目没有原文链接（url=''）。
 * 空串会在同一事件下重复 → 违反唯一约束。故空链接统一写 NULL（PG 里 NULL 互不冲突）。
 */
function dedupeSourceRows(rows) {
  const seen = new Set()
  const out = []
  for (const r of rows) {
    const url = r.url ? String(r.url) : null
    const key = url === null ? `${r.event_id}|null` : `${r.event_id}|${url}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push({ ...r, url })
  }
  return out
}

/**
 * 完整采集一轮并写库。
 * @param {{dryRun?:boolean, force?:boolean, limit?:number, env?:object, log?:Function}} opts
 */
export async function collectOnce(opts = {}) {
  const env = opts.env || process.env
  const log = opts.log || ((...a) => console.log(...a))
  const dryRun = !!opts.dryRun
  const startedAt = Date.now()
  const errors = []

  const supabaseUrl = env.SUPABASE_URL
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY

  /* ---- 启动自检 ---- */
  if (!dryRun) {
    if (!supabaseUrl || !serviceKey) {
      throw new Error('缺少 SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY')
    }
    if (!isServiceRoleKey(serviceKey)) {
      const role = jwtRole(serviceKey)
      const detail = role ? `JWT role=${role}` : '既不是 sb_secret_ 开头的 secret key，也不是可解析的 JWT'
      throw new Error(
        `SERVICE_ROLE_KEY 形态不合法：需要 service_role JWT 或 sb_secret_ 开头的 secret key（${detail}）`
      )
    }
  }

  const db = dryRun ? null : createClient({ url: supabaseUrl, key: serviceKey })

  /* ---- 1. 清理过期（失败只 warn，不中断本轮）---- */
  let purged = 0
  if (db) {
    try {
      const n = await db.rpc('gapdesk_purge')
      purged = typeof n === 'number' ? n : Number(n) || 0
      log(`[purge] 删除过期事件 ${purged} 条`)
    } catch (e) {
      errors.push(`purge: ${e.message}`)
      log(`[purge] 失败（忽略）：${e.message}`)
    }
  }

  /* ---- 2. 读现有健康度：决定哪些源到期 + 算连续成功/失败计数 ---- */
  let healthRows = []
  if (db) {
    try {
      healthRows = (await db.select('gap_sources', 'select=id,ok,fail,last_ok,last_fail')) || []
    } catch (e) {
      errors.push(`read_health: ${e.message}`)
      log(`[health] 读取失败（按全部到期处理）：${e.message}`)
    }
  }
  const healthMap = Object.fromEntries(healthRows.map((h) => [h.id, h]))

  /* ---- 3. 读已有事件的 ts_first_seen / expire_at ----
     ts_first_seen：跨轮延续「已入池多久」；
     expire_at    ：已存在的事件**不续期**（原样写回），保证「库里只留 2 天」。

     ⚠️ 为什么必须分页：Supabase 的 API 默认 Max Rows = 1000，单次 `limit=2000` 会被静默截断。
     被截掉的行拿不到 prev.expire_at → 每轮重算 now+48h → 事件永远不过期，违背「只留 48h」。
     这里用 limit/offset 分页拉全（每页 1000，最多 10 页），触顶时明确告警。 */
  const EXISTING_PAGE = 1000
  const EXISTING_MAX_PAGES = 10
  let existing = []
  if (db) {
    try {
      for (let page = 0; page < EXISTING_MAX_PAGES; page++) {
        const part =
          (await db.select(
            'gap_events',
            `select=id,event_key,ts_first_seen,expire_at&expire_at=gt.now()&order=ts_first_seen.asc&limit=${EXISTING_PAGE}&offset=${page * EXISTING_PAGE}`
          )) || []
        existing.push(...part)
        if (part.length < EXISTING_PAGE) break
        if (page === EXISTING_MAX_PAGES - 1) {
          const warn = `已有事件超过 ${EXISTING_PAGE * EXISTING_MAX_PAGES} 行，分页触顶：未读到的行会被当作新事件（expire_at 可能被重算）`
          errors.push(`read_events_truncated: ${warn}`)
          log(`[events] ⚠️ ${warn}`)
        }
      }
      log(`[events] 读取已有事件 ${existing.length} 行（已分页，规避 Max Rows 截断）`)
    } catch (e) {
      errors.push(`read_events: ${e.message}`)
      log(`[events] 读取失败（按全新事件处理）：${e.message}`)
    }
  }
  const firstSeen = new Map()
  const prevByKey = new Map()
  for (const row of existing) {
    const ts = Number(row.ts_first_seen) || 0
    if (ts > 0) firstSeen.set(row.event_key, ts)
    prevByKey.set(row.event_key, { expire_at: row.expire_at })
  }

  /* ---- 4. 全链路（抓取/闸门/探针/聚类/打分）---- */
  const pipe = await runPipeline({
    limit: opts.limit || 0,
    fixture: opts.fixture,
    healthMap,
    forceAll: opts.forceAll !== false,
    firstSeen,
  })

  log(
    `[funnel] raw=${pipe.funnel.raw} → 闸门丢 ${pipe.funnel.gated_dropped} → 候选 ${pipe.funnel.candidates}` +
      ` → 精确 ${pipe.funnel.exact} → 近似 ${pipe.funnel.approx} → 事件 ${pipe.funnel.event}` +
      `（gap≥${GAP_MIN_SHOW}: ${pipe.funnel.shown}）`
  )

  /* ---- 5. 写事件主表 ---- */
  let upserted = 0
  const rows = pipe.events.map((e) => toEventRow(e, pipe.now, prevByKey.get(e.event_key)))
  if (db && rows.length) {
    for (const part of chunk(rows, BATCH)) {
      try {
        const saved = await db.upsert('gap_events', part, 'event_key,uniq_keep')
        upserted += Array.isArray(saved) ? saved.length : part.length
      } catch (e) {
        errors.push(`upsert_events: ${e.message}`)
        log(`[events] 批次写入失败：${e.message}`)
      }
    }
  }
  log(`[events] 写入 ${upserted} / ${rows.length} 条`)

  /* ---- 6. 子表：先删本轮涉及事件的旧证据，再插新证据（保证「本轮证据=当前真相」）---- */
  let srcRows = 0
  let platRows = 0
  if (db && pipe.events.length) {
    /* 回查事件 id：upsert 的 return=representation 在多批次时不好对齐，
       统一用 event_key 回查一次（≤2000 条，两个请求内完成，成本可忽略）。 */
    const idMap = new Map()
    for (const part of chunk(pipe.events, BATCH)) {
      if (!part.length) continue
      const keys = part.map((e) => `"${e.event_key}"`).join(',')
      try {
        const found = (await db.select('gap_events', `select=id,event_key&event_key=in.(${keys})`)) || []
        for (const r of found) idMap.set(r.event_key, r.id)
      } catch (e) {
        errors.push(`resolve_ids: ${e.message}`)
      }
    }

    const ids = [...idMap.values()]
    if (ids.length) {
      // 分批删：in.(...) 走 URL，2000 个 id 拼成 ~12KB 会被 PostgREST/网关拒掉（414）
      for (const part of chunk(ids, 200)) {
        const inList = `in.(${part.join(',')})`
        try {
          await db.remove('gap_event_sources', `event_id=${inList}`)
          await db.remove('gap_event_platform', `event_id=${inList}`)
        } catch (e) {
          errors.push(`clear_children: ${e.message}`)
          log(`[children] 清理旧证据失败：${e.message}`)
        }
      }
    }

    const sRows = []
    const pRows = []
    for (const e of pipe.events) {
      const id = idMap.get(e.event_key)
      if (!id) continue
      for (const s of e.sources) sRows.push({ event_id: id, ...s })
      for (const p of e.platforms) {
        pRows.push({
          event_id: id,
          platform: p.platform,
          first_touch_ts: p.firstTouchTs || 0,
          heat: p.heat === null ? null : Math.round(p.heat),
        })
      }
    }
    for (const part of chunk(dedupeSourceRows(sRows), CHILD_BATCH)) {
      try {
        await db.insert('gap_event_sources', part)
        srcRows += part.length
      } catch (e) {
        errors.push(`insert_sources: ${e.message}`)
      }
    }
    for (const part of chunk(pRows, CHILD_BATCH)) {
      try {
        await db.insert('gap_event_platform', part)
        platRows += part.length
      } catch (e) {
        errors.push(`insert_platform: ${e.message}`)
      }
    }
    log(`[children] 证据链 ${srcRows} 行 / 平台轨迹 ${platRows} 行`)
  }

  /* ---- 7. 回写信源健康度 ---- */
  let healthWritten = 0
  if (db && pipe.health.length) {
    const nowIso = new Date().toISOString()
    const hRows = pipe.health.map((h) => {
      const prev = healthMap[h.id] || {}
      const success = h.status === 'ok'
      // 连续计数：成功 → ok+1 且 fail 归零；失败 → fail+1 且 ok 归零
      const ok = success ? (Number(prev.ok) || 0) + 1 : 0
      const fail = success ? 0 : (Number(prev.fail) || 0) + 1
      return {
        id: h.id,
        name: h.name,
        layer: h.layer,
        ttl: h.ttl,
        ok,
        fail,
        last_ok: h.lastOkAt || prev.last_ok || null,
        last_fail: h.lastFailAt || prev.last_fail || null,
        latency_ms: h.latency_ms || 0,
        items: h.items || 0,
        // 连续失败 ≥3 才亮红灯，偶发一次抖动只是黄灯
        status: success ? 'ok' : fail >= 3 ? 'fail' : 'warn',
        msg: h.msg || '',
        updated_at: nowIso,
      }
    })
    try {
      await db.upsert('gap_sources', hRows, 'id', { returning: false })
      healthWritten = hRows.length
    } catch (e) {
      errors.push(`upsert_health: ${e.message}`)
      log(`[health] 回写失败：${e.message}`)
    }
  }

  /* ---- 8. 写 feed meta（前端顶栏/运维看板读这一条）---- */
  if (db) {
    try {
      const meta = {
        key: 'gapdesk_feed_meta',
        value: {
          funnel: {
            raw: pipe.funnel.raw,
            exact: pipe.funnel.exact,
            event: pipe.funnel.event,
            shown: pipe.funnel.shown,
          },
          cut: {
            // 决策圈 P75 / 大众 P25：前端用它区分「行业侧热」与「大众侧热」的相对水位
            insP75: p75(pipe.events.map((e) => e.ins_heat)),
            pubP25: p25(pipe.events.map((e) => e.pub_heat)),
          },
          generated_at: new Date(pipe.now).toISOString(),
          sources_ok: pipe.health.filter((h) => h.status === 'ok').length,
          sources_total: pipe.health.length,
          wall_ms: pipe.wallMs,
        },
        updated_at: new Date().toISOString(),
      }
      await db.upsert('app_settings', [meta], 'key', { returning: false })
    } catch (e) {
      errors.push(`upsert_meta: ${e.message}`)
      log(`[meta] 写入失败（不影响主流程）：${e.message}`)
    }
  }

  /* ---- 9. summary ---- */
  const down = pipe.health
    .filter((h) => h.status !== 'ok')
    .map((h) => ({ id: h.id, name: nameOf(h.id), msg: h.msg }))

  /* 停更候选：两个来源合起来看
     ① 注册表里显式标 stale 的源（实测最新条目已超 7 天）；
     ② 本轮被新鲜度闸门拦下条目的源（闸门是根因防线，谁在供陈年内容一目了然）。
     不删源：删了就没人知道这块行业覆盖已经空了。 */
  const gatedBy = pipe.funnel.gated_by_source || {}
  const staleFlagged = SOURCES.filter((s) => s.stale).map((s) => ({
    id: s.id,
    name: s.name,
    reason: 'stale-flag',
    dropped: gatedBy[s.name] || 0,
  }))
  const flaggedNames = new Set(staleFlagged.map((s) => s.name))
  const staleCandidates = [
    ...staleFlagged,
    ...Object.entries(gatedBy)
      .filter(([name]) => !flaggedNames.has(name))
      .map(([name, dropped]) => ({ id: '', name, reason: 'gated', dropped })),
  ]

  const summary = {
    at: new Date(pipe.now).toISOString(),
    mode: dryRun ? 'dry-run' : 'live',
    wall_ms: Date.now() - startedAt,
    pipeline_ms: pipe.wallMs,
    funnel: pipe.funnel,
    events: { scored: pipe.events.length, upserted, sources_rows: srcRows, platform_rows: platRows },
    sources: {
      total: pipe.health.length,
      ok: pipe.health.filter((h) => h.status === 'ok').length,
      fail: pipe.health.filter((h) => h.status !== 'ok').length,
      down,
      stale_candidates: staleCandidates,
      layers: layerCount(),
    },
    purged,
    health_written: healthWritten,
    errors,
  }
  return summary
}

/** 分位取值（空数组返回 0） */
function quantile(list, q) {
  if (!list.length) return 0
  const a = [...list].sort((x, y) => x - y)
  return a[Math.min(a.length - 1, Math.floor(a.length * q))]
}
const p75 = (list) => quantile(list, 0.75)
const p25 = (list) => quantile(list, 0.25)

/* =========================================================
   四、CLI
   ========================================================= */
async function main() {
  const args = process.argv.slice(2)
  const isCI = process.env.CI === 'true' || process.env.CI === '1'
  const force = args.includes('--force')
  const dryRun = args.includes('--dry-run')
  const limitIdx = args.indexOf('--limit')
  const limit = limitIdx >= 0 ? Number(args[limitIdx + 1]) || 0 : 0

  // 非 CI 且未显式 --force：拒绝真实写库（防止本机误跑覆盖线上数据）
  if (!isCI && !force && !dryRun) {
    console.error('[拒绝] 非 CI 环境且未传 --force：本轮不会写库。用 --force 写库，或用 --dry-run 只跑链路。')
    process.exit(1)
  }

  try {
    const summary = await collectOnce({ dryRun, force, limit })
    console.log(`[done] wall=${summary.wall_ms}ms mode=${summary.mode}`)
    // 最后一行必须是纯 JSON：Actions 的 step summary 直接取这行
    console.log(JSON.stringify(summary))
    if (summary.sources.total > 0 && summary.sources.ok === 0) {
      console.error('[warn] 全部信源失败，本轮无有效数据')
      process.exit(1)
    }
  } catch (e) {
    const fatal = {
      at: new Date().toISOString(),
      mode: dryRun ? 'dry-run' : 'live',
      fatal: String((e && e.message) || e),
      errors: [String((e && e.stack) || e).slice(0, 600)],
    }
    console.error(`[fatal] ${fatal.fatal}`)
    console.log(JSON.stringify(fatal))
    process.exit(1)
  }
}

// 仅当作为入口执行时才跑 main（被 smoke.mjs import 时不触发）
const isEntry = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isEntry) main()

export { main, p75, p25, quantile }
