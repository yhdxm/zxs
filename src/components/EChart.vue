<template>
  <div ref="chartRef" class="e-chart" :style="{ height }"></div>
</template>

<script setup lang="ts">
import type { EChartsOption } from 'echarts'
import * as echarts from 'echarts/core'
import { LineChart, BarChart, PieChart, GaugeChart } from 'echarts/charts'
import { GridComponent, TooltipComponent, LegendComponent, TitleComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'

// 按需注册：项目实际仅用到 line/bar/pie/gauge 四种图表及 grid/tooltip/legend/title 组件，显著减小打包体积
echarts.use([
  LineChart, BarChart, PieChart, GaugeChart,
  GridComponent, TooltipComponent, LegendComponent, TitleComponent,
  CanvasRenderer
])

const props = withDefaults(
  defineProps<{
    /** ECharts 配置项 */
    option: EChartsOption
    /** 容器高度，默认 280px */
    height?: string
  }>(),
  {
    height: '280px'
  }
)

const chartRef = ref<HTMLDivElement | null>(null)
let chart: echarts.EChartsType | null = null
let resizeObserver: ResizeObserver | null = null

function render() {
  if (!chartRef.value) {
    return
  }
  if (!chart) {
    chart = echarts.init(chartRef.value)
  }
  chart.setOption(props.option, true)
}

function handleResize() {
  chart?.resize()
}

onMounted(() => {
  render()
  if (chartRef.value && typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver(() => handleResize())
    resizeObserver.observe(chartRef.value)
  } else if (typeof window !== 'undefined') {
    window.addEventListener('resize', handleResize)
  }
})

watch(
  () => props.option,
  () => render(),
  { deep: true }
)

onBeforeUnmount(() => {
  if (resizeObserver) {
    resizeObserver.disconnect()
    resizeObserver = null
  }
  if (typeof window !== 'undefined') {
    window.removeEventListener('resize', handleResize)
  }
  chart?.dispose()
  chart = null
})
</script>

<style scoped>
.e-chart {
  width: 100%;
}
</style>
