import React, { useEffect, useState } from "react"
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

// --- TV 侧边栏组件 (替代 BottomNav) ---
const SideNav = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const { ref, focusKey } = useFocusable()

  const NavItem = ({ path, icon: Icon, label }: any) => {
    const isActive = location.pathname === path
    const { ref: itemRef, focused } = useFocusable({
      onEnterPress: () => navigate(path),
    })

    return (
      <div
        ref={itemRef}
        onClick={() => navigate(path)}
        className={`
          flex flex-col items-center justify-center w-16 h-16 rounded-xl mb-4 transition-all duration-200
          ${focused ? "bg-emerald-500 scale-110 shadow-lg z-10" : "bg-transparent"}
          ${isActive && !focused ? "text-emerald-500" : "text-gray-400"}
          ${focused ? "text-white" : ""}
        `}
      >
        <Icon size={24} />
        {focused && <span className="text-[10px] mt-1 font-bold">{label}</span>}
      </div>
    )
  }

  return (
    <FocusContext.Provider value={focusKey}>
      <div
        ref={ref}
        className="w-20 h-screen bg-[#0a0a0a]/95 border-r border-white/5 flex flex-col items-center py-10 fixed left-0 top-0 z-50"
      >
        <div className="mb-10 w-10 h-10 bg-emerald-600 rounded-lg flex items-center justify-center font-black text-white italic">
          GV
        </div>
        <div className="flex-1 flex flex-col items-center w-full">
          <NavItem path="/" icon={HomeIcon} label="首页" />
          <NavItem path="/search" icon={SearchIcon} label="搜索" />
          <NavItem path="/profile" icon={UserIcon} label="我的" />
        </div>
      </div>
    </FocusContext.Provider>
  )
}

// --- 布局容器 ---
const MainLayout = () => {
  // 简单判断：如果是 Android 平台，我们假设它是 TV (或者你可以结合屏幕宽度判断)
  // 如果你需要同时打包手机版APK和TV版APK，建议在 capacitor.config.json 里区分，或者用媒体查询
  const isAndroid = Capacitor.getPlatform() === "android"

  // 也可以结合 CSS 媒体查询：横屏且宽度大于一定值才算 TV
  // const isLandscape = window.matchMedia("(orientation: landscape)").matches;
  // const isTV = isAndroid || (isLandscape && window.innerWidth > 960);

  // 暂时简单粗暴，假设打包成 Android 就是为了跑 TV
  const isTV = isAndroid

  return (
    <div className={`min-h-screen bg-[#0a0a0a] ${isTV ? "pl-20" : ""}`}>
      {/* TV 端显示侧边栏 */}
      {isTV && <SideNav />}

      <div className="flex-1">
        <Outlet />
      </div>

      {/* 移动端/网页端显示底部导航 */}
      {!isTV && <BottomNav />}
    </div>
  )
}

const App = () => {
  // 🔥 启动全局键盘监听
  useTvNav()
  useEffect(() => {
    // 阻止 document 级别的 touchmove (保留你原有的逻辑)
    document.body.addEventListener("touchmove", function (e) {}, {
      passive: false,
    })

    // --- TV 物理返回键监听 ---
    // 如果不加这个，在 TV 上按返回键会直接退出应用，体验很差
    const backListener = CapacitorApp.addListener(
      "backButton",
      ({ canGoBack }) => {
        if (canGoBack) {
          window.history.back()
        } else {
          // 如果在首页且无法后退，才退出应用
          // 这里可以加一个 Toast 提示 "再按一次退出"
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
      <Toaster
        position="top-center"
        toastOptions={{
          style: {
            background: "rgba(20, 20, 20, 0.9)", // TV 上稍微深一点
            backdropFilter: "blur(10px)",
            border: "2px solid rgba(255, 255, 255, 0.1)", // 边框加粗一点，TV 看得清
            color: "#fff",
            fontSize: "18px", // 字体加大，适配 TV 远距离观看
            padding: "16px 24px",
            borderRadius: "50px",
            boxShadow: "0 10px 30px rgba(0,0,0,0.8)",
          },
          success: {
            iconTheme: { primary: "#10b981", secondary: "white" },
          },
          error: {
            iconTheme: { primary: "#ef4444", secondary: "white" },
          },
        }}
      />
      <Router>
        <Routes>
          <Route element={<MainLayout />}>
            <Route path="/" element={<Home />} />
            <Route path="/search" element={<Search />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/disclaimer" element={<Disclaimer />} />
            <Route path="/privacy" element={<PrivacyPolicy />} />
          </Route>
          <Route path="/detail/:id" element={<Detail />} />
        </Routes>
      </Router>

      {/* PWA 提示在 TV 上不需要，可以隐藏 */}
      {Capacitor.getPlatform() === "web" && <InstallPwaPrompt />}
    </AuthProvider>
  )
}

export default App
