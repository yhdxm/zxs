<template>
  <div class="fb-page">
    <PageHeader
      title="意见反馈"
      subtitle="提交你的功能建议、问题反馈与投诉。反馈仅本人与超级管理员可见，账号之间严格隔离，处理进度可实时查看。"
      :icon="ChatLineSquare"
    />

    <!-- ===== 个人统计 ===== -->
    <div class="fb-stats">
      <div v-for="s in myStats" :key="s.key" class="fb-stat" :class="`c-${s.color}`">
        <span class="fb-stat-label">{{ s.label }}</span>
        <span class="fb-stat-value">{{ s.value }}</span>
      </div>
    </div>

    <div class="fb-body">
      <!-- ===== 左：提交表单 ===== -->
      <section class="fb-card fb-form-card">
        <div class="fb-card-head">
          <div class="fb-card-icon c-primary"><el-icon><EditPen /></el-icon></div>
          <div>
            <h3>提交反馈</h3>
            <p>请尽量���述清楚场景与复现步骤，便于快速定位</p>
          </div>
        </div>

        <div class="fb-form">
          <div class="fb-field">
            <label>标题 <i>*</i></label>
            <el-input v-model="form.title" maxlength="60" show-word-limit placeholder="一句话概括你的问题或建议" />
          </div>

          <div class="fb-field-row">
            <div class="fb-field">
              <label>分类</label>
              <el-select v-model="form.category" class="fb-full">
                <el-option v-for="(l, k) in CATEGORY_LABELS" :key="k" :label="l" :value="k" />
              </el-select>
            </div>
            <div class="fb-field">
              <label>优先级</label>
              <el-select v-model="form.priority" class="fb-full">
                <el-option v-for="(l, k) in PRIORITY_LABELS" :key="k" :label="l" :value="k" />
              </el-select>
            </div>
          </div>

          <div class="fb-field">
            <label>联系方式（选填）</label>
            <el-input v-model="form.contact" maxlength="50" placeholder="手机号 / 微信 / 邮箱，便于回访" />
          </div>

          <div class="fb-field">
            <label>详细描述 <i>*</i></label>
            <el-input
              v-model="form.content"
              type="textarea"
              :rows="6"
              maxlength="2000"
              show-word-limit
              placeholder="出现问题的页面、操作步骤、期望结果……"
            />
          </div>

          <div class="fb-field">
            <label>
              截图附件（选填，最多 {{ MAX_ATTACHMENTS }} 张）
              <span class="fb-tip">自动压缩，不占用云存储</span>
            </label>
            <div class="fb-uploads">
              <div v-for="(a, i) in form.attachments" :key="i" class="fb-upload-item">
                <img :src="a.dataUrl" :alt="a.name" @click="previewImage(a.dataUrl)" />
                <button type="button" class="fb-upload-del" @click="form.attachments.splice(i, 1)">
                  <el-icon><Close /></el-icon>
                </button>
              </div>
              <label v-if="form.attachments.length < MAX_ATTACHMENTS" class="fb-upload-add">
                <el-icon><Plus /></el-icon>
                <span>添加</span>
                <input type="file" accept="image/*" hidden @change="onPickFile" />
              </label>
            </div>
          </div>

          <div class="fb-anon">
            <el-switch v-model="form.anonymous" />
            <div>
              <strong>匿名提交</strong>
              <p>开启后管理员看不到你的账号信息，但仍可在「我的反馈」中查看处理进度</p>
            </div>
          </div>

          <div class="fb-form-actions">
            <el-button @click="resetForm">重置</el-button>
            <el-button type="primary" :loading="submitting" @click="submit">
              <el-icon><Promotion /></el-icon> 提交反馈
            </el-button>
          </div>
        </div>
      </section>

      <!-- ===== 右：我的反馈 ===== -->
      <section class="fb-card fb-list-card">
        <div class="fb-card-head">
          <div class="fb-card-icon c-cyan"><el-icon><Tickets /></el-icon></div>
          <div>
            <h3>我的反馈</h3>
            <p>共 {{ myList.length }} 条，仅你本人与超级管理员可见</p>
          </div>
          <el-button size="small" :loading="loading" @click="loadMine">
            <el-icon><Refresh /></el-icon> 刷新
          </el-button>
        </div>

        <div class="fb-filter-chips">
          <button
            v-for="c in statusChips"
            :key="c.key"
            type="button"
            class="fb-chip"
            :class="{ active: statusFilter === c.key }"
            @click="statusFilter = c.key"
          >
            {{ c.label }}<span>{{ c.count }}</span>
          </button>
        </div>

        <div v-loading="loading" class="fb-list">
          <article
            v-for="f in filteredList"
            :key="f.id"
            class="fb-item"
            :class="[`st-${f.status}`, { open: expandedId === f.id }]"
          >
            <header class="fb-item-head" @click="toggleExpand(f)">
              <div class="fb-item-title">
                <span class="fb-badge" :class="`st-${f.status}`">{{ STATUS_LABELS[f.status] }}</span>
                <h4>{{ f.title }}</h4>
                <span v-if="f.user_unread" class="fb-new-dot" title="有新回复"></span>
              </div>
              <div class="fb-item-meta">
                <span>#{{ f.id.slice(0, 8) }}</span>
                <span>{{ CATEGORY_LABELS[f.category] }}</span>
                <span>优先级 {{ PRIORITY_LABELS[f.priority] }}</span>
                <span>{{ fmtTime(f.created_at) }}</span>
                <span v-if="f.attachments.length">附件 {{ f.attachments.length }}</span>
                <span v-if="f.reply_count">回复 {{ f.reply_count }}</span>
              </div>
            </header>

            <div v-if="expandedId === f.id" class="fb-item-detail">
              <p class="fb-item-content">{{ f.content }}</p>

              <div v-if="f.attachments.length" class="fb-item-atts">
                <img
                  v-for="(a, i) in f.attachments"
                  :key="i"
                  :src="a.dataUrl"
                  :alt="a.name"
                  @click="previewImage(a.dataUrl)"
                />
              </div>

              <div v-loading="repliesLoading" class="fb-timeline">
                <div v-if="!replies.length && !repliesLoading" class="fb-timeline-empty">
                  暂无回复，管理员处理后会在这里显示
                </div>
                <div
                  v-for="r in replies"
                  :key="r.id"
                  class="fb-reply"
                  :class="{ mine: r.author_role === 'user' || r.author_id === myId }"
                >
                  <div class="fb-reply-head">
                    <strong>{{ r.author_role === 'superadmin' ? '超级管理员' : r.author_name }}</strong>
                    <span>{{ fmtTime(r.created_at) }}</span>
                  </div>
                  <p>{{ r.content }}</p>
                </div>
              </div>

              <div v-if="f.status !== 'closed'" class="fb-append">
                <el-input
                  v-model="appendText"
                  type="textarea"
                  :rows="2"
                  maxlength="500"
                  placeholder="补充说明（可选）"
                />
                <div class="fb-append-actions">
                  <el-button
                    size="small"
                    type="danger"
                    plain
                    :loading="deletingId === f.id"
                    @click="removeMine(f)"
                  >
                    <el-icon><Delete /></el-icon> 撤回
                  </el-button>
                  <el-button size="small" type="primary" :loading="appending" @click="doAppend(f)">
                    发送补充
                  </el-button>
                </div>
              </div>
              <div v-else class="fb-closed-note">该反馈已关闭，如仍有问题请重新提交</div>
            </div>
          </article>

          <div v-if="!loading && filteredList.length === 0" class="fb-empty">
            <el-icon><Tickets /></el-icon>
            <p>{{ myList.length ? '当前筛选下没有反馈' : '还没有提交过反馈' }}</p>
          </div>
        </div>
      </section>
    </div>

    <el-dialog v-model="previewVisible" width="min(760px, 92vw)" align-center>
      <img :src="previewUrl" class="fb-preview-img" alt="附件预览" />
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  ChatLineSquare, EditPen, Tickets, Refresh, Plus, Close, Promotion, Delete
} from '@element-plus/icons-vue'
import PageHeader from '../components/PageHeader.vue'
import { getSavedUser } from '../services/appDataService'
import {
  listMyFeedbacks,
  submitFeedback,
  deleteMyFeedback,
  listRepliesForUser,
  appendUserReply,
  markUserRead,
  compressImage,
  CATEGORY_LABELS,
  PRIORITY_LABELS,
  STATUS_LABELS,
  MAX_ATTACHMENTS,
  type FeedbackItem,
  type FeedbackReply,
  type FeedbackAttachment,
  type FeedbackCategory,
  type FeedbackPriority,
  type FeedbackStatus
} from '../services/feedbackService'

