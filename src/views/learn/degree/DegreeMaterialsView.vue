<template>
  <div class="dm">
    <h2 class="dm-title">资料中心</h2>
    <p class="dm-sub">三本官方 PDF 原版，可在线预览、进入阅读器或下载到本地。</p>

    <div class="dm-grid">
      <el-card v-for="m in materials" :key="m.id" class="dm-card" shadow="hover">
        <div class="dm-card-head">
          <el-icon :size="26" color="#534ab7"><Document /></el-icon>
          <div>
            <div class="dm-card-title">{{ m.title }}</div>
            <div class="dm-card-short">{{ m.short }} · {{ m.pages }} 页</div>
          </div>
        </div>
        <p class="dm-card-remark">{{ m.remark }}</p>
        <div class="dm-card-actions">
          <el-button type="primary" @click="openReader(m.id)">阅读器</el-button>
          <el-button @click="preview(m)">在线预览</el-button>
          <el-button tag="a" :href="pdfUrl(m.file)" target="_blank" :download="m.title">下载</el-button>
        </div>
      </el-card>
    </div>

    <el-dialog v-model="previewVisible" :title="previewTitle" width="92%" top="4vh" class="pdf-dialog">
      <iframe :src="previewUrl" class="pdf-frame" />
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { Document } from '@element-plus/icons-vue'
import { MATERIALS } from '../../../prep/degreeExamStructure'

const router = useRouter()
const base = import.meta.env.BASE_URL || '/'
const materials = MATERIALS

const previewVisible = ref(false)
const previewUrl = ref('')
const previewTitle = ref('')

function pdfUrl(file: string) {
  return base + file
}
function preview(m: { title: string; file: string }) {
  previewUrl.value = base + m.file
  previewTitle.value = m.title
  previewVisible.value = true
}
function openReader(id: string) {
  router.push({ path: '/degree/reader', query: { id } })
}
</script>

<style scoped>
.dm {
  max-width: 1100px;
  margin: 0 auto;
  padding: 16px;
}
.dm-title {
  margin: 0 0 4px;
  font-size: 20px;
  font-weight: 700;
  color: #2c2c3a;
}
.dm-sub {
  margin: 0 0 16px;
  color: #8a8aa0;
  font-size: 13px;
}
.dm-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 14px;
}
.dm-card {
  border-radius: 14px;
}
.dm-card-head {
  display: flex;
  gap: 12px;
  align-items: center;
  margin-bottom: 10px;
}
.dm-card-title {
  font-weight: 700;
  color: #2c2c3a;
}
.dm-card-short {
  font-size: 12px;
  color: #9a9ab0;
}
.dm-card-remark {
  font-size: 12px;
  color: #6a6a80;
  line-height: 1.6;
  min-height: 48px;
  margin: 0 0 12px;
}
.dm-card-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.pdf-frame {
  width: 100%;
  height: 78vh;
  border: 0;
  border-radius: 8px;
  background: #f5f5f8;
}
</style>
