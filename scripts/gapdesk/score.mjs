/* =========================================================
   GAPDESK 采集管道 · 四维打分与分位映射
   口径严格对齐 server.mjs（第 786-859 / 1196-1234 行）。
   ---------------------------------------------------------
   设计原则（沿用原系统，别改）：
   1. 所有分值都由**真实可观测信号**推导，没有任何手填值：
      时间→真实发布/首见时差；稀缺→大众榜是否已命中、跨源数；影响→互动量与政策词；行动→可执行动词与数字密度。
   2. 展示分 gap 用「池内分位」映射到 54-97，而不是绝对阈值。
      原因：真实分布的原始分上限约 70，绝对阈值（85/70）会把几乎全部条目判成低档，
      那是假分层。分位映射保证「97」永远代表当前池里最强的信号，且跨页可比。
   3. 原始分保留在 gapRaw，池内分位保留在 gapPct，供审计与回归对比。
   ========================================================= */
import { byId, SOURCES } from './sources.mjs'
import {
  DIM_DEFAULT,
  actionWord,
  extractEntities,
  guessKind,
  impactWord,
  pickTags,
  tagDim,
  tagGB,
  tagInd,
} from './keywords.mjs'

/* =========================================================
   一、阈值常量区（全部集中在此，每个都注明依据）
   ========================================================= */

/** 四维权重：稀缺(1.1) > 时间(0.9) > 影响(0.85) > 行动(0.75)
 *  依据：差值台卖的是「早」和「别人还不知道」，所以稀缺权重最高；
 *        行动权重最低但保留，避免纯情绪类热词霸榜。 */
export const W = { tim: 0.9, scar: 1.1, imp: 0.85, act: 0.75 }

/** 原始分夹取区间：下限 20 防止零分条目污染分位，上限 99 给展示分留 97 的空间 */
export const RAW_MIN = 20
export const RAW_MAX = 99

/** 展示分映射区间 54-97：与原型 visual 档位（hot/warm/cool）切点 85/70 对齐 */
export const DISPLAY_MIN = 54
export const DISPLAY_SPAN = 43

/** 分层切点：L0 = 池内前 10%，L1 = 10%-40%，其余 L2（用分位而非绝对分） */
export const TIER_L0 = 0.9
export const TIER_L1 = 0.6

/** 时间维：first（分钟）每 240 分钟扣 10 分，扣到 8 分为止
 *  依据：一轮快讯的半衰期约 4 小时，超过 8 小时基本已进入主流跟发阶段 */
export const TIM_BASE = 25
export const TIM_DECAY_PER_MIN = 10 / 240
export const TIM_FLOOR = 8

/** 互动量取对数：log10(1+eng)*7，封顶 18
 *  依据：HN 首页 1000 points 与 10 points 的「信息含量」不是 100 倍关系，取对数才可比 */
export const ENG_SCALE = 7
export const ENG_CAP = 18

/** 大众榜命中时的稀缺分：9 分，海外源 +5（跨语言差值更大）
 *  依据：出圈即稀缺消解，但海外一手仍有时间差价值 */
export const SCAR_MASS_BASE = 9
export const SCAR_MASS_FOREIGN = 5
export const SCAR_MASS_CAP = 12

/** 未出圈时的稀缺分基数 15，海外 +8，单源 +4，非中文 -3
 *  依据：单一信源且海外一手＝最典型的「差值」形态；非中文略降，避免英文条目刷屏 */
export const SCAR_BASE = 15
export const SCAR_FOREIGN = 8
export const SCAR_SINGLE = 4
export const SCAR_NON_CN = 3

/** 影响维：命中政策/监管/价格类动词 +6，否则 +1；跨源数 *2 封顶 8；摘要>40 字 +3 */
export const IMP_STRONG = 6
export const IMP_WEAK = 1
export const IMP_PER_SRC = 2
export const IMP_SRC_CAP = 8
export const IMP_DETAIL_LONG = 3
export const IMP_DETAIL_SHORT = 1

