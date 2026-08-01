<template>
  <div class="tp-page">
    <PageHeader title="第三方 API" subtitle="自行填写天气、地图等免费 API 地址与 Key，按账号隔离、互不干扰。若未填写或未被授权，将自动回退到默认保底源（天气 → Open-Meteo 免费无 Key；地图 → OpenStreetMap）。" :icon="Link" />

    <!-- 我的 API 配置 -->
    <section class="tp-section">
      <h3 class="tp-section-title"><span class="bar"></span>我的 API 配置</h3>

      <div v-if="!grantedWeather && !grantedMap" class="tp-grant-hint">
        <el-icon><WarningFilled /></el-icon>
        <span>你尚未获得「第三方 API 调用」授权。如需使用高德等第三方接口，请联系超级管理员在下方「账号授权」中为你开启。</span>
      </div>

      <div class="tp-cards">
        <el-card v-for="svc in services" :key="svc" class="tp-card" shadow="hover">
          <div class="tp-card-head">
            <span class="tp-card-name">{{ SERVICE_LABEL[svc] }}</span>
            <el-tag v-if="grantedOf(svc)" type="success" effect="light" size="small">已授权</el-tag>
            <el-tag v-else type="info" effect="light" size="small">未授权</el-tag>
          </div>

          <template v-if="grantedOf(svc)">
            <el-form label-position="top" class="tp-form">
              <el-form-item label="服务提供方">
                <el-select
                  v-model="forms[svc].provider"
                  placeholder="选择服务提供方"
                  @change="onProviderChange(svc)"
                  style="width: 100%"
                >
                  <el-option
                    v-for="p in providersFor(svc)"
                    :key="p"
                    :label="PROVIDER_META[p].label"
                    :value="p"
                  />
                </el-select>
              </el-form-item>

              <el-form-item label="API 地址（可选，留空则用默认）">
                <el-input
                  v-model="forms[svc].api_url"
                  :placeholder="PROVIDER_META[forms[svc].provider]?.url || 'https://...'"
                  clearable
                />
              </el-form-item>

              <el-form-item :label="PROVIDER_META[forms[svc].provider]?.needKey ? 'API Key' : 'API Key（该服务无需 Key）'">
                <el-input
                  v-model="forms[svc].api_key"
                  type="password"
                  show-password
                  :placeholder="PROVIDER_META[forms[svc].provider]?.needKey ? '填入你的 Key' : '无需填写'"
                  :disabled="!PROVIDER_META[forms[svc].provider]?.needKey"
                  clearable
                />
                <div v-if="svc === 'weather' && forms[svc].provider === 'amap'" class="tp-input-tip">
                  ① 去
                  <a href="https://console.amap.com/dev/key/app" target="_blank" rel="noopener">高德开放平台控制台</a>
                  申请「Web 服务」类型 Key（个人开发者免费额度足够）；② 把 Key 粘贴上方保存；③ 进入「天气」页即可使用高德数据，失败自动回退 Open-Meteo。
                </div>
                <div v-if="svc === 'map' && forms[svc].provider === 'amap'" class="tp-input-tip">
                  高德 Key 选择「Web 服务」类型即可，天气与地图可共用同一个 Key。
                </div>
              </el-form-item>

              <el-form-item label="启用该服务">
                <el-switch v-model="forms[svc].enabled" />
              </el-form-item>

              <template v-if="svc === 'weather' && forms[svc].provider === 'amap'">
                <el-form-item label="每月调用额度">
                  <el-input-number v-model="forms[svc].monthly_limit" :min="0" :step="500" style="width: 100%" />
                </el-form-item>
                <el-form-item label="每日调用额度">
                  <el-input-number v-model="forms[svc].daily_limit" :min="0" :step="100" style="width: 100%" />
                </el-form-item>
                <el-form-item label="配额保护（今日剩余 < 100 自动禁用）">
                  <el-switch v-model="forms[svc].quota_protection" />
                </el-form-item>
              </template>
            </el-form>

            <div class="tp-card-actions">
              <el-button type="primary" size="small" :loading="saving[svc]" @click="saveMy(svc)">保存</el-button>
              <el-button size="small" :disabled="!hasConfig[svc]" @click="removeMy(svc)">清除</el-button>
            </div>
          </template>

          <el-empty v-else description="未授权，暂不可配置" :image-size="56" />
        </el-card>
      </div>
    </section>

    <!-- 高德 API 调用统计（天气） -->
    <section v-if="grantedWeather && forms.weather.provider === 'amap'" class="tp-section tp-stats-section">
      <h3 class="tp-section-title"><span class="bar stats"></span>高德 API 调用统计（天气）</h3>

      <div class="tp-stats-board">
        <div class="tp-stats-row">
          <div class="tp-stat-card">
            <div class="tp-stat-label">每月额度</div>
            <div class="tp-stat-value">{{ amapStats.monthlyTotal.toLocaleString() }}</div>
            <div class="tp-stat-sub">自定义月上限</div>
          </div>
          <div class="tp-stat-card" :class="{ 'is-warning': amapStats.monthlyRemaining < 500 }">
            <div class="tp-stat-label">本月已用 / 剩余</div>
            <div class="tp-stat-value">{{ amapStats.monthlyUsed }}<span class="tp-stat-unit">/ {{ amapStats.monthlyRemaining }}</span></div>
            <div class="tp-stat-sub">次 / 月</div>
          </div>
          <div class="tp-stat-card">
            <div class="tp-stat-label">每日额度</div>
            <div class="tp-stat-value">{{ amapStats.dailyLimit.toLocaleString() }}</div>
            <div class="tp-stat-sub">自定义日上限</div>
          </div>
          <div class="tp-stat-card" :class="{ 'is-warning': amapStats.dailyRemaining < 100 }">
            <div class="tp-stat-label">今日已用 / 剩余</div>
            <div class="tp-stat-value">{{ amapStats.dailyUsed }}<span class="tp-stat-unit">/ {{ amapStats.dailyRemaining }}</span></div>
            <div class="tp-stat-sub">次 / 日</div>
          </div>
        </div>

        <div class="tp-progress-group">
          <div class="tp-progress-item">
            <div class="tp-progress-label">
              <span>本月用量</span>
              <span>{{ monthlyPercent }}%</span>
            </div>
            <el-progress :percentage="monthlyPercent" :show-text="false" :stroke-width="8" :color="progressColor" />
          </div>
          <div class="tp-progress-item">
            <div class="tp-progress-label">
              <span>今日用量</span>
              <span>{{ dailyPercent }}%</span>
            </div>
            <el-progress :percentage="dailyPercent" :show-text="false" :stroke-width="8" :color="progressColor" />
          </div>
        </div>
      </div>

      <div v-if="amapStats.dailyRemaining < 100" class="tp-quota-warning">
        <el-icon><WarningFilled /></el-icon>
        <span>今日剩余调用次数已不足 100 次，配额保护已自动禁用高德天气，将回退 Open-Meteo。</span>
      </div>

      <div class="tp-chart-card">
        <div class="tp-chart-header">
          <el-radio-group v-model="chartRange" size="small" @change="loadChart">
            <el-radio-button value="1h">最近一小时</el-radio-button>
            <el-radio-button value="24h">最近一天</el-radio-button>
            <el-radio-button value="7d">最近一周</el-radio-button>
          </el-radio-group>
          <el-button size="small" :loading="statsLoading" @click="loadStats">
            <el-icon><Refresh /></el-icon> 刷新
          </el-button>
        </div>
        <EChart :option="chartOption" height="240px" />
      </div>
    </section>

    <!-- 超管：账号授权 -->
    <section v-if="isSuperadmin" class="tp-section">
      <h3 class="tp-section-title"><span class="bar grant"></span>账号授权（仅超级管理员）</h3>
      <p class="tp-section-desc">开启后，该账号即可在「我的 API 配置」中使用高德等第三方接口；未开启则仅能用默认保底源。</p>

      <div v-loading="loadingAccounts" class="tp-grant-table">
        <div class="tp-grant-row tp-grant-row-head">
          <div class="gt-name">账号</div>
          <div class="gt-toggle">天气</div>
          <div class="gt-toggle">地图</div>
        </div>
        <div v-for="a in accounts" :key="a.id" class="tp-grant-row">
          <div class="gt-name">
            <span class="gt-nick">{{ a.nickname || a.username }}</span>
            <span class="gt-user">@{{ a.username }}</span>
            <el-tag v-if="a.role === 'superadmin'" size="small" type="danger" effect="plain">超管</el-tag>
            <el-tag v-else-if="a.role === 'admin'" size="small" type="warning" effect="plain">管理员</el-tag>
          </div>
          <div class="gt-toggle">
            <el-switch
              :model-value="grantState[a.id]?.weather || false"
              :loading="grantBusy[a.id] === 'weather'"
              @change="(v: any) => toggleGrant(a.id, 'weather', Boolean(v))"
            />
          </div>
          <div class="gt-toggle">
            <el-switch
              :model-value="grantState[a.id]?.map || false"
              :loading="grantBusy[a.id] === 'map'"
              @change="(v: any) => toggleGrant(a.id, 'map', Boolean(v))"
            />
          </div>
        </div>
        <el-empty v-if="!loadingAccounts && accounts.length === 0" description="暂无账号" :image-size="56" />
      </div>
    </section>

    <!-- 超管：共享 Key -->
    <section v-if="isSuperadmin" class="tp-section">
      <h3 class="tp-section-title"><span class="bar key"></span>共享 Key 设置（仅超级管理员）</h3>
      <p class="tp-section-desc">
        设置后，所有<strong>已授权</strong>但未填写自己 Key 的账号会自动复用这些共享 Key（高德用于天气/地图，天地图用于地图，天行用于新闻）。
      </p>
      <el-card class="tp-card tp-shared" shadow="never">
        <el-form label-position="top" class="tp-form">
          <el-form-item label="高德 Key（Web 服务，天气+地图共用）">
            <el-input v-model="shared.amap" type="password" show-password placeholder="未填写则授权账号天气回退 Open-Meteo" clearable />
          </el-form-item>
          <el-form-item label="天地图 Key（地图底图）">
            <el-input v-model="shared.tianditu" type="password" show-password placeholder="未填写则地图回退 OpenStreetMap" clearable />
          </el-form-item>
          <el-form-item label="天行数据 Key（新闻）">
            <el-input v-model="shared.tianxing" type="password" show-password placeholder="未填写则新闻回退公共 RSS" clearable />
          </el-form-item>
        </el-form>
        <div class="tp-card-actions">
          <el-button type="primary" size="small" :loading="savingShared" @click="saveShared">保存共享 Key</el-button>
        </div>
      </el-card>
    </section>

    <el-alert
      v-if="sqlHint"
      type="info"
      :closable="false"
      show-icon
      class="tp-sql-hint"
      title="提示"
      :description="sqlHint"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { WarningFilled, Refresh, Link } from '@element-plus/icons-vue'
