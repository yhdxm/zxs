<template>
  <div class="cet-prep-root" ref="root">
    <!-- 模块标题栏：与系统 PageHeader 组件一致（位于导航栏正上方） -->
    <PageHeader
      title="四六级备考"
      :icon="School"
      subtitle="大纲词库 4544 词 · 听力 / 阅读 / 写作 / 翻译四轨系统训练 · 智能错本复盘"
    >
      <template #actions>
        <el-button text :icon="Setting" @click="openSettings">设置</el-button>
        <el-button type="primary" round :icon="VideoPlay" @click="startStudy">开始学习</el-button>
      </template>
    </PageHeader>

    <nav class="topnav" id="topNav"></nav>
    <div v-if="missingTable" class="prep-missing-banner">
      备考词库表（cet4_words）尚未创建或网络连接失败，当前使用内置完整四级词库（4544 词）。联网并在 Supabase 中执行 <code>scripts/cet4_prep.sql</code> 后，可自动同步云端进度与词表。
    </div>
    <div class="content" id="content"></div>
    <nav class="bottom-nav" id="bottomNav"></nav>

    <!-- 专注背词遮罩 -->
    <div class="focus" id="focus">
      <div id="confetti"></div>
      <div class="focus-top">
        <div class="focus-progress" id="focusProgress"></div>
        <button class="btn btn-ghost btn-sm" id="focusClose">退出</button>
      </div>
      <div class="focus-card" id="focusCard"></div>
    </div>

    <div v-if="loading" class="prep-state">正在加载备考数据…</div>
    <div v-if="error" class="prep-state prep-error">{{ error }}</div>

    <!-- 统一单词详情（三模块共用同一组件） -->
    <WordDetailDialog
      v-model="detailVisible"
      :word="detailWord.word"
      :phonetic="detailWord.phonetic"
      :pos="detailWord.pos"
      :definition="detailWord.definition"
      :pool="wordPool"
      module-label="四六级 · 备考"
      @add-word-book="onDetailAction('book')"
      @mastered="onDetailAction('mastered')"
    />
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref, reactive, computed } from 'vue'
import { ElMessage } from 'element-plus'
import PageHeader from '../components/PageHeader.vue'
import { School, Setting, VideoPlay } from '@element-plus/icons-vue'
import { initPrep, type PrepStorage } from '../prep/prepApp'
import { MASTER_WORDS_BUNDLE } from '../prep/masterWordsBundle'
import WordDetailDialog from '../components/WordDetailDialog.vue'
import {
  fetchMasterWords,
  loadAll,
  persistProgress,
  persistPractice,
  removePractice,
  persistMistake,
  removeMistake,
  persistCheckin,
  persistSettings,
  replaceAll,
  clearSampleData,
  isAdmin,
  seedMasterWords,
  isMissingTableError,
  flushQueue
} from '../services/cetPrepService'

const root = ref<HTMLElement | null>(null)
const loading = ref(true)
const error = ref('')
const missingTable = ref(false)
let cleanup: (() => void) | null = null

// ===== 统一单词详情：监听原生 DOM 卡片（prepApp.ts）派发的事件 =====
const detailVisible = ref(false)
const detailWord = reactive({ word: '', phonetic: '', pos: '', definition: '' })
/** 形近词候选池：四级主词表全部单词 */
const wordPool = computed(() => MASTER_WORDS_BUNDLE.map((w) => w[0]))
function onWordDetailEvent(e: Event) {
  const d = (e as CustomEvent).detail || {}
  detailWord.word = d.word || ''
  detailWord.phonetic = d.phonetic || ''
  detailWord.pos = d.pos || ''
  detailWord.definition = d.definition || ''
  detailVisible.value = true
}
/** 详情弹窗底部操作：回传给 vanilla 应用处理 */
function onDetailAction(action: 'book' | 'mastered') {
  const word = detailWord.word
  if (!word) return
  window.dispatchEvent(new CustomEvent('zxs-word-action', { detail: { word, action } }))
  ElMessage.success(action === 'book' ? '已加入生词本' : '已标记为掌握')
}

