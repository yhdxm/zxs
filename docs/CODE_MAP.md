# 智习（ZXS）代码地图 · 每个文件是做什么的

> 适用版本：2026-08-02 代码快照。技术栈：Vue 3 + Vite + TypeScript + Element Plus（PC 端 UI）+ Vant4（移动端 UI）+ Supabase（后端/自建账号表）。
> 本文按目录分组，逐文件说明「路径 / 类型 / 职责 / 关键导出或主要组件」。

---

## 一、工程入口与构建配置（项目根目录）

| 文件 | 类型 | 职责 |
|---|---|---|
| `index.html` | HTML | 应用外壳。设置 `viewport`（移动端 `width=device-width, initial-scale=1.0` 允许缩放）、`favicon`（`./logo.svg`）、标题「智习」；在首屏渲染前读取 `localStorage` 的 `zxs-theme` 先给 `<html>` 加 `dark`/`light` 类，避免主题闪烁；挂载 `#app` 并加载 `/src/main.ts`。 |
| `vite.config.ts` | 配置 | Vite 构建配置：`base` 为相对路径 `./`（GitHub Pages 根/子路径都不白屏）；`@` 别名指向 `src`；插件含 vue + 类型检查；`build.rollupOptions` 拆包。 |
| `package.json` | 配置 | 依赖与脚本。`dev`/`build`/`build:github`/`preview` 等；`build` = `run-p type-check build-only`（并行，注意类型错误会被 vite 输出覆盖，需单独 `npx vue-tsc --build --force` 验证）。 |
| `tsconfig.json` / `tsconfig.app.json` / `tsconfig.node.json` | 配置 | TS 类型工程配置，含 `paths` 别名、`strict` 等。 |
| `env.d.ts` | 类型 | Vite 环境类型声明（`.vue` 模块、`.env` 等）。 |
| `vitest.config.ts` | 配置 | 单元测试配置（Vitest）。 |
| `.env` / `.env.example` | 配置 | 运行环境变量（Supabase URL / anon key、AI Key 等）。`.env` 含真实密钥，**已推公开仓库需轮换**；`.env.example` 为模板。 |
| `.gitignore` | 配置 | 忽略 `node_modules`、`dist*`、`.env`（但实际已提交，需清理）、本地产物。 |
| `README.md` | 文档 | 项目简介。 |
| `deploy.bat` / `deploy-ssh.bat` / `deploy_watch.ps1` / `sync.bat` | 脚本 | 部署/同步脚本（本地构建 + 上传 GitHub Pages 或 SSH；`deploy_watch` 监听热更）。用户自己上线，AI 不自动 push。 |
| `AGENTS.md` | 文档 | 给 AI Agent 的仓库说明（架构、约定、命令）。 |
| `public/` | 静态 | 静态资源（如 `logo.svg` 等，构建时原样拷贝）。`public/cet-prep.html` 为旧的「四六级备考台」离线单文件版（纯 localStorage），已被 SPA 数据库版取代、不再被菜单引用，可删除。 |
| `scripts/` | 脚本 | SQL / 初始化脚本。含 `supabase_stats.sql`（`get_database_stats()` RPC，供「数据库监测中心」枚举各表行数，已对 anon 授权）。 |
| `test/` | 测试 | 测试文件。 |
| `dist/` `dist_*` | 产物 | 构建输出（`dist_*` 为验证用临时目录，已加 .gitignore，需清理误提交的 57 个产物）。 |
| `.github/`、`.vscode/`、`.workbuddy/` | 配置 | CI / 编辑器 / 本助手的工作记忆目录（`.workbuddy/memory` 存项目长期记忆，勿删）。 |

---

## 二、应用启动与根布局

### `src/main.ts`
应用引导文件。依次：
- 引入全局样式 `main.css` / `markdown.css` / `theme.css`；
- 创建 Vue app，注册路由、`ElementPlus`（中文 `zhCn` 语言包）、`Vant`（移动端组件库）；
- 注册**全局运行时错误兜底层**（`app.config.errorHandler`）：任何渲染异常变成页面顶部红色条并提示「请截图反馈」，避免移动端静默白屏；
- 静默调用 `initDatabase()`（确保工作台数据行存在，Supabase 不可达时本地降级），最后 `mount('#app')`。

