<template>
  <div class="mm-shell">
    <!-- ===== 顶部工具栏 ===== -->
    <div class="mm-topbar">
      <div class="mm-topbar-title">
        <span class="mm-title-icon" :class="type">{{ typeIcon }}</span>
        <div>
          <h2>{{ typeLabel }}数据条</h2>
          <!--
            口径（Fix #4 / #5）：列表左上角总数 = 实际数据条数 − 今日新增条目数。
            「今日新增」以 createdAt 的本地日期 === 今日 判定（含通过「+ 新增」录入的草稿/今日数据），
            避免新增录入虚增存量统计；详情在下方 tip 中展示。
          -->
          <p class="mm-title-tip">共 {{ backlogCount }} 条数据（含今日新增 {{ newCountInList }} 条 / 总计 {{ filteredList.length }} 条）</p>
        </div>
      </div>

      <div class="mm-toolbar">
        <el-input v-model="search" size="default" placeholder="搜索当前列表" clearable class="mm-search">
          <template #prefix><el-icon><Search /></el-icon></template>
        </el-input>

        <el-date-picker
          v-model="dateRange"
          type="daterange"
          size="default"
          value-format="YYYY-MM-DD"
          range-separator="至"
          start-placeholder="开始日期"
          end-placeholder="结束日期"
          class="mm-date-range"
        />

        <el-select v-if="type === 'todos'" v-model="todoFilter" size="default" class="mm-filter">
          <el-option label="全部状态" value="all" />
          <el-option label="未开始" value="todo" />
          <el-option label="进行中" value="doing" />
          <el-option label="已完成" value="done" />
        </el-select>

        <el-select v-if="type === 'contents'" v-model="contentCategory" size="default" class="mm-filter">
          <el-option label="全部分类" value="all" />
          <el-option v-for="cat in contentCategories" :key="cat" :label="cat" :value="cat" />
        </el-select>

        <el-dropdown trigger="click" @command="onMoreCommand" class="mm-more">
          <el-button size="default">
            <el-icon><More /></el-icon><span>更多</span>
          </el-button>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item command="export-csv"><el-icon><Download /></el-icon> 导出 CSV</el-dropdown-item>
              <el-dropdown-item command="export-json"><el-icon><Download /></el-icon> 导出 JSON</el-dropdown-item>
              <el-dropdown-item command="import"><el-icon><Upload /></el-icon> 导入文件</el-dropdown-item>
              <el-dropdown-item command="template"><el-icon><Document /></el-icon> 下载导入模板</el-dropdown-item>
              <el-dropdown-item command="clear-all" divided><el-icon><Delete /></el-icon> 清空全部</el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>

        <el-button type="primary" size="default" class="mm-add-btn" @click="openAdd">
          <el-icon><Plus /></el-icon><span>新增</span>
        </el-button>
      </div>
    </div>

    <!-- ===== 数据条列表 ===== -->
    <div class="mm-list">
      <div
        v-for="item in sideItems"
        :key="item.id"
        class="mm-item"
        :class="[type, { 'is-done': type === 'todos' && item.status === 'done' }]"
      >
        <div class="mm-item-main" @click="openEditById(item.id)">
          <div class="mm-item-info">
            <div class="mm-item-title">
              {{ item.title }}
              <el-tag
                v-if="type === 'todos' && item.status"
                size="small"
                :type="item.badgeType"
                effect="light"
                class="mm-badge"
              >{{ item.badge }}</el-tag>
              <el-tag v-else-if="item.badge" size="small" :type="item.badgeType" effect="light" class="mm-badge">{{ item.badge }}</el-tag>
            </div>
            <div class="mm-item-sub">{{ item.subtitle }}</div>
          </div>
          <div class="mm-item-extra">
            <span class="mm-item-date">{{ item.dateText }}</span>
          </div>
        </div>
        <div class="mm-item-actions">
          <el-button v-if="type !== 'todos'" size="small" text @click.stop="duplicateItem(item.id)">
            <el-icon><Plus /></el-icon><span>新增</span>
          </el-button>
          <el-button size="small" text @click.stop="openEditById(item.id)">
            <el-icon><Edit /></el-icon><span>修改</span>
          </el-button>
          <!-- 点位：巡检状态操作置于「修改」之后（Fix #4：顺序 新增 / 修改 / 巡检状态 / 删除） -->
          <el-button v-if="type === 'points'" size="small" text @click.stop="cyclePointStatus(item.id)">
            <el-icon><Switch /></el-icon><span>巡检状态</span>
          </el-button>
          <!-- 内容：分类快速操作置于「修改」之后（Fix #5：顺序 新增 / 修改 / 分类 / 删除） -->
          <el-button v-if="type === 'contents'" size="small" text @click.stop="editCategory(item.id)">
            <el-icon><Collection /></el-icon><span>分类</span>
          </el-button>
          <el-button v-if="type === 'todos'" size="small" text @click.stop="cycleTodoStatus(item.id)">
            <el-icon><Switch /></el-icon><span>状态</span>
          </el-button>
          <el-button size="small" text type="danger" @click.stop="removeItem(item.id)">
            <el-icon><Delete /></el-icon><span>删除</span>
          </el-button>
        </div>
      </div>

      <div v-if="filteredList.length === 0" class="mm-empty">
        <el-icon><Document /></el-icon>
        <p>暂无数据，点击右上角「新增」创建</p>
      </div>
    </div>

    <input ref="fileInput" type="file" accept=".csv,.json" class="hidden-file" @change="importFile" />

    <!-- ===== 统一编辑 / 新增弹框（横屏双列） ===== -->
    <el-dialog v-model="editDialogVisible" :title="editTitle" width="720px" class="premium-dialog mm-dialog" align-center>
      <el-form label-position="top" class="mm-form-grid">
        <template v-if="type === 'todos'">
          <el-form-item label="事项标题">
            <el-input v-model="editForm.title" placeholder="请输入待办事项" />
          </el-form-item>
          <el-form-item label="优先级">
            <el-select v-model="editForm.priority" style="width: 100%">
              <el-option label="高" value="high" />
              <el-option label="中" value="medium" />
              <el-option label="低" value="low" />
            </el-select>
          </el-form-item>
          <el-form-item label="日期">
            <el-date-picker v-model="editForm.date" type="date" value-format="YYYY-MM-DD" placeholder="选择日期" style="width: 100%" />
          </el-form-item>
          <el-form-item label="备注" class="full">
            <el-input v-model="editForm.note" type="textarea" :rows="3" placeholder="补充说明（可选）" />
          </el-form-item>
        </template>

        <template v-else-if="type === 'points'">
          <el-form-item label="点位名称">
            <el-input v-model="editForm.name" placeholder="请输入点位名称" />
          </el-form-item>
          <el-form-item label="地址">
            <el-input v-model="editForm.address" placeholder="请输入地址" />
          </el-form-item>
          <el-form-item label="分类">
            <el-input v-model="editForm.category" placeholder="如 门店 / 仓库 / 站点" />
          </el-form-item>
          <el-form-item label="巡查状态">
            <el-select v-model="editForm.status" style="width: 100%">
              <el-option label="待巡查" value="pending" />
              <el-option label="已巡查" value="done" />
              <el-option label="异常" value="issue" />
            </el-select>
          </el-form-item>
          <el-form-item label="日期">
            <el-date-picker v-model="editForm.date" type="date" value-format="YYYY-MM-DD" placeholder="选择日期" style="width: 100%" />
          </el-form-item>
          <el-form-item label="备注" class="full">
            <el-input v-model="editForm.note" type="textarea" :rows="3" placeholder="请输入备注" />
          </el-form-item>
        </template>

        <template v-else>
          <el-form-item label="标题" class="full">
            <el-input v-model="editForm.title" placeholder="请输入标题" />
          </el-form-item>
          <el-form-item label="分类">
            <el-input v-model="editForm.category" placeholder="如 日报 / 周报 / 笔记" />
          </el-form-item>
          <el-form-item label="标签">
            <el-input v-model="editForm.tags" placeholder="逗号分隔，如 日常,同步" />
          </el-form-item>
          <el-form-item label="完成状态">
            <el-select v-model="editForm.contentStatus" style="width: 100%">
              <el-option label="未完成" value="undone" />
              <el-option label="已完成" value="done" />
            </el-select>
          </el-form-item>
          <div class="inline-fields full">
            <el-form-item label="日期">
              <el-date-picker v-model="editForm.date" type="date" value-format="YYYY-MM-DD" placeholder="选择日期" style="width: 100%" />
            </el-form-item>
            <el-form-item label="时间">
              <el-time-picker v-model="editForm.time" value-format="HH:mm" format="HH:mm" placeholder="选择时间" style="width: 100%" />
            </el-form-item>
          </div>
          <el-form-item label="正文内容" class="full">
            <el-input v-model="editForm.content" type="textarea" :rows="5" placeholder="请输入处理内容" />
          </el-form-item>
          <el-form-item label="图片上传" class="full">
            <input class="file-input" type="file" accept="image/*" @change="handleEditImage" />
            <div v-if="editForm.image" class="preview-box">
              <img :src="editForm.image" alt="内容图片预览" />
            </div>
          </el-form-item>
        </template>
      </el-form>
      <template #footer>
        <el-button @click="editDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="submitEdit">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { useKeyboardAvoid } from '../composables/useKeyboardAvoid'

