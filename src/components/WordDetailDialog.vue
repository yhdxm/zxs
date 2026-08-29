<template>
  <el-dialog
    v-model="visible"
    :title="''"
    :show-close="false"
    class="wd-dialog"
    :class="{ 'wd--mobile': isMobile }"
    width="540px"
    top="6vh"
  >
    <!-- ===== 头部：单词 + 音标 + 朗读 ===== -->
    <div class="wd-head">
      <button class="wd-close" type="button" aria-label="关闭" @click="close">✕</button>
      <div v-if="moduleLabel" class="wd-from">{{ moduleLabel }}</div>

      <div class="wd-title-row">
        <span class="wd-word">{{ word }}</span>
        <span class="wd-emoji" :title="'点击更换象形图标'" @click="pickEmoji">{{ emoji }}</span>
      </div>

      <div class="wd-ph-row">
        <span class="wd-ph">
          <span class="wd-ph-lb">美</span>
          <span class="wd-ph-vv">{{ data.phoneticUS || data.phonetic || '—' }}</span>
          <button class="wd-spk" type="button" title="美式朗读" @click="speak('en-US')">🔊</button>
        </span>
        <span class="wd-ph">
          <span class="wd-ph-lb">英</span>
          <span class="wd-ph-vv">{{ data.phoneticUK || data.phonetic || '—' }}</span>
          <button class="wd-spk" type="button" title="英式朗读" @click="speak('en-GB')">🔊</button>
        </span>
      </div>
    </div>

    <!-- ===== 主体：分区卡片 ===== -->
    <div class="wd-body">
      <div v-if="loading" class="wd-loading">正在获取例句与英文释义…</div>

      <!-- 释义 -->
      <section class="wd-card">
        <div class="wd-card-hd">
          <span class="wd-bar" style="background:var(--wd-primary)"></span>
          <span class="wd-card-t">释义</span>
        </div>
        <div class="wd-mean">
          <span v-if="pos" class="wd-pos">{{ pos }}</span>
          <span>{{ definition || '（词库暂未提供释义）' }}</span>
        </div>
      </section>

      <!-- 助记 -->
      <section class="wd-card wd-card--amber">
        <div class="wd-card-hd">
          <span class="wd-bar" style="background:var(--wd-amber)"></span>
          <span class="wd-card-t">助记</span>
        </div>
        <div class="wd-mnc">
          <template v-if="data.mnemonicReal">
            {{ data.mnemonic }}
          </template>
          <template v-else>
            <span class="wd-ph-placeholder">*助记正在赶来的路上</span>
            <button class="wd-gen" type="button" @click="regenMnemonic">换一种记法</button>
          </template>
        </div>
      </section>

      <!-- 例句 -->
      <section class="wd-card wd-card--blue">
        <div class="wd-card-hd">
          <span class="wd-bar" style="background:var(--wd-blue)"></span>
          <span class="wd-card-t">例句</span>
        </div>
        <div v-if="data.example" class="wd-ex">
          <div class="wd-ex-en">{{ data.example }}</div>
          <div v-if="data.exampleZh" class="wd-ex-zh">{{ data.exampleZh }}</div>
          <div v-else class="wd-ex-zh wd-ex-zh--muted">（翻译获取中或不可用）</div>
          <div class="wd-ex-bar">
            <button type="button" @click="speakExample(0.95)">🔊 朗读</button>
            <button type="button" @click="speakExample(0.6)">🐢 慢速</button>
          </div>
        </div>
        <div v-else class="wd-empty">该词暂无例句，先记住释义即可。</div>
      </section>

      <!-- 配图 -->
      <section class="wd-card wd-card--teal">
        <div class="wd-card-hd">
          <span class="wd-bar" style="background:var(--wd-teal)"></span>
          <span class="wd-card-t">配图</span>
        </div>
        <div class="wd-pic">
          <div class="wd-pic-em">{{ emoji }}</div>
          <div class="wd-pic-tx">
            离线象形符号，不耗流量<br />
            <span class="wd-pic-sub">点击上方图标可自定义</span>
          </div>
        </div>
      </section>

      <!-- 标签：英文释义 / 形近词 -->
      <section class="wd-card">
        <div class="wd-tabs">
          <button :class="{ on: tab === 'en' }" type="button" @click="tab = 'en'">英文释义</button>
          <button :class="{ on: tab === 'sim' }" type="button" @click="tab = 'sim'">形近词</button>
        </div>
        <div v-if="tab === 'en'" class="wd-pane">
          <ol v-if="data.enDefs.length">
            <li v-for="(d, i) in data.enDefs" :key="i">{{ d }}</li>
          </ol>
          <div v-else class="wd-empty">暂无英文释义（多为生僻词或接口未收录）。</div>
        </div>
        <div v-else class="wd-pane">
          <div v-if="data.similar.length" class="wd-sim">
            <span v-for="s in data.similar" :key="s">{{ s }}</span>
          </div>
          <div v-else class="wd-empty">词表中未找到形近词。</div>
        </div>
      </section>
    </div>

    <!-- ===== 底部操作 ===== -->
    <div class="wd-foot">
      <button type="button" @click="emit('addWordBook', word)">加入生词本</button>
      <button type="button" class="wd-pri" @click="emit('mastered', word)">标记已掌握</button>
    </div>
  </el-dialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ElDialog, ElMessage } from 'element-plus'
