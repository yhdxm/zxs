// B4 学习数据导出（纯前端、免费）
// 严守「三模块独立性铁律」：学位英语 / 四六级 / 通用学习 各自独立采集、独立统计，
// 不做跨模块合并口径；导出时按模块分别成表，用户自行选择要导哪一个。
// 导出格式：CSV（Excel 可直接打开，带 UTF-8 BOM 防中文乱码）+ 打印成 PDF（调用系统打印，零依赖）

import * as degreeSvc from '../prep/degreeService'
import { loadAll as loadCetAll } from './cetPrepService'
import { loadLearnWordProgress } from './learnWordProgressService'

export type ExportModuleKey = 'degree' | 'cet' | 'general'

export interface ExportDataset {
  moduleKey: ExportModuleKey
  moduleName: string
  /** 表头 */
  headers: string[]
  /** 明细行（长度与 headers 一致） */
  rows: string[][]
  /** 汇总指标（展示在报告顶部） */
  summary: Array<{ label: string; value: string }>
}

/** 宽松的进度结构：三个模块的 WordProgress 字段不完全一致，统一按需读取 */
interface LooseProgress {
  status?: string
  level?: number
  due?: string | null
  weak?: boolean
  wrongStreak?: number
  firstLearned?: string
  lastStudied?: string
}

const STATUS_TEXT: Record<string, string> = {
  new: '未学',
  learning: '学习中',
  graduated: '已掌握'
}

function pct(correct: number, total: number): string {
  if (!total) return '—'
  return `${Math.round((correct / total) * 100)}%`
}

function safeText(v: unknown): string {
  return v === null || v === undefined ? '' : String(v)
}

/* ==================== 采集：学位英语 ==================== */

export async function collectDegree(): Promise<ExportDataset> {
  const [prog, practice, mistakes, exams] = await Promise.all([
    degreeSvc.loadWordProgress().catch(() => ({}) as Record<string, LooseProgress>),
    degreeSvc.loadPractice().catch(() => []),
    degreeSvc.loadMistakes().catch(() => []),
    degreeSvc.loadExamRecords().catch(() => [])
  ])

  const words = Object.entries(prog || {})
  const graduated = words.filter(([, p]) => p?.status === 'graduated').length
  const learning = words.filter(([, p]) => p?.status === 'learning').length
  const weak = words.filter(([, p]) => p?.weak).length
  const activeMistakes = (mistakes || []).filter((m: any) => !m?.removed).length

  const headers = ['类别', '项目', '状态/结果', '数值', '日期']
  const rows: string[][] = []

  for (const [w, p] of words) {
    rows.push([
      '单词进度',
      w,
      STATUS_TEXT[p?.status || ''] || safeText(p?.status),
      `复习等级 ${safeText(p?.level ?? 0)}`,
      safeText(p?.lastStudied || p?.firstLearned || '')
    ])
  }
  for (const r of practice || []) {
    rows.push([
      '练习记录',
      safeText((r as any)?.type),
      `${safeText((r as any)?.correct)} / ${safeText((r as any)?.total)}`,
      pct(Number((r as any)?.correct || 0), Number((r as any)?.total || 0)),
      safeText((r as any)?.date)
    ])
  }
  for (const m of mistakes || []) {
    if ((m as any)?.removed) continue
    rows.push([
      '错题',
      safeText((m as any)?.type),
      safeText((m as any)?.reason || '未标注'),
      safeText((m as any)?.questionId || ''),
      safeText((m as any)?.createdAt || '')
    ])
  }
  for (const e of exams || []) {
    rows.push([
      '模拟考试',
      safeText((e as any)?.paperId || '综合卷'),
      `${safeText((e as any)?.correct)} / ${safeText((e as any)?.total)}`,
      pct(Number((e as any)?.correct || 0), Number((e as any)?.total || 0)),
      safeText((e as any)?.createdAt || '')
    ])
  }

  return {
    moduleKey: 'degree',
    moduleName: '学位英语',
    headers,
    rows,
    summary: [
      { label: '已学单词', value: `${words.length}` },
      { label: '已掌握', value: `${graduated}` },
      { label: '学习中', value: `${learning}` },
      { label: '薄弱词', value: `${weak}` },
      { label: '待复习错题', value: `${activeMistakes}` },
      { label: '模考次数', value: `${(exams || []).length}` }
    ]
  }
}

