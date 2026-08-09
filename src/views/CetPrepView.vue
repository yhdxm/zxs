<template>
  <div class="cet-prep-root" ref="root">
    <nav class="topnav" id="topNav"></nav>
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
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { initPrep, type PrepStorage } from '../prep/prepApp'
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
  seedMasterWords
} from '../services/cetPrepService'

const root = ref<HTMLElement | null>(null)
const loading = ref(true)
const error = ref('')
let cleanup: (() => void) | null = null

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
  if (!root.value) return
  try {
    cleanup = await initPrep(root.value, storage)
  } catch (e: any) {
    error.value = '备考数据加载失败：' + (e?.message || e)
  } finally {
    loading.value = false
  }
})

onUnmounted(() => {
  if (cleanup) cleanup()
})
</script>

<!-- 注意：以下样式为全局（非 scoped），但全部以 .cet-prep-root 命名空间前缀，
     避免 .btn/.card/.input 等通用类名污染主站 Element Plus 组件 -->
<style>
.cet-prep-root {
  --bg: #FBF6EE;
  --surface: #FFFFFF;
  --surface-2: #FDF3E7;
  --ink: #22304E;
  --ink-soft: #5B6A86;
  --orange: #F0922B;
  --orange-2: #FFB877;
  --orange-soft: #FCEBD6;
  --green: #2E9E5B;
  --red: #E0492F;
  --amber: #E8A33D;
  --border: #ECE0CE;
  --border-2: #F3E8D7;
  --shadow: 0 8px 24px rgba(34, 48, 78, 0.08);
  --shadow-sm: 0 3px 10px rgba(34, 48, 78, 0.06);
  --radius: 16px;
  --radius-sm: 11px;
  background: var(--bg);
  color: var(--ink);
  min-height: 100vh;
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

/* ===== 顶部导航（桌面/平板横向） ===== */
.cet-prep-root .topnav {
  display: flex;
  position: sticky;
  top: 0;
  z-index: 20;
  background: var(--surface);
  border-bottom: 1px solid var(--border);
  padding: 10px 14px;
  gap: 6px;
  overflow-x: auto;
}
.cet-prep-root .topnav .nav-item { flex: 0 0 auto; padding: 9px 14px; }
.cet-prep-root .bottom-nav { display: none; }

.cet-prep-root .content { padding: 22px 26px 40px; max-width: 1180px; width: 100%; margin: 0 auto; }
.cet-prep-root .page-head { margin-bottom: 18px; }
.cet-prep-root .page-title { font-size: 23px; font-weight: 800; margin: 0 0 4px; }
.cet-prep-root .page-sub { color: var(--ink-soft); font-size: 13.5px; margin: 0; }

/* ===== cards ===== */
.cet-prep-root .card { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); padding: 18px; box-shadow: var(--shadow-sm); }
.cet-prep-root .card + .card { margin-top: 16px; }
.cet-prep-root .grid { display: grid; gap: 16px; }
.cet-prep-root .g2 { grid-template-columns: repeat(2, 1fr); }
.cet-prep-root .g3 { grid-template-columns: repeat(3, 1fr); }
.cet-prep-root .g4 { grid-template-columns: repeat(4, 1fr); }
.cet-prep-root .stat { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 14px 16px; }
.cet-prep-root .stat .label { font-size: 12.5px; color: var(--ink-soft); margin-bottom: 6px; }
.cet-prep-root .stat .num { font-size: 26px; font-weight: 800; color: var(--ink); line-height: 1.1; }
.cet-prep-root .stat .num small { font-size: 14px; font-weight: 600; color: var(--ink-soft); }
.cet-prep-root .stat.accent .num { color: var(--orange); }
.cet-prep-root .stat.green .num { color: var(--green); }
.cet-prep-root .stat.red .num { color: var(--red); }

