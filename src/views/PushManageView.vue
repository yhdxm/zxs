<template>
  <div class="push-manage">
    <h2 class="page-title">消息推送</h2>
    <p class="page-desc">编写消息并选择接收范围，点击发送后即时推送到对方手机/浏览器（需对方已订阅通知）。</p>

    <el-card class="push-card" shadow="never">
      <el-form :model="form" label-position="top" @submit.prevent>
        <el-form-item label="标题" required>
          <el-input v-model="form.title" maxlength="60" show-word-limit placeholder="例如：系统维护通知" />
        </el-form-item>

        <el-form-item label="正文">
          <el-input v-model="form.body" type="textarea" :rows="3" maxlength="300" show-word-limit placeholder="消息内容" />
        </el-form-item>

        <el-form-item label="关联模块">
          <el-select v-model="form.module" placeholder="选择模块（可选）" clearable style="width: 100%">
            <el-option v-for="m in PUSH_MODULES" :key="m.key" :label="m.label" :value="m.key" />
          </el-select>
        </el-form-item>

        <el-form-item label="跳转链接">
          <el-input v-model="form.url" placeholder="留空则跳首页，例如 /dashboard?view=todos" />
        </el-form-item>

        <el-form-item label="接收范围">
          <el-radio-group v-model="form.targetType">
            <el-radio value="all">全员</el-radio>
            <el-radio value="modules">按模块</el-radio>
            <el-radio value="users">指定用户</el-radio>
          </el-radio-group>
        </el-form-item>

        <el-form-item v-if="form.targetType === 'modules'" label="选择模块">
          <el-select v-model="form.targetModules" multiple placeholder="选择要推送的模块" style="width: 100%">
            <el-option v-for="m in PUSH_MODULES" :key="m.key" :label="m.label" :value="m.key" />
          </el-select>
        </el-form-item>

        <el-form-item v-if="form.targetType === 'users'" label="选择用户">
          <el-select
            v-model="form.targetUsernames"
            multiple
            filterable
            placeholder="选择接收账号"
            style="width: 100%"
            :loading="usersLoading"
          >
            <el-option v-for="u in users" :key="u.username" :label="`${u.nickname || u.username}（${u.username}）`" :value="u.username" />
          </el-select>
        </el-form-item>

        <el-alert
          v-if="lastResult"
          :type="lastResult.ok ? 'success' : 'warning'"
          :closable="false"
          :title="lastResult.text"
          style="margin-bottom: 12px"
        >
          <div v-if="lastResult.detail" class="push-detail">{{ lastResult.detail }}</div>
        </el-alert>

        <div class="push-actions">
          <el-button type="primary" :loading="sending" @click="onSend">发送推送</el-button>
          <el-button @click="onTestSelf" :loading="testing">给自己发测试</el-button>
        </div>
      </el-form>
    </el-card>

    <el-card class="push-card" shadow="never" style="margin-top: 16px">
      <template #header><span>本机订阅状态</span></template>
      <div v-if="!isPushSupported()" class="sub-tip warn">当前浏览器不支持 Web Push（请使用 Chrome/Edge/Safari 16.4+）。</div>
      <div v-else>
        <div class="sub-row">
          <span>通知权限：<b>{{ permissionLabel }}</b></span>
          <span v-if="subRow">已订阅（模块：{{ subModulesLabel }}）</span>
          <span v-else>未订阅</span>
        </div>
        <div class="sub-modules">
          <span class="sub-modules-label">接收模块：</span>
          <el-checkbox-group v-model="localModules">
            <el-checkbox v-for="m in PUSH_MODULES" :key="m.key" :value="m.key">{{ m.label }}</el-checkbox>
          </el-checkbox-group>
        </div>
        <div class="push-actions">
          <el-button v-if="!subRow" type="success" :loading="subLoading" @click="onSubscribe">订阅本机通知</el-button>
          <el-button v-else :loading="subLoading" @click="onUpdateModules">保存模块选择</el-button>
          <el-button v-if="subRow" text type="danger" @click="onUnsubscribe">退订</el-button>
        </div>
        <div v-if="subMsg" class="sub-tip">{{ subMsg }}</div>
        <div class="sub-tip" style="margin-top: 12px">
          Web Push 依赖浏览器推送通道，需在<strong>每个设备/浏览器</strong>上点击“订阅”并授权通知。
          iOS 需 Safari 16.4+ 且添加到主屏幕；部分安卓浏览器或企业网络可能收不到，此时会自动降级为站内消息。
        </div>
      </div>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import {
  PUSH_MODULES,
  isPushSupported,
  currentPermission,
  subscribe as pushSubscribe,
  updateModules,
  unsubscribe as pushUnsubscribe,
  getSubscriptionRow,
  listTargetUsers,
  sendMessage,
  type AccountOption,
  type PushSubscriptionRow
} from '../services/pushService'
import { getSavedUser } from '../services/appDataService'

const form = reactive({
  title: '',
  body: '',
  module: '',
  url: '',
  targetType: 'all' as 'all' | 'modules' | 'users',
  targetModules: [] as string[],
  targetUsernames: [] as string[]
})

const users = ref<AccountOption[]>([])
const usersLoading = ref(false)
const sending = ref(false)
const testing = ref(false)
const lastResult = ref<{ ok: boolean; text: string; detail?: string } | null>(null)

const permission = ref<NotificationPermission>('default')
const subRow = ref<PushSubscriptionRow | null>(null)
const localModules = ref<string[]>(PUSH_MODULES.map((m) => m.key))
const subLoading = ref(false)
const subMsg = ref('')