import { getEmoji, setEmojiOverride } from '../data/emojiDict'
import { getWordEnrich, type WordEnrichData } from '../services/wordEnrichService'
import { speakEn } from '../prep/degreeSpeech'

const props = defineProps<{
  modelValue: boolean
  word: string
  /** 本地词库音标（有则优先展示） */
  phonetic?: string
  pos?: string
  definition?: string
  /** 形近词候选池（当前模块词表） */
  pool?: string[]
  /** 来源模块名，显示在头部 */
  moduleLabel?: string
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', v: boolean): void
  (e: 'addWordBook', word: string): void
  (e: 'mastered', word: string): void
}>()

const visible = computed({
  get: () => props.modelValue,
  set: (v: boolean) => emit('update:modelValue', v)
})

const isMobile = ref(false)
if (typeof window !== 'undefined') {
  isMobile.value = window.innerWidth <= 768
  window.addEventListener('resize', () => {
    isMobile.value = window.innerWidth <= 768
  })
}

const loading = ref(false)
const tab = ref<'en' | 'sim'>('en')
const data = ref<WordEnrichData>({
  word: '',
  phonetic: '',
  phoneticUS: '',
  phoneticUK: '',
  enDefs: [],
  example: '',
  exampleZh: '',
  similar: [],
  mnemonic: '',
  mnemonicReal: false,
  emoji: '🔤'
})
const emoji = computed(() => data.value.emoji || getEmoji(props.word))

function close() {
  emit('update:modelValue', false)
}

async function load() {
  if (!props.word) return
  loading.value = true
  tab.value = 'en'
  data.value = await getWordEnrich(props.word, {
    localPhonetic: props.phonetic || '',
    pool: props.pool || []
  })
  loading.value = false
}

watch(
  () => [props.modelValue, props.word],
  () => {
    if (props.modelValue) void load()
  },
  { immediate: true }
)

/* ===== 朗读：统一走 speakEn 双通道（国产浏览器自动降级在线发音） ===== */
function speak(accent: 'en-US' | 'en-GB') {
  speakEn(props.word, 0.9, accent)
}
function speakExample(rate: number) {
  if (!data.value.example) return
  speakEn(data.value.example, rate, 'en-US')
}

/* ===== 象形图标自定义 ===== */
function pickEmoji() {
  const input = window.prompt(`为「${props.word}」设置一个象形 emoji`, emoji.value)
  if (input === null) return
  const v = input.trim()
  if (!v) return
  setEmojiOverride(props.word, v)
  data.value.emoji = v
}

/* ===== 助记：占位时点「换一种记法」重新尝试（规则基于本地词库，离线） ===== */
function regenMnemonic() {
  ElMessage.info('本词暂无可拆分的常见词缀，可先结合例句记忆。')
}
</script>

