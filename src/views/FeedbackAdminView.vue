<template>
  <div class="fa-page">
    <PageHeader
      title="反馈管理"
      subtitle="超级管理员专用：查看全部账号提交的意见反馈，回复、流转状态并导出。关闭原因与内部备注仅管理端可见。"
      :icon="ChatLineSquare"
    />

    <div v-if="!isAdmin" class="fa-denied">
      <el-icon><Lock /></el-icon>
      <h3>无权访问</h3>
      <p>反馈管理仅超级管理员可用，请使用超管账号登录。</p>
    </div>

    <template v-else>
      <!-- ===== 统计看板 ===== -->
      <div class="fa-stats">
        <div v-for="s in statCards" :key="s.key" class="fa-stat" :style="{ '--fa-c': s.color }">
          <span class="fa-stat-label">{{ s.label }}</span>
          <span class="fa-stat-value">{{ s.value }}</span>
          <span class="fa-stat-sub">{{ s.sub }}</span>
        </div>
      </div>

      <!-- ===== 分类分布 ===== -->
      <div class="fa-cats">
        <div v-for="c in catCards" :key="c.key" class="fa-cat" :style="{ '--fa-c': c.color }">
          <span class="fa-cat-dot"></span>
          <span class="fa-cat-label">{{ c.label }}</span>
          <b>{{ c.value }}</b>
        </div>
      </div>

      <div class="fa-body">
        <!-- ===== 左：筛选 + 列表 ===== -->
        <section class="fa-card fa-list-card" :class="{ 'mobile-hidden': isNarrow && !!selected }">
          <div class="fa-card-head">
            <div class="fa-card-icon" style="--fa-c: #4f46e5"><el-icon><Tickets /></el-icon></div>
            <div>
              <h3>反馈列表</h3>
              <p>共 {{ list.length }} 条{{ selectedIds.length ? `，已选 ${selectedIds.length} 条` : '' }}</p>
            </div>
            <el-button size="small" :loading="loading" @click="load">
              <el-icon><Refresh /></el-icon> 刷新
            </el-button>
          </div>

          <div class="fa-filters">
            <el-select v-model="filter.status" size="small" placeholder="状态">
              <el-option label="全部状态" value="all" />
              <el-option v-for="(l, k) in STATUS_LABELS" :key="k" :label="l" :value="k" />
            </el-select>
            <el-select v-model="filter.category" size="small" placeholder="分类">
              <el-option label="全部分类" value="all" />
              <el-option v-for="(l, k) in CATEGORY_LABELS" :key="k" :label="l" :value="k" />
            </el-select>
            <el-select v-model="filter.priority" size="small" placeholder="优先级">
              <el-option label="全部优先级" value="all" />
              <el-option v-for="(l, k) in PRIORITY_LABELS" :key="k" :label="l" :value="k" />
            </el-select>
            <el-input
              v-model="filter.keyword"
              size="small"
              placeholder="单号 / 标题 / 提交人"
              clearable
              class="fa-search"
            >
              <template #prefix><el-icon><Search /></el-icon></template>
            </el-input>
          </div>

          <div class="fa-batch">
            <el-checkbox
              :model-value="allChecked"
              :indeterminate="someChecked"
              @change="toggleAll"
            >全选</el-checkbox>
            <div class="fa-batch-actions">
              <el-button size="small" :disabled="!selectedIds.length" @click="batchSet('processing')">
                批量处理中
              </el-button>
              <el-button size="small" type="success" :disabled="!selectedIds.length" @click="batchSet('closed')">
                批量关闭
              </el-button>
              <el-button size="small" type="primary" plain @click="doExport">
                <el-icon><Download /></el-icon> 导出 CSV
              </el-button>
            </div>
          </div>

          <div v-loading="loading" class="fa-list">
            <article
              v-for="f in list"
              :key="f.id"
              class="fa-item"
              :class="[`st-${f.status}`, { active: selected?.id === f.id }]"
              @click="select(f)"
            >
              <el-checkbox
                :model-value="selectedIds.includes(f.id)"
                class="fa-item-check"
                @click.stop
                @change="(v: boolean) => toggleOne(f.id, v)"
              />
              <div class="fa-item-main">
                <div class="fa-item-title">
                  <span class="fa-badge" :class="`st-${f.status}`">{{ STATUS_LABELS[f.status] }}</span>
                  <h4>{{ f.title }}</h4>
                  <span v-if="f.admin_unread" class="fa-new-dot" title="未读"></span>
                </div>
                <p class="fa-item-summary">{{ f.content }}</p>
                <div class="fa-item-meta">
                  <span>#{{ f.id.slice(0, 8) }}</span>
                  <span>{{ f.anonymous ? '匿名用户' : (f.nickname || f.username) }}</span>
                  <span>{{ CATEGORY_LABELS[f.category] }}</span>
                  <span :class="`pr-${f.priority}`">{{ PRIORITY_LABELS[f.priority] }}</span>
                  <span>{{ fmtTime(f.created_at) }}</span>
                </div>
              </div>
            </article>

            <div v-if="!loading && list.length === 0" class="fa-empty">
              <el-icon><Tickets /></el-icon>
              <p>没有符合条件的反馈</p>
            </div>
          </div>
        </section>

        <!-- ===== 右：详情工作台 ===== -->
        <section class="fa-card fa-detail-card" :class="{ 'mobile-hidden': isNarrow && !selected }">
          <div v-if="!selected" class="fa-detail-empty">
            <el-icon><Document /></el-icon>
            <p>从左侧列表选择一条反馈开始处理</p>
          </div>

          <template v-else>
            <div class="fa-card-head">
              <el-button v-if="isNarrow" size="small" text @click="selected = null">
                <el-icon><ArrowLeft /></el-icon> 返回列表
              </el-button>
              <div class="fa-detail-title">
                <h3>{{ selected.title }}</h3>
                <p>#{{ selected.id.slice(0, 8) }} · {{ fmtTime(selected.created_at) }}</p>
              </div>
              <el-button size="small" type="danger" plain :loading="deleting" @click="removeItem">
                <el-icon><Delete /></el-icon> 删除
              </el-button>
            </div>

            <div class="fa-detail-body">
              <!-- 状态流转 -->
              <div class="fa-steps">
                <button
                  v-for="(st, i) in STATUS_FLOW"
                  :key="st"
                  type="button"
                  class="fa-step"
                  :class="{
                    active: selected.status === st,
                    done: STATUS_FLOW.indexOf(selected.status) > i
                  }"
                  :disabled="updating"
                  @click="changeStatus(st)"
                >
                  <span class="fa-step-idx">{{ i + 1 }}</span>
                  {{ STATUS_LABELS[st] }}
                </button>
              </div>

              <!-- 信息卡 -->
              <div class="fa-info">
                <div class="fa-info-cell">
                  <span>提交人</span>
                  <b>{{ selected.anonymous ? '匿名用户' : (selected.nickname || selected.username || '—') }}</b>
                </div>
                <div class="fa-info-cell">
                  <span>分类</span><b>{{ CATEGORY_LABELS[selected.category] }}</b>
                </div>
                <div class="fa-info-cell">
                  <span>优先级</span>
                  <b :class="`pr-${selected.priority}`">{{ PRIORITY_LABELS[selected.priority] }}</b>
                </div>
                <div class="fa-info-cell">
                  <span>联系方式</span>
                  <b>{{ selected.anonymous ? '已匿名' : (selected.contact || '未填写') }}</b>
                </div>
              </div>

              <!-- 正文 -->
              <div class="fa-block">
                <h5>反馈内容</h5>
                <p class="fa-content">{{ selected.content }}</p>
                <div v-if="selected.attachments.length" class="fa-atts">
                  <img
                    v-for="(a, i) in selected.attachments"
                    :key="i"
                    :src="a.dataUrl"
                    :alt="a.name"
                    @click="previewImage(a.dataUrl)"
                  />
                </div>
              </div>

              <!-- 关闭原因（仅管理端可见） -->
              <div v-if="selected.status === 'closed' && selected.close_reason" class="fa-close-reason">
                <el-icon><Lock /></el-icon>
                <div>
                  <strong>关闭原因（仅管理端可见）</strong>
                  <p>{{ selected.close_reason }}</p>
                </div>
              </div>

              <!-- 处理时间线 -->
              <div class="fa-block">
                <h5>处理记录（{{ replies.length }}）</h5>
                <div v-loading="repliesLoading" class="fa-timeline">
                  <div v-if="!replies.length && !repliesLoading" class="fa-timeline-empty">暂无处理记录</div>
                  <div
                    v-for="r in replies"
                    :key="r.id"
                    class="fa-reply"
                    :class="{ internal: r.internal, admin: r.author_role === 'superadmin' }"
                  >
                    <div class="fa-reply-head">
                      <strong>
                        {{ r.author_role === 'superadmin' ? '超级管理员' : r.author_name }}
                        <span v-if="r.internal" class="fa-internal-tag">
                          <el-icon><Lock /></el-icon> 内部备注 · 用户不可见
                        </span>
                      </strong>
                      <span>{{ fmtTime(r.created_at) }}</span>
                    </div>
                    <p>{{ r.content }}</p>
                  </div>
                </div>
              </div>

              <!-- 回复框 -->
              <div class="fa-block fa-reply-box">
                <div class="fa-reply-tabs">
                  <button
                    type="button"
                    :class="{ active: !replyInternal }"
                    @click="replyInternal = false"
                  >公开回复</button>
                  <button
                    type="button"
                    :class="{ active: replyInternal }"
                    @click="replyInternal = true"
                  >内部备注</button>
                </div>
                <div class="fa-quick">
                  <button v-for="q in QUICK_REPLIES" :key="q" type="button" @click="replyText = q">
                    {{ q }}
                  </button>
                </div>
                <el-input
                  v-model="replyText"
                  type="textarea"
                  :rows="4"
                  maxlength="1000"
                  show-word-limit
                  :placeholder="replyInternal ? '内部备注仅管理端可见，用户看不到' : '回复内容将展示给提交人'"
                />
                <div class="fa-reply-actions">
                  <span class="fa-reply-hint">
                    {{ replyInternal ? '当前为内部备注，不会通知用户' : '发送后状态自动流转为「已回复」' }}
                  </span>
                  <el-button type="primary" :loading="replying" @click="doReply">
                    <el-icon><Promotion /></el-icon> 发送
                  </el-button>
                </div>
              </div>
            </div>
          </template>
        </section>
      </div>
    </template>

    <el-dialog v-model="previewVisible" width="min(760px, 92vw)" align-center>
      <img :src="previewUrl" class="fa-preview-img" alt="附件预览" />
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, onBeforeUnmount, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  ChatLineSquare, Tickets, Refresh, Search, Download, Delete,
  Document, Lock, Promotion, ArrowLeft
} from '@element-plus/icons-vue'
import PageHeader from '../components/PageHeader.vue'
import {
  isFeedbackAdmin,
  listAllFeedbacks,
  listRepliesForAdmin,
  replyFeedback,
  updateFeedbackStatus,
  batchUpdateStatus,
  adminDeleteFeedback,
  markAdminRead,
  computeStats,
  exportFeedbackCsv,
  CATEGORY_LABELS,
  PRIORITY_LABELS,
  STATUS_LABELS,
  type FeedbackItem,
  type FeedbackReply,
  type FeedbackStatus,
  type FeedbackCategory,
  type FeedbackPriority
} from '../services/feedbackService'

