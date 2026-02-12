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
import { AliveScope, KeepAlive } from "react-activation"

// --- 🏗️ 布局容器 ---
const MainLayout = () => {
  return (
    <div className={`min-h-screen bg-[#050505] `}>
      <div className="flex-1">
        <Outlet />
      </div>

      {<BottomNav />}
    </div>
  )
}

const App = () => {
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
        <AliveScope>
          <Routes>
            {/* 主布局路由组 */}
            <Route element={<MainLayout />}>
              <Route
                path="/"
                element={
                  <KeepAlive
                    id="home"
                    cacheKey="home"
                    saveScrollPosition="screen"
                  >
                    <Home />
                  </KeepAlive>
                }
              />
              <Route
                path="/search"
                element={
                  <KeepAlive
                    id="search"
                    cacheKey="search"
                    saveScrollPosition="screen"
                  >
                    <Search />
                  </KeepAlive>
                }
              />
              <Route path="/profile" element={<Profile />} />
              <Route path="/disclaimer" element={<Disclaimer />} />
              <Route path="/privacy" element={<PrivacyPolicy />} />
            </Route>

            {/* 详情页通常全屏，不需要 Nav */}
            <Route path="/detail/:id" element={<Detail />} />
          </Routes>
        </AliveScope>
      </Router>
    </AuthProvider>
  )
}

export default App