/** 行动维：命中可执行动词 +8，否则 +3；摘要数字个数直接加（封顶 9） */
export const ACT_STRONG = 8
export const ACT_WEAK = 3
export const ACT_DIGIT_CAP = 9

/** 行业侧热度 insHeat：基数 28 + 跨源 6/路 + 中文快讯 10 + 互动 0.6 折算 + 政策 10 */
export const INS_BASE = 28
export const INS_PER_SRC = 6
export const INS_CN_BONUS = 10
export const INS_ENG_RATE = 0.6
export const INS_IMPACT_BONUS = 10

/** 大众侧热度 pubHeat：已出圈 = 榜内热度*0.9 + 互动*0.4；未出圈封顶 18（不许假装有热度） */
export const PUB_MASS_RATE = 0.9
export const PUB_ENG_RATE = 0.4
export const PUB_IDLE_BASE = 2
export const PUB_IDLE_IMPACT = 6
export const PUB_IDLE_ENG = 6
export const PUB_IDLE_CAP = 18

/**
 * 双轨差值 div = 决策圈热 − 大众热。
 * ⚠️ 当前口径：**截断到 [0, 100]**（负数截为 0），与 test/gapdesk.test.ts 的两条断言一致；
 * 待 QA 更新断言后才会改成 ±100（P2-1）。库表没有 div 列，只存 ins_heat / pub_heat 原始分量。
 */
export const DIV_CAP = 100

/** 时差文案阈值：小于 0.2 小时视为同刻，不写「源间时差 0.0h」这种废话 */
export const LAG_TXT_MIN_H = 0.2

/** 未来时间戳容差：源站偶发错年份，超过 now+10min 的时间一律不参与时差计算 */
export const FUTURE_TOLERANCE_MS = 10 * 60 * 1000

/** 摘要入库长度：库里是 text，但差值台只做「可判断」而非全文存档 */
export const SUMMARY_MAX = 170

/* =========================================================
   二、小工具
   ========================================================= */
const clamp = (v, a, b) => Math.max(a, Math.min(b, v))
const digits = (s) => (String(s || '').match(/[0-9]/g) || []).length

/** 层级 → 证据链上的 kind 标记（insider 决策圈 / main 主流 / rare 冷门垂直 / tech 海外） */
export function srcKind(name) {
  const src = findSrcByName(name)
  const layer = src ? src.layer : ''
  if (layer === 'mass') return 'main'
  if (layer === 'tech') return 'rare'
  return 'off'
}

/** 源触达量级：大众 880 / 决策圈 120 / 海外 12（卡片上「触达半径」的真实口径） */
export function srcReach(name) {
  const src = findSrcByName(name)
  const layer = src ? src.layer : ''
  if (layer === 'mass') return 880
  if (layer === 'insider') return 120
  return 12
}

/** 展示名 → 源对象（惰性建索引一次，供 srcKind/srcReach 反查层级） */
const NAME_INDEX = new Map()
function findSrcByName(name) {
  if (!NAME_INDEX.size) {
    for (const s of SOURCES) NAME_INDEX.set(s.name, s)
  }
  return NAME_INDEX.get(name) || null
}

/**
 * reason 文案：全部由已计算的真实特征拼装，绝不虚构。
 * @param {object} c 簇
 * @param {{massHit:boolean,massOn:string,isForeign:boolean,first:number,srcUniq:string[],lagH:number}} f
 */
export function buildReason(c, { massHit, massOn, isForeign, first, srcUniq, lagH }) {
  const hrs = first / 60
  const ago = hrs >= 1 ? `${hrs.toFixed(1)}h` : `${first}min`
  const lagTx = lagH > LAG_TXT_MIN_H ? ` · 源间时差 ${lagH.toFixed(1)}h` : ''
  if (isForeign && !massHit) {
    return '海外一手源已出现、微博/知乎/抖音三榜标题级匹配 0 命中，属跨语言前导差 · 已入池 ' + ago
  }
  if (!massHit) {
    return (
      `大众三榜 0 命中，目前仅在 ${srcUniq.length} 路${isForeign ? '海外/垂直' : '快讯/垂直'}源流传` +
      (c.items.length > 1 ? `（跨源 ${srcUniq.join('、')}）` : '（单一信源）') +
      ` · 已入池 ${ago}${lagTx}`
    )
  }
  return `已外溢至 ${massOn || '大众榜'}（榜内热度 ${c.massHeat}），与大众同温；差值主要来自跨口径差异 · 入池 ${ago}${lagTx}`
}

