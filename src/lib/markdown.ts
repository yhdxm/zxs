// 轻量、零依赖的 Markdown -> HTML 渲染器（仅支持常用子集）。
// 安全策略：先对全部输入做 HTML 转义，再注入受控标签，从根本上杜绝 XSS。

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function inline(text: string): string {
  let s = escapeHtml(text)

  // 行内代码
  s = s.replace(/`([^`]+)`/g, (_m, code: string) => `<code class="md-code">${code}</code>`)
  // 加粗
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  s = s.replace(/__([^_]+)__/g, '<strong>$1</strong>')
  // 斜体
  s = s.replace(/\*([^*]+)\*/g, '<em>$1</em>')
  s = s.replace(/(?<!\w)_([^_]+)_(?!\w)/g, '<em>$1</em>')
  // 链接 [文本](地址)，仅放行安全协议
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_m, label: string, url: string) => {
    const safe = /^(https?:\/\/|#|\/|mailto:)/i.test(url.trim())
    return safe ? `<a class="md-a" href="${url.trim()}" target="_blank" rel="noopener noreferrer">${label}</a>` : label
  })
  // 软换行
  s = s.replace(/  \n/g, '<br/>')

  return s
}

export function renderMarkdown(input: string): string {
  if (!input) return ''
  const lines = input.replace(/\r\n/g, '\n').split('\n')
  let html = ''
  let i = 0

  const isBlockStart = (line: string) =>
    /^```/.test(line) ||
    /^(#{1,6})\s/.test(line) ||
    /^>\s?/.test(line) ||
    /^\s*[-*]\s+/.test(line) ||
    /^\s*\d+\.\s+/.test(line) ||
    /^(\s*[-*_]){3,}\s*$/.test(line)

  while (i < lines.length) {
    const line = lines[i] ?? ''

    // 代码围栏 ```
    const fence = line.match(/^```(\w*)\s*$/)
    if (fence) {
      const code: string[] = []
      i += 1
      while (i < lines.length && !/^```\s*$/.test(lines[i] ?? '')) {
        code.push(lines[i] ?? '')
        i += 1
      }
      i += 1 // 跳过结束围栏
      html += `<pre class="md-pre"><code>${escapeHtml(code.join('\n'))}</code></pre>`
      continue
    }

    // 标题
    const h = line.match(/^(#{1,6})\s+(.*)$/)
    if (h) {
      const level = (h[1] ?? '').length
      html += `<h${level} class="md-h md-h${level}">${inline(h[2] ?? '')}</h${level}>`
      i += 1
      continue
    }

    // 分隔线
    if (/^(\s*[-*_]){3,}\s*$/.test(line)) {
      html += '<hr class="md-hr"/>'
      i += 1
      continue
    }

    // 引用
    if (/^>\s?/.test(line)) {
      const buf: string[] = []
      while (i < lines.length && /^>\s?/.test(lines[i] ?? '')) {
        buf.push((lines[i] ?? '').replace(/^>\s?/, ''))
        i += 1
      }
      html += `<blockquote class="md-quote">${renderMarkdown(buf.join('\n'))}</blockquote>`
      continue
    }

    // 无序列表
    if (/^\s*[-*]\s+/.test(line)) {
      const buf: string[] = []
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i] ?? '')) {
        buf.push((lines[i] ?? '').replace(/^\s*[-*]\s+/, ''))
        i += 1
      }
      html += `<ul class="md-ul">${buf.map((it) => `<li>${inline(it)}</li>`).join('')}</ul>`
      continue
    }

    // 有序列表
    if (/^\s*\d+\.\s+/.test(line)) {
      const buf: string[] = []
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i] ?? '')) {
        buf.push((lines[i] ?? '').replace(/^\s*\d+\.\s+/, ''))
        i += 1
      }
      html += `<ol class="md-ol">${buf.map((it) => `<li>${inline(it)}</li>`).join('')}</ol>`
      continue
    }

    // 空行
    if (line.trim() === '') {
      i += 1
      continue
    }

    // 段落
    const para: string[] = []
    while (i < lines.length && (lines[i] ?? '').trim() !== '' && !isBlockStart(lines[i] ?? '')) {
      para.push(lines[i] ?? '')
      i += 1
    }
    html += `<p class="md-p">${inline(para.join(' '))}</p>`
  }

  return html
}

export interface StructuredAnswer {
  body: string
  summary: string | null
}

/**
 * 从回答中抽取「总结」段落：匹配末尾一个以 总结 / 小结 / 结论 / 要点概括 /
 * summary / conclusion 为标题的小节，拆分为 正文 + 总结。
 * 若无显式总结则返回 summary = null（由系统提示词保证模型输出总结）。
 */
export function splitSummary(content: string): StructuredAnswer {
  const lines = content.split(/\r?\n/)
  let idx = -1
  for (let i = lines.length - 1; i >= 0; i -= 1) {
    const t = (lines[i] ?? '').trim()
    if (/^#{1,6}\s*(总结|小结|结论|要点概括|核心结论|summary|conclusion)\b/i.test(t)) {
      idx = i
      break
    }
  }

  if (idx === -1) {
    return { body: content, summary: null }
  }

  const summary = lines.slice(idx).join('\n').trim()
  const body = lines.slice(0, idx).join('\n').trim()
  return { body, summary }
}