useKeyboardAvoid()
import { computed, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  List, Location, Document, Plus, Edit, Delete,
  Download, Upload, More, Search, Switch, Collection
} from '@element-plus/icons-vue'
import {
  type AppDashboardData,
  type ContentItem,
  type PointItem,
  type TodoItem,
  type TodoPriority,
  type TodoStatus,
  type PointStatus,
  type ContentStatus
} from '../services/appDataService'

export type ModuleType = 'todos' | 'points' | 'contents'

const props = defineProps<{
  type: ModuleType
  dashboard: AppDashboardData
  onSave: () => Promise<void>
}>()

const LABELS: Record<ModuleType, string> = { todos: '待办', points: '点位', contents: '内容' }
const typeLabel = computed(() => LABELS[props.type])
const typeIcon = computed(() => ({ todos: '✓', points: '◎', contents: '◎' }[props.type]))

/* ============ 查询状态 ============ */
const search = ref('')
const todoFilter = ref<'all' | TodoStatus>('all')
const contentCategory = ref<string>('all')
const dateRange = ref<[string, string] | null>(null)

/** 内容分类去重列表（用于「分类」查询框） */
const contentCategories = computed<string[]>(() => {
  const set = new Set<string>()
  for (const c of props.dashboard.contents) {
    if (c.category && c.category.trim()) set.add(c.category.trim())
  }
  return Array.from(set)
})

const editDialogVisible = ref(false)
const editForm = ref({
  id: '',
  title: '',
  name: '',
  address: '',
  note: '',
  content: '',
  todoStatus: 'todo' as TodoStatus,
  priority: 'medium' as TodoPriority,
  category: '',
  status: 'pending' as PointStatus,
  contentStatus: 'undone' as ContentStatus,
  tags: '',
  date: '',
  time: '',
  image: ''
})

const fileInput = ref<HTMLInputElement | null>(null)

