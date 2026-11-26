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
import { defineComponent, h, nextTick } from 'vue'
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
  gapGapTagsOf,
  gapTagTone,
  gapTone,
  heatLabel,
  i18nBadgeTextOf,
  pct,
  safeJson
} from '../src/utils/gapdeskFormat'
import {
  I18N_DAILY_CHARS,
  i18nBudgetLeft,
  i18nCostOf,
  i18nDayKey,
  i18nFresh,
  isForeignLike,
  needI18n,
  parseI18nResponse
} from '../src/services/gapdeskI18n'
import {
  DIGEST,
  bigrams,
  dedupe,
  eventKeyOf as eventKeyOfMjs,
  sameEvent
} from '../scripts/gapdesk/cluster.mjs'
import { scoreEvents } from '../scripts/gapdesk/score.mjs'
import { FEED_BATCH, gapDiv, loadGapFeed, purgeAndRefresh, useGapDesk } from '../src/composables/useGapDesk'
import {
  EMPTY_DEMO,
  EMPTY_LOADING,
  EMPTY_PURGE_EMPTY,
  EMPTY_PURGE_ERROR,
  EMPTY_PURGE_RUNNING,
  EMPTY_WINDOW,
  GAP_COLLECT_NOTE,
  GAP_FEED_CACHE_KEY,
  GAP_LAG_NOTE,
  GAP_REFRESH_MS,
  GAP_TTL_HOURS
} from '../src/config/gapdeskConfig'
import { parsePurgeResult } from '../src/services/gapdeskService'
import GapTopbar from '../src/components/gapdesk/GapTopbar.vue'
import GapMobileShell from '../src/components/gapdesk/GapMobileShell.vue'
import GapPurgeConfirm from '../src/components/gapdesk/GapPurgeConfirm.vue'
import PcLatestView from '../src/views/gapdesk/pc/PcLatestView.vue'
import MbLatestView from '../src/views/gapdesk/mb/MbLatestView.vue'
import {
  DEFAULT_ROLE_CONFIG,
  PERMISSION_TREE,
  getRolePermissions,
  type PermissionNode
} from '../src/services/appDataService'
import router from '../src/router'
import type {
  GapEventRow,
  GapEventSourceRow,
  GapPlatformRow,
  GapRuleRow,
  GapSourceRow
} from '../src/types/gapdesk'

/* ---------- service 可切换桩 ----------
   「规则读取成功但 0 条」与「读失败」是两条不同分支（useGapDesk.loadUserState），
   feed 的错误分支也要能喂进不可转原始值的对象（验 errText 防线），
   所以把这几处换成可切换的桩；其余导出继续用原实现，不影响本文件其它用例。 */
const svcStub = vi.hoisted(() => ({
  listRules: vi.fn(),
  listFavorites: vi.fn(),
  listSubscriptions: vi.fn(),
  loadFeed: vi.fn(),
  purgeExpired: vi.fn(),
  getSavedUser: vi.fn(),
  cacheClear: vi.fn()
}))

/* 监听清缓存动作本身：重拉成功后 cacheSet 会把新数据写回，不能靠最终 localStorage 值判断 */
vi.mock('../src/services/cloudSyncService', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/services/cloudSyncService')>()
  return {
    ...actual,
    cacheClear: (key: string) => {
      svcStub.cacheClear(key)
      actual.cacheClear(key)
    }
  }
})

/* 用户角色可切换：清理按钮只认 app_accounts 的 admin/superadmin */
vi.mock('../src/services/appDataService', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/services/appDataService')>()
  return { ...actual, getSavedUser: svcStub.getSavedUser }
})

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
    loadFeed: svcStub.loadFeed,
    purgeExpired: svcStub.purgeExpired
  }
})

/** 默认成功且为空：让不关心用户态的用例（如整页挂载）拿到稳定返回 */
svcStub.listFavorites.mockResolvedValue({ data: [], error: null })
svcStub.listSubscriptions.mockResolvedValue({ data: [], error: null })
svcStub.listRules.mockResolvedValue({ data: [], error: null })
svcStub.loadFeed.mockResolvedValue({ data: EMPTY_FEED, error: null })
svcStub.getSavedUser.mockResolvedValue(null)
svcStub.purgeExpired.mockResolvedValue({ data: 0, error: null })

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
  store.canPurge.value = false
  store.purgeState.value = 'idle'
  store.purgeDeleted.value = 0
  store.purgeLastAt.value = 0
  store.purgeError.value = null
  localStorage.removeItem('zxsv2_cache_' + GAP_FEED_CACHE_KEY)
  store.filters.inds = []
  store.filters.windowH = GAP_TTL_HOURS
  store.filters.sort = 'gap'
  store.filters.keyword = ''
  store.filters.dim6 = ''
  store.filters.dateBand = ''
  store.filters.onlySub = false
  // 展开批次是模块级 ref，用例之间必须复位，否则「加载更多」会污染后续用例
  store.feedCount.value = FEED_BATCH
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

