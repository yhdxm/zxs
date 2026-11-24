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
import { afterEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { defineComponent, h } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'
import GapEmptyState from '../src/components/gapdesk/GapEmptyState.vue'
import GapDetailDrawer from '../src/components/gapdesk/GapDetailDrawer.vue'
import GapDeskView from '../src/views/GapDeskView.vue'

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
import { gapDiv, loadGapFeed, useGapDesk } from '../src/composables/useGapDesk'
import { EMPTY_WINDOW, GAP_TTL_HOURS } from '../src/config/gapdeskConfig'
import {
  DEFAULT_ROLE_CONFIG,
  PERMISSION_TREE,
  getRolePermissions,
  type PermissionNode
} from '../src/services/appDataService'
import router from '../src/router'
import type { GapEventRow, GapRuleRow, GapSourceRow } from '../src/types/gapdesk'

/* ---------- service 可切换桩 ----------
   「规则读取成功但 0 条」与「读失败」是两条不同分支（useGapDesk.loadUserState），
   feed 的错误分支也要能喂进不可转原始值的对象（验 errText 防线），
   所以把这几处换成可切换的桩；其余导出继续用原实现，不影响本文件其它用例。 */
const svcStub = vi.hoisted(() => ({
  listRules: vi.fn(),
  listFavorites: vi.fn(),
  listSubscriptions: vi.fn(),
  loadFeed: vi.fn()
}))

/** 空 feed：视图级用例只需要稳定的空数据，不验网络层 */
const EMPTY_FEED = { events: [], platforms: [], sources: [], meta: null, evidences: [] }

vi.mock('../src/services/gapdeskService', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/services/gapdeskService')>()
  return {
    ...actual,
    // 固定已登录，否则 loadUserState 会走「未登录静默跳过」分支，两条规则分支都碰不到
    resolveUserId: () => Promise.resolve('u-test'),
    listFavorites: svcStub.listFavorites,
    listSubscriptions: svcStub.listSubscriptions,
    listRules: svcStub.listRules,
    loadFeed: svcStub.loadFeed
  }
})

/** 默认成功且为空：让不关心用户态的用例（如整页挂载）拿到稳定返回 */
svcStub.listFavorites.mockResolvedValue({ data: [], error: null })
svcStub.listSubscriptions.mockResolvedValue({ data: [], error: null })
svcStub.listRules.mockResolvedValue({ data: [], error: null })
svcStub.loadFeed.mockResolvedValue({ data: EMPTY_FEED, error: null })

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

  it('17 个 PC 入口 + 移动二级页通过 ?view= 切换，不额外占用权限键', () => {
    const route = router.getRoutes().find((r) => r.path === '/gapdesk')
    // 只登记一个粗粒度权限键：view 级不做权限映射，避免第二处维护
    expect(Object.keys(route?.meta ?? {})).toEqual(['requirePermission'])
  })
})

/* ============================================================
   六、T02/T03 增量：注册表 / 侧栏计数 / 4 个新 computed
   ============================================================ */
const readSource = (rel: string): string => readFileSync(resolve(process.cwd(), rel), 'utf8')
const sliceBlock = (src: string, start: string, end: string): string => {
  const i = src.indexOf(start)
  const j = src.indexOf(end, i)
  return i >= 0 && j > i ? src.slice(i, j) : ''
}

/** 17 个侧栏入口，硬编码作为期望集合（改导航必须同步改这里） */
const SIDEBAR_KEYS = [
  'profile',
  'latest',
  'timeline',
  'matrix',
  'spread',
  'source',
  'alert',
  'report',
  'seats',
  'pricing',
  'brief',
  'source-risk',
  'echo',
  'cycle',
  'score',
  'archive',
  'ai'
] as const

