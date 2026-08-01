<template>
  <div class="am-root">
    <PageHeader
      title="AI 模型知识"
      subtitle="前沿模型 · 免费调用渠道 · 行业热点 · 自主学习与追踪"
      :icon="MagicStick"
    >
      <div class="am-clock-box" title="北京时间">
        <span class="am-dot"></span>
        <span class="am-clock">{{ nowText }}</span>
        <span class="am-clock-hint">北京时间</span>
      </div>
    </PageHeader>

    <!-- ===== 五模块入口 ===== -->
    <nav class="am-entries">
      <button
        v-for="m in MODULES"
        :key="m.key"
        type="button"
        class="am-entry"
        :class="{ on: active === m.key }"
        :style="{ '--c': m.color }"
        @click="switchModule(m.key)"
      >
        <span class="ae-bar"></span>
        <span class="ae-icon"><el-icon><component :is="m.icon" /></el-icon></span>
        <span class="ae-text">
          <span class="ae-label">{{ m.label }}</span>
          <span class="ae-desc">{{ m.desc }}</span>
        </span>
        <span class="ae-count">{{ countOf(m.key) }}</span>
      </button>
    </nav>

    <Transition name="am-fade" mode="out-in">
      <section :key="active" class="am-body">
        <!-- ==================== 模型模块 ==================== -->
        <template v-if="isModelModule">
          <!-- 实时趋势 -->
          <div class="am-card mk-trend-card">
            <div class="mkt-head">
              <h3><el-icon><TrendCharts /></el-icon> Hugging Face 实时趋势</h3>
              <div class="mkt-meta">
                <span class="mkt-free">免费公共 API</span>
                <span v-if="trendModels.length" class="mkt-time">更新于 {{ trendUpdatedAt(trendModels[0]) || '刚刚' }}</span>
              </div>
            </div>
            <div class="mkt-list">
              <a
                v-for="t in trendModels"
                :key="t.id"
                class="mkt-item"
                :href="`https://huggingface.co/${t.id}`"
                target="_blank"
                rel="noopener"
                :title="t.id"
              >
                <b>{{ t.id }}</b>
                <span>{{ t.pipelineTag }} · ♥ {{ fmtTrendNum(t.likes) }} · 下载 {{ fmtTrendNum(t.downloads) }}</span>
                <i>{{ trendUpdatedAt(t) || '刚刚' }}</i>
              </a>
              <div v-if="trendLoading && !trendModels.length" class="mkt-loading">正在从 Hugging Face 免费 API 加载实时趋势…</div>
              <div v-if="!trendLoading && trendError && !trendModels.length" class="mkt-empty">实时趋势暂时无法加载，知识库内容仍可使用。</div>
            </div>
          </div>

          <div class="am-card">
            <div class="mk-toolbar">
              <el-input v-model="modelSearch" placeholder="搜索模型 / 机构" :prefix-icon="Search" clearable class="tb-search" />
              <el-select v-model="useFilter" placeholder="主要用途" clearable class="tb-sel">
                <el-option v-for="u in useOptions" :key="u" :label="u" :value="u" />
              </el-select>
              <el-select v-model="licFilter" placeholder="开源许可" clearable class="tb-sel">
                <el-option v-for="l in licOptions" :key="l" :label="l" :value="l" />
              </el-select>
              <span class="tb-count">共 <b>{{ filteredModels.length }}</b> 项 · 点击任意行查看详情</span>
            </div>

            <!-- PC 表格 -->
            <div class="mk-table-wrap">
              <table class="mk-table">
                <thead>
                  <tr>
                    <th style="width: 19%">模型</th>
                    <th style="width: 14%">机构</th>
                    <th style="width: 13%">规模</th>
                    <th style="width: 17%">主要用途</th>
                    <th style="width: 23%">免费调用渠道</th>
                    <th style="width: 14%">许可证</th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="m in filteredModels"
                    :key="m.id"
                    :class="{ on: selModel && selModel.id === m.id }"
                    @click="selectModel(m)"
                  >
                    <td class="td-name">
                      <span class="mk-dot"></span>{{ m.name }}
                    </td>
                    <td>{{ m.org }}</td>
                    <td class="td-mono">{{ m.scale }}</td>
                    <td>
                      <span v-for="u in m.uses.slice(0, 3)" :key="u" class="mk-chip">{{ u }}</span>
                    </td>
                    <td class="td-free">
                      <span v-for="f in m.freeChannels.slice(0, 2)" :key="f" class="mk-chip free">{{ f }}</span>
                      <span v-if="m.freeChannels.length > 2" class="mk-more">+{{ m.freeChannels.length - 2 }}</span>
                    </td>
                    <td><span class="mk-lic">{{ m.license }}</span></td>
                  </tr>
                  <tr v-if="!filteredModels.length">
                    <td colspan="6" class="mk-empty">没有匹配的模型，试试换个关键词。</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <!-- 移动端卡片 -->
            <div class="mk-cards">
              <article
                v-for="m in filteredModels"
                :key="m.id"
                class="mk-card"
                :class="{ on: selModel && selModel.id === m.id }"
                @click="selectModel(m)"
              >
                <h4>{{ m.name }}</h4>
                <div class="mkc-row"><span>机构</span><b>{{ m.org }}</b></div>
                <div class="mkc-row"><span>规模</span><b>{{ m.scale }}</b></div>
                <div class="mkc-row"><span>许可</span><b>{{ m.license }}</b></div>
                <div class="mkc-tags">
                  <span v-for="u in m.uses" :key="u" class="mk-chip">{{ u }}</span>
                </div>
                <div class="mkc-tags">
                  <span v-for="f in m.freeChannels.slice(0, 2)" :key="f" class="mk-chip free">{{ f }}</span>
                </div>
              </article>
              <p v-if="!filteredModels.length" class="mk-empty">没有匹配的模型。</p>
            </div>
          </div>

          <!-- 联动双栏 -->
          <div v-if="selModel" class="mk-duo">
            <div class="am-card duo-card">
              <div class="duo-head">
                <h3><el-icon><MagicStick /></el-icon> AI 模型分析</h3>
                <span class="duo-cur">当前：{{ selModel.name }}</span>
              </div>
              <div class="duo-source">
                <span class="ds-label">AI 来源</span>
                <span class="ds-value">{{ aiSourceText }}</span>
                <span v-if="aiSourceFree" class="ds-free">免费调用 · 无需 Token</span>
                <span v-else class="ds-paid">{{ cfg ? '使用你配置的 AI Key' : '需先配置 AI 密钥' }}</span>
              </div>
              <p class="duo-intro">{{ selModel.intro }}</p>
              <ul class="duo-points">
                <li v-for="(p, i) in selModel.points" :key="i"><i>{{ i + 1 }}</i><span>{{ p }}</span></li>
              </ul>
              <div class="duo-ask">
                <el-input
                  v-model="askQ"
                  type="textarea"
                  :rows="2"
                  :placeholder="`继续追问「${selModel.name}」，例如：它和同尺寸模型比强在哪？怎么本地部署？`"
                />
                <div class="duo-ask-row">
                  <el-button type="primary" size="small" :loading="askLoading" @click="runAsk">
                    <el-icon><Promotion /></el-icon> 让 AI 深入讲解
                  </el-button>
                  <span v-if="!cfg" class="duo-warn">未检测到 AI 配置，请先到「AI 助手」填写免费密钥。</span>
                </div>
                <div v-if="askLoading" class="duo-asking">
                  <span class="duo-spin"><el-icon><Loading /></el-icon></span>
                  <span>{{ askNotice }}</span>
                </div>
              </div>

              <el-dialog
                v-model="askVisible"
                :title="askDialogTitle"
                width="720px"
                append-to-body
                class="am-ask-dialog"
                :close-on-click-modal="false"
              >
                <div class="ask-src" :class="{ free: aiSourceFree }">
                  <span class="ask-src-label">AI 来源</span>
                  <span class="ask-src-val">{{ aiSourceText }}</span>
                  <span v-if="aiSourceFree" class="ask-src-tag ok">免费调用 · 无需 Token</span>
                  <span v-else class="ask-src-tag paid">使用你配置的 AI Key</span>
                </div>
                <div class="ask-body md" v-html="askHtml"></div>
                <template #footer>
                  <el-button text @click="copyAsk"><el-icon><CopyDocument /></el-icon> 复制全文</el-button>
                  <el-button type="primary" @click="askVisible = false">知道了</el-button>
                </template>
              </el-dialog>
            </div>

            <div class="am-card duo-card">
              <div class="duo-head">
                <h3><el-icon><Collection /></el-icon> 典型应用 · 发布时间 · 来源</h3>
                <span class="duo-cur">当前：{{ selModel.name }}</span>
              </div>
              <ul class="duo-apps">
                <li v-for="(a, i) in selModel.apps" :key="i">
                  <span class="da-dot"></span>
                  <div class="da-main">
                    <b>{{ a.name }}</b>
                    <span class="da-from">{{ a.from }}</span>
                  </div>
                  <span class="da-date">{{ a.date }}</span>
                </li>
              </ul>
              <div class="duo-kv">
                <div class="kv"><span>首次发布</span><b>{{ selModel.released }}</b></div>
                <div class="kv"><span>资料来源</span><b>{{ selModel.source }}</b></div>
                <div class="kv"><span>许可证</span><b>{{ selModel.license }}</b></div>
              </div>
              <div class="duo-free">
                <h5>全部免费调用渠道</h5>
                <div class="mkc-tags">
                  <span v-for="f in selModel.freeChannels" :key="f" class="mk-chip free">{{ f }}</span>
                </div>
              </div>
            </div>
          </div>
        </template>

        <!-- ==================== 应用模块 ==================== -->
        <template v-else-if="isAppModule">
          <div class="am-card">
            <div class="ap-toolbar">
              <div class="ap-cats">
                <button
                  v-for="c in appCatOptions"
                  :key="c.key"
                  type="button"
                  class="ap-cat"
                  :class="{ on: appCat === c.key }"
                  :style="{ '--c': c.color }"
                  @click="appCat = c.key"
                >
                  {{ c.label }}<i>{{ c.count }}</i>
                </button>
              </div>
              <el-input v-model="appSearch" placeholder="搜索应用 / 厂商" :prefix-icon="Search" clearable class="tb-search" />
            </div>

            <div class="ap-grid">
              <article
                v-for="a in filteredApps"
                :key="a.id"
                class="ap-card"
                :style="{ '--c': categoryColor(a.cat) }"
                @click="openAppDialog(a)"
              >
                <div class="ap-top">
                  <span class="ap-logo">{{ a.name.slice(0, 1) }}</span>
                  <div class="ap-name">
                    <b>{{ a.name }}</b>
                    <span>{{ a.vendor }}</span>
                  </div>
                  <div class="ap-badges">
                    <span class="ap-cat-tag">{{ categoryLabel(a.cat) }}</span>
                  </div>
                </div>
                <p class="ap-intro">{{ a.intro }}</p>
                <div class="ap-meta">
                  <span><el-icon><Calendar /></el-icon>{{ a.released }}</span>
                  <span class="ap-src">{{ a.source }}</span>
                </div>
              </article>
              <p v-if="!filteredApps.length" class="mk-empty">没有匹配的应用。</p>
            </div>

            <el-dialog
              v-model="appDialogVisible"
              :title="appDialogApp?.name || '应用详情'"
              width="600px"
              align-center
              append-to-body
              destroy-on-close
              class="app-dlg"
            >
              <div v-if="appDialogApp" class="app-dlg-body" :style="{ '--c': categoryColor(appDialogApp.cat) }">
                <div class="apd-head">
                  <span class="ap-logo big">{{ appDialogApp.name.slice(0, 1) }}</span>
                  <div class="apd-title">
                    <b>{{ appDialogApp.name }}</b>
                    <span>{{ appDialogApp.vendor }} · {{ categoryLabel(appDialogApp.cat) }} · 发布于 {{ appDialogApp.released }}</span>
                  </div>
                  <a class="apd-link" :href="appDialogApp.site" target="_blank" rel="noopener">访问官网 <el-icon><Link /></el-icon></a>
                </div>
                <div class="apd-body">
                  <div class="apd-col">
                    <h5>产品介绍</h5>
                    <p>{{ appDialogApp.intro }}</p>
                    <h5>免费策略</h5>
                    <p class="apd-free">{{ appDialogApp.freeNote }}</p>
                    <h5>消息来源</h5>
                    <p>{{ appDialogApp.source }}</p>
                    <button v-if="appDialogApp.modelId" type="button" class="apd-jump" @click="jumpToModel(appDialogApp.modelId); appDialogVisible = false">
                      查看底层模型 <el-icon><Right /></el-icon>
                    </button>
                  </div>
                  <div class="apd-col">
                    <h5>关键时间线</h5>
                    <ul class="apd-timeline">
                      <li v-for="(t, i) in appDialogApp.timeline" :key="i">
                        <span class="apt-dot"></span>
                        <span class="apt-date">{{ t.date }}</span>
                        <span class="apt-event">{{ t.event }}</span>
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
            </el-dialog>
          </div>
        </template>

        <!-- ==================== AI 新闻 ==================== -->
        <template v-else>
          <div class="am-card nw-card">
            <div class="nw-header">
              <div class="nw-title">
                <h3><el-icon><Bell /></el-icon> AI 新闻</h3>
                <span class="nw-badge">100% 免费公开源</span>
              </div>
              <div class="nw-right">
                <span v-if="newsResult" class="nw-time">更新于 {{ newsResult.fetchedAt }}</span>
                <el-button size="small" :loading="newsLoading" @click="loadNews">
                  <el-icon><Refresh /></el-icon> 刷新
                </el-button>
              </div>
            </div>

            <div class="nw-filters">
              <button
                v-for="f in NEWS_FILTERS"
                :key="f.key"
                type="button"
                class="nw-f"
                :class="{ on: newsFilter === f.key }"
                @click="newsFilter = f.key"
              >{{ f.label }}</button>
              <span class="nw-sep"></span>
              <button
                v-for="s in AI_NEWS_SOURCES"
                :key="s.key"
                type="button"
                class="nw-f src"
                :class="{ on: newsFilter === s.key, dead: sourceDead(s.key) }"
                :style="{ '--c': s.color }"
                :title="sourceDead(s.key) ? '该源当前不可达，已自动跳过' : s.note"
                @click="newsFilter = s.key"
              >
                <i class="nw-dot" :style="{ background: s.color }"></i>
                {{ s.label }}
              </button>
            </div>

            <div v-if="newsResult" class="nw-health">
              <span class="nh-label">源状态</span>
              <span
                v-for="s in newsResult.sources"
                :key="s.source.key"
                class="nh-item"
                :class="s.ok ? 'ok' : 'bad'"
              >
                <i :style="{ background: s.source.color }"></i>
                {{ s.source.label }}
                <b v-if="s.ok">{{ s.count }} 条</b>
                <b v-else>暂未连上</b>
              </span>
            </div>

            <div v-if="newsResult && newsResult.fallback" class="nw-fallback">
              <el-icon><InfoFilled /></el-icon>
              <div>
                <b>当前网络受限，正在展示本地精选内容</b>
                <p>在线源全部不可达时已自动切换为离线清单。所有新闻抓取均来自免费公开源，不消耗任何额度。</p>
              </div>
            </div>

            <div v-if="newsLoading && !filteredNews.length" class="nw-loading">正在从免费公开源抓取最新动态…</div>

            <ul class="nw-timeline">
              <li v-for="n in filteredNews" :key="n.id" class="nw-item">
                <span class="nwt-dot" :style="{ background: sourceColor(n.sourceKey) }"></span>
                <div class="nwt-body">
                  <div class="nwt-head">
                    <span class="nwt-region" :class="n.region">{{ n.region === 'cn' ? '国内' : '国外' }}</span>
                    <span class="nwt-src" :style="{ color: sourceColor(n.sourceKey) }">{{ n.sourceLabel }}</span>
                    <span class="nwt-time">{{ relTime(n.pubTs) }}</span>
                  </div>
                  <a class="nwt-title" :href="n.link" target="_blank" rel="noopener">{{ n.title }}</a>
                  <p v-if="n.desc" class="nwt-desc">{{ n.desc }}</p>
                </div>
              </li>
              <li v-if="!newsLoading && !filteredNews.length" class="nw-none">该筛选下暂无内容，换个来源或点击刷新。</li>
            </ul>
          </div>
        </template>
      </section>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import {
  MagicStick, Search, Refresh, Cpu, Promotion, Grid, Star, Bell,
  Calendar, Link, Right, Collection, CircleCheck, WarningFilled,
  TrendCharts, InfoFilled, Loading, CopyDocument
} from '@element-plus/icons-vue'
import PageHeader from '../components/PageHeader.vue'
import { renderMarkdown } from '../lib/markdown'
import { loadAiConfig, callAi, type AiConfig } from '../services/aiService'
import {
  CN_MODELS, GLOBAL_MODELS, CN_APPS, GLOBAL_APPS,
  APP_CATEGORIES, categoryLabel, categoryColor,
  type KnowModel, type KnowApp
} from '../data/aiKnowledge'
import {
  fetchAiNews, relTime, AI_NEWS_SOURCES, type AiNewsResult
} from '../services/aiNewsService'
import { fetchHfTrending, type TrendModel } from '../services/aiTrendService'