const emptyState = () => ({
  words: {},
  practice: [],
  mistakes: [],
  checkins: {},
  settings: { newPerDay: 10, examDate: null, manualStreak: null, linkedGoal: null }
})

/* PageHeader 按钮：桥接到 vanilla 应用内已有的逻辑（nav-item / data-act） */
function openSettings() {
  const mine = root.value?.querySelector('.nav-item[data-view="mine"]') as HTMLElement | null
  if (mine) mine.click()
}
function startStudy() {
  const today = root.value?.querySelector('.nav-item[data-view="today"]') as HTMLElement | null
  if (today) today.click()
  // 切到今日视图后，触发其中的「开始背词」专注模式
  window.setTimeout(() => {
    const btn = document.querySelector('[data-act="startFocus"]') as HTMLElement | null
    if (btn) btn.click()
  }, 60)
}

const storage: PrepStorage = {
  fetchMasterWords,
  loadAll,
  persistProgress,
  persistPractice,
  removePractice,
  persistMistake,
  removeMistake,
  persistCheckin,
  persistSettings,
  replaceAll,
  clearSampleData,
  isAdmin,
  seedMasterWords
}

onMounted(async () => {
  // 监听 vanilla 卡片（prepApp.ts）派发的「查看详情」事件
  window.addEventListener('zxs-word-detail', onWordDetailEvent)
  if (!root.value) return
  try {
    cleanup = await initPrep(root.value, storage)
  } catch (e: any) {
    // 表尚未创建时降级为内存演示数据，避免直接红字报错卡死
    if (isMissingTableError(e)) {
      missingTable.value = true
      error.value = ''
      const fallbackStorage: PrepStorage = {
        ...storage,
        fetchMasterWords: async () => MASTER_WORDS_BUNDLE,
        loadAll: async () => emptyState()
      }
      try {
        cleanup = await initPrep(root.value, fallbackStorage)
      } catch (e2: any) {
        error.value = '备考数据加载失败：' + (e2?.message || e2)
      }
    } else {
      error.value = '备考数据加载失败：' + (e?.message || e)
    }
  } finally {
    loading.value = false
    // 进入页面即补发离线队列中未成功的删除/写入（数据可靠性兜底）
    flushQueue().catch((e) => console.warn('[CetPrep] 离线队列重试失败', e))
  }
})

onUnmounted(() => {
  window.removeEventListener('zxs-word-detail', onWordDetailEvent)
  if (cleanup) cleanup()
})
</script>

<!-- 注意：以下样式为全局（非 scoped），但全部以 .cet-prep-root 命名空间前缀，
     避免 .btn/.card/.input 等通用类名污染主站 Element Plus 组件 -->
<style>
.cet-prep-root {
  --bg: #f8fafc; /* 与现有系统白底一致（--bg-app） */
  --surface: #FFFFFF;
  --surface-2: #F4F3FB;
  --ink: #22304E;
  --ink-soft: #5B6A86;
  --orange: #534AB7;
  --orange-2: #7F77DD;
  --orange-soft: #ECEAF8;
  --green: #2E9E5B;
  --red: #E0492F;
  --amber: #E8A33D;
  --border: #E6E3F2;
  --border-2: #F0EEF8;
  --shadow: var(--shadow-card); /* 与现有系统卡片阴影一致（indigo 光晕） */
  --shadow-sm: 0 3px 10px rgba(34, 48, 78, 0.06);
  /* 覆盖全局主题变量，使 PageHeader 图标呈四六级紫色品牌（仅作用于本页） */
  --primary-2: #7F77DD;
  --primary-3: #534AB7;
  --accent-glow: rgba(83, 74, 183, 0.28);
  /* 半径统一引用全局 --radius(12px) / --radius-sm(10px)，不再本地写死 */

  /* 与 AI 助手页 / 学位英语页 .degree-view 完全一致的容器尺寸（含移动端安全区） */
  display: flex;
  flex-direction: column;
  min-width: 0;
  max-width: 1400px;
  margin: 0 auto;
  padding: 0 18px calc(18px + env(safe-area-inset-bottom));
  width: 100%;
  box-sizing: border-box;

  background: var(--bg);
  color: var(--ink);
  min-height: 100vh;
  min-height: 100dvh;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Hiragino Sans GB",
    "Microsoft YaHei", sans-serif;
  font-size: 15px;
  line-height: 1.5;
  -webkit-font-smoothing: antialiased;
}
.cet-prep-root * { box-sizing: border-box; }
.cet-prep-root button {
  font-family: inherit;
  cursor: pointer;
  border: none;
  background: none;
  color: inherit;
}
.cet-prep-root input,
.cet-prep-root select,
.cet-prep-root textarea {
  font-family: inherit;
  font-size: 15px;
  color: var(--ink);
}
.cet-prep-root a { color: var(--orange); }
.cet-prep-root ::-webkit-scrollbar { width: 9px; height: 9px; }
.cet-prep-root ::-webkit-scrollbar-thumb { background: var(--border); border-radius: 9px; }

