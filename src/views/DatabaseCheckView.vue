<template>
  <div class="db-check">
    <PageHeader title="数据库监测中心" subtitle="实时读取 Supabase 数据库现状、存储、数据量与容量预警（当前为免费计划，无需付费）" :icon="Connection">
      <el-button type="primary" :loading="loading" @click="runCheck">
        <el-icon><Refresh /></el-icon> 刷新检测
      </el-button>
    </PageHeader>

    <div v-if="loading && !stats" class="db-loading">
      <el-icon class="is-loading"><Loading /></el-icon> 正在检测…
    </div>

    <div v-else-if="stats" class="db-body">
      <!-- 容量概览 -->
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

      <!-- 状态速览卡 -->
      <div class="db-cards">
        <div class="db-card" :class="{ bad: !stats.connected }">
          <span class="db-card-icon" :style="{ color: stats.connected ? '#16a34a' : '#ef4444' }">
            <el-icon><Connection /></el-icon>
          </span>
          <div class="db-card-label">连接状态</div>
          <el-tag :type="stats.connected ? 'success' : 'danger'" effect="light">
            {{ stats.connected ? '已连接' : '连接失败' }}
          </el-tag>
        </div>
        <div class="db-card">
          <span class="db-card-icon" :style="{ color: '#3b6fd4' }"><el-icon><Coin /></el-icon></span>
          <div class="db-card-label">数据库大小</div>
          <div class="db-card-value">{{ formatBytes(stats.dbSizeBytes) }}</div>
        </div>
        <div class="db-card">
          <span class="db-card-icon" :style="{ color: '#8b5cf6' }"><el-icon><Grid /></el-icon></span>
          <div class="db-card-label">数据表数量</div>
          <div class="db-card-value">{{ stats.tables.length }}</div>
        </div>
        <div class="db-card">
          <span class="db-card-icon" :style="{ color: '#0ea5e9' }"><el-icon><DataLine /></el-icon></span>
          <div class="db-card-label">总数据量（行）</div>
          <div class="db-card-value">{{ totalRows.toLocaleString() }}</div>
        </div>
      </div>

      <!-- 问题 / 告警 -->
      <div class="db-section">
        <h3 class="db-section-title"><span class="bar"></span>问题 / 告警</h3>
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

      <!-- 数据表分布：分组 + 工具栏 -->
      <div class="db-section">
        <h3 class="db-section-title"><span class="bar"></span>各表数据量与空间占用</h3>

        <div class="db-toolbar">
          <el-input
            v-model="search"
            placeholder="搜索表名 / 说明"
            :prefix-icon="Search"
            clearable
            class="db-search"
          />
          <el-radio-group v-model="filterMode" size="small">
            <el-radio-button label="all">全部</el-radio-button>
            <el-radio-button label="rls-off">仅看未开 RLS</el-radio-button>
            <el-radio-button label="alert">仅看有告警</el-radio-button>
          </el-radio-group>
          <el-select v-model="sortMode" size="small" class="db-sort">
            <el-option label="按占用空间" value="size" />
            <el-option label="按行数" value="rows" />
          </el-select>
        </div>

        <div v-if="groupedTables.length === 0" class="db-empty">没有匹配的表</div>

        <div
          v-for="g in groupedTables"
          :key="g.key"
          class="db-group"
          :style="{ '--gc': g.meta.color }"
        >
          <div class="db-group-head">
            <span class="db-group-dot"></span>
            <span class="db-group-name">{{ g.meta.label }}</span>
            <span class="db-group-count">{{ g.tables.length }} 张表</span>
            <span class="db-group-sum">{{ formatBytes(g.totalSize) }} · {{ g.totalRows.toLocaleString() }} 行</span>
          </div>

          <div class="db-group-body">
            <div
              v-for="t in g.tables"
              :key="t.name"
              class="tbl-row"
              :class="{ 'row-alert': tableHasAlert(t) }"
            >
              <div class="tbl-main">
                <div class="tbl-name">{{ t.name }}</div>
                <div class="tbl-desc">{{ tableDesc(t.name) }}</div>
              </div>
              <div class="tbl-metrics">
                <div class="metric">
                  <span class="m-label">行数</span>
                  <span class="m-val">{{ t.rows.toLocaleString() }}</span>
                </div>
                <div class="metric">
                  <span class="m-label">占用</span>
                  <span class="m-val">{{ formatBytes(t.size) }}</span>
                </div>
                <div class="metric metric-bar">
                  <span class="m-label">占比</span>
                  <div class="m-track">
                    <div class="m-fill" :class="{ danger: t.pct > 40 }" :style="{ width: t.pct + '%' }"></div>
                  </div>
                  <span class="m-pct">{{ t.pct }}%</span>
                </div>
                <div class="metric">
                  <el-tag v-if="t.rlsEnabled === true" type="success" effect="light" size="small">RLS 开</el-tag>
                  <el-tag v-else-if="t.rlsEnabled === false" type="danger" effect="light" size="small">RLS 关</el-tag>
                  <span v-else class="m-val muted">未知</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <p class="db-tip">
          说明：表按业务域分组展示；新表建好后自动出现（来自 Supabase 实时统计），未登记的表会按表名智能推测说明，
          可在 <code>DatabaseCheckView.vue</code> 的 <code>TABLE_DESC</code> 补充。RLS 列显示行级安全状态，「未启用」为高危项（见上方「问题 / 告警」）。
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
import {
  Refresh, Loading, WarningFilled, SuccessFilled, InfoFilled,
  Search, Connection, Coin, Grid, DataLine
} from '@element-plus/icons-vue'
import { getDatabaseStats, type DatabaseStats } from '../services/appDataService'
import PageHeader from '../components/PageHeader.vue'

