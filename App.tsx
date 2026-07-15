import React, { Suspense, lazy, useEffect, useState } from "react"
import {
  HashRouter as Router,
  Routes,
  Route,
  useLocation,
} from "react-router-dom"
import { Toaster } from "react-hot-toast"
import BottomNav from "./components/BottomNav"
import InstallPwaPrompt from "./components/InstallPwaPrompt"

const Home = lazy(() => import("./pages/Home"))
const Explore = lazy(() => import("./pages/Explore"))
const Search = lazy(() => import("./pages/Search"))
const Detail = lazy(() => import("./pages/Detail"))
const Profile = lazy(() => import("./pages/Profile"))
const PrivacyPolicy = lazy(() => import("./pages/PrivacyPolicy"))

const TAB_PATHS = ["/", "/explore", "/profile"] as const
type TabPath = (typeof TAB_PATHS)[number]

const isTabPath = (path: string): path is TabPath =>
  TAB_PATHS.includes(path as TabPath)

const shouldMountTab = (visitedTabs: Set<TabPath>, path: TabPath) =>
  visitedTabs.has(path)

const KeepAliveLayout = () => {
  const location = useLocation()
  const isTabPage = isTabPath(location.pathname)
  const activeTab: TabPath = isTabPath(location.pathname)
    ? location.pathname
    : "/"
  const [visitedTabs, setVisitedTabs] = useState<Set<TabPath>>(
    () => new Set([activeTab]),
  )

  useEffect(() => {
    if (!isTabPage) return
    const tabPath = location.pathname as TabPath
    setVisitedTabs((current) => {
      if (current.has(tabPath)) return current
      const next = new Set(current)
      next.add(tabPath)
      return next
    })
  }, [isTabPage, location.pathname])

  return (
    <div className="min-h-screen bg-[#08090f] text-white">
      <div
        className="fixed inset-0 overflow-y-auto"
        style={{ visibility: isTabPage && location.pathname === "/" ? "visible" : "hidden", zIndex: isTabPage && location.pathname === "/" ? 1 : 0 }}
      >
        {shouldMountTab(visitedTabs, "/") ? <Home /> : null}
      </div>
      <div
        className="fixed inset-0 overflow-y-auto"
        style={{ visibility: isTabPage && location.pathname === "/explore" ? "visible" : "hidden", zIndex: isTabPage && location.pathname === "/explore" ? 1 : 0 }}
      >
        {shouldMountTab(visitedTabs, "/explore") ? <Explore /> : null}
      </div>
      <div
        className="fixed inset-0 overflow-y-auto"
        style={{ visibility: isTabPage && location.pathname === "/profile" ? "visible" : "hidden", zIndex: isTabPage && location.pathname === "/profile" ? 1 : 0 }}
      >
        {shouldMountTab(visitedTabs, "/profile") ? <Profile /> : null}
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

      <Suspense
        fallback={<div className="min-h-screen bg-[#08090f]" aria-hidden="true" />}
      >
        <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <InstallPwaPrompt />
          <Routes>
            <Route path="/search" element={<Search />} />
            <Route path="/detail/:id" element={<Detail />} />
            <Route path="/privacy-policy" element={<PrivacyPolicy />} />
            <Route path="*" element={<KeepAliveLayout />} />
          </Routes>
        </Router>
      </Suspense>
    </>
  )
}

export default App
