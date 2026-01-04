import React, { useEffect } from "react"
import { HashRouter as Router, Routes, Route, Outlet } from "react-router-dom"
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

const MainLayout = () => {
  return (
    <>
      <Outlet />
      <BottomNav />
    </>
  )
}

const App = () => {
  useEffect(() => {
    // 阻止 document 级别的 touchmove，除非目标是可滚动的
    // 注意：这个方法比较暴力，可能会影响某些正常的内部滚动，
    // 建议先只用上面的 CSS 方案。如果 CSS 方案不够完美再加这个。

    document.body.addEventListener(
      "touchmove",
      function (e) {
        // 如果需要，可以在这里做更复杂的逻辑判断
      },
      { passive: false }
    )
  }, [])
  return (
    <AuthProvider>
      <Toaster
        position="top-center"
        toastOptions={{
          // 定义默认样式 (黑底白字，磨砂质感)
          style: {
            background: "rgba(20, 20, 20, 0.8)",
            backdropFilter: "blur(10px)",
            border: "1px solid rgba(255, 255, 255, 0.1)",
            color: "#fff",
            fontSize: "14px",
            padding: "12px 20px",
            borderRadius: "50px",
            boxShadow: "0 10px 30px rgba(0,0,0,0.5)",
          },
          // 定义成功样式
          success: {
            iconTheme: { primary: "#10b981", secondary: "white" }, // 翠绿色
          },
          // 定义错误样式
          error: {
            iconTheme: { primary: "#ef4444", secondary: "white" }, // 红色
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
      <InstallPwaPrompt />
    </AuthProvider>
  )
}

export default App
