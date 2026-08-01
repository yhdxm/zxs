<template>
  <div class="map-panel">
    <!-- ===== 底图源状态（哪个能用先用哪个） ===== -->
    <div class="mp-sources">
      <div class="mp-sources-head">
        <div class="mp-sources-title">
          <el-icon><Monitor /></el-icon>
          <span>底图源状态</span>
          <el-tag v-if="activeSource" size="small" type="success" effect="dark">
            当前：{{ activeSource.name }}
          </el-tag>
          <el-tag v-else size="small" type="info" effect="plain">探测中…</el-tag>
        </div>
        <div class="mp-sources-actions">
          <el-button size="small" :loading="probing" @click="reprobe">
            <el-icon><Refresh /></el-icon> 重新探测
          </el-button>
        </div>
      </div>
      <div class="mp-source-list">
        <button
          v-for="s in TILE_SOURCES"
          :key="s.id"
          type="button"
          class="mp-source"
          :class="[
            `is-${probeState[s.id]}`,
            { active: activeSourceId === s.id, disabled: probeState[s.id] !== 'ok' }
          ]"
          :title="s.desc"
          @click="switchSource(s.id)"
        >
          <span class="mp-source-dot"></span>
          <span class="mp-source-name">{{ s.name }}</span>
          <span class="mp-source-state">{{ stateText(s.id) }}</span>
        </button>
      </div>
    </div>

    <!-- ===== 面包屑 + 下钻 ===== -->
    <div class="mp-nav">
      <div class="mp-crumbs">
        <span
          v-for="(c, i) in regionStack"
          :key="c.adcode"
          class="mp-crumb"
          :class="{ active: i === regionStack.length - 1 }"
          @click="goToLevel(i)"
        >{{ c.name }}</span>
      </div>
      <div class="mp-nav-meta">
        <span>下级行政区 <b>{{ children.length }}</b> 个</span>
        <span v-if="usedRegionFallback" class="mp-fallback-tag">已启用内置兜底数据</span>
      </div>
    </div>

    <!-- ===== 主体：地图 + 数据面板 ===== -->
    <div class="mp-body">
      <div class="mp-map-wrap">
        <div ref="mapEl" class="mp-map"></div>
        <div v-if="!activeSource && !probing" class="mp-map-mask">
          <el-icon><Warning /></el-icon>
          <p>全部底图源均不可用，已切换为纯矢量边界模式</p>
          <span>行政区边界与数据仍可正常查看</span>
        </div>
      </div>

      <aside class="mp-side">
        <div class="mp-side-head">
          <h4>{{ currentName() }} · 行政区数据</h4>
          <el-input
            v-model="filterKw"
            size="small"
            placeholder="搜索地区名称"
            clearable
          >
            <template #prefix><el-icon><Search /></el-icon></template>
          </el-input>
        </div>
        <div v-loading="loadingChildren" class="mp-side-list">
          <div
            v-for="node in filteredChildren"
            :key="node.adcode"
            class="mp-region"
            @click="enterRegion(node)"
          >
            <div class="mp-region-main">
              <span class="mp-region-name">{{ node.name }}</span>
              <span class="mp-region-code">{{ node.adcode }}</span>
            </div>
            <div class="mp-region-sub">
              <span v-if="node.center">
                {{ node.center[0].toFixed(3) }}, {{ node.center[1].toFixed(3) }}
              </span>
              <span v-else class="mp-hint">无中心点</span>
              <el-icon class="mp-region-arrow"><ArrowRight /></el-icon>
            </div>
          </div>
          <div v-if="!loadingChildren && filteredChildren.length === 0" class="mp-side-empty">
            {{ children.length ? '没有匹配的地区' : '该层级无下级行政区' }}
          </div>
        </div>
      </aside>
    </div>

    <!-- ===== 底部：标注测距 ===== -->
    <div class="mp-foot">
      <div class="mp-distance">
        <span>标点数：<b>{{ markers.length }}</b></span>
        <span v-if="markers.length >= 2">测距：<b>{{ distance.toFixed(2) }}</b> km（相邻标注累计）</span>
        <span v-else class="mp-hint">点击地图可添加标注点，两点以上自动测距</span>
      </div>
      <el-button size="small" type="danger" plain :disabled="!markers.length" @click="clearMarkers">
        <el-icon><Delete /></el-icon> 清除标点
      </el-button>
    </div>

    <el-alert v-if="errorMsg" :title="errorMsg" type="warning" :closable="false" show-icon class="mp-err" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, shallowRef, nextTick } from 'vue'