import { getSavedUser, type AppUser } from '../services/appDataService'
import {
  listMyApis,
  upsertMyApi,
  removeMyApi,
  listAllAccountsBasic,
  listGrants,
  setGrant,
  isGranted,
  countApiUsageToday,
  countApiUsageThisMonth,
  listApiUsageLogs,
  PROVIDER_META,
  SERVICE_LABEL,
  type ApiService,
  type ApiProvider,
  type AccountBasic,
  type ThirdPartyApiConfig,
  type ApiUsageLog
} from '../services/thirdPartyApi'
import PageHeader from '../components/PageHeader.vue'
import EChart from '../components/EChart.vue'
import type { EChartsOption } from 'echarts'
import {
  loadSharedFreeApiKeys,
  saveSharedFreeApiKey,
  clearSharedFreeApiKeyCache
} from '../services/geoService'

const currentUser = ref<AppUser | null>(null)
const isSuperadmin = computed(() => currentUser.value?.role === 'superadmin')

const services: ApiService[] = ['weather', 'map']
const providersByService: Record<ApiService, ApiProvider[]> = {
  weather: ['amap', 'open_meteo', 'openweather', 'custom'],
  map: ['amap', 'tianditu', 'custom']
}

function providersFor(svc: ApiService): ApiProvider[] {
  return providersByService[svc]
}

