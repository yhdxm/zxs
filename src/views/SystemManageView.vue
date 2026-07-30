<template>
  <div class="sys-page">
    <!-- ===== 账号管理 ===== -->
    <section v-if="activeView === 'accounts'" class="sys-section">
      <div class="section-head">
        <div>
          <h3>账号管理</h3>
          <p class="section-tip">支持用户名查询、新增、编辑、删除、禁用/启用</p>
        </div>
        <el-button type="primary" @click="openAdd"><el-icon><Plus /></el-icon> 新增账号</el-button>
      </div>

      <div class="section-filter">
        <el-input v-model="keyword" placeholder="输入用户名搜索" clearable @keyup.enter="search">
          <template #prefix><el-icon><Search /></el-icon></template>
        </el-input>
        <el-button @click="search">查询</el-button>
        <el-button @click="resetSearch">重置</el-button>
      </div>

      <el-table :data="manageableAccounts" v-loading="loading" stripe class="account-table" table-layout="auto">
        <el-table-column prop="username" label="用户名" min-width="120" />
        <el-table-column prop="nickname" label="昵称" min-width="120" />
        <el-table-column prop="role" label="角色" min-width="110">
          <template #default="{ row }">
            <el-tag :type="roleTagType(row.role)" effect="light">{{ roleLabel(row.role) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="disabled" label="状态" min-width="100">
          <template #default="{ row }">
            <el-tag :type="row.disabled ? 'danger' : 'success'" effect="light">{{ row.disabled ? '已禁用' : '正常' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="createdAt" label="创建时间" min-width="160">
          <template #default="{ row }">
            {{ formatDateTime(row.createdAt) }}
          </template>
        </el-table-column>
        <el-table-column label="操作" fixed="right" min-width="200">
          <template #default="{ row }">
            <el-button v-if="canManage(row)" text size="small" @click="openEdit(row)"><el-icon><Edit /></el-icon> 编辑</el-button>
            <el-button
              v-if="canManage(row)"
              text
              size="small"
              :type="row.disabled ? 'success' : 'warning'"
              @click="toggleDisabled(row)"
            >
              {{ row.disabled ? '启用' : '禁用' }}
            </el-button>
            <el-button v-if="canManage(row)" text size="small" type="danger" @click="remove(row)"><el-icon><Delete /></el-icon> 删除</el-button>
            <span v-else class="perm-hint">无权限</span>
          </template>
        </el-table-column>
      </el-table>

      <div v-if="accounts.length === 0 && !loading" class="section-empty">
        <el-icon><Document /></el-icon>
        <p>暂无账号数据</p>
      </div>
    </section>

    <!-- ===== 角色权限 ===== -->
    <section v-else class="sys-section role-section">
      <div class="role-layout">
        <!-- 左侧角色列表 -->
        <aside class="role-list-panel">
          <div class="role-list-head">
            <h3>角色权限</h3>
            <el-button type="primary" size="small" @click="openAddRole"><el-icon><Plus /></el-icon> 新增角色</el-button>
          </div>
          <p class="section-tip">自定义每个角色可访问的模块与平台</p>

          <div class="role-list">
            <div
              v-for="role in permissionConfig.roles"
              :key="role.key"
              class="role-list-item"
              :class="{ active: editingRole?.key === role.key }"
              @click="selectRole(role)"
            >
              <div class="role-list-info">
                <span class="role-list-name">{{ role.name }}</span>
                <span v-if="role.description" class="role-list-desc">{{ role.description }}</span>
              </div>
              <div class="role-list-actions">
                <el-button text circle size="small" @click.stop="openEditRole(role)"><el-icon><Edit /></el-icon></el-button>
                <el-button v-if="!isBuiltinRole(role.key)" text circle size="small" type="danger" @click.stop="removeRole(role)"><el-icon><Delete /></el-icon></el-button>
              </div>
            </div>
          </div>
        </aside>

        <!-- 右侧权限编辑 -->
        <div class="role-edit-panel">
          <div v-if="editingRole" class="role-edit-form">
            <div class="role-edit-head">
              <div class="role-edit-fields">
                <el-input v-model="editingRole.name" placeholder="角色名称" maxlength="20" />
                <el-input v-model="editingRole.description" placeholder="角色描述（可选）" maxlength="60" />
              </div>
              <div class="role-edit-actions">
                <el-button @click="cancelEditRole">取消</el-button>
                <el-button type="primary" :loading="savingRole" @click="saveRole">保存</el-button>
              </div>
            </div>

            <div class="perm-tree-card">
              <h4>权限管理</h4>
              <el-tree
                ref="permTreeRef"
                :data="permTreeData"
                show-checkbox
                node-key="id"
                :default-checked-keys="editingRole.permissions"
                :props="{ label: 'label', children: 'children' }"
                @check-change="onPermCheckChange"
              />
            </div>
          </div>

          <div v-else class="role-edit-empty">
            <el-icon><UserFilled /></el-icon>
            <p>请在左侧选择一个角色进行编辑，或新增角色</p>
          </div>
        </div>
      </div>
    </section>

    <!-- 新增 / 编辑账号 -->
    <el-dialog v-model="dialogVisible" :title="dialogTitle" width="520px" class="premium-dialog" align-center>
      <el-form :model="form" label-position="top" :rules="formRules" ref="formRef">
        <el-form-item label="用户名" prop="username" v-if="!isEdit">
          <el-input v-model="form.username" placeholder="4-20 位字母、数字或下划线" maxlength="20" />
        </el-form-item>
        <el-form-item label="昵称" prop="nickname">
          <el-input v-model="form.nickname" placeholder="展示用昵称" maxlength="20" />
        </el-form-item>
        <el-form-item label="角色" prop="role">
          <el-select v-model="form.role" style="width: 100%">
            <el-option v-for="role in availableRoles" :key="role.key" :label="role.name" :value="role.key" />
          </el-select>
        </el-form-item>
        <el-form-item :label="isEdit ? '新密码（留空则不修改）' : '密码'" prop="password">
          <el-input v-model="form.password" type="password" placeholder="至少 6 位" show-password maxlength="32" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="submit">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox, ElTree, type FormInstance, type FormRules } from 'element-plus'
import {
  Plus, Search, Edit, Delete, Document, UserFilled
} from '@element-plus/icons-vue'
import {
  listAccounts,
  searchAccountsByUsername,
  createAccountByAdmin,
  updateAccount,
  deleteAccount,
  toggleAccountDisabled,
  getSavedUser,
  refreshSavedUser,
  loadPermissionConfig,
  savePermissionConfig,
  PERMISSION_TREE,
  DEFAULT_ROLE_CONFIG,
  type AccountRecord,
  type UserRole,
  type AppUser,
  type PermissionConfig,
  type RoleConfig,
  type PermissionNode
} from '../services/appDataService'

const route = useRoute()
const router = useRouter()

const activeView = computed(() => {
  const v = route.query.view
  return v === 'roles' ? 'roles' : 'accounts'
})

/* ============ 账号管理 ============ */
const loading = ref(false)
const accounts = ref<AccountRecord[]>([])
const keyword = ref('')
const currentUser = ref<AppUser | null>(null)
const permissionConfig = ref<PermissionConfig>(JSON.parse(JSON.stringify(DEFAULT_ROLE_CONFIG)) as PermissionConfig)

const availableRoles = computed(() => permissionConfig.value.roles)

const isSuperAdmin = computed(() => currentUser.value?.role === 'superadmin')
const isAdmin = computed(() => currentUser.value?.role === 'admin')

const canManage = (row: AccountRecord) => {
  if (isSuperAdmin.value) return true
  if (isAdmin.value) return row.role === 'user'
  return false
}
const manageableAccounts = computed(() => accounts.value.filter((row) => canManage(row)))

const roleLabel = (role: UserRole | string) => {
  const found = permissionConfig.value.roles.find((r) => r.key === role)
  if (found) return found.name
  if (role === 'superadmin') return '超级管理员'
  if (role === 'admin') return '管理员'
  return '普通用户'
}
const roleTagType = (role: UserRole | string) => {
  if (role === 'superadmin') return 'danger'
  if (role === 'admin') return 'warning'
  return 'info'
}
const formatDateTime = (value: string) => {
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value
  return d.toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
}

const load = async () => {
  loading.value = true
  try {
    accounts.value = await listAccounts()
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '加载失败')
  } finally {
    loading.value = false
  }
}

const search = async () => {
  loading.value = true
  try {
    accounts.value = await searchAccountsByUsername(keyword.value)
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '查询失败')
  } finally {
    loading.value = false
  }
}

const resetSearch = () => {
  keyword.value = ''
  void load()
}

const dialogVisible = ref(false)
const saving = ref(false)
const isEdit = ref(false)
const formRef = ref<FormInstance>()
const form = reactive({
  id: '',
  authUserId: '',
  username: '',
  nickname: '',
  role: 'user' as UserRole | string,
  password: ''
})

const dialogTitle = computed(() => (isEdit.value ? '编辑账号' : '新增账号'))

const formRules: FormRules = {
  username: [
    { required: !isEdit.value, message: '请输入用户名', trigger: 'blur' },
    { pattern: /^[A-Za-z0-9_]{4,20}$/, message: '用户名为 4-20 位字母、数字或下划线', trigger: 'blur' }
  ],
  nickname: [{ required: true, message: '请输入昵称', trigger: 'blur' }],
  role: [{ required: true, message: '请选择角色', trigger: 'change' }]
}

const openAdd = () => {
  isEdit.value = false
  form.id = ''
  form.authUserId = ''
  form.username = ''
  form.nickname = ''
  form.role = 'user'
  form.password = ''
  dialogVisible.value = true
}

const openEdit = (row: AccountRecord) => {
  isEdit.value = true
  form.id = row.id
  form.authUserId = row.authUserId || ''
  form.username = row.username
  form.nickname = row.nickname
  form.role = row.role
  form.password = ''
  dialogVisible.value = true
}

const submit = async () => {
  if (!formRef.value) return
  const valid = await formRef.value.validate().catch(() => false)
  if (!valid) return

  saving.value = true
  try {
    if (isEdit.value) {
      await updateAccount({
        id: form.authUserId,
        nickname: form.nickname,
        role: form.role as UserRole,
        password: form.password || undefined
      })
      ElMessage.success('已保存')
    } else {
      const current = await getSavedUser()
      await createAccountByAdmin({
        username: form.username,
        password: form.password,
        nickname: form.nickname,
        role: form.role as UserRole,
        createdBy: current?.id || ''
      })
      ElMessage.success('账号创建成功')
    }
    dialogVisible.value = false
    await load()
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '操作失败')
  } finally {
    saving.value = false
  }
}