### `src/App.vue`（最核心的壳）
根组件，决定整体布局与导航。三种布局分支：
1. **初始化 loading**：登录态确认前全屏遮罩，避免未登录布局闪烁。
2. **登录页**（`route.name==='login'`）：`.login-screen` 全屏，不带任何导航。
3. **已登录**（`is-authed`）：左侧常驻 `app-sidebar`（品牌 + 菜单搜索 + 分组菜单 + 主题切换 + 用户卡 + 折叠按钮）+ 主区域 `app-main`；移动端隐藏侧栏，改由**悬浮菜单按钮（FAB）+ `el-drawer` 抽屉**导航。
4. **未登录公开态**：保留侧栏 + 移动端 `mobile-topbar` + 抽屉。

逻辑要点：
- `isMobile`（`window.innerWidth<=768`，监听 resize）仅用于权限平台判断（pc/mobile）；
- `sideMenu` 由 `APP_MENU` 派生，`hasMenuPermission` 按当前用户权限过滤菜单，`isMenuActive` 处理各路由高亮（含 lianzhicang/工作数据看板 等多页共用路由）；
- `watch(route.fullPath)` + `permission-config-updated` 事件实时刷新用户与侧栏权限；
- 主题切换写 `localStorage.zxs-theme`。

---

## 三、路由与菜单配置

### `src/router/index.ts`
路由表 + **全站登录门禁**（`beforeEach`）：
- 路由清单：见下表（path → 组件 → 所需权限 `meta.requirePermission`）。
- 守卫逻辑：未登录访问非登录页 → 跳 `/login`；已登录访问 `/login` → 跳 `/welcome`（工作台前移）；按路由权限 key + 当前平台（pc/mobile）调用 `hasPermission` 校验，无权则跳到有权限的第一个页面（避免重定向死循环白屏）。
- `/dashboard` 用 `query.view`（overview/todos/points/contents）区分四个子视图，各有细粒度权限。

### `src/config/appMenu.ts`
**单一数据源**：`APP_MENU` 数组同时驱动「左侧菜单」与「角色权限树 `PERMISSION_TREE`」。新增页面只需在此加一项，菜单与权限自动同步（满足"权限管理自动添加"）。导出 `canManageSystem`、类型 `SideItem`。权限 key 细粒度（每页一个，如 `news`/`learn-english`，再分 `.pc`/`.mobile`），`PERMISSION_SCHEMA_VERSION=2`，老版本配置在 `loadPermissionConfig` 时迁移。

---

## 四、核心数据服务 `src/services/`

