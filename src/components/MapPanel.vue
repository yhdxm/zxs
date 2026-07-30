<template>
  <div class="map-panel">
    <div class="mp-head">
      <div>
        <h3>地图定位</h3>
        <p class="mp-sub">
          底图：{{ tiandituKey ? '天地图（已配置 Key）' : 'OpenStreetMap（未配置天地图 Key，降级）' }}
        </p>
      </div>
      <div class="mp-head-actions">
        <el-button size="small" @click="refreshTiles">
          <el-icon><Refresh /></el-icon> 刷新底图
        </el-button>
      </div>
    </div>

    <!-- 面包屑 + 下钻 -->
    <div class="mp-crumbs">
      <span
        v-for="(c, i) in regionStack"
        :key="c.adcode"
        class="mp-crumb"
        :class="{ active: i === regionStack.length - 1 }"
        @click="goToLevel(i)"
      >{{ c.name }}</span>
    </div>
    <div class="mp-children">
      <el-button
        v-for="node in children"
        :key="node.adcode"
        size="small"
        plain
        :loading="loadingChildren && !children.length"
        @click="enterRegion(node)"
      >{{ node.name }}</el-button>
      <span v-if="children.length === 0 && !loadingChildren" class="mp-children-empty">该层级无下级行政区</span>
    </div>

    <div ref="mapEl" class="mp-map"></div>

    <div class="mp-foot">
      <div class="mp-distance">
        <span>标点数：{{ markers.length }}</span>
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
import { ref, onMounted, onBeforeUnmount, shallowRef, nextTick } from 'vue'
import { Refresh, Delete } from '@element-plus/icons-vue'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import {
  readFreeApiKey,
  tiandituTileUrl,
  OSM_TILE_URL,
  loadGeoJson,
  loadRegionChildren,
  haversine,
  type RegionNode
} from '../services/geoService'

const mapEl = ref<HTMLDivElement | null>(null)
const map = shallowRef<L.Map | null>(null)
const tileLayer = shallowRef<L.TileLayer | null>(null)
const markerGroup = shallowRef<L.LayerGroup | null>(null)

const tiandituKey = ref('')
const regionStack = ref<{ adcode: string; name: string }[]>([{ adcode: '100000', name: '全国' }])
const children = ref<RegionNode[]>([])
const markers = ref<{ lat: number; lng: number }[]>([])
const distance = ref(0)
const loadingChildren = ref(false)
const errorMsg = ref('')

function currentAdcode(): string {
  return regionStack.value[regionStack.value.length - 1]?.adcode || '100000'
}
function currentName(): string {
  return regionStack.value[regionStack.value.length - 1]?.name || '全国'
}

function applyTiles() {
  if (!map.value) return
  if (tileLayer.value) {
    map.value.removeLayer(tileLayer.value)
    tileLayer.value = null
  }
  if (tiandituKey.value) {
    const vec = L.tileLayer(tiandituTileUrl('vec', tiandituKey.value), {
      subdomains: '01234567',
      maxZoom: 18,
      attribution: '© 天地图'
    })
    const cva = L.tileLayer(tiandituTileUrl('cva', tiandituKey.value), {
      subdomains: '01234567',
      maxZoom: 18,
      pane: 'overlayPane',
      attribution: '© 天地图注记'
    })
    vec.addTo(map.value)
    cva.addTo(map.value)
    tileLayer.value = vec
  } else {
    const osm = L.tileLayer(OSM_TILE_URL, { subdomains: 'abc', maxZoom: 19, attribution: '© OpenStreetMap' })
    osm.addTo(map.value)
    tileLayer.value = osm
  }
}

function refreshTiles() {
  tiandituKey.value = readFreeApiKey('tianditu')
  applyTiles()
}

async function loadChildren() {
  loadingChildren.value = true
  try {
    children.value = await loadRegionChildren(currentAdcode())
  } catch {
    children.value = []
  } finally {
    loadingChildren.value = false
  }
}

async function fitToRegion(adcode: string) {
  if (!map.value) return
  try {
    const geo = await loadGeoJson(adcode)
    const layer = L.geoJSON(geo as unknown as GeoJSON.GeoJsonObject)
    const bounds = layer.getBounds()
    if (bounds.isValid()) {
      map.value.fitBounds(bounds, { padding: [20, 20] })
    }
  } catch {
    /* 边界加载失败不影响交互 */
  }
}

async function enterRegion(node: RegionNode) {
  regionStack.value.push({ adcode: node.adcode, name: node.name })
  await loadChildren()
  await fitToRegion(node.adcode)
}

async function goToLevel(index: number) {
  if (index < 0 || index >= regionStack.value.length - 1) return
  regionStack.value = regionStack.value.slice(0, index + 1)
  await loadChildren()
  await fitToRegion(currentAdcode())
}

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
  if (markerGroup.value && map.value) {
    markerGroup.value.clearLayers()
  }
}

function initMap() {
  if (!mapEl.value) return
  map.value = L.map(mapEl.value, {
    center: [34.0, 108.0],
    zoom: 4,
    zoomControl: true,
    attributionControl: true
  })
  markerGroup.value = L.layerGroup().addTo(map.value)
  map.value.on('click', onMapClick)
  applyTiles()
}

onMounted(async () => {
  tiandituKey.value = readFreeApiKey('tianditu')
  await nextTick()
  initMap()
  await loadChildren()
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
}
.mp-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; margin-bottom: 10px; }
.mp-head h3 { margin: 0; font-size: 15px; color: var(--text-strong); }
.mp-sub { margin: 2px 0 0; font-size: 12px; color: var(--text-faint); }

.mp-crumbs { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; margin-bottom: 8px; font-size: 12px; }
.mp-crumb {
  color: var(--primary); cursor: pointer; padding: 2px 6px; border-radius: 6px;
}
.mp-crumb:not(:last-child)::after { content: '›'; margin-left: 6px; color: var(--text-faint); }
.mp-crumb.active { color: var(--text-strong); font-weight: 600; cursor: default; }

.mp-children { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 10px; min-height: 28px; }
.mp-children-empty { font-size: 12px; color: var(--text-faint); }

.mp-map {
  flex: 1;
  min-height: 320px;
  width: 100%;
  border-radius: 10px;
  overflow: hidden;
  background: var(--surface-soft);
  z-index: 0;
}

.mp-foot {
  display: flex; align-items: center; justify-content: space-between; gap: 12px;
  margin-top: 10px; flex-wrap: wrap;
}
.mp-distance { display: flex; gap: 16px; align-items: center; font-size: 12px; color: var(--text-muted); flex-wrap: wrap; }
.mp-distance b { color: var(--primary); font-size: 14px; }
.mp-hint { color: var(--text-faint); }
.mp-err { margin-top: 10px; }

@media (max-width: 768px) {
  .map-panel { padding: 14px; }
  .mp-map { min-height: 280px; }
}
</style>