const toggleDisabled = async (row: AccountRecord) => {
  try {
    await ElMessageBox.confirm(
      `确认${row.disabled ? '启用' : '禁用'}账号「${row.username}」？`,
      '提示',
      { type: 'warning' }
    )
  } catch {
    return
  }
  if (!row.authUserId) {
    ElMessage.warning('该账号未绑定认证用户，无法操作，请删除后重建')
    return
  }
  try {
    await toggleAccountDisabled(row.authUserId, !row.disabled)
    ElMessage.success(row.disabled ? '已启用' : '已禁用')
    await load()
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '操作失败')
  }
}

const remove = async (row: AccountRecord) => {
  try {
    await ElMessageBox.confirm(`确认删除账号「${row.username}」？删除后不可恢复。`, '删除账号', { type: 'warning' })
  } catch {
    return
  }
  if (!row.authUserId) {
    ElMessage.warning('该账号未绑定认证用户，无法操作，请删除后重建')
    return
  }
  try {
    await deleteAccount(row.authUserId)
    ElMessage.success('已删除')
    await load()
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '删除失败')
  }
}

/* ============ 角色权限 ============ */
const permTreeRef = ref<InstanceType<typeof ElTree> | null>(null)
const savingRole = ref(false)
const editingRole = ref<RoleConfig | null>(null)