/** 数据表中文说明映射，便于快速查询业务表用途 */
const TABLE_DESC: Record<string, string> = {
  app_accounts: '用户账号表：存储登录账号、密码哈希、角色与禁用状态',
  user_info: '用户账号信息表：登录账号、密码、角色、状态等核心认证信息',
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
  learn_word_progress: '学习中心·背单词卡进度表：每用户每词的 Leitner 盒 SRS 状态（status/level/due/weak），与备考台进度严格隔离',
  cet_word_progress: '学习中心·四六级单词进度表：按 level(cet4/cet6) 分库存储，每用户每词的 Leitner 盒 SRS 状态',
  learn_bookmarks: '学习中心·书签表：生词/行业知识点/书籍收藏',
  learn_reading: '学习中心·阅读记录表：书籍阅读进度与上次位置',
  third_party_apis: '第三方 API 配置表：各账号自行填写的天气/地图等免费 API 地址与 Key（含每日额度与配额保护开关，按账号隔离）',
  api_grants: '第三方 API 授权表：超级管理员授权哪些账号可使用第三方 API 调用',
  api_usage_logs: '第三方 API 调用日志表：记录每次高德等第三方接口调用，用于实时统计、配额保护与用量分析',
  feedbacks: '意见反馈主表：子账号提交的反馈（标题/分类/优先级/正文/附件/匿名），含状态流与关闭原因（关闭原因仅管理端可见）',
  feedback_replies: '意见反馈回复表：管理员公开回复与内部备注（internal 仅管理端可见），按 feedback_id 级联删除',
  cet4_words: '四六级备考台·主词表：全量四级词（单词/音标/词性/释义/常考搭配），公开只读，仅管理员导入',
  cet4_prep_progress: '四六级备考台·单词进度表：每用户每词的艾宾浩斯复习状态（status/level/due/weak）',
  cet4_prep_practice: '四六级备考台·刷题记录表：听力/阅读/写作/翻译的做题数与正确数',
  cet4_prep_mistakes: '四六级备考台·错题本表：题型/错因/正确思路与 1/3/7/15/30 天复习计划',
  cet4_prep_checkins: '四六级备考台·打卡表：按日期聚合的背词/刷题次数',
  cet4_prep_settings: '四六级备考台·设置表：每日新词数、考试日、手动连续天数、关联目标',
  degree_settings: '学位英语备考台·设置表：目标院校、考试日、每日新词数、手动连续天数',
  degree_word_progress: '学位英语备考台·单词进度表：每用户每词的艾宾浩斯复习状态（status/level/due/weak）',
  degree_practice: '学位英语备考台·练习记录表：五大题型的做题数与正确数',
  degree_mistakes: '学位英语备考台·错题本表：题号/错因/正确思路与复习计划',
  degree_favorites: '学位英语备考台·收藏笔记表：笔记/好句收藏/生词本（kind 区分）',
  degree_words: '学位英语备考台·词库表：大纲词汇（含音标/词性/释义/复用式标记/来源 PDF 标签），首次运行 lazy-seed 注入',
  degree_questions: '学位英语备考台·题库表：五大题型题目（题干/选项/答案/解析/来源溯源），首次运行 lazy-seed 注入',
  degree_phrases: '学位英语备考台·词组语句表：词组/口语表达/词缀/不规则动词（大纲附录二~八）',
  degree_exam_records: '学位英语备考台·模拟考试记录表：每套卷得分/用时/逐题作答，按 user_id 隔离',
  push_subscriptions: '消息推送·订阅表：用户浏览器/设备推送订阅端点与公钥，按账号隔离',
  notifications: '消息推送·通知表：系统生成的站内通知与待推送消息（标题/正文/类型/已读状态）',
  push_reminder_log: '消息推送·发送日志表：每次提醒/推送的实际发送记录与结果，用于去重与排查'
}