/* 授权状态 */
const grantedWeather = ref(false)
const grantedMap = ref(false)
const grantedOf = (svc: ApiService) => (svc === 'weather' ? grantedWeather.value : grantedMap.value)

/* 我的配置表单 */
interface FormState {
  provider: ApiProvider
  api_url: string
  api_key: string
  enabled: boolean
  daily_limit: number
  monthly_limit: number
  quota_protection: boolean
}
const forms = reactive<Record<ApiService, FormState>>({
  weather: { provider: 'amap', api_url: '', api_key: '', enabled: true, daily_limit: 5000, monthly_limit: 5000, quota_protection: true },
  map: { provider: 'amap', api_url: '', api_key: '', enabled: true, daily_limit: 5000, monthly_limit: 5000, quota_protection: true }
})
const hasConfig = reactive<Record<ApiService, boolean>>({ weather: false, map: false })
const saving = reactive<Record<ApiService, boolean>>({ weather: false, map: false })

/* 高德天气调用统计：高德免费档每月 5000 次 */
const AMAP_MONTHLY_QUOTA = 5000
const amapStats = reactive({
  monthlyTotal: AMAP_MONTHLY_QUOTA,
  monthlyUsed: 0,
  monthlyRemaining: AMAP_MONTHLY_QUOTA,
  dailyLimit: 5000,
  dailyUsed: 0,
  dailyRemaining: 5000
})
const statsLoading = ref(false)
const chartRange = ref<'1h' | '24h' | '7d'>('1h')
const chartLogs = ref<ApiUsageLog[]>([])

