// 全站响应式断点「唯一真相源」（single source of truth）
//
// 约定：
// - 全局壳层（App.vue 侧边栏 / 移动端底部导航切换）统一以 MOBILE_MAX 为 PC/移动 分界。
// - 各视图内部的「列布局堆叠」断点（如 1024/1100/900/860/640/560/480）属于组件自身响应式，
//   不在此约束，避免与壳层切换冲突造成 769–1024px 平板区间布局错乱。
export const MOBILE_MAX = 768

export const BREAKPOINTS = {
  mobile: MOBILE_MAX,
  tablet: 1024,
  smallPhone: 480
} as const