import { Refresh, Delete, Monitor, Search, ArrowRight, Warning } from '@element-plus/icons-vue'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import {
  readFreeApiKey,
  loadGeoJson,
  loadRegionChildrenSafe,
  probeTileSource,
  shiftGeoJsonToGcj02,
  wgs84ToGcj02,
  haversine,
  TILE_SOURCES,
  type TileSource,
  type TileSourceId,
  type TileProbeState,
  type RegionNode
} from '../services/geoService'

const mapEl = ref<HTMLDivElement | null>(null)
const map = shallowRef<L.Map | null>(null)
const baseLayer = shallowRef<L.TileLayer | null>(null)
const labelLayer = shallowRef<L.TileLayer | null>(null)
const boundaryLayer = shallowRef<L.GeoJSON | null>(null)
const regionDots = shallowRef<L.LayerGroup | null>(null)
const markerGroup = shallowRef<L.LayerGroup | null>(null)

const tiandituKey = ref('')
const probing = ref(false)
const probeState = ref<Record<TileSourceId, TileProbeState>>({
  tianditu: 'idle',
  amap: 'idle',
  amapSat: 'idle',
  geoq: 'idle',
  osm: 'idle'
})
const activeSourceId = ref<TileSourceId | null>(null)
const activeSource = computed<TileSource | null>(
  () => TILE_SOURCES.find((s) => s.id === activeSourceId.value) || null
)

const regionStack = ref<{ adcode: string; name: string }[]>([{ adcode: '100000', name: '全国' }])
const children = ref<RegionNode[]>([])
const usedRegionFallback = ref(false)
const filterKw = ref('')
const markers = ref<{ lat: number; lng: number }[]>([])
const distance = ref(0)
const loadingChildren = ref(false)
const errorMsg = ref('')

const filteredChildren = computed(() => {
  const kw = filterKw.value.trim()
  if (!kw) return children.value
  return children.value.filter((n) => n.name.includes(kw) || n.adcode.includes(kw))
})

function currentAdcode(): string {
  return regionStack.value[regionStack.value.length - 1]?.adcode || '100000'
}
function currentName(): string {
  return regionStack.value[regionStack.value.length - 1]?.name || '全国'
}

function stateText(id: TileSourceId): string {
  const st = probeState.value[id]
  if (st === 'ok') return activeSourceId.value === id ? '使用中' : '可用'
  if (st === 'fail') return '不可用'
  if (st === 'nokey') return '未配置 Key'
  if (st === 'probing') return '探测中'
  return '待探测'
}

/* ==================== 底图源探测与切换 ==================== */

/** 依次探测各源，第一个可用的立即启用（哪个能用先用哪个），其余继续后台探测 */
async function probeAndApply() {
  probing.value = true
  errorMsg.value = ''
  TILE_SOURCES.forEach((s) => {
    probeState.value[s.id] = s.requireKey && !tiandituKey.value ? 'nokey' : 'probing'
  })

  let applied = false
  // 串行探测保证优先级：先国内源，OSM 最后
  for (const src of TILE_SOURCES) {
    if (src.requireKey && !tiandituKey.value) continue
    const ok = await probeTileSource(src, tiandituKey.value)
    probeState.value[src.id] = ok ? 'ok' : 'fail'
    if (ok && !applied) {
      applied = true
      applySource(src.id)
    }
  }

  if (!applied) {
    activeSourceId.value = null
    clearTileLayers()
    errorMsg.value = '所有底图瓦片源当前均不可访问（可能是网络受限）。已自动降级为矢量边界模式，行政区边界与数据依旧可用。'
  }
  probing.value = false
  await drawBoundary()
}

