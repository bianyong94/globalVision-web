import React, { useEffect, useState } from "react"
import { User, LogOut, Clock, History, RefreshCw } from "lucide-react"
import { User as UserType, fetchUserHistory } from "../services/auth" // 👈 引入新函数
import VideoGrid from "../components/VideoGrid"
import { VideoResource } from "../types"

interface ProfileProps {
  user: UserType
  onLogout: () => void
  onVideoClick: (v: VideoResource) => void
  darkMode: boolean
}

const Profile: React.FC<ProfileProps> = ({
  user,
  onLogout,
  onVideoClick,
  darkMode,
}) => {
  // 1. 本地状态，默认值先取 user.history (作为缓存显示)，随后会被 API 覆盖
  const [historyList, setHistoryList] = useState<VideoResource[]>(
    user.history || []
  )
  const [loading, setLoading] = useState(false)

  // 2. 核心修复：页面加载时，去后端拉取最新数据
  useEffect(() => {
    const loadHistory = async () => {
      setLoading(true)
      const latestHistory = await fetchUserHistory(user.username)
      if (latestHistory && latestHistory.length > 0) {
        setHistoryList(latestHistory)

        // 可选：同步更新本地存储，防止刷新后又变回旧的
        const updatedUser = { ...user, history: latestHistory }
        localStorage.setItem("app_user", JSON.stringify(updatedUser))
      }
      setLoading(false)
    }

    loadHistory()
  }, [user.username]) // 依赖用户名，用户名变了才重查

  // 格式化秒数为 mm:ss
  const formatTime = (seconds: number) => {
    if (!seconds) return "0%"
    const m = Math.floor(seconds / 60)
    const s = Math.floor(seconds % 60)
    return `${m}分${s}秒`
  }

  return (
    <div
      className={`min-h-screen pb-20 ${
        darkMode ? "bg-zinc-950 text-white" : "bg-white"
      }`}
    >
      {/* 头部信息 */}
      <div className="p-6 pt-10 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-blue-500 to-purple-600 flex items-center justify-center text-white font-black text-2xl shadow-lg shadow-blue-500/20">
            {user.username.charAt(0).toUpperCase()}
          </div>
          <div>
            <h2 className="text-xl font-bold">{user.username}</h2>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs text-gray-500 bg-zinc-800 px-2 py-0.5 rounded">
                ID: {user.id}
              </span>
            </div>
          </div>
        </div>
        <button
          onClick={onLogout}
          className="p-2.5 bg-zinc-800/50 rounded-full text-zinc-400 hover:text-white hover:bg-red-500/20 hover:text-red-500 transition-colors"
        >
          <LogOut size={20} />
        </button>
      </div>

      {/* 历史记录 */}
      <div className="px-4 mt-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <History size={18} className="text-blue-500" />
            <h3 className="font-bold">观看历史</h3>
            <span className="text-xs text-gray-500">最近50条</span>
          </div>
          {loading && (
            <RefreshCw size={14} className="animate-spin text-gray-500" />
          )}
        </div>

        {historyList && historyList.length > 0 ? (
          <div className="grid grid-cols-3 gap-3">
            {/* 手动渲染历史列表，以便显示进度信息 */}
            {historyList.map((video: any) => (
              <div
                key={video.id}
                onClick={() => onVideoClick(video)}
                className="relative group cursor-pointer"
              >
                {/* 封面 */}
                <div className="aspect-[2/3] rounded-xl overflow-hidden bg-zinc-800 relative">
                  <img
                    src={video.poster}
                    alt={video.title}
                    className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-opacity"
                  />
                  {/* 进度条覆盖层 */}
                  <div className="absolute bottom-0 left-0 right-0 bg-black/60 backdrop-blur-sm p-1.5">
                    <p className="text-[10px] text-white truncate text-center">
                      {video.episodeIndex !== undefined
                        ? `第${video.episodeIndex + 1}集`
                        : "上次观看"}
                      <span className="text-blue-400 ml-1">
                        {formatTime(video.progress)}
                      </span>
                    </p>
                  </div>
                </div>
                <h4 className="text-xs font-medium mt-2 line-clamp-1 text-gray-300 group-hover:text-blue-400">
                  {video.title}
                </h4>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-10 border-2 border-dashed border-gray-800 rounded-xl bg-zinc-900/30">
            <Clock size={30} className="mx-auto text-gray-600 mb-2" />
            <p className="text-sm text-gray-500">暂无观看记录</p>
            <p className="text-xs text-gray-600 mt-1">快去首页看看吧</p>
          </div>
        )}
      </div>
    </div>
  )
}

export default Profile
