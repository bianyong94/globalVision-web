import React from "react"
import {
  HashRouter as Router,
  Routes,
  Route,
  useLocation,
} from "react-router-dom"
import { Toaster } from "react-hot-toast"
import BottomNav from "./components/BottomNav"
import InstallPwaPrompt from "./components/InstallPwaPrompt"
import Home from "./pages/Home"
import Explore from "./pages/Explore"
import Search from "./pages/Search"
import Detail from "./pages/Detail"
import Profile from "./pages/Profile"
import PrivacyPolicy from "./pages/PrivacyPolicy"
import ShortVideo from "./pages/ShortVideo"

const TAB_PATHS = ["/", "/explore", "/shorts", "/profile"] as const

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
        style={{ visibility: isTabPage && location.pathname === "/shorts" ? "visible" : "hidden", zIndex: isTabPage && location.pathname === "/shorts" ? 1 : 0 }}
      >
        <ShortVideo />
      </div>
      <div
        className="fixed inset-0 overflow-y-auto"
        style={{ visibility: isTabPage && location.pathname === "/explore" ? "visible" : "hidden", zIndex: isTabPage && location.pathname === "/explore" ? 1 : 0 }}
      >
        <Explore />
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
        <InstallPwaPrompt />
        <Routes>
          <Route path="/search" element={<Search />} />
          <Route path="/detail/:id" element={<Detail />} />
          <Route path="/privacy-policy" element={<PrivacyPolicy />} />
          <Route path="/shorts/likes" element={<ShortVideo mode="liked" />} />
          <Route path="*" element={<KeepAliveLayout />} />
        </Routes>
      </Router>
    </>
  )
}

export default App
