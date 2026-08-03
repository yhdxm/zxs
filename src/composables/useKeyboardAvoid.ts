import { onMounted, onBeforeUnmount } from 'vue'

/**
 * 移动端键盘避让：聚焦输入类元素或虚拟键盘展开时，
 * 把当前聚焦元素滚动到可视区域中央，避免被软键盘遮挡。
 * 仅依赖 visualViewport / focusin，无任何外部依赖。
 */
export function useKeyboardAvoid() {
  const isField = (el: Element | null): boolean => {
    if (!el) return false
    const tag = el.tagName
    return (
      tag === 'INPUT' ||
      tag === 'TEXTAREA' ||
      (el as HTMLElement).isContentEditable === true ||
      !!el.closest('.el-input, .el-textarea, .van-field')
    )
  }

  const scrollActiveIntoView = () => {
    const el = document.activeElement as HTMLElement | null
    if (isField(el)) {
      // 延迟一帧，等布局稳定（键盘动画/弹窗展开）后再滚动
      window.setTimeout(() => {
        el!.scrollIntoView({ block: 'center', behavior: 'smooth' })
      }, 120)
    }
  }

  const onFocusIn = (e: FocusEvent) => {
    if (isField(e.target as Element)) scrollActiveIntoView()
  }

  const onVvResize = () => scrollActiveIntoView()

  onMounted(() => {
    document.addEventListener('focusin', onFocusIn)
    if (typeof window !== 'undefined' && window.visualViewport) {
      window.visualViewport.addEventListener('resize', onVvResize)
      window.visualViewport.addEventListener('scroll', onVvResize)
    }
  })

  onBeforeUnmount(() => {
    document.removeEventListener('focusin', onFocusIn)
    if (typeof window !== 'undefined' && window.visualViewport) {
      window.visualViewport.removeEventListener('resize', onVvResize)
      window.visualViewport.removeEventListener('scroll', onVvResize)
    }
  })
}
