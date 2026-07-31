<template>
  <div class="fx-page">
    <!-- 顶部大标题区 -->
    <div class="fx-hero">
      <div class="fx-hero-left">
        <h1 class="fx-title">沸爻机 <span class="fx-spark">⚡</span></h1>
        <p class="fx-sub">AI 热点提炼 · 基于 Google News 实时新闻 · 自动聚类 · 去旧留新</p>
        <p class="fx-meta">
          数据时间：{{ nowLabel }} · 素材：{{ NEWS_CATEGORIES.find((c) => c.key === selectedCat)?.label }}
          · 时间窗口：{{ windowLabel }}
        </p>
      </div>
      <div class="fx-hero-badge"><el-icon><MagicStick /></el-icon></div>
    </div>

    <!-- 控制栏 -->
    <div class="fx-control">
      <div class="fx-row">
        <div class="fx-field">
          <label>新闻领域</label>
          <el-select v-model="selectedCat" filterable placeholder="选择领域" class="fx-sel">
            <el-option v-for="c in NEWS_CATEGORIES" :key="c.key" :label="c.label" :value="c.key" />
          </el-select>
        </div>
        <div class="fx-field">
          <label>时间窗口</label>
          <el-select v-model="windowKey" class="fx-sel">
            <el-option label="最近 24 小时" value="24h" />
            <el-option label="最近 48 小时" value="48h" />
            <el-option label="最近 7 天" value="7d" />
          </el-select>
        </div>
        <el-button type="primary" class="fx-gen" :loading="generating" @click="generate">
          <el-icon><MagicStick /></el-icon> 生成热点
        </el-button>
      </div>
      <div class="fx-field fx-field-full">
        <label>想从新闻中提取什么？（自然语言描述，如「提取融资/并购事件，并标注风险等级」）</label>
        <el-input
          v-model="instruction"
          type="textarea"
          :rows="2"
          placeholder="例：提取与人工智能相关的政策利好、融资动态，并总结一句话影响"
        />
      </div>
      <div class="fx-note">
        生成走当前账号的 AI 助手配置（<b>{{ aiModelLabel }}</b>），与其他账号隔离；
        未配置 Key 的本地模型（如 Ollama）请确保已启动。
        <el-button link type="primary" size="small" @click="router.push('/ai')">去配置 AI →</el-button>
      </div>
    </div>

    <!-- 指标卡 -->
    <div v-if="results.length" class="fx-metrics">
      <div class="fx-metric">
        <div class="fx-metric-ico">🔥</div>
        <div class="fx-metric-num">{{ results.length }}</div>
        <div class="fx-metric-label">提炼热点</div>
      </div>
      <div class="fx-metric">
        <div class="fx-metric-ico">📰</div>
        <div class="fx-metric-num">{{ sampleCount }}</div>
        <div class="fx-metric-label">实时新闻样本</div>
      </div>
      <div class="fx-metric">
        <div class="fx-metric-ico">✓</div>
        <div class="fx-metric-num">{{ freshness }}%</div>
        <div class="fx-metric-label">窗口内新鲜度</div>
      </div>
    </div>

    <!-- 结果区 -->
    <div v-if="generating" class="fx-loading">
      <el-icon class="is-loading"><Loading /></el-icon> 正在基于实时新闻提炼热点…
    </div>
    <div v-else-if="results.length" class="fx-grid">
      <div v-for="(h, i) in results" :key="i" class="fx-card">
        <div class="fx-card-head">
          <span class="fx-rank">TOP {{ h.rank || i + 1 }}</span>
          <span class="fx-cat">{{ NEWS_CATEGORIES.find((c) => c.key === selectedCat)?.label }}</span>
        </div>
        <div class="fx-card-title">{{ h.title }}</div>
        <div class="fx-card-summary">{{ h.summary || '（AI 未提供摘要）' }}</div>
        <div class="fx-bar">
          <div class="fx-bar-fill" :style="{ width: heat(i) + '%' }"></div>
        </div>
        <div class="fx-card-meta">
          <span class="fx-src">来源：{{ h.source || '—' }}</span>
          <span class="fx-time">{{ h.pubDate || '—' }}</span>
        </div>
      </div>
    </div>
    <div v-else-if="triedOnce" class="fx-empty">
      <el-empty description="本次未提炼出结果：可能该领域近窗口内新闻较少，或 AI 认为素材不足以回答你的提取要求。可放宽时间窗口或调整提取要求后重试。" :image-size="64" />
    </div>

    <!-- 返回入口 -->
    <div class="fx-back">
      <router-link to="/news" class="fx-back-link">← 返回新闻聚合</router-link>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { MagicStick, Loading } from '@element-plus/icons-vue'
