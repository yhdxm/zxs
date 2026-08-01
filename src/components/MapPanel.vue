<template>
  <div class="map-panel">
    <!-- ===== 底图源状态 ===== -->
    <div class="mp-sources">
      <div class="mp-sources-head">
        <div class="mp-sources-title">
          <el-icon><Monitor /></el-icon>
          <span>底图源状态</span>
          <el-tag v-if="activeSource" size="small" type="success" effect="dark">
            当前：{{ activeSource.name }}
          </el-tag>
          <el-tag v-else-if="probing" size="small" type="primary">探测中…</el-tag>
          <el-tag v-else size="small" type="warning">矢量边界模式</el-tag>
        </div>
        <el-button size="small" :loading="probing" @click="reprobe">
          <el-icon><Refresh /></el-icon> 重新探测
        </el-button>
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

    <!-- ===== 功能标签页 ===== -->
    <div class="mp-tabs">
      <button
        v-for="tab in TABS"
        :key="tab.key"
        type="button"
        class="mp-tab"
        :class="{ active: activeTab === tab.key }"
        @click="activeTab = tab.key"
      >
        <el-icon><component :is="tab.icon" /></el-icon>
        <span>{{ tab.label }}</span>
      </button>
    </div>

    <!-- ===== 主体：地图 + 侧边面板 ===== -->
    <div class="mp-body">
      <div class="mp-map-wrap">
        <div ref="mapEl" class="mp-map"></div>
        <div v-if="!activeSource && !probing" class="mp-map-mask">
          <el-icon><Warning /></el-icon>
          <p>全部底图源均不可用，已切换为纯矢量边界模式</p>
          <span>行政区边界与数据仍可正常查看</span>
        </div>
        <div class="mp-map-hint">{{ tabHint }}</div>
      </div>

      <aside class="mp-side">
        <!-- 行政区 -->
        <div v-if="activeTab === 'region'" class="mp-tab-panel">
          <div class="mp-side-head">
            <h4><el-icon><MapLocation /></el-icon> 行政区查询</h4>
            <el-input
              v-model="placeQuery"
              size="small"
              placeholder="全国地名搜索，如：郑州市二七区"
              clearable
              @input="debouncedPlaceSearch"
            >
              <template #prefix><el-icon><Search /></el-icon></template>
            </el-input>
            <div v-if="placeResults.length" v-loading="placeLoading" class="mp-search-results">
              <div
                v-for="r in placeResults"
                :key="r.placeId"
                class="mp-search-item"
                @click="selectPlace(r)"
              >
                <div class="mp-search-name">{{ r.name }}</div>
                <div class="mp-search-addr">{{ r.displayName }}</div>
              </div>
            </div>
          </div>

          <div v-if="selectedPlace" class="mp-region-info">
            <div class="mp-info-title">{{ selectedPlace.name }}</div>
            <div class="mp-info-row">
              <span>坐标</span>
              <span>{{ selectedPlace.lat.toFixed(4) }}, {{ selectedPlace.lon.toFixed(4) }}</span>
            </div>
            <div v-for="f in addressFields" :key="f.key" class="mp-info-row">
              <span>{{ f.label }}</span>
              <span>{{ selectedPlace.address[f.key] || '-' }}</span>
            </div>
            <div class="mp-info-note">
              免费数据源以省/市/区（县）边界为主；乡镇/街道/村级信息依赖 OSM 开放数据覆盖，不保证完整。
            </div>
          </div>

          <div class="mp-divider"></div>

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
          <el-input
            v-model="filterKw"
            size="small"
            placeholder="在当前下级中筛选"
            clearable
            class="mp-filter"
          >
            <template #prefix><el-icon><Search /></el-icon></template>
          </el-input>
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
        </div>

        <!-- 路线规划 -->
        <div v-if="activeTab === 'route'" class="mp-tab-panel">
          <div class="mp-side-head">
            <h4><el-icon><Position /></el-icon> 路线规划</h4>
            <p class="mp-hint">输入地名或「经度,纬度」，也可直接点击地图设起点/终点。</p>
            <div class="mp-route-inputs">
              <el-input
                v-model="routeStartInput"
                size="small"
                placeholder="起点"
                clearable
                @change="geocodeStart"
              >
                <template #prefix><el-icon><MapLocation /></el-icon></template>
              </el-input>
              <el-input
                v-model="routeEndInput"
                size="small"
                placeholder="终点"
                clearable
                @change="geocodeEnd"
              >
                <template #prefix><el-icon><MapLocation /></el-icon></template>
              </el-input>
            </div>
            <div class="mp-route-actions">
              <el-button size="small" @click="swapRoutePoints">
                <el-icon><Operation /></el-icon> 交换
              </el-button>
              <el-button size="small" type="primary" :loading="routeLoading" @click="planRoute">
                <el-icon><Position /></el-icon> 规划
              </el-button>
              <el-button size="small" plain @click="clearRoute">
                <el-icon><Delete /></el-icon> 清除
              </el-button>
            </div>
          </div>

          <div v-if="routeError" class="mp-route-error">
            <el-icon><Warning /></el-icon> {{ routeError }}
          </div>

          <div v-if="routeResult" class="mp-route-result">
            <div class="mp-result-card">
              <div class="mp-result-label">距离</div>
              <div class="mp-result-value">
                {{ routeResult.distanceKm.toFixed(2) }}<span>km</span>
              </div>
            </div>
            <div class="mp-result-card">
              <div class="mp-result-label">预计时间</div>
              <div class="mp-result-value">{{ formatDuration(routeResult.durationMin) }}</div>
            </div>
          </div>

          <div class="mp-route-note">
            基于 OpenStreetMap 公开路由服务 OSRM，免费、无 Key，结果仅供参考。
          </div>
        </div>

        <!-- 测距 -->
        <div v-if="activeTab === 'measure'" class="mp-tab-panel">
          <div class="mp-side-head">
            <h4><el-icon><TrendCharts /></el-icon> 测距</h4>
            <p class="mp-hint">点击地图添加标注点，自动累计相邻点直线距离。</p>
          </div>
          <div class="mp-measure-list">
            <div v-for="(m, i) in markers" :key="i" class="mp-measure-item">
              <span>点 {{ i + 1 }}</span>
              <span>{{ m.lng.toFixed(4) }}, {{ m.lat.toFixed(4) }}</span>
            </div>
          </div>
          <div v-if="markers.length >= 2" class="mp-measure-result">
            累计直线距离：<b>{{ distance.toFixed(2) }}</b> km
          </div>
          <div v-if="markers.length" class="mp-measure-actions">
            <el-button size="small" type="danger" plain @click="clearMarkers">
              <el-icon><Delete /></el-icon> 清除标点
            </el-button>
          </div>
        </div>
      </aside>
    </div>

    <!-- ===== 底部版权说明 ===== -->
    <div class="mp-foot">
      <div class="mp-attribution">
        底图 {{ activeSource ? '© ' + activeSource.name : '无可用底图' }} · 行政区 © DataV · 地名/路线 © OpenStreetMap
      </div>
    </div>

    <el-alert
      v-if="errorMsg"
      :title="errorMsg"
      type="warning"
      :closable="false"
      show-icon
      class="mp-err"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, shallowRef, nextTick } from 'vue'