/* ============ 工具函数 ============ */
const genId = (prefix: string) => `${prefix}-${Math.random().toString(36).slice(2, 9)}-${Date.now().toString(36)}`
const today = () => new Date().toISOString().slice(0, 10)
const fmtDate = (value: unknown): string => {
  if (typeof value !== 'string' || !value) return ''
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : value.slice(0, 10)
}
const formatDateTime = (value: string) => {
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value
  return d.toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
}
const itemDate = (item: { date?: string; createdAt: string }): string => {
  if (item.date && /^\d{4}-\d{2}-\d{2}$/.test(item.date)) return item.date
  return item.createdAt.slice(0, 10)
}
const priorityLabel = (p: TodoPriority) => (p === 'high' ? '高' : p === 'low' ? '低' : '中')
const priorityTag = (p: TodoPriority): 'danger' | 'warning' | 'info' => (p === 'high' ? 'danger' : p === 'low' ? 'info' : 'warning')
const todoStatusLabel = (s: TodoStatus) => (s === 'done' ? '已完成' : s === 'doing' ? '进行中' : '未开始')
const todoStatusTag = (s: TodoStatus): 'success' | 'warning' | 'info' => (s === 'done' ? 'success' : s === 'doing' ? 'warning' : 'info')
const statusLabel = (s: PointStatus) => (s === 'done' ? '已巡查' : s === 'issue' ? '异常' : '待巡查')
const statusTag = (s: PointStatus): 'success' | 'danger' | 'info' => (s === 'done' ? 'success' : s === 'issue' ? 'danger' : 'info')

/* ============ 当前模块的源数组 ============ */
const source = computed<Array<TodoItem | PointItem | ContentItem>>(() => {
  if (props.type === 'todos') return props.dashboard.todos
  if (props.type === 'points') return props.dashboard.points
  return props.dashboard.contents
})

const inDateRange = (item: { date?: string; createdAt: string }) => {
  if (!dateRange.value) return true
  const [start, end] = dateRange.value
  const d = itemDate(item)
  if (start && d < start) return false
  if (end && d > end) return false
  return true
}

const priorityRank = (p?: TodoPriority) => (p === 'high' ? 3 : p === 'low' ? 1 : 2)

const filteredList = computed(() => {
  const kw = search.value.trim().toLowerCase()
  const list = source.value.filter((item) => {
    if (!inDateRange(item)) return false
    if (props.type === 'todos') {
      const t = item as TodoItem
      const matchKw = !kw || t.title.toLowerCase().includes(kw)
      const matchFilter = todoFilter.value === 'all' || todoFilter.value === t.status
      return matchKw && matchFilter
    }
    if (props.type === 'points') {
      const p = item as PointItem
      return !kw || `${p.name} ${p.address} ${p.note} ${p.category || ''}`.toLowerCase().includes(kw)
    }
    const c = item as ContentItem
    if (props.type === 'contents' && contentCategory.value !== 'all' && (c.category || '') !== contentCategory.value) {
      return false
    }
    return !kw || `${c.title} ${c.content} ${c.date} ${c.category || ''} ${c.tags || ''}`.toLowerCase().includes(kw)
  })

  const todoStatusRank = (s: TodoStatus) => (s === 'todo' ? 3 : s === 'doing' ? 2 : 1)
  const pointStatusRank = (s: PointStatus) => (s === 'issue' ? 3 : s === 'pending' ? 2 : 1) // 异常 > 待巡查 > 已巡查
  const contentStatusRank = (s?: ContentStatus) => (s === 'done' ? 1 : 2) // 未完成 > 已完成
  // 按紧急情况排序：高 > 中 > 低；同优先级未开始>进行中>已完成；再按日期倒序
  return list.sort((a, b) => {
    if (props.type === 'todos') {
      const ta = a as TodoItem, tb = b as TodoItem
      const rankDiff = priorityRank(tb.priority) - priorityRank(ta.priority)
      if (rankDiff !== 0) return rankDiff
      const statusDiff = todoStatusRank(tb.status) - todoStatusRank(ta.status)
      if (statusDiff !== 0) return statusDiff
      return itemDate(tb).localeCompare(itemDate(ta))
    }
    if (props.type === 'points') {
      const pa = a as PointItem, pb = b as PointItem
      const rankDiff = pointStatusRank(pb.status) - pointStatusRank(pa.status)
      if (rankDiff !== 0) return rankDiff
      return itemDate(pb).localeCompare(itemDate(pa))
    }
    // contents：未完成 > 已完成，同状态按日期倒序
    const ca = a as ContentItem, cb = b as ContentItem
    const rankDiff = contentStatusRank(cb.status) - contentStatusRank(ca.status)
    if (rankDiff !== 0) return rankDiff
    return itemDate(cb).localeCompare(itemDate(ca))
  })
})

interface SideVM {
  id: string
  title: string
  subtitle: string
  dateText: string
  status?: string
  badge?: string
  badgeType?: 'primary' | 'success' | 'info' | 'warning' | 'danger'
}

/** 判定条目是否为「今日新增」（createdAt 本地日期 === 今日） */
function isCreatedToday(item: { createdAt: string }): boolean {
  const d = new Date(item.createdAt)
  if (Number.isNaN(d.getTime())) return false
  const now = new Date()
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  )
}

/**
 * 今日新增条目数（在 filteredList 范围内统计），用于「条数减去新增」口径。
 */
const newCountInList = computed(() => filteredList.value.filter((it) => isCreatedToday(it as { createdAt: string })).length)
/**
 * 存量条数 = 实际数据条数 − 今日新增（Fix #4 / #5：不要把新增草稿/今日录入计入存量）。
 */