const loading = ref(false)
const submitting = ref(false)
const appending = ref(false)
const repliesLoading = ref(false)
const deletingId = ref('')
const myId = ref('')

const myList = ref<FeedbackItem[]>([])
const replies = ref<FeedbackReply[]>([])
const expandedId = ref('')
const appendText = ref('')
const statusFilter = ref<'all' | FeedbackStatus>('all')

const previewVisible = ref(false)
const previewUrl = ref('')

const form = reactive({
  title: '',
  category: 'suggestion' as FeedbackCategory,
  priority: 'normal' as FeedbackPriority,
  contact: '',
  content: '',
  anonymous: false,
  attachments: [] as FeedbackAttachment[]
})

const myStats = computed(() => {
  const c = (s: FeedbackStatus) => myList.value.filter((f) => f.status === s).length
  return [
    { key: 'total', label: '我的反馈', value: myList.value.length, color: 'primary' },
    { key: 'pending', label: '待处理', value: c('pending'), color: 'danger' },
    { key: 'replied', label: '已回复', value: c('replied'), color: 'cyan' },
    { key: 'closed', label: '已关闭', value: c('closed'), color: 'success' }
  ]
})

const statusChips = computed(() => {
  const c = (s: FeedbackStatus) => myList.value.filter((f) => f.status === s).length
  return [
    { key: 'all' as const, label: '全部', count: myList.value.length },
    { key: 'pending' as const, label: STATUS_LABELS.pending, count: c('pending') },
    { key: 'processing' as const, label: STATUS_LABELS.processing, count: c('processing') },
    { key: 'replied' as const, label: STATUS_LABELS.replied, count: c('replied') },
    { key: 'closed' as const, label: STATUS_LABELS.closed, count: c('closed') }
  ]
})

