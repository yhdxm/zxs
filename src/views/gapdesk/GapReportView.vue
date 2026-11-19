<!--
  48 小时快报
  ---------------------------------------------------------------
  口径铁律：全页只讲「48 小时」。库里的事件最多留 48h，
  任何周维度 / 多日累计的表述都会变成假数据 —— 所以一个字都不出现。
  结论区直接取 gap 最高的 3 条标题，**不做任何改写**（改写就会引入编造）。
-->
<template>
  <div class="grp">
    <!-- 配置区（打印时隐藏） -->
    <section class="grp-cfg no-print">
      <div class="grp-cfg-row">
        <span class="grp-lb">范围</span>
        <el-select
          :model-value="scope"
          size="small"
          class="grp-scope"
          @update:model-value="setScope"
        >
          <el-option value="all" label="全部行业" />
          <el-option value="pick" label="选中行业" />
        </el-select>
        <el-select
          v-if="scope === 'pick'"
          :model-value="pickInds"
          size="small"
          multiple
          collapse-tags
          placeholder="选择行业"
          class="grp-inds"
          @update:model-value="(v: unknown) => (pickInds = asArr<GapInd>(v))"
        >
          <el-option v-for="i in GAP_IND" :key="i.key" :value="i.key" :label="i.label" />
        </el-select>

        <span class="grp-lb">模板</span>
        <el-radio-group :model-value="tpl" size="small" @update:model-value="(v: unknown) => (tpl = v === 'brief' ? 'brief' : 'standard')">
          <el-radio-button value="standard">标准</el-radio-button>
          <el-radio-button value="brief">精简</el-radio-button>
        </el-radio-group>

        <span class="grp-actions">
          <el-button size="small" type="primary" plain @click="print">打印 / 另存 PDF</el-button>
          <el-button size="small" @click="copyMarkdown">复制 Markdown</el-button>
        </span>
      </div>

      <p v-if="!reportEvents.length" class="grp-empty-tip">
        48h 内信号稀薄（{{ reportEvents.length }} 条）：仍可导出，但结论区会缺少足够样本。
      </p>
      <p v-else-if="reportEvents.length < 4" class="grp-thin-tip">
        48h 内信号稀薄（仅 {{ reportEvents.length }} 条），已按现有样本出稿，请谨慎引用。
      </p>
    </section>

    <p class="grp-mobile-tip no-print">移动端建议使用 PC 端导出（打印排版按 A4 宽度设计）。</p>

    <!-- A4 纸面 -->
    <section class="grp-paper">
      <header class="grp-head">
        <h1 class="grp-title">差值台 · 48 小时快报</h1>
        <p class="grp-sub">
          {{ rangeText }} · 样本 {{ reportEvents.length }} 条 · 池内 {{ stats.count }} 条
        </p>
        <p v-if="meta" class="grp-funnel">
          采集漏斗：{{ meta.funnel.raw }} 原始 → {{ meta.funnel.exact }} 精确 → {{ meta.funnel.event }} 事件 →
          {{ meta.funnel.shown }} 达阈值
        </p>
      </header>

      <!-- 三条结论：只取标题，不改写 -->
      <section class="grp-sec">
        <h2 class="grp-h2">三条结论</h2>
        <GapEmptyState v-if="!conclusions.length" type="empty" title="样本不足，暂不生成结论" desc="至少需要 1 条达标事件" />
        <ol v-else class="grp-conc">
          <li v-for="c in conclusions" :key="c.id">
            <span class="grp-conc-gap">{{ c.gap }}</span>
            <span class="grp-conc-title">{{ c.title }}</span>
          </li>
        </ol>
      </section>

      <!-- 按行业分组的事件表 -->
      <section class="grp-sec">
        <h2 class="grp-h2">按行业</h2>
        <GapEmptyState v-if="!groups.length" type="empty" title="当前范围没有达标事件" desc="可切换为「全部行业」或降低筛选强度后重试" />
        <div v-for="g in groups" :key="g.ind" class="grp-group">
          <h3 class="grp-h3">
            <i class="grp-dot" :style="{ background: g.color }" />
            {{ g.label }}
            <span class="grp-h3-n">{{ g.rows.length }} 条</span>
          </h3>
          <table class="grp-table">
            <thead>
              <tr>
                <th scope="col">事件</th>
                <th scope="col">差值</th>
                <th scope="col">来源</th>
                <th scope="col">原文</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="e in g.rows" :key="e.id">
                <td class="grp-td-title">{{ e.title }}</td>
                <td class="grp-td-num">{{ e.gap }}</td>
                <td class="grp-td-num">{{ e.src_count }} 路</td>
                <td class="grp-td-link">
                  <a v-if="e.url" :href="e.url" target="_blank" rel="noopener">链接</a>
                  <span v-else>—</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <footer class="grp-foot">
        数据窗口 48h · 生成于 {{ generatedAt }} · 本页为辅助决策工具，不构成投资建议
      </footer>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { ElMessage } from 'element-plus'