describe('注册表：侧栏 17 项与 PC 视图一一对应', () => {
  it('RAW_GROUPS 恰好 17 个 key，编号 00-16 连续', () => {
    const src = readSource('src/components/gapdesk/GapSidebar.vue')
    const block = sliceBlock(src, 'const RAW_GROUPS', 'const NAV_GROUPS')
    const keys = [...block.matchAll(/key: '([a-z-]+)'/g)].map((m) => m[1])
    const nums = [...block.matchAll(/num: '(\d{2})'/g)].map((m) => m[1])
    expect(keys.length).toBe(17)
    expect(new Set(keys)).toEqual(new Set(SIDEBAR_KEYS))
    expect(nums).toEqual(Array.from({ length: 17 }, (_, i) => String(i).padStart(2, '0')))
  })

  it('GapDeskView.VIEWS 覆盖同样 17 个 key（detail 是二级，不计入）', () => {
    const src = readSource('src/views/GapDeskView.vue')
    const block = sliceBlock(src, 'const VIEWS:', '/** 5 个手机主 tab */')
    const keys = [...block.matchAll(/\{ key: '([a-z-]+)'/g)]
      .map((m) => m[1])
      .filter((key) => key !== 'detail')
    expect(new Set(keys)).toEqual(new Set(SIDEBAR_KEYS))
  })
})

describe('侧栏 countOf：6 个真值口径', () => {
  it('profile/latest/source/alert/brief/source-risk 齐全，total=0 时 source-risk 显示「—」', () => {
    const src = readSource('src/components/gapdesk/GapSidebar.vue')
    const block = sliceBlock(src, 'const countOf', 'interface NavItem')
    for (const token of ["profile:", "latest:", "source:", "alert:", "brief:", "'source-risk':"]) {
      expect(block).toContain(token)
    }
    expect(block).toContain('health.value.total === 0')
  })
})

/* ---------- store 单例：每个用例前重置，避免互相污染 ---------- */
const store = useGapDesk()

function resetStore(): void {
  store.events.value = []
  store.sources.value = []
  store.ruleRows.value = []
  store.ruleLoaded.value = false
  store.filters.inds = []
  store.filters.windowH = GAP_TTL_HOURS
  store.filters.sort = 'gap'
  store.filters.keyword = ''
  store.filters.dim6 = ''
  store.filters.dateBand = ''
  store.filters.onlySub = false
}

afterEach(resetStore)

/** 用真实 router 挂整页：验的是 query → current → 底栏高亮 / 主区组件这条链路 */
async function mountGapDeskView(query: Record<string, string>) {
  const Host = defineComponent({ render: () => h(GapDeskView) })
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/:pathMatch(.*)*', component: Host }]
  })
  await router.push({ path: '/', query })
  await router.isReady()
  const wrapper = mount(Host, { global: { plugins: [router] } })
  await new Promise((r) => setTimeout(r, 0))
  await wrapper.vm.$nextTick()
  return wrapper
}

function makeEvent(over: Partial<GapEventRow> & { id: number }): GapEventRow {
  const now = Date.now()
  return {
    event_key: `k-${over.id}`,
    uniq_keep: '',
    title: `t-${over.id}`,
    summary: '',
    url: '',
    ind: 'ai',
    dim: 'policy',
    kind: 'insider',
    gap: 80,
    gap_raw: 50,
    b_json: [20, 20, 20, 20],
    tags: [],
    ts_published: now,
    ts_first_seen: now,
    ins_heat: 10,
    pub_heat: 5,
    mass_on: null,
    mass_heat: 0,
    lag_h: 0,
    src_count: 1,
    reason: '',
    action: '',
    is_foreign: false,
    expire_at: '',
    created_at: '',
    updated_at: '',
    ...over
  } as GapEventRow
}

describe('useGapDesk.loneCount · 孤证计数不受列表截断影响', () => {
  it('只数 src_count<=1 且 mass_heat==0 的条目，15 条时计数仍是 15（underground 仍截 12）', () => {
    store.events.value = [
      ...Array.from({ length: 15 }, (_, i) =>
        makeEvent({ id: i + 1, gap: 95 - i, src_count: 1, mass_heat: 0 })
      ),
      makeEvent({ id: 16, gap: 50, src_count: 2, mass_heat: 0 }),
      makeEvent({ id: 17, gap: 40, src_count: 1, mass_heat: 50 })
    ]
    expect(store.loneCount.value).toBe(15)
    expect(store.underground.value.length).toBe(12)
  })
})