async function reprobe() {
  tiandituKey.value = await readFreeApiKey('tianditu')
  await probeAndApply()
}

function clearTileLayers() {
  if (!map.value) return
  if (baseLayer.value) {
    map.value.removeLayer(baseLayer.value)
    baseLayer.value = null
  }
  if (labelLayer.value) {
    map.value.removeLayer(labelLayer.value)
    labelLayer.value = null
  }
}

function applySource(id: TileSourceId) {
  if (!map.value) return
  const src = TILE_SOURCES.find((s) => s.id === id)
  if (!src) return
  clearTileLayers()
  const opts: L.TileLayerOptions = {
    maxZoom: src.maxZoom,
    attribution: src.attribution
  }
  if (src.subdomains) opts.subdomains = src.subdomains
  const base = L.tileLayer(src.url(tiandituKey.value), opts)
  base.addTo(map.value)
  baseLayer.value = base
  if (src.label) {
    const lbl = L.tileLayer(src.label(tiandituKey.value), { ...opts, pane: 'overlayPane' })
    lbl.addTo(map.value)
    labelLayer.value = lbl
  }
  activeSourceId.value = id
}

async function switchSource(id: TileSourceId) {
  if (probeState.value[id] !== 'ok') return
  applySource(id)
  await drawBoundary()
}

/* ==================== 边界与行政区点位渲染 ==================== */

/** 当前底图为 GCJ-02 时，需要对 WGS84 数据做火星坐标纠偏 */
function needShift(): boolean {
  return activeSource.value?.crs === 'gcj02'
}

/** 绘制当前层级的行政区边界（即使瓦片全挂也能看到轮廓，保证页面有数据） */
async function drawBoundary() {
  if (!map.value) return
  if (boundaryLayer.value) {
    map.value.removeLayer(boundaryLayer.value)
    boundaryLayer.value = null
  }
  try {
    const geo = await loadGeoJson(currentAdcode())
    const data = needShift() ? shiftGeoJsonToGcj02(geo) : geo
    const layer = L.geoJSON(data as unknown as GeoJSON.GeoJsonObject, {
      style: () => ({
        color: '#4f46e5',
        weight: 1.4,
        opacity: 0.85,
        fillColor: '#6366f1',
        fillOpacity: activeSource.value ? 0.06 : 0.16
      })
    })
    layer.addTo(map.value)
    boundaryLayer.value = layer
    const bounds = layer.getBounds()
    if (bounds.isValid()) map.value.fitBounds(bounds, { padding: [20, 20] })
  } catch {
    /* 边界加载失败不影响其它功能 */
  }
  drawRegionDots()
}

/** 在地图上标出各下级行政区中心点，让地图始终"有数据" */
function drawRegionDots() {
  if (!map.value) return
  if (!regionDots.value) regionDots.value = L.layerGroup().addTo(map.value)
  regionDots.value.clearLayers()
  const shift = needShift()
  children.value.forEach((n) => {
    if (!n.center) return
    const [lng, lat] = shift ? wgs84ToGcj02(n.center[0], n.center[1]) : n.center
    L.circleMarker([lat, lng], {
      radius: 4,
      color: '#0ea5e9',
      fillColor: '#0ea5e9',
      fillOpacity: 0.9,
      weight: 1.5
    })
      .addTo(regionDots.value as L.LayerGroup)
      .bindTooltip(n.name, { direction: 'top', offset: [0, -4] })
      .on('click', () => enterRegion(n))
  })
}

/* ==================== 行政区下钻 ==================== */

async function loadChildren() {
  loadingChildren.value = true
  try {
    const { list, fallback } = await loadRegionChildrenSafe(currentAdcode())
    children.value = list
    usedRegionFallback.value = fallback
  } catch {
    children.value = []
    usedRegionFallback.value = false
  } finally {
    loadingChildren.value = false
  }
}

