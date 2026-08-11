<template>
  <div class="degree-eng-root" ref="root">
    <div v-if="loading" class="prep-state">正在加载学位英语备考台…</div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { initDegreePrep } from '../prep/degreePrep'

const root = ref<HTMLElement | null>(null)
const loading = ref(true)
let cleanup: (() => void) | null = null

onMounted(async () => {
  if (!root.value) return
  try {
    cleanup = await initDegreePrep(root.value)
  } catch (e: any) {
    if (root.value) root.value.innerHTML = `<div class="prep-state prep-error">加载失败：${e?.message || e}</div>`
  } finally {
    loading.value = false
  }
})

onUnmounted(() => {
  if (cleanup) cleanup()
})
</script>

<style scoped>
.degree-eng-root {
  --orange: #f0922b;
  --orange-2: #ffb877;
  --orange-soft: #fdeada;
  --green: #2e9e5b;
  --red: #e0492f;
  --ink: #22304e;
  --ink-soft: #5b6a86;
  --surface: #fff;
  --surface-2: #f6f7fb;
  --border: #e8ebf2;
  --border-2: #eef1f6;
  --radius: 16px;
  --radius-sm: 12px;
  --shadow: 0 10px 30px rgba(34, 48, 78, 0.1);
  --shadow-sm: 0 4px 14px rgba(34, 48, 78, 0.07);
  max-width: 1180px;
  margin: 0 auto;
  padding: 22px 26px 60px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  color: var(--ink);
}
.degree-eng-root * { box-sizing: border-box; }
.degree-eng-root button { font-family: inherit; cursor: pointer; }
.degree-eng-root .de-header { margin-bottom: 16px; }
.degree-eng-root .de-title { font-size: 23px; font-weight: 800; display: flex; align-items: center; gap: 8px; }
.degree-eng-root .de-title svg { width: 24px; height: 24px; color: var(--orange); }
.degree-eng-root .de-exam { color: var(--ink-soft); font-size: 13px; margin-top: 4px; }
.degree-eng-root .de-tabs { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 18px; border-bottom: 1px solid var(--border); padding-bottom: 10px; }
.degree-eng-root .de-tab {
  display: inline-flex; align-items: center; gap: 7px; padding: 9px 15px; border-radius: 11px;
  border: 1px solid var(--border); background: var(--surface); color: var(--ink-soft); font-weight: 700; font-size: 14px;
}
.degree-eng-root .de-tab svg { width: 17px; height: 17px; }
.degree-eng-root .de-tab.active { background: linear-gradient(135deg, var(--orange), var(--orange-2)); color: #fff; border-color: transparent; }
.degree-eng-root .page-head { margin-bottom: 14px; }
.degree-eng-root .page-title { font-size: 20px; font-weight: 800; margin: 0 0 4px; }
.degree-eng-root .page-sub { color: var(--ink-soft); font-size: 13.5px; margin: 0; }
.degree-eng-root .handle { display: flex; flex-wrap: wrap; gap: 12px; align-items: center; background: linear-gradient(135deg, #fff4e6, #fdead2); border: 1px solid var(--orange-soft); border-radius: var(--radius); padding: 14px 16px; margin-bottom: 8px; }
.degree-eng-root .h-item { display: flex; align-items: center; gap: 7px; background: var(--surface); border: 1px solid var(--border); border-radius: 999px; padding: 7px 14px; font-size: 13.5px; font-weight: 600; }
.degree-eng-root .h-item svg { width: 16px; height: 16px; color: var(--orange); }
.degree-eng-root .btn { display: inline-flex; align-items: center; gap: 7px; padding: 9px 16px; border-radius: 11px; font-weight: 700; font-size: 14px; background: var(--surface-2); color: var(--ink); border: 1px solid var(--border); transition: 0.15s; }
.degree-eng-root .btn:hover { background: var(--surface); }
.degree-eng-root .btn svg { width: 17px; height: 17px; }
.degree-eng-root .btn-primary { background: linear-gradient(135deg, var(--orange), var(--orange-2)); color: #fff; border: none; box-shadow: var(--shadow-sm); }
.degree-eng-root .btn-primary:hover { filter: brightness(1.04); }
.degree-eng-root .btn-ghost { background: transparent; }
.degree-eng-root .btn-sm { padding: 6px 11px; font-size: 13px; border-radius: 9px; }
.degree-eng-root .btn-block { width: 100%; justify-content: center; }
.degree-eng-root .card { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); padding: 18px; box-shadow: var(--shadow-sm); margin-top: 16px; }
.degree-eng-root .sec-title { font-size: 15.5px; font-weight: 800; margin: 0 0 12px; display: flex; align-items: center; gap: 8px; }
.degree-eng-root .sec-title svg { width: 18px; height: 18px; color: var(--orange); }
.degree-eng-root .muted { color: var(--ink-soft); font-size: 13px; }
.degree-eng-root .note { font-size: 12.5px; color: #b9791f; background: #fcf3e2; border: 1px solid #f6e4c0; border-radius: 10px; padding: 9px 12px; margin-top: 12px; display: flex; gap: 7px; align-items: flex-start; }
.degree-eng-root .note svg { width: 16px; height: 16px; flex: 0 0 16px; margin-top: 1px; }
.degree-eng-root .stat { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 14px 16px; }
.degree-eng-root .stat .label { font-size: 12.5px; color: var(--ink-soft); margin-bottom: 6px; }
.degree-eng-root .stat .num { font-size: 26px; font-weight: 800; color: var(--ink); line-height: 1.1; }
.degree-eng-root .stat .num small { font-size: 14px; font-weight: 600; color: var(--ink-soft); }
.degree-eng-root .stat.accent .num { color: var(--orange); }
.degree-eng-root .stat.green .num { color: var(--green); }
.degree-eng-root .stat.red .num { color: var(--red); }
.degree-eng-root .input { width: 100%; padding: 10px 12px; border: 1px solid var(--border); border-radius: 10px; background: var(--surface); outline: none; font-size: 14px; }
.degree-eng-root .input:focus { border-color: var(--orange); box-shadow: 0 0 0 3px var(--orange-soft); }
.degree-eng-root .row { display: flex; gap: 10px; flex-wrap: wrap; }
.degree-eng-root .wl-group { margin-bottom: 14px; }
.degree-eng-root .wl-letter { font-weight: 800; font-size: 15px; color: var(--orange); margin: 6px 0; border-bottom: 2px solid var(--orange-soft); display: inline-block; padding: 0 8px; }
.degree-eng-root .wl-item { display: flex; align-items: center; gap: 12px; padding: 11px 14px; border: 1px solid var(--border); border-radius: 12px; background: var(--surface); margin-bottom: 8px; }
.degree-eng-root .wl-main { flex: 1; min-width: 0; }
.degree-eng-root .wl-word { font-weight: 700; font-size: 15px; }
.degree-eng-root .wl-ph { color: var(--ink-soft); font-size: 13px; font-weight: 400; margin-left: 8px; }
.degree-eng-root .wl-def { font-size: 13px; color: var(--ink-soft); margin-top: 2px; }
.degree-eng-root .wl-tag { flex: 0 0 auto; }
.degree-eng-root .tag { display: inline-block; font-size: 11.5px; font-weight: 700; padding: 2px 9px; border-radius: 999px; background: var(--orange-soft); color: var(--orange); }
.degree-eng-root .tag.green { background: #e2f5ea; color: var(--green); }
.degree-eng-root .tag.red { background: #fbe3dd; color: var(--red); }
.degree-eng-root .tag.ink { background: #e7ecf5; color: var(--ink); }
.degree-eng-root .empty { text-align: center; color: var(--ink-soft); padding: 30px 10px; font-size: 14px; }
/* 对话/语法练习 */
.degree-eng-root .dlg-badge { display:inline-block; font-size:12px; font-weight:700; color:#fff; background:linear-gradient(135deg,var(--orange),var(--orange-2)); padding:3px 10px; border-radius:999px; margin-bottom:12px; }
.degree-eng-root .dlg-context { background:var(--surface-2); border:1px solid var(--border); border-radius:12px; padding:16px 18px; margin-bottom:14px; line-height:1.9; }
.degree-eng-root .dlg-line { padding:4px 0; }
.degree-eng-root .dlg-blank { font-weight:700; }
.degree-eng-root .blank-mark { display:inline-block; min-width:60px; border-bottom:2px solid var(--orange); color:var(--orange); text-align:center; margin:0 3px; }
.degree-eng-root .dlg-opts { display:flex; flex-direction:column; gap:8px; margin-bottom:14px; }
.degree-eng-root .dlg-opt { display:flex; align-items:center; gap:10px; padding:12px 14px; border:1.5px solid var(--border); border-radius:11px; background:var(--surface); cursor:pointer; transition:0.15s; text-align:left; font-size:14px; }
.degree-eng-root .dlg-opt:hover { border-color:var(--orange); background:var(--orange-soft); }
.degree-eng-root .dlg-opt.correct { border-color:var(--green); background:#e8f8ed; pointer-events:none; }
.degree-eng-root .dlg-opt.wrong { border-color:var(--red); background:#fef0ec; pointer-events:none; }
.degree-eng-root .dlg-opt.show-correct { border-color:var(--green); box-shadow:0 0 0 2px rgba(46,158,91,0.25); }
.degree-eng-root .dlg-opt-label { flex:0 0 28px; width:28px; height:28px; border-radius:50%; background:var(--surface-2); border:1.5px solid var(--border); display:flex; align-items:center; justify-content:center; font-size:12px; font-weight:800; }
.degree-eng-root .dlg-opt-text { flex:1; }
.degree-eng-root .dlg-exp { font-size:13px; line-height:1.6; color:var(--ink); background:#fffbeb; border:1px solid #f6e4c0; border-radius:10px; padding:10px 14px; margin-top:10px; display:flex; gap:7px; align-items:flex-start; }
.degree-eng-root .dlg-exp svg { flex:0 0 16px; margin-top:2px; color:var(--orange); }
.degree-eng-root .gram-q { font-size:16px; font-weight:600; padding:14px 0; line-height:1.7; }
.degree-eng-root .ph-list { margin: 10px 0; padding-left: 18px; color: var(--ink-soft); font-size: 13.5px; line-height: 1.8; }
.degree-eng-root .prep-state { text-align: center; color: var(--ink-soft); padding: 40px 10px; font-size: 14px; }
.degree-eng-root .prep-error { color: var(--red); }
/* 阅读理解 / 翻译写作 */
.degree-eng-root .rd-passage { background: var(--surface-2); border: 1px solid var(--border); border-radius: 12px; padding: 16px 18px; margin: 12px 0; line-height: 1.9; font-size: 14px; color: var(--ink); max-height: 340px; overflow-y: auto; -webkit-overflow-scrolling: touch; }
.degree-eng-root .rd-passage p { margin: 0 0 12px; }
.degree-eng-root .rd-passage p:last-child { margin-bottom: 0; }
.degree-eng-root .rd-qmeta { font-size: 12.5px; font-weight: 700; color: var(--orange); margin: 6px 0 10px; }
.degree-eng-root .tr-en { background: linear-gradient(135deg, #fff4e6, #fdead2); border: 1px solid var(--orange-soft); border-radius: 12px; padding: 18px 20px; font-size: 18px; line-height: 1.7; font-weight: 600; color: var(--ink); }
.degree-eng-root .tr-ref { background: #fffbeb; border: 1px solid #f6e4c0; border-radius: 10px; padding: 12px 14px; margin-top: 6px; font-size: 13.5px; line-height: 1.7; }
.degree-eng-root .tr-zh { margin-bottom: 8px; }
.degree-eng-root .tr-tips { color: var(--ink-soft); }
.degree-eng-root .wr-sec { margin-top: 14px; }
.degree-eng-root .wr-sec > b { font-size: 13.5px; color: var(--orange); }
.degree-eng-root .wr-sample { background: #0f172a; color: #e2e8f0; border-radius: 10px; padding: 14px 16px; font-size: 13px; line-height: 1.6; white-space: pre-wrap; word-break: break-word; overflow-x: auto; margin: 8px 0; font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
/* 专注背词遮罩 */
.degree-eng-root .focus { position: fixed; inset: 0; background: linear-gradient(160deg, #fff8ef, #fdebd6); z-index: 50; display: none; flex-direction: column; align-items: center; overflow-y: auto; -webkit-overflow-scrolling: touch; padding: 24px; }
.degree-eng-root .focus.show { display: flex; }
.degree-eng-root .focus-top { position: absolute; top: 18px; left: 0; right: 0; display: flex; justify-content: space-between; align-items: center; padding: 0 22px; }
.degree-eng-root .focus-progress { font-weight: 800; font-size: 16px; color: var(--ink); }
.degree-eng-root .focus-card { width: min(560px, 92vw); margin: auto; background: var(--surface); border-radius: 24px; box-shadow: var(--shadow); padding: 34px 30px; text-align: center; position: relative; min-height: 300px; display: flex; flex-direction: column; justify-content: center; }
.degree-eng-root .fc-word { font-size: 44px; font-weight: 900; color: var(--ink); letter-spacing: 0.5px; }
.degree-eng-root .fc-ph { font-size: 21px; color: var(--ink-soft); margin-top: 8px; }
.degree-eng-root .fc-speak { margin-top: 14px; display: inline-flex; align-items: center; gap: 7px; background: var(--surface-2); border: 1px solid var(--border); border-radius: 999px; padding: 8px 15px; font-weight: 700; font-size: 13.5px; color: var(--ink); }
.degree-eng-root .fc-speak svg { width: 17px; height: 17px; color: var(--orange); }
.degree-eng-root .fc-divider { height: 1px; background: var(--border-2); margin: 22px 0; }
.degree-eng-root .fc-pos { display: inline-block; font-size: 13px; font-weight: 700; color: var(--orange); background: var(--orange-soft); border-radius: 6px; padding: 2px 8px; margin-bottom: 10px; }
.degree-eng-root .fc-back { font-size: 19px; color: var(--ink); font-weight: 700; line-height: 1.5; }
.degree-eng-root .fc-actions { display: flex; gap: 14px; margin-top: 30px; }
.degree-eng-root .fc-btn { flex: 1; padding: 16px; border-radius: 16px; font-weight: 800; font-size: 17px; display: flex; align-items: center; justify-content: center; gap: 8px; border: none; }
.degree-eng-root .fc-btn svg { width: 20px; height: 20px; }
.degree-eng-root .fc-known { background: var(--green); color: #fff; }
.degree-eng-root .fc-unknown { background: #fff0ec; color: var(--red); border: 1.5px solid #f3c4b8; }
.degree-eng-root .fc-kind { position: absolute; top: 14px; left: 16px; font-size: 12px; font-weight: 700; color: var(--ink-soft); }
.degree-eng-root .fc-kind.review { color: var(--orange); }
.degree-eng-root .focus-done { text-align: center; }
.degree-eng-root .focus-done h2 { font-size: 28px; margin: 0 0 8px; color: var(--green); }
.degree-eng-root .focus-done p { color: var(--ink-soft); margin: 0 0 20px; }
@media (max-width: 768px) {
  .degree-eng-root { padding: 16px 14px 92px; }
  .degree-eng-root .g4 { grid-template-columns: repeat(2, 1fr) !important; }
  .degree-eng-root .fc-word { font-size: 36px; }
  .degree-eng-root .fc-actions { flex-direction: column; gap: 10px; }
  .degree-eng-root .focus { padding: 60px 14px calc(16px + env(safe-area-inset-bottom)); }
  .degree-eng-root .focus-card { min-height: 0; padding: 22px 16px; }
  .degree-eng-root .fc-btn { padding: 14px; font-size: 16px; }
  .degree-eng-root .tr-en { font-size: 16px; padding: 14px 16px; }
}
</style>