const backlogCount = computed(() => Math.max(0, filteredList.value.length - newCountInList.value))
const sideItems = computed<SideVM[]>(() => {
  return filteredList.value.map((item) => {
    if (props.type === 'todos') {
      const t = item as TodoItem
      return {
        id: t.id,
        title: t.title,
        subtitle: `${priorityLabel(t.priority)}${t.note ? ' · ' + t.note : ''}`,
        dateText: fmtDate(t.date || t.createdAt),
        status: t.status,
        badge: todoStatusLabel(t.status),
        badgeType: todoStatusTag(t.status)
      }
    }
    if (props.type === 'points') {
      const p = item as PointItem
      return { id: p.id, title: p.name, subtitle: [p.category, p.address, p.note].filter(Boolean).join(' · '), dateText: fmtDate(p.date || p.createdAt), badge: statusLabel(p.status), badgeType: statusTag(p.status) }
    }
    const c = item as ContentItem
    return { id: c.id, title: c.title, subtitle: [c.category, c.tags].filter(Boolean).join(' · ') || c.content.slice(0, 40) + (c.content.length > 40 ? '…' : ''), dateText: `${c.date} ${c.time || ''}` }
  })
})

const findById = (id: string) => {
  if (props.type === 'todos') return props.dashboard.todos.find((i) => i.id === id) || null
  if (props.type === 'points') return props.dashboard.points.find((i) => i.id === id) || null
  return props.dashboard.contents.find((i) => i.id === id) || null
}

/* ============ 报表列定义 ============ */
interface ReportCol { key: string; label: string; tag?: boolean }
const todoColumns: ReportCol[] = [
  { key: 'title', label: '标题' },
  { key: 'status', label: '状态', tag: true },
  { key: 'priority', label: '优先级', tag: true },
  { key: 'date', label: '日期' },
  { key: 'note', label: '备注' }
]
const pointColumns: ReportCol[] = [
  { key: 'name', label: '名称' },
  { key: 'address', label: '地址' },
  { key: 'category', label: '分类' },
  { key: 'status', label: '巡检状态', tag: true },
  { key: 'date', label: '日期' }
]
const contentColumns: ReportCol[] = [
  { key: 'title', label: '标题' },
  { key: 'category', label: '分类' },
  { key: 'status', label: '状态', tag: true },
  { key: 'tags', label: '标签' },
  { key: 'date', label: '日期' },
  { key: 'time', label: '时间' }
]

const reportMode = ref<'todos' | 'points' | 'contents'>('contents')

const visibleColumns = computed(() => {
  if (reportMode.value === 'todos') return todoColumns
  if (reportMode.value === 'points') return pointColumns
  return contentColumns
})

const contentStatusLabel = (s?: ContentStatus) => (s === 'done' ? '已完成' : '未完成')
const contentStatusTag = (s?: ContentStatus): 'success' | 'info' => (s === 'done' ? 'success' : 'info')

const reportRows = computed<Array<Record<string, any>>>(() => {
  if (reportMode.value === 'todos') {
    return (props.dashboard.todos as TodoItem[]).map((t) => {
      const statusText = t.status === 'done' ? '已完成' : t.status === 'doing' ? '进行中' : '未开始'
      const statusType = t.status === 'done' ? 'success' : t.status === 'doing' ? 'warning' : 'info'
      return {
        _id: t.id,
        title: t.title,
        status: { text: statusText, type: statusType },
        priority: { text: t.priority === 'high' ? '高' : t.priority === 'low' ? '低' : '中', type: t.priority === 'high' ? 'danger' : t.priority === 'low' ? 'info' : 'warning' },
        date: itemDate(t),
        note: t.note || '—'
      }
    })
  }
  if (reportMode.value === 'points') {
    return (props.dashboard.points as PointItem[]).map((p) => ({
      _id: p.id,
      name: p.name,
      address: p.address,
      category: p.category || '—',
      status: { text: p.status === 'done' ? '已巡查' : p.status === 'issue' ? '异常' : '待巡查', type: p.status === 'done' ? 'success' : p.status === 'issue' ? 'danger' : 'info' },
      date: itemDate(p)
    }))
  }
  return (props.dashboard.contents as ContentItem[]).map((c) => ({
    _id: c.id,
    title: c.title,
    category: c.category || '—',
    status: { text: contentStatusLabel(c.status), type: contentStatusTag(c.status) },
    tags: c.tags || '—',
    date: c.date,
    time: c.time
  }))
})

/* ============ 交互 ============ */
const openEditById = (id: string) => {
  const item = findById(id)
  if (item) openEdit(item)
}

const removeItem = async (id: string) => {
  const item = findById(id)
  if (!item) return
  try {
    await ElMessageBox.confirm(`确认删除该${typeLabel.value}？删除后不可恢复。`, '删除确认', { type: 'warning' })
  } catch {
    return
  }
  if (props.type === 'todos') props.dashboard.todos = props.dashboard.todos.filter((i) => i.id !== id)
  else if (props.type === 'points') props.dashboard.points = props.dashboard.points.filter((i) => i.id !== id)
  else props.dashboard.contents = props.dashboard.contents.filter((i) => i.id !== id)
  await props.onSave()
  ElMessage.success('已删除')
}

const cycleTodoStatus = async (id: string) => {
  const target = props.dashboard.todos.find((i) => i.id === id)
  if (!target) return
  const next: Record<TodoStatus, TodoStatus> = { todo: 'doing', doing: 'done', done: 'todo' }
  target.status = next[target.status] || 'todo'
  await props.onSave()
  ElMessage.success(`状态已更新为：${todoStatusLabel(target.status)}`)
}