describe('useGapDesk.supplyByDay · 本地归日与分层聚合', () => {
  it('升序、跳过 ts<=0、l0/l1/l2 取自 ranked 的 tier', () => {
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 10, 0, 0).getTime()
    const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 10, 0, 0).getTime()
    store.events.value = [
      makeEvent({ id: 1, gap: 100, ts_published: today }),
      makeEvent({ id: 2, gap: 90, ts_published: today }),
      makeEvent({ id: 3, gap: 80, ts_published: today }),
      makeEvent({ id: 4, gap: 70, ts_published: today }),
      makeEvent({ id: 5, gap: 60, ts_published: yesterday }),
      makeEvent({ id: 6, gap: 50, ts_published: yesterday }),
      // ts=0 的榜单条目没有日点、不进 supplyByDay，但仍占 ranked 末位（L2）
      makeEvent({ id: 7, gap: 10, ts_published: 0 })
    ]
    const rows = store.supplyByDay.value
    expect(rows.length).toBe(2)
    expect(rows[0]!.key < rows[1]!.key).toBe(true)
    expect(rows.map((row) => row.count)).toEqual([2, 4])
    expect(rows.map((row) => row.l0 + row.l1 + row.l2)).toEqual([2, 4])
    expect(rows[0]!.l2).toBe(2)
    expect(rows[1]!.l0).toBe(1)
    expect(rows[1]!.l1).toBe(2)
  })
})

describe('useGapDesk.sourceGrade · 分数 / 状态 / 汇总口径', () => {
  it('denom=0 时 score=null；冷却优先于 DOWN；avg 只对非 null 求均', () => {
    const row = (
      id: string,
      layer: 'insider' | 'main' | 'rare' | 'tech' | 'mass',
      ok: number,
      fail: number,
      status: 'ok' | 'warn' | 'fail' | 'unknown',
      msg: string | null
    ): GapSourceRow => ({
      id,
      name: id.toUpperCase(),
      layer,
      ttl: null,
      ok,
      fail,
      last_ok: null,
      last_fail: null,
      latency_ms: null,
      items: null,
      status,
      msg
    })
    store.sources.value = [
      row('a', 'main', 9, 1, 'ok', null),
      row('b', 'tech', 0, 5, 'fail', 'timeout'),
      row('c', 'rare', 0, 0, 'unknown', null),
      row('d', 'mass', 3, 0, 'ok', null),
      row('e', 'insider', 0, 3, 'warn', 'skip: 冷却')
    ]
    const grade = store.sourceGrade.value
    const byId = new Map(grade.rows.map((item) => [item.id, item]))
    expect(byId.get('a')?.score).toBe(90)
    expect(byId.get('b')?.score).toBe(0)
    expect(byId.get('c')?.score).toBeNull()
    expect(byId.get('b')?.status).toBe('down')
    expect(byId.get('e')?.status).toBe('cool')
    expect(grade.down).toBe(1)
    expect(grade.total).toBe(5)

    const aggs = new Map(grade.aggs.map((item) => [item.tier, item]))
    expect(aggs.get('reliable')?.count).toBe(1)
    expect(aggs.get('reliable')?.avg).toBe(100)
    // official = a(90) + c(null) + e(0)：null 不参与均值 → (90+0)/2=45，若把 null 当 0 会是 30
    expect(aggs.get('official')?.count).toBe(3)
    expect(aggs.get('official')?.avg).toBe(45)
    expect(aggs.get('probe')?.count).toBe(1)
    expect(aggs.get('probe')?.avg).toBe(0)
  })
})

describe('useGapDesk.ruleCount · 读到 0 条与读失败可区分', () => {
  it('listRules 成功但返回 0 条 → ruleLoaded=true、ruleCount=0（「确实没有规则」）', async () => {
    svcStub.listRules.mockResolvedValueOnce({ data: [], error: null })
    await loadGapFeed(true)
    expect(store.ruleLoaded.value).toBe(true)
    expect(store.ruleCount.value).toBe(0)
  })

  it('listRules reject → ruleLoaded=false、ruleCount=0（「读失败」，不能被当成 0 条）', async () => {
    // 先放一份旧数据：读失败必须清空，不能把上一次的条数当成当前值
    store.ruleRows.value = [{ id: 'stale' } as unknown as GapRuleRow]
    store.ruleLoaded.value = true

    svcStub.listRules.mockRejectedValueOnce(new Error('rules down'))
    await loadGapFeed(true)
    expect(store.ruleLoaded.value).toBe(false)
    expect(store.ruleCount.value).toBe(0)
    expect(store.ruleRows.value).toEqual([])
  })

  it('ruleCount 只数条数，与读取状态解耦', () => {
    store.ruleRows.value = [{ id: 'r1' }, { id: 'r2' }] as unknown as GapRuleRow[]
    expect(store.ruleCount.value).toBe(2)
  })
})