/* ==================== 采集：四六级 ==================== */

export async function collectCet(): Promise<ExportDataset> {
  const state = await loadCetAll().catch(() => null)
  const words = Object.entries((state as any)?.words || {})
  const practice: any[] = (state as any)?.practice || []
  const mistakes: any[] = (state as any)?.mistakes || []
  const checkins = Object.keys((state as any)?.checkins || {})

  const graduated = words.filter(([, p]) => (p as any)?.status === 'graduated').length
  const learning = words.filter(([, p]) => (p as any)?.status === 'learning').length
  const weak = words.filter(([, p]) => (p as any)?.weak).length

  const headers = ['类别', '项目', '状态/结果', '数值', '日期']
  const rows: string[][] = []

  for (const [w, p] of words) {
    rows.push([
      '单词进度',
      w,
      STATUS_TEXT[(p as any)?.status || ''] || safeText((p as any)?.status),
      `复习等级 ${safeText((p as any)?.level ?? 0)}`,
      safeText((p as any)?.lastStudied || (p as any)?.firstLearned || '')
    ])
  }
  for (const r of practice) {
    rows.push([
      '练习记录',
      safeText(r?.type),
      `${safeText(r?.correct)} / ${safeText(r?.total)}`,
      pct(Number(r?.correct || 0), Number(r?.total || 0)),
      safeText(r?.date)
    ])
  }
  for (const m of mistakes) {
    if (m?.removed) continue
    rows.push([
      '错题',
      safeText(m?.type),
      safeText(m?.reason || '未标注'),
      safeText(m?.questionId || ''),
      safeText(m?.createdAt || '')
    ])
  }
  for (const d of checkins) {
    rows.push(['打卡', d, '已签到', '1', d])
  }

  return {
    moduleKey: 'cet',
    moduleName: '四六级',
    headers,
    rows,
    summary: [
      { label: '已学单词', value: `${words.length}` },
      { label: '已掌握', value: `${graduated}` },
      { label: '学习中', value: `${learning}` },
      { label: '薄弱词', value: `${weak}` },
      { label: '练习次数', value: `${practice.length}` },
      { label: '打卡天数', value: `${checkins.length}` }
    ]
  }
}

/* ==================== 采集：通用学习 ==================== */

export async function collectGeneral(): Promise<ExportDataset> {
  const prog = await loadLearnWordProgress().catch(() => ({}) as Record<string, LooseProgress>)
  const words = Object.entries(prog || {})
  const graduated = words.filter(([, p]) => p?.status === 'graduated').length
  const learning = words.filter(([, p]) => p?.status === 'learning').length

  const headers = ['类别', '项目', '状态/结果', '数值', '日期']
  const rows = words.map(([w, p]) => [
    '单词进度',
    w,
    STATUS_TEXT[p?.status || ''] || safeText(p?.status),
    `复习等级 ${safeText(p?.level ?? 0)}`,
    safeText(p?.lastStudied || p?.firstLearned || '')
  ])

  return {
    moduleKey: 'general',
    moduleName: '通用学习',
    headers,
    rows,
    summary: [
      { label: '已学单词', value: `${words.length}` },
      { label: '已掌握', value: `${graduated}` },
      { label: '学习中', value: `${learning}` }
    ]
  }
}

export async function collectModule(key: ExportModuleKey): Promise<ExportDataset> {
  if (key === 'cet') return collectCet()
  if (key === 'general') return collectGeneral()
  return collectDegree()
}

/* ==================== CSV 生成与下载 ==================== */

