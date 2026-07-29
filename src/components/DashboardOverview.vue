<template>
  <div class="overview">
    <!-- Hero -->
    <section class="hero reveal">
      <div class="hero-bg" aria-hidden="true">
        <span class="blob blob-1"></span>
        <span class="blob blob-2"></span>
        <span class="blob blob-3"></span>
        <span class="grid-overlay"></span>
      </div>

      <div class="hero-inner">
        <div class="hero-copy">
          <span class="eyebrow"><span class="dot"></span>SMART DASHBOARD · 智能工作台</span>
          <h1 class="hero-title">
            让每天的<span class="grad">待办、点位与内容</span><br />
            一处掌控，云端同步
          </h1>
          <p class="hero-sub">
            集待办管理、点位巡查、内容记录与 AI 助手于一体。一次登录，多端实时同步，
            从 PC 到手机，工作流从未如此顺手。
          </p>
          <div class="hero-actions">
            <el-button type="primary" size="large" round class="cta-primary" @click="go('/dashboard?view=workbench')">
              进入工作台
              <el-icon class="cta-arrow"><ArrowRight /></el-icon>
            </el-button>
            <el-button size="large" round plain class="cta-ghost" @click="go('/ai')">
              体验 AI 助手
            </el-button>
          </div>
          <div class="hero-trust">
            <span class="trust-item"><Check /> 数据云端持久化</span>
            <span class="trust-item"><Check /> PC / 手机实时同步</span>
            <span class="trust-item"><Check /> 密钥本地加密</span>
          </div>
        </div>

        <!-- 玻璃拟态应用预览 + 炫酷 AI 入口 -->
        <div class="hero-preview reveal" data-delay="120">
          <div class="preview-glass">
            <div class="preview-head">
              <span class="preview-dot r"></span>
              <span class="preview-dot y"></span>
              <span class="preview-dot g"></span>
              <span class="preview-title">工作台 · 概览</span>
            </div>
            <div class="preview-stats">
              <div class="pstat"><b>{{ liveCounts.todos }}</b><span>待办</span></div>
              <div class="pstat"><b>{{ liveCounts.points }}</b><span>点位</span></div>
              <div class="pstat"><b>{{ liveCounts.contents }}</b><span>内容</span></div>
            </div>

            <button class="ai-entry" type="button" @click="go('/ai')">
              <span class="ai-entry-glow" aria-hidden="true"></span>
              <span class="ai-entry-inner">
                <span class="ai-entry-icon"><el-icon><MagicStick /></el-icon></span>
                <span class="ai-entry-copy">
                  <strong>AI 助手</strong>
                  <small>多模型接入 · 配置一次长期使用</small>
                </span>
                <el-icon class="ai-entry-arrow"><ArrowRight /></el-icon>
              </span>
            </button>

            <div class="preview-lines">
              <div class="pline done"></div>
              <div class="pline"></div>
              <div class="pline short"></div>
              <div class="pline done short"></div>
            </div>
            <div class="preview-chip">AI 助手已就绪 · 结构化回答带总结</div>
          </div>
        </div>
      </div>
    </section>

    <!-- 数据指标条 -->
    <section class="metrics reveal">
      <div class="metric" v-for="m in metrics" :key="m.label">
        <div class="metric-num">{{ m.value }}</div>
        <div class="metric-label">{{ m.label }}</div>
      </div>
    </section>

    <!-- 功能亮点 Bento -->
    <section class="section">
      <div class="section-head reveal">
        <span class="section-eyebrow">核心能力</span>
        <h2>一个工作台，覆盖日常全部场景</h2>
        <p>模块化设计，每个功能都经过打磨，开箱即用。</p>
      </div>

      <div class="bento">
        <article class="bento-card span-2 reveal" @click="go('/dashboard?view=workbench')">
          <div class="bc-icon indigo"><Tickets /></div>
          <h3>待办与点位管理</h3>
          <p>待办事项、点位信息、处理内容三大模块，支持搜索、筛选、分页、批量操作与一键导出 CSV / JSON。</p>
          <span class="bc-link">进入工作台 →</span>
        </article>

        <article class="bento-card glow-card reveal" data-delay="80" @click="go('/ai')">
          <div class="bc-icon violet"><MagicStick /></div>
          <h3>AI 助手</h3>
          <p>多服务商接入，模型下拉即选，配置一次长期保存，密钥密文隐藏。结构化回答并自动给出「总结」。</p>
          <span class="bc-link">立即体验 →</span>
        </article>

        <article class="bento-card reveal" data-delay="120" @click="go('/dashboard?view=workbench')">
          <div class="bc-icon cyan"><Cloudy /></div>
          <h3>云端实时同步</h3>
          <p>任意一端增删改，PC 与手机通过实时订阅自动刷新，数据始终一致。</p>
          <span class="bc-link">查看同步 →</span>
        </article>

        <article class="bento-card reveal" data-delay="160" @click="go('/dashboard?view=workbench')">
          <div class="bc-icon amber"><Cellphone /></div>
          <h3>多端自适应</h3>
          <p>PC 侧边栏、移动端抽屉菜单，任意屏幕都流畅好用。</p>
          <span class="bc-link">查看适配 →</span>
        </article>

        <article class="bento-card span-2 reveal" data-delay="200">
          <div class="bc-icon green"><Lock /></div>
          <h3>安全与隐私</h3>
          <p>密码本地哈希处理，API Key 仅以混淆形式存于本机，敏感信息永不回传服务器。你的数据，只属于你。</p>
        </article>
      </div>
    </section>

    <!-- 使用场景 -->
    <section class="section">
      <div class="section-head reveal">
        <span class="section-eyebrow">适用场景</span>
        <h2>无论在哪，工作都能继续</h2>
      </div>
      <div class="scenarios">
        <div class="scenario reveal" v-for="(s, i) in scenarios" :key="s.title" :data-delay="i * 80">
          <div class="scenario-no">0{{ i + 1 }}</div>
          <h4>{{ s.title }}</h4>
          <p>{{ s.desc }}</p>
        </div>
      </div>
    </section>

    <!-- 底部 CTA -->
    <section class="cta-band reveal">
      <div class="cta-band-inner">
        <h2>现在就开始，把工作装进一个工作台</h2>
        <p>注册登录后数据写入云端，多端实时同步。</p>
        <div class="cta-band-actions">
          <el-button type="primary" size="large" round @click="go('/dashboard?view=workbench')">进入工作台</el-button>
          <el-button size="large" round plain @click="go('/ai')">打开 AI 助手</el-button>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import {
  ArrowRight, Check, Tickets, MagicStick, Cloudy, Cellphone, Lock
} from '@element-plus/icons-vue'
import { getSavedUser, loadDashboardData } from '../services/appDataService'