import {
  NEWS_CATEGORIES,
  findCategory,
  fetchNewsAll
} from '../services/newsService'
import {
  loadAiConfig,
  extractHotspotsFromNews,
  type AiConfig,
  type NewsSeed,
  type HotspotResult
} from '../services/aiService'
import { refreshSavedUser } from '../services/appDataService'

const router = useRouter()
const selectedCat = ref('tech')
const windowKey = ref('48h')
const instruction = ref('')
const generating = ref(false)
const triedOnce = ref(false)
const results = ref<HotspotResult[]>([])
const sampleCount = ref(0)
const freshCount = ref(0)
const totalCount = ref(0)
const nowLabel = ref('')
const userId = ref('')
const aiConfig = ref<AiConfig | null>(null)

const WINDOWS: Record<string, { ms: number; label: string }> = {
  '24h': { ms: 24 * 3600_000, label: '最近 24 小时' },
  '48h': { ms: 48 * 3600_000, label: '最近 48 小时' },
  '7d': { ms: 7 * 86_400_000, label: '最近 7 天' }
}
const windowLabel = computed(() => WINDOWS[windowKey.value]?.label || '最近 48 小时')
const freshness = computed(() =>
  totalCount.value ? Math.round((freshCount.value / totalCount.value) * 100) : 0
)

const aiModelLabel = computed(() => {
  const c = aiConfig.value
  if (!c) return '未配置'
  return `${c.provider} · ${c.model}`
})

function heat(i: number): number {
  const n = results.value.length || 1
  return Math.round(((n - i) / n) * 100)
}

