/**
 * 差值台 GAPDESK · 单元测试（纯逻辑，不连库、不发网络）
 *
 * 命名说明：项目 `vitest.config.ts` 的 include 是 `test/**\/*.test.ts`，
 * 命名为 `*.spec.ts` 会被 vitest 直接过滤（`No test files found`），
 * 故沿用仓库既有约定 `*.test.ts`；改 include 白名单会影响其他 17 个测试文件，不做。
 *
 * 覆盖三块口径唯一真源：
 *  1. `src/utils/gapdeskFormat.ts`（前端展示口径）
 *  2. `scripts/gapdesk/cluster.mjs`（指纹 / 三遍聚类）
 *  3. `scripts/gapdesk/score.mjs`（四维打分 / 分位映射）
 *  4. 顺带锁死前端权限与路由门禁（gapdesk 普通用户默认不可见）
 */
import { describe, expect, it } from 'vitest'

import {
  clamp,
  eventKeyOf,
  fmtAgo,
  fmtClock,
  fmtMoney,
  fmtNum,
  gapTone,
  heatLabel,
  pct,
  safeJson
} from '../src/utils/gapdeskFormat'
import {
  DIGEST,
  bigrams,
  dedupe,
  eventKeyOf as eventKeyOfMjs,
  sameEvent
} from '../scripts/gapdesk/cluster.mjs'
import { scoreEvents } from '../scripts/gapdesk/score.mjs'
import { gapDiv } from '../src/composables/useGapDesk'
import {
  DEFAULT_ROLE_CONFIG,
  PERMISSION_TREE,
  getRolePermissions,
  type PermissionNode
} from '../src/services/appDataService'
import router from '../src/router'
import type { GapEventRow } from '../src/types/gapdesk'

/** 固定「当前时刻」：所有相对时间断言都用它，避免跑测试的时刻影响结果 */
const NOW = 1_700_000_000_000
const MIN = 60 * 1000
const HOUR = 60 * MIN
const DAY = 24 * HOUR

/* ============================================================
   一、src/utils/gapdeskFormat.ts
   ============================================================ */
describe('gapdeskFormat · fmtAgo 相对时间', () => {
  it('ts=0 / 非法值 一律返回「时间未知」，绝不显示 1970 或 NaN', () => {
    expect(fmtAgo(0, NOW)).toBe('时间未知')
    expect(fmtAgo(-1, NOW)).toBe('时间未知')
    expect(fmtAgo(Number.NaN, NOW)).toBe('时间未知')
    expect(fmtAgo(Number.POSITIVE_INFINITY, NOW)).toBe('时间未知')
  })

  it('59s 仍是「刚刚」（分钟粒度，不显示秒）', () => {
    expect(fmtAgo(NOW - 59_000, NOW)).toBe('刚刚')
    expect(fmtAgo(NOW - 1, NOW)).toBe('刚刚')
  })

  it('60s 起按分钟进位：59min 仍是 59分钟前', () => {
    expect(fmtAgo(NOW - 60_000, NOW)).toBe('1分钟前')
    expect(fmtAgo(NOW - 59 * MIN, NOW)).toBe('59分钟前')
  })

  it('60min 起按小时进位：23h 仍是 23小时前', () => {
    expect(fmtAgo(NOW - HOUR, NOW)).toBe('1小时前')
    expect(fmtAgo(NOW - 23 * HOUR, NOW)).toBe('23小时前')
  })

  it('24h 起按天进位：48h+ 显示 2 天以上', () => {
    expect(fmtAgo(NOW - DAY, NOW)).toBe('1天前')
    expect(fmtAgo(NOW - 2 * DAY, NOW)).toBe('2天前')
    expect(fmtAgo(NOW - 10 * DAY, NOW)).toBe('10天前')
  })

  it('源站时间超前（时区瑕疵）按「刚刚」处理，不出现「-3分钟前」', () => {
    expect(fmtAgo(NOW + 3 * MIN, NOW)).toBe('刚刚')
  })
})

