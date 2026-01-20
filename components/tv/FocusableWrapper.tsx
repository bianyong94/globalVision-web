import React from "react"
import { Capacitor } from "@capacitor/core"

interface Props {
  children: React.ReactNode
  onEnter?: () => void
  className?: string
}

export const FocusableWrapper: React.FC<Props> = ({
  children,
  onEnter,
  className = "",
}) => {
  const isTV = Capacitor.getPlatform() === "android"

  // 🖱️ PC/手机端：普通 div
  if (!isTV) {
    return (
      <div onClick={onEnter} className={className}>
        {children}
      </div>
    )
  }

  // 📺 TV 端：原生可聚焦 div
  return (
    <div
      tabIndex={0} // 🔥 关键：让 div 可以被聚焦
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          onEnter?.()
        }
      }}
      // 利用 Tailwind 的 focus: 前缀来实现高亮，不用 JS 判断状态
      className={`
        outline-none transition-all duration-200
        focus:ring-4 focus:ring-emerald-500 focus:scale-105 focus:z-10 focus:shadow-xl
        ${className}
      `}
    >
      {children}
    </div>
  )
}
