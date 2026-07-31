<template>
  <div class="db-check">
    <div class="db-header">
      <div>
        <h2>数据库监测中心</h2>
        <p>实时读取 Supabase 数据库现状、存储、数据量与容量预警（当前为免费计划，无需付费）</p>
      </div>
      <el-button type="primary" :loading="loading" @click="runCheck">
        <el-icon><Refresh /></el-icon> 刷新检测
      </el-button>
    </div>

    <div v-if="loading && !stats" class="db-loading">
      <el-icon class="is-loading"><Loading /></el-icon> 正在检测…
    </div>

    <div v-else-if="stats" class="db-body">
      <!-- 容量概览：进度条 + 剩余 + 预警 -->
      <div class="db-capacity" :class="usageStatus">
        <div class="db-capacity-head">
          <span class="db-capacity-title">数据库容量（免费计划 {{ formatBytes(stats.limitBytes) }}）</span>
          <span class="db-capacity-pct">{{ usagePercent }}%</span>
        </div>
        <el-progress
          :percentage="usagePercent"
          :status="progressStatus"
          :stroke-width="14"
          :show-text="false"
        />
        <div class="db-capacity-meta">
          <span>已用 <b>{{ formatBytes(stats.dbSizeBytes) }}</b></span>
          <span>剩余 <b>{{ formatBytes(remainingBytes) }}</b></span>
          <span class="db-capacity-time">检测时间：{{ formatTime(stats.checkedAt) }}</span>
        </div>
        <div v-if="usageStatus === 'warn'" class="db-capacity-alert">
          <el-icon><WarningFilled /></el-icon> 容量使用已超过 80%，建议清理旧数据或导出归档，避免写入受限。
        </div>
        <div v-else-if="usageStatus === 'danger'" class="db-capacity-alert danger">
          <el-icon><WarningFilled /></el-icon> 容量即将用满！数据库会进入只读，请立即清理或升级计划。
        </div>
      </div>

      <div class="db-cards">
        <div class="db-card">
          <div class="db-card-label">连接状态</div>
          <el-tag :type="stats.connected ? 'success' : 'danger'" effect="light">
            {{ stats.connected ? '已连接' : '连接失败' }}
          </el-tag>
        </div>
        <div class="db-card">
          <div class="db-card-label">数据库大小</div>
          <div class="db-card-value">{{ formatBytes(stats.dbSizeBytes) }}</div>
        </div>
        <div class="db-card">
          <div class="db-card-label">数据表数量</div>
          <div class="db-card-value">{{ stats.tables.length }}</div>
        </div>
        <div class="db-card">
          <div class="db-card-label">总数据量（行）</div>
          <div class="db-card-value">{{ totalRows.toLocaleString() }}</div>
        </div>
      </div>

      <!-- 问题 / 告警汇总（全面监测的「问题」维度） -->
      <div class="db-section db-problems">
        <h3>问题 / 告警</h3>
        <div v-if="problems.length === 0" class="db-ok">
          <el-icon><SuccessFilled /></el-icon> 未发现明显问题，数据库状态正常。
        </div>
        <ul v-else class="db-problem-list">
          <li
            v-for="(p, i) in problems"
            :key="i"
            class="db-problem-item"
            :class="p.level"
          >
            <el-icon v-if="p.level === 'danger'"><WarningFilled /></el-icon>
            <el-icon v-else-if="p.level === 'warn'"><WarningFilled /></el-icon>
            <el-icon v-else><InfoFilled /></el-icon>
            <span>{{ p.text }}</span>
          </li>
        </ul>
      </div>

      <div v-if="!stats.connected" class="db-error">
        连接失败：{{ stats.error || '未知错误' }}。
        若为 Supabase 免费项目长时间未访问被暂停（Paused），请前往
        <a :href="stats.apiUrl" target="_blank" rel="noopener">Supabase Dashboard ↗</a>
        点击 Resume 恢复，再刷新本页。
      </div>

      <!-- 各表数据量与内存占比（合并：中文说明 + 行数 + 占用空间 + 空间占比，按空间从高到低实时排序） -->
      <div class="db-section">
        <h3>各表数据量与空间占用（按占用空间从高到低）</h3>
        <el-table :data="mergedTables" style="width: 100%" size="default" empty-text="暂无数据表" row-key="name">
          <el-table-column label="数据表" min-width="220">
            <template #default="{ row }">
              <div class="tbl-name">{{ row.name }}</div>
              <div class="tbl-desc">{{ tableDesc(row.name) }}</div>
            </template>
          </el-table-column>
          <el-table-column prop="rows" label="行数" width="130" sortable>
            <template #default="{ row }"><span class="row-num">{{ row.rows.toLocaleString() }}</span></template>
          </el-table-column>
          <el-table-column label="占用空间" width="130" sortable prop="size">
            <template #default="{ row }">
              <span class="row-num">{{ formatBytes(row.size) }}</span>
            </template>
          </el-table-column>
          <el-table-column label="空间占比" min-width="240">
            <template #default="{ row }">
              <div class="mem-inline">
                <span class="mem-pct" :class="{ danger: row.pct > 40 }">{{ row.pct }}%</span>
                <el-progress
                  :percentage="row.pct"
                  :stroke-width="8"
                  :show-text="false"
                  :color="row.pct > 40 ? '#ef4444' : 'var(--primary)'"
                  class="mem-bar"
                />
              </div>
            </template>
          </el-table-column>
          <el-table-column label="RLS" width="120">
            <template #default="{ row }">
              <el-tag v-if="row.rlsEnabled === true" type="success" effect="light" size="small">已启用</el-tag>
              <el-tag v-else-if="row.rlsEnabled === false" type="danger" effect="light" size="small">未启用</el-tag>
              <span v-else class="row-num">未知</span>
            </template>
          </el-table-column>
        </el-table>
        <p class="db-tip">
          说明：中文说明用于快速识别业务表用途；新表建好后自动出现在此（来自 Supabase 实时统计）。
          未登记的表会按表名智能推测中文说明，可在 <code>DatabaseCheckView.vue</code> 的 <code>TABLE_DESC</code> 中补充正式说明。
          RLS 列显示该表是否启用行级安全，「未启用」为高危项（见上方「问题 / 告警」）。
        </p>
      </div>

      <div v-if="stats.error" class="db-error">读取详情失败：{{ stats.error }}</div>
      <div class="db-tip">
        提示：若数据库大小为 0 / 表行数为 0，请在 Supabase 执行
        <code>scripts/supabase_stats.sql</code> 启用精确统计（否则使用逐表估算）。
        免费计划数据库容量上限为 {{ formatBytes(stats.limitBytes) }}，超出后写入受限。
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { Refresh, Loading, WarningFilled, SuccessFilled, InfoFilled } from '@element-plus/icons-vue'
import { getDatabaseStats, type DatabaseStats } from '../services/appDataService'