describe('管理员清理 · RPC / 清镜像 / 强制重拉（BugFix 交付回归）', () => {
  const CACHE_KEY_LS = 'zxsv2_cache_' + GAP_FEED_CACHE_KEY

  /** 先走一次真实 loadUserState，让 canPurge 由 mock 的角色驱动 */
  async function signInAs(role: 'admin' | 'superadmin' | 'user' | null): Promise<void> {
    svcStub.getSavedUser.mockResolvedValue(role ? { role } : null)
    await loadGapFeed(true)
  }

  it('成功后：真实条数入 state，清镜像，强制重拉一次', async () => {
    await signInAs('admin')
    expect(store.canPurge.value).toBe(true)
    localStorage.setItem(CACHE_KEY_LS, JSON.stringify({ data: EMPTY_FEED, ts: Date.now() }))
    // 稍后读是用户清单，不是缓存：清缓存不能碰它
    localStorage.setItem('gapdesk_later_ids', '[101,102]')
    svcStub.purgeExpired.mockResolvedValueOnce({ data: 7, error: null })
    svcStub.loadFeed.mockClear()

    const res = await purgeAndRefresh()

    expect(res).toEqual({ ok: true, deleted: 7, state: 'done', error: null })
    expect(store.purgeDeleted.value).toBe(7)
    expect(store.purgeMsg.value).toBe('已清除 7 条过期数据并刷新')
    // 只清 gapdesk_feed 这一个 key，且发生在重拉之前；重拉成功后 cacheSet 写回新数据是预期行为
    expect(svcStub.cacheClear).toHaveBeenCalledTimes(1)
    expect(svcStub.cacheClear).toHaveBeenCalledWith(GAP_FEED_CACHE_KEY)
    expect(localStorage.getItem('gapdesk_later_ids')).toBe('[101,102]')
    // force=true 绕过 TTL：重拉必须真的打一次 loadFeed
    expect(svcStub.loadFeed).toHaveBeenCalledTimes(1)
  })

  it('0 条：state=empty 且文案如实说没有可清理项', async () => {
    await signInAs('superadmin')
    svcStub.purgeExpired.mockResolvedValueOnce({ data: 0, error: null })

    const res = await purgeAndRefresh()

    expect(res.state).toBe('empty')
    expect(res.deleted).toBe(0)
    expect(store.purgeMsg.value).toBe(EMPTY_PURGE_EMPTY)
    expect(store.purgeMsg.value).not.toContain('已清除 0 条')
  })

  it('RPC 失败：不清缓存、不重拉、镜像保留，state=error', async () => {
    await signInAs('admin')
    localStorage.setItem(CACHE_KEY_LS, JSON.stringify({ data: EMPTY_FEED, ts: Date.now() }))
    const before = localStorage.getItem(CACHE_KEY_LS)
    svcStub.loadFeed.mockClear()
    svcStub.purgeExpired.mockResolvedValueOnce({ data: 0, error: 'PGRST202 function does not exist' })

    const res = await purgeAndRefresh()

    expect(res).toEqual({ ok: false, deleted: 0, state: 'error', error: 'PGRST202 function does not exist' })
    expect(localStorage.getItem(CACHE_KEY_LS)).toBe(before)
    expect(svcStub.cacheClear).not.toHaveBeenCalled()
    expect(svcStub.loadFeed).not.toHaveBeenCalled()
    expect(store.purgeMsg.value).toContain(EMPTY_PURGE_ERROR)
    expect(store.purgeMsg.value).toContain('PGRST202')
  })

  it('非 admin 不渲染按钮；admin 两端都渲染', async () => {
    await signInAs('user')
    expect(store.canPurge.value).toBe(false)
    expect(mount(GapTopbar).find('.gd-purge-btn').exists()).toBe(false)
    expect(mount(GapMobileShell).find('.p-purge').exists()).toBe(false)

    await signInAs('admin')
    expect(store.canPurge.value).toBe(true)
    const pc = mount(GapTopbar)
    expect(pc.find('.gd-purge-btn').exists()).toBe(true)
    expect(pc.find('.gd-purge-btn').attributes('aria-label')).toBe('清理过期数据')
    const mb = mount(GapMobileShell)
    expect(mb.find('.p-purge').exists()).toBe(true)
    expect(mb.find('.p-purge').attributes('aria-label')).toBe('清理过期数据')
    pc.unmount()
    mb.unmount()
  })

  it('60s 节流：连点两次只打一次 RPC，running 态文案来自 config', async () => {
    await signInAs('admin')
    svcStub.purgeExpired.mockClear()
    svcStub.purgeExpired.mockResolvedValue({ data: 3, error: null })

    const first = purgeAndRefresh()
    expect(store.purgeState.value).toBe('running')
    expect(store.purgeMsg.value).toBe(EMPTY_PURGE_RUNNING)
    await first
    await purgeAndRefresh()

    expect(svcStub.purgeExpired).toHaveBeenCalledTimes(1)
  })

  it('PostgREST 标量两种形态都解析成真实数字', () => {
    expect(parsePurgeResult(5)).toEqual({ deleted: 5, error: null })
    expect(parsePurgeResult({ data: 5, error: null })).toEqual({ deleted: 5, error: null })
    expect(parsePurgeResult({ data: 0, error: null })).toEqual({ deleted: 0, error: null })
    expect(parsePurgeResult({ error: { message: 'forbidden' } })).toEqual({ deleted: 0, error: 'forbidden' })
  })

  it('成功后下一次失败：不残留上一次的删除条数（串联回归）', async () => {
    await signInAs('admin')
    svcStub.purgeExpired.mockResolvedValueOnce({ data: 7, error: null })

    const first = await purgeAndRefresh()
    expect(first.state).toBe('done')
    expect(store.purgeDeleted.value).toBe(7)

    // ① 重新打开浮层这一层：openPurge 必须先把上次条数清零
    const page = await mountGapDeskView({ dev: 'pc', view: 'latest' })
    await page.find('.gd-purge-btn').trigger('click')
    expect(store.purgeDeleted.value).toBe(0)
    expect(store.purgeState.value).toBe('confirm')
    page.unmount()

    // 重新塞回旧值，单独验 ② RPC 失败分支自己也会清零（缺任一层都会红）
    store.purgeDeleted.value = 7
    // 推进 60s 节流窗口，模拟用户隔一段时间再次清理
    store.purgeLastAt.value -= 61_000
    svcStub.purgeExpired.mockResolvedValueOnce({ data: 0, error: 'forbidden' })
    const second = await purgeAndRefresh()

    expect(second).toEqual({ ok: false, deleted: 0, state: 'error', error: 'forbidden' })
    expect(store.purgeDeleted.value).toBe(0)
    expect(store.purgeMsg.value).not.toContain('实际删除')

    // 浮层 DOM 同样不能出现「实际删除 7 条」——三层清零缺一层都会红
    const wrapper = mount(GapPurgeConfirm, { props: { modelValue: true }, attachTo: document.body })
    await nextTick()
    const wrap = document.body.querySelector('.gpc-wrap') as HTMLElement
    expect(wrap.textContent).not.toContain('实际删除')
    expect(wrap.textContent).toContain('forbidden')
    wrapper.unmount()
  })
})

describe('GapPurgeConfirm · Teleport 令牌与六态交互', () => {
  it('浮层挂到 body 且自带 gd-portal；running 期间不能关闭，结果态手动完成', async () => {
    store.purgeState.value = 'confirm'
    store.purgeDeleted.value = 0
    const wrapper = mount(GapPurgeConfirm, { props: { modelValue: true }, attachTo: document.body })
    await nextTick()

    const wrap = document.body.querySelector('.gpc-wrap') as HTMLElement
    expect(wrap).not.toBeNull()
    expect(wrap.classList.contains('gd-portal')).toBe(true)
    expect(wrap.closest('.gd-stage')).toBeNull()
    const primary = wrap.querySelector('.gpc-primary') as HTMLButtonElement
    expect(primary.textContent).toContain('确认清除并刷新')

    // running：两个按钮都禁用，点遮罩不触发关闭
    store.purgeState.value = 'running'
    await nextTick()
    expect(primary.disabled).toBe(true)
    expect((wrap.querySelector('.gpc-x') as HTMLButtonElement).disabled).toBe(true)
    wrap.click()
    await nextTick()
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()

    // done：不改状态、不自动关闭，按钮变「完成」由用户手动收起
    store.purgeState.value = 'done'
    store.purgeDeleted.value = 4
    await nextTick()
    expect((wrap.querySelector('.gpc-primary') as HTMLButtonElement).textContent).toContain('完成')
    expect(store.purgeMsg.value).toContain('4')
    expect(document.body.querySelector('.gpc-wrap')).not.toBeNull()

    wrapper.unmount()
  })
})