/** 点位巡检状态快速切换（Fix #4）：待巡查 → 异常 → 已巡查 → 待巡查 */
const cyclePointStatus = async (id: string) => {
  const target = props.dashboard.points.find((i) => i.id === id)
  if (!target) return
  const next: Record<PointStatus, PointStatus> = { pending: 'issue', issue: 'done', done: 'pending' }
  target.status = next[target.status] || 'pending'
  await props.onSave()
  ElMessage.success(`巡检状态已更新为：${statusLabel(target.status)}`)
}

/** 内容分类快速设置（Fix #5）：弹窗输入分类后保存 */
const editCategory = async (id: string) => {
  const target = props.dashboard.contents.find((i) => i.id === id)
  if (!target) return
  try {
    const { value } = await ElMessageBox.prompt('设置该内容的分类（如 日报 / 周报 / 笔记）', '分类', {
      inputValue: target.category || '',
      confirmButtonText: '保存',
      cancelButtonText: '取消',
      inputValidator: (v) => (v && v.trim() ? true : '分类不能为空')
    })
    target.category = value.trim()
    await props.onSave()
    ElMessage.success('分类已更新')
  } catch {
    /* 取消 */
  }
}

const duplicateItem = (id: string) => {
  const item = findById(id)
  if (!item) return
  const anyItem = item as unknown as Record<string, any>
  openEdit(item)
  editForm.value.id = ''
  if (props.type === 'todos') editForm.value.title = (editForm.value.title || '') + ' - 副本'
  if (props.type === 'points') editForm.value.name = (editForm.value.name || '') + ' - 副本'
  if (props.type === 'contents') editForm.value.title = (editForm.value.title || '') + ' - 副本'
}

const clearAll = async () => {
  try {
    await ElMessageBox.confirm('确认清空当前列表的全部数据？', '清空', { type: 'warning' })
  } catch {
    return
  }
  if (props.type === 'todos') props.dashboard.todos = []
  else if (props.type === 'points') props.dashboard.points = []
  else props.dashboard.contents = []
  await props.onSave()
  ElMessage.success('已清空')
}

/* ============ 新增 / 编辑 ============ */
const editTitle = computed(() => (editForm.value.id ? `编辑${typeLabel.value}` : `新增${typeLabel.value}`))

const openAdd = () => {
  Object.assign(editForm.value, {
    id: '',
    title: '',
    name: '',
    address: '',
    note: '',
    content: '',
    todoStatus: 'todo',
    priority: 'medium',
    category: '',
    status: 'pending',
    contentStatus: 'undone',
    tags: '',
    date: today(),
    time: '09:00',
    image: ''
  })
  editDialogVisible.value = true
}

const openEdit = (item: TodoItem | PointItem | ContentItem) => {
  const anyItem = item as unknown as Record<string, any>
  editForm.value.id = anyItem.id ?? ''
  editForm.value.todoStatus = (anyItem.status as TodoStatus) || 'todo'
  editForm.value.title = anyItem.title ?? anyItem.name ?? ''
  editForm.value.name = anyItem.name ?? ''
  editForm.value.address = anyItem.address ?? ''
  editForm.value.note = anyItem.note ?? ''
  editForm.value.content = anyItem.content ?? ''
  editForm.value.priority = (anyItem.priority as TodoPriority) || 'medium'
  editForm.value.category = anyItem.category ?? ''
  editForm.value.status = (anyItem.status as PointStatus) || 'pending'
  editForm.value.contentStatus = (anyItem.status as ContentStatus) || 'undone'
  editForm.value.tags = anyItem.tags ?? ''
  editForm.value.date = anyItem.date || (anyItem.createdAt ? anyItem.createdAt.slice(0, 10) : today())
  editForm.value.time = anyItem.time || '09:00'
  editForm.value.image = anyItem.image ?? ''
  editDialogVisible.value = true
}

const handleEditImage = (event: Event) => {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = () => { editForm.value.image = reader.result as string }
  reader.readAsDataURL(file)
}

const submitEdit = async () => {
  const id = editForm.value.id
  const f = editForm.value

  if (props.type === 'todos') {
    const title = f.title.trim() || '未命名待办'
    const date = f.date || today()
    const status = f.todoStatus || 'todo'
    if (id) {
      const target = props.dashboard.todos.find((i) => i.id === id)
      if (target) {
        target.title = title
        target.status = status
        target.priority = f.priority
        target.note = f.note.trim()
        target.date = date
      }
    } else {
      props.dashboard.todos.unshift({ id: genId('todo'), title, status, priority: f.priority, note: f.note.trim(), date, createdAt: new Date().toISOString() })
    }
  } else if (props.type === 'points') {
    const name = f.name.trim()
    const address = f.address.trim()
    if (!name || !address) {
      ElMessage.warning('请填写点位名称和地址')
      return
    }
    const date = f.date || today()
    if (id) {
      const target = props.dashboard.points.find((i) => i.id === id)
      if (target) {
        target.name = name
        target.address = address
        target.note = f.note.trim()
        target.category = f.category.trim()
        target.status = f.status
        target.date = date
      }
    } else {
      props.dashboard.points.unshift({ id: genId('point'), name, address, note: f.note.trim(), category: f.category.trim(), status: f.status, date, createdAt: new Date().toISOString() })
    }
  } else {
    const title = f.title.trim()
    const content = f.content.trim()
    if (!title || !content) {
      ElMessage.warning('请填写标题和正文内容')
      return
    }
    const date = f.date || today()
    const time = f.time || '09:00'
    if (id) {
      const target = props.dashboard.contents.find((i) => i.id === id)
      if (target) {
        target.title = title
        target.content = content
        target.category = f.category.trim()
        target.tags = f.tags.trim()
        target.date = date
        target.time = time
        target.image = f.image
      }
    } else {
      props.dashboard.contents.unshift({ id: genId('content'), title, content, category: f.category.trim(), tags: f.tags.trim(), status: f.contentStatus, date, time, image: f.image, createdAt: new Date().toISOString() })
    }
  }

  await props.onSave()
  editDialogVisible.value = false
  ElMessage.success(id ? '已保存' : '已新增')
}