const monthlyPercent = computed(() => {
  if (!amapStats.monthlyTotal) return 0
  return Math.min(100, Math.round((amapStats.monthlyUsed / amapStats.monthlyTotal) * 100) || 0)
})
const dailyPercent = computed(() => {
  if (!amapStats.dailyLimit) return 0
  return Math.min(100, Math.round((amapStats.dailyUsed / amapStats.dailyLimit) * 100) || 0)
})
const progressColor = computed(() => 'var(--primary)')

async function loadStats() {
  if (!grantedWeather.value || forms.weather.provider !== 'amap') return
  statsLoading.value = true
  try {
    const [dailyUsed, monthlyUsed] = await Promise.all([
      countApiUsageToday('weather', 'amap'),
      countApiUsageThisMonth('weather', 'amap')
    ])
    const monthlyLimit = Number(forms.weather.monthly_limit) || AMAP_MONTHLY_QUOTA
    const dailyLimit = Number(forms.weather.daily_limit) || AMAP_MONTHLY_QUOTA
    amapStats.monthlyTotal = monthlyLimit
    amapStats.monthlyUsed = monthlyUsed
    amapStats.monthlyRemaining = Math.max(0, monthlyLimit - monthlyUsed)
    amapStats.dailyLimit = dailyLimit
    amapStats.dailyUsed = dailyUsed
    amapStats.dailyRemaining = Math.max(0, dailyLimit - dailyUsed)
    await loadChart()
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '统计加载失败')
  } finally {
    statsLoading.value = false
  }
}

function buildChartOption(): EChartsOption {
  const range = chartRange.value
  const now = new Date()
  let intervalMs = 60_000
  let points = 60
  let labelFmt = '{HH}:{mm}'
  let from = new Date(now.getTime() - 60 * 60_000)

  if (range === '24h') {
    intervalMs = 60 * 60_000
    points = 24
    labelFmt = '{HH}:00'
    from = new Date(now.getTime() - 24 * 60 * 60_000)
  } else if (range === '7d') {
    intervalMs = 24 * 60 * 60_000
    points = 7
    labelFmt = '{MM}-{dd}'
    from = new Date(now.getTime() - 7 * 24 * 60 * 60_000)
  }

  const buckets: number[] = new Array(points).fill(0)
  const labels: string[] = []
  for (let i = 0; i < points; i++) {
    const t = new Date(from.getTime() + i * intervalMs)
    labels.push(
      range === '1h'
        ? `${String(t.getHours()).padStart(2, '0')}:${String(t.getMinutes()).padStart(2, '0')}`
        : range === '24h'
          ? `${String(t.getHours()).padStart(2, '0')}:00`
          : `${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`
    )
  }

  for (const log of chartLogs.value) {
    const t = new Date(log.created_at || '')
    if (isNaN(t.getTime()) || t < from || t > now) continue
    const idx = Math.min(points - 1, Math.max(0, Math.floor((t.getTime() - from.getTime()) / intervalMs)))
    buckets[idx] = (buckets[idx] ?? 0) + 1
  }

  return {
    grid: { top: 30, right: 20, bottom: 30, left: 40 },
    tooltip: { trigger: 'axis', formatter: '{b}<br/>调用量：{c}' },
    xAxis: {
      type: 'category',
      data: labels,
      axisLine: { lineStyle: { color: 'var(--border-strong)' } },
      axisLabel: { color: 'var(--text-muted)', fontSize: 11 }
    },
    yAxis: {
      type: 'value',
      minInterval: 1,
      splitLine: { lineStyle: { color: 'var(--border)' } },
      axisLabel: { color: 'var(--text-muted)', fontSize: 11 }
    },
    series: [{
      data: buckets,
      type: 'line',
      smooth: true,
      symbol: 'circle',
      symbolSize: 6,
      itemStyle: { color: 'var(--primary)' },
      lineStyle: { width: 2, color: 'var(--primary)' },
      areaStyle: { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: 'rgba(99,102,241,0.25)' }, { offset: 1, color: 'rgba(99,102,241,0.02)' }] } }
    }]
  }
}