const STATUS_FLOW: FeedbackStatus[] = ['pending', 'processing', 'replied', 'closed']
const QUICK_REPLIES = ['已收到，正在处理中', '问题已修复，请刷新后重试', '已纳入后续迭代计划', '感谢反馈，该功能已上线']

const isAdmin = ref(true)
const loading = ref(false)
const repliesLoading = ref(false)
const replying = ref(false)
const updating = ref(false)
const deleting = ref(false)

const list = ref<FeedbackItem[]>([])
const replies = ref<FeedbackReply[]>([])
const selected = ref<FeedbackItem | null>(null)
const selectedIds = ref<string[]>([])
const replyText = ref('')
const replyInternal = ref(false)

const previewVisible = ref(false)
const previewUrl = ref('')
const isNarrow = ref(false)

const filter = reactive({
  status: 'all' as 'all' | FeedbackStatus,
  category: 'all' as 'all' | FeedbackCategory,
  priority: 'all' as 'all' | FeedbackPriority,
  keyword: ''
})

const stats = computed(() => computeStats(list.value))

const statCards = computed(() => {
  const s = stats.value
  return [
    { key: 'today', label: '今日新增', value: s.todayNew, sub: `累计 ${s.total} 条`, color: '#4f46e5' },
    { key: 'pending', label: '待处理', value: s.pending, sub: '需尽快跟进', color: '#dc2626' },
    { key: 'processing', label: '处理中', value: s.processing, sub: '正在跟进', color: '#d97706' },
    { key: 'replied', label: '已回复', value: s.replied, sub: '等待用户确认', color: '#0891b2' },
    {
      key: 'avg',
      label: '平均响应',
      value: s.avgResponseHours == null ? '—' : `${s.avgResponseHours.toFixed(1)}h`,
      sub: '首次回复时长',
      color: '#16a34a'
    }
  ]
})