describe('GapEmptyState · 空池默认文案不再串台', () => {
  it('type=empty 使用 EMPTY_WINDOW，不出现回打 / 导出 / 趋势口径', () => {
    const wrapper = mount(GapEmptyState, { props: { type: 'empty' } })
    const text = wrapper.text()
    expect(text).toContain(EMPTY_WINDOW)
    expect(text).not.toContain('回打样本积累中')
    expect(text).not.toContain('检索/导出')
    expect(text).not.toContain('历史序列需快照积累')
    wrapper.unmount()
  })
})

describe('GapDeskView · view 回落（P2-1 回归）', () => {
  it('?dev=mb&view=unknown 落 m-latest，底栏仍 5 格且只高亮「最新」', async () => {
    const wrapper = await mountGapDeskView({ dev: 'mb', view: 'unknown' })
    const tabs = wrapper.findAll('.p-tabbtn')
    expect(tabs.map((t) => t.text().replace(/\s+/g, ''))).toEqual(['最新', '行业', '全景', '单源', '价格'])

    const on = wrapper.findAll('.p-tabbtn.on')
    expect(on.length).toBe(1)
    expect(on[0].text()).toContain('最新')
    expect(on[0].attributes('aria-current')).toBe('page')

    // 主区必须是移动二级页（MbLatestView 的「二级入口」+ mbview 根类），不能渲染 PC 三栏
    const html = wrapper.html()
    expect(html).toContain('gd-stage-mb')
    expect(html).toContain('mbview')
    expect(html).toContain('二级入口')
    expect(html).not.toContain('gd-drawer-host')
    wrapper.unmount()
  })

  it('?dev=mb&view=timeline（已注册但没有移动形态）同样落 m-latest，底栏有高亮', async () => {
    const wrapper = await mountGapDeskView({ dev: 'mb', view: 'timeline' })
    const on = wrapper.findAll('.p-tabbtn.on')
    expect(on.length).toBe(1)
    expect(on[0].text()).toContain('最新')

    const html = wrapper.html()
    expect(html).toContain('mbview')
    // PC 三栏的类名不能出现在手机壳里
    expect(html).not.toContain('class="pcview"')
    expect(html).not.toContain('tlbar')
    wrapper.unmount()
  })

  it('?dev=pc&view=timeline 行为不变，仍渲染 PC 时间线', async () => {
    const wrapper = await mountGapDeskView({ dev: 'pc', view: 'timeline' })
    const html = wrapper.html()
    expect(html).toContain('pcview')
    expect(html).toContain('tlbar')
    expect(html).not.toContain('mbview')
    expect(html).not.toContain('p-tabbtn')
    wrapper.unmount()
  })
})

describe('useGapDesk · feed 错误对象不能打穿模板（整页白防线）', () => {
  it('service 误传不可转原始值的对象时，error 被降级成可读字符串', async () => {
    // Object.create(null) 正是 `String(x)` 会抛 TypeError 的那类对象
    svcStub.loadFeed.mockResolvedValueOnce({ data: EMPTY_FEED, error: Object.create(null) })
    await loadGapFeed(true)
    expect(typeof store.error.value).toBe('string')
    expect(store.error.value).toBe('未知错误')
  })

  it('错误对象带 message 时取 message，不吞掉真实原因', async () => {
    svcStub.loadFeed.mockResolvedValueOnce({ data: EMPTY_FEED, error: { message: 'db down' } })
    await loadGapFeed(true)
    expect(store.error.value).toBe('db down')
  })

  it('PC 整页在错误对象下仍能渲染（GapTopbar 插值不再抛）', async () => {
    svcStub.loadFeed.mockResolvedValueOnce({ data: EMPTY_FEED, error: Object.create(null) })
    const wrapper = await mountGapDeskView({ dev: 'pc', view: 'latest' })
    expect(wrapper.html()).toContain('pcview')
    wrapper.unmount()
  })
})

