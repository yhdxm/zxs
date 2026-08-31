<template>
  <div class="ln-page">
    <div class="ln-head">
      <h2>学习中心</h2>
      <p class="ln-sub">从初步到高级 · 小白也能看懂 · 学完自动归档</p>
    </div>

    <div class="ln-progress">
      <div class="ln-prog-top">
        <span>学习进度</span>
        <span>已掌握 {{ mastered.length }} / {{ lessons.length }}</span>
      </div>
      <div class="ln-bar"><i :style="{ width: pct + '%' }"></i></div>
      <div class="ln-prog-sub">
        <span>初步 {{ countLevel('初步') }}</span>
        <span>中级 {{ countLevel('中级') }}</span>
        <span>高级 {{ countLevel('高级') }}</span>
      </div>
    </div>

    <div class="ln-search">
      <el-input v-model="query" placeholder="搜索知识点或输入疑问，如：什么是市盈率？怎么看成交量？" />
    </div>

    <template v-for="lv in levels" :key="lv">
      <div class="ln-sec" v-if="filteredLessons(lv).length">
        <div class="ln-sec-title">
          <span class="ln-dot" :style="{ background: lvColor(lv) }"></span>
          {{ lv }} · {{ lvLabel(lv) }}
        </div>
        <div class="ln-list">
          <div
            v-for="l in filteredLessons(lv)"
            :key="l.id"
            :class="['ln-item', isLocked(l) ? 'locked' : '']"
          >
            <div class="ln-item-head" @click="toggleOpen(l)">
              <div>
                <span class="ln-title">{{ l.title }}</span>
                <span class="ln-min">{{ l.minutes }} 分钟 · {{ l.mode }}</span>
              </div>
              <span v-if="isLocked(l)" class="ln-lock">需先完成中级</span>
              <span v-else-if="mastered.includes(l.id)" class="ln-done">已掌握</span>
              <span v-else class="ln-start">学习中</span>
            </div>
            <div v-if="openId === l.id && !isLocked(l)" class="ln-content">
              <p>{{ l.content }}</p>
              <button class="ln-master" @click="markMastered(l.id)">标记为已掌握</button>
            </div>
          </div>
        </div>
      </div>
    </template>

    <div class="ln-mastered" v-if="masteredLessons.length">
      <div class="ln-sec-title">
        <span class="ln-dot" style="background:#0F6E56"></span>
        已掌握（{{ masteredLessons.length }}）
      </div>
      <div class="ln-mlist">
        <span v-for="l in masteredLessons" :key="l.id" class="ln-mtag" @click="openId = l.id">
          {{ l.title }} ✓
        </span>
      </div>
    </div>

    <div class="ln-sim" @click="$emit('open-sim')">
      <div>
        <div class="ln-sim-t">模拟炒股</div>
        <div class="ln-sim-s">用虚拟资金练手，零风险</div>
      </div>
      <span class="ln-sim-go">进入 →</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref, computed, watch } from 'vue'
import { useCloudSync } from '../../composables/useCloudSync'
import { loadUserBlob, saveUserBlob, type BlobKey } from '../../services/userBlobService'

defineEmits<{ (e: 'open-sim'): void }>()

interface Lesson {
  id: string
  title: string
  level: '初步' | '中级' | '高级'
  minutes: number
  mode: string
  content: string
}

const lessons: Lesson[] = [
  { id: 'l1', title: '股票是什么', level: '初步', minutes: 3, mode: '图文', content: '股票是公司所有权的一小片凭证。买一股就成了公司的微小股东，公司赚钱分红、股价上涨你都受益；反过来也要承担下跌风险。' },
  { id: 'l2', title: '基金与股票区别', level: '初步', minutes: 3, mode: '图文', content: '基金是把很多人的钱交给专业经理去买一篮子资产，分散风险；股票是单买一家公司，波动更大、需要自己研究。' },
  { id: 'l3', title: '红涨绿跌怎么看', level: '初步', minutes: 2, mode: '图文', content: 'A 股习惯：红色代表上涨、绿色代表下跌（与欧美相反）。K 线实体红=收盘价高于开盘，绿=低于开盘。' },
  { id: 'l4', title: '怎么开户与交易', level: '初步', minutes: 5, mode: '图文', content: '通过券商 APP 实名开户，绑定银行卡入金后即可买卖。交易时间一般为工作日 9:30-11:30、13:00-15:00。' },
  { id: 'l5', title: 'K 线基础', level: '中级', minutes: 4, mode: '图解', content: '一根 K 线记录一段时间内的开盘、收盘、最高、最低价。实体是开收盘区间，上下影线代表期间极值。' },
  { id: 'l6', title: '均线与成交量', level: '中级', minutes: 5, mode: '图解', content: '均线（MA）是若干日收盘价的平均连线，用于判断趋势；成交量反映资金活跃度，价涨量增通常更健康。' },
  { id: 'l7', title: '财报三张表', level: '中级', minutes: 6, mode: '图文', content: '利润表看赚不赚钱，资产负债表看家底厚薄，现金流量表看钱是否真到账。三者互相印证才靠谱。' },
  { id: 'l8', title: '市盈率 PE 怎么用', level: '中级', minutes: 4, mode: '图文', content: 'PE = 股价 / 每股收益，代表收回投资所需年数。低 PE 不一定便宜，要结合行业和增长速度看。' },
  { id: 'l9', title: '资产配置入门', level: '高级', minutes: 8, mode: '图文', content: '把资金分散到股票、债券、现金等不相关资产，降低单一风险。经典如"100-年龄"法分配权益仓位。' },
  { id: 'l10', title: '期权基础', level: '高级', minutes: 10, mode: '图文', content: '期权是未来以约定价格买卖标的的权利（非义务）。看涨期权在上涨时获利，看跌期权在对冲下跌风险时有用。' }
]