const catCards = computed(() => {
  const b = stats.value.byCategory
  return [
    { key: 'suggestion', label: CATEGORY_LABELS.suggestion, value: b.suggestion, color: '#16a34a' },
    { key: 'bug', label: CATEGORY_LABELS.bug, value: b.bug, color: '#0891b2' },
    { key: 'complaint', label: CATEGORY_LABELS.complaint, value: b.complaint, color: '#dc2626' },
    { key: 'other', label: CATEGORY_LABELS.other, value: b.other, color: '#7c3aed' }
  ]
})

const allChecked = computed(() => list.value.length > 0 && selectedIds.value.length === list.value.length)
const someChecked = computed(() => selectedIds.value.length > 0 && !allChecked.value)

function fmtTime(v: string): string {
  const d = new Date(v)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('zh-CN', { hour12: false }).replace(/:\d{2}$/, '')
}

function previewImage(url: string) {
  previewUrl.value = url
  previewVisible.value = true
}

function updateNarrow() {
  isNarrow.value = window.innerWidth <= 1100
}

async function load() {
  loading.value = true
  try {
    list.value = await listAllFeedbacks(filter)
    selectedIds.value = selectedIds.value.filter((id) => list.value.some((f) => f.id === id))
    if (selected.value) {
      const found = list.value.find((f) => f.id === selected.value?.id)
      selected.value = found || null
    }
  } catch (err) {
    ElMessage.error(err instanceof Error ? err.message : '加载失败')
  } finally {
    loading.value = false
  }
}

