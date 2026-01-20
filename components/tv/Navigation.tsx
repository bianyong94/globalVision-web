import React from "react"
import {
  initNavigation,
  useFocusable,
  FocusContext,
} from "@noriginmedia/react-spatial-navigation"

// 初始化导航
initNavigation()

// 封装一个可聚焦的组件 (例如海报卡片)
const FocusableCard = ({ title, onClick }) => {
  const { ref, focused } = useFocusable({
    onEnterPress: onClick, // 遥控器确认键
  })

  return (
    <div
      ref={ref}
      style={{
        border: focused ? "5px solid #2ecc71" : "5px solid transparent", // 焦点样式
        transform: focused ? "scale(1.1)" : "scale(1)",
        transition: "all 0.2s",
        margin: "10px",
        padding: "20px",
        background: "#333",
        color: "white",
      }}
    >
      {title}
    </div>
  )
}

// 页面布局
const App = () => {
  return (
    <div style={{ display: "flex" }}>
      <FocusableCard title="电影 A" onClick={() => console.log("Play A")} />
      <FocusableCard title="电影 B" onClick={() => console.log("Play B")} />
    </div>
  )
}
