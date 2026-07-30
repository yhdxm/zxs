<template>
  <div class="ext-ideas">
    <div class="ei-header">
      <div>
        <h2>外部灵感聚合</h2>
        <p>免费并发聚合 Hacker News / Dev.to / Reddit / Product Hunt 等公开源，帮助你捕捉需求与产品灵感（数据仅存浏览器本地 + 云端，不消耗任何积分）</p>
      </div>
      <el-button type="primary" :loading="fetching" @click="refresh">
        <el-icon><Refresh /></el-icon> 免费查询 / 刷新
      </el-button>
    </div>

    <div class="ei-toolbar">
      <el-input
        v-model="searchText"
        class="ei-search"
        placeholder="搜索标题 / 摘要 / 标签…"
        clearable
        @keyup.enter="applyFilters"
      >
        <template #prepend><el-icon><Search /></el-icon></template>
      </el-input>

      <el-select v-model="sourceFilter" class="ei-source" placeholder="全部来源" clearable>
        <el-option label="全部来源" value="" />
        <el-option v-for="s in sources" :key="s" :label="s" :value="s" />
      </el-select>

      <el-select v-model="tagFilter" class="ei-tag" placeholder="全部标签" clearable>
        <el-option label="全部标签" value="" />
        <el-option v-for="t in allTags" :key="t" :label="t" :value="t" />
      </el-select>

      <el-tooltip content="只看已收藏" placement="top">
        <el-button
          :type="onlyBookmarked ? 'warning' : 'default'"
          :plain="!onlyBookmarked"
          circle
          @click="onlyBookmarked = !onlyBookmarked"
        >
          <el-icon><Star :filled="onlyBookmarked" /></el-icon>
        </el-button>
      </el-tooltip>
    </div>

    <div class="ei-stats">
      <span>共 {{ filteredIdeas.length }} 条</span>
      <span v-if="bookmarkedCount" class="ei-stat-star">★ 已收藏 {{ bookmarkedCount }} 条</span>
      <span v-if="associatedCount" class="ei-stat-rel">已关联模块 {{ associatedCount }} 条</span>
    </div>

    <div v-if="loading && !ideas.length" class="ei-loading">
      <el-icon class="is-loading"><Loading /></el-icon> 正在加载已缓存的灵感…
    </div>

    <div v-else-if="!filteredIdeas.length" class="ei-empty">
      <el-empty :description="ideas.length ? '没有符合筛选条件的灵感' : '还没有灵感数据，点击右上角「免费查询 / 刷新」获取'" :image-size="64" />
    </div>

    <div v-else class="ei-grid">
      <ExternalIdeaCard
        v-for="idea in filteredIdeas"
        :key="idea.id"
        :idea="idea"
        @toggle-bookmark="onToggleBookmark"
        @set-related="onSetRelated"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { Refresh, Search, Star, Loading } from '@element-plus/icons-vue'
import {
  fetchExternalIdeas,
  loadExternalIdeas,
  saveExternalIdeas,
  toggleBookmark,
  setRelatedModule,
  type ExternalIdea,
  type RelatedModule
} from '../services/externalIdeas'
import { refreshSavedUser } from '../services/appDataService'

const ideas = ref<ExternalIdea[]>([])
const loading = ref(false)
const fetching = ref(false)

const searchText = ref('')
const sourceFilter = ref('')
const tagFilter = ref('')
const onlyBookmarked = ref(false)

const userId = ref('')

const sources = computed(() => Array.from(new Set(ideas.value.map((i) => i.source))).sort())
const allTags = computed(() => Array.from(new Set(ideas.value.flatMap((i) => i.tags || []))).sort())
const bookmarkedCount = computed(() => ideas.value.filter((i) => i.bookmarked).length)
const associatedCount = computed(() => ideas.value.filter((i) => i.related_module).length)