describe('gapdeskFormat · fmtNum 数字展示', () => {
  it('千分位：999 / 1000 / 9999', () => {
    expect(fmtNum(999)).toBe('999')
    expect(fmtNum(1000)).toBe('1,000')
    expect(fmtNum(9999)).toBe('9,999')
  })

  it('≥1万 转「N.N万」并去掉多余的 .0', () => {
    expect(fmtNum(10000)).toBe('1万')
    expect(fmtNum(12345)).toBe('1.2万')
    expect(fmtNum(123456)).toBe('12.3万')
  })

  it('负数保留符号、非法值兜底 0', () => {
    expect(fmtNum(-1234)).toBe('-1,234')
    expect(fmtNum(Number.NaN)).toBe('0')
  })
})

describe('gapdeskFormat · fmtClock / fmtMoney', () => {
  it('ts<=0 返回空串（表格留空比 1970 干净）', () => {
    expect(fmtClock(0)).toBe('')
    expect(fmtClock(-1)).toBe('')
    expect(fmtClock(Number.NaN)).toBe('')
  })

  it('本年记录为 MM-DD HH:mm，非本年带年份', () => {
    const thisYear = new Date(2024, 4, 6, 9, 8).getTime()
    expect(fmtClock(thisYear)).toMatch(/^(2024-)?05-06 09:08$/)
  })

  it('金额取整并带千分位，不用「万」以免报价被误读', () => {
    expect(fmtMoney(3600)).toBe('¥3,600')
    expect(fmtMoney(12345.6)).toBe('¥12,346')
    expect(fmtMoney(Number.NaN)).toBe('¥0')
  })
})

describe('gapdeskFormat · gapTone 分档边界（85 / 70）', () => {
  it('边界值：69 cool、70 warm、84 warm、85 hot', () => {
    expect(gapTone(69)).toBe('cool')
    expect(gapTone(70)).toBe('warm')
    expect(gapTone(84)).toBe('warm')
    expect(gapTone(85)).toBe('hot')
  })

  it('极值与非法值兜底 cool', () => {
    expect(gapTone(0)).toBe('cool')
    expect(gapTone(100)).toBe('hot')
    expect(gapTone(Number.NaN)).toBe('cool')
  })
})

describe('gapdeskFormat · clamp / pct / heatLabel / safeJson', () => {
  it('clamp 夹取，max<min 时以 min 为准', () => {
    expect(clamp(150, 0, 100)).toBe(100)
    expect(clamp(-5, 0, 100)).toBe(0)
    expect(clamp(50, 80, 20)).toBe(80)
    expect(clamp(Number.NaN, 7, 9)).toBe(7)
  })

  it('pct 除零保护并夹到 0-100', () => {
    expect(pct(1, 4)).toBe(25)
    expect(pct(3, 0)).toBe(0)
    expect(pct(-1, 4)).toBe(0)
  })

  it('heatLabel：0 是「未触达」，不等于「冷」', () => {
    expect(heatLabel(0)).toBe('未触达')
    expect(heatLabel(19)).toBe('冷')
    expect(heatLabel(20)).toBe('温')
    expect(heatLabel(50)).toBe('热')
    expect(heatLabel(80)).toBe('沸')
  })

  it('safeJson 三种形态都要收敛，不许抛错', () => {
    expect(safeJson<number[]>('[1,2]', [])).toEqual([1, 2])
    expect(safeJson<number[]>('not-json', [])).toEqual([])
    expect(safeJson<number[]>('   ', [])).toEqual([])
    expect(safeJson<number[]>([3], [])).toEqual([3])
    expect(safeJson<number[]>(null, [])).toEqual([])
    expect(safeJson<number[]>(42, [])).toEqual([])
  })
})

/* ============================================================
   二、eventKeyOf：前端 TS 与采集侧 mjs 必须逐位一致
   ============================================================ */