const builtinRoles = ['superadmin', 'admin', 'user']
const isBuiltinRole = (key: string) => builtinRoles.includes(key)

interface TreeNode {
  id: string
  label: string
  children?: TreeNode[]
}

const buildPermTree = (nodes: PermissionNode[]): TreeNode[] => {
  return nodes.map((node) => ({
    id: node.key,
    label: node.label,
    children: node.children ? buildPermTree(node.children) : undefined
  }))
}

const permTreeData = computed(() => buildPermTree(PERMISSION_TREE))

const selectRole = (role: RoleConfig) => {
  editingRole.value = JSON.parse(JSON.stringify(role)) as RoleConfig
  nextTick(() => {
    permTreeRef.value?.setCheckedKeys(editingRole.value?.permissions || [])
  })
}

const openAddRole = () => {
  const key = `role_${Date.now()}`
  editingRole.value = {
    key,
    name: '',
    description: '',
    permissions: []
  }
  nextTick(() => {
    permTreeRef.value?.setCheckedKeys([])
  })
}

const openEditRole = (role: RoleConfig) => {
  selectRole(role)
}

const cancelEditRole = () => {
  editingRole.value = null
}

const onPermCheckChange = () => {
  if (!editingRole.value || !permTreeRef.value) return
  editingRole.value.permissions = permTreeRef.value.getCheckedKeys(true) as string[]
}

const removeRole = async (role: RoleConfig) => {
  try {
    await ElMessageBox.confirm(`确认删除角色「${role.name}」？已分配该角色的用户将失去对应权限。`, '删除角色', { type: 'warning' })
  } catch {
    return
  }
  permissionConfig.value.roles = permissionConfig.value.roles.filter((r) => r.key !== role.key)
  if (editingRole.value?.key === role.key) editingRole.value = null
  const ok = await savePermissionConfig(permissionConfig.value)
  if (ok) {
    ElMessage.success('已删除')
  } else {
    ElMessage.warning('云端保存失败，已仅本地生效')
  }
}

