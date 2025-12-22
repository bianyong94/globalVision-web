import React from "react"
import { Home, Compass, User } from "lucide-react"

interface BottomNavProps {
  activeTab: string
  onChange: (tab: "home" | "search" | "profile") => void
  darkMode: boolean
}

const BottomNav: React.FC<BottomNavProps> = ({
  activeTab,
  onChange,
  darkMode,
}) => {
  const tabs = [
    { id: "home", icon: Home, label: "首页" },
    { id: "search", icon: Compass, label: "发现" }, // 搜索即发现
    { id: "profile", icon: User, label: "我的" },
  ]

  return (
    <div
      className={`fixed bottom-0 left-0 right-0 z-50 border-t ${
        darkMode ? "bg-zinc-950 border-zinc-800" : "bg-white border-gray-200"
      } pb-safe`}
    >
      <div className="flex justify-around items-center h-16">
        {tabs.map((tab) => {
          const Icon = tab.icon
          const isActive = activeTab === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => onChange(tab.id as any)}
              className={`flex flex-col items-center justify-center w-full h-full space-y-1 ${
                isActive
                  ? "text-blue-500"
                  : darkMode
                  ? "text-zinc-500 hover:text-zinc-300"
                  : "text-gray-400 hover:text-gray-600"
              }`}
            >
              <Icon size={22} strokeWidth={isActive ? 2.5 : 2} />
              <span className="text-[10px] font-medium">{tab.label}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

export default BottomNav