/** Supabase 平台托管的系统表（多建在 public 模式下但由平台管理、默认不开 RLS），不纳入「业务表未开 RLS」告警，避免误报 */
const SYSTEM_TABLES = new Set([
  'schema_migrations', 'supabase_migrations', 'migrations', 'audit_log_entries', 'instances',
  'users', 'refresh_tokens', 'one_time_tokens', 'sessions', 'identities',
  'mfa_factors', 'mfa_amr_claims', 'mfa_challenges', 'flow_state',
  'saml_providers', 'saml_relay_states', 'sso_providers', 'sso_domains',
  'oauth_providers', 'oauth_clients', 'oauth_consents', 'oauth_authorizations',
  'oauth_client_states', 'custom_oauth_providers', 'webauthn_credentials',
  'webauthn_challenges', 'subscription', 'secrets', 'objects', 'buckets',
  'buckets_analytics', 'buckets_vectors', 's3_multipart_uploads',
  's3_multipart_uploads_parts', 'vector_indexes'
])

/** 表名 → 业务域分组 */
const TABLE_GROUP: Record<string, string> = {
  app_accounts: 'auth', user_info: 'auth', profiles: 'auth', app_settings: 'auth',
  free_model_catalog: 'ai', ai_keys: 'ai', model_usage: 'ai', usage_records: 'ai',
  custom_free_models: 'ai', shared_free_api_keys: 'ai', model_bookmarks: 'ai',
  app_dashboard_data: 'biz', news_daily: 'biz', external_ideas: 'biz', automation_info: 'biz',
  todos: 'biz', points: 'biz', contents: 'biz',
  car_watchlist: 'xingyu',
  learn_progress: 'learn', learn_word_progress: 'learn', cet_word_progress: 'learn', learn_bookmarks: 'learn', learn_reading: 'learn',
  third_party_apis: 'third', api_grants: 'third', api_usage_logs: 'third',
  feedbacks: 'feedback', feedback_replies: 'feedback',
  degree_settings: 'degree', degree_word_progress: 'degree',
  degree_practice: 'degree', degree_mistakes: 'degree', degree_favorites: 'degree',
  degree_words: 'degree', degree_questions: 'degree', degree_phrases: 'degree',
  degree_exam_records: 'degree'
}