/* ============ 导出 / 导入 ============ */
const csvCell = (value: unknown): string => {
  const s = String(value ?? '')
  if (/[",\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"'
  return s
}
const toTodosCsv = (items: TodoItem[]) =>
  ['标题,状态,优先级,备注,日期,创建时间', ...items.map((i) => [i.title, todoStatusLabel(i.status), priorityLabel(i.priority), i.note || '', fmtDate(i.date || i.createdAt), i.createdAt].map(csvCell).join(','))].join('\n')
const toPointsCsv = (items: PointItem[]) =>
  ['名称,地址,备注,分类,状态,日期,创建时间', ...items.map((i) => [i.name, i.address, i.note, i.category || '', statusLabel(i.status), fmtDate(i.date || i.createdAt), i.createdAt].map(csvCell).join(','))].join('\n')
const toContentsCsv = (items: ContentItem[]) =>
  ['标题,正文,分类,标签,日期,时间,图片,创建时间', ...items.map((i) => [i.title, i.content, i.category || '', i.tags || '', i.date, i.time, i.image, i.createdAt].map(csvCell).join(','))].join('\n')
const templateCsv = (): string => {
  if (props.type === 'todos') return '标题,状态,优先级,备注,日期,创建时间'
  if (props.type === 'points') return '名称,地址,备注,分类,状态,日期,创建时间'
  return '标题,正文,分类,标签,日期,时间,图片,创建时间'
}

const downloadFile = (content: string, filename: string, mime: string) => {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}
const exportCsv = () => {
  const content = props.type === 'todos' ? toTodosCsv(props.dashboard.todos) : props.type === 'points' ? toPointsCsv(props.dashboard.points) : toContentsCsv(props.dashboard.contents)
  downloadFile('﻿' + content, `${props.type}-${today()}.csv`, 'text/csv;charset=utf-8;')
  ElMessage.success('已导出 CSV')
}
const exportJson = () => {
  const data = props.type === 'todos' ? props.dashboard.todos : props.type === 'points' ? props.dashboard.points : props.dashboard.contents
  downloadFile(JSON.stringify(data, null, 2), `${props.type}-${today()}.json`, 'application/json')
  ElMessage.success('已导出 JSON')
}
const downloadTemplate = () => {
  downloadFile('﻿' + templateCsv(), `${props.type}-template.csv`, 'text/csv;charset=utf-8;')
  ElMessage.success('已下载导入模板')
}

const onMoreCommand = (command: string) => {
  if (command === 'export-csv') exportCsv()
  else if (command === 'export-json') exportJson()
  else if (command === 'import') fileInput.value?.click()
  else if (command === 'template') downloadTemplate()
  else if (command === 'clear-all') clearAll()
}

const parseSimpleCsv = (text: string): string[][] => {
  const rows: string[][] = []
  let row: string[] = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i]
    const next = text[i + 1]
    if (char === '"') {
      if (inQuotes && next === '"') { current += '"'; i += 1 }
      else inQuotes = !inQuotes
      continue
    }
    if (char === ',' && !inQuotes) { row.push(current); current = ''; continue }
    if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && text[i + 1] === '\n') i += 1
      row.push(current)
      if (row.some((value) => value.trim())) rows.push(row)
      row = []
      current = ''
      continue
    }
    current += char
  }
  if (current || row.length) {
    row.push(current)
    if (row.some((value) => value.trim())) rows.push(row)
  }
  return rows
}
const mapRecord = (headers: string[], row: string[]) => {
  const rec: Record<string, string> = {}
  headers.forEach((h, i) => { rec[h] = row[i] ?? '' })
  return rec
}

const normalizePriority = (raw: string): TodoPriority => {
  const pr = raw.trim().toLowerCase()
  if (pr.includes('高') || pr === 'high' || pr === '1' || pr === 'urgent') return 'high'
  if (pr.includes('低') || pr === 'low' || pr === '3') return 'low'
  return 'medium'
}

