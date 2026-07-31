<template>
  <div class="xy-root">
    <header class="xy-top">
      <div class="xy-brand">
        <span class="xy-logo">星舆识途</span>
        <span class="xy-tag">汽车资讯 · 知识 · AI 答疑（全部免费）</span>
      </div>
      <div class="xy-tabs">
        <span v-for="t in tabs" :key="t.key" :class="['xy-tab', active === t.key ? 'on' : '']" @click="active = t.key">{{ t.label }}</span>
      </div>
      <div class="xy-clock-box" title="北京时间">
        <span class="xy-dot"></span>
        <span class="xy-clock">{{ nowText }}</span>
        <span class="xy-clock-hint">北京时间</span>
      </div>
    </header>

    <main class="xy-main">
      <!-- AI 答疑 -->
      <section v-if="active === 'ai'" class="xy-card">
        <h3 class="xy-h">AI 汽车答疑</h3>
        <p class="xy-sub">基于你已配置的 AI（AI 助手）回答选车、用车、技术、政策等问题，仅供参考。</p>
        <el-input v-model="qaQuestion" type="textarea" :rows="3" placeholder="例如：15 万预算买新能源轿车，有哪些推荐？增程和插混怎么选？" />
        <div class="xy-row">
          <el-button type="primary" :loading="qaLoading" @click="runQa">向 AI 提问</el-button>
          <span v-if="!cfg" class="xy-warn">未检测到 AI 配置，请先到「AI 助手」配置密钥。</span>
        </div>
        <div v-if="qaAnswer" class="xy-answer">{{ qaAnswer }}</div>
      </section>

      <!-- 热点信息 -->
      <section v-else-if="active === 'hot'" class="xy-card">
        <div class="xy-hrow">
          <h3 class="xy-h">汽车热点信息</h3>
          <button class="xy-refresh" @click="loadHot" :disabled="loading.hot">{{ loading.hot ? '加载中…' : '刷新' }}</button>
        </div>
        <div class="xy-grid">
          <a v-for="n in hotNews" :key="n.link" :href="n.link" target="_blank" class="xy-news">
            <div class="xy-news-title">{{ n.title }}</div>
            <div class="xy-news-meta"><span>{{ n.source }}</span><span>{{ n.pubDate }}</span></div>
          </a>
          <p v-if="!hotNews.length && !loading.hot" class="xy-empty">暂无数据，点击刷新重试。</p>
        </div>
      </section>

      <!-- 汽车知识 -->
      <section v-else-if="active === 'knowledge'" class="xy-card">
        <div class="xy-hrow">
          <h3 class="xy-h">汽车知识（小白可读）</h3>
          <el-input v-model="kSearch" placeholder="搜索关键词" class="xy-search" />
        </div>
        <div class="xy-grid2">
          <div v-for="k in filteredKnowledge" :key="k.title" class="xy-know">
            <div class="xy-know-title">{{ k.title }}</div>
            <div class="xy-know-body">{{ k.content }}</div>
            <button class="xy-mini" @click="explainKnowledge(k)">AI 帮我讲透</button>
            <div v-if="k._explain" class="xy-know-explain">{{ k._explain }}</div>
          </div>
          <p v-if="!filteredKnowledge.length" class="xy-empty">没有匹配的知识，换个关键词试试。</p>
        </div>
      </section>

      <!-- 销量排行 -->
      <section v-else-if="active === 'rank'" class="xy-card">
        <div class="xy-hrow">
          <h3 class="xy-h">每月销量排行榜 / 行业宏观</h3>
          <button class="xy-refresh" @click="loadRank" :disabled="loading.rank">{{ loading.rank ? '生成中…' : '重新生成' }}</button>
        </div>
        <div class="xy-macro">
          <div class="xy-macro-title">行业宏观（{{ macro.source }}）：{{ macro.title }}</div>
          <div v-if="macro.series.length" class="xy-macro-row">
            <span v-for="p in macro.series.slice(-8)" :key="p.date" class="xy-macro-chip">
              {{ p.date }}：{{ p.china != null ? '中 ' + fmt(p.china) : '' }}{{ p.usa != null ? ' / 美 ' + fmt(p.usa) : '' }}{{ p.value != null ? fmt(p.value) : '' }}
            </span>
          </div>
          <p v-else class="xy-empty">宏观数据暂不可用（接口被网络限制）。</p>
        </div>
        <p class="xy-note">{{ rank.note }}</p>
        <table v-if="rank.items.length" class="xy-table">
          <thead><tr><th>排名</th><th>厂商 / 车型</th><th>销量</th><th>同比</th><th>依据</th></tr></thead>
          <tbody>
            <tr v-for="r in rank.items" :key="r.rank">
              <td>{{ r.rank }}</td><td>{{ r.name }}</td><td>{{ r.sales }}</td><td :class="r.yoy.includes('-') ? 'down' : 'up'">{{ r.yoy }}</td><td class="xy-td-note">{{ r.note }}</td>
            </tr>
          </tbody>
        </table>
        <p v-else class="xy-empty">暂无结构化榜单，可查看「汽车热点信息」获取原始销量新闻。</p>
      </section>

      <!-- 汽车类型 -->
      <section v-else-if="active === 'types'" class="xy-card">
        <h3 class="xy-h">汽车类型一览</h3>
        <div class="xy-grid2">
          <div v-for="t in carTypes" :key="t.name" class="xy-know">
            <div class="xy-know-title">{{ t.name }}</div>
            <div class="xy-know-body">{{ t.desc }}</div>
          </div>
        </div>
      </section>

      <!-- 终端优惠 -->
      <section v-else-if="active === 'discount'" class="xy-card">
        <div class="xy-hrow">
          <h3 class="xy-h">终端优惠</h3>
          <button class="xy-refresh" @click="loadDiscount" :disabled="loading.discount">{{ loading.discount ? '加载中…' : '刷新' }}</button>
        </div>
        <div class="xy-grid">
          <a v-for="n in discountNews" :key="n.link" :href="n.link" target="_blank" class="xy-news">
            <div class="xy-news-title">{{ n.title }}</div>
            <div class="xy-news-meta"><span>{{ n.source }}</span><span>{{ n.pubDate }}</span></div>
          </a>
          <p v-if="!discountNews.length && !loading.discount" class="xy-empty">暂无数据，点击刷新重试。</p>
        </div>
      </section>

      <!-- 新品发布 -->
      <section v-else-if="active === 'newcar'" class="xy-card">
        <div class="xy-hrow">
          <h3 class="xy-h">汽车新品发布</h3>
          <button class="xy-refresh" @click="loadNewCar" :disabled="loading.newcar">{{ loading.newcar ? '加载中…' : '刷新' }}</button>
        </div>
        <div class="xy-grid">
          <a v-for="n in newCarNews" :key="n.link" :href="n.link" target="_blank" class="xy-news">
            <div class="xy-news-title">{{ n.title }}</div>
            <div class="xy-news-meta"><span>{{ n.source }}</span><span>{{ n.pubDate }}</span></div>
          </a>
          <p v-if="!newCarNews.length && !loading.newcar" class="xy-empty">暂无数据，点击刷新重试。</p>
        </div>
      </section>

      <!-- 品牌热点 + 自选车 -->
      <section v-else-if="active === 'brand'" class="xy-card">
        <div class="xy-hrow">
          <h3 class="xy-h">品牌热点信息</h3>
          <div class="xy-brand-sel">
            <button v-for="b in brands" :key="b" :class="['xy-chip', brand === b ? 'on' : '']" @click="brand = b; loadBrand()">{{ b }}</button>
          </div>
          <button class="xy-refresh" @click="loadBrand" :disabled="loading.brand">{{ loading.brand ? '加载中…' : '刷新' }}</button>
        </div>
        <div class="xy-grid">
          <a v-for="n in brandNews" :key="n.link" :href="n.link" target="_blank" class="xy-news">
            <div class="xy-news-title">{{ n.title }}</div>
            <div class="xy-news-meta"><span>{{ n.source }}</span><span>{{ n.pubDate }}</span></div>
          </a>
          <p v-if="!brandNews.length && !loading.brand" class="xy-empty">暂无「{{ brand }}」相关新闻。</p>
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
      </section>
    </main>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { loadAiConfig, callAi, type AiConfig } from '../services/aiService'