describe('顶栏对齐 PageHeader 与移动端触控（UI 打磨回归）', () => {
  /** 取 CSS 中某条 at-rule 的完整块（大括号配平），避免跨块误判 */
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

  it('顶栏消费宿主令牌且保留全部真值胶囊', () => {
    const css = readFileSync(resolve(process.cwd(), 'src/styles/gapdesk/layout.css'), 'utf8')
    const topbar = css.slice(css.indexOf('.gd-topbar {'), css.indexOf('.gd-topbar::before'))
    for (const token of ['var(--surface)', 'var(--border)', 'var(--shadow-card)', 'border-radius: 12px']) {
      expect(topbar).toContain(token)
    }
    const inner = css.slice(css.indexOf('.gd-ph-title {'), css.indexOf('.gd-ph-sub {'))
    expect(inner).toContain('var(--text-strong)')
    expect(inner).toContain('font-size: 18px')

    const tpl = readFileSync(resolve(process.cwd(), 'src/components/gapdesk/GapTopbar.vue'), 'utf8')
    for (const token of ['gd-age-pill', '今日 L0', '兑现率', '时差中位', '清理', '手机版']) {
      expect(tpl).toContain(token)
    }
    // 移动壳在真机上独立渲染，PC 顶栏不能在手机壳里出现
    const host = readFileSync(resolve(process.cwd(), 'src/views/GapDeskView.vue'), 'utf8')
    expect(host).toContain('v-if="effectiveDev === \'pc\'"')
  })

  it('搜索框是真控件：写 filters.keyword，"/" 聚焦，不再是 aria-hidden', async () => {
    store.filters.keyword = ''
    const wrapper = mount(GapTopbar, { attachTo: document.body })
    const input = wrapper.find('input[aria-label="搜索差值"]')
    expect(input.exists()).toBe(true)
    expect(input.attributes('aria-hidden')).toBeUndefined()
    // 原来的假控件是一个 aria-hidden 的 div，现在不应再存在
    expect(wrapper.find('div.gd-searchbox').exists()).toBe(false)

    await input.setValue('银行')
    await new Promise((r) => setTimeout(r, 340))
    expect(store.filters.keyword).toBe('银行')

    window.dispatchEvent(new KeyboardEvent('keydown', { key: '/' }))
    expect(document.activeElement).toBe(input.element)
    wrapper.unmount()
    store.filters.keyword = ''
  })

  it('移动端导航项与关键控件触控区 ≥44px，PC 紧凑尺寸不变', () => {
    const css = readFileSync(resolve(process.cwd(), 'src/styles/gapdesk/components.css'), 'utf8')
    const touch = atBlock(css, '@media (max-width: 768px), (hover: none) and (pointer: coarse)')
    for (const rule of ['.gd-nav', '.gd-stage .pctl', '.gd-viewbtn', '.gd-purge-btn', '.gd-searchbox input']) {
      expect(touch).toContain(rule)
    }
    expect(touch).toMatch(/\.gd-nav[^{]*\{[^}]*min-height:[ ]*44px/)
    // 媒体查询之外，PC 仍是 32px 终端风
    const outside = css.replace(touch, '')
    expect(outside).toMatch(/\.gd-nav[^{]*\{[^}]*height:[ ]*32px/)
  })
})

describe('useGapDesk.lagMedianHours · 小时口径（不再用天）', () => {
  function platformRow(id: number, eventId: number, touchTs: number): GapPlatformRow {
    return {
      id,
      event_id: eventId,
      platform: `p${id}`,
      first_touch_ts: touchTs,
      heat: 1,
      updated_at: ''
    }
  }

  it('奇数样本取中位、保留一位小数（6.25 小时 → 6.3，不再是 0.26 天）', () => {
    store.events.value = [makeEvent({ id: 1, gap: 90 })]
    store.platforms.value = [
      platformRow(1, 1, 1_000),
      platformRow(2, 1, 1_000 + 6.25 * 3600_000)
    ]
    expect(store.lagMedianHours.value).toBe(6.3)
  })

  it('偶数样本取中间两值均值并保留一位小数（6h 与 9h → 7.5）', () => {
    store.events.value = [
      makeEvent({ id: 1, gap: 90 }),
      makeEvent({ id: 2, gap: 80 })
    ]
    store.platforms.value = [
      platformRow(1, 1, 0 + 1_000),
      platformRow(2, 1, 6 * 3600_000 + 1_000),
      platformRow(3, 2, 1_000),
      platformRow(4, 2, 9 * 3600_000 + 1_000)
    ]
    expect(store.lagMedianHours.value).toBe(7.5)
  })

  it('无有效样本返回 null，不返回 0 冒充真值', () => {
    store.events.value = [makeEvent({ id: 1, gap: 90 })]
    store.platforms.value = [platformRow(1, 1, 1_000)]
    expect(store.lagMedianHours.value).toBeNull()
  })
})

describe('useGapDesk.topList · 首屏批次走 ranked 口径，可加载更多', () => {
  it('池子比批次大时只切一批，且带 ranked 的 tier/rank、按 gap 降序', () => {
    store.events.value = Array.from({ length: FEED_BATCH + 5 }, (_, i) => makeEvent({ id: i + 1, gap: 100 - i }))
    expect(store.topList.value.length).toBe(FEED_BATCH)
    expect(store.topList.value[0]?.id).toBe(1)
    expect(store.topList.value[0]?.tier).toBe('L0')
    expect(store.topList.value[0]?.rank).toBe(1)
    // 不再是「重新排一次 pool」，与 ranked 前 N 条逐项一致
    expect(store.topList.value.map((e) => e.id)).toEqual(store.ranked.value.slice(0, FEED_BATCH).map((e) => e.id))
  })

  it('loadMoreTop 每次追加一批，铺满全池后 hasMoreTop 转 false', () => {
    store.events.value = Array.from({ length: FEED_BATCH + 3 }, (_, i) => makeEvent({ id: i + 1, gap: 100 - i }))
    expect(store.topList.value.length).toBe(FEED_BATCH)
    expect(store.hasMoreTop.value).toBe(true)

    store.loadMoreTop()
    expect(store.topList.value.length).toBe(FEED_BATCH + 3)
    expect(store.hasMoreTop.value).toBe(false)

    // 已经铺满，再点也不越界
    store.loadMoreTop()
    expect(store.topList.value.length).toBe(FEED_BATCH + 3)
  })

  it('池子比批次小时全铺，hasMoreTop 为 false，不出现空白的「加载更多」', () => {
    store.events.value = Array.from({ length: 5 }, (_, i) => makeEvent({ id: i + 1, gap: 100 - i }))
    expect(store.topList.value.length).toBe(5)
    expect(store.hasMoreTop.value).toBe(false)
  })

  it('resetFilters 把展开批次收回首屏，避免重置后仍是一长串', () => {
    store.events.value = Array.from({ length: FEED_BATCH + 10 }, (_, i) => makeEvent({ id: i + 1, gap: 100 - i }))
    store.loadMoreTop()
    store.loadMoreTop()
    expect(store.topList.value.length).toBe(FEED_BATCH + 10)

    store.resetFilters()
    expect(store.topList.value.length).toBe(FEED_BATCH)
  })

  it('同分沿用 ranked 的 ts_first_seen 次级排序，不重新排一次', () => {
    store.events.value = [
      makeEvent({ id: 1, gap: 90, ts_first_seen: 2_000 }),
      makeEvent({ id: 2, gap: 90, ts_first_seen: 1_000 })
    ]
    expect(store.topList.value.map((e) => e.id)).toEqual(store.ranked.value.map((e) => e.id))
  })
})

describe('useGapDesk.firstSourceOf · 首触来源取 publish_ts 最小', () => {
  function evidence(over: Partial<GapEventSourceRow> & { id: number; event_id: number }): GapEventSourceRow {
    return {
      source_name: null,
      layer: null,
      url: null,
      publish_ts: null,
      heat: null,
      ...over
    } as GapEventSourceRow
  }

  it('同事件取最早一条；null 时间排到最后；无证据返回 null', () => {
    store.evidences.value = [
      evidence({ id: 1, event_id: 7, source_name: '晚到的', publish_ts: 2_000 }),
      evidence({ id: 2, event_id: 7, source_name: '最早报的', publish_ts: 1_000, url: 'https://a' }),
      evidence({ id: 3, event_id: 8, source_name: '无时间', publish_ts: null }),
      evidence({ id: 4, event_id: 8, source_name: '有时间', publish_ts: 500 })
    ]
    expect(store.firstSourceOf.value(7)?.source_name).toBe('最早报的')
    expect(store.firstSourceOf.value(7)?.url).toBe('https://a')
    expect(store.firstSourceOf.value(8)?.source_name).toBe('有时间')
    expect(store.firstSourceOf.value(999)).toBeNull()
  })

  it('evidences 为空时必须返回 null，不许编造来源', () => {
    store.evidences.value = []
    expect(store.firstSourceOf.value(7)).toBeNull()
  })
})

describe('PcLatestView · 首屏是事件、来源与原文来自真数据', () => {
  it('Hero 统计块在事件卡之后；卡片渲染来源名与原文链接', () => {
    store.events.value = [makeEvent({ id: 1, gap: 92, src_count: 3 })]
    store.evidences.value = [
      {
        id: 1,
        event_id: 1,
        source_name: '路透社',
        layer: 'main',
        url: 'https://example.com/a',
        publish_ts: 1_000,
        heat: 1
      } as GapEventSourceRow
    ]
    const wrapper = mount(PcLatestView)
    const html = wrapper.html()
    expect(html).toContain('路透社')
    expect(html).toContain('href="https://example.com/a"')
    // 首屏第一眼是事件卡，不是统计：hero 必须排在第一个 gcard 之后
    const firstCard = html.indexOf('gd-gcard')
    const hero = html.indexOf('class="hero"')
    expect(firstCard).toBeGreaterThan(-1)
    expect(hero).toBeGreaterThan(firstCard)
    wrapper.unmount()
  })
})

describe('PcLatestView · 14 条上限作用在筛选后的集合（dateBand 回归）', () => {
  function dayKey(offset: number): string {
    const d = new Date()
    d.setDate(d.getDate() + offset)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }
  function dayTs(offset: number): number {
    const d = new Date()
    d.setDate(d.getDate() + offset)
    d.setHours(10, 0, 0, 0)
    return d.getTime()
  }

  /** 一整批今天的高分 + 1 条昨天的低分（必然排在首屏批次之外，topList 里不含它） */
  function seed(): void {
    store.events.value = [
      ...Array.from({ length: FEED_BATCH + 1 }, (_, i) => makeEvent({ id: i + 1, gap: 100 - i, ts_published: dayTs(0) })),
      makeEvent({ id: 101, gap: 10, title: '昨天那条低分事件', ts_published: dayTs(-1) })
    ]
  }

  it('不设 dateBand 只出首屏批次；设成昨天后出那 1 条真实事件（不是 0 条 + 撒谎空态）', () => {
    seed()
    store.filters.dateBand = ''
    const all = mount(PcLatestView)
    expect(all.findAll('.gd-gcard').length).toBe(FEED_BATCH)
    // 首屏批次之外还有条目 → 必须给「加载更多」，不能假装已经看完了
    expect(all.find('.gd-more-btn').exists()).toBe(true)
    all.unmount()

    store.filters.dateBand = dayKey(-1)
    const one = mount(PcLatestView)
    const cards = one.findAll('.gd-gcard')
    expect(cards.length).toBe(1)
    expect(cards[0].text()).toContain('昨天那条低分事件')
    expect(one.text()).not.toContain(EMPTY_WINDOW)
    one.unmount()
  })

  it('加载更多把剩余条目铺出来，铺满后按钮消失并给出总数', () => {
    store.events.value = Array.from({ length: FEED_BATCH + 4 }, (_, i) =>
      makeEvent({ id: i + 1, gap: 100 - i, ts_published: dayTs(0) })
    )
    const wrapper = mount(PcLatestView)
    expect(wrapper.findAll('.gd-gcard').length).toBe(FEED_BATCH)
    expect(wrapper.find('.gd-more-btn').text()).toContain(`已显示 ${FEED_BATCH} / 共 ${FEED_BATCH + 4}`)

    void wrapper.find('.gd-more-btn').trigger('click')
    return nextTick().then(() => {
      expect(wrapper.findAll('.gd-gcard').length).toBe(FEED_BATCH + 4)
      // 全铺完就没有「加载更多」了，不能留一个点了没反应的按钮
      expect(wrapper.find('.gd-more-btn').exists()).toBe(false)
      wrapper.unmount()
    })
  })

  it('选中池里完全没有事件的日期：0 条 + 空态（这才是空态该管的场景）', () => {
    seed()
    store.filters.dateBand = dayKey(-9)
    const wrapper = mount(PcLatestView)
    expect(wrapper.findAll('.gd-gcard').length).toBe(0)
    expect(wrapper.text()).toContain(EMPTY_WINDOW)
    wrapper.unmount()
  })

  it('选中日期池内条目多于批次时，仍只铺一批（批次不因筛选放宽）', () => {
    store.events.value = Array.from({ length: FEED_BATCH + 10 }, (_, i) =>
      makeEvent({ id: i + 1, gap: 100 - i, ts_published: dayTs(-1) })
    )
    store.filters.dateBand = dayKey(-1)
    const wrapper = mount(PcLatestView)
    expect(wrapper.findAll('.gd-gcard').length).toBe(FEED_BATCH)
    expect(wrapper.find('.gd-more-btn').text()).toContain(`共 ${FEED_BATCH + 10}`)
    wrapper.unmount()
  })
})


describe('移动端日期胶囊 · 与 PC 同口径接通 dateBand', () => {
  function dayKey(offset: number): string {
    const d = new Date()
    d.setDate(d.getDate() + offset)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }
  /** 胶囊显示的是 M-DD（不带年份），点击时要按它找到对应按钮 */
  function pillLabel(offset: number): string {
    const d = new Date()
    d.setDate(d.getDate() + offset)
    return `${d.getMonth() + 1}-${String(d.getDate()).padStart(2, '0')}`
  }
  function dayTs(offset: number): number {
    const d = new Date()
    d.setDate(d.getDate() + offset)
    d.setHours(10, 0, 0, 0)
    return d.getTime()
  }
  /** 一整批今天高分 + 1 条昨天低分（排首屏批次外，topList 不含它） */
  function seed(): void {
    store.events.value = [
      ...Array.from({ length: FEED_BATCH + 1 }, (_, i) => makeEvent({ id: i + 1, gap: 100 - i, ts_published: dayTs(0) })),
      makeEvent({ id: 101, gap: 10, title: '昨天那条低分事件', ts_published: dayTs(-1) })
    ]
  }

  it('MbLatestView 同口径：不设日期只出首屏批次，设昨天出 1 条', () => {
    seed()
    store.filters.dateBand = ''
    const all = mount(MbLatestView)
    expect(all.findAll('.p-card').length).toBe(FEED_BATCH)
    all.unmount()

    store.filters.dateBand = dayKey(-1)
    const one = mount(MbLatestView)
    const cards = one.findAll('.p-card')
    expect(cards.length).toBe(1)
    expect(cards[0].text()).toContain('昨天那条低分事件')
    expect(one.text()).not.toContain(EMPTY_WINDOW)
    // 筛选了具体日期时不能再说「今日」——那句会撒谎；本用例那条是 L2，无收尾语
    expect(one.text()).not.toContain('以上是今日全部必看')
    one.unmount()
  })

  it('收尾语四态：今日 / 1 小时内 / 时间未知 / 具体日期，各说各的话', () => {
    // 无筛选 → 今日
    store.events.value = [makeEvent({ id: 1, gap: 90, ts_published: Date.now() })]
    store.filters.dateBand = ''
    const none = mount(MbLatestView)
    expect(none.text()).toContain('以上是今日全部必看')
    none.unmount()

    // live 不是日期，不能说「该日期」
    store.events.value = [makeEvent({ id: 2, gap: 90, ts_published: Date.now() - 10 * 60_000 })]
    store.filters.dateBand = 'live'
    const live = mount(MbLatestView)
    expect(live.text()).toContain('以上是 1 小时内的全部必看')
    expect(live.text()).not.toContain('该日期')
    live.unmount()

    // unknown 不是日期，不能说「该日期」
    store.events.value = [makeEvent({ id: 3, gap: 90, ts_published: 0 })]
    store.filters.dateBand = 'unknown'
    const unknown = mount(MbLatestView)
    expect(unknown.text()).toContain('以上是时间未知的全部必看')
    expect(unknown.text()).not.toContain('该日期')
    unknown.unmount()

    // 具体日期 → 该日期，且不能说「今日」
    store.events.value = [makeEvent({ id: 4, gap: 90, ts_published: dayTs(-1) })]
    store.filters.dateBand = dayKey(-1)
    const day = mount(MbLatestView)
    expect(day.text()).toContain('以上是该日期全部必看')
    expect(day.text()).not.toContain('以上是今日全部必看')
    day.unmount()
  })

  it('点胶囊写 filters.dateBand，再点一次取消（toggle）', async () => {
    seed()
    store.filters.dateBand = ''
    const wrapper = mount(GapMobileShell)
    const pill = wrapper.findAll('.gds-pill').find((p) => p.text().includes(pillLabel(-1)))
    expect(pill).toBeTruthy()
    await pill!.trigger('click')
    expect(store.filters.dateBand).toBe(dayKey(-1))
    await pill!.trigger('click')
    expect(store.filters.dateBand).toBe('')
    wrapper.unmount()
  })

  it('高亮只有单一数据源：filters.dateBand 决定胶囊 on 态', async () => {
    seed()
    store.filters.dateBand = dayKey(-1)
    const wrapper = mount(GapMobileShell)
    const on = wrapper.findAll('.gds-pill.on')
    expect(on.length).toBe(1)
    expect(on[0].text()).toContain(pillLabel(-1))

    // 外部改 store，高亮跟着变（证明不是本地 ref 碰巧相同）
    store.filters.dateBand = ''
    await nextTick()
    expect(wrapper.findAll('.gds-pill.on').length).toBe(0)
    wrapper.unmount()
  })

  it('PC 与 MB 在同样数据 + 同样 dateBand 下渲染条数一致', () => {
    seed()
    for (const band of ['', dayKey(-1)]) {
      store.filters.dateBand = band
      const pc = mount(PcLatestView)
      const mb = mount(MbLatestView)
      expect(mb.findAll('.p-card').length).toBe(pc.findAll('.gd-gcard').length)
      pc.unmount()
      mb.unmount()
    }
  })
})

/* ============================================================
   七、P0 收尾：cron 错峰 + 数据新鲜度诚实化
   ============================================================ */
describe('顶栏数据新鲜度 · 真实但旧的数据不再被标成 DEMO', () => {
  /** 固定采集时刻与当前时刻，避免测试跑在整点附近影响分档 */
  function seedMeta(generatedAt: string | null): void {
    store.meta.value = generatedAt === null
      ? null
      : ({ generated_at: generatedAt } as NonNullable<typeof store.meta.value>)
    store.nowMs.value = NOW
    store.error.value = null
    store.stale.value = false
  }

  it('8 小时前 → 展示数据年龄（黄档），不出现 DEMO / 不是实时源数据', () => {
    seedMeta(new Date(NOW - 8 * HOUR).toISOString())
    const wrapper = mount(GapTopbar)
    const badge = wrapper.find('.gd-age-pill')

    expect(badge.exists()).toBe(true)
    expect(badge.text()).toContain('数据更新于 8小时前')
    expect(badge.classes()).toContain('gd-age-aging')
    expect(badge.text()).not.toContain('DEMO')
    expect(wrapper.text()).not.toContain('不是实时源数据')
    expect(badge.attributes('title')).not.toContain('未连上网关')
    wrapper.unmount()
  })

  it('手机壳与 PC 顶栏共用同一份 dataAgeText：8 小时前文案与 store 完全一致，且不含 DEMO', () => {
    seedMeta(new Date(NOW - 8 * HOUR).toISOString())
    const expected = store.dataAgeText.value
    const pc = mount(GapTopbar)
    const mb = mount(GapMobileShell)

    expect(expected).toContain('数据更新于 8小时前')
    expect(pc.find('.gd-age-pill').text()).toBe(expected)
    // 直接咬 store 派生值；下面的源码断言保证退回 v-if="!live" 写法时必然变红
    expect(mb.find('.p-age-pill').exists()).toBe(true)
    expect(mb.find('.p-age-pill').text()).toBe(expected)
    expect(mb.find('.p-age-pill').classes()).toContain('gd-age-aging')
    expect(mb.find('.p-note').exists()).toBe(true)
    expect(mb.text()).not.toContain('DEMO')
    expect(mb.text()).not.toContain('不是实时源数据')

    // 死 prop 必须清干净：组件源码与调用方都不允许再出现 live 入参
    const shell = readSource('src/components/gapdesk/GapMobileShell.vue')
    const host = readSource('src/views/GapDeskView.vue')
    expect(shell).not.toContain('v-if="!live"')
    expect(shell).not.toContain('live?: boolean')
    // 只查手机壳标签内部：PC 顶栏的 :live 是另一条兼容 prop，不在此轮清理范围
    const shellStart = host.indexOf('<GapMobileShell')
    const shellEnd = host.indexOf('</GapMobileShell>', shellStart)
    const mbBlock = host.slice(shellStart, shellEnd)
    expect(mbBlock).not.toContain(':live=')
    pc.unmount()
    mb.unmount()
  })

  it('generated_at 缺失或异常 → 显示 —，不出现 NaN / 负年龄', () => {
    for (const bad of [null, '', 'not-a-date']) {
      seedMeta(bad)
      const wrapper = mount(GapTopbar)
      const badge = wrapper.find('.gd-age-pill')

      expect(badge.text()).toBe('—')
      expect(badge.classes()).toContain('gd-age-unknown')
      expect(badge.text()).not.toMatch(/NaN|-\d/)
      wrapper.unmount()
    }
  })

  it('采集时间超前 → 按「刚刚」展示，不出现负年龄', () => {
    seedMeta(new Date(NOW + HOUR).toISOString())
    const wrapper = mount(GapTopbar)
    const badge = wrapper.find('.gd-age-pill')

    expect(badge.text()).toContain('数据更新于 刚刚')
    expect(badge.text()).not.toMatch(/-\d/)
    expect(badge.classes()).toContain('gd-age-fresh')
    wrapper.unmount()
  })

  it('时钟走字后徽标跟着变，且时钟沿用 GAP_REFRESH_MS 这一条生命周期', async () => {
    seedMeta(new Date(NOW - 8 * HOUR).toISOString())
    const wrapper = mount(GapTopbar)
    expect(wrapper.find('.gd-age-pill').text()).toContain('数据更新于 8小时前')

    // 共享时钟推进一小时：页面挂着不动也要刷新显示，不靠重新拉数据
    store.nowMs.value = NOW + HOUR
    await nextTick()
    expect(wrapper.find('.gd-age-pill').text()).toContain('数据更新于 9小时前')
    wrapper.unmount()

    const src = readSource('src/composables/useGapDesk.ts')
    expect(src).toContain('GAP_REFRESH_MS')
    expect(src).toMatch(/setInterval\(\(\) => \{[\s\S]*?nowMs\.value = Date\.now\(\)/)
    expect(src).toContain('onBeforeUnmount(stopClock)')
  })
})

describe('空态与采集文案 · 不再承诺固定频率、不再暗示数据虚假', () => {
  it('EMPTY_LOADING / EMPTY_DEMO 去掉「每 30 分钟」与「不是实时源数据」', () => {
    expect(EMPTY_LOADING).not.toContain('每 30 分钟')
    expect(EMPTY_LOADING).toContain('正在加载')
    expect(EMPTY_DEMO).not.toContain('不是实时源数据')
    expect(EMPTY_DEMO).not.toContain('未连上网关')
    expect(EMPTY_DEMO).toContain('采集')
    expect(EMPTY_DEMO).toContain('滞后')
  })

  it('采集 workflow 用 7,37 错峰，注释不再声称每 30 分钟', () => {
    const yml = readSource('.github/workflows/gapdesk-collect.yml')
    expect(yml).toContain("- cron: '7,37 * * * *'")
    expect(yml).not.toContain("'*/30 * * * *'")
    expect(yml).not.toContain('每 30 分钟')
    // 错峰后仍保留原有的并发与超时保护
    expect(yml).toContain('cancel-in-progress: false')
    expect(yml).toContain('timeout-minutes: 5')
    // 槽位存活率改由 GitHub API 按 created_at 反推，workflow 里不留观测代码
    expect(yml).not.toContain('observed_at=')
    expect(yml).not.toContain('run_id=')
  })

  it('4 处采集侧注释同步改口，残留的 30min 只剩真实冷却逻辑', () => {
    const collect = readSource('scripts/gapdesk/collect.mjs')
    const service = readSource('src/services/gapdeskService.ts')
    const score = readSource('scripts/gapdesk/score.mjs')
    const fetch = readSource('scripts/gapdesk/fetch.mjs')

    expect(collect).toContain('每小时两轮，错开整点高峰')
    expect(collect).not.toContain('每 30 分钟')
    expect(service).toContain('每小时两轮，错开整点高峰')
    expect(service).not.toContain('每 30 分钟')
    expect(score).toContain('误差 ≤ 两轮采集间隔')
    expect(score).not.toContain('轮询间隔 30min')
    expect(fetch).toContain('采集每小时两轮')
    expect(fetch).not.toContain('Actions 每 30 分钟一轮')
    // 429 冷却 30min 是真实逻辑，不是过期口径，保持不动
    expect(fetch).toContain('30 * 60 * 1000')
  })

  it('GAP_REFRESH_MS 仍是前端刷新节奏（30s），没有为徽标另开一套间隔常量', () => {
    expect(GAP_REFRESH_MS).toBe(30_000)
  })
})

describe('自动翻译 · 免费通道只进展示层，不碰打分口径', () => {
  const base = {
    event_key: 'abc',
    title: 'OpenAI releases new reasoning model for agents',
    summary: 'The model improves long-horizon planning.',
    is_foreign: true
  }

  it('外文判定听库的 is_foreign；国内事件即使是英文标题也不翻', () => {
    expect(isForeignLike(base)).toBe(true)
    expect(isForeignLike({ ...base, is_foreign: false })).toBe(false)
    expect(isForeignLike({ ...base, is_foreign: null, title: '国内政策发布：算力补贴落地' })).toBe(false)
    expect(isForeignLike({ ...base, is_foreign: null })).toBe(true)
  })

  it('缓存 48h 有效，过期后重翻；空译文不算有效', () => {
    const now = 1_800_000_000_000
    expect(i18nFresh({ title: '已翻译', summary: '', ts: now - 1000 }, now)).toBe(true)
    expect(i18nFresh({ title: '', summary: '', ts: now - 1000 }, now)).toBe(false)
    expect(i18nFresh({ title: '过期', summary: '', ts: now - 49 * 3600_000 }, now)).toBe(false)
    expect(needI18n(base, { abc: { title: '已翻译', summary: '', ts: now - 1000 } }, now)).toBe(false)
    expect(needI18n(base, {}, now)).toBe(true)
  })

  it('解析免费接口：只认 200 且非空译文，额度用完立即失败', () => {
    expect(parseI18nResponse('{"responseStatus":200,"responseData":{"translatedText":" 已翻译 "}}')).toBe('已翻译')
    expect(parseI18nResponse('{"responseStatus":200,"quotaFinished":true,"responseData":{"translatedText":"x"}}')).toBeNull()
    expect(parseI18nResponse('{"responseStatus":403,"responseData":{"translatedText":"x"}}')).toBeNull()
    expect(parseI18nResponse('not json')).toBeNull()
  })

  it('日额度跨天自动恢复，用完就是 0，不偷偷继续翻译', () => {
    const now = i18nDayKey() === '2026-01-01' ? Date.parse('2026-01-02T10:00:00') : Date.parse('2026-01-01T10:00:00')
    expect(i18nBudgetLeft(null, now)).toBe(I18N_DAILY_CHARS)
    expect(i18nBudgetLeft({ date: i18nDayKey(now), chars: I18N_DAILY_CHARS }, now)).toBe(0)
    expect(i18nBudgetLeft({ date: '1999-01-01', chars: I18N_DAILY_CHARS }, now)).toBe(I18N_DAILY_CHARS)
  })

  it('字符额度按截断后的标题+摘要计算，长文不会一次吃光预算', () => {
    const long = { title: 'a'.repeat(500), summary: 'b'.repeat(1000) }
    expect(i18nCostOf(long)).toBe(180 + 120)
  })

  it('差标签只用真实字段：孤证 / 未出圈 / 海外先发，不编数字', () => {
    const tags = gapGapTagsOf({
      ...base,
      src_count: 1,
      mass_heat: 0,
      lag_h: 6.46,
      ts_first_seen: 100,
      ts_published: 90
    } as unknown as GapEventRow)
    expect(tags).toContain('海外先发')
    expect(tags).toContain('大众未出圈')
    expect(tags).toContain('孤证')
    expect(tags).toContain('源间时差 6.5h')
    expect(tags.length).toBeLessThanOrEqual(4)
  })

  it('角标文案如实区分国内原文与四种异常态', () => {
    expect(i18nBadgeTextOf('native')).toContain('国内原文')
    expect(i18nBadgeTextOf('failed')).toContain('不可用')
    expect(i18nBadgeTextOf('quota')).toContain('额度')
    expect(i18nBadgeTextOf('done')).toBe('机器翻译')
  })

  it('时差口径全局唯一真源，所有指标卡引用它', () => {
    expect(GAP_LAG_NOTE).toContain('含检测延迟')
    for (const path of [
      'src/views/gapdesk/pc/PcLatestView.vue',
      'src/views/gapdesk/pc/PcBriefView.vue',
      'src/views/gapdesk/pc/PcEchoView.vue',
      'src/views/gapdesk/mb/MbBriefView.vue',
      'src/views/gapdesk/mb/MbEchoView.vue'
    ]) {
      expect(readSource(path)).toContain('GAP_LAG_NOTE')
    }
  })

  it('翻译不参与打分/排序：pool 的排序字段仍是 gap 与 ts_first_seen', () => {
    const src = readSource('src/composables/useGapDesk.ts')
    expect(src).toMatch(/b\.gap - a\.gap \|\| \(b\.ts_first_seen \|\| 0\) - \(a\.ts_first_seen \|\| 0\)/)
    expect(src).toContain('ensureI18n(ranked.value.slice(0, FEED_BATCH))')
    // 国内事件默认不被过滤掉：onlyForeign 初值为 false
    expect(src).toContain('onlyForeign: false')
  })
})

describe('差值 UI 全面优化 · 语义色 / 可信度 / 侧栏 / 导航分组', () => {
  it('差标签语义色：五类色义唯一，未知标签落 neutral，不误染色', () => {
    expect(gapTagTone('海外先发')).toBe('foreign')
    expect(gapTagTone('源间时差 6.5h')).toBe('lag')
    expect(gapTagTone('大众未出圈')).toBe('mass')
    expect(gapTagTone('孤证')).toBe('risk')
    expect(gapTagTone('5 源交叉')).toBe('cross')
    expect(gapTagTone('早于源站发布时刻')).toBe('neutral')
  })

  it('语义色令牌齐全，且三处视图都用 gapTagTone 上色，色义同源', () => {
    const tokens = readSource('src/styles/gapdesk/tokens.css')
    for (const name of ['foreign', 'lag', 'mass', 'risk', 'cross']) {
      expect(tokens).toContain(`--gd-tag-${name}:`)
    }
    for (const path of [
      'src/components/gapdesk/GapEventCard.vue',
      'src/components/gapdesk/GapDetailDrawer.vue',
      'src/views/gapdesk/mb/MbLatestView.vue',
      'src/components/gapdesk/GapRightCol.vue'
    ]) {
      expect(readSource(path)).toContain('gapTagTone')
    }
  })

  it('可信度圆点数最多 3，孤证用红点、多源用绿点', () => {
    const css = readSource('src/styles/gapdesk/components.css')
    expect(css).toContain('.gd-source-dots.multi i')
    expect(css).toContain('.gd-source-dots.lone i')
    const card = readSource('src/components/gapdesk/GapEventCard.vue')
    expect(card).toContain('Math.min(3, Math.max(1, props.event.src_count || 1))')
  })

  it('数据年龄可点开采集说明，PC 顶栏与移动壳共用同一文案真源', () => {
    expect(GAP_COLLECT_NOTE).toContain('GitHub Actions')
    expect(GAP_COLLECT_NOTE).toContain('延迟或跳过')
    const topbar = readSource('src/components/gapdesk/GapTopbar.vue')
    const shell = readSource('src/components/gapdesk/GapMobileShell.vue')
    expect(topbar).toContain('GAP_COLLECT_NOTE')
    expect(topbar).toContain('@click="ageOpen = !ageOpen"')
    expect(shell).toContain('GAP_COLLECT_NOTE')
    expect(shell).toContain('@click="ageOpen = !ageOpen"')
  })

  it('PC 首屏证据侧栏常驻，宿主把 activeEvent 传进右栏', () => {
    const view = readSource('src/views/GapDeskView.vue')
    expect(view).toContain('<GapRightCol :event="activeEvent"')
    const right = readSource('src/components/gapdesk/GapRightCol.vue')
    expect(right).toContain('选中差 · 证据链')
    expect(right).toContain('firstSourceId')
    expect(right).toContain('loadEventDetail')
  })

  it('侧栏三组语义齐全，17 项一个不少、编号无重复', () => {
    const src = readSource('src/components/gapdesk/GapSidebar.vue')
    expect(src).toContain('看差 · 发现差值')
    expect(src).toContain('研判 · 验证差值')
    expect(src).toContain('管理 · 订阅与导出')
    const nums = [...src.matchAll(/num: '(\d\d)'/g)].map((m) => m[1])
    expect(nums).toHaveLength(17)
    expect(new Set(nums).size).toBe(17)
  })

  it('移动端详情全屏并让出安全区，证据链走时间轴', () => {
    const drawer = readSource('src/components/gapdesk/GapDetailDrawer.vue')
    expect(drawer).toContain('height: 100dvh')
    expect(drawer).toContain('env(safe-area-inset-top)')
    expect(drawer).toContain('.gdd-srcs')
  })
})

describe('只增不减 · 原有差值内容一个不少', () => {
  it('侧栏原四组名与 00-16 编号完全保留，新语义只作徽标叠加', () => {
    const src = readSource('src/components/gapdesk/GapSidebar.vue')
    for (const name of ['看信息', '进阶·可关键', '收费', '研判·扩展']) {
      expect(src).toContain(`title: '${name}'`)
    }
    expect(src).toContain('class="gd-gfocus"')
    const nums = [...src.matchAll(/num: '(\d\d)'/g)].map((m) => m[1])
    expect(nums).toEqual(Array.from({ length: 17 }, (_, i) => String(i).padStart(2, '0')))
  })

  it('导出页原按钮保留，新增复制/下载不覆盖它们', () => {
    const src = readSource('src/views/gapdesk/pc/PcBizViews.vue')
    for (const label of ['生成 PDF', '检索导出', '复制研判文本', '下载 .txt 简报']) {
      expect(src).toContain(label)
    }
  })

  it('归档页保留原搜索标签文案，同时保留真检索', () => {
    const src = readSource('src/views/gapdesk/pc/PcArchiveView.vue')
    expect(src).toContain('搜索归档：关键词 / 行业 / 信源 / 时间')
    expect(src).toContain('v-model="keyword"')
    expect(src).toContain('searchHits')
  })

  it('时差说明保留各视图原句，再叠加含检测延迟口径', () => {
    const paths = [
      'src/views/gapdesk/pc/PcLatestView.vue',
      'src/views/gapdesk/pc/PcBriefView.vue',
      'src/views/gapdesk/pc/PcEchoView.vue',
      'src/views/gapdesk/mb/MbBriefView.vue',
      'src/views/gapdesk/mb/MbEchoView.vue'
    ]
    for (const path of paths) {
      const src = readSource(path)
      expect(src).toMatch(/避免长尾带偏|源间实测/)
      expect(src).toContain('GAP_LAG_NOTE')
    }
  })

  it('移动端理由完整展示，不因四行卡做视觉截断', () => {
    const src = readSource('src/views/gapdesk/mb/MbLatestView.vue')
    expect(src).toContain('class="why"')
    expect(src).not.toContain('-webkit-line-clamp')
  })

  it('AI 提示 chip 保留提示文案且可点击填入', () => {
    const src = readSource('src/views/gapdesk/pc/PcAIView.vue')
    expect(src).toContain(':title="EMPTY_AI_INPUT"')
    expect(src).toContain('chip-btn')
    expect(src).toContain('@click="query = q"')
  })

  it('视觉增强只追加样式，不通过隐藏/截断减少信息', () => {
    const css = readSource('src/styles/gapdesk/components.css')
    expect(css).toContain('.gd-gaptag::before')
    expect(css).toContain('filter: saturate(1.2)')
    expect(css).toContain('transform: scale(1.35)')
  })
})

describe('字体与其他模块对齐 + 双端 AI 检索一致', () => {
  it('GAPDESK 字族与其他模块同链，字号抬到正文 13-14 / 辅助 11-12 基准', () => {
    const tokens = readSource('src/styles/gapdesk/tokens.css')
    expect(tokens).toContain("--gd-sans: 'Inter', system-ui, -apple-system")
    expect(tokens).toContain('--gd-fs-nav: 13px')
    expect(tokens).toContain('--gd-fs-why: 13.5px')
    expect(tokens).toContain('--gd-fs-pill: 11.5px')
    // 不允许再出现极小的 9/10px 正文（8px 只留给胶囊装饰伪元素）
    const css = readSource('src/styles/gapdesk/components.css')
    expect(css).not.toMatch(/font-size:\s*(9|10(\.5)?)px/)
  })

  it('移动 AI 页检索与 PC 同口径：真查 48h 池，不做禁用假输入', () => {
    const mb = readSource('src/views/gapdesk/mb/MbAIView.vue')
    const pc = readSource('src/views/gapdesk/pc/PcAIView.vue')
    expect(mb).toContain('v-model="query"')
    expect(mb).not.toContain('class="ask" type="text" disabled')
    expect(mb).toContain('titleOf(item)')
    // 两端同一过滤式：标题 + 译文 + reason，按 GAP 排序由 ranked 保证
    for (const src of [mb, pc]) {
      expect(src).toContain("titleOf(item)")
      expect(src).toContain("item.reason ?? ''")
      expect(src).toContain('.slice(0, 8)')
    }
  })

  it('顶栏搜索文案如实：48h 池内没有归档，不写「搜索归档」', () => {
    const topbar = readSource('src/components/gapdesk/GapTopbar.vue')
    expect(topbar).toContain('placeholder="搜索标题 / 摘要 / 行业"')
    expect(topbar).not.toContain('placeholder="搜索归档')
  })
})
