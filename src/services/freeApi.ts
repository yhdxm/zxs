// 免费第三方 API 通用直连助手（带 CORS 代理兜底）。
// 全部免费、无需 key；直连失败自动经 allorigins / codetabs 代理兜底，
// 仍失败则抛错，由调用方降级（展示缓存/知识库/AI 生成）。

function fetchWithTimeout(url: string, timeout: number, init: RequestInit = {}): Promise<Response> {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), timeout)
  return fetch(url, { signal: ctrl.signal, ...init }).finally(() => clearTimeout(t))
}

/**
 * 拉取 JSON，自动处理 CORS：
 * 1) 直连；2) allorigins /raw 代理；3) codetabs 代理。
 * 任一路返回可解析 JSON 即成功。
 */
export async function fetchCorsJson<T = unknown>(
  url: string,
  opts: { timeout?: number; accept?: string } = {}
): Promise<T> {
  const timeout = opts.timeout ?? 9000
  const accept = opts.accept ?? 'application/json'
  const attempts: Array<() => Promise<Response>> = [
    () => fetchWithTimeout(url, timeout, { headers: { Accept: accept } }),
    () => fetchWithTimeout(`https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`, timeout, { headers: { Accept: accept } }),
    () => fetchWithTimeout(`https://api.codetabs.com/v1/proxy/?quest=${encodeURIComponent(url)}`, timeout, { headers: { Accept: accept } })
  ]
  let lastErr: unknown
  for (const attempt of attempts) {
    try {
      const res = await attempt()
      if (!res.ok) continue
      const text = await res.text()
      if (!text) continue
      return JSON.parse(text) as T
    } catch (e) {
      lastErr = e
    }
  }
  throw lastErr ?? new Error('fetchCorsJson failed: ' + url)
}

/** 拉取纯文本（书籍正文等），带超时与代理兜底。maxBytes 限制读取长度，避免超大文件卡死。 */
export async function fetchCorsText(
  url: string,
  opts: { timeout?: number; maxBytes?: number } = {}
): Promise<string> {
  const timeout = opts.timeout ?? 12000
  const maxBytes = opts.maxBytes ?? 80000
  const attempts: Array<() => Promise<Response>> = [
    () => fetchWithTimeout(url, timeout),
    () => fetchWithTimeout(`https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`, timeout),
    () => fetchWithTimeout(`https://api.codetabs.com/v1/proxy/?quest=${encodeURIComponent(url)}`, timeout)
  ]
  let lastErr: unknown
  for (const attempt of attempts) {
    try {
      const res = await attempt()
      if (!res.ok) continue
      const buf = await res.arrayBuffer()
      const slice = buf.slice(0, maxBytes)
      return new TextDecoder('utf-8').decode(slice)
    } catch (e) {
      lastErr = e
    }
  }
  throw lastErr ?? new Error('fetchCorsText failed: ' + url)
}
