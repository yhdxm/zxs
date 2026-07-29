<template>
  <div class="login-shell">
    <div class="login-bg" aria-hidden="true">
      <span class="blob blob-1"></span>
      <span class="blob blob-2"></span>
      <span class="blob blob-3"></span>
    </div>

    <div class="login-card">
      <!-- 左侧品牌故事区（PC 展示，移动端隐藏） -->
      <aside class="login-aside">
        <div class="brand">
          <img class="brand-logo-img" src="/company-logo.png" alt="logo" />
          <span class="brand-name">Smart Dashboard</span>
        </div>

        <h1 class="aside-title">
          你的<span class="grad-text">智能工作台</span><br />
          一处掌控全局
        </h1>
        <p class="aside-desc">
          统一的账号体系，把待办、点位、内容与 AI 助手收拢到同一空间。数据实时云端同步，登录即可在任何设备延续工作。
        </p>

        <ul class="feature-list">
          <li>
            <span class="feat-icon"><el-icon><DataBoard /></el-icon></span>
            <div>
              <strong>工作台可视化</strong>
              <span>待办、点位、内容一目了然，趋势尽在掌握</span>
            </div>
          </li>
          <li>
            <span class="feat-icon"><el-icon><MagicStick /></el-icon></span>
            <div>
              <strong>AI 助手内嵌</strong>
              <span>配置一次，登录后自动带出，无需重复填写</span>
            </div>
          </li>
          <li>
            <span class="feat-icon"><el-icon><Lock /></el-icon></span>
            <div>
              <strong>账号级云端同步</strong>
              <span>PC 与移动端配置互通，换设备也不丢</span>
            </div>
          </li>
        </ul>
      </aside>

      <!-- 右侧登录卡片 -->
      <section class="login-form-wrap">
        <AuthCard />
        <p class="mobile-brand">Smart Dashboard · 你的智能工作台</p>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { DataBoard, MagicStick, Lock } from '@element-plus/icons-vue'
import AuthCard from '../components/AuthCard.vue'
</script>

<style scoped>
.login-shell {
  position: relative;
  min-height: 100vh;
  min-height: 100dvh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  overflow: hidden;
  background: radial-gradient(120% 120% at 50% 0%, #eef2ff 0%, #f7f8fb 45%, #eef2ff 100%);
}

/* 背景光晕 */
.login-bg {
  position: absolute;
  inset: 0;
  overflow: hidden;
  z-index: 0;
}
.blob {
  position: absolute;
  border-radius: 50%;
  filter: blur(70px);
  opacity: 0.5;
}
.blob-1 {
  width: 380px;
  height: 380px;
  background: #8b5cf6;
  top: -120px;
  left: -80px;
}
.blob-2 {
  width: 320px;
  height: 320px;
  background: #06b6d4;
  bottom: -120px;
  right: -60px;
}
.blob-3 {
  width: 260px;
  height: 260px;
  background: #6366f1;
  top: 40%;
  right: 30%;
  opacity: 0.25;
}

.login-card {
  position: relative;
  z-index: 1;
  width: min(100%, 960px);
  display: grid;
  grid-template-columns: 1.05fr 0.95fr;
  background: rgba(255, 255, 255, 0.9);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.6);
  border-radius: 28px;
  box-shadow: 0 30px 80px rgba(30, 41, 99, 0.18);
  overflow: hidden;
}

/* ===== 左侧品牌区 ===== */
.login-aside {
  padding: 40px 38px;
  color: #fff;
  background: linear-gradient(150deg, #4f46e5 0%, #7c3aed 55%, #06b6d4 130%);
  display: flex;
  flex-direction: column;
}
.brand {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 36px;
}
.brand-logo-img {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  object-fit: contain;
  background: rgba(255, 255, 255, 0.12);
  padding: 4px;
  box-sizing: border-box;
  filter: drop-shadow(0 0 10px rgba(255, 255, 255, 0.25));
}
.brand-name {
  font-size: 17px;
  font-weight: 800;
  letter-spacing: -0.01em;
}
.aside-title {
  margin: 0;
  font-size: 30px;
  line-height: 1.3;
  font-weight: 800;
  letter-spacing: -0.02em;
}
.grad-text {
  background: linear-gradient(90deg, #fde68a, #fca5a5);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}
.aside-desc {
  margin: 16px 0 28px;
  font-size: 14px;
  line-height: 1.75;
  color: rgba(255, 255, 255, 0.86);
}
.feature-list {
  list-style: none;
  margin: auto 0 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 18px;
}
.feature-list li {
  display: flex;
  gap: 12px;
  align-items: flex-start;
}
.feat-icon {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.16);
  display: grid;
  place-items: center;
  flex-shrink: 0;
}
.feat-icon :deep(svg) {
  font-size: 18px;
}
.feature-list strong {
  display: block;
  font-size: 14px;
  font-weight: 700;
}
.feature-list span {
  font-size: 12.5px;
  color: rgba(255, 255, 255, 0.78);
  line-height: 1.5;
}

/* ===== 右侧表单区 ===== */
.login-form-wrap {
  padding: 48px 40px;
  display: flex;
  flex-direction: column;
  justify-content: center;
}
.mobile-brand {
  display: none;
  text-align: center;
  margin: 20px 0 0;
  font-size: 13px;
  font-weight: 700;
  color: #4f46e5;
}

/* ===== 响应式：移动端单栏 ===== */
@media (max-width: 860px) {
  .login-shell {
    padding: 0;
  }
  .login-card {
    grid-template-columns: 1fr;
    width: 100%;
    min-height: 100vh;
    min-height: 100dvh;
    border-radius: 0;
    border: none;
  }
  .login-aside {
    display: none;
  }
  .login-form-wrap {
    flex: 1;
    padding: 28px 20px;
    justify-content: center;
  }
  .mobile-brand {
    display: block;
  }
}

@media (max-width: 420px) {
  .login-form-wrap {
    padding: 22px 16px;
  }
}
</style>