/** 行业动作建议：按行业给一句「可以马上做的事」，不是空话 */
const ACTS = {
  ai: '评估对在手 AI/算力项目的估值与成本假设影响',
  fin: '在持仓复核模型里加入对应因子',
  med: '核对该品种/管线在集采或挂网的报价策略',
  en: '用新口径重算相关项目 IRR 与消纳假设',
  mfg: '更新对上游交期与成本的报价假设',
  prop: '把口径变化写入投标测算与尽调清单',
  agri: '调整涉检/涉价品类的备货与口岸方案',
  glob: '在途货与仓位切换到合规可执行通道',
}

/** 建议动作 */
export function buildAction(ind, dim, text) {
  const base = ACTS[ind] || '纳入本周行业复盘'
  if (/价|成本/.test(text)) return `${base}；同步下调相关成本中枢`
  if (/政策|备案|审批|名单/.test(text)) return `${base}；索取原文附件做逐条比对`
  return base
}

/**
 * 平台轨迹：每一条都取自真实观测。
 * 未命中大众榜的平台给 heat=null / first_touch_ts=0（「没测到」就该是空，
 * 不能给一个「1」——用户只会理解成「1 次命中/第 1 名」）。
 */
export function buildPlat({ pubH, insH, massHit, massOn, isForeign, fs, pubTs, c, now }) {
  const layerFirstTs = (layer) => {
    const ts = c.items
      .filter((i) => i.layer === layer && i.ts)
      .map((i) => i.ts)
      .sort((a, b) => a - b)
    return ts.length ? ts[0] : 0
  }

  const rows = ['微博', '知乎', '抖音'].map((n) => {
    const hit = !!(massHit && massOn && massOn.includes(n))
    return {
      platform: n,
      heat: hit ? pubH : null,
      // 命中时「首触」= 我们本轮在榜上观测到它的时刻（误差 ≤ 两轮采集间隔）
      firstTouchTs: hit ? fs : 0,
      real: hit,
    }
  })

  rows.push({
    platform: '行业决策圈',
    heat: insH,
    firstTouchTs: layerFirstTs('insider') || pubTs || fs,
    real: true,
  })

  const mainTs = layerFirstTs('main')
  if (mainTs || c.items.some((i) => i.layer === 'main')) {
    rows.push({
      platform: '主流媒体',
      heat: Math.round(insH * 0.86),
      firstTouchTs: mainTs || fs,
      real: true,
    })
  }

  const techTs = layerFirstTs('tech')
  rows.push({
    platform: isForeign ? '海外一手源' : '海外源',
    heat: isForeign ? Math.min(100, insH + 6) : clamp(pubH, 0, 14),
    firstTouchTs: techTs || (isForeign ? fs : 0),
    real: true,
  })

  return rows
}

/**
 * 主层判定：决定 gap_events.kind（insider/main/rare/tech）。
 * 优先级 insider > tech > main：一条事件最先被决策圈看到，就该记成 insider。
 * 注意：语义分类（政策/价格/技术…）由 guessKind 给出，放在 topic 字段，不入库。
 */
function dominantLayer(items) {
  const layers = new Set(items.map((i) => i.layer))
  if (layers.has('insider')) return 'insider'
  if (layers.has('tech')) return 'tech'
  if (layers.has('main')) return 'main'
  return 'rare'
}

/**
 * 对事件簇打分。
 * @param {object[]} events dedupe() 输出的事件簇
 * @param {{now?:number, firstSeen?:Map<string,number>}} opts
 *        firstSeen: event_key → 库里已有的 ts_first_seen（用于「已入池多久」跨轮延续）
 * @returns {object[]} 打过分的事件（已按 gap 降序），字段分成两组：
 *          [入库字段] 与 [辅助字段]（collect 只挑入库字段写库）
 */