describe('GapDetailDrawer · Teleport 到 body 后仍能取到令牌（P0 回归）', () => {
  it('打开后节点确实在 .gd-stage 之外，故根节点必须自带 .gd-portal 承接令牌', () => {
    const host = document.createElement('div')
    host.className = 'gd-stage'
    document.body.appendChild(host)

    const wrapper = mount(GapDetailDrawer, {
      props: { modelValue: true, event: null },
      attachTo: host
    })

    const wrap = document.body.querySelector('.gdd-wrap')
    expect(wrap).not.toBeNull()
    expect(wrap.classList.contains('gd-portal')).toBe(true)
    // 这就是缺陷成因：祖先链上没有 .gd-stage，custom property 不继承
    expect(wrap.closest('.gd-stage')).toBeNull()
    // 白面板靠 var(--gd-card)，必须是 .gd-portal 的后代才能继承到
    expect(wrap.querySelector('.gdd')).not.toBeNull()

    wrapper.unmount()
    host.remove()
  })
  it('令牌块选择器组含 .gd-portal，抽屉根节点带该类，且未写进 :root', () => {
    const tokens = readFileSync(resolve(process.cwd(), 'src/styles/gapdesk/tokens.css'), 'utf8')
    // 抽屉 teleport 到 body 后祖先链上没有 .gd-stage，令牌必须由 .gd-portal 一并承接
    expect(tokens).toMatch(/\.gd-stage,\s*\.gd-portal\s*\{/)
    // 依旧不写进 :root：两套客户端共用宿主主题，不能污染
    expect(tokens).not.toMatch(/:root\s*\{/)

    const drawer = readFileSync(resolve(process.cwd(), 'src/components/gapdesk/GapDetailDrawer.vue'), 'utf8')
    expect(drawer).toContain('class="gdd-wrap gd-portal"')
  })
})

describe('GapDeskView · 外壳不再整页「放大」（BugFix 回归）', () => {
  /** 取 CSS 中某条 at-rule 的完整块（按大括号配平），避免正则跨块误判 */
  function atBlock(css: string, head: string): string {
    const start = css.indexOf(head)
    expect(start).toBeGreaterThanOrEqual(0)
    let depth = 0
    for (let i = start + head.length - 1; i < css.length; i += 1) {
      if (css[i] === '{') depth += 1
      else if (css[i] === '}') {
        depth -= 1
        if (depth === 0) return css.slice(start, i + 1)
      }
    }
    throw new Error(`未闭合的 CSS 块：${head}`)
  }

  it('拆壳只在真机做，PC 保留宿主侧栏与 #app 居中宽度', () => {
    const css = readFileSync(resolve(process.cwd(), 'src/styles/gapdesk/layout.css'), 'utf8')
    const mobile = atBlock(css, '@media (max-width: 768px)')
    expect(mobile).toContain('body.gd-fullbleed #app')
    expect(mobile).toContain('body.gd-fullbleed .app-shell.is-authed')
    expect(mobile).toContain('body.gd-fullbleed .app-sidebar')

    // 移掉这个媒体块后，全局再无「藏掉宿主侧栏 / 拆 flex / 去掉 max-width」的规则
    const outside = css.replace(mobile, '')
    expect(outside).not.toContain('body.gd-fullbleed .app-sidebar')
    expect(outside).not.toMatch(/body\.gd-fullbleed \.app-shell\.is-authed\s*\{/)
    expect(outside).not.toMatch(/body\.gd-fullbleed #app/)
  })

  it('紧凑表单字号只在 PC 还原；移动端保留 16px 防聚焦缩放；舞台不用 100vw', () => {
    const css = readFileSync(resolve(process.cwd(), 'src/styles/gapdesk/layout.css'), 'utf8')
    const pcOnly = atBlock(css, '@media (min-width: 769px)')
    expect(pcOnly).toContain('body.gd-fullbleed input')
    expect(pcOnly).toContain('font-size: inherit !important')

    const outside = css.replace(pcOnly, '')
    expect(outside).not.toContain('body.gd-fullbleed input')
    expect(css).not.toContain('width: 100vw')
    expect(css).toContain('width: 100%')
  })
})
