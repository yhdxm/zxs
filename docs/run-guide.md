# 运行与配置说明

## 1. 启动服务

### Windows PowerShell
```powershell
cd D:\开发工具-zy\代码类目\my-web-demo
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
npm run dev
```

### 直接使用脚本
```powershell
cd D:\开发工具-zy\代码类目\my-web-demo
.\scripts\start-dev.ps1
```

服务地址：
- 本机：http://localhost:5173/
- 局域网：http://192.168.136.1:5173/

## 2. 移动端访问

1. 确认电脑和手机在同一个 Wi-Fi / 局域网。
2. 电脑执行启动命令后，手机浏览器输入：
   ```text
   http://<电脑局域网IP>:5173/
   ```
3. 如果打不开，优先检查：
   - 电脑防火墙是否允许 Vite 端口 5173
   - 手机是否使用同一 Wi-Fi
   - 是否使用了 0.0.0.0 启动

## 3. 数据库与存储

当前项目使用 Supabase：
- 账号表：app_accounts
- 用户资料表：profiles
- 工作台数据表：app_dashboard_data

### 初始化 SQL
请在 Supabase SQL Editor 执行 [scripts/supabase_setup.sql](../scripts/supabase_setup.sql)

### 验证数据库连接
```powershell
npm run verify:supabase
```

## 4. AI 模型接入

### 目前支持
- Ollama
- OpenRouter
- OpenAI 兼容接口
- 阿里百炼（DashScope）

### 前端已做的脱敏处理
- API Key 输入框使用密码模式
- 本地只保存脱敏后的值
- 运行时错误消息会去掉密钥/Token信息

## 5. 代码替换说明

如果你要换成其他 AI 方案，优先替换 [src/services/aiService.ts](../src/services/aiService.ts) 中的 callAi 实现即可。