/* ===== 顶部导航（桌面/平板横向）—— 与学位英语 .de-topnav 完全一致 ===== */
.cet-prep-root .topnav {
  display: flex;
  position: relative;
  z-index: 20;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  box-shadow: var(--shadow-sm);
  padding: 8px 12px;
  margin: 0 auto 12px;
  /* 与学位英语一致：满宽不受额外缩进 */
  max-width: none;
  width: 100%;
  gap: 4px;
  overflow-x: auto;
}
.cet-prep-root .topnav .nav-item {
  flex: 1 1 0;
  min-width: 64px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 8px 12px;
  border-radius: 9px;
  background: transparent;
  color: var(--ink-soft);
  font-weight: 700;
  font-size: 13px;
  border: none;
  transition: 0.12s ease-out; /* 缩短过渡 */
  white-space: nowrap;
  touch-action: manipulation;
  -webkit-tap-highlight-color: transparent;
  user-select: none;
  transform: translateZ(0);
  will-change: background-color, color, box-shadow;
}
.cet-prep-root .topnav .nav-item:hover { background: var(--surface-2); color: var(--ink); }
.cet-prep-root .topnav .nav-item:active { transform: scale(0.97); }
.cet-prep-root .topnav .nav-item:hover { background: var(--surface-2); color: var(--ink); }
.cet-prep-root .topnav .nav-item.active {
  background: linear-gradient(135deg, var(--orange), var(--orange-2));
  color: #fff;
  box-shadow: 0 4px 12px rgba(240, 146, 43, 0.25);
}
.cet-prep-root .topnav .nav-item svg { width: 16px; height: 16px; }
.cet-prep-root .bottom-nav { display: none; }

/* ===== 区块分割线（主要区域之间） ===== */
.cet-prep-root .topnav {
  margin-bottom: 12px;
}
/* 隐藏 prepApp 内的重复设置按钮（PageHeader 已有） */
.cet-prep-root [data-act="gotoSettings"] {
  display: none !important;
}
/* prepApp 渲染的内容区内分割线 */
.cet-prep-root .content > .card + .card,
.cet-prep-root .content > .handle + .card,
.cet-prep-root .content > .card + .handle,
.cet-prep-root .content > .stat-row + .card {
  margin-top: 12px;
}

.cet-prep-root .content { padding: 0; max-width: none; width: 100%; margin: 0 auto; }
.cet-prep-root .page-head { margin-bottom: 18px; }
.cet-prep-root .page-title { font-size: 23px; font-weight: 800; margin: 0 0 4px; }
.cet-prep-root .page-sub { color: var(--ink-soft); font-size: 13.5px; margin: 0; }