async function select(f: FeedbackItem) {
  selected.value = f
  replyText.value = ''
  replyInternal.value = false
  repliesLoading.value = true
  try {
    replies.value = await listRepliesForAdmin(f.id)
    if (f.admin_unread) {
      await markAdminRead(f.id)
      f.admin_unread = false
    }
  } catch (err) {
    replies.value = []
    ElMessage.error(err instanceof Error ? err.message : '加载记录失败')
  } finally {
    repliesLoading.value = false
  }
}

function toggleOne(id: string, checked: boolean) {
  if (checked) {
    if (!selectedIds.value.includes(id)) selectedIds.value.push(id)
  } else {
    selectedIds.value = selectedIds.value.filter((x) => x !== id)
  }
}

function toggleAll(checked: boolean) {
  selectedIds.value = checked ? list.value.map((f) => f.id) : []
}

async function batchSet(status: FeedbackStatus) {
  if (!selectedIds.value.length) return
  try {
    await batchUpdateStatus(selectedIds.value, status)
    ElMessage.success(`已批量标记为「${STATUS_LABELS[status]}」`)
    selectedIds.value = []
    await load()
  } catch (err) {
    ElMessage.error(err instanceof Error ? err.message : '批量操作失败')
  }
}

async function changeStatus(status: FeedbackStatus) {
  if (!selected.value || selected.value.status === status) return
  let reason = ''
  if (status === 'closed') {
    try {
      const r = await ElMessageBox.prompt('请填写关闭原因（仅管理端留档，用户不可见）', '关闭反馈', {
        confirmButtonText: '确认关闭',
        cancelButtonText: '取消',
        inputPlaceholder: '例如：已在 v1.2 版本修复',
        inputValidator: (v: string) => (v && v.trim() ? true : '关闭原因不能为空')
      })
      reason = r.value
    } catch {
      return
    }
  }
  updating.value = true
  try {
    await updateFeedbackStatus(selected.value.id, status, reason)
    ElMessage.success(`已标记为「${STATUS_LABELS[status]}」`)
    await load()
    if (selected.value) await select(selected.value)
  } catch (err) {
    ElMessage.error(err instanceof Error ? err.message : '状态更新失败')
  } finally {
    updating.value = false
  }
}

async function doReply() {
  if (!selected.value) return
  if (!replyText.value.trim()) return ElMessage.warning('请填写回复内容')
  replying.value = true
  try {
    await replyFeedback(selected.value.id, replyText.value, replyInternal.value)
    replyText.value = ''
    ElMessage.success(replyInternal.value ? '内部备注已保存' : '回复已发送')
    await load()
    if (selected.value) await select(selected.value)
  } catch (err) {
    ElMessage.error(err instanceof Error ? err.message : '回复失败')
  } finally {
    replying.value = false
  }
}