/* ===== 模块入口 ===== */
const MODULES = [
  { key: 'cnModel', label: '国内模型', desc: '国产大模型全景', color: '#6366f1', icon: Cpu },
  { key: 'globalModel', label: '国外模型', desc: '海外前沿模型', color: '#0ea5e9', icon: Promotion },
  { key: 'cnApp', label: '国内应用', desc: '国产 AI 产品', color: '#14b8a6', icon: Grid },
  { key: 'globalApp', label: '国外应用', desc: '海外 AI 产品', color: '#f59e0b', icon: Star },
  { key: 'news', label: 'AI 新闻', desc: '前沿动态追踪', color: '#ef4444', icon: Bell }
]
const NEWS_FILTERS = [
  { key: 'all', label: '全部' },
  { key: 'cn', label: '国内' },
  { key: 'global', label: '国外' }
]
const active = ref('cnModel')
const isModelModule = computed(() => active.value === 'cnModel' || active.value === 'globalModel')
const isAppModule = computed(() => active.value === 'cnApp' || active.value === 'globalApp')

function countOf(key: string): string {
  if (key === 'cnModel') return String(CN_MODELS.length)
  if (key === 'globalModel') return String(GLOBAL_MODELS.length)
  if (key === 'cnApp') return String(CN_APPS.length)
  if (key === 'globalApp') return String(GLOBAL_APPS.length)
  return newsResult.value ? String(newsResult.value.items.length) : (newsLoading.value ? '…' : '—')
}

