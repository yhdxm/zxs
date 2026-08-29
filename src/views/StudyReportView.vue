<template>
  <div class="sr-root">
    <PageHeader
      title="学习报告导出"
      :icon="Document"
      subtitle="学位英语 / 四六级 / 通用学习 各自独立统计与导出 · CSV 可用 Excel 打开 · PDF 走系统打印"
    >
      <template #actions>
        <el-button :icon="Refresh" :loading="loading" @click="reload">重新统计</el-button>
      </template>
    </PageHeader>

    <!-- 模块切换：三模块互相独立，不合并口径 -->
    <div class="sr-seg">
      <button
        v-for="m in MODULES"
        :key="m.key"
        type="button"
        class="sr-seg-btn"
        :class="{ on: active === m.key }"
        @click="switchModule(m.key)"
      >
        {{ m.name }}
      </button>
    </div>

    <div v-if="loading" class="sr-state">正在统计「{{ currentName }}」的学习数据…</div>

    <template v-else-if="data">
      <!-- 汇总 -->
      <div class="sr-summary">
        <div v-for="s in data.summary" :key="s.label" class="sr-stat">
          <div class="sr-stat-v">{{ s.value }}</div>
          <div class="sr-stat-l">{{ s.label }}</div>
        </div>
      </div>

      <!-- 导出操作 -->
      <div class="sr-actions">
        <el-button type="primary" :icon="Download" :disabled="!data.rows.length" @click="doExportCsv">
          导出 CSV（Excel）
        </el-button>
        <el-button :icon="Printer" :disabled="!data.rows.length" @click="doPrint">
          打印 / 存为 PDF
        </el-button>
        <span class="sr-count">共 {{ data.rows.length }} 条记录</span>
      </div>

      <!-- 明细预览 -->
      <div class="sr-table-wrap">
        <table v-if="data.rows.length" class="sr-table">
          <thead>
            <tr>
              <th v-for="h in data.headers" :key="h">{{ h }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(r, i) in previewRows" :key="i">
              <td v-for="(c, j) in r" :key="j">{{ c }}</td>
            </tr>
          </tbody>
        </table>
        <div v-else class="sr-state">暂无可导出的学习数据，先去学几个单词吧。</div>
      </div>
      <div v-if="data.rows.length > previewRows.length" class="sr-tip">
        仅预览前 {{ previewRows.length }} 条，完整数据请导出 CSV。
      </div>
    </template>

    <div v-else class="sr-state sr-err">统计失败，请稍后重试。</div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { ElButton, ElMessage } from 'element-plus'
import { Document, Download, Printer, Refresh } from '@element-plus/icons-vue'
import PageHeader from '../components/PageHeader.vue'
import {
  collectModule,
  exportDatasetToCsv,
  printReport,
  type ExportDataset,
  type ExportModuleKey
} from '../services/studyExportService'

const MODULES: Array<{ key: ExportModuleKey; name: string }> = [
  { key: 'degree', name: '学位英语' },
  { key: 'cet', name: '四六级' },
  { key: 'general', name: '通用学习' }
]

const active = ref<ExportModuleKey>('degree')
const loading = ref(false)
const data = ref<ExportDataset | null>(null)
const PREVIEW_LIMIT = 60

const currentName = computed(
  () => MODULES.find((m) => m.key === active.value)?.name || ''
)
const previewRows = computed(() => (data.value?.rows || []).slice(0, PREVIEW_LIMIT))

async function reload() {
  loading.value = true
  data.value = null
  try {
    data.value = await collectModule(active.value)
  } catch (e) {
    console.warn('[StudyReport] 统计失败', e)
    data.value = null
  } finally {
    loading.value = false
  }
}

function switchModule(key: ExportModuleKey) {
  if (key === active.value) return
  active.value = key
  void reload()
}

function doExportCsv() {
  if (!data.value || !data.value.rows.length) {
    ElMessage.warning('暂无数据可导出')
    return
  }
  exportDatasetToCsv(data.value)
  ElMessage.success('CSV 已导出，可用 Excel 打开')
}

function doPrint() {
  if (!data.value || !data.value.rows.length) {
    ElMessage.warning('暂无数据可打印')
    return
  }
  const ok = printReport(data.value)
  if (!ok) {
    // 移动端常被拦截弹窗，给出明确指引而不是静默失败
    ElMessage.warning('浏览器拦截了打印窗口，请允许本站弹窗后重试')
  }
}

onMounted(() => {
  void reload()
})
</script>

<style scoped>
.sr-root {
  padding: 4px 0 24px;
}

/* 模块切换 */
.sr-seg {
  display: flex;
  gap: 4px;
  background: #f1f5f9;
  border-radius: 12px;
  padding: 4px;
  margin-bottom: 18px;
  max-width: 420px;
}
.sr-seg-btn {
  flex: 1;
  border: none;
  background: transparent;
  padding: 10px;
  border-radius: 9px;
  font-size: 13px;
  color: #64748b;
  cursor: pointer;
  font-weight: 700;
  min-height: 40px;
}
.sr-seg-btn.on {
  background: #fff;
  color: #5b6cff;
  box-shadow: 0 1px 3px rgba(15, 23, 42, 0.09);
}

.sr-state {
  padding: 36px 12px;
  text-align: center;
  font-size: 13px;
  color: #64748b;
}
.sr-err {
  color: #b91c1c;
}

/* 汇总卡片 */
.sr-summary {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-bottom: 18px;
}
.sr-stat {
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 12px 18px;
  min-width: 96px;
  text-align: center;
  background: #fff;
}
.sr-stat-v {
  font-size: 21px;
  font-weight: 800;
  color: #5b6cff;
}
.sr-stat-l {
  font-size: 11.5px;
  color: #6b7280;
  margin-top: 2px;
}

/* 操作区 */
.sr-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  margin-bottom: 14px;
}
.sr-count {
  font-size: 12px;
  color: #94a3b8;
  margin-left: auto;
}

/* 明细表 */
.sr-table-wrap {
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  overflow: auto;
  -webkit-overflow-scrolling: touch;
  background: #fff;
}
.sr-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12.5px;
}
.sr-table th,
.sr-table td {
  border-bottom: 1px solid #eef2f7;
  padding: 8px 10px;
  text-align: left;
  white-space: nowrap;
}
.sr-table th {
  background: #f8fafc;
  font-weight: 700;
  color: #475569;
  position: sticky;
  top: 0;
}
.sr-table tr:last-child td {
  border-bottom: none;
}
.sr-tip {
  font-size: 11.5px;
  color: #94a3b8;
  margin-top: 8px;
}

/* 移动端 */
@media (max-width: 768px) {
  .sr-seg {
    max-width: none;
  }
  .sr-actions :deep(.el-button) {
    flex: 1 1 100%;
    margin-left: 0 !important;
  }
  .sr-count {
    margin-left: 0;
    width: 100%;
  }
  .sr-stat {
    flex: 1 1 calc(50% - 6px);
    min-width: 0;
    padding: 10px 12px;
  }
  .sr-stat-v {
    font-size: 19px;
  }
}
</style>
