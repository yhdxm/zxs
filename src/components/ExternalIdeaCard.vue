<template>
  <div class="idea-card" :class="{ bookmarked: idea.bookmarked }">
    <div class="idea-top">
      <span class="idea-source">{{ idea.source }}</span>
      <div class="idea-actions">
        <button class="idea-btn" :class="{ active: idea.bookmarked }" type="button" @click="$emit('toggle-bookmark', idea)">
          <el-icon><Star :filled="idea.bookmarked" /></el-icon>
        </button>
      </div>
    </div>

    <a class="idea-title" :href="idea.url" target="_blank" rel="noopener">{{ idea.title }}</a>

    <p v-if="idea.summary" class="idea-summary">{{ idea.summary }}</p>

    <div class="idea-tags">
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
import { Star } from '@element-plus/icons-vue'
import type { ExternalIdea, RelatedModule } from '../services/externalIdeas'

defineProps<{ idea: ExternalIdea }>()
defineEmits<{
  (e: 'toggle-bookmark', idea: ExternalIdea): void
  (e: 'set-related', idea: ExternalIdea, mod: RelatedModule): void
}>()

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

.idea-tags { display: flex; flex-wrap: wrap; gap: 6px; }
.idea-tag {
  font-size: 11px; color: var(--primary, #6366f1);
  background: rgba(99, 102, 241, 0.08); padding: 1px 8px; border-radius: 999px;
}

.idea-foot { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-top: 2px; }
.idea-relate { width: 120px; }
.idea-time { font-size: 11px; color: var(--text-faint, #94a3b8); flex-shrink: 0; }
</style>
