<template>
  <div class="tp-page">
    <header class="tp-head">
      <div>
        <h2>第三方 API</h2>
        <p>
          自行填写天气、地图等免费 API 地址与 Key，按账号隔离、互不干扰。
          若未填写或未被授权，将自动回退到默认保底源（天气 → Open-Meteo 免费无 Key；地图 → OpenStreetMap）。
        </p>
      </div>
    </header>

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
              </el-form-item>

              <el-form-item label="启用该服务">
                <el-switch v-model="forms[svc].enabled" />
              </el-form-item>
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
import { WarningFilled } from '@element-plus/icons-vue'
import { getSavedUser, type AppUser } from '../services/appDataService'
import {
  listMyApis,
  upsertMyApi,
  removeMyApi,
  listAllAccountsBasic,
  listGrants,
  setGrant,
  isGranted,
  PROVIDER_META,
  SERVICE_LABEL,
  type ApiService,
  type ApiProvider,
  type AccountBasic,
  type ThirdPartyApiConfig
} from '../services/thirdPartyApi'
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
}
const forms = reactive<Record<ApiService, FormState>>({
  weather: { provider: 'amap', api_url: '', api_key: '', enabled: true },
  map: { provider: 'amap', api_url: '', api_key: '', enabled: true }
})
const hasConfig = reactive<Record<ApiService, boolean>>({ weather: false, map: false })
const saving = reactive<Record<ApiService, boolean>>({ weather: false, map: false })

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
      enabled: forms[svc].enabled
    })
    hasConfig[svc] = true
    ElMessage.success('已保存')
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '保存失败')
  } finally {
    saving[svc] = false
  }
}

async function removeMy(svc: ApiService) {
  try {
    await removeMyApi(svc)
    forms[svc] = { provider: 'amap', api_url: '', api_key: '', enabled: true }
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
          enabled: cfg.enabled
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
})
</script>

<style scoped>
.tp-page {
  padding: 20px;
  max-width: 980px;
  margin: 0 auto;
  color: var(--text);
}
.tp-head { margin-bottom: 18px; }
.tp-head h2 { margin: 0 0 6px; font-size: 22px; color: var(--text-strong); }
.tp-head p { margin: 0; font-size: 13px; color: var(--text-muted); line-height: 1.6; max-width: 760px; }

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

@media (max-width: 768px) {
  .tp-page { padding: 14px; }
  .tp-grant-row { grid-template-columns: 1fr 70px 70px; padding: 10px; }
}
</style>