const filteredList = computed(() =>
  statusFilter.value === 'all'
    ? myList.value
    : myList.value.filter((f) => f.status === statusFilter.value)
)

function fmtTime(v: string): string {
  const d = new Date(v)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('zh-CN', { hour12: false }).replace(/:\d{2}$/, '')
}

function previewImage(url: string) {
  previewUrl.value = url
  previewVisible.value = true
}

async function onPickFile(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  try {
    const att = await compressImage(file)
    form.attachments.push(att)
  } catch (err) {
    ElMessage.error(err instanceof Error ? err.message : '图片处理失败')
  }
}

function resetForm() {
  form.title = ''
  form.category = 'suggestion'
  form.priority = 'normal'
  form.contact = ''
  form.content = ''
  form.anonymous = false
  form.attachments = []
}

async function loadMine() {
  loading.value = true
  try {
    myList.value = await listMyFeedbacks()
  } catch (err) {
    ElMessage.error(err instanceof Error ? err.message : '加载失败')
  } finally {
    loading.value = false
  }
}

async function submit() {
  if (!form.title.trim()) return ElMessage.warning('请填写反馈标题')
  if (!form.content.trim()) return ElMessage.warning('请填写详细描述')
  submitting.value = true
  try {
    const created = await submitFeedback({
      title: form.title,
      category: form.category,
      priority: form.priority,
      content: form.content,
      contact: form.contact,
      anonymous: form.anonymous,
      attachments: form.attachments
    })
    ElMessage.success(`提交成功，反馈单号 #${created.id.slice(0, 8)}`)
    resetForm()
    await loadMine()
  } catch (err) {
    ElMessage.error(err instanceof Error ? err.message : '提交失败')
  } finally {
    submitting.value = false
  }
}

async function toggleExpand(f: FeedbackItem) {
  if (expandedId.value === f.id) {
    expandedId.value = ''
    return
  }
  expandedId.value = f.id
  appendText.value = ''
  repliesLoading.value = true
  try {
    replies.value = await listRepliesForUser(f.id)
    if (f.user_unread) {
      await markUserRead(f.id)
      f.user_unread = false
    }
  } catch (err) {
    replies.value = []
    ElMessage.error(err instanceof Error ? err.message : '加载回复失败')
  } finally {
    repliesLoading.value = false
  }
}

async function doAppend(f: FeedbackItem) {
  if (!appendText.value.trim()) return ElMessage.warning('请填写补充内容')
  appending.value = true
  try {
    await appendUserReply(f.id, appendText.value)
    appendText.value = ''
    replies.value = await listRepliesForUser(f.id)
    ElMessage.success('已补充')
  } catch (err) {
    ElMessage.error(err instanceof Error ? err.message : '补充失败')
  } finally {
    appending.value = false
  }
}

async function removeMine(f: FeedbackItem) {
  try {
    await ElMessageBox.confirm('撤回后该反馈及回复将被删除，确认撤回？', '撤回反馈', {
      type: 'warning',
      confirmButtonText: '确认撤回',
      cancelButtonText: '取消'
    })
  } catch {
    return
  }
  deletingId.value = f.id
  try {
    await deleteMyFeedback(f.id)
    expandedId.value = ''
    ElMessage.success('已撤回')
    await loadMine()
  } catch (err) {
    ElMessage.error(err instanceof Error ? err.message : '撤回失败')
  } finally {
    deletingId.value = ''
  }
}

