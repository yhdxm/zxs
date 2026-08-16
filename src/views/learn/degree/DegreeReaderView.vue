<template>
  <div class="dr">
    <header class="dr-head">
      <div>
        <h2 class="dr-title">阅读器</h2>
        <p class="dr-sub">原版 PDF 在线阅读，支持缩放与全屏；移动端可双指缩放。</p>
      </div>
      <el-select v-model="currentId" class="dr-select" placeholder="选择资料" @change="onSwitch">
        <el-option v-for="m in materials" :key="m.id" :label="m.title" :value="m.id" />
      </el-select>
    </header>

    <div class="dr-toolbar">
      <span class="dr-page-info">{{ current.pages }} 页 · {{ current.remark }}</span>
      <div class="dr-tools">
        <el-button-group>
          <el-button :icon="ZoomIn" @click="zoomIn">放大</el-button>
          <el-button :icon="ZoomOut" @click="zoomOut">缩小</el-button>
          <el-button :icon="FullScreen" @click="fullscreen">全屏</el-button>
        </el-button-group>
      </div>
    </div>

    <div class="dr-frame-wrap" ref="frameWrap">
      <iframe
        :src="pdfSrc"
        class="dr-frame"
        ref="pdfIframe"
        :style="{ width: zoom * 100 + '%' }"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { Document, ZoomIn, ZoomOut, FullScreen } from '@element-plus/icons-vue'
import { MATERIALS } from '../../../prep/degreeExamStructure'

const route = useRoute()
const base = import.meta.env.BASE_URL || '/'
const materials = MATERIALS
const currentId = ref<string>(String(route.query.id || materials[0]!.id))
const zoom = ref(1)
const frameWrap = ref<HTMLElement | null>(null)
const pdfIframe = ref<HTMLIFrameElement | null>(null)

const current = computed(() => materials.find((m) => m.id === currentId.value) || materials[0]!)
const pdfSrc = computed(() => base + current.value.file)

function onSwitch() {
  // 重新加载 iframe（改变 src 即可）
  const f = pdfIframe.value
  if (f) f.src = pdfSrc.value
}
function zoomIn() {
  zoom.value = Math.min(2, zoom.value + 0.1)
}
function zoomOut() {
  zoom.value = Math.max(0.6, zoom.value - 0.1)
}
function fullscreen() {
  const el = pdfIframe.value
  if (!el) return
  if (el.requestFullscreen) el.requestFullscreen().catch(() => {})
}

onMounted(() => {
  void Document // 保持图标引用
})
</script>

<style scoped>
.dr {
  max-width: 1100px;
  margin: 0 auto;
  padding: 16px;
}
.dr-head {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}
.dr-title {
  margin: 0 0 4px;
  font-size: 20px;
  font-weight: 700;
  color: #2c2c3a;
}
.dr-sub {
  margin: 0;
  color: #8a8aa0;
  font-size: 13px;
}
.dr-select {
  width: 240px;
}
.dr-toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  align-items: center;
  justify-content: space-between;
  background: #fff;
  border: 1px solid #eceaff;
  border-radius: 12px;
  padding: 10px 14px;
  margin-bottom: 12px;
}
.dr-page-info {
  font-size: 12px;
  color: #6a6a80;
}
.dr-frame-wrap {
  overflow: auto;
  background: #f5f5f8;
  border-radius: 12px;
  padding: 8px;
}
.dr-frame {
  border: 0;
  height: 76vh;
  display: block;
  margin: 0 auto;
  background: #fff;
}
@media (max-width: 768px) {
  .dr-select {
    width: 100%;
  }
}
</style>
