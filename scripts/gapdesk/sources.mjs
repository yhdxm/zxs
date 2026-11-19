/* =========================================================
   GAPDESK 采集管道 · 27 路免费信源注册表
   来源：D:/龙虾产物/差值/差值台GAPDESK-系统/server.mjs 的 SOURCES（第 101-235 行），
         按「实测稳定性 + 8 行业覆盖」裁剪到 25 路，后补 rare 垂直层 2 路（freebuf / sci_life），共 27 路。
   ---------------------------------------------------------
   字段约定：
     id       与库表 gap_sources.id 一致（健康度回写的主键，不可随意改）
     layer    insider / main / rare / tech / mass（mass 只做「是否出圈」探针，不进情报池；rare 为垂直冷门源）
     kind     json | rss
     ind      信源行业归属（仅在内容关键词一个都不命中时作为兜底）
     ttl      **分钟**（与 src/config/gapdeskConfig.ts、库表 gap_sources.ttl 同一口径）
     timeout  单源硬超时（毫秒），不填默认 12000
     rank     榜单类源（热度值是名次/热度，需要另一套归一化曲线）
     pick     json 源的字段抽取器；rss 源用 fetch.mjs 的 parseRSS
     seed     标记为「已在实测中验证过」的种子源
   ========================================================= */
import { cleanTitle, stripTags, parseHot, tsOf } from './fetch.mjs'

/** 东财三个栏目完全同构，抽成一个 pick 工厂，避免三份复制粘贴 */
const emPick = (j) =>
  (j?.data?.list || []).map((x) => ({
    t: cleanTitle(x.title || x.summary || ''),
    s: stripTags(x.bm_intro || x.summary || '').slice(0, 170),
    ts: tsOf(x.showTime) || (Number(x.realSort) || 0) * 1000,
    u: x.uniqueUrl || x.url || '',
  }))

/** 60s 开源榜单接口（微博/知乎/头条）同构，抽一个工厂 */
const hotPick = (j) =>
  (Array.isArray(j?.data) ? j.data : []).map((x) => ({
    t: String(x.title || x.word || ''),
    s: x.detail || '',
    ts: 0, // 榜单不提供发布时间：0 表示「无时间」，绝不编造
    u: '',
    h: parseHot(x.hot_value_desc || x.hot_value || x.hot || x.num),
  }))

