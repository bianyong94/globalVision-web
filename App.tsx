import React, { useState, useEffect } from "react"
import Home from "./pages/Home"
import Detail from "./pages/Detail"
import Search from "./pages/Search"
import Login from "./pages/Login"
import Profile from "./pages/Profile"
import BottomNav from "./components/BottomNav"
import { VideoResource } from "./types"
import { User, syncHistory } from "./services/auth"

const App = () => {
  const [user, setUser] = useState<User | null>(null)
  const [activeTab, setActiveTab] = useState<"home" | "search" | "profile">(
    "home"
  )
  const [selectedVideo, setSelectedVideo] = useState<VideoResource | null>(null)
  const [initialCategory, setInitialCategory] = useState(0)
  const darkMode = true

  // 初始化检查登录
  useEffect(() => {
    const savedUser = localStorage.getItem("app_user")
    if (savedUser) setUser(JSON.parse(savedUser))
  }, [])

  const handleLoginSuccess = (userData: User) => {
    setUser(userData)
    localStorage.setItem("app_user", JSON.stringify(userData))
  }

  const handleLogout = () => {
    setUser(null)
    localStorage.removeItem("app_user")
    setActiveTab("home")
  }

  const handleVideoSelect = (video: VideoResource) => {
    setSelectedVideo(video)
    // ⚠️ 注意：这里不再自动同步历史，改为在播放器内部根据进度同步
  }

  // 1. 如果在详情页
  if (selectedVideo) {
    return (
      <Detail
        video={selectedVideo}
        onBack={() => setSelectedVideo(null)}
        darkMode={darkMode}
        currentUser={user} // 传入用户，用于内部判断是否保存历史
        onUpdateUser={(u) => {
          setUser(u)
          localStorage.setItem("app_user", JSON.stringify(u))
        }}
      />
    )
  }

  // 2. 主界面路由
  const renderContent = () => {
    if (activeTab === "home") {
      return (
        <Home
          onVideoSelect={handleVideoSelect}
          onNavigateMore={(id) => {
            setInitialCategory(id)
            setActiveTab("search")
          }}
          darkMode={darkMode}
        />
      )
    }
    if (activeTab === "search") {
      return (
        <Search
          onVideoSelect={handleVideoSelect}
          darkMode={darkMode}
          initialCategory={initialCategory}
          key={initialCategory}
        />
      )
    }
    if (activeTab === "profile") {
      // 🟢 修改点：只有在进入“我的”且未登录时，才显示登录页
      if (!user) {
        return <Login onLoginSuccess={handleLoginSuccess} darkMode={darkMode} />
      }
      return (
        <Profile
          user={user}
          onLogout={handleLogout}
          onVideoClick={handleVideoSelect}
          darkMode={darkMode}
        />
      )
    }
  }

  return (
    <div
      className={
        darkMode
          ? "bg-zinc-950 min-h-screen text-white"
          : "bg-white min-h-screen text-gray-900"
      }
    >
      {activeTab === "home" && (
        <div className="sticky top-0 z-30 bg-zinc-950/90 backdrop-blur-md p-4 border-b border-white/5">
          <h1 className="text-xl font-black text-blue-500 tracking-tighter">
            Global Vision
          </h1>
        </div>
      )}

      <div className="pb-16">{renderContent()}</div>

      <BottomNav
        activeTab={activeTab}
        onChange={(tab) => {
          setActiveTab(tab)
          if (tab === "search") setInitialCategory(0)
        }}
        darkMode={darkMode}
      />
    </div>
  )
}

export default App