const BLOB_KEY: BlobKey = 'learn_mastery'
const mastered = ref<string[]>([])
const openId = ref('')
const query = ref('')

const levels = ['初步', '中级', '高级'] as const

function lvLabel(lv: string): string {
  return lv === '初步' ? '小白入门' : lv === '中级' ? '看懂行情' : '策略与配置'
}
function lvColor(lv: string): string {
  return lv === '初步' ? '#0F6E56' : lv === '中级' ? '#BA7517' : '#993C1D'
}

const pct = computed(() => Math.round((mastered.value.length / lessons.length) * 100))
function countLevel(lv: string): string {
  const total = lessons.filter((l) => l.level === lv).length
  const done = lessons.filter((l) => l.level === lv && mastered.value.includes(l.id)).length
  return `${done}/${total}`
}
function isLocked(l: Lesson): boolean {
  if (l.level !== '高级') return false
  const midTotal = lessons.filter((x) => x.level === '中级').length
  const midDone = lessons.filter((x) => x.level === '中级' && mastered.value.includes(x.id)).length
  return midDone < Math.ceil(midTotal / 2)
}
function filteredLessons(lv: string): Lesson[] {
  const q = query.value.trim()
  return lessons.filter((l) => l.level === lv && (!q || l.title.includes(q) || l.content.includes(q)))
}
const masteredLessons = computed(() => lessons.filter((l) => mastered.value.includes(l.id)))

function toggleOpen(l: Lesson): void {
  if (isLocked(l)) return
  openId.value = openId.value === l.id ? '' : l.id
}
function markMastered(id: string): void {
  if (!mastered.value.includes(id)) mastered.value.push(id)
  openId.value = ''
}
async function save(): Promise<void> {
  await saveUserBlob(BLOB_KEY, mastered.value)
}
async function loadMastered(): Promise<void> {
  mastered.value = await loadUserBlob(BLOB_KEY, [])
}

useCloudSync({
  tables: ['user_json_blobs'],
  reload: loadMastered,
  immediate: false
})

onMounted(async () => {
  await loadMastered()
})

watch(
  mastered,
  () => {
    void save()
  },
  { deep: true }
)
</script>

<style scoped>
.ln-page {
  padding: 24px;
  max-width: 900px;
  margin: 0 auto;
  color: var(--text);
}
.ln-head h2 {
  margin: 0 0 4px;
  font-size: 22px;
  color: var(--text-strong);
}
.ln-sub {
  margin: 0;
  font-size: 13px;
  color: var(--text-muted);
}
.ln-progress {
  background: var(--surface-soft);
  border-radius: 12px;
  padding: 14px 16px;
  margin: 16px 0;
}
.ln-prog-top {
  display: flex;
  justify-content: space-between;
  font-size: 13px;
  margin-bottom: 8px;
}
.ln-bar {
  height: 6px;
  border-radius: 3px;
  background: var(--border);
  overflow: hidden;
}
.ln-bar > i {
  display: block;
  height: 100%;
  background: #534ab7;
}
.ln-prog-sub {
  display: flex;
  gap: 14px;
  margin-top: 8px;
  font-size: 12px;
  color: var(--text-muted);
}
.ln-search {
  margin-bottom: 16px;
}
.ln-sec {
  margin-bottom: 14px;
}
.ln-sec-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  font-weight: 600;
  color: var(--text-strong);
  margin-bottom: 8px;
}
.ln-dot {
  width: 4px;
  height: 14px;
  border-radius: 2px;
}
.ln-list {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px;
}
@media (max-width: 640px) {
  .ln-list {
    grid-template-columns: 1fr;
  }
}
.ln-item {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 12px 14px;
}
.ln-item.locked {
  opacity: 0.6;
}
.ln-item-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
  cursor: pointer;
}
.ln-title {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-strong);
}
.ln-min {
  font-size: 11px;
  color: var(--text-faint);
  margin-left: 8px;
}
.ln-start {
  font-size: 11px;
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 2px 8px;
  color: var(--text-muted);
}
.ln-done {
  font-size: 11px;
  color: #0f6e56;
  border: 1px solid #0f6e56;
  border-radius: 6px;
  padding: 2px 8px;
}
.ln-lock {
  font-size: 11px;
  color: var(--text-faint);
}
.ln-content {
  margin-top: 10px;
}
.ln-content p {
  font-size: 13px;
  line-height: 1.7;
  color: var(--text-muted);
  margin: 0 0 10px;
}
.ln-master {
  font-size: 12px;
  border: 1px solid var(--brand, #378add);
  color: var(--brand, #378add);
  background: transparent;
  border-radius: 8px;
  padding: 5px 12px;
  cursor: pointer;
}
.ln-mastered {
  margin-top: 6px;
}
.ln-mlist {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.ln-mtag {
  font-size: 12px;
  color: #0f6e56;
  border: 1px solid #0f6e56;
  border-radius: 999px;
  padding: 3px 10px;
  cursor: pointer;
}
.ln-sim {
  margin-top: 18px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: var(--surface-soft);
  border: 1px solid var(--brand, #378add);
  border-radius: 12px;
  padding: 14px 16px;
  cursor: pointer;
}
.ln-sim-t {
  font-size: 14px;
  font-weight: 600;
  color: var(--brand, #378add);
}
.ln-sim-s {
  font-size: 12px;
  color: var(--brand, #378add);
  margin-top: 2px;
  opacity: 0.8;
}
.ln-sim-go {
  font-size: 13px;
  color: var(--brand, #378add);
}
</style>