async function removeItem() {
  if (!selected.value) return
  try {
    await ElMessageBox.confirm('删除后该反馈及全部回复将不可恢复，确认删除？', '删除反馈', {
      type: 'warning',
      confirmButtonText: '确认删除',
      cancelButtonText: '取消'
    })
  } catch {
    return
  }
  deleting.value = true
  try {
    await adminDeleteFeedback(selected.value.id)
    selected.value = null
    ElMessage.success('已删除')
    await load()
  } catch (err) {
    ElMessage.error(err instanceof Error ? err.message : '删除失败')
  } finally {
    deleting.value = false
  }
}

function doExport() {
  if (!list.value.length) return ElMessage.warning('当前没有可导出的数据')
  exportFeedbackCsv(list.value)
  ElMessage.success(`已导出 ${list.value.length} 条反馈`)
}

let filterTimer: ReturnType<typeof setTimeout> | null = null
watch(
  () => ({ ...filter }),
  () => {
    if (filterTimer) clearTimeout(filterTimer)
    filterTimer = setTimeout(() => void load(), 250)
  },
  { deep: true }
)

onMounted(async () => {
  updateNarrow()
  window.addEventListener('resize', updateNarrow)
  isAdmin.value = await isFeedbackAdmin()
  if (isAdmin.value) await load()
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', updateNarrow)
  if (filterTimer) clearTimeout(filterTimer)
})
</script>

<style scoped>
.fa-page {
  padding: 0 18px 18px;
  max-width: 1500px;
  margin: 0 auto;
  color: var(--text);
}

.fa-denied {
  text-align: center;
  padding: 60px 20px;
  color: var(--text-faint);
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 14px;
}
.fa-denied :deep(svg) { font-size: 40px; margin-bottom: 10px; }
.fa-denied h3 { margin: 0 0 6px; color: var(--text-strong); font-size: 16px; }
.fa-denied p { margin: 0; font-size: 13px; }

/* ===== 统计 ===== */
.fa-stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 12px;
  margin-bottom: 12px;
}
.fa-stat {
  background: var(--surface);
  border: 1px solid var(--border);
  border-top: 3px solid var(--fa-c);
  border-radius: 12px;
  padding: 13px 15px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  box-shadow: var(--shadow-card);
  min-width: 0;
}
.fa-stat-label { font-size: 12px; color: var(--text-muted); }
.fa-stat-value { font-size: 24px; font-weight: 700; color: var(--fa-c); line-height: 1.15; }
.fa-stat-sub { font-size: 11px; color: var(--text-faint); }

.fa-cats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
  gap: 10px;
  margin-bottom: 14px;
}
.fa-cat {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 9px 13px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 10px;
  font-size: 12px;
  color: var(--text-muted);
  min-width: 0;
}
.fa-cat-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--fa-c); flex: none; }
.fa-cat-label { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.fa-cat b { color: var(--fa-c); font-size: 15px; }

/* ===== 布局 ===== */
.fa-body {
  display: grid;
  grid-template-columns: minmax(0, 420px) minmax(0, 1fr);
  gap: 14px;
  align-items: start;
}
.fa-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 14px;
  box-shadow: var(--shadow-card);
  overflow: hidden;
}
.fa-list-card { position: sticky; top: 12px; }
.fa-card-head {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 13px 15px;
  border-bottom: 1px solid var(--border);
  background: var(--surface-soft);
  flex-wrap: wrap;
}
.fa-card-head h3 { margin: 0; font-size: 15px; color: var(--text-strong); }
.fa-card-head p { margin: 2px 0 0; font-size: 12px; color: var(--text-faint); }
.fa-card-head > .el-button:last-child { margin-left: auto; }
.fa-card-icon {
  width: 32px; height: 32px; border-radius: 9px;
  display: grid; place-items: center; flex: none;
  color: #fff; font-size: 16px; background: var(--fa-c);
}
.fa-detail-title { flex: 1; min-width: 0; }
.fa-detail-title h3 {
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}