/** 数据表中文说明映射，便于快速查询业务表用途 */
const TABLE_DESC: Record<string, string> = {
  app_accounts: '用户账号表：存储登录账号、密码哈希、角色与禁用状态',
  profiles: '用户资料表：昵称、角色配置、AI 配置（密钥仅本地存储）',
  app_settings: '应用配置表：角色权限、系统级开关、自动化缓存天数等键值配置',
  app_dashboard_data: '看板数据表：各用户工作台数据快照',
  news_daily: '每日新闻缓存表：自动化信息生成结果的本地缓存',
  external_ideas: '外部灵感表：需求收集页抓取并落库的灵感条目',
  automation_info: '自动化信息缓存表：自动化生成结果，按保留天数过期清理',
  free_model_catalog: '免费模型目录表：各厂商公开免费档模型清单',
  todos: '待办表：工作任务中的待办事项',
  points: '点位表：工作任务中的点位数据',
  contents: '内容表：工作任务中的内容条目',
  ai_keys: 'AI 密钥表：各账号加密存储的 API Key，本人可读写、超管可查看',
  model_usage: '模型用量账本：各账号调用百炼模型的 tokens 累计，用于额度扣减',
  usage_records: '用量记录表：AI 调用明细与 tokens 记录',
  auth_users: '认证用户表：Supabase Auth 底层账号（含邮箱、登录方式）',
  custom_free_models: '自定义免费模型表：用户在模型中心登记的自有免费 AI 模型',
  shared_free_api_keys: '共享免费 Key 表：超管统一配置、全账号共享的免费 API Key',
  car_watchlist: '星舆识途·自选车表：用户关注的汽车/品牌清单',
  model_bookmarks: 'AI 模型知识·收藏表：用户收藏的全局模型',
  learn_progress: '学习中心·进度表：各行业知识/词条的学习掌握状态',
  learn_bookmarks: '学习中心·书签表：生词/行业知识点/书籍收藏',
  learn_reading: '学习中心·阅读记录表：书籍阅读进度与上次位置'
}