const router = useRouter()
const go = (path: string) => router.push(path)

const liveCounts = { todos: 0, points: 0, contents: 0 }
// 概览页也实时反映最新数据量（跨端同步后自动更新）
onMounted(async () => {
  const user = await getSavedUser()
  if (user) {
    const data = await loadDashboardData(user.id)
    liveCounts.todos = data.todos.length
    liveCounts.points = data.points.length
    liveCounts.contents = data.contents.length
  }
})

const metrics = [
  { value: '∞', label: '条数据云端持久化' },
  { value: '3', label: '大核心工作模块' },
  { value: 'PC+', label: '移动端自适应' },
  { value: '1', label: '次配置长期使用' }
]

const scenarios = [
  { title: '现场巡查', desc: '手机记录点位与备注，回到办公室 PC 端继续编辑，数据实时同步。' },
  { title: '内容运营', desc: '把每日处理内容结构化沉淀，支持文本/图片/CSV 批量导入。' },
  { title: '个人效率', desc: '待办勾选、筛选、导出，让每天的进度一目了然。' }
]

// 滚动入场动画：仅用 opacity / transform，尊重 prefers-reduced-motion
let observer: IntersectionObserver | null = null

onMounted(() => {
  const els = document.querySelectorAll<HTMLElement>('.overview .reveal')
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  if (reduce || !('IntersectionObserver' in window)) {
    els.forEach((el) => el.classList.add('in-view'))
    return
  }
  observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const el = entry.target as HTMLElement
          const delay = Number(el.dataset.delay || 0)
          window.setTimeout(() => el.classList.add('in-view'), delay)
          observer?.unobserve(el)
        }
      })
    },
    { threshold: 0.12 }
  )
  els.forEach((el) => observer?.observe(el))
})

onBeforeUnmount(() => observer?.disconnect())
</script>

<style scoped>
.overview {
  font-family: 'Inter', system-ui, -apple-system, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif;
  color: #0f172a;
  background: #f7f8fb;
}