const chartOption = computed(() => buildChartOption())

async function loadChart() {
  const now = new Date()
  let from = new Date(now.getTime() - 60 * 60_000)
  if (chartRange.value === '24h') from = new Date(now.getTime() - 24 * 60 * 60_000)
  if (chartRange.value === '7d') from = new Date(now.getTime() - 7 * 24 * 60 * 60_000)
  try {
    chartLogs.value = await listApiUsageLogs({
      service: 'weather',
      provider: 'amap',
      from: from.toISOString(),
      to: now.toISOString()
    })
  } catch (e) {
    console.warn('加载调用日志失败', e)
    chartLogs.value = []
  }
}

function onProviderChange(svc: ApiService) {
  const meta = PROVIDER_META[forms[svc].provider]
  if (meta?.url && !forms[svc].api_url) {
    forms[svc].api_url = meta.url
  }
  // 切换无需 Key 的 provider 时清空 key
  if (!meta?.needKey) forms[svc].api_key = ''
}

async function saveMy(svc: ApiService) {
  saving[svc] = true
  try {
    await upsertMyApi({
      service: svc,
      provider: forms[svc].provider,
      api_url: forms[svc].api_url.trim(),
      api_key: forms[svc].api_key.trim(),
      enabled: forms[svc].enabled,
      daily_limit: Number(forms[svc].daily_limit) || 5000,
      monthly_limit: Number(forms[svc].monthly_limit) || 5000,
      quota_protection: forms[svc].quota_protection
    })
    hasConfig[svc] = true
    ElMessage.success('已保存')
    if (svc === 'weather' && forms[svc].provider === 'amap') await loadStats()
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '保存失败')
  } finally {
    saving[svc] = false
  }
}

async function removeMy(svc: ApiService) {
  try {
    await removeMyApi(svc)
    forms[svc] = { provider: 'amap', api_url: '', api_key: '', enabled: true, daily_limit: 5000, monthly_limit: 5000, quota_protection: true }
    hasConfig[svc] = false
    ElMessage.success('已清除')
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '清除失败')
  }
}

/* 超管：账号授权 */
const accounts = ref<AccountBasic[]>([])
const loadingAccounts = ref(false)
const grantBusy = reactive<Record<string, ApiService | ''>>({})
const grantState = reactive<Record<string, { weather: boolean; map: boolean }>>({})

async function toggleGrant(accountId: string, svc: ApiService, granted: boolean) {
  grantBusy[accountId] = svc
  try {
    await setGrant(accountId, svc, granted)
    grantState[accountId] = grantState[accountId] || { weather: false, map: false }
    grantState[accountId][svc] = granted
    ElMessage.success(granted ? '已授权' : '已取消授权')
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '操作失败')
  } finally {
    grantBusy[accountId] = ''
  }
}

/* 超管：共享 Key */
const shared = reactive({ amap: '', tianditu: '', tianxing: '' })
const savingShared = ref(false)