/** 常见表名片段 → 中文词，用于未登记表的智能推测说明 */
const WORD_MAP: Record<string, string> = {
  account: '账号', profile: '资料', setting: '配置', dashboard: '看板',
  news: '新闻', idea: '灵感', automation: '自动化', model: '模型',
  usage: '用量', key: '密钥', token: '令牌', log: '日志', cache: '缓存',
  order: '订单', user: '用户', task: '任务', point: '点位', content: '内容',
  free: '免费', catalog: '目录', external: '外部', daily: '每日', record: '记录',
  admin: '管理', stat: '统计', data: '数据', info: '信息', msg: '消息',
  chat: '对话', message: '消息', file: '文件', upload: '上传', tag: '标签',
  category: '分类', comment: '评论', config: '配置', session: '会话'
}

/** 未登记的表自动按表名片段拼出中文说明，避免显示「未登记」 */
function guessDesc(name: string): string {
  const parts = String(name).split(/[_-]/).filter(Boolean)
  const segs = parts.map((p) => WORD_MAP[p.toLowerCase()] || p)
  const cn = segs.join('')
  return `（推测）${cn}表：自动识别到的数据表，建议在 TABLE_DESC 补充正式说明`
}

function tableDesc(name: string): string {
  return TABLE_DESC[name] || guessDesc(name)
}

const stats = ref<DatabaseStats | null>(null)
const loading = ref(false)

const totalRows = computed(() =>
  stats.value ? stats.value.tables.reduce((s, t) => s + t.rows, 0) : 0
)

/** 全部表的占用空间总和（用于计算各表占比） */
const totalSize = computed(() =>
  stats.value ? stats.value.tables.reduce((s, t) => s + (Number(t.sizeBytes) || 0), 0) : 0
)

/** 合并表：表名 + 中文说明 + 行数 + 占用空间 + 空间占比(%)，按占用空间从高到低实时排序 */
const mergedTables = computed(() => {
  if (!stats.value) return []
  return [...stats.value.tables]
    .map((t) => {
      const size = Number(t.sizeBytes) || 0
      return {
        name: t.name,
        rows: Number(t.rows) || 0,
        size,
        rlsEnabled: t.rlsEnabled,
        pct: totalSize.value > 0 ? Math.round((size / totalSize.value) * 1000) / 10 : 0
      }
    })
    .sort((a, b) => b.size - a.size) // 占用空间从高到低
})

function memPercent(size: number): number {
  if (!size || !totalSize.value) return 0
  return Math.min(100, Math.round((size / totalSize.value) * 100))
}

/**
 * 数据库问题与告警汇总（全面监测的「问题」维度）：
 * - 连接失败 / 容量预警
 * - 表未启用 RLS（已知为 false 才告警，未知不误报）
 * - 表缺少正式中文说明（TABLE_DESC 未登记，显示「推测」）
 * level: danger(严重) | warn(警告) | info(提示)
 */