describe('eventKeyOf 指纹一致性（ts vs mjs vs 写死基线）', () => {
  /**
   * 期望值来源：`node scripts/gapdesk/smoke.mjs` 的 KEY_BASELINE，
   * 即用 TS 版 eventKeyOf 逐条算出的结果写死。任何一侧改动归一化/哈希都会报红。
   */
  const BASELINE: ReadonlyArray<readonly [string, string]> = [
    ['券商交易外接新规首次明确私募接入标准', 'dab9c9b1'],
    ['OpenAI 发布 GPT-5 新模型', '16ea9c52'],
    ['长鑫存储', '1cf39577'],
    ['国家能源局：2027 年光伏装机目标上调至 3.5 亿千瓦', 'c94821e4'],
    ['TSMC to build new fab in Arizona', 'e629cafd']
  ]

  it('5 个固定标题：ts 与写死基线完全一致', () => {
    for (const [title, want] of BASELINE) {
      expect(eventKeyOf(title)).toBe(want)
    }
  })

  it('5 个固定标题：mjs 与 ts 逐位一致（不一致会导致同一条事件入库两次）', () => {
    for (const [title, want] of BASELINE) {
      expect(eventKeyOfMjs(title)).toBe(want)
      expect(eventKeyOfMjs(title)).toBe(eventKeyOf(title))
    }
  })

  it('归一化：大小写与空白不影响指纹', () => {
    expect(eventKeyOf('OpenAI  发布 GPT-5 新模型')).toBe(eventKeyOf('openai发布gpt-5新模型'))
  })

  it('归一化：只取前 28 字符，超长部分不参与哈希', () => {
    // 归一化后 36 字，超过 28 字截断阈值；两段不同的结尾必须算出同一个指纹
    const head = '国家能源局：2027年光伏装机目标上调至3.5亿千瓦并明确分布式配套细则'
    expect(head.length).toBeGreaterThan(28)
    expect(eventKeyOf(`${head}甲`)).toBe(eventKeyOf(`${head}乙丙丁`))
  })

  it('空值与空串不抛错，输出稳定 hex', () => {
    expect(eventKeyOf('')).toBe(eventKeyOfMjs(''))
    expect(eventKeyOf('')).toMatch(/^[0-9a-f]{1,8}$/)
    // @ts-expect-error 故意传 null 验证兜底（实现里有 ?? '' 保护）
    expect(() => eventKeyOf(null)).not.toThrow()
  })

  it('输出不补零（补零会与库里的 event_key 对不上）', () => {
    expect(eventKeyOf('长鑫存储')).not.toMatch(/^0+[0-9a-f]/)
  })
})

/* ============================================================
   三、scripts/gapdesk/cluster.mjs · 三遍聚类
   ============================================================ */

/** 造一条采集侧归一后的 raw item（字段与 collect.mjs 的 grabSource 保持一致） */
function rawItem(title: string, index: number, extra: Record<string, unknown> = {}) {
  return {
    srcId: 'wallstreetcn',
    srcName: '华尔街见闻·电报',
    layer: 'insider',
    ind: 'fin',
    t: title,
    s: `${title}，原文摘要正文。`,
    u: `https://example.com/${index}`,
    ts: NOW - index * MIN,
    h: 10,
    host: 'example.com',
    text: `${title} ${title}，原文摘要正文。`,
    ...extra
  }
}