<style scoped>
.wd-dialog :deep(.el-dialog__header) {
  display: none;
}
.wd-dialog :deep(.el-dialog__body) {
  padding: 0;
  max-height: 76vh;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
}

/* ===== 头部 ===== */
.wd-head {
  position: relative;
  padding: 20px 20px 16px;
  background: linear-gradient(135deg, #eef2ff 0%, #e0f2fe 100%);
  border-bottom: 1px solid var(--wd-line);
}
.wd-close {
  position: absolute;
  top: 12px;
  right: 12px;
  width: 30px;
  height: 30px;
  border: none;
  background: rgba(255, 255, 255, 0.8);
  border-radius: 9px;
  color: #64748b;
  cursor: pointer;
  font-size: 14px;
}
.wd-from {
  font-size: 11.5px;
  color: #64748b;
  font-weight: 600;
  margin-bottom: 8px;
}
.wd-title-row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 12px;
}
.wd-word {
  font-size: 28px;
  font-weight: 800;
  letter-spacing: -0.4px;
  color: #0f172a;
  word-break: break-word;
}
.wd-emoji {
  font-size: 26px;
  cursor: pointer;
  line-height: 1;
}
.wd-ph-row {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
.wd-ph {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: #fff;
  border: 1px solid var(--wd-line);
  border-radius: 9px;
  padding: 5px 9px;
}
.wd-ph-lb {
  font-size: 10.5px;
  font-weight: 800;
  color: #94a3b8;
}
.wd-ph-vv {
  font-family: 'SF Mono', Consolas, monospace;
  font-size: 12.5px;
  color: #1e293b;
}
.wd-spk {
  width: 24px;
  height: 24px;
  border: none;
  background: #eef2ff;
  color: var(--wd-primary);
  border-radius: 7px;
  font-size: 11px;
  cursor: pointer;
  min-width: 24px;
}

/* ===== 主体分区 ===== */
.wd-body {
  padding: 16px 18px 4px;
  background: #f8fafc;
}
.wd-loading {
  font-size: 12.5px;
  color: #64748b;
  padding: 2px 0 12px;
}

.wd-card {
  background: #fff;
  border: 1px solid var(--wd-line);
  border-radius: 13px;
  padding: 13px 14px;
  margin-bottom: 13px;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
}
.wd-card--amber {
  background: #fffbeb;
  border-color: #fde68a;
}
.wd-card--blue {
  background: #f0f9ff;
  border-color: #bae6fd;
}
.wd-card--teal {
  background: #f0fdfa;
  border-color: #99f6e4;
}
.wd-card-hd {
  display: flex;
  align-items: center;
  gap: 7px;
  margin-bottom: 9px;
}
.wd-bar {
  width: 3px;
  height: 13px;
  border-radius: 2px;
  display: inline-block;
}
.wd-card-t {
  font-size: 12px;
  font-weight: 800;
  color: #334155;
  letter-spacing: 0.3px;
}

.wd-mean {
  font-size: 15px;
  line-height: 1.7;
  color: #0f172a;
}
.wd-pos {
  color: #7c3aed;
  font-weight: 700;
  margin-right: 7px;
}

.wd-mnc {
  font-size: 13px;
  line-height: 1.75;
  color: #78350f;
}
.wd-ph-placeholder {
  color: #b45309;
}
.wd-gen {
  margin-left: 8px;
  font-size: 11.5px;
  background: #fff;
  border: 1px solid #fcd34d;
  color: #b45309;
  border-radius: 7px;
  padding: 4px 10px;
  cursor: pointer;
  min-height: 30px;
}

.wd-ex-en {
  font-size: 13.5px;
  line-height: 1.7;
  color: #0f172a;
}
.wd-ex-zh {
  font-size: 12.5px;
  color: #64748b;
  line-height: 1.65;
  margin-top: 5px;
}
.wd-ex-zh--muted {
  color: #94a3b8;
}
.wd-ex-bar {
  display: flex;
  gap: 8px;
  margin-top: 10px;
}
.wd-ex-bar button {
  border: 1px solid #bae6fd;
  background: #fff;
  border-radius: 8px;
  padding: 6px 12px;
  font-size: 12px;
  cursor: pointer;
  color: #0369a1;
  font-weight: 600;
  min-height: 32px;
}

.wd-pic {
  display: flex;
  align-items: center;
  gap: 15px;
}
.wd-pic-em {
  font-size: 44px;
  line-height: 1;
}
.wd-pic-tx {
  font-size: 12px;
  color: #0f766e;
  line-height: 1.65;
}
.wd-pic-sub {
  color: #94a3b8;
}

.wd-tabs {
  display: flex;
  gap: 4px;
  background: #f1f5f9;
  border-radius: 10px;
  padding: 3px;
  margin-bottom: 11px;
}
.wd-tabs button {
  flex: 1;
  border: none;
  background: transparent;
  padding: 8px;
  border-radius: 8px;
  font-size: 12.5px;
  color: #64748b;
  cursor: pointer;
  font-weight: 700;
  min-height: 36px;
}
.wd-tabs button.on {
  background: #fff;
  color: #0f172a;
  box-shadow: 0 1px 3px rgba(15, 23, 42, 0.09);
}
.wd-pane {
  font-size: 13px;
  line-height: 1.75;
  color: #475569;
  min-height: 70px;
}
.wd-pane ol {
  margin: 0;
  padding-left: 18px;
}
.wd-pane li {
  margin-bottom: 6px;
}
.wd-sim {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.wd-sim span {
  background: #f8fafc;
  border: 1px solid var(--wd-line);
  border-radius: 8px;
  padding: 6px 11px;
  font-size: 12.5px;
  font-weight: 600;
  color: #334155;
}
.wd-empty {
  font-size: 12.5px;
  color: #94a3b8;
  line-height: 1.7;
}

/* ===== 底部 ===== */
.wd-foot {
  display: flex;
  gap: 10px;
  padding: 12px 18px calc(12px + env(safe-area-inset-bottom, 0px));
  border-top: 1px solid var(--wd-line);
  background: #fff;
}
.wd-foot button {
  flex: 1;
  border: 1px solid var(--wd-line);
  background: #fff;
  padding: 10px;
  border-radius: 10px;
  font-size: 13px;
  cursor: pointer;
  color: #334155;
  font-weight: 700;
  min-height: 42px;
}
.wd-foot button.wd-pri {
  background: var(--wd-primary);
  border-color: var(--wd-primary);
  color: #fff;
}

/* ===== 移动端：底部全宽抽屉 ===== */
@media (max-width: 768px) {
  .wd-word {
    font-size: 24px;
  }
  .wd-emoji {
    font-size: 23px;
  }
  .wd-body {
    padding: 14px 14px 4px;
  }
  .wd-foot {
    position: sticky;
    bottom: 0;
  }
}
</style>

<style>
/* 组件级 CSS 变量（scoped 外定义，供模板与 scoped 样式共用） */
:root {
  --wd-primary: #5b6cff;
  --wd-amber: #f59e0b;
  --wd-blue: #0ea5e9;
  --wd-teal: #14b8a6;
  --wd-line: #e2e8f0;
}

/* 移动端底部全宽抽屉。
   注意：Element Plus 把自定义 class 合并到 .el-dialog 元素自身（不是它的子元素），
   所以必须在这里用全局样式直接命中 .wd-dialog —— scoped 里写
   .wd-dialog :deep(.el-dialog) 是找自己的后代，永远匹配不到。 */
@media (max-width: 768px) {
  .wd-dialog {
    width: 100% !important;
    max-width: 100% !important;
    margin: 0 !important;
    position: fixed !important;
    left: 0;
    right: 0;
    bottom: 0;
    top: auto !important;
    border-radius: 18px 18px 0 0;
    max-height: 90vh;
    display: flex;
    flex-direction: column;
  }
  .wd-dialog .el-dialog__body {
    max-height: none;
    flex: 1;
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
  }
}
</style>