const problems = computed(() => {
  const list: { level: 'danger' | 'warn' | 'info'; text: string }[] = []
  const s = stats.value
  if (!s) return list
  if (!s.connected) {
    list.push({
      level: 'danger',
      text: `数据库连接失败：${s.error || '未知错误'}（多为 Supabase 免费项目长时间未访问被暂停，请到 Dashboard 点击 Resume 恢复）`
    })
  }
  if (usageStatus.value === 'danger') {
    list.push({ level: 'danger', text: '数据库容量即将用满，写入将被限制，请立即清理历史数据或升级计划。' })
  } else if (usageStatus.value === 'warn') {
    list.push({ level: 'warn', text: '数据库容量使用已超过 80%，建议清理旧数据或导出归档，避免写入受限。' })
  }
  for (const t of mergedTables.value) {
    if (t.rlsEnabled === false) {
      list.push({ level: 'danger', text: `表「${t.name}」未启用行级安全（RLS），存在越权读取风险，请尽快开启 RLS。` })
    }
    if (tableDesc(t.name).startsWith('（推测）')) {
      list.push({ level: 'info', text: `表「${t.name}」缺少正式中文说明，建议在 DatabaseCheckView.vue 的 TABLE_DESC 补充。` })
    }
  }
  return list
})

const usagePercent = computed(() => {
  if (!stats.value || !stats.value.dbSizeBytes || !stats.value.limitBytes) return 0
  const pct = (stats.value.dbSizeBytes / stats.value.limitBytes) * 100
  return Math.min(100, Math.round(pct * 10) / 10)
})

const remainingBytes = computed(() => {
  if (!stats.value || !stats.value.dbSizeBytes || !stats.value.limitBytes) return 0
  return Math.max(0, stats.value.limitBytes - stats.value.dbSizeBytes)
})

const usageStatus = computed<'safe' | 'warn' | 'danger'>(() => {
  if (usagePercent.value >= 95) return 'danger'
  if (usagePercent.value >= 80) return 'warn'
  return 'safe'
})

const progressStatus = computed<'success' | 'warning' | 'exception' | ''>(() => {
  if (usageStatus.value === 'danger') return 'exception'
  if (usageStatus.value === 'warn') return 'warning'
  return 'success'
})

function formatBytes(bytes?: number): string {
  if (!bytes || bytes <= 0) return '—'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let i = 0
  let n = bytes
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024
    i++
  }
  return `${n.toFixed(2)} ${units[i]}`
}

function formatTime(ts?: number): string {
  if (!ts) return '—'
  const d = new Date(ts)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

async function runCheck() {
  loading.value = true
  try {
    stats.value = await getDatabaseStats()
  } finally {
    loading.value = false
  }
}

onMounted(runCheck)
</script>

<style scoped>
.db-check {
  padding: 24px;
  max-width: 1080px;
  margin: 0 auto;
  color: var(--text);
}
.db-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 20px;
}
.db-header h2 {
  margin: 0 0 6px;
  font-size: 22px;
  color: var(--text-strong);
}
.db-header p {
  margin: 0;
  font-size: 13px;
  color: var(--text-muted);
}
.db-loading {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--text-muted);
  padding: 40px 0;
  justify-content: center;
}
.is-loading {
  animation: rotating 1.2s linear infinite;
}
@keyframes rotating {
  to { transform: rotate(360deg); }
}