import GapEmptyState from '../../components/gapdesk/GapEmptyState.vue'
import { GAP_IND } from '../../config/gapdeskConfig'
import { useGapDesk } from '../../composables/useGapDesk'
import { fmtClock } from '../../utils/gapdeskFormat'
import type { GapEventRow, GapInd } from '../../types/gapdesk'

const { pool, stats, meta } = useGapDesk()

const scope = ref<'all' | 'pick'>('all')
const pickInds = ref<GapInd[]>([])
const tpl = ref<'standard' | 'brief'>('standard')

function asArr<T extends string>(v: unknown): T[] {
  return Array.isArray(v) ? (v.filter((x) => typeof x === 'string') as T[]) : []
}

/** 范围选择：el-select 的 model-value 是 unknown，收敛成字面量联合 */
function setScope(v: unknown): void {
  scope.value = v === 'pick' ? 'pick' : 'all'
}

/* ---------- 取样 ---------- */
const reportEvents = computed<GapEventRow[]>(() => {
  const base = scope.value === 'pick' && pickInds.value.length
    ? pool.value.filter((e) => pickInds.value.includes(e.ind))
    : pool.value
  return [...base].sort((a, b) => b.gap - a.gap)
})

/** 每条行业取前 N（标准 3 / 精简 2） */
const groups = computed(() => {
  const perInd = tpl.value === 'brief' ? 2 : 3
  return GAP_IND.map((ind) => {
    const rows = reportEvents.value.filter((e) => e.ind === ind.key).slice(0, perInd)
    return { ind: ind.key, label: ind.label, color: ind.color, rows }
  }).filter((g) => g.rows.length > 0)
})

/** 结论 = gap 最高的 3 条标题，原样引用 */
const conclusions = computed(() =>
  reportEvents.value.slice(0, 3).map((e) => ({ id: e.id, gap: e.gap, title: e.title }))
)

/* ---------- 文案 ---------- */
const NOW = Date.now()
const rangeText = computed(() => {
  const from = fmtClock(NOW - 48 * 3600 * 1000)
  const to = fmtClock(NOW)
  return `${from} ~ ${to}`
})
const generatedAt = fmtClock(Date.now())

/* ---------- 导出 ---------- */
function print(): void {
  if (typeof window === 'undefined') return
  window.print()
}

/** Markdown 导出：结构与纸面一致，链接保留原文地址，方便贴到 IM 里复核 */
function buildMarkdown(): string {
  const lines: string[] = []
  lines.push(`# 差值台 · 48 小时快报`)
  lines.push('')
  lines.push(`> ${rangeText.value} · 样本 ${reportEvents.value.length} 条 · 池内 ${stats.value.count} 条`)
  if (meta.value) {
    const f = meta.value.funnel
    lines.push(`> 采集漏斗：${f.raw} 原始 → ${f.exact} 精确 → ${f.event} 事件 → ${f.shown} 达阈值`)
  }
  lines.push('')
  lines.push('## 三条结论')
  lines.push('')
  conclusions.value.forEach((c, i) => lines.push(`${i + 1}. **${c.gap}** ${c.title}`))
  lines.push('')
  lines.push('## 按行业')
  for (const g of groups.value) {
    lines.push('')
    lines.push(`### ${g.label}（${g.rows.length} 条）`)
    for (const e of g.rows) {
      lines.push(`- **${e.gap}** ${e.title}（${e.src_count} 路）${e.url ? ` ${e.url}` : ''}`)
    }
  }
  lines.push('')
  lines.push(`---`)
  lines.push(`数据窗口 48h · 生成于 ${generatedAt} · 辅助决策工具，不构成投资建议`)
  return lines.join('\n')
}

async function copyMarkdown(): Promise<void> {
  const md = buildMarkdown()
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(md)
      ElMessage.success('Markdown 已复制')
      return
    }
    throw new Error('clipboard 不可用')
  } catch {
    // 剪贴板在非 https / 无权限时会失败：给可复制的退路，不静默吞掉
    ElMessage.warning('浏览器不允许写剪贴板，请用「打印 / 另存 PDF」或手动复制预览内容')
  }
}
</script>