| 文件 | 职责（关键导出） |
|---|---|
| `appDataService.ts` | **核心服务**。自建账号体系：登录/注册/登出、用户读写（`getSavedUser`/`setStoredUser`）、角色 CRUD、权限配置读写（`loadPermissionConfig`/`savePermissionConfig`）、`hasPermission`/`hasModulePermission`/`normalizeConfig`（老版本 v1→v2 迁移 + 超级管理员恒全权限）、`ALL_PERMISSION_KEYS` 等。Supabase 不可达时本地降级。**注意**：权限 key 精确匹配，运行时不再二次展开（修复过「勾 AI 助手自动带出 AI模型知识」的 bug）。 |
| `dbInit.ts` | 应用启动初始化工作台数据行（待办/点位/内容等），Supabase 失败降级本地。 |
| `supabaseClient.ts` / `supabaseIsolated.ts` | Supabase 客户端封装（主客户端 / 隔离客户端，规避单例污染）。 |
| `secret.ts` | AI Key 等密钥读取（线上为 base64 存云端，建议改本地）。 |
| `newsService.ts` | 新闻聚合数据源：Google News RSS + 3 个代理兜底 + 分类免费 RSS；`freshnessValue` 由新鲜度算热度。 |
| `carService.ts` | 星舆识途（汽车）数据：`fetchCarNews`/`fetchSalesRanking`/`fetchCarMacro`（东方财富搜索 + ourworldindata 真实实时），以及静态知识库 `CAR_KNOWLEDGE`/`CAR_TYPES`/`BUILTIN_CAR_LIBRARY`。 |
| `externalIdeas.ts` | 需求收集数据源：GitHub Search API 实时抓 + 28 条 `SEED_REPOS` 种子；每条含 `cnMeaning`（中文释义）/ `region`（国内·国外·通用）/ `industry`（行业）。 |
| `tencentFinance.ts` | 影仓智核实时行情：腾讯财经 `qt.gtimg.cn` 免费实时接口，3 秒刷新。 |
| `aiService.ts` | 调用大模型（对话/生成）。 |
| `aiNewsService.ts` / `aiTrendService.ts` | AI 资讯 / AI 趋势数据。 |
| `modelService.ts` / `modelCatalog.ts` / `bailianModels.generated.ts` / `freeModels.ts` | 模型中心 / 模型目录 / 百炼模型（生成）/ 免费模型清单。 |
| `weatherService.ts` / `geoService.ts` | 天气（Open-Meteo 免费）/ 地理编码（OSM 免费）。 |
| `learningService.ts` / `learnDb.ts` | 学习中心数据读写（Supabase + 本地降级）。 |
| `services/cetPrepService.ts` | 四六级备考台数据服务：主词表 `cet4_words`（全量词，管理员导入）+ 用户进度/刷题/错题/打卡/设置 5 张表，均按 `user_id` 隔离（自建账号）。表结构见 `scripts/cet4_prep.sql`。 |
| `prep/prepApp.ts` | 四六级备考台核心逻辑（艾宾浩斯队列/专注背词/折线图/PNG 战报等），存储层由外部注入的 Supabase 适配器提供；`CetPrepView.vue` 在 `onMounted` 挂载并清理。 |
| `views/CetPrepView.vue` | 四六级备考台 SPA 页面（路由 `/learn/cet-prep`），样式以 `.cet-prep-root` 命名空间隔离，避免污染主站全局类名。 |
| `englishKnowledge.ts` / `industryKnowledge.ts` | 学位英语 / 行业英语知识库（按大纲第二版，静态）。 |
| `feedbackService.ts` | 反馈意见读写。 |
| `usageTracker.ts` | 使用量统计。 |
| `freeApi.ts` | 免费第三方 API 封装（新闻/地图/天气直连，不耗积分）。 |
| `balanceService.ts` | 余额/积分服务。 |
| `learningGoalService.ts` | **学习目标管理台**纯前端数据层（localStorage，不连外部接口）。定义目标/记录/周报数据模型与 CRUD；计算完成率、剩余量、今日建议量（剩余÷剩余天数）、连续打卡天数（含每周一自动 1 个休息日：首次漏打不中断、第二次才断）、近 7 天平均速度推算预计完成日（样本不足返回"暂无推算"）、昨日漏打卡判定（休息日/中断）、逾期判定、周报汇总与环比、近 14 天分目标投入分钟、JSON 导出/导入/旧版迁移/清空；首次使用写入 3 个示例目标与覆盖补记/休息日/连续漏打/障碍预案状态的记录。 |

---

## 五、可复用组件 `src/components/`

### 通用
| 文件 | 职责 |
|---|---|
| `CompassLogo.vue` | SVG 罗盘 logo，支持 `animated`/`glow`/`size`；渐变 id 用模块级 `_seq` 防冲突。登录页、侧栏、欢迎页都用它。 |
| `PageHeader.vue` | 可复用页头（`.ph-inner` 默认 `padding:14px 20px`，移动端 `12px 14px`）。含标题 + 副标题 + 右侧 `#actions` 插槽。**系统对齐基准**：各页面内容左右边距以此 20px 为准。 |
| `EChart.vue` | ECharts 封装：容器百分比宽 + 监听 `resize`/`ResizeObserver` 重绘，自适应不写死像素。 |
| `UiSample.vue` | 给「自适应效果展示」页用的示例 UI 片段。 |
| `AuthCard.vue` | 登录/注册表单卡片，`isMobile` 时标签改为顶部排列。 |

### 工作数据看板
| 文件 | 职责 |
|---|---|
| `DashboardBoard.vue` | 「工作数据看板」主体：用 `PageHeader` 顶部（对齐 AI 助手风格），卡片/图表/报表三视图切换。 |
| `DashboardOverview.vue` | 概览统计与图表（`prefers-reduced-motion` 适配、响应式栅格）。 |

### AI 助手
| 文件 | 职责 |
|---|---|
| `AiChatPanel.vue` | AI 对话面板，移动端输入框行数自适应（`isMobile`）。 |
| `AiConfigPanel.vue` | AI 配置表单，移动端标签顶部排列。 |

### 需求收集
| 文件 | 职责 |
|---|---|
| `ExternalIdeaCard.vue` | 单条需求/创意卡片：展示中文释义 `cnMeaning`、地区标签 `region`（国内/国外）、行业标签 `industry`。 |

