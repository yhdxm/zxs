<template>
  <div class="lb-root">
    <header class="lb-top">
      <div class="lb-brand">
        <span class="lb-logo">书籍阅读</span>
        <span class="lb-tag">古登堡计划免费电子书 · 阅读记录（全部免费）</span>
      </div>
      <div class="lb-clock-box" title="北京时间">
        <span class="lb-dot"></span><span class="lb-clock">{{ nowText }}</span><span class="lb-clock-hint">北京时间</span>
      </div>
    </header>

    <main class="lb-main">
      <section class="lb-card">
        <div class="lb-row">
          <el-input v-model="query" placeholder="搜索书名 / 作者，如 pride and prejudice / 科学" class="lb-input" @keyup.enter="search" />
          <el-button type="primary" :loading="loading" @click="search">搜索</el-button>
        </div>
        <div class="lb-grid">
          <div v-for="b in books" :key="b.id" class="lb-book">
            <div class="lb-book-title">{{ b.title }}</div>
            <div class="lb-book-author">{{ b.authors.map((a) => a.name).join(', ') || '佚名' }}</div>
            <div class="lb-book-meta">下载量 {{ b.download_count }} · {{ (b.languages || []).join('/') || '—' }}</div>
            <div class="lb-book-actions">
              <button class="lb-mini" @click="openBook(b)">在线阅读</button>
              <a v-if="pickEpubUrl(b)" :href="pickEpubUrl(b)!" target="_blank" class="lb-mini">EPUB</a>
              <button class="lb-mini" @click="bookmarkBook(b)">收藏</button>
            </div>
          </div>
          <p v-if="!books.length && !loading" class="lb-empty">没有结果，换个关键词试试（英文检索效果更佳）。</p>
        </div>
        <div class="lb-pager" v-if="bookResult.count > pageSize">
          <button class="lb-mini" :disabled="!bookResult.previous" @click="page--; search()">上一页</button>
          <span class="lb-pageinfo">第 {{ page }} 页 / 共 {{ Math.ceil(bookResult.count / pageSize) }} 页</span>
          <button class="lb-mini" :disabled="!bookResult.next" @click="page++; search()">下一页</button>
        </div>
      </section>

      <section v-if="reading" class="lb-card lb-reader">
        <div class="lb-hrow">
          <h3 class="lb-h">📖 {{ reading.title }}</h3>
          <button class="lb-mini" @click="reading = null">关闭</button>
        </div>
        <div v-if="textLoading" class="lb-empty">正文加载中…</div>
        <pre v-else class="lb-text">{{ bookText }}</pre>
      </section>

      <section class="lb-card">
        <h3 class="lb-h">我的书架（阅读记录）</h3>
        <div class="lb-grid">
          <div v-for="r in readingList" :key="r.id" class="lb-book">
            <div class="lb-book-title">{{ r.book_title }}</div>
            <div class="lb-book-meta">最近阅读：{{ fmtTime(r.updated_at) }}</div>
            <div class="lb-book-actions">
              <button class="lb-mini" @click="reopen(r)">继续阅读</button>
            </div>
          </div>
          <p v-if="!readingList.length" class="lb-empty">还没有阅读记录，打开一本书即可自动记录。</p>
        </div>
      </section>
    </main>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { fetchBooks, pickTextUrl, pickEpubUrl, fetchBookText, type GutenbergBook, type BookSearchResult } from '../services/learningService'
import { listReading, upsertReading, listLearnBookmarks, addLearnBookmark, type LearnReading, type LearnBookmark } from '../services/learnDb'

