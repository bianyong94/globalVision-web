import React from "react"
import {
  HashRouter as Router,
  Routes,
  Route,
  useLocation,
} from "react-router-dom"
import { Toaster } from "react-hot-toast"
import BottomNav from "./components/BottomNav"
import Home from "./pages/Home"
import Search from "./pages/Search"
import Detail from "./pages/Detail"
import Profile from "./pages/Profile"

const TAB_PATHS = ["/", "/search", "/profile"] as const

const KeepAliveLayout = () => {
  const location = useLocation()
  const isTabPage = TAB_PATHS.includes(location.pathname as any)

  return (
    <div className="min-h-screen bg-[#08090f] text-white">
      <div
        className="fixed inset-0 overflow-y-auto"
        style={{ visibility: isTabPage && location.pathname === "/" ? "visible" : "hidden", zIndex: isTabPage && location.pathname === "/" ? 1 : 0 }}
      >
        <Home />
      </div>
      <div
        className="fixed inset-0 overflow-y-auto"
        style={{ visibility: isTabPage && location.pathname === "/search" ? "visible" : "hidden", zIndex: isTabPage && location.pathname === "/search" ? 1 : 0 }}
      >
        <Search />
      </div>
      <div
        className="fixed inset-0 overflow-y-auto"
        style={{ visibility: isTabPage && location.pathname === "/profile" ? "visible" : "hidden", zIndex: isTabPage && location.pathname === "/profile" ? 1 : 0 }}
      >
        <Profile />
      </div>
      {isTabPage && <BottomNav />}
    </div>
  )
}

const App = () => {
  return (
    <>
      <Toaster
        position="top-center"
        toastOptions={{
          style: {
            background: "rgba(15, 18, 30, 0.96)",
            backdropFilter: "blur(14px)",
            border: "1px solid rgba(255, 255, 255, 0.08)",
            color: "#fff",
            borderRadius: "16px",
          },
          success: { iconTheme: { primary: "#84cc16", secondary: "white" } },
        }}
      />

      <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Routes>
          <Route path="/detail/:id" element={<Detail />} />
          <Route path="*" element={<KeepAliveLayout />} />
        </Routes>
      </Router>
    </>
  )
}

export default App