describe('cluster.dedupe · 三遍聚类', () => {
  const SAME = '券商交易外接新规首次明确私募接入标准'
  const NEAR_A = '国家能源局上调2027年光伏装机目标至3.5亿千瓦'
  const NEAR_B = '国家能源局：2027年光伏装机目标上调至3.5亿千瓦'

  it('3 条完全同标题 + 2 条近似标题 → 2 个事件（同标题 3 条并进同一簇）', () => {
    const { events, funnel } = dedupe([
      rawItem(SAME, 1),
      rawItem(SAME, 2),
      rawItem(SAME, 3),
      rawItem(NEAR_A, 4),
      rawItem(NEAR_B, 5)
    ])

    expect(funnel.raw).toBe(5)
    expect(funnel.candidates).toBe(5)
    // 3 条同标题只算 1 个精确簇，另 2 条近似标题各自成簇 → 3 个簇
    expect(funnel.exact).toBe(3)
    // 近似遍把 2 条光伏标题并成 1 簇
    expect(funnel.approx).toBe(2)
    expect(funnel.event).toBe(2)

    const sameCluster = events.find((e: { rep: { t: string } }) => e.rep.t === SAME)
    expect(sameCluster).toBeTruthy()
    // 修复后的口径：第 3 条同 key 不许被丢掉，src_count 才算得准
    expect(sameCluster.items).toHaveLength(3)
    expect(new Set(sameCluster.items.map((i: { srcName: string }) => i.srcName)).size).toBe(1)
  })

  it('同标题在合并时取最大 massHeat 与首个 massOn（出圈信息不丢）', () => {
    const { events } = dedupe([
      rawItem(SAME, 1),
      rawItem(SAME, 2, { massHeat: 88, massOn: '微博热搜' })
    ])
    expect(events).toHaveLength(1)
    expect(events[0].massHeat).toBe(88)
    expect(events[0].massOn).toBe('微博热搜')
  })

  it('同源同 URL 的两条不会产生两条独立事件', () => {
    const { funnel } = dedupe([rawItem(SAME, 1), rawItem(SAME, 1)])
    expect(funnel.exact).toBe(1)
    expect(funnel.event).toBe(1)
  })
})

describe('cluster · 早报/盘点/汇总类聚合标题保护', () => {
  const DIGEST_A = '今日早报：A股三大指数集体低开 光伏板块领涨'
  const DIGEST_B = '今日早报：A股三大指数集体低开 光伏板块领跌'

  it('DIGEST 正则覆盖早报/晚报/盘点/汇总/合集', () => {
    for (const kw of ['早报', '晚报', '日报', '晨报', '午报', '盘点', '汇总', '一图看懂', '合集', '快讯集锦']) {
      expect(DIGEST.test(`今日${kw}：十条要闻`)).toBe(true)
    }
    expect(DIGEST.test('券商交易外接新规首次明确私募接入标准')).toBe(false)
  })

  it('第三遍 sameEvent 对聚合类标题直接判 false（绝不因相似度高而合并）', () => {
    const verdict = sameEvent(
      { g: bigrams(DIGEST_A), t: DIGEST_A, text: DIGEST_A },
      { g: bigrams(DIGEST_B), t: DIGEST_B, text: DIGEST_B }
    )
    expect(verdict.digest).toBe(true)
    // 相似度本身很高，但结论必须是「不合并」
    expect(verdict.grams).toBeGreaterThan(0.6)
    expect(verdict.yes).toBe(false)
  })

  /**
   * P1-1 已修复（Engineer 给 `dedupe()` 第二遍近似合并加了 DIGEST 守卫）：
   * 聚合类标题（早报/盘点/汇总/一图看懂/合集）既不吞别人，也不被别人吞。
   * 修复前这两条 sim=0.90 会在第二遍被并成一条（第三遍的 DIGEST 保护形同虚设）。
   */
  it('[P1-1 已修复] 两条早报标题不应被「近似合并」并成一条', () => {
    const { events } = dedupe([rawItem(DIGEST_A, 1), rawItem(DIGEST_B, 2)])
    expect(events).toHaveLength(2)
  })
})

/* ============================================================
   四、scripts/gapdesk/score.mjs · 四维打分与分位映射
   ============================================================ */
