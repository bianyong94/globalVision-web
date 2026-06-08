import React from "react"
import {
  HashRouter as Router,
  Routes,
  Route,
  Outlet,
} from "react-router-dom"
import { Toaster } from "react-hot-toast"
import BottomNav from "./components/BottomNav"
import Home from "./pages/Home"
import Search from "./pages/Search"
import Detail from "./pages/Detail"
import Profile from "./pages/Profile"

const MainLayout = () => {
  return (
    <div className="min-h-screen bg-[#08090f] text-white">
      <Outlet />
      <BottomNav />
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
          <Route element={<MainLayout />}>
            <Route path="/" element={<Home />} />
            <Route path="/search" element={<Search />} />
            <Route path="/profile" element={<Profile />} />
          </Route>
          <Route path="/detail/:id" element={<Detail />} />
        </Routes>
      </Router>
    </>
  )
}

export default App