/* 容量概览 */
.db-capacity {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 14px;
  padding: 18px;
  margin-bottom: 18px;
  box-shadow: var(--shadow-card);
}
.db-capacity-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}
.db-capacity-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-strong);
}
.db-capacity-pct {
  font-size: 18px;
  font-weight: 800;
  color: var(--primary);
}
.db-capacity.warn .db-capacity-pct { color: #d97706; }
.db-capacity.danger .db-capacity-pct { color: #dc2626; }
.db-capacity-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  margin-top: 12px;
  font-size: 13px;
  color: var(--text);
}
.db-capacity-meta b { color: var(--text-strong); }
.db-capacity-time { margin-left: auto; color: var(--text-faint); }
.db-capacity-alert {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin-top: 12px;
  background: rgba(217, 119, 6, 0.12);
  color: #b45309;
  border-radius: 10px;
  padding: 10px 14px;
  font-size: 13px;
  line-height: 1.6;
}
.db-capacity-alert.danger {
  background: rgba(220, 38, 38, 0.12);
  color: #b91c1c;
}

.db-cards {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 14px;
  margin-bottom: 22px;
}
.db-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 14px;
  padding: 16px;
  box-shadow: var(--shadow-card);
}
.db-card-label {
  font-size: 12px;
  color: var(--text-muted);
  margin-bottom: 10px;
}
.db-card-value {
  font-size: 24px;
  font-weight: 800;
  color: var(--primary);
}
.db-section {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 14px;
  padding: 18px;
  margin-bottom: 18px;
}
.db-section h3 {
  margin: 0 0 14px;
  font-size: 15px;
  color: var(--text-strong);
}
.tbl-name {
  font-weight: 600;
  color: var(--text-strong);
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 13px;
}
.tbl-desc {
  font-size: 12px;
  color: var(--text-muted);
  margin-top: 2px;
  line-height: 1.4;
}
.row-num {
  font-variant-numeric: tabular-nums;
  font-weight: 600;
  color: var(--text);
}
.db-api-note {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  background: var(--nav-hover);
  border-radius: 10px;
  padding: 12px 14px;
  font-size: 13px;
  color: var(--text);
  line-height: 1.6;
}
.db-api-note a {
  color: var(--primary);
  white-space: nowrap;
  margin-left: 4px;
}

/* 内存占比（合并表内联进度条） */
.mem-list {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.mem-row-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 6px;
  font-size: 13px;
}
.mem-name {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  color: var(--text-strong);
  font-weight: 600;
}
.mem-size {
  color: var(--text-muted);
  font-variant-numeric: tabular-nums;
}
.mem-inline {
  display: flex;
  align-items: center;
  gap: 10px;
}
.mem-pct {
  font-size: 13px;
  font-weight: 700;
  color: var(--primary);
  font-variant-numeric: tabular-nums;
  flex-shrink: 0;
  min-width: 44px;
}
.mem-pct.danger {
  color: #ef4444;
}
.mem-bar {
  flex: 1;
  min-width: 80px;
}

.db-error {
  color: #ef4444;
  font-size: 13px;
  margin-bottom: 12px;
  line-height: 1.7;
}
.db-error a { color: var(--primary); }
.db-tip {
  font-size: 12px;
  color: var(--text-faint);
  line-height: 1.7;
}
.db-tip code {
  background: var(--surface-soft);
  padding: 1px 6px;
  border-radius: 6px;
  color: var(--primary);
  font-size: 11px;
}

/* 问题 / 告警面板 */
.db-problems .db-ok {
  display: flex;
  align-items: center;
  gap: 8px;
  background: rgba(34, 197, 94, 0.12);
  color: #15803d;
  border-radius: 10px;
  padding: 10px 14px;
  font-size: 13px;
  font-weight: 600;
}
.db-problem-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.db-problem-item {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  border-radius: 10px;
  padding: 10px 14px;
  font-size: 13px;
  line-height: 1.6;
}
.db-problem-item .el-icon {
  margin-top: 2px;
  flex-shrink: 0;
}
.db-problem-item.danger {
  background: rgba(220, 38, 38, 0.12);
  color: #b91c1c;
}
.db-problem-item.warn {
  background: rgba(217, 119, 6, 0.12);
  color: #b45309;
}
.db-problem-item.info {
  background: var(--nav-hover);
  color: var(--text);
}

@media (max-width: 768px) {
  .db-check { padding: 16px; }
  .db-header { flex-direction: column; }
  .db-cards { grid-template-columns: repeat(2, 1fr); }
  .db-capacity-time { margin-left: 0; width: 100%; }
}
</style>