/* today handle bar */
.cet-prep-root .handle { background: linear-gradient(135deg, #FFF4E6, #FDEAD2); border: 1px solid var(--orange-soft); border-radius: var(--radius); padding: 16px 18px; display: flex; flex-wrap: wrap; gap: 14px; align-items: center; }
.cet-prep-root .handle .h-title { font-weight: 800; font-size: 16px; display: flex; align-items: center; gap: 8px; }
.cet-prep-root .handle .h-item { display: flex; align-items: center; gap: 8px; background: var(--surface); border: 1px solid var(--border); border-radius: 999px; padding: 7px 14px; font-size: 13.5px; font-weight: 600; }
.cet-prep-root .handle .h-item b { color: var(--orange); }
.cet-prep-root .handle .h-item.warn b { color: var(--red); }

/* buttons */
.cet-prep-root .btn { display: inline-flex; align-items: center; gap: 7px; padding: 9px 16px; border-radius: 11px; font-weight: 700; font-size: 14px; background: var(--surface-2); color: var(--ink); border: 1px solid var(--border); transition: 0.15s; }
.cet-prep-root .btn:hover { background: var(--surface); }
.cet-prep-root .btn svg { width: 17px; height: 17px; }
.cet-prep-root .btn-primary { background: linear-gradient(135deg, var(--orange), var(--orange-2)); color: #fff; border: none; box-shadow: var(--shadow-sm); }
.cet-prep-root .btn-primary:hover { filter: brightness(1.04); }
.cet-prep-root .btn-green { background: var(--green); color: #fff; border: none; }
.cet-prep-root .btn-red { background: var(--red); color: #fff; border: none; }
.cet-prep-root .btn-ghost { background: transparent; }
.cet-prep-root .btn-sm { padding: 6px 11px; font-size: 13px; border-radius: 9px; }
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
.cet-prep-root .sec-title { font-size: 15.5px; font-weight: 800; margin: 4px 0 12px; display: flex; align-items: center; gap: 8px; }
.cet-prep-root .sec-title svg { width: 18px; height: 18px; color: var(--orange); }

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
.cet-prep-root .li { display: flex; align-items: center; gap: 12px; padding: 13px 14px; border: 1px solid var(--border); border-radius: 12px; background: var(--surface); }
.cet-prep-root .li + .li { margin-top: 10px; }
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
.cet-prep-root .backup-banner { background: #FFF7E8; border: 1px solid var(--orange-soft); border-radius: 12px; padding: 12px 16px; display: flex; align-items: center; gap: 12px; margin-bottom: 16px; }
.cet-prep-root .backup-banner svg { width: 22px; height: 22px; color: var(--orange); flex: 0 0 22px; }

.cet-prep-root .empty { text-align: center; color: var(--ink-soft); padding: 30px 10px; font-size: 14px; }
.cet-prep-root .muted { color: var(--ink-soft); font-size: 13px; }
.cet-prep-root .spacer { flex: 1; }

/* ===== Focus overlay ===== */
.cet-prep-root .focus { position: fixed; inset: 0; background: linear-gradient(160deg, #FFF8EF, #FDEBD6); z-index: 50; display: none; flex-direction: column; align-items: center; justify-content: center; padding: 24px; }
.cet-prep-root .focus.show { display: flex; }
.cet-prep-root .focus-top { position: absolute; top: 18px; left: 0; right: 0; display: flex; justify-content: space-between; align-items: center; padding: 0 22px; }
.cet-prep-root .focus-progress { font-weight: 800; font-size: 16px; color: var(--ink); }
.cet-prep-root .focus-card { width: min(560px, 92vw); background: var(--surface); border-radius: 24px; box-shadow: var(--shadow); padding: 34px 30px; text-align: center; position: relative; min-height: 300px; display: flex; flex-direction: column; justify-content: center; }
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
    background: rgba(255, 255, 255, 0.92);
    backdrop-filter: blur(12px);
    border-top: 1px solid var(--border);
    padding: 6px 4px calc(6px + env(safe-area-inset-bottom));
  }
  .cet-prep-root .bottom-nav .nav-item { flex: 1; flex-direction: column; gap: 3px; padding: 7px 4px; font-size: 11.5px; border-radius: 10px; }
  .cet-prep-root .bottom-nav .nav-item svg { width: 22px; height: 22px; }
  .cet-prep-root .content { padding: 16px 14px 92px; }
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
}
@media (max-width: 380px) {
  .cet-prep-root .handle { flex-direction: column; align-items: stretch; }
}
</style>