<style scoped>
.grp {
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-width: 0;
}
.grp-cfg {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 10px 12px;
  background: var(--surface, #fff);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 10px;
}
.grp-cfg-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}
.grp-lb {
  font-size: 11px;
  color: var(--text-muted, #909399);
}
.grp-scope {
  width: 118px;
}
.grp-inds {
  width: 220px;
}
.grp-actions {
  margin-left: auto;
  display: inline-flex;
  gap: 8px;
}
.grp-actions :deep(.el-button) {
  min-height: 44px;
}
.grp-empty-tip,
.grp-thin-tip {
  margin: 0;
  padding: 6px 10px;
  border-radius: 6px;
  font-size: 11px;
  line-height: 1.6;
}
.grp-empty-tip {
  background: rgba(255, 51, 88, 0.08);
  color: #ff3358;
}
.grp-thin-tip {
  background: rgba(217, 119, 6, 0.1);
  color: #b45309;
}
.grp-mobile-tip {
  display: none;
  margin: 0;
  padding: 6px 10px;
  border-radius: 6px;
  background: rgba(217, 119, 6, 0.1);
  color: #b45309;
  font-size: 11px;
}

/* ---------- A4 纸面 ---------- */
.grp-paper {
  max-width: 794px;
  margin: 0 auto;
  width: 100%;
  padding: 28px 32px 24px;
  background: #fff;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 4px;
  color: #1f2329;
}
.grp-head {
  border-bottom: 2px solid #1f2329;
  padding-bottom: 10px;
  margin-bottom: 14px;
}
.grp-title {
  margin: 0;
  font-size: 20px;
  font-weight: 800;
  letter-spacing: 0.02em;
}
.grp-sub,
.grp-funnel {
  margin: 4px 0 0;
  font-size: 11px;
  color: #646a73;
  font-variant-numeric: tabular-nums;
}
.grp-sec {
  margin-bottom: 16px;
}
.grp-h2 {
  margin: 0 0 8px;
  font-size: 14px;
  font-weight: 700;
}
.grp-conc {
  margin: 0;
  padding-left: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.grp-conc li {
  display: flex;
  align-items: baseline;
  gap: 8px;
  font-size: 12px;
  line-height: 1.6;
}
.grp-conc-gap {
  flex: none;
  font-weight: 800;
  color: #ff3358;
  font-variant-numeric: tabular-nums;
}
.grp-conc-title {
  color: #1f2329;
}
.grp-group {
  margin-top: 12px;
}
.grp-h3 {
  display: flex;
  align-items: center;
  gap: 5px;
  margin: 0 0 5px;
  font-size: 12px;
  font-weight: 600;
}
.grp-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
}
.grp-h3-n {
  font-size: 10px;
  font-weight: 400;
  color: #8f959e;
}
.grp-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 11px;
}
.grp-table th,
.grp-table td {
  padding: 5px 6px;
  border-bottom: 1px solid #e5e6eb;
  text-align: left;
  vertical-align: top;
}
.grp-table thead th {
  font-size: 10px;
  color: #8f959e;
  font-weight: 600;
}
.grp-td-title {
  line-height: 1.5;
}
.grp-td-num {
  width: 52px;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
.grp-td-link {
  width: 44px;
  text-align: center;
}
.grp-td-link a {
  color: #2f6fed;
  text-decoration: none;
}
.grp-foot {
  margin-top: 18px;
  padding-top: 8px;
  border-top: 1px solid #e5e6eb;
  font-size: 10px;
  color: #8f959e;
  text-align: center;
}

@media (max-width: 768px) {
  .grp-mobile-tip {
    display: block;
  }
  .grp-paper {
    padding: 16px 14px;
  }
  .grp-cfg-row {
    gap: 6px;
  }
  .grp-scope,
  .grp-inds {
    width: 100%;
  }
  .grp-actions {
    margin-left: 0;
    width: 100%;
  }
}
</style>

<!-- 打印样式无法用 scoped 命中外部导航，故用 visibility 隐身法：
     除纸面外全部 visibility:hidden，纸面绝对定位到左上角，DOM 结构无关。 -->
<style>
@media print {
  body * {
    visibility: hidden !important;
  }
  .grp-paper,
  .grp-paper * {
    visibility: visible !important;
  }
  .grp-paper {
    position: absolute;
    left: 0;
    top: 0;
    width: 100% !important;
    max-width: none !important;
    border: none !important;
    box-shadow: none !important;
    padding: 0 !important;
  }
  .no-print {
    display: none !important;
  }
  @page {
    size: A4;
    margin: 14mm;
  }
}
</style>