export const SOURCES = [
  /* —— 决策圈 / 快讯层（带真实发布时间，最值钱的「早」）—— */
  {
    id: 'wallstreetcn',
    name: '华尔街见闻·电报',
    layer: 'insider',
    kind: 'json',
    ind: 'fin',
    ttl: 5,
    url: 'https://api-one.wallstcn.com/apiv1/content/lives?channel=global-channel&limit=30',
    pick: (j) =>
      (j?.data?.items || []).map((x) => ({
        t: cleanTitle(stripTags(x.title || x.content).split(/[。。！？;]/)[0].slice(0, 58)),
        s: stripTags(x.content).slice(0, 170),
        ts: tsOf(x.display_time),
        h: (x.votes || 0) + (x.comment_count || 0) * 3,
        u: x.uri || 'https://wallstreetcn.com/live/global',
      })),
    seed: true,
  },
  {
    id: 'eastmoney724',
    name: '东方财富·7x24',
    layer: 'insider',
    kind: 'json',
    ind: 'fin',
    ttl: 5,
    url: 'https://np-listapi.eastmoney.com/comm/web/getNewsByColumns?client=web&biz=web_news_col&column=350&order=1&page_index=1&page_size=30&req_trace=1',
    pick: emPick,
    seed: true,
  },
  {
    id: 'em347',
    name: '东方财富·要闻精选',
    layer: 'insider',
    kind: 'json',
    ind: 'fin',
    ttl: 5,
    url: 'https://np-listapi.eastmoney.com/comm/web/getNewsByColumns?client=web&biz=web_news_col&column=347&order=1&page_index=1&page_size=30&req_trace=1',
    pick: emPick,
    seed: true,
  },
  {
    id: 'em352',
    name: '东方财富·全球市场',
    layer: 'insider',
    kind: 'json',
    ind: 'glob',
    ttl: 5,
    url: 'https://np-listapi.eastmoney.com/comm/web/getNewsByColumns?client=web&biz=web_news_col&column=352&order=1&page_index=1&page_size=30&req_trace=1',
    pick: emPick,
    seed: true,
  },
  {
    id: 'jiemian',
    name: '界面新闻',
    layer: 'insider',
    kind: 'rss',
    ind: 'fin',
    ttl: 15,
    url: 'https://a.jiemian.com/index.php?m=article&a=rss',
    limit: 25,
    seed: true,
  },
  {
    id: 'chinanews',
    name: '中新网滚动',
    layer: 'insider',
    kind: 'rss',
    ind: 'glob',
    ttl: 15,
    url: 'https://www.chinanews.com.cn/rss/scroll-news.xml',
    limit: 20,
    seed: true,
  },
  {
    id: 'leiphone',
    name: '雷峰网',
    layer: 'insider',
    kind: 'rss',
    ind: 'ai',
    ttl: 20,
    url: 'https://www.leiphone.com/feed',
    limit: 15,
    seed: true,
  },
  {
    id: 'qbitai',
    name: '量子位',
    layer: 'rare',
    kind: 'rss',
    ind: 'ai',
    ttl: 20,
    url: 'https://www.qbitai.com/feed',
    limit: 10,
    seed: true,
  },

  /* —— 冷门 / 垂直层（圈层一手，rare 稀缺度加分主力）——
     这两路从原网关 SOURCES 取端点；按「垂直冷门」语义从 insider 改标 rare，
     让健康面板 rare 分组不再永远为空，也让稀缺度打分有真实来源。 */
  {
    id: 'freebuf',
    name: 'FreeBuf 安全',
    layer: 'rare',
    kind: 'rss',
    ind: 'ai',
    ttl: 60,
    url: 'https://www.freebuf.com/feed',
    limit: 15,
    seed: true,
  },
  {
    id: 'sci_life',
    name: 'ScienceDaily 生物',
    layer: 'rare',
    kind: 'rss',
    ind: 'med',
    ttl: 60,
    url: 'https://www.sciencedaily.com/rss/plants_animals/biology.xml',
    limit: 20,
    seed: true,
  },

  /* —— 主流媒体层（已被大范围复述 → 差值正在收敛）—— */
  {
    id: 'ithome',
    name: 'IT之家',
    layer: 'main',
    kind: 'rss',
    ind: 'ai',
    ttl: 20,
    url: 'https://www.ithome.com/rss/',
    limit: 20,
    seed: true,
  },
  {
    id: 'sspai',
    name: '少数派',
    layer: 'main',
    kind: 'rss',
    ind: 'ai',
    ttl: 30,
    url: 'https://sspai.com/feed',
    limit: 15,
    seed: true,
  },
  {
    id: 'ifanr',
    name: '爱范儿',
    layer: 'main',
    kind: 'rss',
    ind: 'ai',
    ttl: 30,
    url: 'https://ifanr.com/feed',
    limit: 15,
    seed: true,
  },
  {
    id: 'oschina',
    name: '开源中国',
    layer: 'main',
    kind: 'rss',
    ind: 'ai',
    ttl: 20,
    url: 'https://www.oschina.net/news/rss',
    limit: 20,
    seed: true,
  },
  {
    id: 'cn_china',
    name: '中新网·国内',
    layer: 'main',
    kind: 'rss',
    ind: 'glob',
    ttl: 15,
    url: 'https://www.chinanews.com.cn/rss/china.xml',
    limit: 20,
    seed: true,
  },
  {
    id: 'cn_finance',
    name: '中新网·财经',
    layer: 'main',
    kind: 'rss',
    ind: 'fin',
    ttl: 15,
    url: 'https://www.chinanews.com.cn/rss/finance.xml',
    limit: 20,
    seed: true,
  },

  /* —— 海外前沿层（英文一手，天然与大众层存在跨语言时差 → 差值主力）—— */
  {
    id: 'hn',
    name: 'Hacker News',
    layer: 'tech',
    kind: 'json',
    ind: 'ai',
    ttl: 15,
    url: 'https://hn.algolia.com/api/v1/search_by_date?tags=story&hitsPerPage=30',
    pick: (j) =>
      (j?.hits || []).map((x) => ({
        t: cleanTitle(x.title || ''),
        s: stripTags(x.text || x.url || '').slice(0, 150),
        ts: tsOf(x.created_at),
        h: x.points || 0,
        u: x.url || `https://news.ycombinator.com/item?id=${x.objectID}`,
      })),
    seed: true,
  },
  {
    id: 'hnfront',
    name: 'HN 首页',
    layer: 'tech',
    kind: 'json',
    ind: 'ai',
    ttl: 15,
    url: 'https://hn.algolia.com/api/v1/search?tags=front_page&hitsPerPage=25',
    pick: (j) =>
      (j?.hits || []).map((x) => ({
        t: cleanTitle(x.title || ''),
        s: stripTags(x.url || '').slice(0, 120),
        ts: tsOf(x.created_at),
        // 首页排名带真实 points + 评论数，互动量口径比新提交更可信
        h: (x.points || 0) + (x.num_comments || 0) * 2,
        u: x.url || `https://news.ycombinator.com/item?id=${x.objectID}`,
      })),
    seed: true,
  },
  {
    id: 'arxiv',
    name: 'arXiv cs.LG/AI',
    layer: 'tech',
    kind: 'rss',
    ind: 'ai',
    ttl: 60,
    timeout: 26000, // 实测偶发 20s+，单独放宽，避免整轮被它拖死
    url: 'http://export.arxiv.org/api/query?search_query=cat:cs.LG+OR+cat:cs.AI&sortBy=submittedDate&sortOrder=descending&max_results=25',
    limit: 25,
    seed: true,
  },
  {
    id: 'techcrunch',
    name: 'TechCrunch',
    layer: 'tech',
    kind: 'rss',
    ind: 'ai',
    ttl: 15,
    url: 'https://techcrunch.com/feed/',
    limit: 20,
    seed: true,
  },
  {
    id: 'europepmc',
    name: 'Europe PMC 预印本',
    layer: 'tech',
    kind: 'json',
    ind: 'med',
    ttl: 60,
    // bioRxiv 官方 RSS 实测 403（封数据中心 IP）；改用 Europe PMC 公开 REST，是其超集
    url: 'https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=SRC%3APPR%20AND%20%28PUBLISHER%3A%22bioRxiv%22%20OR%20PUBLISHER%3A%22medRxiv%22%29&format=json&pageSize=25&resultType=lite&sort=P_PDATE_D%20desc',
    pick: (j) =>
      (j?.resultList?.result || []).map((x) => ({
        t: cleanTitle(x.title || ''),
        s: String(x.authorString || '').slice(0, 160),
        ts: tsOf(x.firstPublicationDate ? `${x.firstPublicationDate}T00:00:00Z` : 0),
        h: 0,
        u: x.doi ? `https://doi.org/${x.doi}` : `https://europepmc.org/article/${x.source}/${x.id}`,
      })),
    seed: true,
  },
  {
    id: 'sci_med',
    name: 'ScienceDaily 医学健康',
    layer: 'tech',
    kind: 'rss',
    ind: 'med',
    ttl: 60,
    url: 'https://www.sciencedaily.com/rss/health_medicine.xml',
    limit: 20,
    headers: { 'user-agent': 'Mozilla/5.0 (compatible; GAPDESK-Research/1.0)' },
    seed: true,
  },
  {
    id: 'sci_agri',
    name: 'ScienceDaily 农业食品',
    layer: 'tech',
    kind: 'rss',
    ind: 'agri',
    ttl: 60,
    // ⚠️ 停更候选（2026-11-19 实测）：该 RSS 返回 200、也有 18 条，但发布时间全部超过 168h，
    //    100% 被新鲜度闸门拦下 → 对情报池贡献恒为 0。
    //    处置：保留 URL 并标 stale，summary 里单列「停更候选」，等换源；
    //    绝不删源 —— 删了就没人知道这块覆盖已经空了。
    stale: true,
    url: 'https://www.sciencedaily.com/rss/plants_animals/agriculture_and_food.xml',
    limit: 20,
    headers: { 'user-agent': 'Mozilla/5.0 (compatible; GAPDESK-Research/1.0)' },
    seed: true,
  },

  /* —— 大众探针层（只判「是否出圈」，不作为情报来源）—— */
  {
    id: 'weibo',
    name: '微博热搜',
    layer: 'mass',
    kind: 'json',
    ttl: 10,
    url: 'https://60s-api.viki.moe/v2/weibo',
    rank: true,
    pick: hotPick,
    seed: true,
  },
  {
    id: 'zhihu',
    name: '知乎热榜',
    layer: 'mass',
    kind: 'json',
    ttl: 10,
    url: 'https://60s-api.viki.moe/v2/zhihu',
    rank: true,
    // 知乎接口带 hot_value_desc（如「763 万热度」），比纯数字更可读
    pick: (j) =>
      (Array.isArray(j?.data) ? j.data : []).map((x) => ({
        t: String(x.title || x.word || ''),
        s: x.detail || '',
        ts: 0,
        u: '',
        h: parseHot(x.hot_value_desc || x.hot_value || x.hot || x.num),
      })),
    seed: true,
  },
  {
    id: 'douyin',
    name: '抖音热榜',
    layer: 'mass',
    kind: 'json',
    ttl: 10,
    url: 'https://60s-api.viki.moe/v2/douyin?limit=50',
    rank: true,
    // 抖音榜无热度字段，只有名次 → 热度按榜单位置折算（见 normalizeHeat）
    pick: (j) =>
      (Array.isArray(j?.data) ? j.data : []).map((x) => ({
        t: String(x.title || x.word || ''),
        s: '',
        ts: 0,
        u: '',
      })),
    seed: true,
  },
  {
    id: 'toutiao',
    name: '头条热榜',
    layer: 'mass',
    kind: 'json',
    ttl: 10,
    url: 'https://60s-api.viki.moe/v2/toutiao',
    rank: true,
    pick: hotPick,
    seed: true,
  },
]