/* ===== cards —— 与图3标准一致 ===== */
.cet-prep-root .card { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); padding: 14px 16px; box-shadow: var(--shadow-sm); }
.cet-prep-root .card + .card { margin-top: 12px; }
.cet-prep-root .grid { display: grid; gap: 16px; }
.cet-prep-root .g2 { grid-template-columns: repeat(2, 1fr); }
.cet-prep-root .g3 { grid-template-columns: repeat(3, 1fr); }
.cet-prep-root .g4 { grid-template-columns: repeat(4, 1fr); }
.cet-prep-root .stat { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 10px 14px; }
.cet-prep-root .stat .label { font-size: 12px; color: var(--ink-soft); margin-bottom: 4px; }
.cet-prep-root .stat .num { font-size: 22px; font-weight: 800; color: var(--ink); line-height: 1.1; }
.cet-prep-root .stat .num small { font-size: 14px; font-weight: 600; color: var(--ink-soft); }
.cet-prep-root .stat.accent .num { color: var(--orange); }
.cet-prep-root .stat.green .num { color: var(--green); }
.cet-prep-root .stat.red .num { color: var(--red); }

/* today handle bar —— 与图3标准一致：更紧凑 */
.cet-prep-root .handle { background: linear-gradient(135deg, #F1EFFB, #E3E0F7); border: 1px solid var(--orange-soft); border-radius: var(--radius); padding: 12px 14px; display: flex; flex-wrap: wrap; gap: 10px; align-items: center; }
.cet-prep-root .handle .h-title { font-weight: 800; font-size: 15px; display: flex; align-items: center; gap: 8px; }
.cet-prep-root .handle .h-item { display: flex; align-items: center; gap: 8px; background: var(--surface); border: 1px solid var(--border); border-radius: 999px; padding: 6px 12px; font-size: 13px; font-weight: 600; }
.cet-prep-root .handle .h-item b { color: var(--orange); }
.cet-prep-root .handle .h-item.warn b { color: var(--red); }

/* buttons —— 与图3标准一致 */
.cet-prep-root .btn { display: inline-flex; align-items: center; gap: 6px; padding: 7px 14px; border-radius: 9px; font-weight: 700; font-size: 13px; background: var(--surface-2); color: var(--ink); border: 1px solid var(--border); transition: 0.15s; }
.cet-prep-root .btn:hover { background: var(--surface); }
.cet-prep-root .btn:active { transform: scale(0.97); }
.cet-prep-root .btn svg { width: 17px; height: 17px; }
.cet-prep-root .btn-primary { background: linear-gradient(135deg, var(--orange), var(--orange-2)); color: #fff; border: none; box-shadow: var(--shadow-sm); }
.cet-prep-root .btn-primary:hover { filter: brightness(1.04); }
.cet-prep-root .btn-green { background: var(--green); color: #fff; border: none; }
.cet-prep-root .btn-red { background: var(--red); color: #fff; border: none; }
.cet-prep-root .btn-ghost { background: transparent; }
.cet-prep-root .btn-sm { padding: 5px 10px; font-size: 12px; border-radius: 8px; }
.cet-prep-root .btn[disabled] { opacity: 0.45; cursor: not-allowed; }
.cet-prep-root .btn-block { width: 100%; justify-content: center; }

/* forms */
.cet-prep-root .field { margin-bottom: 12px; }
.cet-prep-root .field label { display: block; font-size: 13px; font-weight: 600; color: var(--ink-soft); margin-bottom: 5px; }
.cet-prep-root .input,
.cet-prep-root .select,
.cet-prep-root .textarea { width: 100%; padding: 10px 12px; border: 1px solid var(--border); border-radius: 10px; background: var(--surface); transition: 0.15s; outline: none; }
.cet-prep-root .input:focus,
.cet-prep-root .select:focus,
.cet-prep-root .textarea:focus { border-color: var(--orange); box-shadow: 0 0 0 3px var(--orange-soft); }
.cet-prep-root .textarea { resize: vertical; min-height: 64px; }
.cet-prep-root .row { display: flex; gap: 10px; flex-wrap: wrap; }
.cet-prep-root .row > * { flex: 1; min-width: 120px; }

/* section title */
.cet-prep-root .sec-title { font-size: 14.5px; font-weight: 800; margin: 4px 0 10px; display: flex; align-items: center; gap: 8px; }
.cet-prep-root .sec-title svg { width: 16px; height: 16px; color: var(--orange); }

/* ring */
.cet-prep-root .ring-wrap { display: flex; align-items: center; gap: 16px; }
.cet-prep-root .ring { width: 120px; height: 120px; flex: 0 0 120px; }
.cet-prep-root .ring-bg { fill: none; stroke: var(--border-2); stroke-width: 11; }
.cet-prep-root .ring-fg { fill: none; stroke: var(--orange); stroke-width: 11; stroke-linecap: round; transition: stroke-dashoffset 0.6s; }
.cet-prep-root .ring-center { font-weight: 800; font-size: 20px; }

/* heatmap */
.cet-prep-root .heatmap { display: grid; grid-template-columns: repeat(15, 1fr); gap: 5px; }
.cet-prep-root .hm-cell { aspect-ratio: 1; border-radius: 4px; background: var(--border-2); }
.cet-prep-root .hm-cell.lvl1 { background: #FCE3C4; }
.cet-prep-root .hm-cell.lvl2 { background: #F9C289; }
.cet-prep-root .hm-cell.lvl3 { background: #F4A24E; }
.cet-prep-root .hm-cell.lvl4 { background: var(--orange); }
.cet-prep-root .hm-legend { display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--ink-soft); margin-top: 10px; }

/* line chart */
.cet-prep-root .chart-box { width: 100%; overflow-x: auto; }
.cet-prep-root .chart { width: 680px; max-width: 100%; height: auto; display: block; }

/* list items */
.cet-prep-root .li { display: flex; align-items: center; gap: 10px; padding: 10px 12px; border: 1px solid var(--border); border-radius: 10px; background: var(--surface); }
.cet-prep-root .li + .li { margin-top: 8px; }
.cet-prep-root .li.due { border-color: var(--red); background: #FFF5F2; }
.cet-prep-root .li .li-main { flex: 1; min-width: 0; }
.cet-prep-root .li .li-t { font-weight: 700; font-size: 14.5px; }
.cet-prep-root .li .li-d { font-size: 12.5px; color: var(--ink-soft); margin-top: 2px; }
.cet-prep-root .tag { display: inline-block; font-size: 11.5px; font-weight: 700; padding: 2px 9px; border-radius: 999px; background: var(--orange-soft); color: var(--orange); }
.cet-prep-root .tag.green { background: #E2F5EA; color: var(--green); }
.cet-prep-root .tag.red { background: #FBE3DD; color: var(--red); }
.cet-prep-root .tag.ink { background: #E7ECF5; color: var(--ink); }
.cet-prep-root .li-actions { display: flex; gap: 6px; flex: 0 0 auto; }

/* filters */
.cet-prep-root .filters { display: flex; gap: 10px; flex-wrap: wrap; margin-bottom: 14px; }
.cet-prep-root .filters .select { flex: 0 0 auto; width: auto; min-width: 130px; }

/* countdown */
.cet-prep-root .countdown { display: flex; align-items: baseline; gap: 10px; }
.cet-prep-root .countdown .big { font-size: 46px; font-weight: 900; color: var(--orange); line-height: 1; }
.cet-prep-root .countdown .unit { font-size: 15px; font-weight: 700; color: var(--ink-soft); }
.cet-prep-root .note { font-size: 12.5px; color: var(--amber); background: #FCF3E2; border: 1px solid #F6E4C0; border-radius: 10px; padding: 9px 12px; margin-top: 10px; display: flex; gap: 7px; align-items: flex-start; }
.cet-prep-root .note svg { width: 16px; height: 16px; flex: 0 0 16px; margin-top: 1px; }

/* structure card */
.cet-prep-root .struct-row { display: flex; align-items: center; justify-content: space-between; padding: 10px 0; border-bottom: 1px dashed var(--border-2); }
.cet-prep-root .struct-row:last-child { border-bottom: none; }
.cet-prep-root .struct-row .s-name { font-weight: 700; }
.cet-prep-root .struct-row .s-pct { color: var(--orange); font-weight: 800; }

/* backup banner */
.cet-prep-root .backup-banner { background: #F3F1FB; border: 1px solid var(--orange-soft); border-radius: 12px; padding: 12px 16px; display: flex; align-items: center; gap: 12px; margin-bottom: 16px; }
.cet-prep-root .backup-banner svg { width: 22px; height: 22px; color: var(--orange); flex: 0 0 22px; }

.cet-prep-root .empty { text-align: center; color: var(--ink-soft); padding: 30px 10px; font-size: 14px; }
.cet-prep-root .muted { color: var(--ink-soft); font-size: 13px; }
.cet-prep-root .spacer { flex: 1; }

/* ===== Focus overlay ===== */
.cet-prep-root .focus { position: fixed; inset: 0; background: linear-gradient(160deg, #FFF8EF, #FDEBD6); z-index: 50; display: none; flex-direction: column; align-items: center; overflow-y: auto; -webkit-overflow-scrolling: touch; padding: 24px; }
.cet-prep-root .focus.show { display: flex; }
.cet-prep-root .focus-top { position: absolute; top: 18px; left: 0; right: 0; display: flex; justify-content: space-between; align-items: center; padding: 0 22px; }
.cet-prep-root .focus-progress { font-weight: 800; font-size: 16px; color: var(--ink); }
.cet-prep-root .focus-card { width: min(560px, 92vw); margin: auto; background: var(--surface); border-radius: 24px; box-shadow: var(--shadow); padding: 34px 30px; text-align: center; position: relative; min-height: 300px; display: flex; flex-direction: column; justify-content: center; }
.cet-prep-root .fc-word { font-size: 44px; font-weight: 900; color: var(--ink); letter-spacing: 0.5px; }
.cet-prep-root .fc-ph { font-size: 21px; color: var(--ink-soft); margin-top: 8px; }
.cet-prep-root .fc-speak { margin-top: 14px; display: inline-flex; align-items: center; gap: 7px; background: var(--surface-2); border: 1px solid var(--border); border-radius: 999px; padding: 8px 15px; font-weight: 700; font-size: 13.5px; color: var(--ink); }
.cet-prep-root .fc-speak svg { width: 17px; height: 17px; color: var(--orange); }
.cet-prep-root .fc-divider { height: 1px; background: var(--border-2); margin: 22px 0; }
.cet-prep-root .fc-back { font-size: 19px; color: var(--ink); font-weight: 700; line-height: 1.5; }
.cet-prep-root .fc-pos { display: inline-block; font-size: 13px; font-weight: 700; color: var(--orange); background: var(--orange-soft); border-radius: 6px; padding: 2px 8px; margin-bottom: 10px; }
.cet-prep-root .fc-mean { font-size: 18px; color: var(--ink); margin-top: 6px; }
.cet-prep-root .fc-coll { font-size: 14px; color: var(--ink-soft); margin-top: 12px; font-style: italic; }
.cet-prep-root .fc-actions { display: flex; gap: 14px; margin-top: 30px; }
.cet-prep-root .fc-btn { flex: 1; padding: 16px; border-radius: 16px; font-weight: 800; font-size: 17px; display: flex; align-items: center; justify-content: center; gap: 8px; }
.cet-prep-root .fc-btn svg { width: 20px; height: 20px; }
.cet-prep-root .fc-known { background: var(--green); color: #fff; }
.cet-prep-root .fc-unknown { background: #FFF0EC; color: var(--red); border: 1.5px solid #F3C4B8; }
.cet-prep-root .fc-kind { position: absolute; top: 14px; left: 16px; font-size: 12px; font-weight: 700; color: var(--ink-soft); }
.cet-prep-root .fc-kind.review { color: var(--orange); }

.cet-prep-root #confetti { position: absolute; inset: 0; overflow: hidden; pointer-events: none; }
.cet-prep-root #confetti i { position: absolute; top: -12px; width: 10px; height: 14px; border-radius: 2px; animation: cetprep-fall 1.8s linear forwards; }
@keyframes cetprep-fall { to { transform: translateY(110vh) rotate(540deg); opacity: 0; } }
.cet-prep-root .focus-done { text-align: center; }
.cet-prep-root .focus-done h2 { font-size: 28px; margin: 0 0 8px; color: var(--green); }
.cet-prep-root .focus-done p { color: var(--ink-soft); margin: 0 0 20px; }

/* loading / error */
.cet-prep-root .prep-state { text-align: center; color: var(--ink-soft); padding: 40px 10px; font-size: 14px; }
.cet-prep-root .prep-error { color: var(--red); }

.cet-prep-root .prep-missing-banner {
  background: #F3F1FB;
  border-bottom: 1px solid var(--orange-soft);
  color: var(--ink);
  padding: 12px 16px;
  font-size: 13px;
  line-height: 1.6;
  text-align: center;
}
.cet-prep-root .prep-missing-banner code {
  background: #fff;
  padding: 2px 6px;
  border-radius: 6px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  color: var(--orange);
}

/* 词库数量不足提示 */
.cet-prep-root .prep-vocab-banner {
  background: #F3F1FB;
  border: 1px solid var(--orange-soft);
  border-radius: var(--radius-sm);
  color: var(--ink);
  padding: 10px 14px;
  font-size: 13px;
  line-height: 1.6;
  margin-bottom: 14px;
}
.cet-prep-root .prep-vocab-banner svg {
  width: 16px;
  height: 16px;
  vertical-align: -3px;
  margin-right: 6px;
  color: var(--orange);
}


/* ===== Responsive ===== */
@media (max-width: 768px) {
  .cet-prep-root .topnav { display: none; }
  .cet-prep-root .bottom-nav {
    display: flex;
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    z-index: 30;
    height: calc(60px + env(safe-area-inset-bottom));
    padding-bottom: env(safe-area-inset-bottom);
    background: var(--surface);
    background: color-mix(in srgb, var(--surface) 92%, transparent);
    backdrop-filter: saturate(160%) blur(14px);
    -webkit-backdrop-filter: saturate(160%) blur(14px);
    border-top: 1px solid var(--border);
    box-shadow: 0 -4px 18px rgba(15, 23, 42, 0.06);
  }
  .cet-prep-root .bottom-nav .nav-item {
    flex: 1 1 0;
    flex-direction: column;
    gap: 3px;
    padding: 6px 2px;
    font-size: 11.5px;
    font-weight: 700;
    border-radius: 10px;
    color: var(--ink-soft);
    min-height: 48px;
  }
  .cet-prep-root .bottom-nav .nav-item.active {
    color: var(--orange);
    background: var(--orange-soft);
  }
  .cet-prep-root .bottom-nav .nav-item svg { width: 22px; height: 22px; }
  .cet-prep-root .content { padding: 0 0 calc(92px + env(safe-area-inset-bottom)); }
  .cet-prep-root .g2,
  .cet-prep-root .g3,
  .cet-prep-root .g4 { grid-template-columns: 1fr; }
  .cet-prep-root .grid.g2,
  .cet-prep-root .grid.g3,
  .cet-prep-root .grid.g4 { grid-template-columns: 1fr; }
  .cet-prep-root .heatmap { grid-template-columns: repeat(10, 1fr); }
  .cet-prep-root .page-title { font-size: 20px; }
  .cet-prep-root .fc-word { font-size: 36px; }
  .cet-prep-root .fc-actions { flex-direction: column; }
  /* 移动端：全屏背词卡片留出顶部退出栏与底部安全区，卡片超高时可整屏滚动，避免「认识/不认识」按钮被裁切遮挡 */
  .cet-prep-root .focus { padding: 60px 14px calc(16px + env(safe-area-inset-bottom)); }
  .cet-prep-root .focus-card { min-height: 0; padding: 22px 16px; }
  .cet-prep-root .fc-actions { gap: 10px; margin-top: 22px; }
  .cet-prep-root .fc-btn { padding: 14px; font-size: 16px; }
}
@media (max-width: 380px) {
  .cet-prep-root .handle { flex-direction: column; align-items: stretch; }
}
</style>
