<template>
  <div class="ai-page">
    <div class="ai-head">
      <h2>AI 与股票</h2>
      <p class="ai-sub">复用已配置的 AI 密钥（不额外收费）· 把实时行情交给 AI 做结构化解读</p>
    </div>

    <div class="ai-card">
      <div class="ai-row">
        <span class="ai-label">选择分析标的</span>
        <div class="ai-chips">
          <span
            v-for="t in TARGETS"
            :key="t.code"
            :class="['ai-chip', selected.includes(t.code) ? 'on' : '']"
            @click="toggle(t.code)"
            >{{ t.label }}</span
          >
          <span v-if="customCode" :class="['ai-chip', 'on']" @click="removeCustom">{{ customCode }} ×</span>
        </div>
        <el-input
          v-model="customInput"
          placeholder="加其他代码，如 sz002594"
          style="width: 200px"
          @keyup.enter="addCustom"
        />
        <el-button size="small" @click="addCustom">添加</el-button>
      </div>

      <div class="ai-row">
        <span class="ai-label">提问</span>
        <el-input
          v-model="question"
          type="textarea"
          :rows="2"
          placeholder="想让 AI 分析什么？例如：结合今日行情与近期热点，给出该标的的支撑位与风险提示"
        />
      </div>

      <div class="ai-snapshot" v-if="snapshotList.length">
        <div v-for="q in snapshotList" :key="q.code" class="ai-snap">
          <span class="ai-snap-name">{{ q.name }}</span>
          <span :class="trendClass(q)">{{ formatNum(q.price, 2) }}</span>
          <span :class="trendClass(q)">{{ q.changePercent >= 0 ? '+' : '' }}{{ formatNum(q.changePercent, 2) }}%</span>
        </div>
      </div>

      <el-button type="primary" :loading="loading" @click="run">AI 分析</el-button>
      <span class="ai-note" v-if="!cfg">未检测到 AI 配置，请先到「AI 助手」配置密钥后再使用。</span>
    </div>

    <div class="ai-result" v-if="result">
      <div class="ai-result-title">AI 解读</div>
      <div class="ai-result-body">{{ result }}</div>
      <div class="ai-result-foot">数据来源：腾讯财经实时行情 + AI 生成 · 仅供参考，不构成投资建议</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref, computed } from 'vue'
import { loadAiConfig, callAi, type AiConfig } from '../../services/aiService'
import { fetchQuotes, type Quote } from '../../services/tencentFinance'

const TARGETS = [
  { code: 'sh000001', label: '上证指数' },
  { code: 'sh600519', label: '贵州茅台' },
  { code: 'sz300750', label: '宁德时代' },
  { code: 'hf_XAUUSD', label: '伦敦金' }
]
const selected = ref<string[]>(['sh000001'])
const customInput = ref('')
const customCode = ref('')
const question = ref('结合今日行情与近期热点，给出该标的的支撑位、压力位与风险提示')
const result = ref('')
const loading = ref(false)
const cfg = ref<AiConfig | null>(null)
const quotesMap = ref<Record<string, Quote>>({})

const snapshotList = computed(() => {
  const codes = activeCodes()
  return codes.map((c) => quotesMap.value[c]).filter((q): q is Quote => Boolean(q))
})

function activeCodes(): string[] {
  const set = [...selected.value]
  if (customCode.value) set.push(customCode.value)
  return set
}
function formatNum(v: number, d = 2): string {
  return (v || 0).toFixed(d)
}
function trendClass(q: Quote): string {
  if (q.change > 0) return 'up'
  if (q.change < 0) return 'down'
  return 'flat'
}
function toggle(code: string): void {
  if (selected.value.includes(code)) selected.value = selected.value.filter((c) => c !== code)
  else selected.value.push(code)
  void loadQuotes()
}
function addCustom(): void {
  const c = customInput.value.trim()
  if (!c) return
  customCode.value = c
  customInput.value = ''
  void loadQuotes()
}
function removeCustom(): void {
  customCode.value = ''
  void loadQuotes()
}