function refreshNow() {
  const d = new Date()
  const pad = (x: number) => String(x).padStart(2, '0')
  nowLabel.value = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

async function loadUser() {
  if (userId.value) return
  try {
    const u = await refreshSavedUser()
    userId.value = u?.id || ''
  } catch {
    userId.value = ''
  }
}

async function generate() {
  if (!instruction.value.trim()) {
    ElMessage.warning('请先填写你想从新闻中提取的信息')
    return
  }
  generating.value = true
  triedOnce.value = true
  results.value = []
  refreshNow()
  try {
    await loadUser()
    if (!aiConfig.value) aiConfig.value = await loadAiConfig(userId.value || undefined)
    if (!aiConfig.value?.model) {
      ElMessage.warning('尚未配置 AI 模型，请先到「AI 助手」配置')
      router.push('/ai')
      return
    }

    // 1) 拉实时新闻
    const all = await fetchNewsAll({ category: selectedCat.value })
    totalCount.value = all.length
    // 2) 时间窗口过滤（解决旧闻/2023 年问题）
    const cutoff = Date.now() - WINDOWS[windowKey.value].ms
    const fresh = all.filter((n) => n.pubTimestamp >= cutoff)
    freshCount.value = fresh.length
    sampleCount.value = fresh.length
    if (!fresh.length) {
      ElMessage.warning(`${windowLabel.value}内该领域暂无新闻，请放宽时间窗口或切换领域`)
      return
    }

    // 3) 交给 AI 提炼
    const seeds: NewsSeed[] = fresh.map((n) => ({
      title: n.title,
      source: n.source,
      pubDate: n.pubDate
    }))
    const out = await extractHotspotsFromNews(aiConfig.value, seeds, instruction.value, 8)
    results.value = out.sort((a, b) => (a.rank || 99) - (b.rank || 99))
    if (!out.length) {
      ElMessage.info('AI 认为当前素材不足以回答该提取要求，请调整描述或放宽窗口')
    }
  } catch (e) {
    ElMessage.error('生成失败：' + (e instanceof Error ? e.message : String(e)))
  } finally {
    generating.value = false
  }
}

onMounted(async () => {
  refreshNow()
  try {
    const u = await refreshSavedUser()
    userId.value = u?.id || ''
    aiConfig.value = await loadAiConfig(userId.value || undefined)
  } catch {
    /* ignore */
  }
})
</script>

<style scoped>
.fx-page {
  padding: 20px;
  max-width: 1080px;
  margin: 0 auto;
  color: var(--text);
  min-height: 100%;
  background: linear-gradient(160deg, #faf5ff 0%, #f5f7ff 100%);
}
.fx-hero {
  display: flex;
  align-items: center;
  gap: 16px;
  background: linear-gradient(135deg, #7c3aed 0%, #ec4899 100%);
  border-radius: 18px;
  padding: 20px 24px;
  box-shadow: 0 10px 30px rgba(124, 58, 237, 0.22);
  color: #fff;
}
.fx-hero-left { flex: 1; }
.fx-title { margin: 0; font-size: 28px; font-weight: 800; letter-spacing: 1px; }
.fx-spark { font-size: 22px; }
.fx-sub { margin: 6px 0 4px; font-size: 13px; color: #f5d0fe; }
.fx-meta { margin: 0; font-size: 12px; color: #f3e8ff; }
.fx-hero-badge {
  width: 56px; height: 56px; border-radius: 16px;
  background: rgba(255, 255, 255, 0.18);
  display: flex; align-items: center; justify-content: center; font-size: 26px;
}

.fx-control {
  margin-top: 16px;
  background: #fff;
  border: 1px solid #ede9fe;
  border-radius: 16px;
  padding: 16px;
  box-shadow: 0 6px 20px rgba(124, 58, 237, 0.06);
}
.fx-row { display: flex; align-items: flex-end; gap: 14px; flex-wrap: wrap; }
.fx-field { display: flex; flex-direction: column; gap: 5px; }
.fx-field label { font-size: 12px; color: #64748b; font-weight: 600; }
.fx-sel { width: 200px; }
.fx-field-full { margin-top: 14px; }
.fx-gen {
  background: linear-gradient(135deg, #7c3aed, #a855f7);
  border: none; font-weight: 700; height: 36px; padding: 0 22px;
}
.fx-note { font-size: 12px; color: #94a3b8; margin-top: 12px; line-height: 1.6; }
.fx-note b { color: #6d28d9; }

.fx-metrics { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; margin-top: 16px; }
.fx-metric {
  background: #fff;
  border: 1px solid #ede9fe;
  border-radius: 14px;
  padding: 14px 16px;
  display: flex; align-items: center; gap: 12px;
  box-shadow: 0 4px 14px rgba(124, 58, 237, 0.05);
}
.fx-metric-ico {
  width: 38px; height: 38px; border-radius: 10px;
  background: #f5f3ff; display: flex; align-items: center; justify-content: center; font-size: 18px;
}
.fx-metric-num { font-size: 24px; font-weight: 800; color: #7c3aed; line-height: 1; }
.fx-metric-label { font-size: 12px; color: #64748b; }

.fx-loading {
  display: flex; align-items: center; gap: 8px; justify-content: center;
  padding: 40px 0; color: #7c3aed; font-size: 14px;
}
.is-loading { animation: rotating 1.2s linear infinite; }
@keyframes rotating { to { transform: rotate(360deg); } }

.fx-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 14px;
  margin-top: 16px;
}
.fx-card {
  background: #fff;
  border: 1px solid #ede9fe;
  border-radius: 14px;
  padding: 14px 16px;
  box-shadow: 0 4px 14px rgba(124, 58, 237, 0.05);
  transition: transform 0.2s ease, box-shadow 0.2s ease;
  display: flex; flex-direction: column; gap: 8px;
}
.fx-card:hover { transform: translateY(-3px); box-shadow: 0 12px 28px rgba(124, 58, 237, 0.14); }
.fx-card-head { display: flex; align-items: center; gap: 8px; }
.fx-rank {
  font-size: 11px; font-weight: 800; color: #fff;
  background: linear-gradient(135deg, #7c3aed, #d946ef);
  padding: 3px 9px; border-radius: 8px; letter-spacing: 0.3px;
}
.fx-cat {
  font-size: 11px; color: #a855f7;
  background: #faf5ff; padding: 2px 8px; border-radius: 999px;
}
.fx-card-title { font-size: 16px; font-weight: 700; color: #1e293b; line-height: 1.5; }
.fx-card-summary { font-size: 13px; color: #475569; line-height: 1.6; }
.fx-bar { height: 6px; border-radius: 3px; background: #f3e8ff; overflow: hidden; }
.fx-bar-fill { height: 100%; border-radius: 3px; background: linear-gradient(90deg, #8b5cf6, #ec4899); }
.fx-card-meta { display: flex; justify-content: space-between; font-size: 11px; color: #94a3b8; }
.fx-src { color: #6d28d9; }

.fx-empty { padding: 30px 0; }
.fx-back { margin-top: 18px; text-align: center; }
.fx-back-link { font-size: 13px; color: #7c3aed; text-decoration: none; }
.fx-back-link:hover { text-decoration: underline; }

@media (max-width: 768px) {
  .fx-metrics { grid-template-columns: 1fr; }
  .fx-grid { grid-template-columns: 1fr; }
}
</style>
