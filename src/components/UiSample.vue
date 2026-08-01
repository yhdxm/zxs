<template>
  <div class="ui-sample">
    <!-- 统计卡：用 minmax 自适应列数（正确写法示范） -->
    <div class="us-stats">
      <div class="us-stat"><div class="us-stat-n">128</div><div class="us-stat-l">总反馈</div></div>
      <div class="us-stat"><div class="us-stat-n">36</div><div class="us-stat-l">待处理</div></div>
      <div class="us-stat"><div class="us-stat-n">92%</div><div class="us-stat-l">完成率</div></div>
      <div class="us-stat"><div class="us-stat-n">5</div><div class="us-stat-l">进行中</div></div>
    </div>

    <!-- 故意保留固定宽元素：用于暴露窄屏（尤其 PDA 320）横向溢出问题 -->
    <div class="us-fixed">固定宽 320px 演示卡（窄屏会溢出 → 应改为 minmax / 百分比）</div>

    <!-- 表格：放横向滚动容器，避免撑破布局 -->
    <div class="us-table-wrap">
      <table class="us-table">
        <thead>
          <tr><th>编号</th><th>标题</th><th>分类</th><th>状态</th><th>时间</th></tr>
        </thead>
        <tbody>
          <tr><td>#1024</td><td>地图路线规划建议</td><td>建议</td><td>已回复</td><td>08-01</td></tr>
          <tr><td>#1023</td><td>PDA 端显示异常</td><td>Bug</td><td>处理中</td><td>07-31</td></tr>
          <tr><td>#1022</td><td>新增导出 Excel</td><td>建议</td><td>待处理</td><td>07-30</td></tr>
        </tbody>
      </table>
    </div>

    <!-- 表单：标签在上、输入在下，flex 自适应 -->
    <div class="us-form">
      <label class="us-label">标题</label>
      <input class="us-input" placeholder="请输入标题" />
      <label class="us-label">分类</label>
      <select class="us-input"><option>建议</option><option>Bug</option><option>投诉</option></select>
    </div>

    <!-- 标签页：flex-wrap 自动换行 -->
    <div class="us-tabs">
      <span class="us-tab us-tab--on">全部</span>
      <span class="us-tab">待处理</span>
      <span class="us-tab">已回复</span>
      <span class="us-tab">已关闭</span>
    </div>

    <!-- 操作按钮组：flex-wrap 自动换行 -->
    <div class="us-actions">
      <button class="us-btn">查询</button>
      <button class="us-btn">导出</button>
      <button class="us-btn">批量处理</button>
      <button class="us-btn us-btn--danger">删除</button>
    </div>

    <!-- 地图占位：宽 100%、固定高，宽度自适应 -->
    <div class="us-map">地图容器（宽自适应 · 固定高）</div>

    <!-- 对话框示意：宽度用 min(90%, 360px) 自适应 -->
    <div class="us-dialog">
      <div class="us-dialog-box">
        <div class="us-dialog-t">回复反馈</div>
        <div class="us-dialog-c">回复内容区域。宽度使用 min(90%, 360px)，窄屏自动收窄，不会超框。</div>
        <div class="us-dialog-actions">
          <button class="us-btn">取消</button>
          <button class="us-btn us-btn--primary">确定</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{ os?: string }>()
</script>

<style scoped>
.ui-sample {
  padding: 10px;
  box-sizing: border-box;
  font-size: 13px;
  color: #1f2937;
  background: #ffffff;
}
/* 统计卡：自适应列数，窄屏自动变少列 */
.us-stats {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(110px, 1fr));
  gap: 8px;
  margin-bottom: 10px;
}
.us-stat {
  background: #f5f7fa;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 8px 10px;
}
.us-stat-n { font-size: 18px; font-weight: 700; color: #2563eb; }
.us-stat-l { font-size: 12px; color: #6b7280; margin-top: 2px; }

/* 故意固定宽：暴露窄屏溢出 */
.us-fixed {
  width: 320px;
  background: #fff7ed;
  border: 1px dashed #f59e0b;
  color: #b45309;
  border-radius: 8px;
  padding: 8px 10px;
  margin-bottom: 10px;
}

/* 表格横向滚动容器 */
.us-table-wrap {
  overflow-x: auto;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  margin-bottom: 10px;
}
.us-table { border-collapse: collapse; width: 100%; min-width: 360px; font-size: 12px; }
.us-table th, .us-table td {
  border-bottom: 1px solid #f0f0f0;
  padding: 7px 9px;
  text-align: left;
  white-space: nowrap;
}
.us-table th { background: #f5f7fa; color: #374151; font-weight: 600; }

/* 表单 */
.us-form { display: flex; flex-wrap: wrap; gap: 6px 10px; margin-bottom: 10px; }
.us-label { width: 100%; font-size: 12px; color: #6b7280; }
.us-input {
  flex: 1 1 140px;
  min-width: 0;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  padding: 7px 9px;
  font-size: 13px;
  box-sizing: border-box;
}

/* 标签页 */
.us-tabs { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 10px; }
.us-tab {
  padding: 5px 12px;
  border-radius: 999px;
  background: #f3f4f6;
  color: #4b5563;
  font-size: 12px;
}
.us-tab--on { background: #2563eb; color: #fff; }

/* 按钮组 */
.us-actions { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 10px; }
.us-btn {
  border: 1px solid #d1d5db;
  background: #fff;
  border-radius: 6px;
  padding: 6px 12px;
  font-size: 12px;
  color: #374151;
  cursor: pointer;
}
.us-btn--primary { background: #2563eb; border-color: #2563eb; color: #fff; }
.us-btn--danger { color: #dc2626; border-color: #fecaca; }

/* 地图占位 */
.us-map {
  height: 96px;
  border-radius: 8px;
  background: repeating-linear-gradient(45deg, #eef2ff, #eef2ff 10px, #e0e7ff 10px, #e0e7ff 20px);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #6366f1;
  font-size: 12px;
  margin-bottom: 10px;
}

/* 对话框示意 */
.us-dialog {
  position: relative;
  height: 110px;
  background: rgba(17, 24, 39, 0.25);
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.us-dialog-box {
  width: min(90%, 360px);
  background: #fff;
  border-radius: 10px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.18);
  padding: 12px;
  box-sizing: border-box;
}
.us-dialog-t { font-weight: 700; margin-bottom: 6px; }
.us-dialog-c { font-size: 12px; color: #6b7280; margin-bottom: 10px; }
.us-dialog-actions { display: flex; justify-content: flex-end; gap: 6px; }
</style>