/** id → 源对象（O(1)，打分时反查信源归属/层级用） */
const INDEX = new Map(SOURCES.map((s) => [s.id, s]))

/** 按 id 取源；不存在返回 null（不要 throw，采集侧要能容错） */
export function byId(id) {
  return INDEX.get(id) || null
}

/** 按 id 取展示名（用于把 health 里的 id 还原成人话） */
export function nameOf(id) {
  const s = INDEX.get(id)
  return s ? s.name : id
}

/**
 * 计算本轮该抓哪些源。
 * @param {Record<string, {last_ok?:string, ok?:number, fail?:number}>} healthMap
 *        gap_sources 现有健康度（key = source.id）
 * @param {number} now 当前时间戳（毫秒）
 * @param {{forceAll?:boolean, limit?:number}} opts forceAll=true 全抓（首轮/调试）；
 *        limit 只取前 N 路（smoke --limit 用）
 * @returns {{due:object[], skipped:object[]}}
 */
export function dueSources(healthMap = {}, now = Date.now(), opts = {}) {
  const list = opts.limit && opts.limit > 0 ? SOURCES.slice(0, opts.limit) : SOURCES
  const due = []
  const skipped = []
  for (const src of list) {
    // 大众探针层永不「跳过」：它是判断是否出圈的探针，少一轮就会出现假差值
    if (src.layer === 'mass' || opts.forceAll) {
      due.push(src)
      continue
    }
    const h = healthMap[src.id] || {}
    const lastOk = h.last_ok ? Date.parse(h.last_ok) : 0
    const dueAt = lastOk + (src.ttl || 15) * 60 * 1000
    if (!lastOk || now >= dueAt) due.push(src)
    else skipped.push({ ...src, dueAt, waitMs: dueAt - now })
  }
  return { due, skipped }
}

/** 各层源数量（summary 里报数用） */
export function layerCount() {
  const out = { insider: 0, main: 0, rare: 0, tech: 0, mass: 0 }
  for (const s of SOURCES) out[s.layer] = (out[s.layer] || 0) + 1
  return out
}