const filteredIdeas = computed<ExternalIdea[]>(() => {
  const kw = searchText.value.trim().toLowerCase()
  return ideas.value.filter((it) => {
    if (sourceFilter.value && it.source !== sourceFilter.value) return false
    if (tagFilter.value && !(it.tags || []).includes(tagFilter.value)) return false
    if (onlyBookmarked.value && !it.bookmarked) return false
    if (kw) {
      const hay = `${it.title} ${it.summary} ${(it.tags || []).join(' ')}`.toLowerCase()
      if (!hay.includes(kw)) return false
    }
    return true
  })
})

function applyFilters() {
  /* 筛选为 computed 实时生效，这里仅用于搜索框回车时的占位（避免控制台警告） */
}

async function loadUser() {
  if (!userId.value) {
    const u = await refreshSavedUser()
    userId.value = u?.id || ''
  }
}

async function load() {
  loading.value = true
  try {
    await loadUser()
    ideas.value = await loadExternalIdeas(userId.value)
  } finally {
    loading.value = false
  }
}

async function refresh() {
  fetching.value = true
  try {
    await loadUser()
    const fetched = await fetchExternalIdeas()
    if (fetched.length === 0) {
      ElMessage.warning('本次未获取到任何外部灵感（可能网络受限或所有来源超时），请稍后重试')
    } else {
      // 与本地已收藏 / 已关联的灵感合并，避免刷新后丢失用户标记
      const prevMap = new Map(ideas.value.map((i) => [i.url || i.title, i]))
      const merged = fetched.map((f) => {
        const prev = prevMap.get(f.url || f.title)
        if (prev) {
          return { ...f, id: prev.id, bookmarked: prev.bookmarked, related_module: prev.related_module }
        }
        return f
      })
      ideas.value = merged
      await saveExternalIdeas(userId.value, merged)
      ElMessage.success(`已聚合 ${merged.length} 条外部灵感`)
    }
  } catch (e) {
    ElMessage.error('查询失败：' + (e instanceof Error ? e.message : String(e)))
  } finally {
    fetching.value = false
  }
}

function onToggleBookmark(idea: ExternalIdea) {
  const next = !idea.bookmarked
  idea.bookmarked = next
  toggleBookmark(userId.value, idea.id, next)
}

function onSetRelated(idea: ExternalIdea, mod: RelatedModule) {
  idea.related_module = mod
  setRelatedModule(userId.value, idea.id, mod)
  if (mod) {
    const label = mod === 'todo' ? '待办' : mod === 'point' ? '点位' : '内容'
    ElMessage.success(`已关联到「${label}」模块`)
  }
}

onMounted(load)
</script>

<style scoped>
.ext-ideas {
  padding: 24px;
  max-width: 1200px;
  margin: 0 auto;
  color: var(--text);
}
.ei-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 18px;
}
.ei-header h2 { margin: 0 0 6px; font-size: 22px; color: var(--text-strong); }
.ei-header p { margin: 0; font-size: 13px; color: var(--text-muted); max-width: 760px; line-height: 1.6; }

.ei-toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: center;
  margin-bottom: 12px;
}
.ei-search { flex: 1; min-width: 220px; max-width: 360px; }
.ei-source { width: 160px; }
.ei-tag { width: 150px; }

.ei-stats {
  display: flex;
  gap: 16px;
  font-size: 12px;
  color: var(--text-faint);
  margin-bottom: 16px;
  flex-wrap: wrap;
}
.ei-stat-star { color: #f59e0b; }
.ei-stat-rel { color: var(--primary); }

.ei-loading {
  display: flex; align-items: center; gap: 8px; color: var(--text-muted);
  padding: 40px 0; justify-content: center; font-size: 14px;
}
.is-loading { animation: rotating 1.2s linear infinite; }
@keyframes rotating { to { transform: rotate(360deg); } }

.ei-empty { padding: 30px 0; }

.ei-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 14px;
}

@media (max-width: 768px) {
  .ext-ideas { padding: 16px; }
  .ei-header { flex-direction: column; }
  .ei-header .el-button { width: 100%; }
  .ei-search { max-width: 100%; }
  .ei-source, .ei-tag { flex: 1; width: auto; }
}
</style>