/* ===== 筛选 ===== */
.fa-filters {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
  padding: 12px 15px 0;
}
.fa-search { grid-column: 1 / -1; }
.fa-batch {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 12px 15px;
  flex-wrap: wrap;
  border-bottom: 1px solid var(--border);
}
.fa-batch-actions { display: flex; gap: 6px; flex-wrap: wrap; }

/* ===== 列表 ===== */
.fa-list { max-height: calc(100vh - 340px); overflow-y: auto; padding: 10px; min-height: 200px; }
.fa-item {
  display: flex;
  gap: 8px;
  padding: 11px 12px;
  border: 1px solid var(--border);
  border-left: 4px solid var(--fa-st, #94a3b8);
  border-radius: 10px;
  margin-bottom: 8px;
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s;
  min-width: 0;
}
.fa-item.st-pending { --fa-st: #dc2626; }
.fa-item.st-processing { --fa-st: #d97706; }
.fa-item.st-replied { --fa-st: #4f46e5; }
.fa-item.st-closed { --fa-st: #16a34a; }
.fa-item:hover { background: var(--surface-soft); }
.fa-item.active {
  border-color: var(--primary);
  background: color-mix(in srgb, var(--primary) 6%, var(--surface));
}
.fa-item-check { flex: none; }
.fa-item-main { flex: 1; min-width: 0; }
.fa-item-title { display: flex; align-items: center; gap: 7px; min-width: 0; }
.fa-item-title h4 {
  margin: 0; font-size: 13.5px; color: var(--text-strong);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0;
}
.fa-badge {
  flex: none; font-size: 11px; padding: 2px 7px; border-radius: 999px;
  color: #fff; font-weight: 600; background: var(--fa-st, #94a3b8);
}
.fa-badge.st-pending { background: #dc2626; }
.fa-badge.st-processing { background: #d97706; }
.fa-badge.st-replied { background: #4f46e5; }
.fa-badge.st-closed { background: #16a34a; }
.fa-new-dot { width: 7px; height: 7px; border-radius: 50%; background: #dc2626; flex: none; }
.fa-item-summary {
  margin: 5px 0; font-size: 12px; color: var(--text-muted); line-height: 1.5;
  display: -webkit-box; -webkit-line-clamp: 2; line-clamp: 2;
  -webkit-box-orient: vertical; overflow: hidden;
}
.fa-item-meta { display: flex; flex-wrap: wrap; gap: 8px; font-size: 11px; color: var(--text-faint); }
.pr-high { color: #d97706; font-weight: 600; }
.pr-urgent { color: #dc2626; font-weight: 700; }

.fa-empty, .fa-detail-empty { text-align: center; padding: 50px 16px; color: var(--text-faint); }
.fa-empty :deep(svg), .fa-detail-empty :deep(svg) { font-size: 34px; margin-bottom: 8px; }
.fa-empty p, .fa-detail-empty p { margin: 0; font-size: 13px; }

/* ===== 详情 ===== */
.fa-detail-body { padding: 15px; display: flex; flex-direction: column; gap: 16px; }

.fa-steps { display: flex; gap: 8px; flex-wrap: wrap; }
.fa-step {
  flex: 1;
  min-width: 92px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 8px 10px;
  border-radius: 9px;
  border: 1px solid var(--border);
  background: var(--surface);
  font-size: 12px;
  color: var(--text-muted);
  cursor: pointer;
  transition: all 0.15s;
}
.fa-step:hover:not(:disabled) { border-color: var(--primary); color: var(--primary); }
.fa-step-idx {
  width: 18px; height: 18px; border-radius: 50%;
  background: var(--surface-soft); color: var(--text-faint);
  display: grid; place-items: center; font-size: 11px; font-weight: 700; flex: none;
}
.fa-step.done { border-color: #16a34a; color: #16a34a; }
.fa-step.done .fa-step-idx { background: #16a34a; color: #fff; }
.fa-step.active {
  border-color: var(--primary); color: var(--primary); font-weight: 600;
  background: color-mix(in srgb, var(--primary) 8%, var(--surface));
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--primary) 12%, transparent);
}
.fa-step.active .fa-step-idx { background: var(--primary); color: #fff; }

.fa-info {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: 10px;
}
.fa-info-cell {
  background: var(--surface-soft);
  border: 1px solid var(--border);
  border-radius: 9px;
  padding: 9px 11px;
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
}
.fa-info-cell span { font-size: 11px; color: var(--text-faint); }
.fa-info-cell b {
  font-size: 13px; color: var(--text-strong);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}

.fa-block h5 {
  margin: 0 0 8px; font-size: 13px; color: var(--text-strong);
  padding-bottom: 6px; border-bottom: 1px solid var(--border);
}
.fa-content {
  margin: 0; font-size: 13px; line-height: 1.75; color: var(--text);
  white-space: pre-wrap; word-break: break-word;
}
.fa-atts { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 10px; }
.fa-atts img {
  width: 92px; height: 92px; object-fit: cover;
  border-radius: 8px; border: 1px solid var(--border); cursor: zoom-in;
}

.fa-close-reason {
  display: flex; gap: 10px; align-items: flex-start;
  padding: 11px 13px; border-radius: 10px;
  background: rgba(245, 158, 11, 0.08);
  border: 1px solid rgba(245, 158, 11, 0.28);
  color: #b45309;
}
.fa-close-reason strong { font-size: 12px; }
.fa-close-reason p { margin: 4px 0 0; font-size: 13px; color: #92400e; line-height: 1.6; }

.fa-timeline { display: flex; flex-direction: column; gap: 10px; min-height: 40px; }
.fa-timeline-empty { font-size: 12px; color: var(--text-faint); }
.fa-reply {
  padding: 10px 12px; border-radius: 10px;
  background: var(--surface-soft); border: 1px solid var(--border);
}
.fa-reply.admin {
  background: color-mix(in srgb, var(--primary) 6%, var(--surface));
  border-color: color-mix(in srgb, var(--primary) 18%, transparent);
}
.fa-reply.internal {
  background: rgba(245, 158, 11, 0.08);
  border-color: rgba(245, 158, 11, 0.28);
}
.fa-reply-head { display: flex; justify-content: space-between; gap: 8px; flex-wrap: wrap; }
.fa-reply-head strong { font-size: 12px; color: var(--text-strong); display: inline-flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.fa-reply-head > span { font-size: 11px; color: var(--text-faint); }
.fa-internal-tag {
  display: inline-flex; align-items: center; gap: 3px;
  font-size: 10px; font-weight: 600; color: #b45309;
  background: rgba(245, 158, 11, 0.18); border-radius: 999px; padding: 1px 7px;
}
.fa-reply p { margin: 6px 0 0; font-size: 13px; line-height: 1.65; white-space: pre-wrap; word-break: break-word; }

.fa-reply-box { display: flex; flex-direction: column; gap: 9px; }
.fa-reply-tabs { display: flex; gap: 6px; }
.fa-reply-tabs button {
  padding: 6px 14px; border-radius: 8px; font-size: 12px; cursor: pointer;
  border: 1px solid var(--border); background: var(--surface); color: var(--text-muted);
}
.fa-reply-tabs button.active {
  border-color: var(--primary); color: var(--primary); font-weight: 600;
  background: color-mix(in srgb, var(--primary) 8%, var(--surface));
}
.fa-quick { display: flex; gap: 6px; flex-wrap: wrap; }
.fa-quick button {
  padding: 4px 10px; border-radius: 999px; font-size: 11px; cursor: pointer;
  border: 1px dashed var(--border); background: var(--surface); color: var(--text-muted);
}
.fa-quick button:hover { border-color: var(--primary); color: var(--primary); }
.fa-reply-actions {
  display: flex; align-items: center; justify-content: space-between;
  gap: 10px; flex-wrap: wrap;
}
.fa-reply-hint { font-size: 11px; color: var(--text-faint); }

.fa-preview-img { width: 100%; border-radius: 8px; display: block; }

/* ===== 响应式 ===== */
@media (max-width: 1100px) {
  .fa-body { grid-template-columns: minmax(0, 1fr); }
  .fa-list-card { position: static; }
  .fa-list { max-height: none; }
  .mobile-hidden { display: none; }
}
@media (max-width: 768px) {
  .fa-page { padding: 0 14px 14px; }
  .fa-stats { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
  .fa-stat-value { font-size: 20px; }
  .fa-cats { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .fa-filters { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .fa-batch { align-items: flex-start; }
  .fa-batch-actions { width: 100%; }
  .fa-batch-actions .el-button { flex: 1; margin-left: 0 !important; }
  .fa-step { min-width: calc(50% - 4px); flex: none; }
  .fa-atts img { width: 76px; height: 76px; }
  .fa-reply-actions .el-button { flex: 1; }
}
</style>
