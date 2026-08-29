// B4 学习数据导出：纯函数单测（CSV 转义 / 中文 BOM / 报告 HTML 转义）
import { describe, it, expect } from 'vitest'
import { csvCell, toCsv, buildReportHtml } from '../src/services/studyExportService'
import type { ExportDataset } from '../src/services/studyExportService'

const ds: ExportDataset = {
  moduleKey: 'degree',
  moduleName: '学位英语',
  headers: ['类别', '项目', '状态/结果', '数值', '日期'],
  rows: [
    ['单词进度', 'abandon', '已掌握', '复习等级 3', '2026-08-29'],
    ['练习记录', 'vocab', '8 / 10', '80%', '2026-08-28']
  ],
  summary: [
    { label: '已学单词', value: '120' },
    { label: '已掌握', value: '80' }
  ]
}

describe('csvCell 单元格转义', () => {
  it('普通文本不加引号', () => {
    expect(csvCell('abandon')).toBe('abandon')
    expect(csvCell('已掌握')).toBe('已掌握')
  })
  it('含逗号时用双引号包裹', () => {
    expect(csvCell('a,b')).toBe('"a,b"')
  })
  it('含双引号时引号翻倍并整体包裹', () => {
    expect(csvCell('say "hi"')).toBe('"say ""hi"""')
  })
  it('含换行时用双引号包裹', () => {
    expect(csvCell('line1\nline2')).toBe('"line1\nline2"')
  })
  it('空值与 null 安全处理', () => {
    expect(csvCell('')).toBe('')
    expect(csvCell(null)).toBe('')
    expect(csvCell(undefined)).toBe('')
  })
  it('数字正常转为字符串', () => {
    expect(csvCell(0)).toBe('0')
    expect(csvCell(42)).toBe('42')
  })
})

describe('toCsv 生成', () => {
  it('必须带 UTF-8 BOM，否则 Excel 打开中文会乱码', () => {
    const csv = toCsv(['a'], [['中文']])
    expect(csv.charCodeAt(0)).toBe(0xfeff)
  })
  it('表头在第一行，数据行随后', () => {
    const csv = toCsv(['类别', '项目'], [['单词', 'abandon']])
    const lines = csv.replace(/^﻿/, '').split('\r\n')
    expect(lines[0]).toBe('类别,项目')
    expect(lines[1]).toBe('单词,abandon')
  })
  it('行内逗号正确转义，不会串列', () => {
    const csv = toCsv(['a', 'b'], [['x,y', 'z']])
    const lines = csv.replace(/^﻿/, '').split('\r\n')
    expect(lines[1]).toBe('"x,y",z')
  })
  it('空数据只有表头', () => {
    const csv = toCsv(['a', 'b'], [])
    const lines = csv.replace(/^﻿/, '').split('\r\n')
    expect(lines).toHaveLength(1)
  })
})

describe('buildReportHtml 报告生成', () => {
  const html = buildReportHtml(ds)

  it('包含模块名与汇总指标', () => {
    expect(html).toContain('学位英语')
    expect(html).toContain('已学单词')
    expect(html).toContain('120')
  })
  it('包含表头与明细行', () => {
    expect(html).toContain('状态/结果')
    expect(html).toContain('abandon')
  })
  it('HTML 特殊字符被转义，避免内容破坏结构', () => {
    const evil: ExportDataset = {
      ...ds,
      moduleName: '<script>alert(1)</script>',
      rows: [['<img src=x onerror=alert(1)>', 'b', 'c', 'd', 'e']]
    }
    const h = buildReportHtml(evil)
    expect(h).not.toContain('<script>alert(1)</script>')
    expect(h).not.toContain('<img src=x onerror=alert(1)>')
    expect(h).toContain('&lt;script&gt;')
  })
  it('超长明细只打印前 500 条并给出提示', () => {
    const big: ExportDataset = {
      ...ds,
      rows: Array.from({ length: 600 }, (_, i) => [`w${i}`, 'x', 'y', 'z', 'd'])
    }
    const h = buildReportHtml(big)
    expect(h).toContain('w0')
    expect(h).not.toContain('>w599<')
    expect(h).toContain('完整数据请导出 CSV')
  })
})