import {
  fetchCarNews,
  fetchCarMacro,
  fetchSalesRanking,
  CAR_KNOWLEDGE,
  CAR_TYPES,
  CAR_BRANDS,
  type CarNewsItem,
  type CarMacro,
  type SalesRankItem
} from '../services/carService'
import { listCarWatch, addCarWatch, removeCarWatch, type CarWatchItem } from '../services/learnDb'

const tabs = [
  { key: 'ai', label: 'AI 答疑' },
  { key: 'hot', label: '热点信息' },
  { key: 'knowledge', label: '汽车知识' },
  { key: 'rank', label: '销量排行' },
  { key: 'types', label: '汽车类型' },
  { key: 'discount', label: '终端优惠' },
  { key: 'newcar', label: '新品发布' },
  { key: 'brand', label: '品牌热点' }
]
const active = ref('ai')

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
})

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

/* 知识 */
const kSearch = ref('')
const carKnowledge = ref(CAR_KNOWLEDGE.map((k) => ({ ...k, _explain: '' })))
const filteredKnowledge = ref(carKnowledge.value)
function searchKnowledge(): void {
  const kw = kSearch.value.trim().toLowerCase()
  filteredKnowledge.value = kw ? carKnowledge.value.filter((k) => (k.title + k.content).toLowerCase().includes(kw)) : carKnowledge.value
}
async function explainKnowledge(k: { title: string; _explain: string }): Promise<void> {
  if (!cfg.value) { ElMessage.warning('请先配置 AI 密钥'); return }
  k._explain = 'AI 解读中…'
  try {
    k._explain = await callAi(cfg.value, `用通俗中文、面向新手，把「${k.title}」讲透：定义 + 为什么重要 + 一个例子，200 字内。`)
  } catch (e) { k._explain = '解读失败：' + (e as Error).message }
}
const carTypes = CAR_TYPES
const brands = CAR_BRANDS

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