async function saveShared() {
  savingShared.value = true
  try {
    await Promise.all([
      saveSharedFreeApiKey('amap', shared.amap.trim()),
      saveSharedFreeApiKey('tianditu', shared.tianditu.trim()),
      saveSharedFreeApiKey('tianxing', shared.tianxing.trim())
    ])
    clearSharedFreeApiKeyCache()
    ElMessage.success('共享 Key 已保存（所有授权账号共用）')
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '保存失败')
  } finally {
    savingShared.value = false
  }
}

const sqlHint = ref('')

async function loadMy() {
  try {
    const list = await listMyApis()
    const map = new Map<ApiService, ThirdPartyApiConfig>()
    for (const c of list) map.set(c.service, c)
    for (const svc of services) {
      const cfg = map.get(svc)
      if (cfg) {
        forms[svc] = {
          provider: cfg.provider,
          api_url: cfg.api_url || '',
          api_key: cfg.api_key || '',
          enabled: cfg.enabled,
          daily_limit: cfg.daily_limit ?? 5000,
          monthly_limit: cfg.monthly_limit ?? 5000,
          quota_protection: cfg.quota_protection ?? true
        }
        hasConfig[svc] = true
      }
    }
  } catch (e) {
    sqlHint.value = '读取我的 API 配置失败：' + (e instanceof Error ? e.message : '') + '。请确认已在 Supabase 执行 scripts/third_party_api.sql。'
  }
}

async function loadGrants() {
  try {
    const grants = await listGrants()
    for (const g of grants) {
      const st = (grantState[g.grantee_id] = grantState[g.grantee_id] || { weather: false, map: false })
      if (g.service === 'all' || g.service === 'weather') st.weather = true
      if (g.service === 'all' || g.service === 'map') st.map = true
    }
  } catch (e) {
    sqlHint.value = '读取授权列表失败：' + (e instanceof Error ? e.message : '') + '。请确认已在 Supabase 执行 scripts/third_party_api.sql。'
  }
}

async function loadAccounts() {
  if (!isSuperadmin.value) return
  loadingAccounts.value = true
  try {
    accounts.value = await listAllAccountsBasic()
  } catch (e) {
    sqlHint.value = '读取账号列表失败：' + (e instanceof Error ? e.message : '') + '。请确认已在 Supabase 执行 scripts/third_party_api.sql。'
  } finally {
    loadingAccounts.value = false
  }
}

async function loadShared() {
  if (!isSuperadmin.value) return
  try {
    clearSharedFreeApiKeyCache()
    const m = await loadSharedFreeApiKeys()
    shared.amap = m.amap || ''
    shared.tianditu = m.tianditu || ''
    shared.tianxing = m.tianxing || ''
  } catch {
    /* ignore */
  }
}

onMounted(async () => {
  currentUser.value = await getSavedUser()
  grantedWeather.value = await isGranted('weather')
  grantedMap.value = await isGranted('map')
  await loadMy()
  await loadGrants()
  await loadAccounts()
  await loadShared()
  await loadStats()
})
</script>

<style scoped>
.tp-page {
  padding: 0 18px 18px;
  max-width: 1400px;
  margin: 0 auto;
  color: var(--text);
}