describe('score.scoreEvents · 固定输入下的分数口径', () => {
  /** 固定一批输入（3 条同标题 + 1 条近似 + 1 条出圈），now 固定 → 结果可回归 */
  function scoreFixture() {
    const items = [
      rawItem('券商交易外接新规首次明确私募接入标准', 1),
      rawItem('券商交易外接新规首次明确私募接入标准', 2),
      rawItem('券商交易外接新规首次明确私募接入标准', 3),
      rawItem('国家能源局上调2027年光伏装机目标至3.5亿千瓦', 4, {
        ind: 'en',
        s: '国家能源局明确 2027 年光伏装机目标 3.5 亿千瓦，较此前上调 20%。'
      }),
      rawItem('地方国资平台密集设立并购基金 规模超 500 亿元', 5, {
        layer: 'tech',
        srcName: 'TechCrunch',
        ind: 'glob',
        massHeat: 96,
        massOn: '微博热搜'
      })
    ]
    return scoreEvents(dedupe(items).events, { now: NOW, firstSeen: new Map() })
  }

  it('gap_raw 落在 [20,99]，gap 映射到 [54,97]', () => {
    const scored = scoreFixture()
    expect(scored.length).toBeGreaterThan(0)
    for (const e of scored) {
      expect(e.gap_raw).toBeGreaterThanOrEqual(20)
      expect(e.gap_raw).toBeLessThanOrEqual(99)
      expect(e.gap).toBeGreaterThanOrEqual(54)
      expect(e.gap).toBeLessThanOrEqual(97)
    }
  })

  it('分位映射：池内最高 raw 拿 97，最低 raw 落在 54 附近（并列取中位名次）', () => {
    const scored = scoreFixture()
    expect(scored.length).toBeGreaterThan(1)
    const maxGap = Math.max(...scored.map((e) => e.gap))
    const minGap = Math.min(...scored.map((e) => e.gap))
    expect(maxGap).toBe(97)
    // pctOf 对并列分取中位名次：垫底值有并列时 p>0，故下限略高于 54，但绝不可能跑到区间外
    expect(minGap).toBeGreaterThanOrEqual(54)
    expect(minGap).toBeLessThanOrEqual(70)
  })

  it('输出按 gap 降序（前端「差值优先」直接消费该顺序）', () => {
    const scored = scoreFixture()
    const gaps = scored.map((e) => e.gap)
    expect(gaps).toEqual([...gaps].sort((a, b) => b - a))
  })

  it('四维分解各维都夹在 0-25，总分由四维加权得出', () => {
    for (const e of scoreFixture()) {
      expect(e.b_json).toHaveLength(4)
      for (const v of e.b_json) {
        expect(v).toBeGreaterThanOrEqual(0)
        expect(v).toBeLessThanOrEqual(25)
      }
    }
  })

  it('双轨热度与差值：ins/pub 在 0-100，div = ins - pub 且被截断在 [0,100]', () => {
    const scored = scoreFixture()
    for (const e of scored) {
      expect(e.ins_heat).toBeGreaterThanOrEqual(0)
      expect(e.ins_heat).toBeLessThanOrEqual(100)
      expect(e.pub_heat).toBeGreaterThanOrEqual(0)
      expect(e.pub_heat).toBeLessThanOrEqual(100)
      expect(e.div).toBeGreaterThanOrEqual(0)
      expect(e.div).toBeLessThanOrEqual(100)
      // 决策圈更热时 div 必须等于正差（不是随便一个数）
      if (e.ins_heat >= e.pub_heat) expect(e.div).toBe(e.ins_heat - e.pub_heat)
    }
  })

  /**
   * 口径记录（P2-2，详见 QA 报告）：
   * 采集侧 `div = clamp(ins - pub, 0, 100)` 恒为非负；
   * 而前端 `gapDiv()`（GapDualTrack / 时差视图在用）**保留负号**。
   * 这里把两侧的真实行为都锁住，避免任何一侧被悄悄改动而无人发现。
   */
  it('采集侧 div 不出现负值（大众更热时截断为 0，原始列 ins/pub 仍可复原）', () => {
    const scored = scoreFixture()
    const massHit = scored.find((e) => (e.mass_heat ?? 0) > 0)
    expect(massHit).toBeTruthy()
    expect(massHit.pub_heat).toBeGreaterThan(massHit.ins_heat)
    expect(massHit.div).toBe(0)
  })
})

