<template>
  <div class="idea-card" :class="{ bookmarked: idea.bookmarked }">
    <div class="idea-top">
      <span class="idea-source">{{ idea.source }}</span>
      <div class="idea-actions">
        <button class="idea-btn" :class="{ active: idea.bookmarked }" type="button" @click="$emit('toggle-bookmark', idea)">
          <el-icon><Star :filled="idea.bookmarked" /></el-icon>
        </button>
        <button class="idea-btn idea-del" type="button" title="删除" @click="$emit('delete', idea)">
          <el-icon><Delete /></el-icon>
        </button>
      </div>
    </div>

    <a class="idea-title" :href="idea.url" target="_blank" rel="noopener">{{ idea.title }}</a>

    <p v-if="idea.summary" class="idea-summary">{{ idea.summary }}</p>

    <p v-if="idea.cnMeaning" class="idea-cn">{{ idea.cnMeaning }}</p>

    <div class="idea-tags">
      <span v-if="idea.region" class="idea-tag idea-region" :class="regionClassOf(idea.region)">{{ idea.region }}</span>
      <span v-if="idea.industry" class="idea-tag idea-industry">{{ idea.industry }}</span>
      <span v-for="(t, i) in idea.tags" :key="i" class="idea-tag">{{ t }}</span>
    </div>

    <div class="idea-foot">
      <el-select
        :model-value="idea.related_module"
        size="small"
        class="idea-relate"
        placeholder="关联模块"
        @change="(v: RelatedModule) => $emit('set-related', idea, v)"
      >
        <el-option label="不关联" :value="null" />
        <el-option label="待办" value="todo" />
        <el-option label="点位" value="point" />
        <el-option label="内容" value="content" />
      </el-select>
      <span class="idea-time">{{ fmtTime(idea.fetched_at) }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Star, Delete } from '@element-plus/icons-vue'
import type { ExternalIdea, RelatedModule } from '../services/externalIdeas'

defineProps<{ idea: ExternalIdea }>()
defineEmits<{
  (e: 'toggle-bookmark', idea: ExternalIdea): void
  (e: 'set-related', idea: ExternalIdea, mod: RelatedModule): void
  (e: 'delete', idea: ExternalIdea): void
}>()

const regionClassMap: Record<string, string> = {
  国内: 'domestic',
  国外: 'overseas',
  通用: 'common'
}
function regionClassOf(region?: string): string {
  return (region && regionClassMap[region]) || 'common'
}

function fmtTime(iso: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}
</script>

<style scoped>
.idea-card {
  display: flex;
  flex-direction: column;
  gap: 8px;
  background: var(--surface, #fff);
  border: 1px solid var(--border, #eef0f4);
  border-radius: 14px;
  padding: 14px 16px;
  box-shadow: var(--shadow-card, 0 6px 18px rgba(15, 23, 42, 0.04));
  transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease;
}
.idea-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 12px 28px rgba(15, 23, 42, 0.1);
  border-color: rgba(99, 102, 241, 0.18);
}
.idea-card.bookmarked { border-color: rgba(245, 158, 11, 0.4); }

.idea-top { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.idea-source {
  font-size: 11px; color: var(--text-faint, #94a3b8);
  background: var(--surface-soft, #f8fafc); padding: 2px 8px; border-radius: 6px;
}
.idea-actions { display: flex; gap: 4px; }
.idea-btn {
  display: inline-flex; align-items: center; justify-content: center;
  width: 28px; height: 28px; border-radius: 8px; border: none; cursor: pointer;
  background: transparent; color: var(--text-faint, #94a3b8); transition: color 0.2s;
}
.idea-btn:hover { color: #f59e0b; }
.idea-btn.active { color: #f59e0b; }
.idea-btn.idea-del:hover { color: #ef4444; }

.idea-title {
  font-size: 14px; font-weight: 600; color: var(--text-strong, #0f172a);
  text-decoration: none; line-height: 1.5; word-break: break-word;
}
.idea-title:hover { color: var(--primary, #6366f1); text-decoration: underline; }

.idea-summary {
  margin: 0; font-size: 12px; color: var(--text-muted, #64748b);
  line-height: 1.6; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical;
  overflow: hidden;
}

.idea-cn {
  margin: 0; font-size: 12.5px; color: var(--text, #334155);
  line-height: 1.7; background: var(--surface-soft, #f8fafc);
  border-left: 3px solid rgba(99, 102, 241, 0.45);
  border-radius: 0 8px 8px 0; padding: 7px 10px;
}

.idea-tags { display: flex; flex-wrap: wrap; gap: 6px; }
.idea-tag {
  font-size: 11px; color: var(--primary, #6366f1);
  background: rgba(99, 102, 241, 0.08); padding: 1px 8px; border-radius: 999px;
}
.idea-region { font-weight: 600; }
.idea-region.domestic { color: #15803d; background: rgba(34, 197, 94, 0.12); }
.idea-region.overseas { color: #1d4ed8; background: rgba(59, 130, 246, 0.12); }
.idea-region.common { color: var(--text-faint, #94a3b8); background: rgba(148, 163, 184, 0.14); }
.idea-industry { color: #b45309; background: rgba(245, 158, 11, 0.12); }

.idea-foot { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-top: 2px; }
.idea-relate { width: 120px; }
.idea-time { font-size: 11px; color: var(--text-faint, #94a3b8); flex-shrink: 0; }
</style>