const importCsv = (text: string) => {
  const rows = parseSimpleCsv(text)
  const headerRow = rows[0]
  if (!headerRow) { ElMessage.warning('文件缺少表头'); return }
  const headers = headerRow.map((h) => h.trim().toLowerCase())
  const body = rows.slice(1).filter((r) => r.some((v) => v.trim()))
  let added = 0

  if (props.type === 'todos') {
    body.forEach((row, idx) => {
      const rec = mapRecord(headers, row)
      const title = rec['标题'] || rec['title'] || rec['名称'] || `待办 ${idx + 1}`
      if (!title.trim()) return
      const raw = String(rec['状态'] ?? rec['是否完成'] ?? '').trim().toLowerCase()
      let status: TodoStatus = 'todo'
      if (raw === '已完成' || raw === '完成' || raw === 'done' || raw === 'true' || raw === '1') status = 'done'
      else if (raw === '进行中' || raw === 'doing' || raw === '2') status = 'doing'
      const priority = normalizePriority(rec['优先级'] || rec['priority'] || '')
      props.dashboard.todos.unshift({ id: genId('todo'), title: title.trim(), status, priority, note: rec['备注'] || rec['note'] || '', date: rec['日期'] || rec['date'] || today(), createdAt: new Date().toISOString() })
      added += 1
    })
  } else if (props.type === 'points') {
    body.forEach((row, idx) => {
      const rec = mapRecord(headers, row)
      const name = rec['名称'] || rec['name'] || rec['标题'] || `点位 ${idx + 1}`
      const address = rec['地址'] || rec['address'] || ''
      if (!name.trim() || !address.trim()) return
      const st = String(rec['状态'] || rec['status'] || '').toLowerCase()
      const status = st === '已巡查' || st === 'done' ? 'done' : st === '异常' || st === 'issue' ? 'issue' : 'pending'
      props.dashboard.points.unshift({ id: genId('point'), name: name.trim(), address: address.trim(), note: rec['备注'] || rec['note'] || '', category: rec['分类'] || rec['category'] || '', status, date: rec['日期'] || rec['date'] || today(), createdAt: new Date().toISOString() })
      added += 1
    })
  } else {
    body.forEach((row, idx) => {
      const rec = mapRecord(headers, row)
      const title = rec['标题'] || rec['title'] || `内容 ${idx + 1}`
      const content = rec['正文'] || rec['content'] || rec['内容'] || ''
      if (!title.trim() || !content.trim()) return
      props.dashboard.contents.unshift({ id: genId('content'), title: title.trim(), content: content.trim(), category: rec['分类'] || rec['category'] || '', tags: rec['标签'] || rec['tags'] || '', status: 'undone', date: rec['日期'] || rec['date'] || today(), time: rec['时间'] || rec['time'] || '09:00', image: rec['图片'] || rec['image'] || '', createdAt: new Date().toISOString() })
      added += 1
    })
  }
  finishImport(added)
}

const importJson = (text: string) => {
  let parsed: unknown
  try { parsed = JSON.parse(text) } catch { ElMessage.error('JSON 解析失败，请检查文件格式'); return }
  if (!Array.isArray(parsed)) { ElMessage.error('JSON 顶层应为数组'); return }
  let added = 0
  parsed.forEach((raw) => {
    if (!raw || typeof raw !== 'object') return
    const item = raw as Record<string, any>
    if (props.type === 'todos') {
      const title = String(item.title || item.标题 || item.name || '').trim()
      if (!title) return
      const priority = normalizePriority(String(item.priority || item.优先级 || ''))
      let status: TodoStatus = 'todo'
      const rawStatus = String(item.status || item.状态 || '').toLowerCase()
      if (rawStatus === '已完成' || rawStatus === '完成' || rawStatus === 'done' || rawStatus === 'true' || rawStatus === '1') status = 'done'
      else if (rawStatus === '进行中' || rawStatus === 'doing' || rawStatus === '2') status = 'doing'
      else if (item.done === true || item.是否完成 === true || String(item.done).toLowerCase() === 'true' || String(item.是否完成).toLowerCase() === '已完成') status = 'done'
      props.dashboard.todos.unshift({ id: genId('todo'), title, status, priority, note: String(item.note || item.备注 || ''), date: String(item.date || item.日期 || today()), createdAt: new Date().toISOString() })
      added += 1
    } else if (props.type === 'points') {
      const name = String(item.name || item.名称 || item.title || '').trim()
      const address = String(item.address || item.地址 || '').trim()
      if (!name || !address) return
      const st = String(item.status || item.状态 || '').toLowerCase()
      const status = st === 'done' || st === '已巡查' ? 'done' : st === 'issue' || st === '异常' ? 'issue' : 'pending'
      props.dashboard.points.unshift({ id: genId('point'), name, address, note: String(item.note || item.备注 || ''), category: String(item.category || item.分类 || ''), status, date: String(item.date || item.日期 || today()), createdAt: new Date().toISOString() })
      added += 1
    } else {
      const title = String(item.title || item.标题 || '').trim()
      const content = String(item.content || item.正文 || item.内容 || '').trim()
      if (!title || !content) return
      props.dashboard.contents.unshift({ id: genId('content'), title, content, category: String(item.category || item.分类 || ''), tags: String(item.tags || item.标签 || ''), status: 'undone', date: String(item.date || item.日期 || today()), time: String(item.time || item.时间 || '09:00'), image: String(item.image || item.图片 || ''), createdAt: new Date().toISOString() })
      added += 1
    }
  })
  finishImport(added)
}

const finishImport = (added: number) => {
  if (added > 0) {
    void props.onSave()
    ElMessage.success(`已导入 ${added} 条${typeLabel.value}`)
  } else {
    ElMessage.warning('没有符合要求的记录')
  }
}

const importFile = (event: Event) => {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) return
  const ext = file.name.split('.').pop()?.toLowerCase()
  file.text().then((rawText) => {
    const text = rawText.replace(/^\uFEFF/, '')
    if (ext === 'csv') importCsv(text)
    else if (ext === 'json') importJson(text)
    else ElMessage.error('仅支持 CSV / JSON 文件')
    target.value = ''
  })
}
</script>

<style scoped>
.mm-shell {
  display: flex;
  flex-direction: column;
  gap: 18px;
  max-width: 1200px;
  margin: 0 auto;
}