.tp-section { background: var(--surface); border: 1px solid var(--border); border-radius: 14px; padding: 18px; margin-bottom: 18px; box-shadow: var(--shadow-card); }
.tp-section-title { display: flex; align-items: center; gap: 10px; margin: 0 0 14px; font-size: 16px; font-weight: 700; color: var(--text-strong); }
.tp-section-title .bar { width: 4px; height: 18px; border-radius: 3px; background: var(--primary); }
.tp-section-title .bar.grant { background: #f59e0b; }
.tp-section-title .bar.key { background: #8b5cf6; }
.tp-section-desc { margin: -6px 0 14px; font-size: 13px; color: var(--text-muted); line-height: 1.6; }

.tp-grant-hint { display: flex; align-items: flex-start; gap: 8px; background: rgba(217, 119, 6, 0.12); color: #b45309; border-radius: 10px; padding: 10px 14px; font-size: 13px; line-height: 1.6; margin-bottom: 14px; }

.tp-cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 14px; }
.tp-card { border-radius: 12px; }
.tp-card-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
.tp-card-name { font-size: 15px; font-weight: 700; color: var(--text-strong); }
.tp-form { margin-bottom: 4px; }
.tp-input-tip { margin-top: 6px; font-size: 12px; color: var(--text-muted); line-height: 1.6; }
.tp-input-tip a { color: var(--primary); text-decoration: none; }
.tp-input-tip a:hover { text-decoration: underline; }
.tp-card-actions { display: flex; justify-content: flex-end; gap: 8px; }

.tp-grant-table { border: 1px solid var(--border); border-radius: 10px; overflow: hidden; }
.tp-grant-row { display: grid; grid-template-columns: 1fr 90px 90px; align-items: center; padding: 10px 14px; }
.tp-grant-row + .tp-grant-row { border-top: 1px solid var(--border); }
.tp-grant-row-head { background: var(--surface-soft); font-size: 12px; color: var(--text-muted); font-weight: 600; }
.gt-name { display: flex; align-items: center; gap: 8px; min-width: 0; }
.gt-nick { font-weight: 600; color: var(--text-strong); }
.gt-user { font-size: 12px; color: var(--text-faint); }
.gt-toggle { display: flex; justify-content: center; }

.tp-shared { background: var(--surface-soft); }
.tp-sql-hint { margin-top: 4px; }

/* 配额显示 */
.tp-quota-readonly {
  font-size: 14px; font-weight: 600; color: var(--text-strong);
  padding: 6px 10px; background: var(--surface-soft);
  border: 1px solid var(--border); border-radius: 8px;
}

/* 统计面板 */
.tp-section-title .bar.stats { background: var(--primary-2); }
.tp-stats-board {
  display: flex; flex-direction: column; gap: 16px;
  margin-bottom: 16px;
}
.tp-stats-row {
  display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px;
}
.tp-stat-card {
  background: var(--surface-soft);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 14px 14px 14px 17px;
  transition: border-color 0.15s ease, background 0.15s ease;
  position: relative; overflow: hidden;
}
.tp-stat-card::before {
  content: ''; position: absolute; left: 0; top: 0; bottom: 0; width: 3px;
  background: var(--primary); opacity: 0.8;
}
.tp-stat-card:nth-child(2)::before { background: var(--primary-2); }
.tp-stat-card:nth-child(3)::before { background: var(--primary-3); }
.tp-stat-card:nth-child(4)::before { background: var(--primary); }
.tp-stat-card.is-warning {
  border-color: var(--el-color-danger);
  background: rgba(239, 68, 68, 0.06);
}
.tp-stat-card.is-warning::before { background: var(--el-color-danger); }
.tp-stat-label { font-size: 12px; color: var(--text-muted); margin-bottom: 6px; }
.tp-stat-value { font-size: 22px; font-weight: 800; color: var(--text-strong); font-variant-numeric: tabular-nums; line-height: 1.2; }
.tp-stat-unit { font-size: 14px; font-weight: 500; color: var(--text-muted); margin-left: 2px; }
.tp-stat-sub { font-size: 11px; color: var(--text-faint); margin-top: 4px; }
.tp-stat-card.is-warning .tp-stat-value { color: var(--el-color-danger); }

.tp-progress-group {
  display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px;
  background: var(--surface-soft); border: 1px solid var(--border);
  border-radius: 12px; padding: 14px;
}
.tp-progress-item { display: flex; flex-direction: column; gap: 8px; }
.tp-progress-label { display: flex; justify-content: space-between; font-size: 12px; color: var(--text-muted); }

.tp-quota-warning {
  display: flex; align-items: flex-start; gap: 8px;
  background: rgba(239, 68, 68, 0.06); color: var(--el-color-danger);
  border: 1px solid rgba(239, 68, 68, 0.2); border-radius: 10px;
  padding: 10px 14px; font-size: 13px; line-height: 1.6; margin-bottom: 16px;
}
.tp-chart-card {
  background: var(--surface-soft); border: 1px solid var(--border);
  border-radius: 12px; padding: 14px;
}
.tp-chart-header { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 10px; flex-wrap: wrap; }

@media (max-width: 768px) {
  .tp-page { padding: 0 14px 14px; }
  .tp-grant-row { grid-template-columns: 1fr 70px 70px; padding: 10px; }
  .tp-stats-row { grid-template-columns: repeat(2, 1fr); }
  .tp-progress-group { grid-template-columns: 1fr; }
  .tp-stat-value { font-size: 18px; }
  .tp-stat-unit { font-size: 12px; }
}
</style>