// 知识搜索：监听输入
import { watch } from 'vue'
watch(kSearch, searchKnowledge)

onUnmounted(() => { if (clockTimer) window.clearInterval(clockTimer) })
</script>

<style scoped>
.xy-root { min-height: 100%; }
.xy-top { position: sticky; top: 0; z-index: 10; display: flex; align-items: center; gap: 16px; padding: 10px 24px; background: var(--surface); border-bottom: 1px solid var(--border); flex-wrap: wrap; }
.xy-brand { display: flex; align-items: baseline; gap: 8px; }
.xy-logo { font-size: 16px; font-weight: 700; color: var(--text-strong); }
.xy-tag { font-size: 11px; color: var(--text-faint); }
.xy-tabs { display: flex; gap: 4px; flex: 1; flex-wrap: wrap; }
.xy-tab { font-size: 13px; padding: 6px 12px; border-radius: 8px; color: var(--text-muted); cursor: pointer; border: 1px solid transparent; }
.xy-tab:hover { background: var(--surface-soft); }
.xy-tab.on { color: var(--brand, #378add); background: var(--surface-soft); border-color: var(--brand, #378add); font-weight: 600; }
.xy-clock-box { display: inline-flex; align-items: center; gap: 6px; }
.xy-dot { width: 8px; height: 8px; border-radius: 50%; background: #22c55e; box-shadow: 0 0 0 3px rgba(34,197,94,.2); }
.xy-clock { font-variant-numeric: tabular-nums; font-size: 13px; color: var(--text-strong); }
.xy-clock-hint { font-size: 11px; color: var(--text-faint); }
.xy-main { padding: 18px 24px; }
.xy-card { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 18px; }
.xy-h { font-size: 15px; color: var(--text-strong); margin: 0 0 6px; }
.xy-sub { font-size: 12px; color: var(--text-faint); margin: 0 0 12px; }
.xy-hrow { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; margin-bottom: 12px; }
.xy-search { width: 200px; }
.xy-row { display: flex; align-items: center; gap: 10px; margin-top: 10px; flex-wrap: wrap; }
.xy-warn { font-size: 12px; color: #f59e0b; }
.xy-answer { margin-top: 12px; padding: 12px; background: var(--surface-soft); border-radius: 8px; white-space: pre-wrap; line-height: 1.7; font-size: 13px; color: var(--text); }
.xy-refresh { border: 1px solid var(--border); background: var(--surface); color: var(--text-muted); border-radius: 8px; padding: 5px 12px; cursor: pointer; font-size: 12px; }
.xy-refresh:hover { color: var(--brand, #378add); border-color: var(--brand, #378add); }
.xy-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 12px; }
.xy-grid2 { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 12px; }
.xy-news { display: block; padding: 12px; border: 1px solid var(--border); border-radius: 10px; text-decoration: none; color: inherit; background: var(--surface-soft); transition: .15s; }
.xy-news:hover { border-color: var(--brand, #378add); transform: translateY(-2px); }
.xy-news-title { font-size: 13px; color: var(--text-strong); line-height: 1.5; margin-bottom: 8px; }
.xy-news-meta { display: flex; justify-content: space-between; font-size: 11px; color: var(--text-faint); }
.xy-know { padding: 12px; border: 1px solid var(--border); border-radius: 10px; background: var(--surface-soft); }
.xy-know-title { font-size: 13px; font-weight: 600; color: var(--text-strong); margin-bottom: 6px; }
.xy-know-body { font-size: 12px; color: var(--text-muted); line-height: 1.6; }
.xy-know-explain { margin-top: 8px; padding-top: 8px; border-top: 1px dashed var(--border); font-size: 12px; color: var(--text); white-space: pre-wrap; line-height: 1.6; }
.xy-mini { margin-top: 8px; border: 1px solid var(--border); background: var(--surface); color: var(--brand, #378add); border-radius: 6px; padding: 3px 10px; font-size: 12px; cursor: pointer; }
.xy-mini.danger { color: #ef4444; }
.xy-empty { grid-column: 1 / -1; color: var(--text-faint); font-size: 13px; padding: 18px; text-align: center; }
.xy-macro { background: var(--surface-soft); border-radius: 10px; padding: 12px; margin-bottom: 12px; }
.xy-macro-title { font-size: 13px; color: var(--text-strong); margin-bottom: 8px; }
.xy-macro-row { display: flex; flex-wrap: wrap; gap: 6px; }
.xy-macro-chip { font-size: 12px; color: var(--text-muted); background: var(--surface); border: 1px solid var(--border); border-radius: 6px; padding: 3px 8px; }
.xy-table { width: 100%; border-collapse: collapse; font-size: 13px; margin-top: 6px; }
.xy-table th, .xy-table td { border: 1px solid var(--border); padding: 8px 10px; text-align: left; }
.xy-table th { background: var(--surface-soft); color: var(--text-muted); font-weight: 600; }
.xy-td-note { color: var(--text-faint); font-size: 12px; }
.xy-note { font-size: 12px; color: var(--text-faint); margin: 6px 0; }
.up { color: #ef4444; }
.down { color: #16a34a; }
.xy-brand-sel { display: flex; flex-wrap: wrap; gap: 6px; flex: 1; }
.xy-chip { border: 1px solid var(--border); background: var(--surface); color: var(--text-muted); border-radius: 16px; padding: 3px 12px; font-size: 12px; cursor: pointer; }
.xy-chip.on { color: #fff; background: var(--brand, #378add); border-color: var(--brand, #378add); }
.xy-winput { width: 240px; }
</style>