describe('useGapDesk.gapDiv · 前端双轨差值保留负号', () => {
  const base = {
    id: 1,
    event_key: 'k',
    uniq_keep: '',
    title: 't',
    summary: '',
    url: '',
    ind: 'ai',
    dim: 'policy',
    kind: 'insider',
    gap: 90,
    gap_raw: 60,
    b_json: [20, 20, 20, 20],
    tags: [],
    ts_published: 0,
    ts_first_seen: 0,
    ins_heat: 48,
    pub_heat: 88,
    mass_on: '微博热搜',
    mass_heat: 96,
    lag_h: 0,
    src_count: 1,
    reason: '',
    action: '',
    is_foreign: false,
    expire_at: '',
    created_at: '',
    updated_at: ''
  } as unknown as GapEventRow

  it('大众更热时返回负值（-40），而非 0', () => {
    expect(gapDiv(base)).toBe(-40)
  })

  it('决策圈更热时返回正值；null 热度按 0 处理', () => {
    expect(gapDiv({ ...base, ins_heat: 88, pub_heat: 48 })).toBe(40)
    expect(gapDiv({ ...base, ins_heat: null, pub_heat: null })).toBe(0)
  })
})

/* ============================================================
   五、权限与路由门禁（普通用户默认不可见）
   ============================================================ */
describe('权限：gapdesk 默认只对管理员开放', () => {
  const flatten = (nodes: PermissionNode[]): PermissionNode[] =>
    nodes.reduce<PermissionNode[]>(
      (acc, n) => [...acc, n, ...(n.children ? flatten(n.children) : [])],
      []
    )

  it('超管 / 管理员默认拥有 gapdesk.pc 与 gapdesk.mobile', () => {
    expect(getRolePermissions('admin')).toContain('gapdesk.pc')
    expect(getRolePermissions('admin')).toContain('gapdesk.mobile')
    expect(getRolePermissions('superadmin')).toContain('gapdesk.pc')
  })

  it('普通用户默认权限里没有任何 gapdesk.*', () => {
    const userPerms = DEFAULT_ROLE_CONFIG.roles.find((r) => r.key === 'user')?.permissions ?? []
    expect(userPerms.length).toBeGreaterThan(0)
    expect(userPerms.filter((k) => k.startsWith('gapdesk'))).toEqual([])
  })

  it('PERMISSION_TREE 有 gapdesk 父节点与 .pc/.mobile 两个叶子', () => {
    const node = PERMISSION_TREE.find((n) => n.key === 'gapdesk')
    expect(node).toBeTruthy()
    expect(node?.label).toBe('差值')
    const leafKeys = flatten(node?.children ?? []).map((n) => n.key)
    expect(leafKeys).toEqual(['gapdesk.pc', 'gapdesk.mobile'])
  })
})

describe('路由：/gapdesk 有权限门禁', () => {
  it('meta.requirePermission === "gapdesk"', () => {
    const route = router.getRoutes().find((r) => r.path === '/gapdesk')
    expect(route).toBeTruthy()
    expect(route?.name).toBe('gapdesk')
    expect(route?.meta?.requirePermission).toBe('gapdesk')
  })

  it('9 个视图通过 ?view= 切换，不额外占用权限键', () => {
    const route = router.getRoutes().find((r) => r.path === '/gapdesk')
    // 只登记一个粗粒度权限键：view 级不做权限映射，避免第二处维护
    expect(Object.keys(route?.meta ?? {})).toEqual(['requirePermission'])
  })
})