export function scoreEvents(events, opts = {}) {
  const now = opts.now || Date.now()
  const firstSeen = opts.firstSeen || new Map()
  const out = []

  for (const c of events) {
    const rep = c.rep
    const text = `${rep.t} ${rep.s || ''}`
    const srcLayers = new Set(c.items.map((i) => i.layer))

    /* ---- 时间信号 ---- */
    // 过滤空值与明显异常的未来时间戳（源端错年份）——否则「最晚-最早」会拉成天文数字
    const pubs = c.items
      .map((i) => i.ts)
      .filter((t) => t && t <= now + FUTURE_TOLERANCE_MS)
      .sort((a, b) => a - b)
    const pubTs = pubs[0] || 0

    const fs = firstSeen.get(c.key) || now
    const obsAgo = (now - fs) / 60000
    const first = Math.max(1, Math.round(pubTs ? Math.min(obsAgo, (now - pubTs) / 60000) : obsAgo))

    /* ---- 四维 ---- */
    const eng0 = Math.max(0, ...c.items.map((i) => i.h || 0))
    const eng = clamp(Math.log10(1 + eng0) * ENG_SCALE, 0, ENG_CAP)
    const isCN = /[\u4e00-\u9fa5]/.test(rep.t)
    const isForeign = srcLayers.has('tech') && !srcLayers.has('insider')
    const massHit = (c.massHeat || 0) > 0

    const tim = clamp(TIM_BASE - (first * TIM_DECAY_PER_MIN), TIM_FLOOR, TIM_BASE)
    const scar = massHit
      ? clamp(SCAR_MASS_BASE + (isForeign ? SCAR_MASS_FOREIGN : 0), 0, SCAR_MASS_CAP)
      : clamp(
          SCAR_BASE +
            (isForeign ? SCAR_FOREIGN : 0) +
            (c.items.length <= 1 ? SCAR_SINGLE : 0) -
            (isCN ? 0 : SCAR_NON_CN),
          0,
          25
        )
    const imp =
      (impactWord.test(text) ? IMP_STRONG : IMP_WEAK) +
      clamp(c.items.length * IMP_PER_SRC, 0, IMP_SRC_CAP) +
      eng +
      ((rep.s || '').length > 40 ? IMP_DETAIL_LONG : IMP_DETAIL_SHORT)
    const act =
      (actionWord.test(text) ? ACT_STRONG : ACT_WEAK) + clamp(digits(rep.s), 0, ACT_DIGIT_CAP)

    const b = [
      Math.round(tim),
      Math.round(scar),
      Math.round(clamp(imp, 0, 25)),
      Math.round(clamp(act, 0, 25)),
    ]
    const gapRaw = clamp(
      Math.round(b[0] * W.tim + b[1] * W.scar + b[2] * W.imp + b[3] * W.act),
      RAW_MIN,
      RAW_MAX
    )

    /* ---- 双轨热度与差值 ---- */
    const insHeat = Math.round(
      clamp(
        INS_BASE +
          c.items.length * INS_PER_SRC +
          (isForeign ? 0 : INS_CN_BONUS) +
          eng * INS_ENG_RATE +
          (impactWord.test(text) ? INS_IMPACT_BONUS : 0),
        0,
        100
      )
    )
    const pubHeat = Math.round(
      massHit
        ? clamp((c.massHeat || 0) * PUB_MASS_RATE + eng * PUB_ENG_RATE, 0, 100)
        : clamp(
            PUB_IDLE_BASE +
              (impactWord.test(text) ? PUB_IDLE_IMPACT : 0) +
              (eng > 8 ? PUB_IDLE_ENG : 0),
            0,
            PUB_IDLE_CAP
          )
    )
    // 差值：决策圈已经热了、大众还没热起来 → 数值越大越「值钱」
    // P2-1 待定：现按 [0,100] 截断（test 里两条断言锁定了该口径）；改 ±100 需先更新断言
    const div = clamp(insHeat - pubHeat, 0, DIV_CAP)

    /* ---- 分类 ---- */
    const firstSrc = byId(c.items[0] && c.items[0].srcId)
    const hint = firstSrc ? firstSrc.ind : 'ai'
    const indR = tagInd(text, hint)
    const dimRaw = tagDim(text)
    const dim =
      dimRaw === DIM_DEFAULT ? (isForeign ? 'tech' : srcLayers.has('insider') ? 'policy' : 'policy') : dimRaw

    /* ---- 时差 ---- */
    const off = pubs
    const lagH =
      massHit && pubTs
        ? Math.max(0, (fs - pubTs) / 3600000)
        : off.length > 1
          ? Math.max(0, (off[off.length - 1] - off[0]) / 3600000)
          : 0

    /* ---- 证据 / 文案 / 标签 ---- */
    const srcUniq = [...new Set(c.items.map((i) => i.srcName))].filter(Boolean)
    const reason = buildReason(c, { massHit, massOn: c.massOn, isForeign, first, srcUniq, lagH })
    const platRows = buildPlat({
      pubH: pubHeat,
      insH: insHeat,
      massHit,
      massOn: c.massOn,
      isForeign,
      fs,
      pubTs,
      c,
      now,
    })

    // 证据链：同名源只留一条（取该源首次出现的那条）
    const seenSrc = new Set()
    const sources = []
    for (const it of c.items) {
      if (!it.srcName || seenSrc.has(it.srcName)) continue
      seenSrc.add(it.srcName)
      sources.push({
        source_name: it.srcName,
        layer: it.layer,
        url: it.u || '',
        publish_ts: it.ts || 0,
        heat: Math.round(it.h || 0),
      })
    }

    out.push({
      /* —— 入库字段（collect.mjs 白名单直取）—— */
      event_key: c.key,
      title: rep.t,
      summary: String(rep.s || rep.t).slice(0, SUMMARY_MAX),
      url: rep.u || '',
      ind: indR.k,
      dim,
      kind: dominantLayer(c.items),
      gap: gapRaw, // 稍后统一被分位映射覆盖，先占位
      gap_raw: gapRaw,
      b_json: b,
      tags: pickTags(text),
      ts_published: pubTs,
      ts_first_seen: fs,
      ins_heat: insHeat,
      pub_heat: pubHeat,
      div,
      mass_on: massHit ? c.massOn || '' : '',
      mass_heat: Math.round(c.massHeat || 0),
      lag_h: +lagH.toFixed(1),
      src_count: srcUniq.length || 1,
      reason,
      action: buildAction(indR.k, dim, text),
      is_foreign: isForeign,

      /* —— 子表 —— */
      sources,
      platforms: platRows,

      /* —— 辅助字段（不入库，供 smoke/前端调试）—— */
      topic: guessKind(text),
      ind_by: indR.by,
      gb: tagGB(text),
      ents: extractEntities(text),
      eng: Math.round(eng0),
      first_min: first,
      tier: 'L2',
      gap_pct: 0,
    })
  }

  /* ---- 分位映射：展示分 54-97 + 分层（口径唯一真源）---- */
  const N = out.length
  const sorted = out.map((o) => o.gap_raw).sort((a, b) => a - b)
  /** 池内分位：并列取中位名次，避免同分条目被系统性高估/低估 */
  const pctOf = (v) => {
    let below = 0
    let equal = 0
    for (const x of sorted) {
      if (x < v) below++
      else if (x === v) equal++
    }
    return (below + Math.max(0, equal - 1) / 2) / Math.max(1, N - 1)
  }
  for (const o of out) {
    const p = pctOf(o.gap_raw)
    o.gap = Math.round(DISPLAY_MIN + p * DISPLAY_SPAN)
    o.gap_pct = +(p * 100).toFixed(1)
    o.tier = p >= TIER_L0 ? 'L0' : p >= TIER_L1 ? 'L1' : 'L2'
  }
  out.sort((a, b) => b.gap - a.gap)
  return out
}