/** 业务域元信息：中文名 + 主题色（浅色主题下的柔和色，用于分组色条与标识） */
const GROUP_META: Record<string, { label: string; color: string }> = {
  auth: { label: '认证与账号', color: '#3b6fd4' },
  ai: { label: 'AI 与模型', color: '#8b5cf6' },
  biz: { label: '业务数据', color: '#0ea5e9' },
  xingyu: { label: '星舆识途', color: '#f59e0b' },
  learn: { label: '学习中心', color: '#10b981' },
  third: { label: '第三方 API', color: '#14b8a6' },
  feedback: { label: '意见反馈', color: '#6366f1' },
  degree: { label: '学位英语备考', color: '#534AB7' },
  archive: { label: '消息归档', color: '#ec4899' },
  other: { label: '其他表', color: '#64748b' }
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

function groupKeyOf(name: string): string {
  if (/^messages_\d{4}_\d{2}_\d{2}$/.test(name)) return 'archive'
  return TABLE_GROUP[name] || 'other'
}

function guessDesc(name: string): string {
  const parts = String(name).split(/[_-]/).filter(Boolean)
  const segs = parts.map((p) => WORD_MAP[p.toLowerCase()] || p)
  return `（推测）${segs.join('')}表：自动识别到的数据表，建议在 TABLE_DESC 补充正式说明`
}

function tableDesc(name: string): string {
  if (/^messages_\d{4}_\d{2}_\d{2}$/.test(name)) {
    return '消息历史分表（按日期）：自动化/对话产生的消息归档，按天分表存储'
  }
  return TABLE_DESC[name] || guessDesc(name)
}

const stats = ref<DatabaseStats | null>(null)
const loading = ref(false)

/** 工具栏状态 */
const search = ref('')
const filterMode = ref<'all' | 'rls-off' | 'alert'>('all')
const sortMode = ref<'size' | 'rows'>('size')

const totalRows = computed(() =>
  stats.value ? stats.value.tables.reduce((s, t) => s + t.rows, 0) : 0
)

const totalSize = computed(() =>
  stats.value ? stats.value.tables.reduce((s, t) => s + (Number(t.sizeBytes) || 0), 0) : 0
)

/** 合并表（去重 + 算占比），合并表格渲染基础数据 */
const mergedTables = computed(() => {
  if (!stats.value) return []
  const byName = new Map<string, { name: string; rows: number; size: number; rlsEnabled?: boolean; schema?: string; pct: number }>()
  for (const t of stats.value.tables) {
    const size = Number(t.sizeBytes) || 0
    const prev = byName.get(t.name)
    if (!prev || (prev.rlsEnabled !== true && t.rlsEnabled === true)) {
      byName.set(t.name, {
        name: t.name, rows: Number(t.rows) || 0, size,
        rlsEnabled: t.rlsEnabled, schema: t.schema, pct: 0
      })
    }
  }
  return [...byName.values()].map((t) => ({
    ...t,
    pct: totalSize.value > 0 ? Math.round((t.size / totalSize.value) * 1000) / 10 : 0
  }))
})

/** 某表是否触发告警（业务表未开 RLS 或缺少说明，且非系统表） */
function tableHasAlert(t: { name: string; rlsEnabled?: boolean }): boolean {
  if (SYSTEM_TABLES.has(t.name)) return false
  if (t.rlsEnabled === false) return true
  if (tableDesc(t.name).startsWith('（推测）')) return true
  return false
}

/** 工具栏过滤后的表 */
const filteredTables = computed(() => {
  let arr = mergedTables.value
  const q = search.value.trim().toLowerCase()
  if (q) {
    arr = arr.filter(
      (t) => t.name.toLowerCase().includes(q) || tableDesc(t.name).toLowerCase().includes(q)
    )
  }
  if (filterMode.value === 'rls-off') arr = arr.filter((t) => t.rlsEnabled === false)
  else if (filterMode.value === 'alert') arr = arr.filter((t) => tableHasAlert(t))
  return arr
})

/** 按业务域分组（用于卡片化展示），组内按工具栏排序 */
const groupedTables = computed(() => {
  const buckets: Record<string, typeof filteredTables.value> = {}
  for (const t of filteredTables.value) {
    const key = groupKeyOf(t.name)
    ;(buckets[key] ||= []).push(t)
  }
  const fallbackMeta = { label: '其他表', color: '#64748b' }
  return Object.keys(GROUP_META)
    .filter((k) => buckets[k]?.length)
    .map((k) => {
      const tables = [...(buckets[k] ?? [])].sort((a, b) =>
        sortMode.value === 'rows' ? b.rows - a.rows : b.size - a.size
      )
      const totalRows = tables.reduce((s, t) => s + t.rows, 0)
      const totalSize = tables.reduce((s, t) => s + t.size, 0)
      return { key: k, meta: GROUP_META[k] ?? fallbackMeta, tables, totalRows, totalSize }
    })
})

const problems = computed(() => {
  const list: { level: 'danger' | 'warn' | 'info'; text: string }[] = []
  const s = stats.value
  if (!s) return list
  if (!s.dbSizeBytes) {
    list.push({
      level: 'info',
      text: '当前为降级统计（逐表 count），看不到库总大小 / 各表空间 / RLS 状态。请在 Supabase 执行 scripts/supabase_stats.sql 启用精确统计，监测才算完整。'
    })
  }
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
    if (SYSTEM_TABLES.has(t.name)) continue
    if (t.rlsEnabled === false) {
      list.push({ level: 'danger', text: `业务表「${t.name}」未启用行级安全（RLS），任何人（含未登录）都可直读/直写，存在越权与数据泄露风险，请尽快开启 RLS 并配置策略。` })
    }
    if (tableDesc(t.name).startsWith('（推测）')) {
      list.push({ level: 'info', text: `业务表「${t.name}」缺少正式中文说明，建议在 DatabaseCheckView.vue 的 TABLE_DESC 补充。` })
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
  padding: 0 18px 18px;
  max-width: 1400px;
  margin: 0 auto;
  color: var(--text);
}
.db-loading {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--text-muted);
  padding: 40px 0;
  justify-content: center;
}
.is-loading { animation: rotating 1.2s linear infinite; }
@keyframes rotating { to { transform: rotate(360deg); } }

/* 容量概览 */
.db-capacity {
  background: var(--surface);
  border: 1px solid var(--border);
  border-left: 4px solid var(--primary);
  border-radius: 14px;
  padding: 18px;
  margin-bottom: 20px;
  box-shadow: var(--shadow-card);
}
.db-capacity.warn { border-left-color: #f59e0b; }
.db-capacity.danger { border-left-color: #ef4444; }
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

/* 状态速览卡 */
.db-cards {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 14px;
  margin-bottom: 24px;
}
.db-card {
  position: relative;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 14px;
  padding: 16px 16px 16px 18px;
  box-shadow: var(--shadow-card);
  overflow: hidden;
}
.db-card::before {
  content: '';
  position: absolute;
  left: 0; top: 0; bottom: 0;
  width: 3px;
  background: var(--primary);
  opacity: 0.85;
}
.db-card.bad::before { background: #ef4444; }
.db-card-icon {
  display: inline-flex;
  font-size: 20px;
  margin-bottom: 8px;
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

/* 通用区块卡片 + 标题色条 */
.db-section {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 14px;
  padding: 20px;
  margin-bottom: 22px;
  box-shadow: var(--shadow-card);
}
.db-section-title {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 0 0 16px;
  font-size: 16px;
  font-weight: 700;
  color: var(--text-strong);
}
.db-section-title .bar {
  width: 4px;
  height: 18px;
  border-radius: 3px;
  background: var(--primary);
}

/* 工具栏 */
.db-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
  margin-bottom: 18px;
}
.db-search { max-width: 280px; flex: 1 1 220px; }
.db-sort { width: 140px; }

/* 分组卡片 */
.db-group {
  border: 1px solid var(--border);
  border-radius: 12px;
  margin-bottom: 14px;
  overflow: hidden;
  background: var(--surface-soft);
}
.db-group:last-child { margin-bottom: 0; }
.db-group-head {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 16px;
  background: color-mix(in srgb, var(--gc) 10%, var(--surface));
  border-bottom: 1px solid var(--border);
}
.db-group-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--gc);
  flex-shrink: 0;
}
.db-group-name {
  font-size: 14px;
  font-weight: 700;
  color: var(--text-strong);
}
.db-group-count {
  font-size: 12px;
  color: var(--gc);
  font-weight: 600;
  background: color-mix(in srgb, var(--gc) 14%, transparent);
  border-radius: 999px;
  padding: 2px 10px;
}
.db-group-sum {
  margin-left: auto;
  font-size: 12px;
  color: var(--text-faint);
  font-variant-numeric: tabular-nums;
}
.db-group-body { padding: 6px 8px; }

/* 单表行卡片 */
.tbl-row {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 12px 12px;
  border-radius: 10px;
  transition: background 0.15s;
}
.tbl-row:hover { background: var(--nav-hover); }
.tbl-row + .tbl-row { border-top: 1px solid var(--border); }
.tbl-row.row-alert {
  background: rgba(220, 38, 38, 0.06);
}
.tbl-row.row-alert:hover { background: rgba(220, 38, 38, 0.1); }
.tbl-main { flex: 1 1 auto; min-width: 0; }
.tbl-name {
  font-weight: 600;
  color: var(--text-strong);
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 13px;
  word-break: break-all;
}
.tbl-desc {
  font-size: 12px;
  color: var(--text-muted);
  margin-top: 2px;
  line-height: 1.4;
}
.tbl-metrics {
  display: flex;
  align-items: center;
  gap: 18px;
  flex-shrink: 0;
}
.metric {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 3px;
  min-width: 56px;
}
.m-label {
  font-size: 11px;
  color: var(--text-faint);
}
.m-val {
  font-size: 13px;
  font-weight: 700;
  color: var(--text);
  font-variant-numeric: tabular-nums;
}
.m-val.muted { color: var(--text-faint); font-weight: 500; }
.metric-bar { min-width: 120px; }
.m-track {
  width: 100%;
  height: 6px;
  border-radius: 999px;
  background: var(--surface-soft);
  overflow: hidden;
}
.m-fill {
  height: 100%;
  border-radius: 999px;
  background: var(--primary);
  transition: width 0.3s;
}
.m-fill.danger { background: #ef4444; }
.m-pct {
  font-size: 11px;
  color: var(--text-faint);
  font-variant-numeric: tabular-nums;
}
.db-empty {
  text-align: center;
  color: var(--text-faint);
  padding: 30px 0;
  font-size: 13px;
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
.db-ok {
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
.db-problem-item .el-icon { margin-top: 2px; flex-shrink: 0; }
.db-problem-item.danger { background: rgba(220, 38, 38, 0.12); color: #b91c1c; }
.db-problem-item.warn { background: rgba(217, 119, 6, 0.12); color: #b45309; }
.db-problem-item.info { background: var(--nav-hover); color: var(--text); }

@media (max-width: 768px) {
  .db-check { padding: 0 14px 14px; }
  .db-cards { grid-template-columns: repeat(2, 1fr); }
  .db-capacity-time { margin-left: 0; width: 100%; }
  .tbl-row { flex-wrap: wrap; }
  .tbl-metrics {
    width: 100%;
    gap: 12px;
    flex-wrap: wrap;
    justify-content: space-between;
  }
  .metric-bar { flex: 1 1 100%; min-width: 0; }
}
</style>