const permissionLabel = computed(() => {
  if (permission.value === 'granted') return '已授权'
  if (permission.value === 'denied') return '已拒绝'
  return '未授权'
})
const subModulesLabel = computed(() =>
  (subRow.value?.modules || []).map((k) => PUSH_MODULES.find((m) => m.key === k)?.label || k).join('、') || '（无）'
)

async function loadUsers() {
  usersLoading.value = true
  try {
    users.value = await listTargetUsers()
  } catch {
    users.value = []
  } finally {
    usersLoading.value = false
  }
}

async function refreshSubState() {
  permission.value = currentPermission()
  if (!isPushSupported()) return
  try {
    subRow.value = await getSubscriptionRow()
    if (subRow.value) localModules.value = subRow.value.modules?.length ? subRow.value.modules : PUSH_MODULES.map((m) => m.key)
  } catch {
    subRow.value = null
  }
}

async function onSend() {
  if (!form.title.trim()) {
    ElMessage.warning('请填写标题')
    return
  }
  sending.value = true
  lastResult.value = null
  try {
    const res = await sendMessage({
      title: form.title.trim(),
      body: form.body.trim(),
      module: form.module || undefined,
      url: form.url.trim() || undefined,
      targetType: form.targetType,
      targetModules: form.targetType === 'modules' ? form.targetModules : undefined,
      targetUsernames: form.targetType === 'users' ? form.targetUsernames : undefined
    })
    if (res.sent === 0 && res.notified === 0 && !res.fallback) {
      lastResult.value = { ok: false, text: '未部署推送服务或没有匹配接收人，消息未发出', detail: res.error }
      ElMessage.warning(res.error || '未部署推送服务或没有匹配接收人')
    } else {
      const base = res.fallback
        ? `Web Push 未真正发出，已降级为站内消息 ${res.notified} 条`
        : `推送成功：已发送 ${res.sent} 台设备，站内消息 ${res.notified} 条`
      lastResult.value = { ok: !res.fallback, text: base, detail: res.error }
      ElMessage[res.fallback ? 'warning' : 'success'](res.error || base)
    }
  } catch (e) {
    lastResult.value = { ok: false, text: '发送失败：' + (e instanceof Error ? e.message : String(e)) }
  } finally {
    sending.value = false
  }
}

async function onTestSelf() {
  testing.value = true
  try {
    const me = await getSavedUser()
    if (!me?.username) {
      ElMessage.warning('无法获取当前账号')
      return
    }
    const res = await sendMessage({
      title: form.title.trim() || '测试推送',
      body: form.body.trim() || '这是一条来自管理后台的测试消息',
      module: form.module || 'system',
      url: form.url.trim() || '/welcome',
      targetType: 'users',
      targetUsernames: [me.username]
    })
    if (res.sent === 0 && res.notified === 0 && !res.fallback) {
      ElMessage.warning(res.error || '未部署推送服务或当前账号无接收权限，测试未发出')
    } else {
      ElMessage[res.fallback ? 'warning' : 'success'](
        res.error || `已发送：推送 ${res.sent} 台、站内消息 ${res.notified} 条`
      )
    }
  } catch (e) {
    ElMessage.error('测试失败：' + (e instanceof Error ? e.message : String(e)))
  } finally {
    testing.value = false
  }
}

async function onSubscribe() {
  subLoading.value = true
  subMsg.value = ''
  try {
    await pushSubscribe(localModules.value)
    subMsg.value = '订阅成功，今后将接收所选模块的消息'
    await refreshSubState()
  } catch (e) {
    subMsg.value = '订阅失败：' + (e instanceof Error ? e.message : String(e))
  } finally {
    subLoading.value = false
  }
}

async function onUpdateModules() {
  subLoading.value = true
  subMsg.value = ''
  try {
    await updateModules(localModules.value)
    subMsg.value = '模块选择已保存'
    await refreshSubState()
  } catch (e) {
    subMsg.value = '保存失败：' + (e instanceof Error ? e.message : String(e))
  } finally {
    subLoading.value = false
  }
}

async function onUnsubscribe() {
  subLoading.value = true
  subMsg.value = ''
  try {
    await pushUnsubscribe()
    subRow.value = null
    subMsg.value = '已退订'
  } catch (e) {
    subMsg.value = '退订失败：' + (e instanceof Error ? e.message : String(e))
  } finally {
    subLoading.value = false
  }
}

onMounted(() => {
  loadUsers()
  refreshSubState()
})
</script>

<style scoped>
.push-manage {
  max-width: 760px;
  margin: 0 auto;
  padding: 4px 4px 24px;
}
.page-title {
  font-size: 20px;
  font-weight: 700;
  margin: 0 0 4px;
  color: var(--text-strong);
}
.page-desc {
  margin: 0 0 16px;
  color: var(--text-muted);
  font-size: 13px;
}
.push-card {
  border-radius: 14px;
  background: var(--surface);
  border: 1px solid var(--border);
}
.push-actions {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  margin-top: 4px;
}
.sub-tip {
  font-size: 13px;
  color: var(--text-muted);
  margin-top: 8px;
}
.sub-tip.warn {
  color: #ef4444;
}
.sub-row {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
  font-size: 13px;
  color: var(--text);
  margin-bottom: 10px;
}
.sub-modules {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  flex-wrap: wrap;
  margin-bottom: 12px;
}
.sub-modules-label {
  font-size: 13px;
  color: var(--text-muted);
  padding-top: 6px;
}
.sub-modules :deep(.el-checkbox-group) {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 14px;
}
.push-detail {
  margin-top: 6px;
  font-size: 12px;
  color: var(--text-muted);
  word-break: break-all;
}

@media (max-width: 768px) {
  .push-manage {
    padding: 4px 8px 90px;
  }
}
</style>