onMounted(async () => {
  const u = await getSavedUser()
  myId.value = u?.id || ''
  await loadMine()
})
</script>

<style scoped>
.fb-page {
  padding: 0 18px 18px;
  max-width: 1400px;
  margin: 0 auto;
  color: var(--text);
}

/* ===== 统计 ===== */
.fb-stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 12px;
  margin-bottom: 14px;
}
.fb-stat {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 14px 16px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  border-top: 3px solid var(--fb-c, var(--primary));
  box-shadow: var(--shadow-card);
}
.fb-stat-label { font-size: 12px; color: var(--text-muted); }
.fb-stat-value { font-size: 24px; font-weight: 700; color: var(--fb-c, var(--primary)); line-height: 1.1; }
.c-primary { --fb-c: #4f46e5; }
.c-danger { --fb-c: #dc2626; }
.c-cyan { --fb-c: #0891b2; }
.c-success { --fb-c: #16a34a; }
.c-amber { --fb-c: #d97706; }

/* ===== 布局 ===== */
.fb-body {
  display: grid;
  grid-template-columns: minmax(0, 400px) minmax(0, 1fr);
  gap: 14px;
  align-items: start;
}
.fb-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 14px;
  box-shadow: var(--shadow-card);
  overflow: hidden;
}
.fb-form-card { position: sticky; top: 12px; }
.fb-card-head {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px 16px;
  border-bottom: 1px solid var(--border);
  background: var(--surface-soft);
}
.fb-card-head h3 { margin: 0; font-size: 15px; color: var(--text-strong); }
.fb-card-head p { margin: 2px 0 0; font-size: 12px; color: var(--text-faint); }
.fb-card-head > .el-button { margin-left: auto; }
.fb-card-icon {
  width: 34px; height: 34px; border-radius: 9px;
  display: grid; place-items: center; flex: none;
  color: #fff; font-size: 17px;
  background: var(--fb-c, var(--primary));
}

/* ===== 表单 ===== */
.fb-form { padding: 16px; display: flex; flex-direction: column; gap: 14px; }
.fb-field { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
.fb-field > label { font-size: 12px; font-weight: 600; color: var(--text-strong); }
.fb-field > label i { color: #dc2626; font-style: normal; }
.fb-tip { font-weight: 400; color: var(--text-faint); margin-left: 6px; }
.fb-field-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.fb-full { width: 100%; }

.fb-uploads { display: flex; flex-wrap: wrap; gap: 10px; }
.fb-upload-item { position: relative; width: 72px; height: 72px; }
.fb-upload-item img {
  width: 100%; height: 100%; object-fit: cover;
  border-radius: 8px; border: 1px solid var(--border); cursor: zoom-in;
}
.fb-upload-del {
  position: absolute; top: -6px; right: -6px;
  width: 20px; height: 20px; border-radius: 50%;
  border: none; background: #dc2626; color: #fff;
  display: grid; place-items: center; cursor: pointer; font-size: 12px;
}
.fb-upload-add {
  width: 72px; height: 72px; border-radius: 8px;
  border: 1px dashed var(--border); cursor: pointer;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 2px; font-size: 11px; color: var(--text-faint);
}
.fb-upload-add:hover { border-color: var(--primary); color: var(--primary); }

.fb-anon {
  display: flex; align-items: flex-start; gap: 10px;
  padding: 10px 12px; border-radius: 10px;
  background: rgba(245, 158, 11, 0.08);
  border: 1px solid rgba(245, 158, 11, 0.25);
}
.fb-anon strong { font-size: 13px; color: #b45309; }
.fb-anon p { margin: 2px 0 0; font-size: 11px; color: #92400e; line-height: 1.5; }
.fb-form-actions { display: flex; justify-content: flex-end; gap: 10px; flex-wrap: wrap; }

/* ===== 列表 ===== */
.fb-filter-chips {
  display: flex; gap: 8px; padding: 12px 16px 0;
  overflow-x: auto; scrollbar-width: none;
}
.fb-filter-chips::-webkit-scrollbar { display: none; }
.fb-chip {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 5px 12px; border-radius: 999px; flex: none;
  border: 1px solid var(--border); background: var(--surface);
  font-size: 12px; color: var(--text-muted); cursor: pointer;
  transition: all 0.15s;
}
.fb-chip span {
  background: var(--surface-soft); border-radius: 999px;
  padding: 0 6px; font-size: 11px; color: var(--text-faint);
}
.fb-chip.active {
  border-color: var(--primary); color: var(--primary);
  background: color-mix(in srgb, var(--primary) 8%, var(--surface));
}
.fb-chip.active span { background: var(--primary); color: #fff; }

.fb-list { padding: 12px 16px 16px; display: flex; flex-direction: column; gap: 10px; min-height: 200px; }
.fb-item {
  border: 1px solid var(--border);
  border-left: 4px solid var(--fb-st, #94a3b8);
  border-radius: 10px;
  background: var(--surface);
  overflow: hidden;
  transition: box-shadow 0.15s;
}
.fb-item.st-pending { --fb-st: #dc2626; }
.fb-item.st-processing { --fb-st: #d97706; }
.fb-item.st-replied { --fb-st: #4f46e5; }
.fb-item.st-closed { --fb-st: #16a34a; }
.fb-item.open { box-shadow: 0 2px 10px rgba(15, 23, 42, 0.06); }
.fb-item-head { padding: 12px 14px; cursor: pointer; }
.fb-item-title { display: flex; align-items: center; gap: 8px; min-width: 0; }
.fb-item-title h4 {
  margin: 0; font-size: 14px; color: var(--text-strong);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0;
}
.fb-badge {
  flex: none; font-size: 11px; padding: 2px 8px; border-radius: 999px;
  color: #fff; background: var(--fb-st, #94a3b8); font-weight: 600;
}
.fb-badge.st-pending { background: #dc2626; }
.fb-badge.st-processing { background: #d97706; }
.fb-badge.st-replied { background: #4f46e5; }
.fb-badge.st-closed { background: #16a34a; }
.fb-new-dot { width: 8px; height: 8px; border-radius: 50%; background: #dc2626; flex: none; }
.fb-item-meta {
  display: flex; flex-wrap: wrap; gap: 10px;
  margin-top: 6px; font-size: 11px; color: var(--text-faint);
}

.fb-item-detail { padding: 0 14px 14px; border-top: 1px dashed var(--border); }
.fb-item-content {
  margin: 12px 0; font-size: 13px; line-height: 1.7;
  color: var(--text); white-space: pre-wrap; word-break: break-word;
}
.fb-item-atts { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 12px; }
.fb-item-atts img {
  width: 84px; height: 84px; object-fit: cover;
  border-radius: 8px; border: 1px solid var(--border); cursor: zoom-in;
}

.fb-timeline { display: flex; flex-direction: column; gap: 10px; min-height: 40px; }
.fb-timeline-empty { font-size: 12px; color: var(--text-faint); padding: 8px 0; }
.fb-reply {
  padding: 10px 12px; border-radius: 10px;
  background: color-mix(in srgb, var(--primary) 6%, var(--surface-soft));
  border: 1px solid color-mix(in srgb, var(--primary) 16%, transparent);
}
.fb-reply.mine { background: var(--surface-soft); border-color: var(--border); }
.fb-reply-head { display: flex; justify-content: space-between; gap: 10px; flex-wrap: wrap; }
.fb-reply-head strong { font-size: 12px; color: var(--text-strong); }
.fb-reply-head span { font-size: 11px; color: var(--text-faint); }
.fb-reply p { margin: 6px 0 0; font-size: 13px; line-height: 1.65; white-space: pre-wrap; word-break: break-word; }

.fb-append { margin-top: 12px; display: flex; flex-direction: column; gap: 8px; }
.fb-append-actions { display: flex; justify-content: space-between; gap: 8px; flex-wrap: wrap; }
.fb-closed-note {
  margin-top: 12px; padding: 8px 12px; border-radius: 8px;
  background: var(--surface-soft); font-size: 12px; color: var(--text-faint);
}

.fb-empty { text-align: center; padding: 40px 16px; color: var(--text-faint); }
.fb-empty :deep(svg) { font-size: 34px; margin-bottom: 8px; }
.fb-empty p { margin: 0; font-size: 13px; }
.fb-preview-img { width: 100%; border-radius: 8px; display: block; }

/* ===== 响应式 ===== */
@media (max-width: 1100px) {
  .fb-body { grid-template-columns: minmax(0, 1fr); }
  .fb-form-card { position: static; }
}
@media (max-width: 768px) {
  .fb-page { padding: 0 14px 14px; }
  .fb-stats { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
  .fb-stat { padding: 12px; }
  .fb-stat-value { font-size: 20px; }
  .fb-field-row { grid-template-columns: 1fr; }
  .fb-form-actions .el-button { flex: 1; }
  .fb-item-atts img { width: 70px; height: 70px; }
}
</style>
