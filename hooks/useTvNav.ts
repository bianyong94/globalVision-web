import { useEffect } from "react"

export const useTvNav = () => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // 获取当前焦点的元素
      const active = document.activeElement as HTMLElement
      if (!active) return

      // 获取页面上所有能聚焦的元素 (也就是加了 tabIndex 的元素)
      const focusables = Array.from(
        document.querySelectorAll('[tabindex="0"]'),
      ) as HTMLElement[]
      const index = focusables.indexOf(active)

      let nextIndex = index

      switch (e.key) {
        case "ArrowDown":
          // 简单的逻辑：向下找，这里简化为找下一个，你可以写更复杂的几何算法
          // 实际项目中，更简单的做法是用 grid 布局，按下=index+列数
          // 这里为了让你先跑通，我们先做简单的前后移动
          nextIndex = Math.min(index + 1, focusables.length - 1)
          break
        case "ArrowUp":
          nextIndex = Math.max(index - 1, 0)
          break
        case "ArrowRight":
          nextIndex = Math.min(index + 1, focusables.length - 1)
          break
        case "ArrowLeft":
          nextIndex = Math.max(index - 1, 0)
          break
        case "Enter":
        case "Ok":
          active.click() // 模拟点击
          break
        case "Backspace":
        case "Escape":
          window.history.back()
          break
      }

      if (nextIndex !== index) {
        e.preventDefault()
        focusables[nextIndex]?.focus()
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [])
}