/* 顶部工具栏 */
.mm-topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
  background: rgba(255, 255, 255, 0.95);
  border: 1px solid rgba(99, 102, 241, 0.1);
  border-radius: 20px;
  padding: 16px 18px;
  box-shadow: 0 8px 28px rgba(15, 23, 42, 0.05);
  backdrop-filter: blur(8px);
}
.mm-topbar-title {
  display: flex;
  align-items: center;
  gap: 12px;
}
.mm-title-icon {
  width: 44px;
  height: 44px;
  border-radius: 14px;
  display: grid;
  place-items: center;
  font-size: 20px;
  font-weight: 700;
  color: #fff;
  flex-shrink: 0;
  box-shadow: 0 6px 16px rgba(0,0,0,0.12);
}
.mm-title-icon.todos { background: linear-gradient(135deg, #6366f1, #8b5cf6); }
.mm-title-icon.points { background: linear-gradient(135deg, #0ea5e9, #38bdf8); }
.mm-title-icon.contents { background: linear-gradient(135deg, #10b981, #34d399); }
.mm-topbar-title h2 { margin: 0; font-size: 18px; font-weight: 700; color: #0f172a; }
.mm-title-tip { margin: 2px 0 0; font-size: 12px; color: #64748b; }
.mm-toolbar {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
  min-width: 0;
}
.mm-toolbar > * { flex-shrink: 0; }
.mm-toolbar .mm-search { width: 200px; }
.mm-toolbar .mm-date-range { width: 240px; }
.mm-toolbar .mm-filter { width: 120px; }
.mm-toolbar .mm-add-btn {
  background: linear-gradient(90deg, #6366f1, #38bdf8);
  border: none;
  font-weight: 600;
  box-shadow: 0 6px 16px rgba(99, 102, 241, 0.28);
}
.mm-toolbar .mm-add-btn span { margin-left: 4px; }

/* 数据条列表 */
.mm-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.mm-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  background: #fff;
  border: 1px solid rgba(99, 102, 241, 0.08);
  border-radius: 16px;
  padding: 14px 16px 14px 18px;
  box-shadow: 0 6px 18px rgba(15, 23, 42, 0.04);
  transition: all 0.2s ease;
  position: relative;
  overflow: hidden;
}
.mm-item::before {
  content: '';
  position: absolute;
  left: 0;
  top: 12px;
  bottom: 12px;
  width: 4px;
  border-radius: 0 4px 4px 0;
}
.mm-item.todos::before { background: linear-gradient(180deg, #6366f1, #8b5cf6); box-shadow: 0 0 10px rgba(99, 102, 241, 0.45); }
.mm-item.points::before { background: linear-gradient(180deg, #0ea5e9, #38bdf8); box-shadow: 0 0 10px rgba(14, 165, 233, 0.45); }
.mm-item.contents::before { background: linear-gradient(180deg, #10b981, #34d399); box-shadow: 0 0 10px rgba(16, 185, 129, 0.45); }
.mm-item:hover {
  transform: translateY(-2px);
  box-shadow: 0 12px 28px rgba(15, 23, 42, 0.1);
  border-color: rgba(99, 102, 241, 0.18);
}
.mm-item.is-done .mm-item-title { text-decoration: line-through; color: #94a3b8; }
.mm-item-main {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  cursor: pointer;
}
.mm-item-info { min-width: 0; }
.mm-item-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
  font-weight: 600;
  color: #0f172a;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.mm-badge { transform: scale(0.9); transform-origin: left center; }
.mm-item-sub {
  font-size: 12px;
  color: #64748b;
  margin-top: 4px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.mm-item-extra { flex-shrink: 0; }
.mm-item-date {
  font-size: 12px;
  color: #94a3b8;
  background: #f8fafc;
  padding: 4px 10px;
  border-radius: 8px;
}
.mm-item-actions {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
}
.mm-item-actions .el-button { padding: 5px 8px; }
.mm-item-actions .el-button span { margin-left: 3px; }
.mm-empty {
  text-align: center;
  color: #94a3b8;
  padding: 56px 20px;
  background: #fff;
  border: 1px dashed #e2e8f0;
  border-radius: 16px;
}
.mm-empty :deep(svg) { font-size: 36px; margin-bottom: 10px; }
.mm-empty p { font-size: 13px; margin: 0; }
.hidden-file { display: none; }

/* 编辑弹框 */
.mm-form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0 18px; }
.mm-form-grid > .el-form-item { margin-bottom: 18px; }
.mm-form-grid > .full { grid-column: span 2; }
.inline-fields { display: flex; gap: 12px; }
.inline-fields :deep(.el-form-item) { flex: 1; margin-bottom: 18px; }
.file-input { margin-bottom: 8px; }
.preview-box { margin-top: 8px; }
.preview-box img { max-width: 180px; border-radius: 10px; }

/* 移动端适配 */
@media (max-width: 768px) {
  .mm-topbar { flex-direction: column; align-items: stretch; gap: 12px; }
  .mm-toolbar { flex-direction: column; align-items: stretch; }
  .mm-toolbar .mm-search,
  .mm-toolbar .mm-date-range,
  .mm-toolbar .mm-filter,
  .mm-toolbar .mm-more,
  .mm-toolbar .mm-add-btn { width: 100%; }
  .mm-toolbar .mm-add-btn { justify-content: center; }
  .mm-item { flex-direction: column; align-items: stretch; gap: 10px; padding-left: 16px; }
  .mm-item::before { top: 0; bottom: auto; width: 100%; height: 3px; border-radius: 0 0 4px 4px; }
  .mm-item-main { flex-direction: column; align-items: flex-start; gap: 6px; }
  /* 移动端操作按钮：均分整行、加大触控区，避免文字挤压/出屏 */
  .mm-item-actions {
    justify-content: stretch;
    flex-wrap: wrap;
    gap: 8px;
    width: 100%;
  }
  .mm-item-actions .el-button {
    flex: 1 1 auto;
    justify-content: center;
    min-height: 38px;
    padding: 8px 6px;
  }
  .mm-item-actions .el-button span { margin-left: 4px; }
  .mm-form-grid { grid-template-columns: 1fr; }
  .mm-form-grid > .full { grid-column: span 1; }
  .inline-fields { flex-direction: column; gap: 0; }
}
</style>