function switchModule(key: string): void {
  active.value = key
  if (key === 'news' && !newsResult.value && !newsLoading.value) void loadNews()
}

/* ===== 时钟 ===== */
const nowText = ref('')
let clockTimer: number | undefined
function pad(n: number): string { return String(n).padStart(2, '0') }
function updateClock(): void {
  const d = new Date()
  nowText.value = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

/* ===== 模型模块 ===== */
const modelSearch = ref('')
const useFilter = ref('')
const licFilter = ref('')
const selModel = ref<KnowModel | null>(null)

const baseModels = computed<KnowModel[]>(() => (active.value === 'globalModel' ? GLOBAL_MODELS : CN_MODELS))
const useOptions = computed(() => Array.from(new Set(baseModels.value.flatMap((m) => m.uses))))
const licOptions = computed(() => Array.from(new Set(baseModels.value.map((m) => m.license))))

const filteredModels = computed(() => {
  const kw = modelSearch.value.trim().toLowerCase()
  return baseModels.value.filter((m) => {
    if (useFilter.value && !m.uses.includes(useFilter.value)) return false
    if (licFilter.value && m.license !== licFilter.value) return false
    if (kw && !`${m.name} ${m.org} ${m.intro}`.toLowerCase().includes(kw)) return false
    return true
  })
})

function selectModel(m: KnowModel): void {
  selModel.value = m
  askQ.value = ''
  askA.value = ''
}

function jumpToModel(id?: string): void {
  if (!id) return
  const inCn = CN_MODELS.find((m) => m.id === id)
  const target = inCn || GLOBAL_MODELS.find((m) => m.id === id)
  if (!target) { ElMessage.info('该应用暂未关联可查看的模型'); return }
  active.value = inCn ? 'cnModel' : 'globalModel'
  modelSearch.value = ''
  useFilter.value = ''
  licFilter.value = ''
  selModel.value = target
  appDialogVisible.value = false
  appDialogApp.value = null
}

/* ===== 应用模块 ===== */
const appSearch = ref('')
const appCat = ref('all')
const appDialogVisible = ref(false)
const appDialogApp = ref<KnowApp | null>(null)

const baseApps = computed<KnowApp[]>(() => (active.value === 'globalApp' ? GLOBAL_APPS : CN_APPS))

/** 分类胶囊：只展示当前区域实际存在的分类，数量动态统计 */
const appCatOptions = computed(() => {
  const list = baseApps.value
  return APP_CATEGORIES
    .map((c) => ({
      ...c,
      count: c.key === 'all' ? list.length : list.filter((a) => a.cat === c.key).length
    }))
    .filter((c) => c.count > 0)
})

const filteredApps = computed(() => {
  const kw = appSearch.value.trim().toLowerCase()
  return baseApps.value.filter((a) => {
    if (appCat.value !== 'all' && a.cat !== appCat.value) return false
    if (kw && !`${a.name} ${a.vendor} ${a.intro}`.toLowerCase().includes(kw)) return false
    return true
  })
})

function openAppDialog(a: KnowApp): void {
  appDialogApp.value = a
  appDialogVisible.value = true
}

/* ===== 新闻模块 ===== */
const newsResult = ref<AiNewsResult | null>(null)
const newsLoading = ref(false)
const newsFilter = ref('all')

async function loadNews(): Promise<void> {
  newsLoading.value = true
  try {
    newsResult.value = await fetchAiNews(12)
  } catch (e) {
    ElMessage.error('新闻抓取失败：' + (e as Error).message)
  } finally {
    newsLoading.value = false
  }
}

const filteredNews = computed(() => {
  const r = newsResult.value
  if (!r) return []
  if (newsFilter.value === 'all') return r.items
  if (newsFilter.value === 'cn' || newsFilter.value === 'global') {
    return r.items.filter((n) => n.region === newsFilter.value)
  }
  return r.items.filter((n) => n.sourceKey === newsFilter.value)
})

function sourceColor(key: string): string {
  return AI_NEWS_SOURCES.find((s) => s.key === key)?.color || '#94a3b8'
}
function sourceDead(key: string): boolean {
  const r = newsResult.value
  if (!r) return false
  return r.sources.some((s) => s.source.key === key && !s.ok)
}

/* ===== 实时趋势（仅模型模块，HF 免费公共 API） ===== */
const trendLoading = ref(false)
const trendModels = ref<TrendModel[]>([])
const trendError = ref('')

async function loadTrends(): Promise<void> {
  if (trendLoading.value) return
  trendLoading.value = true
  trendError.value = ''
  try {
    trendModels.value = await fetchHfTrending(8)
  } catch (e) {
    trendError.value = (e as Error).message || '实时趋势加载失败'
    trendModels.value = []
  } finally {
    trendLoading.value = false
  }
}

function trendUpdatedAt(m: TrendModel | undefined): string {
  if (!m?.updatedAt) return ''
  const ts = new Date(m.updatedAt).getTime()
  return ts ? relTime(ts) : ''
}
function fmtTrendNum(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'k'
  return String(n || 0)
}

/* ===== AI 追问 ===== */
const cfg = ref<AiConfig | null>(null)
const askQ = ref('')
const askA = ref('')
const askLoading = ref(false)
const askVisible = ref(false)
const askHtml = computed(() => (askA.value ? renderMarkdown(askA.value) : ''))
const askDialogTitle = computed(() => 'AI 讲解 · ' + (selModel.value?.name || ''))
/** 点击查询时的提示：明确这次用的是「需要 Token 的你配置 AI」还是「免费本地模型」 */
const askNotice = computed(() => {
  if (!cfg.value) return '请先到「AI 助手」配置免费密钥后再提问。'
  if (aiSourceFree.value) {
    return `正在本地 Ollama 免费模型「${cfg.value.model}」生成讲解，无需 Token，数据仅本地展示不上云。`
  }
  return `正在使用「${aiSourceText.value}」生成讲解，本次回答会消耗你所配置 AI Key 对应的 Token（按实际输出字数计费）。`
})
async function copyAsk(): Promise<void> {
  if (!askA.value) return
  try {
    await navigator.clipboard.writeText(askA.value)
    ElMessage.success('已复制到剪贴板')
  } catch {
    ElMessage.warning('复制失败，请手动选择文本')
  }
}

const aiSourceText = computed(() => {
  if (!cfg.value) return '尚未配置'
  const map: Record<string, string> = {
    ollama: '本地 Ollama',
    openrouter: 'OpenRouter',
    'openai-compatible': 'OpenAI 兼容接口',
    bailian: '阿里百炼'
  }
  return `${map[cfg.value.provider] || cfg.value.provider} · ${cfg.value.model}`
})
const aiSourceFree = computed(() => {
  if (!cfg.value) return false
  // Ollama 本地运行完全免费无 Token
  if (cfg.value.provider === 'ollama') return true
  // 其他依赖用户配置的免费 Key/额度
  return false
})

async function runAsk(): Promise<void> {
  if (!cfg.value) { ElMessage.warning('请先到「AI 助手」配置免费密钥'); return }
  const m = selModel.value
  if (!m) return
  askLoading.value = true
  try {
    const extra = askQ.value.trim() || '请用通俗易懂的方式讲解这个模型：它解决了什么问题、技术亮点是什么、适合我在什么场景下学习或使用。'
    askA.value = await callAi(
      cfg.value,
      `你是 AI 技术科普讲师。关于模型「${m.name}」（机构：${m.org}；参数规模：${m.scale}；主要用途：${m.uses.join('、')}；许可证：${m.license}；发布时间：${m.released}）。\n用户的问题：${extra}\n请用中文回答，条理清晰、控制在 300 字内，客观中立并说明信息可能存在时效性偏差。`
    )
    askVisible.value = true
  } catch (e) {
    ElMessage.error('AI 调用失败：' + (e as Error).message)
  } finally {
    askLoading.value = false
  }
}

/* ===== 生命周期 ===== */
watch(active, () => {
  if (isModelModule.value) {
    modelSearch.value = ''
    useFilter.value = ''
    licFilter.value = ''
    selModel.value = baseModels.value[0] || null
    askQ.value = ''
    askA.value = ''
    void loadTrends()
  }
  if (isAppModule.value) {
    appSearch.value = ''
    appCat.value = 'all'
    appDialogVisible.value = false
    appDialogApp.value = null
  }
})

onMounted(async () => {
  updateClock()
  clockTimer = window.setInterval(updateClock, 1000)
  selModel.value = CN_MODELS[0] || null
  try { cfg.value = await loadAiConfig() } catch { /* 未配置时忽略 */ }
})
onUnmounted(() => { if (clockTimer) window.clearInterval(clockTimer) })
</script>

<style scoped>
.am-root {
  padding: 0 18px 18px;
  max-width: 1400px;
  margin: 0 auto;
  color: var(--text);
}

/* 页头右侧时钟 */
.am-clock-box { display: inline-flex; align-items: center; gap: 6px; }
.am-dot { width: 8px; height: 8px; border-radius: 50%; background: #22c55e; box-shadow: 0 0 0 3px rgba(34, 197, 94, .18); }
.am-clock { font-variant-numeric: tabular-nums; font-size: 13px; color: var(--text-strong); }
.am-clock-hint { font-size: 11px; color: var(--text-faint); }

/* ===== 五模块入口 ===== */
.am-entries {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 12px;
  margin-bottom: 18px;
}
.am-entry {
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
.am-entry:hover { transform: translateY(-2px); border-color: var(--c); }
.am-entry.on {
  border-color: var(--c);
  background: color-mix(in srgb, var(--c) 7%, var(--surface));
}
.ae-bar {
  position: absolute;
  left: 0; top: 0; bottom: 0;
  width: 3px;
  background: var(--c);
  opacity: 0;
  transition: opacity .18s ease;
}
.am-entry.on .ae-bar { opacity: 1; }
.ae-icon {
  width: 34px; height: 34px;
  border-radius: 10px;
  display: grid; place-items: center;
  flex-shrink: 0;
  background: color-mix(in srgb, var(--c) 12%, transparent);
  color: var(--c);
}
.ae-icon :deep(svg) { font-size: 17px; }
.ae-text { display: flex; flex-direction: column; min-width: 0; flex: 1; line-height: 1.3; }
.ae-label { font-size: 13.5px; font-weight: 600; color: var(--text-strong); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.ae-desc { font-size: 11px; color: var(--text-faint); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.ae-count {
  flex-shrink: 0;
  min-width: 26px;
  height: 20px;
  padding: 0 6px;
  border-radius: 999px;
  display: grid; place-items: center;
  font-size: 11px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  color: var(--c);
  background: color-mix(in srgb, var(--c) 12%, transparent);
}

/* ===== 通用卡片 ===== */
.am-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 14px;
  box-shadow: var(--shadow-card);
  padding: 16px 18px;
}
.am-body { display: flex; flex-direction: column; gap: 14px; }

/* 切换动画 */
.am-fade-enter-active, .am-fade-leave-active { transition: opacity .2s ease, transform .2s ease; }
.am-fade-enter-from { opacity: 0; transform: translateY(8px); }
.am-fade-leave-to { opacity: 0; transform: translateY(-6px); }

/* ===== 实时趋势 ===== */
.mk-trend-card { padding: 14px 16px; }
.mkt-head { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-bottom: 10px; }
.mkt-head h3 { margin: 0; font-size: 13.5px; font-weight: 600; color: var(--text-strong); display: inline-flex; align-items: center; gap: 6px; }
.mkt-head h3 :deep(svg) { color: #f59e0b; }
.mkt-meta { margin-left: auto; display: inline-flex; align-items: center; gap: 8px; }
.mkt-free { font-size: 10.5px; font-weight: 600; padding: 2px 8px; border-radius: 999px; background: rgba(34, 197, 94, .1); color: #16a34a; }
.mkt-time { font-size: 11px; color: var(--text-faint); }
.mkt-list { display: flex; gap: 10px; overflow-x: auto; padding-bottom: 4px; }
.mkt-item {
  flex-shrink: 0;
  width: 220px;
  padding: 12px 14px;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: var(--surface-soft);
  display: flex;
  flex-direction: column;
  gap: 5px;
  text-decoration: none;
  transition: transform .16s ease, border-color .16s ease, box-shadow .16s ease;
}
.mkt-item:hover { transform: translateY(-2px); border-color: var(--primary); box-shadow: var(--shadow-card); }
.mkt-item b { font-size: 13px; color: var(--text-strong); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.mkt-item span { font-size: 11px; color: var(--text-muted); }
.mkt-item i { font-size: 10.5px; color: var(--text-faint); font-style: normal; }
.mkt-loading, .mkt-empty { width: 100%; padding: 14px; text-align: center; font-size: 12.5px; color: var(--text-faint); background: var(--surface-soft); border-radius: 10px; }

/* ===== 模型工具栏 ===== */
.mk-toolbar { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-bottom: 12px; }
.tb-search { width: 220px; }
.tb-sel { width: 150px; }
.tb-count { font-size: 12px; color: var(--text-faint); margin-left: auto; }
.tb-count b { color: var(--text-strong); }

/* ===== 模型表格 ===== */
.mk-table-wrap { overflow-x: auto; border: 1px solid var(--border); border-radius: 10px; }
.mk-table { width: 100%; border-collapse: collapse; font-size: 13px; min-width: 900px; }
.mk-table th {
  text-align: left;
  padding: 10px 12px;
  background: var(--surface-soft);
  color: var(--text-muted);
  font-weight: 600;
  font-size: 12px;
  border-bottom: 1px solid var(--border);
  white-space: nowrap;
}
.mk-table td { padding: 11px 12px; border-bottom: 1px solid var(--border); color: var(--text); vertical-align: middle; }
.mk-table tbody tr { cursor: pointer; transition: background .15s ease; }
.mk-table tbody tr:hover { background: var(--surface-soft); }
.mk-table tbody tr.on { background: color-mix(in srgb, var(--primary) 8%, var(--surface)); }
.mk-table tbody tr:last-child td { border-bottom: none; }
.td-name { font-weight: 600; color: var(--text-strong); white-space: nowrap; }

.mk-dot { display: inline-block; width: 6px; height: 6px; border-radius: 50%; background: var(--primary); margin-right: 7px; vertical-align: middle; }
.td-mono { font-variant-numeric: tabular-nums; font-size: 12px; color: var(--text-muted); }
.mk-chip {
  display: inline-block;
  font-size: 11px;
  padding: 2px 7px;
  margin: 1px 4px 1px 0;
  border-radius: 6px;
  background: var(--surface-soft);
  border: 1px solid var(--border);
  color: var(--text-muted);
  white-space: nowrap;
}
.mk-chip.free { background: rgba(34, 197, 94, .09); border-color: rgba(34, 197, 94, .3); color: #16a34a; }
.mk-more { font-size: 11px; color: var(--text-faint); }
.mk-lic { font-size: 11.5px; color: var(--text-muted); }
.mk-empty { text-align: center; color: var(--text-faint); font-size: 13px; padding: 24px; }

/* 移动端模型卡片 */
.mk-cards { display: none; flex-direction: column; gap: 10px; }
.mk-card {
  padding: 12px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--surface-soft);
  cursor: pointer;
}
.mk-card.on { border-color: var(--primary); background: color-mix(in srgb, var(--primary) 7%, var(--surface)); }
.mk-card h4 { margin: 0 0 8px; font-size: 14px; color: var(--text-strong); }
.mkc-row { display: flex; justify-content: space-between; gap: 10px; font-size: 12px; padding: 3px 0; }
.mkc-row span { color: var(--text-faint); flex-shrink: 0; }
.mkc-row b { color: var(--text); font-weight: 500; text-align: right; }
.mkc-tags { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 8px; }

/* ===== 联动双栏 ===== */
.mk-duo { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
.duo-card { display: flex; flex-direction: column; }
.duo-head { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-bottom: 10px; }
.duo-head h3 { margin: 0; font-size: 14px; font-weight: 600; color: var(--text-strong); display: inline-flex; align-items: center; gap: 6px; }
.duo-head h3 :deep(svg) { color: var(--primary); }
.duo-source {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  margin-bottom: 10px;
  padding: 6px 10px;
  border-radius: 8px;
  background: var(--surface-soft);
  border: 1px solid var(--border);
  font-size: 12px;
}
.ds-label { color: var(--text-faint); }
.ds-value { color: var(--text-strong); font-weight: 600; }
.ds-free { font-size: 10.5px; font-weight: 700; padding: 1px 7px; border-radius: 999px; background: rgba(34, 197, 94, .12); color: #16a34a; }
.ds-paid { font-size: 10.5px; font-weight: 700; padding: 1px 7px; border-radius: 999px; background: rgba(245, 158, 11, .12); color: #d97706; }
.duo-cur {
  margin-left: auto;
  font-size: 11px;
  padding: 2px 9px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--primary) 10%, transparent);
  color: var(--primary);
  font-weight: 600;
  max-width: 60%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.duo-intro { margin: 0 0 10px; font-size: 13px; line-height: 1.7; color: var(--text); }
.duo-points { list-style: none; margin: 0 0 12px; padding: 0; display: flex; flex-direction: column; gap: 8px; }
.duo-points li { display: flex; gap: 9px; font-size: 12.5px; line-height: 1.65; color: var(--text-muted); }
.duo-points i {
  flex-shrink: 0;
  width: 18px; height: 18px;
  border-radius: 6px;
  display: grid; place-items: center;
  font-style: normal;
  font-size: 11px;
  font-weight: 700;
  background: color-mix(in srgb, var(--primary) 10%, transparent);
  color: var(--primary);
  margin-top: 1px;
}
.duo-ask { margin-top: auto; padding-top: 12px; border-top: 1px dashed var(--border); }
.duo-ask-row { display: flex; align-items: center; gap: 8px; margin-top: 8px; flex-wrap: wrap; }
.duo-ask-row :deep(.el-button) { display: inline-flex; align-items: center; gap: 4px; }
.duo-warn { font-size: 11.5px; color: #f59e0b; }
.duo-asking {
  display: flex; align-items: center; gap: 8px; margin-top: 10px;
  padding: 10px 12px; border-radius: 8px;
  background: color-mix(in srgb, var(--primary) 6%, var(--surface-soft));
  border: 1px solid color-mix(in srgb, var(--primary) 20%, transparent);
  font-size: 12px; color: var(--text-muted); line-height: 1.5;
}
.duo-spin { display: inline-flex; color: var(--primary); animation: amSpin 1s linear infinite; flex-shrink: 0; }
@keyframes amSpin { to { transform: rotate(360deg); } }

/* AI 回答弹框 */
.ask-src {
  display: flex; align-items: center; gap: 8px; flex-wrap: wrap;
  padding: 8px 12px; border-radius: 10px; margin-bottom: 12px;
  background: var(--surface-soft); border: 1px solid var(--border); font-size: 12.5px;
}
.ask-src-label { color: var(--text-faint); }
.ask-src-val { font-weight: 700; color: var(--text-strong); }
.ask-src-tag { font-size: 10.5px; font-weight: 700; padding: 1px 8px; border-radius: 999px; }
.ask-src-tag.ok { background: rgba(34, 197, 94, .12); color: #16a34a; }
.ask-src-tag.paid { background: rgba(245, 158, 11, .12); color: #d97706; }
.ask-body {
  max-height: 60vh; overflow-y: auto;
  font-size: 13.5px; line-height: 1.8; color: var(--text-strong);
}
.ask-body :deep(.md-h1), .ask-body :deep(.md-h2), .ask-body :deep(.md-h3),
.ask-body :deep(.md-h4), .ask-body :deep(.md-h5), .ask-body :deep(.md-h6) {
  margin: 14px 0 6px; line-height: 1.35; font-weight: 800; color: var(--text-strong);
}
.ask-body :deep(.md-h1) { font-size: 19px; }
.ask-body :deep(.md-h2) { font-size: 17px; }
.ask-body :deep(.md-h3) { font-size: 15px; }
.ask-body :deep(.md-p) { margin: 8px 0; }
.ask-body :deep(.md-ul), .ask-body :deep(.md-ol) { margin: 8px 0; padding-left: 22px; }
.ask-body :deep(.md-li) { margin: 4px 0; }
.ask-body :deep(.md-a) { color: var(--primary); text-decoration: underline; }
.ask-body :deep(.md-code) {
  background: var(--surface-soft); color: var(--primary);
  padding: 1px 5px; border-radius: 5px;
  font-family: 'SFMono-Regular', Consolas, Menlo, monospace; font-size: 12.5px;
}
.ask-body :deep(.md-pre) {
  background: #0f172a; color: #e2e8f0; padding: 12px 14px; border-radius: 10px;
  overflow: auto; margin: 8px 0; font-size: 12.5px; line-height: 1.6;
}
.ask-body :deep(.md-pre .md-code) { background: transparent; color: inherit; padding: 0; }
.ask-body :deep(.md-quote) { border-left: 3px solid var(--border-strong); padding-left: 10px; margin: 8px 0; color: var(--text-muted); }
.ask-body :deep(.md-hr) { border: none; border-top: 1px solid var(--border); margin: 12px 0; }
.am-ask-dialog :deep(.el-dialog__body) { padding-top: 6px; }
.am-ask-dialog :deep(.el-dialog) { border-radius: 16px; }

.duo-apps { list-style: none; margin: 0 0 12px; padding: 0; display: flex; flex-direction: column; gap: 10px; }
.duo-apps li { display: flex; align-items: flex-start; gap: 9px; }
.da-dot { width: 7px; height: 7px; border-radius: 50%; background: var(--primary); flex-shrink: 0; margin-top: 6px; }
.da-main { display: flex; flex-direction: column; min-width: 0; flex: 1; }
.da-main b { font-size: 13px; color: var(--text-strong); font-weight: 600; }
.da-from { font-size: 11.5px; color: var(--text-faint); }
.da-date { font-size: 11.5px; color: var(--text-muted); font-variant-numeric: tabular-nums; flex-shrink: 0; }
.duo-kv { display: flex; flex-direction: column; gap: 6px; padding: 10px 12px; background: var(--surface-soft); border-radius: 8px; margin-bottom: 12px; }
.kv { display: flex; justify-content: space-between; gap: 10px; font-size: 12px; }
.kv span { color: var(--text-faint); flex-shrink: 0; }
.kv b { color: var(--text); font-weight: 500; text-align: right; }
.duo-free h5 { margin: 0 0 6px; font-size: 12px; color: var(--text-muted); font-weight: 600; }

/* ===== 应用模块 ===== */
.ap-toolbar { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; margin-bottom: 14px; }
.ap-cats { display: flex; gap: 6px; flex-wrap: wrap; flex: 1; min-width: 0; }
.ap-cat {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 5px 11px;
  border-radius: 999px;
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--text-muted);
  font-size: 12.5px;
  cursor: pointer;
  transition: all .16s ease;
}
.ap-cat:hover { border-color: var(--c); color: var(--c); }
.ap-cat.on { border-color: var(--c); color: var(--c); background: color-mix(in srgb, var(--c) 10%, transparent); font-weight: 600; }
.ap-cat i { font-style: normal; font-size: 11px; opacity: .7; font-variant-numeric: tabular-nums; }

.ap-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(268px, 1fr)); gap: 12px; }
.ap-card {
  position: relative;
  padding: 14px;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: var(--surface);
  cursor: pointer;
  display: flex;
  flex-direction: column;
  gap: 9px;
  transition: transform .18s ease, border-color .18s ease, box-shadow .18s ease;
  overflow: hidden;
}
.ap-card::before {
  content: '';
  position: absolute;
  left: 0; top: 0; bottom: 0;
  width: 3px;
  background: var(--c);
  opacity: 0;
  transition: opacity .18s ease;
}
.ap-card:hover { transform: translateY(-2px); border-color: var(--c); box-shadow: var(--shadow-card); }
.ap-card.on { border-color: var(--c); background: color-mix(in srgb, var(--c) 5%, var(--surface)); }
.ap-card.on::before { opacity: 1; }
.ap-top { display: flex; align-items: center; gap: 10px; min-width: 0; }
.ap-logo {
  width: 36px; height: 36px;
  border-radius: 10px;
  display: grid; place-items: center;
  flex-shrink: 0;
  font-size: 16px;
  font-weight: 700;
  color: #fff;
  background: var(--c);
}
.ap-logo.big { width: 44px; height: 44px; font-size: 19px; border-radius: 12px; }
.ap-name { display: flex; flex-direction: column; min-width: 0; flex: 1; line-height: 1.35; }
.ap-name b { font-size: 14px; color: var(--text-strong); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ap-name span { font-size: 11.5px; color: var(--text-faint); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ap-badges { display: inline-flex; align-items: center; gap: 6px; flex-shrink: 0; }

.ap-cat-tag {
  flex-shrink: 0;
  font-size: 10.5px;
  padding: 2px 8px;
  border-radius: 999px;
  color: var(--c);
  background: color-mix(in srgb, var(--c) 12%, transparent);
  white-space: nowrap;
}
.ap-intro { margin: 0; font-size: 12.5px; line-height: 1.65; color: var(--text-muted); display: -webkit-box; -webkit-line-clamp: 3; line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
.ap-meta { display: flex; align-items: center; justify-content: space-between; gap: 8px; font-size: 11px; color: var(--text-faint); margin-top: auto; padding-top: 4px; }
.ap-meta span { display: inline-flex; align-items: center; gap: 4px; min-width: 0; }
.ap-src { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 60%; }

/* 应用详情弹框 */
.app-dlg-body {
  border: 1px solid var(--c);
  border-radius: 12px;
  background: color-mix(in srgb, var(--c) 4%, var(--surface));
  overflow: hidden;
}
.apd-head {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  border-bottom: 1px solid color-mix(in srgb, var(--c) 22%, transparent);
  flex-wrap: wrap;
}
.apd-title { display: flex; flex-direction: column; min-width: 0; flex: 1; line-height: 1.4; }
.apd-title b { font-size: 16px; color: var(--text-strong); }
.apd-title span { font-size: 12px; color: var(--text-muted); }
.apd-link {
  display: inline-flex; align-items: center; gap: 4px;
  font-size: 12.5px; color: var(--c); text-decoration: none;
  padding: 5px 12px; border-radius: 8px;
  border: 1px solid color-mix(in srgb, var(--c) 35%, transparent);
  flex-shrink: 0;
}
.apd-link:hover { background: color-mix(in srgb, var(--c) 10%, transparent); }
.apd-close {
  border: 1px solid var(--border); background: var(--surface); color: var(--text-muted);
  border-radius: 8px; padding: 5px 12px; font-size: 12.5px; cursor: pointer; flex-shrink: 0;
}
.apd-close:hover { color: var(--text-strong); }
.apd-body { display: grid; grid-template-columns: 1.15fr 1fr; gap: 18px; padding: 16px; }
.apd-col h5 { margin: 0 0 6px; font-size: 12px; font-weight: 600; color: var(--c); }
.apd-col h5:not(:first-child) { margin-top: 14px; }
.apd-col p { margin: 0; font-size: 12.5px; line-height: 1.75; color: var(--text); }
.apd-free { color: #16a34a !important; }

.apd-jump {
  margin-top: 14px;
  display: inline-flex; align-items: center; gap: 4px;
  border: none; background: var(--c); color: #fff;
  border-radius: 8px; padding: 6px 14px; font-size: 12.5px; cursor: pointer;
}
.apd-jump:hover { filter: brightness(1.06); }
.apd-timeline { list-style: none; margin: 0; padding: 0 0 0 4px; position: relative; }
.apd-timeline::before { content: ''; position: absolute; left: 4px; top: 6px; bottom: 6px; width: 1px; background: color-mix(in srgb, var(--c) 30%, transparent); }
.apd-timeline li { position: relative; padding: 0 0 14px 18px; }
.apd-timeline li:last-child { padding-bottom: 0; }
.apt-dot { position: absolute; left: 0; top: 5px; width: 9px; height: 9px; border-radius: 50%; background: var(--c); border: 2px solid var(--surface); }
.apt-date { display: block; font-size: 11.5px; color: var(--c); font-weight: 600; font-variant-numeric: tabular-nums; }
.apt-event { display: block; font-size: 12.5px; color: var(--text); line-height: 1.6; }

/* ===== 新闻模块 ===== */
.nw-card { padding: 16px 18px; }
.nw-header { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; margin-bottom: 12px; }
.nw-title { display: inline-flex; align-items: center; gap: 10px; min-width: 0; }
.nw-title h3 { margin: 0; font-size: 15px; font-weight: 600; color: var(--text-strong); display: inline-flex; align-items: center; gap: 6px; }
.nw-title h3 :deep(svg) { color: #ef4444; }
.nw-badge { font-size: 10.5px; font-weight: 700; padding: 3px 9px; border-radius: 999px; background: rgba(34, 197, 94, .12); color: #16a34a; }
.nw-right { display: inline-flex; align-items: center; gap: 10px; margin-left: auto; flex-shrink: 0; }
.nw-time { font-size: 11.5px; color: var(--text-faint); font-variant-numeric: tabular-nums; }

.nw-filters { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 12px; }
.nw-f {
  display: inline-flex; align-items: center; gap: 5px;
  padding: 5px 12px; border-radius: 999px;
  border: 1px solid var(--border); background: var(--surface);
  color: var(--text-muted); font-size: 12.5px; cursor: pointer; transition: all .16s ease;
}
.nw-f:hover { color: var(--text-strong); border-color: var(--primary); }
.nw-f.on { border-color: var(--primary); color: var(--primary); background: color-mix(in srgb, var(--primary) 10%, transparent); font-weight: 600; }
.nw-f.src.on { border-color: var(--c); color: var(--c); background: color-mix(in srgb, var(--c) 10%, transparent); }
.nw-f.dead { opacity: .45; text-decoration: line-through; }
.nw-dot { width: 7px; height: 7px; border-radius: 50%; }
.nw-sep { width: 1px; height: 16px; background: var(--border); margin: 0 2px; }

.nw-health {
  display: flex; align-items: center; gap: 10px; flex-wrap: wrap;
  padding: 8px 12px; background: var(--surface-soft); border-radius: 10px;
  margin-bottom: 14px; font-size: 11.5px;
}
.nh-label { color: var(--text-faint); }
.nh-item { display: inline-flex; align-items: center; gap: 5px; color: var(--text-muted); }
.nh-item i { width: 6px; height: 6px; border-radius: 50%; }
.nh-item.ok b { color: #16a34a; font-weight: 600; }
.nh-item.bad { opacity: .65; }
.nh-item.bad b { color: var(--text-faint); font-weight: 500; }

.nw-fallback {
  display: flex; align-items: flex-start; gap: 10px;
  padding: 12px 14px; margin-bottom: 14px;
  border-radius: 10px;
  background: color-mix(in srgb, #0ea5e9 6%, var(--surface));
  border: 1px solid color-mix(in srgb, #0ea5e9 22%, transparent);
  color: var(--text);
}
.nw-fallback :deep(svg) { color: #0ea5e9; flex-shrink: 0; margin-top: 2px; }
.nw-fallback b { font-size: 13px; display: block; margin-bottom: 3px; }
.nw-fallback p { margin: 0; font-size: 11.5px; line-height: 1.6; color: var(--text-muted); }

.nw-loading { text-align: center; padding: 30px; color: var(--text-faint); font-size: 13px; }

.nw-timeline { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 10px; }
.nw-item {
  position: relative;
  padding: 14px 16px 14px 18px;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: var(--surface-soft);
  display: flex; gap: 12px;
  transition: transform .16s ease, box-shadow .16s ease, border-color .16s ease;
}
.nw-item:hover { transform: translateY(-1px); border-color: var(--border-strong); box-shadow: var(--shadow-card); }
.nwt-dot { flex-shrink: 0; width: 10px; height: 10px; border-radius: 50%; margin-top: 4px; box-shadow: 0 0 0 3px var(--surface); }
.nwt-body { display: flex; flex-direction: column; gap: 6px; min-width: 0; flex: 1; }
.nwt-head { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.nwt-region { font-size: 10.5px; padding: 2px 8px; border-radius: 999px; font-weight: 600; }
.nwt-region.cn { background: rgba(239, 68, 68, .1); color: #ef4444; }
.nwt-region.global { background: rgba(14, 165, 233, .1); color: #0ea5e9; }
.nwt-src { font-size: 11.5px; font-weight: 600; }
.nwt-time { font-size: 11px; color: var(--text-faint); }
.nwt-title { font-size: 14px; color: var(--text-strong); text-decoration: none; line-height: 1.55; font-weight: 600; word-break: break-word; }
.nwt-title:hover { color: var(--primary); }
.nwt-desc { margin: 0; font-size: 12px; color: var(--text-muted); line-height: 1.7; display: -webkit-box; -webkit-line-clamp: 2; line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.nw-none { list-style: none; text-align: center; color: var(--text-faint); font-size: 13px; padding: 24px; }

/* ===== 响应式 ===== */
@media (max-width: 1180px) {
  .am-entries { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  .mk-duo { grid-template-columns: 1fr; }
  .apd-body { grid-template-columns: 1fr; gap: 14px; }
}
@media (max-width: 900px) {
  .mk-table-wrap { display: none; }
  .mk-cards { display: flex; }
  .tb-count { margin-left: 0; width: 100%; }
}
@media (max-width: 768px) {
  .am-root { padding: 0 14px 14px; }
  .am-entries { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
  .am-entry { padding: 10px 10px 10px 13px; gap: 8px; }
  .ae-icon { width: 30px; height: 30px; border-radius: 9px; }
  .ae-label { font-size: 12.5px; }
  .ae-desc { display: none; }
  .am-card { padding: 14px; border-radius: 12px; }
  .tb-search, .tb-sel { width: 100%; }
  .ap-grid { grid-template-columns: 1fr; }
  .nw-right { width: 100%; justify-content: space-between; }
  .duo-cur { max-width: 100%; margin-left: 0; }
}
@media (max-width: 380px) {
  .am-entries { grid-template-columns: 1fr; }
}
</style>