const saveRole = async () => {
  if (!editingRole.value) return
  const role = editingRole.value
  if (!role.name.trim()) {
    ElMessage.warning('请输入角色名称')
    return
  }

  savingRole.value = true
  try {
    const exists = permissionConfig.value.roles.find((r) => r.key === role.key)
    if (exists) {
      exists.name = role.name.trim()
      exists.description = role.description?.trim()
      exists.permissions = [...role.permissions]
    } else {
      permissionConfig.value.roles.push({
        key: role.key,
        name: role.name.trim(),
        description: role.description?.trim(),
        permissions: [...role.permissions]
      })
    }

    const ok = await savePermissionConfig(permissionConfig.value)
    if (ok) {
      ElMessage.success('角色权限已保存')
    } else {
      ElMessage.warning('云端保存失败，已仅本地生效')
    }
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '保存失败')
  } finally {
    savingRole.value = false
  }
}

const loadConfig = async () => {
  try {
    permissionConfig.value = await loadPermissionConfig()
  } catch {
    // 使用默认配置
  }
}

watch(() => route.query.view, () => {
  if (activeView.value === 'accounts') {
    void load()
  }
})

onMounted(async () => {
  currentUser.value = await refreshSavedUser()
  await loadConfig()
  if (activeView.value === 'accounts') {
    await load()
  }
})
</script>

<style scoped>
.sys-page {
  padding: 22px 26px calc(22px + env(safe-area-inset-bottom, 0px));
  max-width: 1280px;
  margin: 0 auto;
}

.sys-section {
  background: #fff;
  border: 1px solid #eef2f7;
  border-radius: 20px;
  padding: 22px;
  box-shadow: 0 8px 30px rgba(15, 23, 42, 0.04);
}
.section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 18px;
}
.section-head h3 { margin: 0; font-size: 18px; color: #0f172a; }
.section-tip { margin: 4px 0 0; font-size: 12px; color: #64748b; }
.section-filter {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  margin-bottom: 16px;
}
.section-filter .el-input { width: 260px; }
.account-table { width: 100%; }
.perm-hint {
  font-size: 12px;
  color: #94a3b8;
  padding-left: 6px;
}
.section-empty {
  text-align: center;
  color: #94a3b8;
  padding: 48px 20px;
}
.section-empty :deep(svg) { font-size: 36px; margin-bottom: 10px; }

/* ===== 角色权限 ===== */
.role-section { padding: 0; overflow: hidden; }
.role-layout {
  display: grid;
  grid-template-columns: 300px 1fr;
  min-height: 560px;
}
.role-list-panel {
  border-right: 1px solid #eef2f7;
  padding: 22px;
  background: #f8fafc;
}
.role-list-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 4px;
}
.role-list-head h3 { margin: 0; font-size: 17px; color: #0f172a; }
.role-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 16px;
}
.role-list-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 12px 14px;
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.2s ease;
}
.role-list-item:hover, .role-list-item.active {
  border-color: #6366f1;
  box-shadow: 0 4px 12px rgba(99, 102, 241, 0.12);
}
.role-list-item.active {
  background: rgba(99, 102, 241, 0.06);
}
.role-list-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}
.role-list-name { font-size: 14px; font-weight: 600; color: #0f172a; }
.role-list-desc { font-size: 11px; color: #94a3b8; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.role-list-actions { display: flex; align-items: center; gap: 2px; flex-shrink: 0; }
.role-list-actions .el-button { padding: 4px 6px; }

.role-edit-panel { padding: 22px; }
.role-edit-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: #94a3b8;
  gap: 10px;
}
.role-edit-empty :deep(svg) { font-size: 40px; }
.role-edit-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 20px;
  flex-wrap: wrap;
}
.role-edit-fields {
  display: flex;
  flex-direction: column;
  gap: 10px;
  flex: 1;
  min-width: 240px;
}
.role-edit-fields .el-input { width: 100%; }
.role-edit-actions { display: flex; gap: 8px; flex-shrink: 0; }

.perm-tree-card {
  background: #f8fafc;
  border: 1px solid #eef2f7;
  border-radius: 16px;
  padding: 18px;
}
.perm-tree-card h4 { margin: 0 0 14px; font-size: 15px; color: #0f172a; }
.perm-tree-card :deep(.el-tree) { background: transparent; }

@media (max-width: 860px) {
  .role-layout { grid-template-columns: 1fr; }
  .role-list-panel { border-right: none; border-bottom: 1px solid #eef2f7; }
  .section-filter .el-input { width: 100%; }
  .section-filter .el-button { flex: 1; }
}
@media (max-width: 640px) {
  .sys-page { padding: 16px 14px calc(16px + env(safe-area-inset-bottom, 0px)); }
  .section-head { flex-direction: column; align-items: flex-start; }
  .sys-section { padding: 16px; }
  .role-edit-head { flex-direction: column; }
  .role-edit-actions { width: 100%; }
  .role-edit-actions .el-button { flex: 1; }
}
</style>