### 天气 / 地图 / 学习
| 文件 | 职责 |
|---|---|
| `WeatherPanel.vue` / `WeatherIcon.vue` / `WeatherIconCloudShape.vue` / `WeatherEffects.vue` | 天气面板与各类天气图标/特效（云形、雨雪动画）。 |
| `MapPanel.vue` | 地图面板（OSM + Leaflet 免费直连）。 |
| `ModuleManager.vue` | 模块管理组件。 |

### 影仓智核（金融）`src/components/finance/`
| 文件 | 职责 |
|---|---|
| `YcQuotes.vue` | 实时行情主组件：`fetchIndices`/`fetchGlobal`/`fetchCommodities`/`fetchHotStocks`（腾讯财经），`REFRESH_MS=3000`，`refreshNonce` 触发刷新。 |
| `YcHotEvents.vue` | 热点事件列表。 |
| `YcWatchlist.vue` | 自选股观察列表。 |
| `YcLearn.vue` | 学投资内容。 |
| `YcSimTrade.vue` | 模拟交易。 |
| `YcAi.vue` | AI 投研。 |
| `KLineDialog.vue` | K 线弹窗（移动端 `min(720px,94vw)`）。 |

---

## 六、页面视图 `src/views/`（路由 → 组件）

> 路由守卫权限 key 见 `router/index.ts` + `appMenu.ts`。

| 文件 | 路由 | 职责 |
|---|---|---|
| `LoginView.vue` | `/login` | 登录页。左侧品牌区已改为 `CompassLogo` +「智习」（原 Smart Dashboard 已移除），移动端有 `.mobile-brand` 文案。 |
| `WelcomeView.vue` | `/welcome` | 欢迎首页（常驻首页）：真实烟花 SVG + 罗盘 logo + 流光标题，提示「从左上角菜单进入」。 |
| `HomeView.vue` | — | 早期/备用主页（部分旧入口），当前主要落地为 WelcomeView。 |
| `LandingView.vue` | `/landing` | 公开落地页（未登录可访问）。 |
| `DashboardView.vue` | `/dashboard` | 工作数据看板容器，按 `query.view` 渲染概览/待办/点位/内容，包 `DashboardBoard`。 |
| `AiAssistantView.vue` | `/ai` | AI 助手：顶部用 `PageHeader`（标题「AI 助手」+ 副标题 + 右侧「清空对话/配置」按钮），是其它页顶部的对齐样板。 |
| `AiModelsView.vue` | `/aimodels` | AI 模型知识库页（响应式断点最多，20 个 media query）。 |
| `ModelCenterView.vue` | `/models` | 模型中心（13 个 media query）。 |
| `SystemManageView.vue` | `/system` | 系统管理：账号管理 / 角色权限管理（`query.view=roles`）。含权限树编辑、保存后 dispatch `permission-config-updated`。 |
| `AccountSettingsView.vue` | `/account` | 个人设置：已改为 `PageHeader` + 双卡片栅格（基本资料 / 安全设置），与系统主样式对齐。 |
| `DatabaseCheckView.vue` | `/database` | 数据库监测中心：连接/容量/各表行数·空间·RLS + 问题预警（表未启用 RLS、缺中文说明等）。新增表须登记进 `getDatabaseStats` 降级清单 + `TABLE_DESC`。 |
| `AutomationInfoView.vue` | `/automation` | 自动化信息页。 |
| `RequirementCollectView.vue` | `/requirements` | 需求收集：GitHub 实时创意 + 中文释义 + 国内/国外 + 行业标签；顶部 PageHeader + 搜索；根边距已统一 `0 20px`（移动 `0 14px`）。 |
| `WeatherView.vue` | `/weather` | 天气页（Open-Meteo 免费）。 |
| `MapView.vue` | `/map` | 地图页（OSM+Leaflet）。 |
| `NewsAggregateView.vue` | `/news` | 新闻聚合：**实时脉搏**已立体化（3D 渐变波段 + 热度竖线 + 活跃点发光 + 轮播）。 |
| `YingCangView.vue` | `/yingcang` | 影仓智核（金融实时）：顶栏「实时」徽章 + 3 秒刷新提示；边距已统一 `0 20px`。 |
| `XingYuView.vue` | `/xingyu` | 星舆识途（汽车）：八模块入口，热点/销量/优惠/新车/品牌实时（东方财富），知识/车型库为静态；边距已统一 `0 20px`。 |
| `LearnEnglishView.vue` | `/learn/english` | 学位英语（按大纲）。 |
| `LearnIndustryView.vue` | `/learn/industry` | 行业英语。 |
| `LearnBooksView.vue` | `/learn/books` | 图书/书库学习。 |
| `LearningGoalsView.vue` | `/learn/goals` | **学习目标管理台**：有终点、有总量的目标管理（如背完 2000 词、读完 440 页）。四 Tab（今日/看板/周报/我的），响应式导航（桌面左栏 / 平板顶栏 / 手机底栏）；今日含新建、昨日漏打卡黄/红卡置顶、打卡区（预填建议量、选填分钟、补记最近 6 天）；看板含进度环、三核心数字、预案、最近 10 条可删记录、手写 SVG 近 14 天投入分钟堆叠柱状图；周报含周汇总、环比、四栏（保持/问题/尝试/下周预案）与一键生成周报文本；我的含导出/导入/清空示例/清空全部/添加到主屏幕三步说明；累计 20 条后顶部温和备份横幅；达成彩带动效；图标全内联 SVG；数据全存 localStorage 即时保存。 |
| `ThirdPartyApiView.vue` | `/third-api` | 第三方 API 信息页。 |
| `FeedbackView.vue` | `/feedback` | 用户反馈提交。 |
| `FeedbackAdminView.vue` | `/feedback-admin` | 反馈管理后台（列表/详情双栏，窄屏切换）。 |
| `ResponsiveShowcaseView.vue` | `/responsive` | **自适应效果展示**：真机视口检测（横向溢出告警）+ 6 类设备（苹果/安卓/华为/PDA/Win/Mac）预览 + 已落地响应式规范清单。用于回归验证。 |