const nowText = ref('')
let clockTimer: number | undefined
function pad(n: number): string { return String(n).padStart(2, '0') }
function updateClock(): void {
  const d = new Date()
  nowText.value = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

const query = ref('')
const page = ref(1)
const pageSize = 12
const bookResult = ref<BookSearchResult>({ count: 0, next: null, previous: null, results: [] })
const books = ref<GutenbergBook[]>([])
const loading = ref(false)

async function search(): Promise<void> {
  loading.value = true
  bookResult.value = await fetchBooks(query.value, page.value)
  books.value = bookResult.value.results
  loading.value = false
}

const reading = ref<GutenbergBook | null>(null)
const bookText = ref('')
const textLoading = ref(false)
async function openBook(b: GutenbergBook): Promise<void> {
  const url = pickTextUrl(b)
  if (!url) { reading.value = b; bookText.value = '该书未提供纯文本格式，请使用 EPUB 链接下载阅读。'; return }
  reading.value = b
  textLoading.value = true
  bookText.value = ''
  try { bookText.value = await fetchBookText(url) }
  catch { bookText.value = '正文加载失败（可能受网络限制），请稍后重试或使用 EPUB 链接。' }
  finally { textLoading.value = false }
  await upsertReading(b.id, b.title, 1, 0)
  await loadReading()
}
async function reopen(r: LearnReading): Promise<void> {
  const url = `https://gutendex.com/books/${r.book_id}/`
  try {
    const res = await fetchBooks('', 1)
    const found = res.results.find((x) => x.id === r.book_id)
    if (found) await openBook(found)
    else { reading.value = null; books.value = [] }
  } catch { /* ignore */ }
  void url
}

const readingList = ref<LearnReading[]>([])
async function loadReading(): Promise<void> { readingList.value = await listReading() }

const bookmarks = ref<LearnBookmark[]>([])
async function loadBookmarks(): Promise<void> { bookmarks.value = await listLearnBookmarks('book') }
async function bookmarkBook(b: GutenbergBook): Promise<void> {
  await addLearnBookmark('book', String(b.id), b.title)
  await loadBookmarks()
}

function fmtTime(s: string): string {
  if (!s) return '—'
  return s.slice(0, 16).replace('T', ' ')
}

onMounted(async () => {
  updateClock()
  clockTimer = window.setInterval(updateClock, 1000)
  await Promise.all([search(), loadReading(), loadBookmarks()])
})
onUnmounted(() => { if (clockTimer) window.clearInterval(clockTimer) })
</script>

<style scoped>
.lb-root { min-height: 100%; }
.lb-top { position: sticky; top: 0; z-index: 10; display: flex; align-items: center; gap: 16px; padding: 0 24px 10px; background: var(--surface); border-bottom: 1px solid var(--border); flex-wrap: wrap; }
.lb-brand { display: flex; align-items: baseline; gap: 8px; }
.lb-logo { font-size: 18px; font-weight: 600; color: var(--text-strong); }
.lb-tag { font-size: 11px; color: var(--text-faint); }
.lb-clock-box { display: inline-flex; align-items: center; gap: 6px; margin-left: auto; }
.lb-dot { width: 8px; height: 8px; border-radius: 50%; background: #22c55e; box-shadow: 0 0 0 3px rgba(34,197,94,.2); }
.lb-clock { font-variant-numeric: tabular-nums; font-size: 13px; color: var(--text-strong); }
.lb-clock-hint { font-size: 11px; color: var(--text-faint); }
.lb-main { padding: 0 24px 24px; }
.lb-card { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 18px; margin-bottom: 16px; }
.lb-row { display: flex; gap: 8px; flex-wrap: wrap; }
.lb-input { width: 360px; }
.lb-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 12px; margin-top: 12px; }
.lb-book { padding: 12px; border: 1px solid var(--border); border-radius: 10px; background: var(--surface-soft); display: flex; flex-direction: column; gap: 4px; }
.lb-book-title { font-size: 13px; font-weight: 600; color: var(--text-strong); line-height: 1.4; }
.lb-book-author { font-size: 12px; color: var(--text-faint); }
.lb-book-meta { font-size: 11px; color: var(--text-faint); }
.lb-book-actions { display: flex; gap: 6px; margin-top: 6px; flex-wrap: wrap; }
.lb-mini { border: 1px solid var(--border); background: var(--surface); color: var(--brand, #378add); border-radius: 6px; padding: 3px 10px; font-size: 12px; cursor: pointer; text-decoration: none; display: inline-block; }
.lb-mini:hover { border-color: var(--brand, #378add); }
.lb-empty { grid-column: 1 / -1; color: var(--text-faint); font-size: 13px; padding: 16px; text-align: center; }
.lb-pager { display: flex; align-items: center; gap: 12px; justify-content: center; margin-top: 14px; }
.lb-pageinfo { font-size: 12px; color: var(--text-muted); }
.lb-reader { margin-top: 4px; }
.lb-hrow { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 10px; }
.lb-h { font-size: 15px; color: var(--text-strong); margin: 0; }
.lb-text { max-height: 60vh; overflow: auto; white-space: pre-wrap; word-break: break-word; line-height: 1.8; font-size: 13px; color: var(--text); background: var(--surface-soft); padding: 14px; border-radius: 8px; }
</style>