import {
  Refresh,
  Delete,
  Monitor,
  Search,
  ArrowRight,
  Warning,
  MapLocation,
  Position,
  Operation,
  TrendCharts
} from '@element-plus/icons-vue'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import {
  readFreeApiKey,
  loadGeoJson,
  loadRegionChildrenSafe,
  probeTileSource,
  shiftGeoJsonToGcj02,
  wgs84ToGcj02,
  mapPointToWgs84,
  wgs84ToMapPoint,
  haversine,
  osrmRoute,
  nominatimSearch,
  nominatimReverse,
  TILE_SOURCES,
  type TileSource,
  type TileSourceId,
  type TileProbeState,
  type RegionNode,
  type NominatimResult,
  type NominatimAddress
} from '../services/geoService'

type TabKey = 'region' | 'route' | 'measure'
const TABS = [
  { key: 'region' as TabKey, label: '行政区', icon: MapLocation },
  { key: 'route' as TabKey, label: '路线规划', icon: Position },
  { key: 'measure' as TabKey, label: '测距', icon: TrendCharts }
]

const mapEl = ref<HTMLDivElement | null>(null)
const map = shallowRef<L.Map | null>(null)
const baseLayer = shallowRef<L.TileLayer | null>(null)
const labelLayer = shallowRef<L.TileLayer | null>(null)
const boundaryLayer = shallowRef<L.GeoJSON | null>(null)
const regionDots = shallowRef<L.LayerGroup | null>(null)
const markerGroup = shallowRef<L.LayerGroup | null>(null)
const routeLayer = shallowRef<L.GeoJSON | null>(null)
const routeMarkers = shallowRef<L.LayerGroup | null>(null)

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