/** CSV 单元格转义：含逗号/引号/换行时用双引号包裹，内部引号翻倍 */
export function csvCell(v: unknown): string {
  const s = String(v ?? '')
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/**
 * 生成 CSV 字符串。
 * 前置 ﻿（UTF-8 BOM）：没有它 Excel 打开中文会乱码，这是最容易被忽略的一步。
 */
export function toCsv(headers: string[], rows: string[][]): string {
  const lines = [headers, ...rows].map((r) => r.map(csvCell).join(','))
  return `﻿${lines.join('\r\n')}`
}

export function downloadText(filename: string, content: string, mime = 'text/csv;charset=utf-8'): void {
  try {
    const blob = new Blob([content], { type: mime })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.type = 'button'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    window.setTimeout(() => URL.revokeObjectURL(url), 2000)
  } catch (e) {
    console.warn('[studyExport] 下载失败', e)
  }
}

export function exportDatasetToCsv(ds: ExportDataset): void {
  const today = new Date().toISOString().slice(0, 10)
  downloadText(`${ds.moduleName}_学习数据_${today}.csv`, toCsv(ds.headers, ds.rows))
}

/* ==================== 打印成 PDF（零依赖，调用系统打印） ==================== */

function esc(s: unknown): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

/** 生成可打印的报告 HTML（自带打印样式，可直接交给浏览器打印/另存为 PDF） */
export function buildReportHtml(ds: ExportDataset): string {
  const today = new Date().toISOString().slice(0, 10)
  const summaryHtml = ds.summary
    .map(
      (s) =>
        `<div class="stat"><div class="stat-v">${esc(s.value)}</div><div class="stat-l">${esc(s.label)}</div></div>`
    )
    .join('')
  const rowsHtml = ds.rows
    .slice(0, 500) // 打印页不宜过长，超出部分提示用 CSV
    .map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join('')}</tr>`)
    .join('')
  const headHtml = ds.headers.map((h) => `<th>${esc(h)}</th>`).join('')
  const truncated = ds.rows.length > 500

  return `<!DOCTYPE html>
<html lang="zh-CN"><head><meta charset="utf-8">
<title>${esc(ds.moduleName)} 学习报告 ${today}</title>
<style>
  body{font-family:-apple-system,"PingFang SC","Microsoft YaHei",sans-serif;color:#1f2937;margin:0;padding:24px}
  h1{font-size:20px;margin:0 0 4px}
  .meta{font-size:12px;color:#6b7280;margin-bottom:18px}
  .stats{display:flex;flex-wrap:wrap;gap:12px;margin-bottom:22px}
  .stat{border:1px solid #e2e8f0;border-radius:10px;padding:10px 16px;min-width:92px;text-align:center}
  .stat-v{font-size:20px;font-weight:800;color:#5b6cff}
  .stat-l{font-size:11.5px;color:#6b7280;margin-top:2px}
  table{width:100%;border-collapse:collapse;font-size:12px}
  th,td{border:1px solid #e2e8f0;padding:6px 8px;text-align:left}
  th{background:#f1f5f9;font-weight:700}
  tr:nth-child(even) td{background:#fafbfc}
  .tip{font-size:11.5px;color:#94a3b8;margin-top:10px}
  @media print{body{padding:0}.stat-v{color:#000}}
</style></head>
<body>
  <h1>${esc(ds.moduleName)} · 学习报告</h1>
  <div class="meta">导出日期：${today}　共 ${ds.rows.length} 条记录</div>
  <div class="stats">${summaryHtml}</div>
  <table><thead><tr>${headHtml}</tr></thead><tbody>${rowsHtml}</tbody></table>
  ${truncated ? `<div class="tip">明细仅打印前 500 条，完整数据请导出 CSV。</div>` : ''}
</body></html>`
}

/** 打开新窗口并调起打印（用户可在打印对话框里选「另存为 PDF」） */
export function printReport(ds: ExportDataset): boolean {
  const w = window.open('', '_blank', 'noopener')
  if (!w) return false
  w.document.write(buildReportHtml(ds))
  w.document.close()
  w.focus()
  window.setTimeout(() => {
    try {
      w.print()
    } catch {
      /* noop */
    }
  }, 400)
  return true
}