---

## 七、工具库 `src/lib/`

| 文件 | 职责 |
|---|---|
| `markdown.ts` | Markdown 渲染封装（反馈/文章展示用）。 |
| `supabaseIsolated.ts` | 隔离 Supabase 客户端（见 services 说明，放在 lib 也引用）。 |

## 八、静态数据 `src/data/`

| 文件 | 职责 |
|---|---|
| `chinaCities.ts` | 中国城市列表（天气/地图选择用）。 |
| `aiKnowledge.ts` | AI 知识库静态数据。 |

---

## 九、样式系统 `src/assets/`

| 文件 | 职责 |
|---|---|
| `base.css` | 基础重置：`box-sizing:border-box`、字体栈、`--section-gap` 等；`body` 基础排版。 |
| `main.css` | 主样式入口：引入 `base.css`；`:root` 设计令牌（如 `--nav-h`，移动端降到 52px）；`#app` `max-width:1600px` 居中；统一 `.el-input`/`.van-field` 宽度 100%。 |
| `theme.css` | **双主题设计系统**：浅色（默认，当前风格）+ 深色令牌（背景/文字/边框/主色/阴影/导航态/Vant 暗色变量）。`<html>` 切 `dark` 或 `data-theme` 切换。Element Plus 暗色变量对齐。 |
| `markdown.css` | Markdown 内容排版样式。 |

---

## 十、全局铁律（影响本次与未来改动）

1. **必须免费**：所有 API/部署/数据源一律免费，不引入付费服务。
2. **移动端自适应强制**：所有页面/组件/弹窗/表格/图表手机窄屏可用，不溢出、不错乱（基准 360px，支持到 320px PDA）。
3. **UI 风格统一**：保持现有 Element Plus 浅色扁平卡片风格，不擅自换肤；用户指出不满意立即改。
4. **单一标题**：App.vue 顶栏不再显示页面标题，每个页面自身带可见标题，禁止重复。
5. **建表登记**：新增 Supabase 表必须登记进「数据库监测中心」（三处：降级清单 + TABLE_DESC + RPC 枚举）。
6. **部署走 GitHub Pages**：用户自己上线（`deploy.bat` 等），AI 不自动 commit/push；不生成 CloudStudio 预览链接。
7. **不主动生成文档**：除非用户明确要求「写文档/生成 md」等字眼（本次为明确要求，故产出本文件）。

---

## 十一、当前已知待办 / 风险

- `.env` 含真实密钥且已推公开仓库 → 需轮换 + 仓库转私有。
- 默认超管 `admin/admin123`、无盐 SHA-256 客户端比对、RLS 全 `using(true)` 全网可读写 → 安全整改（P0）。
- `dist_*` 误提交产物需 `git rm --cached` 清理（`.gitignore` 已加 `dist_*`）。
- 角色权限保存后刷新变回的 bug 已修（`normalizeConfig` 不再强制注入默认权限、`hasPermission` 不再运行时展开）。