async function enterRegion(node: RegionNode) {
  if (regionStack.value.some((r) => r.adcode === node.adcode)) return
  regionStack.value.push({ adcode: node.adcode, name: node.name })
  filterKw.value = ''
  await loadChildren()
  await drawBoundary()
}

async function goToLevel(index: number) {
  if (index < 0 || index >= regionStack.value.length - 1) return
  regionStack.value = regionStack.value.slice(0, index + 1)
  filterKw.value = ''
  await loadChildren()
  await drawBoundary()
}

/* ==================== 标注测距 ==================== */

function recalcDistance() {
  let total = 0
  for (let i = 1; i < markers.value.length; i++) {
    const prev = markers.value[i - 1]
    const cur = markers.value[i]
    if (prev && cur) total += haversine({ lat: prev.lat, lon: prev.lng }, { lat: cur.lat, lon: cur.lng })
  }
  distance.value = total
}

function onMapClick(e: L.LeafletMouseEvent) {
  if (!map.value || !markerGroup.value) return
  const { lat, lng } = e.latlng
  markers.value.push({ lat, lng })
  L.circleMarker([lat, lng], {
    radius: 7,
    color: '#6366f1',
    fillColor: '#6366f1',
    fillOpacity: 0.9,
    weight: 2
  })
    .addTo(markerGroup.value)
    .bindPopup(`标注点 ${markers.value.length}<br>${lat.toFixed(4)}, ${lng.toFixed(4)}`)
  recalcDistance()
}

function clearMarkers() {
  markers.value = []
  distance.value = 0
  if (markerGroup.value) markerGroup.value.clearLayers()
}

/* ==================== 初始化 ==================== */

function initMap() {
  if (!mapEl.value) return
  map.value = L.map(mapEl.value, {
    center: [34.0, 108.0],
    zoom: 4,
    zoomControl: true,
    attributionControl: true
  })
  markerGroup.value = L.layerGroup().addTo(map.value)
  regionDots.value = L.layerGroup().addTo(map.value)
  map.value.on('click', onMapClick)
}

onMounted(async () => {
  tiandituKey.value = await readFreeApiKey('tianditu')
  await nextTick()
  initMap()
  // 行政区数据与瓦片探测并行，保证页面尽快有内容
  await Promise.all([loadChildren(), probeAndApply()])
  drawRegionDots()
})

onBeforeUnmount(() => {
  if (map.value) {
    map.value.remove()
    map.value = null
  }
})
</script>