const activeTab = ref<TabKey>('region')
const tabHint = computed(() => {
  if (activeTab.value === 'region') return '在右侧面板搜索地名或点击下级行政区下钻'
  if (activeTab.value === 'route') return '点击地图设置起点/终点，或输入地名/坐标'
  return '点击地图添加测距标注点'
})

const regionStack = ref<{ adcode: string; name: string }[]>([{ adcode: '100000', name: '全国' }])
const children = ref<RegionNode[]>([])
const usedRegionFallback = ref(false)
const filterKw = ref('')
const loadingChildren = ref(false)

const placeQuery = ref('')
const placeResults = ref<NominatimResult[]>([])
const placeLoading = ref(false)
let placeSearchTimer: ReturnType<typeof setTimeout> | null = null

const selectedPlace = ref<{ name: string; lat: number; lon: number; address: NominatimAddress } | null>(null)
const addressFields = [
  { key: 'state', label: '省/直辖市' },
  { key: 'city', label: '市' },
  { key: 'district', label: '区/县' },
  { key: 'suburb', label: '街道/乡镇' },
  { key: 'town', label: '镇' },
  { key: 'village', label: '村' }
] as const

const markers = ref<{ lat: number; lng: number }[]>([])
const distance = ref(0)

const routeStartInput = ref('')
const routeEndInput = ref('')
const routeStart = ref<{ lat: number; lng: number } | null>(null)
const routeEnd = ref<{ lat: number; lng: number } | null>(null)
const routeResult = ref<{ distanceKm: number; durationMin: number } | null>(null)
const routeLoading = ref(false)
const routeError = ref('')

const errorMsg = ref('')

const filteredChildren = computed(() => {
  const kw = filterKw.value.trim()
  if (!kw) return children.value
  return children.value.filter((n) => n.name.includes(kw) || n.adcode.includes(kw))
})

