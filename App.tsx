import React, { useEffect } from "react"
import {
  HashRouter as Router,
  Routes,
  Route,
  Outlet,
  useNavigate,
  useLocation,
} from "react-router-dom"
import { AuthProvider } from "./context/AuthContext"
import Home from "./pages/Home"
import Search from "./pages/Search"
import Detail from "./pages/Detail"
import Profile from "./pages/Profile"
import BottomNav from "./components/BottomNav"
import Disclaimer from "./pages/Disclaimer"
import PrivacyPolicy from "./pages/PrivacyPolicy"
import { Toaster } from "react-hot-toast"
import InstallPwaPrompt from "./components/InstallPwaPrompt"
import { useTvNav } from "./hooks/useTvNav"
import { Capacitor } from "@capacitor/core"
import { App as CapacitorApp } from "@capacitor/app"
import {
  Home as HomeIcon,
  Search as SearchIcon,
  User as UserIcon,
} from "lucide-react"

// --- 📺 TV 侧边栏组件 (极简原生版) ---
const SideNav = () => {
  const navigate = useNavigate()
  const location = useLocation()

  // 内部小组件：导航项
  const NavItem = ({ path, icon: Icon, label }: any) => {
    const isActive = location.pathname === path

    return (
      <div
        // 🔥 关键：使用 tabIndex 让 div 可被键盘聚焦
        tabIndex={0}
        onClick={() => navigate(path)}
        onKeyDown={(e) => {
          if (e.key === "Enter") navigate(path)
        }}
        className={`
          flex flex-col items-center justify-center w-14 h-14 rounded-xl mb-4 
          transition-all duration-200 outline-none cursor-pointer
          /* 📱 默认样式 */
          ${isActive ? "text-emerald-500" : "text-gray-400"}
          /* 📺 TV 聚焦样式 (由浏览器/遥控器控制) */
          focus:bg-emerald-500 focus:text-white focus:scale-110 focus:shadow-[0_0_20px_rgba(16,185,129,0.5)]
        `}
      >
        <Icon size={24} />
        <span className="text-[9px] mt-1 font-medium">{label}</span>
      </div>
    )
  }

  return (
    <div className="w-20 h-screen bg-[#050505] border-r border-white/5 flex flex-col items-center py-10 fixed left-0 top-0 z-50">
      <div className="mb-10 w-10 h-10 bg-emerald-600 rounded-lg flex items-center justify-center font-black text-white italic shadow-lg shadow-emerald-900/20">
        GV
      </div>
      <div className="flex-1 flex flex-col items-center w-full">
        <NavItem path="/" icon={HomeIcon} label="首页" />
        <NavItem path="/search" icon={SearchIcon} label="发现" />
        <NavItem path="/profile" icon={UserIcon} label="我的" />
      </div>
    </div>
  )
}

// --- 🏗️ 布局容器 ---
const MainLayout = () => {
  const isAndroid = Capacitor.getPlatform() === "android"
  // 识别是否是 TV 端环境
  const isTV = isAndroid

  return (
    <div className={`min-h-screen bg-[#050505] ${isTV ? "pl-20" : ""}`}>
      {/* 📺 TV 端：显示左侧侧边栏 */}
      {isTV && <SideNav />}

      <div className="flex-1">
        <Outlet />
      </div>

      {/* 📱 移动端/网页端：显示底部导航 */}
      {!isTV && <BottomNav />}
    </div>
  )
}

const App = () => {
  // 🔥 启动我们自己写的全局键盘焦点移动算法
  useTvNav()

  useEffect(() => {
    // 阻止 touchmove 的默认行为 (如果需要)
    const preventDefault = (e: TouchEvent) => {}
    document.body.addEventListener("touchmove", preventDefault, {
      passive: false,
    })

    // --- TV 物理返回键处理 ---
    const backListener = CapacitorApp.addListener(
      "backButton",
      ({ canGoBack }) => {
        if (canGoBack) {
          window.history.back()
        } else {
          CapacitorApp.exitApp()
        }
      },
    )

    return () => {
      backListener.then((f) => f.remove())
    }
  }, [])

  return (
    <AuthProvider>
      {/* 全局通知组件 */}
      <Toaster
        position="top-center"
        toastOptions={{
          style: {
            background: "rgba(20, 20, 20, 0.95)",
            backdropFilter: "blur(10px)",
            border: "1px solid rgba(255, 255, 255, 0.1)",
            color: "#fff",
            fontSize: "16px",
            padding: "14px 24px",
            borderRadius: "50px",
          },
          success: { iconTheme: { primary: "#10b981", secondary: "white" } },
        }}
      />

      <Router>
        <Routes>
          {/* 主布局路由组 */}
          <Route element={<MainLayout />}>
            <Route path="/" element={<Home />} />
            <Route path="/search" element={<Search />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/disclaimer" element={<Disclaimer />} />
            <Route path="/privacy" element={<PrivacyPolicy />} />
          </Route>

          {/* 详情页通常全屏，不需要 Nav */}
          <Route path="/detail/:id" element={<Detail />} />
        </Routes>
      </Router>

      {/* PWA 提示仅在 Web 环境显示 */}
      {Capacitor.getPlatform() === "web" && <InstallPwaPrompt />}
    </AuthProvider>
  )
}

export default App
