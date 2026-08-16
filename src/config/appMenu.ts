// 全局菜单唯一数据源：侧边栏（App.vue）与权限树（PERMISSION_TREE）均由此派生。
// 新增页面只需在此追加一项，左侧菜单与角色权限树会自动同步（满足「权限管理要自动添加」）。
import type { Component } from 'vue'
import type { AppUser } from '../services/appDataService'
import {
  Coin,
  HomeFilled,
  MagicStick,
  DataAnalysis,
  Compass,
  TrendCharts,
  Histogram,
  Van,
  Sunny,
  Location,
  Link,
  Reading,
  Document,
  Aim,
  DataBoard,
  List,
  Setting,
  User,
  Cpu,
  ChatLineSquare,
  Notebook,
  Odometer,
  VideoPlay,
  Medal
} from '@element-plus/icons-vue'

export interface SideItem {
  key: string
  label: string
  icon?: Component
  to?: string | { path: string; query: Record<string, string> }
  /** 外部独立页面（单文件 HTML）。点击在新标签打开，不走 SPA 路由 */
  href?: string
  /** 可见性判断（返回 true 才显示）。仅权限管理类菜单使用 */
  visible?: (user: AppUser | null) => boolean
  /** 细粒度权限模块 key（用于菜单可见性与路由门禁，对应权限树叶子节点的基础 key） */
  permissionKey?: string
  children?: SideItem[]
  expanded?: boolean
}

/** 仅超级管理员 / 管理员可见（权限管理分组） */
export const canManageSystem = (u: AppUser | null): boolean =>
  u?.role === 'superadmin' || u?.role === 'admin'

export const APP_MENU: SideItem[] = [
  {
    key: 'welcome',
    label: '首页',
    icon: HomeFilled,
    to: '/welcome'
  },
  {
    key: 'database',
    label: '数据库监测',
    icon: Coin,
    permissionKey: 'database',
    to: '/database'
  },
  {
    key: 'lianzhicang',
    label: '联智舱',
    icon: MagicStick,
    expanded: true,
    permissionKey: 'ai',
    children: [
      { key: 'ai', label: 'AI 助手', icon: MagicStick, permissionKey: 'ai', to: '/ai' },
      { key: 'models', label: '模型中心', icon: DataAnalysis, permissionKey: 'models', to: '/models' },
      { key: 'aimodels', label: 'AI模型知识', icon: Cpu, permissionKey: 'aimodels', to: '/aimodels' }
    ]
  },
  {
    key: 'fanjingzhixie',
    label: '凡境智协',
    icon: Compass,
    expanded: true,
    permissionKey: 'dashboard',
    children: [
      { key: 'news', label: '新闻聚合', icon: TrendCharts, permissionKey: 'news', to: '/news' },
      { key: 'yingcang', label: '影仓智核', icon: Histogram, permissionKey: 'yingcang', to: '/yingcang' },
      { key: 'xingyu', label: '星舆识途', icon: Van, permissionKey: 'xingyu', to: '/xingyu' },
      { key: 'weather', label: '天气', icon: Sunny, permissionKey: 'weather', to: '/weather' },
      { key: 'map', label: '地图', icon: Location, permissionKey: 'map', to: '/map' },
      { key: 'third-api', label: '第三方API', icon: Link, permissionKey: 'third-api', to: '/third-api' }
    ]
  },
  {
    key: 'learncenter',
    label: '学习中心',
    icon: Reading,
    expanded: true,
    permissionKey: 'dashboard',
    children: [
      {
        key: 'learn-english',
        label: '学位英语',
        icon: Document,
        expanded: true,
        permissionKey: 'learn-english',
        children: [
          { key: 'degree-legacy', label: '备考台', icon: Document, permissionKey: 'degree-legacy', to: '/learn/english' }
        ]
      },
      { key: 'learn-industry', label: '各行业知识', icon: DataBoard, permissionKey: 'learn-industry', to: '/learn/industry' },
      { key: 'learn-books', label: '书籍阅读', icon: Reading, permissionKey: 'learn-books', to: '/learn/books' },
      { key: 'learn-goals', label: '学习目标', icon: Aim, permissionKey: 'learn-goals', to: '/learn/goals' },
      { key: 'cet-prep', label: '四六级备考台', icon: Notebook, permissionKey: 'cet-prep', to: '/learn/cet-prep' }
    ]
  },
  {
    key: 'requirements',
    label: '需求收集',
    icon: TrendCharts,
    permissionKey: 'requirements',
    to: '/requirements'
  },
  {
    key: 'worktasks',
    label: '工作任务',
    icon: List,
    expanded: true,
    permissionKey: 'worktasks',
    children: [
      { key: 'overview', label: '工作数据看板', icon: DataBoard, permissionKey: 'dashboard', to: { path: '/dashboard', query: { view: 'overview' } } },
      { key: 'todos', label: '待办', icon: List, permissionKey: 'todos', to: { path: '/dashboard', query: { view: 'todos' } } },
      { key: 'points', label: '点位', icon: Location, permissionKey: 'points', to: { path: '/dashboard', query: { view: 'points' } } },
      { key: 'contents', label: '内容', icon: Document, permissionKey: 'contents', to: { path: '/dashboard', query: { view: 'contents' } } }
    ]
  },
  {
    key: 'feedback',
    label: '意见反馈',
    icon: ChatLineSquare,
    permissionKey: 'feedback',
    to: '/feedback'
  },
  {
    key: 'system',
    label: '权限管理',
    icon: Setting,
    expanded: false,
    visible: canManageSystem,
    permissionKey: 'system',
    children: [
      { key: 'system-accounts', label: '账号管理', permissionKey: 'system.accounts', to: '/system?view=accounts' },
      { key: 'system-roles', label: '角色权限', permissionKey: 'system.roles', to: '/system?view=roles' },
      // 反馈管理：仅超级管理员可见（普通管理员/子账号无入口；视图内 isFeedbackAdmin() 二次拦截）
      { key: 'feedback-admin', label: '反馈管理', permissionKey: 'feedback.admin', to: '/feedback-admin', visible: (u) => u?.role === 'superadmin' },
      { key: 'push', label: '消息推送', permissionKey: 'system', to: '/push' }
    ]
  },
  { key: 'account', label: '个人设置', icon: User, to: '/account' }
]
