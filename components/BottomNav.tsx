import React from "react"
import { useLocation, useNavigate } from "react-router-dom"
import { Clapperboard, Compass, Home, User2 } from "lucide-react"

const NAV_ITEMS = [
  { icon: Home, label: "首页", path: "/" },
  { icon: Compass, label: "探索", path: "/explore" },
  { icon: Clapperboard, label: "短视频", path: "/shorts" },
  { icon: User2, label: "我的", path: "/profile" },
]

const BottomNav = () => {
  const navigate = useNavigate()
  const location = useLocation()

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-50  bg-[#0b0d14]/92 backdrop-blur-xl"
      style={{ "--bottom-nav-height": "5.5rem" } as React.CSSProperties}
    >
      <div className="mx-auto flex max-w-3xl items-center justify-between px-4 pb-[calc(env(safe-area-inset-bottom)+0.5rem)] pt-2">
        {NAV_ITEMS.map((item) => {
          const active = location.pathname === item.path
          const Icon = item.icon
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className="flex flex-1 flex-col items-center justify-center gap-1 rounded-2xl px-3 py-2"
            >
              <Icon
                size={20}
                className={active ? "text-lime-400" : "text-white/55"}
                strokeWidth={active ? 2.5 : 2}
              />
              <span
                className={
                  active
                    ? "text-[11px] font-semibold text-white"
                    : "text-[11px] text-white/45"
                }
              >
                {item.label}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

export default BottomNav