<style scoped>
.map-panel {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 14px;
  padding: 18px;
  box-shadow: var(--shadow-card);
  height: 100%;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

/* ===== 底图源状态 ===== */
.mp-sources {
  background: var(--surface-soft);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 10px 12px;
}
.mp-sources-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  flex-wrap: wrap;
  margin-bottom: 8px;
}
.mp-sources-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-strong);
}
.mp-source-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 8px;
}
.mp-source {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: var(--surface);
  cursor: pointer;
  font-size: 12px;
  color: var(--text);
  text-align: left;
  transition: border-color 0.15s, box-shadow 0.15s;
  min-width: 0;
}
.mp-source.disabled { cursor: not-allowed; opacity: 0.7; }
.mp-source:not(.disabled):hover { border-color: var(--primary); }
.mp-source.active {
  border-color: var(--primary);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--primary) 18%, transparent);
  background: color-mix(in srgb, var(--primary) 6%, var(--surface));
}
.mp-source-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #cbd5e1;
  flex: none;
}
.mp-source.is-ok .mp-source-dot { background: #16a34a; }
.mp-source.is-fail .mp-source-dot { background: #dc2626; }
.mp-source.is-nokey .mp-source-dot { background: #f59e0b; }
.mp-source.is-probing .mp-source-dot { background: #0ea5e9; animation: mp-blink 1s infinite; }
@keyframes mp-blink { 50% { opacity: 0.25; } }
.mp-source-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-weight: 600;
}
.mp-source-state { color: var(--text-faint); flex: none; }

/* ===== 面包屑 ===== */
.mp-nav {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}
.mp-crumbs { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; font-size: 12px; }
.mp-crumb { color: var(--primary); cursor: pointer; padding: 2px 6px; border-radius: 6px; }
.mp-crumb:not(:last-child)::after { content: '›'; margin-left: 6px; color: var(--text-faint); }
.mp-crumb.active { color: var(--text-strong); font-weight: 600; cursor: default; }
.mp-nav-meta { display: flex; gap: 12px; font-size: 12px; color: var(--text-muted); flex-wrap: wrap; }
.mp-nav-meta b { color: var(--primary); }
.mp-fallback-tag {
  color: #b45309;
  background: rgba(245, 158, 11, 0.12);
  border-radius: 6px;
  padding: 1px 8px;
}

/* ===== 主体 ===== */
.mp-body {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: minmax(0, 1fr) 280px;
  gap: 12px;
}
.mp-map-wrap { position: relative; min-width: 0; min-height: 320px; }
.mp-map {
  height: 100%;
  width: 100%;
  min-height: 320px;
  border-radius: 10px;
  overflow: hidden;
  background: var(--surface-soft);
  z-index: 0;
}
.mp-map-mask {
  position: absolute;
  left: 12px;
  right: 12px;
  top: 12px;
  padding: 10px 14px;
  border-radius: 10px;
  background: rgba(245, 158, 11, 0.1);
  border: 1px solid rgba(245, 158, 11, 0.3);
  color: #b45309;
  font-size: 12px;
  z-index: 500;
  pointer-events: none;
}
.mp-map-mask p { margin: 4px 0 2px; font-weight: 600; }
.mp-map-mask span { color: #92400e; }

/* ===== 侧栏数据面板 ===== */
.mp-side {
  display: flex;
  flex-direction: column;
  min-height: 0;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--surface-soft);
  overflow: hidden;
}
.mp-side-head {
  padding: 10px 12px;
  border-bottom: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.mp-side-head h4 {
  margin: 0;
  font-size: 13px;
  color: var(--text-strong);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.mp-side-list { flex: 1; overflow-y: auto; padding: 6px; min-height: 120px; }
.mp-region {
  padding: 8px 10px;
  border-radius: 8px;
  cursor: pointer;
  border: 1px solid transparent;
  transition: background 0.15s, border-color 0.15s;
}
.mp-region:hover {
  background: var(--surface);
  border-color: var(--primary);
}
.mp-region-main { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.mp-region-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-strong);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.mp-region-code { font-size: 11px; color: var(--text-faint); flex: none; }
.mp-region-sub {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-top: 2px;
  font-size: 11px;
  color: var(--text-muted);
}
.mp-region-arrow { color: var(--text-faint); }
.mp-side-empty { text-align: center; padding: 24px 10px; font-size: 12px; color: var(--text-faint); }

/* ===== 底部 ===== */
.mp-foot {
  display: flex; align-items: center; justify-content: space-between; gap: 12px;
  flex-wrap: wrap;
}
.mp-distance { display: flex; gap: 16px; align-items: center; font-size: 12px; color: var(--text-muted); flex-wrap: wrap; }
.mp-distance b { color: var(--primary); font-size: 14px; }
.mp-hint { color: var(--text-faint); }
.mp-err { margin-top: 2px; }

/* ===== 响应式 ===== */
@media (max-width: 1024px) {
  .mp-body { grid-template-columns: minmax(0, 1fr); }
  .mp-side { max-height: 260px; }
  .mp-map-wrap { min-height: 340px; }
}
@media (max-width: 768px) {
  .map-panel { padding: 14px; gap: 10px; }
  .mp-source-list { grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); }
  .mp-map-wrap, .mp-map { min-height: 280px; }
  .mp-side { max-height: 220px; }
  .mp-foot { align-items: flex-start; }
}
</style>