/* ===== Hero ===== */
.hero {
  position: relative;
  overflow: hidden;
  padding: 56px 32px 44px;
  max-width: 1240px;
  margin: 0 auto;
}
.hero-bg {
  position: absolute;
  inset: 0;
  z-index: 0;
  pointer-events: none;
}
.blob {
  position: absolute;
  width: 380px;
  height: 380px;
  border-radius: 50%;
  filter: blur(80px);
  opacity: 0.5;
}
.blob-1 { top: -80px; right: 8%; background: radial-gradient(circle, #6366f1, transparent 70%); }
.blob-2 { bottom: -120px; left: -40px; background: radial-gradient(circle, #22d3ee, transparent 70%); }
.blob-3 { top: 40%; left: 45%; width: 280px; height: 280px; background: radial-gradient(circle, #a855f7, transparent 70%); opacity: 0.35; }
.grid-overlay {
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(rgba(15, 23, 42, 0.035) 1px, transparent 1px),
    linear-gradient(90deg, rgba(15, 23, 42, 0.035) 1px, transparent 1px);
  background-size: 44px 44px;
  mask-image: radial-gradient(ellipse at top, #000 30%, transparent 75%);
  -webkit-mask-image: radial-gradient(ellipse at top, #000 30%, transparent 75%);
}
.hero-inner {
  position: relative;
  z-index: 1;
  display: grid;
  grid-template-columns: 1.15fr 0.85fr;
  gap: 40px;
  align-items: center;
}
.eyebrow {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.18em;
  color: #4f46e5;
  background: rgba(79, 70, 229, 0.08);
  padding: 6px 12px;
  border-radius: 999px;
}
.dot {
  width: 7px; height: 7px; border-radius: 50%;
  background: #4f46e5;
  box-shadow: 0 0 0 4px rgba(79, 70, 229, 0.18);
  animation: pulse 2.4s ease-in-out infinite;
}
@keyframes pulse {
  0%, 100% { transform: scale(1); opacity: 1; }
  50% { transform: scale(1.4); opacity: 0.6; }
}
.hero-title {
  margin: 18px 0 14px;
  font-size: 42px;
  line-height: 1.15;
  font-weight: 800;
  letter-spacing: -0.02em;
}
.grad {
  background: linear-gradient(120deg, #4f46e5, #06b6d4);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
}
.hero-sub {
  margin: 0 0 26px;
  font-size: 16px;
  line-height: 1.8;
  color: #475569;
  max-width: 520px;
}
.hero-actions { display: flex; gap: 12px; flex-wrap: wrap; }
.cta-primary {
  background: linear-gradient(120deg, #4f46e5, #6366f1);
  border: none;
  box-shadow: 0 10px 24px rgba(79, 70, 229, 0.28);
  transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.2s;
}
.cta-primary:hover { transform: translateY(-2px); box-shadow: 0 14px 30px rgba(79, 70, 229, 0.34); }
.cta-arrow { margin-left: 4px; transition: transform 0.2s; }
.cta-primary:hover .cta-arrow { transform: translateX(3px); }
.cta-ghost { transition: transform 0.2s; }
.cta-ghost:hover { transform: translateY(-2px); }
.hero-trust { display: flex; gap: 16px; margin-top: 24px; flex-wrap: wrap; }
.trust-item { display: inline-flex; align-items: center; gap: 6px; font-size: 13px; color: #64748b; }
.trust-item :deep(svg) { color: #10b981; }

/* 预览卡 */
.hero-preview { display: flex; justify-content: center; }
.preview-glass {
  width: 100%;
  max-width: 360px;
  background: rgba(255, 255, 255, 0.75);
  backdrop-filter: blur(20px) saturate(180%);
  -webkit-backdrop-filter: blur(20px) saturate(180%);
  border: 1px solid rgba(255, 255, 255, 0.6);
  border-radius: 22px;
  padding: 18px;
  box-shadow: 0 24px 60px rgba(15, 23, 42, 0.16);
  transform: perspective(1000px) rotateY(-8deg) rotateX(3deg);
  transition: transform 0.5s cubic-bezier(0.16, 1, 0.3, 1);
}
.preview-glass:hover { transform: perspective(1000px) rotateY(0) rotateX(0); }
.preview-head { display: flex; align-items: center; gap: 6px; padding-bottom: 14px; border-bottom: 1px solid rgba(15, 23, 42, 0.06); }
.preview-dot { width: 10px; height: 10px; border-radius: 50%; }
.preview-dot.r { background: #ff5f57; }
.preview-dot.y { background: #febc2e; }
.preview-dot.g { background: #28c840; }
.preview-title { margin-left: 8px; font-size: 13px; font-weight: 600; color: #334155; }
.preview-stats { display: flex; gap: 10px; margin: 16px 0; }
.pstat { flex: 1; background: rgba(79, 70, 229, 0.06); border-radius: 12px; padding: 12px; text-align: center; }
.pstat b { display: block; font-size: 22px; color: #4f46e5; }
.pstat span { font-size: 12px; color: #64748b; }
.preview-lines { display: flex; flex-direction: column; gap: 9px; margin: 14px 0; }
.pline { height: 10px; border-radius: 6px; background: #e2e8f0; }
.pline.short { width: 65%; }
.pline.done { background: linear-gradient(90deg, #4f46e5, #818cf8); }
.preview-chip { margin-top: 6px; font-size: 12px; color: #4f46e5; background: rgba(79, 70, 229, 0.1); border-radius: 999px; padding: 7px 12px; text-align: center; }

/* 炫酷发光 AI 入口卡片 */
.ai-entry {
  position: relative;
  display: block;
  width: 100%;
  margin: 14px 0;
  padding: 0;
  border: none;
  background: transparent;
  border-radius: 16px;
  cursor: pointer;
  overflow: hidden;
  isolation: isolate;
}
.ai-entry-glow {
  position: absolute;
  inset: -2px;
  border-radius: 18px;
  padding: 2px;
  background: conic-gradient(from 0deg, #4f46e5, #06b6d4, #a855f7, #4f46e5);
  filter: blur(6px);
  opacity: 0.85;
  z-index: -1;
  animation: spin 5s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }
.ai-entry-inner {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  border-radius: 16px;
  background: linear-gradient(120deg, rgba(79, 70, 229, 0.92), rgba(168, 85, 247, 0.92));
  color: #fff;
  box-shadow: 0 12px 30px rgba(79, 70, 229, 0.35);
  transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.3s;
}
.ai-entry:hover .ai-entry-inner { transform: translateY(-3px) scale(1.015); box-shadow: 0 18px 42px rgba(79, 70, 229, 0.5); }
.ai-entry-icon { width: 42px; height: 42px; border-radius: 12px; display: grid; place-items: center; background: rgba(255, 255, 255, 0.18); flex-shrink: 0; }
.ai-entry-icon :deep(svg) { font-size: 22px; }
.ai-entry-copy { flex: 1; text-align: left; }
.ai-entry-copy strong { display: block; font-size: 16px; font-weight: 700; }
.ai-entry-copy small { display: block; font-size: 12px; opacity: 0.85; margin-top: 2px; }
.ai-entry-arrow { font-size: 20px; transition: transform 0.3s; }
.ai-entry:hover .ai-entry-arrow { transform: translateX(4px); }

/* 指标条 */
.metrics { max-width: 1240px; margin: 8px auto 0; padding: 0 32px; display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; }
.metric {
  background: #fff;
  border: 1px solid #eef0f4;
  border-radius: 16px;
  padding: 22px 18px;
  text-align: center;
  box-shadow: 0 6px 18px rgba(15, 23, 42, 0.04);
  transition: transform 0.25s, box-shadow 0.25s;
}
.metric:hover { transform: translateY(-3px); box-shadow: 0 14px 30px rgba(15, 23, 42, 0.08); }
.metric-num {
  font-size: 30px; font-weight: 800;
  background: linear-gradient(120deg, #4f46e5, #06b6d4);
  -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent;
}
.metric-label { margin-top: 6px; font-size: 13px; color: #64748b; }

/* 通用 section */
.section { max-width: 1240px; margin: 0 auto; padding: 56px 32px; }
.section-head { text-align: center; margin-bottom: 36px; }
.section-eyebrow { font-size: 12px; font-weight: 600; letter-spacing: 0.18em; color: #06b6d4; text-transform: uppercase; }
.section-head h2 { margin: 10px 0 8px; font-size: 30px; font-weight: 800; letter-spacing: -0.02em; }
.section-head p { margin: 0; color: #64748b; }

/* Bento */
.bento { display: grid; grid-template-columns: repeat(3, 1fr); gap: 18px; }
.bento-card {
  background: #fff;
  border: 1px solid #eef0f4;
  border-radius: 20px;
  padding: 26px;
  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.05);
  transition: transform 0.25s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.25s;
  cursor: pointer;
}
.bento-card:hover { transform: translateY(-4px); box-shadow: 0 18px 40px rgba(15, 23, 42, 0.1); }
.bento-card.span-2 { grid-column: span 2; }
.glow-card { background: linear-gradient(135deg, rgba(139, 92, 246, 0.06), rgba(6, 182, 212, 0.06)); border-color: rgba(139, 92, 246, 0.2); }
.glow-card:hover { box-shadow: 0 18px 44px rgba(139, 92, 246, 0.22); }
.bc-icon { width: 46px; height: 46px; border-radius: 13px; display: grid; place-items: center; margin-bottom: 14px; color: #fff; }
.bc-icon :deep(svg) { width: 22px; height: 22px; }
.bc-icon.indigo { background: linear-gradient(135deg, #4f46e5, #6366f1); }
.bc-icon.violet { background: linear-gradient(135deg, #8b5cf6, #a855f7); }
.bc-icon.cyan { background: linear-gradient(135deg, #06b6d4, #0ea5e9); }
.bc-icon.amber { background: linear-gradient(135deg, #f59e0b, #f97316); }
.bc-icon.green { background: linear-gradient(135deg, #10b981, #14b8a6); }
.bento-card h3 { margin: 0 0 8px; font-size: 18px; }
.bento-card p { margin: 0; color: #64748b; font-size: 14px; line-height: 1.7; }
.bc-link { display: inline-block; margin-top: 14px; font-size: 14px; font-weight: 600; color: #4f46e5; }

/* 场景 */
.scenarios { display: grid; grid-template-columns: repeat(3, 1fr); gap: 18px; }
.scenario { background: #fff; border: 1px solid #eef0f4; border-radius: 18px; padding: 24px; transition: transform 0.25s, box-shadow 0.25s; }
.scenario:hover { transform: translateY(-3px); box-shadow: 0 14px 32px rgba(15, 23, 42, 0.08); }
.scenario-no { font-size: 26px; font-weight: 800; color: #4f46e5; opacity: 0.18; }
.scenario h4 { margin: 6px 0 8px; font-size: 17px; }
.scenario p { margin: 0; color: #64748b; font-size: 14px; line-height: 1.7; }

/* CTA 横幅 */
.cta-band { max-width: 1240px; margin: 0 auto 56px; padding: 0 32px; }
.cta-band-inner { background: linear-gradient(120deg, #312e81, #4f46e5 55%, #06b6d4); border-radius: 28px; padding: 48px 32px; text-align: center; color: #fff; }
.cta-band-inner h2 { margin: 0 0 10px; font-size: 28px; font-weight: 800; }
.cta-band-inner p { margin: 0 0 24px; opacity: 0.85; }
.cta-band-actions { display: flex; gap: 12px; justify-content: center; flex-wrap: wrap; }
.cta-band-actions .el-button { --el-color-primary: #ffffff; }

/* 滚动入场 */
.reveal { opacity: 0; transform: translateY(24px); transition: opacity 0.7s cubic-bezier(0.16, 1, 0.3, 1), transform 0.7s cubic-bezier(0.16, 1, 0.3, 1); }
.reveal.in-view { opacity: 1; transform: translateY(0); }

/* 移动端自适应 */
@media (max-width: 980px) {
  .hero-inner { grid-template-columns: 1fr; gap: 28px; }
  .hero-preview { order: -1; }
  .preview-glass { transform: none; max-width: 420px; }
  .bento { grid-template-columns: repeat(2, 1fr); }
  .bento-card.span-2 { grid-column: span 2; }
  .scenarios { grid-template-columns: 1fr; }
  .metrics { grid-template-columns: repeat(2, 1fr); }
}
@media (max-width: 640px) {
  .hero { padding: 32px 16px 24px; }
  .hero-title { font-size: 28px; }
  .hero-sub { font-size: 15px; }
  .section { padding: 40px 16px; }
  .section-head h2 { font-size: 24px; }
  .bento { grid-template-columns: 1fr; }
  .bento-card.span-2 { grid-column: span 1; }
  .metrics { grid-template-columns: 1fr 1fr; padding: 0 16px; }
  .cta-band { padding: 0 16px; }
  .cta-band-inner { padding: 36px 20px; }
  .cta-band-inner h2 { font-size: 22px; }
  .hero-actions .el-button, .cta-band-actions .el-button { flex: 1; }
}
</style>
