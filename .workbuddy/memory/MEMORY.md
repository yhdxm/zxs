# MEMORY.md - ZXS 项目长期记忆

## 项目概况
- Vue 3 + Vite + TypeScript + Supabase 的演示应用。核心数据逻辑在 `src/services/appDataService.ts`（约 1170 行）。
- 认证为"自建账号表 + 纯前端"架构，非 Supabase Auth。

## 安全整改（待执行，免费优先）
- 当前为 P0 级风险：Supabase RLS 全 `using(true)` 全网可读写、URL/key 硬编码且已推公开 GitHub 仓库(YHDXM/ZXS)、无盐 SHA-256 客户端比对、默认超管 admin/admin123、AI Key 仅 base64 存云端。
- 整改顺序建议：先止血（轮换 key + 改 admin 密码 + 仓库转私有），后重构（RLS 按 user_id 隔离 + 迁 Supabase Auth 免费档 + 移除硬编码回退 + AI Key 改本地）。
- 用户要求一切免费：Supabase 免费档额度足够，整改不花钱。

## 用户约束
- 不主动生成报告，除非明确要求。
- 一切免费方案优先。
- 功能8"免费内容"（新闻/地图/天气）硬约束：纯前端直连免费第三方API（如 Open-Meteo/OSM+Leaflet/RSS），不经过 Supabase 云端、不消耗任何积分/额度。各类"免费监测"同样遵循此原则。
