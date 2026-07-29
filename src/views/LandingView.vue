<template>
  <div class="landing-shell">
    <header class="hero-card">
      <div class="hero-copy">
        <p class="eyebrow">统一工作台</p>
        <h1>登录后即可进入你的个人事务管理中心</h1>
    
        <div class="hero-actions">
          <el-button type="primary" size="large" @click="goLogin">立即注册 / 登录</el-button>
          <el-button size="large" plain @click="goDemo">查看工作台</el-button>
        </div>
      </div>
      <div class="hero-brand">
        <img :src="logo" alt="logo" />
        <div>
      
        </div>
      </div>
    </header>

    <section class="feature-grid">
      <div class="feature-card">
        <h3>待办事项</h3>
        <p>随时新增、编辑、批量管理，适合日常任务追踪。</p>
      </div>
      <div class="feature-card">
        <h3>点位信息</h3>
        <p>记录关键地点、地址与备注，便于统一查看与维护。</p>
      </div>
      <div class="feature-card">
        <h3>处理内容</h3>
        <p>支持文案输入、导入文件、图片上传和结构化记录。</p>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router'
import logo from '../assets/logo.svg'

const router = useRouter()

const goLogin = () => router.push('/login')
const goDemo = () => router.push('/dashboard')
</script>

<style scoped>
.landing-shell {
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.hero-card {
  display: grid;
  grid-template-columns: 1.5fr 1fr;
  gap: 20px;
  background: linear-gradient(135deg, #eff6ff, #f8fafc);
  border-radius: 24px;
  padding: 24px;
  box-shadow: 0 10px 30px rgba(37, 99, 235, 0.08);
}

.eyebrow {
  margin: 0 0 8px;
  color: #2563eb;
  font-weight: 700;
  letter-spacing: 0.2em;
  text-transform: uppercase;
}

.hero-copy h1 {
  margin: 0 0 8px;
  font-size: 32px;
  color: #0f172a;
}

.hero-copy p {
  color: #475569;
  line-height: 1.6;
}

.hero-actions {
  display: flex;
  gap: 12px;
  margin-top: 16px;
  flex-wrap: wrap;
}

.hero-brand {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
  background: white;
  border-radius: 20px;
  padding: 20px;
}

.hero-brand img {
  width: 88px;
  height: 88px;
}

.feature-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}

.feature-card {
  background: white;
  border-radius: 16px;
  padding: 18px;
  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.06);
}

@media (max-width: 900px) {
  .hero-card,
  .feature-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 640px) {
  .landing-shell {
    padding: 12px;
  }

  .hero-card {
    padding: 16px;
  }
}
</style>




        
