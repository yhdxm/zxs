<template>
  <div class="xy-root">
    <PageHeader
      title="星舆识途"
      subtitle="汽车资讯 · 知识 · AI 答疑 · 数据源：Google News RSS + 汽车之家车型库(bitefu 免KEY) + 国内兜底 · 全部免费公开源、不消耗额度"
      :icon="Van"
    >
      <div class="xy-clock-box" title="北京时间">
        <span class="xy-dot"></span>
        <span class="xy-clock">{{ nowText }}</span>
        <span class="xy-clock-hint">北京时间</span>
      </div>
    </PageHeader>

    <!-- ===== 八模块入口 ===== -->
    <nav class="xy-entries">
      <button
        v-for="m in MODULES"
        :key="m.key"
        type="button"
        class="xy-entry"
        :class="{ on: active === m.key }"
        :style="{ '--c': m.color }"
        @click="switchModule(m.key)"
      >
        <span class="xe-bar"></span>
        <span class="xe-icon"><el-icon><component :is="m.icon" /></el-icon></span>
        <span class="xe-text">
          <span class="xe-label">{{ m.label }}</span>
          <span class="xe-desc">{{ m.desc }}</span>
        </span>
        <span class="xe-count">{{ countOf(m.key) }}</span>
      </button>
    </nav>

    <Transition name="xy-fade" mode="out-in">
      <section :key="active" class="xy-body">
        <!-- 调用 AI -->
        <div v-if="active === 'ai'" class="xy-card">
          <h3 class="xy-h">AI 汽车答疑</h3>
          <p class="xy-sub">基于你已配置的 AI（AI 助手）回答选车、用车、技术、政策等问题，仅供参考。</p>
          <el-input v-model="qaQuestion" type="textarea" :rows="3" placeholder="例如：15 万预算买新能源轿车，有哪些推荐？增程和插混怎么选？" />
          <div class="xy-row">
            <el-button type="primary" :loading="qaLoading" @click="runQa">向 AI 提问</el-button>
            <span v-if="!cfg" class="xy-warn">未检测到 AI 配置，请先到「AI 助手」配置密钥。</span>
          </div>
          <div v-if="qaAnswer" class="xy-answer">{{ qaAnswer }}</div>
        </div>

        <!-- 热点信息 -->
        <div v-else-if="active === 'hot'" class="xy-card">
          <div class="xy-hrow">
            <h3 class="xy-h">汽车热点信息</h3>
            <button class="xy-refresh" @click="loadHot" :disabled="loading.hot">{{ loading.hot ? '加载中…' : '刷新' }}</button>
          </div>
          <div v-if="!hotNews.length && loading.hot" class="xy-skeleton"><el-skeleton :rows="6" animated /></div>
          <div v-else class="xy-grid">
            <a v-for="n in hotNews" :key="n.link" :href="n.link" target="_blank" class="xy-news">
              <div class="xy-news-title">{{ n.title }}</div>
              <div class="xy-news-meta"><span>{{ n.source }}</span><span>{{ n.pubDate }}</span></div>
            </a>
            <p v-if="!hotNews.length" class="xy-empty">暂无数据，点击刷新重试。</p>
          </div>
        </div>

        <!-- 汽车知识 -->
        <div v-else-if="active === 'knowledge'" class="xy-card">
          <div class="xy-hrow">
            <h3 class="xy-h">汽车知识（小白可读）</h3>
            <el-input v-model="kSearch" placeholder="搜索关键词，如 续航 / 保养 / 购置税" class="xy-search" />
          </div>
          <div class="xy-kcats">
            <button
              v-for="c in knowledgeCats"
              :key="c"
              :class="['xy-chip', kCat === c ? 'on' : '']"
              @click="kCat = c"
            >{{ c }}</button>
          </div>
          <div class="xy-grid2">
            <div v-for="k in filteredKnowledge" :key="k.title" class="xy-know">
              <div class="xy-know-cat">{{ k.cat }}</div>
              <div class="xy-know-title">{{ k.title }}</div>
              <div class="xy-know-body">{{ k.content }}</div>
              <ul v-if="k._open && k.detail && k.detail.length" class="xy-know-detail">
                <li v-for="(d, i) in k.detail" :key="i">{{ d }}</li>
              </ul>
              <div class="xy-know-acts">
                <button v-if="k.detail && k.detail.length" class="xy-mini" @click="k._open = !k._open">
                  {{ k._open ? '收起讲解' : '展开详细讲解' }}
                </button>
                <button class="xy-mini ghost" @click="explainKnowledge(k)">AI 帮我讲透</button>
              </div>
              <div v-if="k._explain" class="xy-know-explain">{{ k._explain }}</div>
            </div>
            <p v-if="!filteredKnowledge.length" class="xy-empty">没有匹配的知识，换个关键词试试。</p>
          </div>
        </div>

        <!-- 销量排行 -->
        <div v-else-if="active === 'rank'" class="xy-card">
          <div class="xy-hrow">
            <h3 class="xy-h">每月销量排行榜 / 行业宏观</h3>
            <button class="xy-refresh" @click="loadRank" :disabled="loading.rank">{{ loading.rank ? '生成中…' : '重新生成' }}</button>
          </div>
          <div class="xy-macro">
            <div class="xy-macro-title">
              行业宏观：{{ macro.title || '加载中…' }}
              <span v-if="macro.source" class="xy-macro-src">数据来源：{{ macro.source }}</span>
            </div>
            <div v-if="macro.series.length" class="xy-macro-row">
              <span v-for="p in macro.series.slice(-10)" :key="p.date" class="xy-macro-chip">
                <b>{{ p.date }}</b>
                <template v-if="p.china != null">中 {{ fmt(p.china) }}</template>
                <template v-if="p.usa != null"> · 美 {{ fmt(p.usa) }}</template>
                <template v-if="p.value != null"> {{ fmt(p.value) }}万</template>
              </span>
            </div>
            <p v-else class="xy-macro-empty">宏观数据加载中，若长时间无数据请点右上角「重新生成」。</p>
          </div>
          <p class="xy-note">{{ rank.note }}</p>
          <div v-if="rank.items.length" class="xy-table-wrap">
            <table class="xy-table">
              <thead>
                <tr><th>#</th><th>厂商 / 车型</th><th>销量</th><th>同比</th><th>报道原文（可点击核查）</th></tr>
              </thead>
              <tbody>
                <tr v-for="r in rank.items" :key="r.rank + r.name">
                  <td>{{ r.rank }}</td>
                  <td class="xy-td-name">{{ r.name }}</td>
                  <td class="xy-td-sales">{{ r.sales }}</td>
                  <td :class="r.yoy.includes('-') ? 'down' : (r.yoy === '未披露' ? '' : 'up')">{{ r.yoy }}</td>
                  <td class="xy-td-note">
                    <span>{{ r.note }}</span>
                    <a v-if="r.link" :href="r.link" target="_blank" rel="noopener" class="xy-src-link">
                      查看原文{{ r.source ? '（' + r.source + (r.date ? ' · ' + r.date.slice(5, 16) : '') + '）' : '' }}
                    </a>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <p v-else class="xy-empty">暂无结构化榜单，可查看「汽车热点信息」获取原始销量新闻。</p>
        </div>

        <!-- 汽车类型 -->
        <div v-else-if="active === 'types'" class="xy-card">
          <h3 class="xy-h">汽车类型一览</h3>
          <div class="xy-grid2">
            <div v-for="t in carTypes" :key="t.name" class="xy-know">
              <div class="xy-know-title">{{ t.name }}</div>
              <div class="xy-know-body">{{ t.desc }}</div>
            </div>
          </div>
        </div>

        <!-- 车型库查询（bitefu / 汽车之家免 KEY） -->
        <div v-else-if="active === 'cartype'" class="xy-card">
          <div class="xy-hrow">
            <h3 class="xy-h">车型库查询（汽车之家数据 · 免 KEY）</h3>
            <el-input v-model="carKw" placeholder="搜索品牌，如 比亚迪" class="xy-search" @keyup.enter="loadCarBrands" />
            <button class="xy-refresh" @click="loadCarBrands" :disabled="loadingCartype.brands">查询品牌</button>
          </div>
          <p v-if="!carBrands.length && loadingCartype.brands" class="xy-empty">正在加载品牌…</p>
          <div v-else class="xy-cartype-flow">
            <!-- 品牌 -->
            <div class="xy-ct-step">
              <div class="xy-ct-step-h">① 品牌（{{ carBrands.length }}）</div>
              <div class="xy-ct-list">
                <button v-for="b in carBrands" :key="b.id" :class="['xy-ct-item', carSelBrand === b.id ? 'on' : '']" @click="onSelectBrand(b)">{{ b.name }}</button>
                <p v-if="!carBrands.length" class="xy-empty">未找到品牌，换个关键词试试。</p>
              </div>
            </div>
            <!-- 车系 -->
            <div class="xy-ct-step" v-if="carSelBrand">
              <div class="xy-ct-step-h">② 车系（{{ carSeries.length }}）</div>
              <div class="xy-ct-list">
                <button v-for="s in carSeries" :key="s.id" :class="['xy-ct-item', carSelSeries === s.id ? 'on' : '']" @click="onSelectSeries(s)">{{ s.name }}</button>
                <p v-if="!carSeries.length" class="xy-empty">该品牌暂无车系数据。</p>
              </div>
            </div>
            <!-- 车型 -->
            <div class="xy-ct-step" v-if="carSelSeries">
              <div class="xy-ct-step-h">③ 车型（{{ carModels.length }}）</div>
              <div class="xy-ct-list">
                <button v-for="m in carModels" :key="m.id" :class="['xy-ct-item', carSelModel === m.id ? 'on' : '']" @click="onSelectModel(m)">{{ m.name }}</button>
                <p v-if="!carModels.length" class="xy-empty">该车系暂无车型数据。</p>
              </div>
            </div>
            <!-- 配置详情 -->
            <div class="xy-ct-detail" v-if="carDetail">
              <div class="xy-ct-step-h">④ 配置详情 · {{ carDetail.name || ('车型 ' + carSelModel) }}</div>
              <div class="xy-ct-kv">
                <div v-for="(val, key) in carDetail" :key="key" class="xy-ct-kvrow" v-show="key !== 'name'">
                  <span class="xy-ct-k">{{ key }}</span><span class="xy-ct-v">{{ String(val) }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 终端优惠 -->
        <div v-else-if="active === 'discount'" class="xy-card">
          <div class="xy-hrow">
            <h3 class="xy-h">终端优惠</h3>
            <button class="xy-refresh" @click="loadDiscount" :disabled="loading.discount">{{ loading.discount ? '加载中…' : '刷新' }}</button>
          </div>
          <div v-if="!discountNews.length && loading.discount" class="xy-skeleton"><el-skeleton :rows="6" animated /></div>
          <div v-else class="xy-grid">
            <a v-for="n in discountNews" :key="n.link" :href="n.link" target="_blank" class="xy-news">
              <div class="xy-news-title">{{ n.title }}</div>
              <div class="xy-news-meta"><span>{{ n.source }}</span><span>{{ n.pubDate }}</span></div>
            </a>
            <p v-if="!discountNews.length" class="xy-empty">暂无数据，点击刷新重试。</p>
          </div>
        </div>

        <!-- 新品发布 -->
        <div v-else-if="active === 'newcar'" class="xy-card">
          <div class="xy-hrow">
            <h3 class="xy-h">汽车新品发布</h3>
            <button class="xy-refresh" @click="loadNewCar" :disabled="loading.newcar">{{ loading.newcar ? '加载中…' : '刷新' }}</button>
          </div>
          <div v-if="!newCarNews.length && loading.newcar" class="xy-skeleton"><el-skeleton :rows="6" animated /></div>
          <div v-else class="xy-grid">
            <a v-for="n in newCarNews" :key="n.link" :href="n.link" target="_blank" class="xy-news">
              <div class="xy-news-title">{{ n.title }}</div>
              <div class="xy-news-meta"><span>{{ n.source }}</span><span>{{ n.pubDate }}</span></div>
            </a>
            <p v-if="!newCarNews.length" class="xy-empty">暂无数据，点击刷新重试。</p>
          </div>
        </div>

        <!-- 品牌热点 + 自选车 -->
        <div v-else-if="active === 'brand'" class="xy-card">
          <div class="xy-hrow">
            <h3 class="xy-h">品牌热点信息</h3>
            <div class="xy-brand-sel">
              <button v-for="b in brands" :key="b" :class="['xy-chip', brand === b ? 'on' : '']" @click="brand = b; loadBrand()">{{ b }}</button>
            </div>
            <button class="xy-refresh" @click="loadBrand" :disabled="loading.brand">{{ loading.brand ? '加载中…' : '刷新' }}</button>
          </div>
          <div v-if="!brandNews.length && loading.brand" class="xy-skeleton"><el-skeleton :rows="6" animated /></div>
          <div v-else class="xy-grid">
            <a v-for="n in brandNews" :key="n.link" :href="n.link" target="_blank" class="xy-news">
              <div class="xy-news-title">{{ n.title }}</div>
              <div class="xy-news-meta"><span>{{ n.source }}</span><span>{{ n.pubDate }}</span></div>
            </a>
            <p v-if="!brandNews.length" class="xy-empty">暂无「{{ brand }}」相关新闻。</p>
          </div>

          <h3 class="xy-h" style="margin-top:18px;">我的关注（自选车 / 品牌）</h3>
          <div class="xy-row">
            <el-input v-model="watchName" placeholder="添加关注，如 比亚迪 汉" class="xy-winput" />
            <el-button type="primary" @click="addWatch">加入关注</el-button>
          </div>
          <div class="xy-grid2">
            <div v-for="w in watchlist" :key="w.id" class="xy-know">
              <div class="xy-know-title">{{ w.name }}</div>
              <div class="xy-know-body">{{ w.note || '已关注' }}</div>
              <button class="xy-mini danger" @click="removeWatch(w.id)">取消关注</button>
            </div>
            <p v-if="!watchlist.length" class="xy-empty">还没有关注项，添加后自动存入云端（按账号隔离）。</p>
          </div>
        </div>
      </section>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { Van, ChatDotRound, Bell, Reading, TrendCharts, Discount, Goods, Star } from '@element-plus/icons-vue'
import PageHeader from '../components/PageHeader.vue'
import { loadAiConfig, callAi, type AiConfig } from '../services/aiService'
import {
  fetchCarNews,
  fetchCarMacro,
  fetchSalesRanking,
  fetchCarBrands,
  fetchCarSeries,
  fetchCarModels,
  fetchCarDetail,
  CAR_KNOWLEDGE,
  CAR_TYPES,
  CAR_BRANDS,
  type CarNewsItem,
  type CarMacro,
  type SalesRankItem,
  type BitefuBrand,
  type BitefuSeries,
  type BitefuModel,
  type BitefuDetail
} from '../services/carService'
import { listCarWatch, addCarWatch, removeCarWatch, type CarWatchItem } from '../services/learnDb'

/* 八模块入口 */
const MODULES = [
  { key: 'ai', label: '调用 AI', desc: '选车用车 AI 答疑', color: '#7c3aed', icon: ChatDotRound },
  { key: 'hot', label: '热点信息', desc: '汽车实时热点', color: '#e23b3b', icon: Bell },
  { key: 'knowledge', label: '汽车知识', desc: '小白通识百科', color: '#0ea5e9', icon: Reading },
  { key: 'rank', label: '销量排行', desc: '榜单 + 行业宏观', color: '#1f9d55', icon: TrendCharts },
  { key: 'types', label: '汽车类型', desc: '全品类速览', color: '#7c5cff', icon: Van },
  { key: 'cartype', label: '车型库查询', desc: '品牌/车系/配置', color: '#0891b2', icon: Van },
  { key: 'discount', label: '终端优惠', desc: '降价行情', color: '#e08a00', icon: Discount },
  { key: 'newcar', label: '新品发布', desc: '新车上市', color: '#ec4899', icon: Goods },
  { key: 'brand', label: '品牌热点', desc: '品牌 + 关注', color: '#0ea5e9', icon: Star }
]
const active = ref('hot')

const nowText = ref('')
let clockTimer: number | undefined
function pad(n: number): string { return String(n).padStart(2, '0') }
function updateClock(): void {
  const d = new Date()
  nowText.value = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

const cfg = ref<AiConfig | null>(null)
onMounted(async () => {
  updateClock()
  clockTimer = window.setInterval(updateClock, 1000)
  try { cfg.value = await loadAiConfig() } catch { /* ignore */ }
  loadWatch()
  // 进入默认模块即加载数据
  await loadHot()
})

/* 进入模块时自动加载（数据为空才拉），保证有内容 */
function switchModule(key: string): void {
  active.value = key
  if (key === 'hot' && !hotNews.value.length && !loading.hot) void loadHot()
  if (key === 'discount' && !discountNews.value.length && !loading.discount) void loadDiscount()
  if (key === 'newcar' && !newCarNews.value.length && !loading.newcar) void loadNewCar()
  if (key === 'brand' && !brandNews.value.length && !loading.brand) void loadBrand()
  if (key === 'rank' && !rank.value.items.length && !loading.rank) void loadRank()
  if (key === 'cartype' && !carBrands.value.length && !loadingCartype.brands) void loadCarBrands()
}

function countOf(key: string): string {
  switch (key) {
    case 'ai': return 'AI'
    case 'knowledge': return String(CAR_KNOWLEDGE.length)
    case 'types': return String(CAR_TYPES.length)
    case 'hot': return hotNews.value.length ? String(hotNews.value.length) : (loading.hot ? '…' : '—')
    case 'rank': return rank.value.items.length ? String(rank.value.items.length) : (loading.rank ? '…' : '—')
    case 'discount': return discountNews.value.length ? String(discountNews.value.length) : (loading.discount ? '…' : '—')
    case 'newcar': return newCarNews.value.length ? String(newCarNews.value.length) : (loading.newcar ? '…' : '—')
    case 'brand': return brandNews.value.length ? String(brandNews.value.length) : (loading.brand ? '…' : '—')
    case 'cartype': return carSeries.value.length ? String(carBrands.value.length) + '品牌' : (loadingCartype.brands ? '…' : '—')
  }
  return '—'
}

/* AI 答疑 */
const qaQuestion = ref('结合当前新能源市场，15 万左右推荐哪些车型？增程和插混怎么选？')
const qaLoading = ref(false)
const qaAnswer = ref('')
async function runQa(): Promise<void> {
  if (!cfg.value) { ElMessage.warning('请先到「AI 助手」配置 AI 密钥'); return }
  qaLoading.value = true
  try {
    qaAnswer.value = await callAi(cfg.value, '你是专业汽车顾问，用通俗易懂的中文回答，结论基于公开常识，注明仅供参考、不构成购车建议。\n问题：' + qaQuestion.value)
  } catch (e) { ElMessage.error('AI 调用失败：' + (e as Error).message) }
  finally { qaLoading.value = false }
}

/* 新闻类 */
const loading = reactive({ hot: false, discount: false, newcar: false, brand: false, rank: false })
const hotNews = ref<CarNewsItem[]>([])
const discountNews = ref<CarNewsItem[]>([])
const newCarNews = ref<CarNewsItem[]>([])
const brand = ref('比亚迪')
const brandNews = ref<CarNewsItem[]>([])

async function loadHot(): Promise<void> { loading.hot = true; hotNews.value = await fetchCarNews('汽车 新能源', 20); loading.hot = false }
async function loadDiscount(): Promise<void> { loading.discount = true; discountNews.value = await fetchCarNews('汽车 终端优惠 降价', 20); loading.discount = false }
async function loadNewCar(): Promise<void> { loading.newcar = true; newCarNews.value = await fetchCarNews('新车 上市 发布', 20); loading.newcar = false }
async function loadBrand(): Promise<void> { loading.brand = true; brandNews.value = await fetchCarNews(brand.value + ' 汽车', 20); loading.brand = false }

/* 知识（支持分类筛选 + 关键词搜索 + 展开详细讲解） */
const kSearch = ref('')
const kCat = ref('全部')
const carKnowledge = ref(CAR_KNOWLEDGE.map((k) => ({ ...k, _explain: '', _open: false })))
const knowledgeCats = ['全部', ...Array.from(new Set(CAR_KNOWLEDGE.map((k) => k.cat)))]
const filteredKnowledge = computed(() => {
  const kw = kSearch.value.trim().toLowerCase()
  return carKnowledge.value.filter((k) => {
    if (kCat.value !== '全部' && k.cat !== kCat.value) return false
    if (!kw) return true
    const hay = (k.title + k.content + (k.detail ?? []).join('')).toLowerCase()
    return hay.includes(kw)
  })
})
async function explainKnowledge(k: { title: string; _explain: string }): Promise<void> {
  if (!cfg.value) { ElMessage.warning('请先配置 AI 密钥'); return }
  k._explain = 'AI 解读中…'
  try {
    k._explain = await callAi(cfg.value, `用通俗中文、面向新手，把「${k.title}」讲透：定义 + 为什么重要 + 一个例子，200 字内。`)
  } catch (e) { k._explain = '解读失败：' + (e as Error).message }
}
const carTypes = CAR_TYPES
const brands = CAR_BRANDS

/* 车型库查询（bitefu / 汽车之家免 KEY） */
const loadingCartype = reactive({ brands: false, series: false, models: false, detail: false })
const carKw = ref('')
const carBrands = ref<BitefuBrand[]>([])
const carSeries = ref<BitefuSeries[]>([])
const carModels = ref<BitefuModel[]>([])
const carDetail = ref<BitefuDetail | null>(null)
const carSelBrand = ref<number | null>(null)
const carSelSeries = ref<number | null>(null)
const carSelModel = ref<number | null>(null)

async function loadCarBrands(): Promise<void> {
  loadingCartype.brands = true
  carSelBrand.value = null; carSelSeries.value = null; carSelModel.value = null; carSeries.value = []; carModels.value = []; carDetail.value = null
  carBrands.value = await fetchCarBrands(carKw.value.trim())
  loadingCartype.brands = false
}
async function onSelectBrand(b: BitefuBrand): Promise<void> {
  carSelBrand.value = b.id
  loadingCartype.series = true
  carSelSeries.value = null; carSelModel.value = null; carModels.value = []; carDetail.value = null
  carSeries.value = await fetchCarSeries(b.id)
  loadingCartype.series = false
}
async function onSelectSeries(s: BitefuSeries): Promise<void> {
  carSelSeries.value = s.id
  loadingCartype.models = true
  carSelModel.value = null; carDetail.value = null
  carModels.value = await fetchCarModels(s.id)
  loadingCartype.models = false
}
async function onSelectModel(m: BitefuModel): Promise<void> {
  carSelModel.value = m.id
  loadingCartype.detail = true
  carDetail.value = await fetchCarDetail(m.id)
  loadingCartype.detail = false
}

/* 销量排行 + 宏观 */
const macro = ref<CarMacro>({ source: '', title: '', series: [] })
const rank = ref<{ items: SalesRankItem[]; note: string }>({ items: [], note: '' })
async function loadRank(): Promise<void> {
  loading.rank = true
  const [m, r] = await Promise.all([fetchCarMacro(), fetchSalesRanking(cfg.value)])
  macro.value = m
  rank.value = r
  loading.rank = false
}

/* 自选车 / 关注 */
const watchName = ref('')
const watchlist = ref<CarWatchItem[]>([])
async function loadWatch(): Promise<void> { watchlist.value = await listCarWatch() }
async function addWatch(): Promise<void> {
  const name = watchName.value.trim()
  if (!name) return
  await addCarWatch(name)
  watchName.value = ''
  await loadWatch()
}
async function removeWatch(id: string): Promise<void> { await removeCarWatch(id); await loadWatch() }

function fmt(n: number): string { return n >= 10000 ? (n / 10000).toFixed(1) + '万' : String(n) }

onUnmounted(() => { if (clockTimer) window.clearInterval(clockTimer) })
</script>

<style scoped>
.xy-root { min-height: 100%; }
.xy-clock-box { display: inline-flex; align-items: center; gap: 6px; }
.xy-dot { width: 8px; height: 8px; border-radius: 50%; background: #22c55e; box-shadow: 0 0 0 3px rgba(34,197,94,.2); animation: xyBlink 2s ease-in-out infinite; }
@keyframes xyBlink { 0%,100% { opacity: 1; } 50% { opacity: .45; } }
.xy-clock { font-variant-numeric: tabular-nums; font-size: 13px; color: var(--text-strong); }
.xy-clock-hint { font-size: 11px; color: var(--text-faint); }

/* 八模块入口卡片（复用 AI 知识模型的视觉语言） */
.xy-entries {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
  margin-bottom: 18px;
}
.xy-entry {
  position: relative;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 14px 12px 16px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 14px;
  box-shadow: var(--shadow-card);
  cursor: pointer;
  text-align: left;
  min-width: 0;
  overflow: hidden;
  transition: transform .18s ease, border-color .18s ease, box-shadow .18s ease, background .18s ease;
}
.xy-entry:hover { transform: translateY(-2px); border-color: var(--c); }
.xy-entry.on { border-color: var(--c); background: color-mix(in srgb, var(--c) 7%, var(--surface)); }
.xe-bar { position: absolute; left: 0; top: 0; bottom: 0; width: 3px; background: var(--c); opacity: 0; transition: opacity .18s ease; }
.xy-entry.on .xe-bar { opacity: 1; }
.xe-icon {
  width: 34px; height: 34px; border-radius: 10px; display: grid; place-items: center;
  flex-shrink: 0; background: color-mix(in srgb, var(--c) 12%, transparent); color: var(--c);
}
.xe-icon :deep(svg) { font-size: 17px; }
.xe-text { display: flex; flex-direction: column; min-width: 0; flex: 1; line-height: 1.3; }
.xe-label { font-size: 13.5px; font-weight: 600; color: var(--text-strong); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.xe-desc { font-size: 11px; color: var(--text-faint); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.xe-count {
  flex-shrink: 0; min-width: 26px; height: 20px; padding: 0 6px; border-radius: 999px;
  display: grid; place-items: center; font-size: 11px; font-weight: 700;
  font-variant-numeric: tabular-nums; color: var(--c); background: color-mix(in srgb, var(--c) 12%, transparent);
}

.xy-body { min-height: 320px; }
.xy-card { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 18px; box-shadow: var(--shadow-card); }
.xy-h { font-size: 15px; color: var(--text-strong); margin: 0 0 6px; }
.xy-sub { font-size: 12px; color: var(--text-faint); margin: 0 0 12px; }
.xy-hrow { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; margin-bottom: 12px; }
.xy-search { width: 200px; }
.xy-row { display: flex; align-items: center; gap: 10px; margin-top: 10px; flex-wrap: wrap; }
.xy-warn { font-size: 12px; color: #f59e0b; }
.xy-answer { margin-top: 12px; padding: 12px; background: var(--surface-soft); border-radius: 8px; white-space: pre-wrap; line-height: 1.7; font-size: 13px; color: var(--text); }
.xy-refresh { border: 1px solid var(--border); background: var(--surface); color: var(--text-muted); border-radius: 8px; padding: 5px 12px; cursor: pointer; font-size: 12px; }
.xy-refresh:hover { color: var(--brand, #378add); border-color: var(--brand, #378add); }
.xy-skeleton { padding: 4px 0; }
.xy-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 12px; }
.xy-grid2 { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 12px; }
.xy-news { display: block; padding: 12px; border: 1px solid var(--border); border-radius: 10px; text-decoration: none; color: inherit; background: var(--surface-soft); transition: .15s; }
.xy-news:hover { border-color: var(--brand, #378add); transform: translateY(-2px); }
.xy-news-title { font-size: 13px; color: var(--text-strong); line-height: 1.5; margin-bottom: 8px; }
.xy-news-meta { display: flex; justify-content: space-between; font-size: 11px; color: var(--text-faint); }
.xy-know { padding: 12px; border: 1px solid var(--border); border-radius: 10px; background: var(--surface-soft); }
.xy-know-cat {
  display: inline-block; font-size: 11px; color: #0891b2; background: rgba(8,145,178,.1);
  border-radius: 5px; padding: 1px 7px; margin-bottom: 6px;
}
.xy-know-title { font-size: 13px; font-weight: 600; color: var(--text-strong); margin-bottom: 6px; }
.xy-know-body { font-size: 12px; color: var(--text-muted); line-height: 1.6; }
.xy-know-detail {
  margin: 8px 0 0; padding: 8px 0 0 18px; border-top: 1px dashed var(--border);
  font-size: 12px; color: var(--text); line-height: 1.75;
}
.xy-know-detail li { margin-bottom: 4px; }
.xy-know-acts { display: flex; flex-wrap: wrap; gap: 8px; }
.xy-know-explain { margin-top: 8px; padding-top: 8px; border-top: 1px dashed var(--border); font-size: 12px; color: var(--text); white-space: pre-wrap; line-height: 1.6; }
.xy-kcats { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 12px; }
.xy-mini { margin-top: 8px; border: 1px solid var(--border); background: var(--surface); color: var(--brand, #378add); border-radius: 6px; padding: 3px 10px; font-size: 12px; cursor: pointer; }
.xy-mini:hover { border-color: var(--brand, #378add); }
.xy-mini.ghost { color: var(--text-faint); }
.xy-mini.ghost:hover { color: var(--brand, #378add); }
.xy-mini.danger { color: #ef4444; }
.xy-empty { grid-column: 1 / -1; color: var(--text-faint); font-size: 13px; padding: 18px; text-align: center; }
.xy-macro { background: var(--surface-soft); border-radius: 10px; padding: 12px; margin-bottom: 12px; }
.xy-macro-title { font-size: 13px; color: var(--text-strong); margin-bottom: 8px; display: flex; flex-wrap: wrap; align-items: baseline; gap: 8px; }
.xy-macro-src { font-size: 11px; color: var(--text-faint); font-weight: 400; }
.xy-macro-row { display: flex; flex-wrap: wrap; gap: 6px; }
.xy-macro-chip { font-size: 12px; color: var(--text-muted); background: var(--surface); border: 1px solid var(--border); border-radius: 6px; padding: 3px 8px; font-variant-numeric: tabular-nums; }
.xy-macro-chip b { color: var(--text-strong); font-weight: 600; margin-right: 4px; }
.xy-macro-empty { font-size: 12px; color: var(--text-faint); margin: 0; }
.xy-table-wrap { width: 100%; overflow-x: auto; -webkit-overflow-scrolling: touch; }
.xy-table { width: 100%; min-width: 620px; border-collapse: collapse; font-size: 13px; margin-top: 6px; }
.xy-table th, .xy-table td { border: 1px solid var(--border); padding: 8px 10px; text-align: left; vertical-align: top; }
.xy-table th { background: var(--surface-soft); color: var(--text-muted); font-weight: 600; white-space: nowrap; }
.xy-td-name { font-weight: 600; color: var(--text-strong); white-space: nowrap; }
.xy-td-sales { font-variant-numeric: tabular-nums; white-space: nowrap; }
.xy-td-note { color: var(--text-faint); font-size: 12px; line-height: 1.6; }
.xy-src-link {
  display: inline-block; margin-top: 4px; font-size: 11.5px; color: var(--brand, #378add);
  text-decoration: none; border-bottom: 1px dashed currentColor;
}
.xy-src-link:hover { opacity: .8; }
.xy-note { font-size: 12px; color: var(--text-faint); margin: 6px 0; }
.up { color: #ef4444; }
.down { color: #16a34a; }
.xy-brand-sel { display: flex; flex-wrap: wrap; gap: 6px; flex: 1; }
.xy-chip { border: 1px solid var(--border); background: var(--surface); color: var(--text-muted); border-radius: 16px; padding: 3px 12px; font-size: 12px; cursor: pointer; }
.xy-chip.on { color: #fff; background: var(--brand, #378add); border-color: var(--brand, #378add); }
.xy-winput { width: 240px; }

/* 车型库查询 */
.xy-cartype-flow { display: grid; grid-template-columns: repeat(auto-fit, minmax(230px, 1fr)); gap: 14px; }
.xy-ct-step { background: var(--surface-soft); border: 1px solid var(--border); border-radius: 10px; padding: 12px; }
.xy-ct-step-h { font-size: 13px; font-weight: 600; color: var(--text-strong); margin-bottom: 10px; }
.xy-ct-list { display: flex; flex-wrap: wrap; gap: 8px; }
.xy-ct-item {
  border: 1px solid var(--border); background: var(--surface); color: var(--text-muted);
  border-radius: 8px; padding: 6px 12px; font-size: 12.5px; cursor: pointer; transition: .15s;
}
.xy-ct-item:hover { border-color: var(--brand, #378add); color: var(--brand, #378add); }
.xy-ct-item.on { color: #fff; background: #0891b2; border-color: #0891b2; }
.xy-ct-detail { grid-column: 1 / -1; background: var(--surface-soft); border: 1px solid var(--border); border-radius: 10px; padding: 14px; }
.xy-ct-kv { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 8px 18px; }
.xy-ct-kvrow { display: flex; gap: 8px; font-size: 13px; border-bottom: 1px dashed var(--border); padding-bottom: 6px; }
.xy-ct-k { color: var(--text-faint); flex-shrink: 0; min-width: 70px; }
.xy-ct-v { color: var(--text-strong); font-weight: 600; }

.xy-fade-enter-active, .xy-fade-leave-active { transition: opacity .18s ease, transform .18s ease; }
.xy-fade-enter-from { opacity: 0; transform: translateY(6px); }
.xy-fade-leave-to { opacity: 0; transform: translateY(-6px); }

/* 响应式 */
@media (max-width: 1100px) {
  .xy-entries { grid-template-columns: repeat(3, minmax(0, 1fr)); }
}
@media (max-width: 760px) {
  .xy-entries { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
  .xy-entry { padding: 10px 10px 10px 13px; gap: 8px; }
  .xe-icon { width: 30px; height: 30px; border-radius: 9px; }
  .xe-label { font-size: 12.5px; }
  .xe-desc { display: none; }
}
@media (max-width: 460px) {
  .xy-entries { grid-template-columns: 1fr; }
}
</style>