function currentAdcode(): string {
  return regionStack.value[regionStack.value.length - 1]?.adcode || '100000'
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

async function probeAndApply() {
  probing.value = true
  errorMsg.value = ''
  TILE_SOURCES.forEach((s) => {
    probeState.value[s.id] = s.requireKey && !tiandituKey.value ? 'nokey' : 'probing'
  })

  let applied = false
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
    errorMsg.value =
      '所有底图瓦片源当前均不可访问（可能是网络受限）。已自动降级为矢量边界模式，行政区边界与数据依旧可用。'
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

function needShift(): boolean {
  return activeSource.value?.crs === 'gcj02'
}

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

/* ==================== 地名搜索 ==================== */

function debouncedPlaceSearch() {
  if (placeSearchTimer) clearTimeout(placeSearchTimer)
  placeSearchTimer = setTimeout(() => searchPlace(), 500)
}

async function searchPlace() {
  const q = placeQuery.value.trim()
  if (!q) {
    placeResults.value = []
    return
  }
  placeLoading.value = true
  try {
    placeResults.value = await nominatimSearch(q, 6)
  } catch {
    placeResults.value = []
  } finally {
    placeLoading.value = false
  }
}

async function selectPlace(r: NominatimResult) {
  placeQuery.value = r.name
  placeResults.value = []
  selectedPlace.value = { name: r.name, lat: r.lat, lon: r.lon, address: {} }
  if (map.value) {
    if (r.boundingbox && r.boundingbox.length === 4) {
      const [south, north, west, east] = r.boundingbox
      map.value.fitBounds(
        [
          [south, west],
          [north, east]
        ],
        { padding: [40, 40] }
      )
    } else {
      map.value.setView([r.lat, r.lon], 12)
    }
  }
  try {
    const rev = await nominatimReverse(r.lat, r.lon)
    selectedPlace.value = { name: r.name, lat: r.lat, lon: r.lon, address: rev.address }
  } catch {
    /* 逆地址失败不影响已选中的坐标展示 */
  }
}

/* ==================== 测距 ==================== */

function recalcDistance() {
  let total = 0
  for (let i = 1; i < markers.value.length; i++) {
    const prev = markers.value[i - 1]
    const cur = markers.value[i]
    if (prev && cur) total += haversine({ lat: prev.lat, lon: prev.lng }, { lat: cur.lat, lon: cur.lng })
  }
  distance.value = total
}

function addMeasureMarker(latlng: L.LatLng) {
  if (!map.value || !markerGroup.value) return
  markers.value.push({ lat: latlng.lat, lng: latlng.lng })
  L.circleMarker([latlng.lat, latlng.lng], {
    radius: 7,
    color: '#6366f1',
    fillColor: '#6366f1',
    fillOpacity: 0.9,
    weight: 2
  })
    .addTo(markerGroup.value)
    .bindPopup(`标注点 ${markers.value.length}<br>${latlng.lat.toFixed(4)}, ${latlng.lng.toFixed(4)}`)
  recalcDistance()
}

function clearMarkers() {
  markers.value = []
  distance.value = 0
  if (markerGroup.value) markerGroup.value.clearLayers()
}

/* ==================== 路线规划 ==================== */

function parseLatLng(text: string): { lat: number; lng: number } | null {
  const parts = text.split(/[,，]/).map((s) => parseFloat(s.trim()))
  if (parts.length !== 2 || isNaN(parts[0] ?? NaN) || isNaN(parts[1] ?? NaN)) return null
  const [a, b] = parts as [number, number]
  // 中国范围经度绝对值通常大于纬度，简单启发式判断
  if (Math.abs(a) > 55) return { lng: a, lat: b }
  return { lng: b, lat: a }
}

async function geocodeInput(
  text: string,
  setter: (p: { lat: number; lng: number }) => void,
  inputRef: { value: string }
) {
  const t = text.trim()
  if (!t) return
  const parsed = parseLatLng(t)
  if (parsed) {
    setter(parsed)
    inputRef.value = `${parsed.lng.toFixed(4)}, ${parsed.lat.toFixed(4)}`
    updateRouteMarkers()
    return
  }
  try {
    const res = await nominatimSearch(t, 1)
    const first = res[0]
    if (first) {
      const p = { lat: first.lat, lng: first.lon }
      setter(p)
      inputRef.value = `${p.lng.toFixed(4)}, ${p.lat.toFixed(4)}`
      updateRouteMarkers()
    }
  } catch {
    /* 地名解析失败静默，用户可手动输入坐标 */
  }
}

async function geocodeStart() {
  await geocodeInput(routeStartInput.value, (p) => (routeStart.value = p), routeStartInput)
}

async function geocodeEnd() {
  await geocodeInput(routeEndInput.value, (p) => (routeEnd.value = p), routeEndInput)
}

function updateRouteMarkers() {
  if (!map.value || !routeMarkers.value) return
  routeMarkers.value.clearLayers()
  if (routeStart.value) {
    L.circleMarker([routeStart.value.lat, routeStart.value.lng], {
      radius: 8,
      color: '#16a34a',
      fillColor: '#16a34a',
      fillOpacity: 0.9,
      weight: 2
    })
      .addTo(routeMarkers.value)
      .bindTooltip('起点', { direction: 'top' })
  }
  if (routeEnd.value) {
    L.circleMarker([routeEnd.value.lat, routeEnd.value.lng], {
      radius: 8,
      color: '#dc2626',
      fillColor: '#dc2626',
      fillOpacity: 0.9,
      weight: 2
    })
      .addTo(routeMarkers.value)
      .bindTooltip('终点', { direction: 'top' })
  }
}

function addRoutePoint(latlng: L.LatLng) {
  if (!routeStart.value) {
    routeStart.value = { lat: latlng.lat, lng: latlng.lng }
    routeStartInput.value = `${latlng.lng.toFixed(4)}, ${latlng.lat.toFixed(4)}`
  } else if (!routeEnd.value) {
    routeEnd.value = { lat: latlng.lat, lng: latlng.lng }
    routeEndInput.value = `${latlng.lng.toFixed(4)}, ${latlng.lat.toFixed(4)}`
  } else {
    routeEnd.value = { lat: latlng.lat, lng: latlng.lng }
    routeEndInput.value = `${latlng.lng.toFixed(4)}, ${latlng.lat.toFixed(4)}`
  }
  updateRouteMarkers()
}

function swapRoutePoints() {
  const s = routeStart.value
  const e = routeEnd.value
  const si = routeStartInput.value
  const ei = routeEndInput.value
  routeStart.value = e
  routeEnd.value = s
  routeStartInput.value = ei
  routeEndInput.value = si
  updateRouteMarkers()
}

async function planRoute() {
  if (!routeStart.value || !routeEnd.value) {
    routeError.value = '请先设置起点和终点'
    return
  }
  routeLoading.value = true
  routeError.value = ''
  try {
    const startWgs = mapPointToWgs84(
      routeStart.value.lng,
      routeStart.value.lat,
      activeSource.value?.crs || 'wgs84'
    )
    const endWgs = mapPointToWgs84(
      routeEnd.value.lng,
      routeEnd.value.lat,
      activeSource.value?.crs || 'wgs84'
    )
    const result = await osrmRoute(startWgs, endWgs)
    routeResult.value = { distanceKm: result.distanceKm, durationMin: result.durationMin }
    drawRoute(result.geometry)
  } catch (e) {
    routeError.value = e instanceof Error ? e.message : '路线规划失败'
  } finally {
    routeLoading.value = false
  }
}

function drawRoute(geometry: GeoJSON.LineString) {
  if (!map.value) return
  if (routeLayer.value) {
    map.value.removeLayer(routeLayer.value)
    routeLayer.value = null
  }
  const crs = activeSource.value?.crs || 'wgs84'
  const coords = geometry.coordinates.map((coord) => {
    const [lng, lat] = coord as [number, number]
    const [x, y] = wgs84ToMapPoint(lng, lat, crs)
    return [y, x]
  })
  routeLayer.value = L.geoJSON({ type: 'LineString', coordinates: coords } as GeoJSON.GeoJsonObject, {
    style: {
      color: '#2563eb',
      weight: 5,
      opacity: 0.85,
      lineCap: 'round',
      lineJoin: 'round'
    }
  }).addTo(map.value)
  const bounds = routeLayer.value.getBounds()
  if (bounds.isValid()) map.value.fitBounds(bounds, { padding: [40, 40] })
}

function clearRoute() {
  routeStart.value = null
  routeEnd.value = null
  routeStartInput.value = ''
  routeEndInput.value = ''
  routeResult.value = null
  routeError.value = ''
  if (routeLayer.value && map.value) {
    map.value.removeLayer(routeLayer.value)
    routeLayer.value = null
  }
  if (routeMarkers.value) routeMarkers.value.clearLayers()
}

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} 分钟`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m ? `${h} 小时 ${m} 分钟` : `${h} 小时`
}

/* ==================== 地图交互 ==================== */

function onMapClick(e: L.LeafletMouseEvent) {
  if (activeTab.value === 'measure') addMeasureMarker(e.latlng)
  else if (activeTab.value === 'route') addRoutePoint(e.latlng)
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
  routeMarkers.value = L.layerGroup().addTo(map.value)
  map.value.on('click', onMapClick)
}

onMounted(async () => {
  tiandituKey.value = await readFreeApiKey('tianditu')
  await nextTick()
  initMap()
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
  padding: 16px;
  box-shadow: var(--shadow-card);
  height: 100%;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  gap: 10px;
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
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 8px;
}
.mp-source {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 10px;
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

/* ===== 功能标签页 ===== */
.mp-tabs {
  display: flex;
  gap: 8px;
  border-bottom: 1px solid var(--border);
  padding-bottom: 8px;
}
.mp-tab {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 7px 14px;
  border-radius: 8px;
  border: 1px solid transparent;
  background: transparent;
  color: var(--text-muted);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
}
.mp-tab:hover { color: var(--primary); background: var(--surface-soft); }
.mp-tab.active {
  color: var(--primary);
  background: color-mix(in srgb, var(--primary) 8%, var(--surface));
  border-color: color-mix(in srgb, var(--primary) 30%, var(--border));
}

/* ===== 主体 ===== */
.mp-body {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: minmax(0, 1fr) 300px;
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
.mp-map-hint {
  position: absolute;
  left: 12px;
  bottom: 12px;
  padding: 6px 10px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.92);
  border: 1px solid var(--border);
  color: var(--text-muted);
  font-size: 12px;
  z-index: 400;
  pointer-events: none;
  max-width: calc(100% - 24px);
}

/* ===== 侧边面板 ===== */
.mp-side {
  display: flex;
  flex-direction: column;
  min-height: 0;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--surface-soft);
  overflow: hidden;
}
.mp-tab-panel {
  display: flex;
  flex-direction: column;
  min-height: 0;
  height: 100%;
}
.mp-side-head {
  padding: 12px;
  border-bottom: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.mp-side-head h4 {
  margin: 0;
  font-size: 14px;
  color: var(--text-strong);
  display: flex;
  align-items: center;
  gap: 6px;
}
.mp-hint { color: var(--text-faint); font-size: 12px; line-height: 1.4; }

/* ===== 地名搜索结果 ===== */
.mp-search-results {
  max-height: 180px;
  overflow-y: auto;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface);
  margin-top: 2px;
}
.mp-search-item {
  padding: 8px 10px;
  cursor: pointer;
  border-bottom: 1px solid var(--border);
  transition: background 0.15s;
}
.mp-search-item:last-child { border-bottom: none; }
.mp-search-item:hover { background: var(--surface-soft); }
.mp-search-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-strong);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.mp-search-addr {
  font-size: 11px;
  color: var(--text-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  margin-top: 2px;
}

/* ===== 选中地点信息 ===== */
.mp-region-info {
  padding: 12px;
  background: var(--surface);
}
.mp-info-title {
  font-size: 14px;
  font-weight: 700;
  color: var(--text-strong);
  margin-bottom: 8px;
}
.mp-info-row {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  font-size: 12px;
  padding: 4px 0;
  border-bottom: 1px dashed var(--border);
}
.mp-info-row:last-child { border-bottom: none; }
.mp-info-row span:first-child { color: var(--text-muted); flex: none; }
.mp-info-row span:last-child { color: var(--text-strong); text-align: right; }
.mp-info-note {
  margin-top: 8px;
  padding: 6px 8px;
  border-radius: 6px;
  background: rgba(245, 158, 11, 0.08);
  color: #92400e;
  font-size: 11px;
  line-height: 1.4;
}

.mp-divider { height: 1px; background: var(--border); }

/* ===== 面包屑与下级列表 ===== */
.mp-crumbs {
  padding: 10px 12px 0;
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: center;
  font-size: 12px;
}
.mp-crumb { color: var(--primary); cursor: pointer; padding: 2px 6px; border-radius: 6px; }
.mp-crumb:not(:last-child)::after { content: '›'; margin-left: 6px; color: var(--text-faint); }
.mp-crumb.active { color: var(--text-strong); font-weight: 600; cursor: default; }
.mp-nav-meta {
  padding: 6px 12px;
  display: flex;
  gap: 12px;
  font-size: 12px;
  color: var(--text-muted);
  flex-wrap: wrap;
}
.mp-nav-meta b { color: var(--primary); }
.mp-fallback-tag {
  color: #b45309;
  background: rgba(245, 158, 11, 0.12);
  border-radius: 6px;
  padding: 1px 8px;
}
.mp-filter { padding: 0 12px 8px; }
.mp-side-list { flex: 1; overflow-y: auto; padding: 6px; min-height: 120px; }
.mp-region {
  padding: 8px 10px;
  border-radius: 8px;
  cursor: pointer;
  border: 1px solid transparent;
  transition: background 0.15s, border-color 0.15s;
}
.mp-region:hover { background: var(--surface); border-color: var(--primary); }
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

/* ===== 路线规划 ===== */
.mp-route-inputs { display: flex; flex-direction: column; gap: 8px; }
.mp-route-actions { display: flex; gap: 8px; flex-wrap: wrap; }
.mp-route-error {
  padding: 10px 12px;
  display: flex;
  align-items: center;
  gap: 6px;
  color: #b45309;
  font-size: 12px;
  background: rgba(245, 158, 11, 0.08);
}
.mp-route-result {
  padding: 12px;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}
.mp-result-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 10px;
  text-align: center;
}
.mp-result-label { font-size: 12px; color: var(--text-muted); margin-bottom: 4px; }
.mp-result-value { font-size: 18px; font-weight: 700; color: var(--primary); }
.mp-result-value span { font-size: 12px; color: var(--text-muted); margin-left: 2px; }
.mp-route-note {
  padding: 0 12px 12px;
  font-size: 11px;
  color: var(--text-faint);
  line-height: 1.4;
}

/* ===== 测距 ===== */
.mp-measure-list {
  flex: 1;
  overflow-y: auto;
  padding: 8px 12px;
  min-height: 120px;
}
.mp-measure-item {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  padding: 6px 0;
  font-size: 12px;
  border-bottom: 1px dashed var(--border);
}
.mp-measure-item span:first-child { color: var(--text-muted); }
.mp-measure-item span:last-child { color: var(--text-strong); font-family: monospace; }
.mp-measure-result {
  padding: 10px 12px;
  font-size: 13px;
  color: var(--text-muted);
  background: var(--surface);
}
.mp-measure-result b { color: var(--primary); font-size: 16px; }
.mp-measure-actions { padding: 0 12px 12px; }

/* ===== 底部 ===== */
.mp-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}
.mp-attribution {
  font-size: 11px;
  color: var(--text-faint);
}
.mp-err { margin-top: 2px; }

/* ===== 响应式 ===== */
@media (max-width: 1024px) {
  .mp-body { grid-template-columns: minmax(0, 1fr); }
  .mp-side { max-height: 320px; }
  .mp-map-wrap { min-height: 340px; }
}
@media (max-width: 768px) {
  .map-panel { padding: 14px; gap: 10px; }
  .mp-source-list { grid-template-columns: repeat(auto-fill, minmax(110px, 1fr)); }
  .mp-tab { padding: 6px 10px; font-size: 12px; }
  .mp-map-wrap, .mp-map { min-height: 280px; }
  .mp-side { max-height: 280px; }
  .mp-route-result { grid-template-columns: 1fr; }
}
</style>