async function loadQuotes(): Promise<void> {
  const codes = activeCodes()
  if (!codes.length) return
  try {
    const qs = await fetchQuotes(codes, 'custom')
    const map: Record<string, Quote> = {}
    qs.forEach((q) => (map[q.code] = q))
    quotesMap.value = map
  } catch {
    /* ignore */
  }
}

async function run(): Promise<void> {
  if (!cfg.value) {
    result.value = '未检测到 AI 配置，请先到「AI 助手」配置密钥。'
    return
  }
  const qs = activeCodes()
    .map((c) => quotesMap.value[c])
    .filter(Boolean) as Quote[]
  if (!qs.length) {
    result.value = '暂无可分析的行情数据，请检查标的代码。'
    return
  }
  const ctx = qs
    .map((q) => `${q.name}(${q.code}) 现价:${formatNum(q.price)} 涨跌:${formatNum(q.change)}(${formatNum(q.changePercent)}%) 高:${formatNum(q.high)} 低:${formatNum(q.low)} 昨收:${formatNum(q.prevClose)}`)
    .join('\n')
  const prompt =
    '你是专业股票分析助手，面向普通投资者，语言通俗。\n' +
    `当前行情快照：\n${ctx}\n\n` +
    `用户问题：${question.value}\n\n` +
    '请输出结构化解读，包含：1) 趋势判断；2) 支撑位；3) 压力位；4) 风险等级（低/中/高）；5) 关键事件（2-3 条）；6) 一句话总结。' +
    '所有结论必须基于给定行情，注明数据仅供参考、不构成投资建议。'

  loading.value = true
  try {
    result.value = await callAi(cfg.value, prompt)
  } catch (e) {
    result.value = '分析失败：' + (e instanceof Error ? e.message : String(e))
  } finally {
    loading.value = false
  }
}

onMounted(async () => {
  cfg.value = await loadAiConfig()
  await loadQuotes()
})
</script>

<style scoped>
.ai-page {
  padding: 24px;
  max-width: 1000px;
  margin: 0 auto;
  color: var(--text);
}
.ai-head h2 {
  margin: 0 0 4px;
  font-size: 22px;
  color: var(--text-strong);
}
.ai-sub {
  margin: 0;
  font-size: 13px;
  color: var(--text-muted);
}
.ai-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 14px;
  padding: 18px;
  margin-top: 16px;
}
.ai-row {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  margin-bottom: 14px;
  flex-wrap: wrap;
}
.ai-label {
  font-size: 13px;
  color: var(--text-muted);
  width: 90px;
  flex-shrink: 0;
  padding-top: 6px;
}
.ai-chips {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}
.ai-chip {
  font-size: 12px;
  border: 1px solid var(--border);
  border-radius: 999px;
  padding: 4px 12px;
  color: var(--text-muted);
  cursor: pointer;
}
.ai-chip.on {
  border-color: var(--brand, #378ADD);
  color: var(--brand, #378ADD);
  background: var(--surface-soft);
}
.ai-snapshot {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  margin-bottom: 14px;
}
.ai-snap {
  display: flex;
  gap: 6px;
  align-items: baseline;
  background: var(--surface-soft);
  border-radius: 8px;
  padding: 6px 10px;
  font-size: 13px;
}
.ai-snap-name {
  color: var(--text-strong);
}
.up {
  color: #ef4444;
}
.down {
  color: #16a34a;
}
.flat {
  color: var(--text);
}
.ai-note {
  font-size: 12px;
  color: #ba7517;
  margin-left: 12px;
}
.ai-result {
  margin-top: 16px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 14px;
  padding: 18px;
}
.ai-result-title {
  font-size: 15px;
  font-weight: 600;
  margin-bottom: 10px;
  color: var(--text-strong);
}
.ai-result-body {
  font-size: 14px;
  line-height: 1.8;
  white-space: pre-wrap;
  color: var(--text);
}
.ai-result-foot {
  margin-top: 12px;
  font-size: 11px;
  color: var(--text-faint);
}
</style>
