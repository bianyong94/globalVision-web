import React, { useCallback, useEffect, useState } from "react"
import { useLocation, useNavigate } from "react-router-dom"
import {
  CircleUserRound,
  Search,
  History,
  Trash2,
  Play,
} from "lucide-react"
import { getPlayHistory, clearPlayHistory, PlayHistoryItem } from "../utils/history"
import { createImageFallbackHandler, getProxyUrl } from "../utils/common"

const formatTime = (seconds: number) => {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
  return `${m}:${String(s).padStart(2, "0")}`
}

const formatDate = (timestamp: number) => {
  const d = new Date(timestamp)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  if (diffMin < 1) return "刚刚"
  if (diffMin < 60) return `${diffMin}分钟前`
  const diffHour = Math.floor(diffMin / 60)
  if (diffHour < 24) return `${diffHour}小时前`
  const diffDay = Math.floor(diffHour / 24)
  if (diffDay < 7) return `${diffDay}天前`
  return `${d.getMonth() + 1}/${d.getDate()}`
}

const Profile = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const [historyList, setHistoryList] = useState<PlayHistoryItem[]>(getPlayHistory)
  const [showClearConfirm, setShowClearConfirm] = useState(false)

  useEffect(() => {
    if (location.pathname === "/profile") {
      setHistoryList(getPlayHistory())
    }
  }, [location.pathname])

  const refreshHistory = useCallback(() => {
    setHistoryList(getPlayHistory())
  }, [])

  const handleClear = () => {
    clearPlayHistory()
    setHistoryList([])
    setShowClearConfirm(false)
  }

  const handleOpenHistory = (item: PlayHistoryItem) => {
    const params = new URLSearchParams()
    if (item.sourceCode) params.set("source", item.sourceCode)
    if (item.episodeIndex > 0) params.set("ep", String(item.episodeIndex))
    if (item.currentTime > 0) params.set("t", String(Math.floor(item.currentTime)))
    const query = params.toString()
    navigate(`/detail/${item.id}${query ? `?${query}` : ""}`)
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(132,204,22,0.08),_transparent_40%),linear-gradient(180deg,#0d1121_0%,#08090f_30%,#08090f_100%)] px-4 pb-28 text-white antialiased">
      <div className="mx-auto max-w-xl pt-[calc(env(safe-area-inset-top)+2rem)]">
        <div className="relative overflow-hidden rounded-[2rem] border border-white/5 bg-white/[0.03] p-6 shadow-2xl backdrop-blur-xl">
          <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-lime-400/10 blur-3xl pointer-events-none" />

          <div className="flex items-center gap-4">
            <div className="relative flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-lime-300 to-lime-500 text-[#08090f] shadow-[0_8px_20px_rgba(163,230,53,0.25)]">
              <CircleUserRound size={32} strokeWidth={1.8} />
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="text-xl font-extrabold tracking-tight">我的</h1>
              <p className="mt-1 text-xs text-white/40 truncate">
                本地保存观看记录，支持从历史记录继续播放
              </p>
            </div>
          </div>

          <div className="mt-8 space-y-3">
            <button
              onClick={() => navigate("/search")}
              className="flex w-full items-center justify-between rounded-xl border border-white/5 bg-white/5 px-4 py-3.5 text-left transition-all duration-200 active:scale-[0.99] hover:bg-white/10 group"
            >
              <div>
                <div className="text-sm font-bold group-hover:text-lime-400 transition-colors">
                  探索更多影片
                </div>
                <div className="mt-0.5 text-xs text-white/40">
                  快捷查找海量影视、综艺、动漫
                </div>
              </div>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-lime-400/10 text-lime-400 group-hover:bg-lime-400 group-hover:text-black transition-all">
                <Search size={15} />
              </div>
            </button>

            <div className="grid grid-cols-1 gap-3">
              <button
                onClick={refreshHistory}
                className="flex flex-col justify-between rounded-xl border border-white/10 bg-black/20 p-4 text-left transition hover:border-lime-400/20 hover:bg-black/30"
              >
                <div className="flex items-center gap-2 text-xs font-semibold text-white/70">
                  <History size={14} className="text-lime-400/80" />
                  观看历史
                </div>
                <p className="mt-4 text-[11px] text-lime-400/70 font-medium">
                  {historyList.length > 0 ? `${historyList.length} 条记录` : "暂无播放记录"}
                </p>
              </button>
            </div>
          </div>
        </div>

        {historyList.length > 0 && (
          <div className="mt-6 rounded-[2rem] border border-white/5 bg-white/[0.02] p-5 backdrop-blur-xl">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2 text-sm font-bold text-white/90">
                <History size={16} className="text-lime-400" />
                观看历史
              </div>
              <button
                onClick={() => setShowClearConfirm(true)}
                className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-medium text-red-400/80 border border-red-400/20 bg-red-400/5 transition hover:bg-red-400/10 hover:text-red-400"
              >
                <Trash2 size={12} />
                清除全部
              </button>
            </div>

            <div className="grid grid-cols-3 gap-3">
              {historyList.map((item) => (
                <button
                  key={item.id}
                  onClick={() => handleOpenHistory(item)}
                  className="group w-full rounded-xl border border-white/5 bg-black/20 p-2.5 text-left transition active:scale-[0.99] hover:bg-white/5"
                >
                  <div className="relative overflow-hidden rounded-lg bg-[#0c1020] aspect-[2/3]">
                    <img
                      src={getProxyUrl(item.cover, { w: 240, q: 70 })}
                      alt={item.name}
                      className="h-full w-full object-cover"
                      loading="lazy"
                      decoding="async"
                      onError={createImageFallbackHandler(item.cover)}
                    />
                    <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 group-hover:opacity-100 transition">
                      <Play size={16} className="text-white" fill="white" />
                    </div>
                  </div>

                  <div className="mt-2 min-w-0">
                    <h3 className="line-clamp-1 text-xs font-semibold text-white/90 group-hover:text-lime-400 transition-colors">
                      {item.name}
                    </h3>
                    <div className="mt-1 line-clamp-1 text-[10px] text-white/40">
                      {item.episodeName || `第${item.episodeIndex + 1}集`}
                    </div>
                    <div className="mt-0.5 flex items-center justify-between gap-2 text-[10px] text-white/30">
                      <span className="truncate">{formatTime(item.currentTime)}</span>
                      <span className="shrink-0">{formatDate(item.updatedAt)}</span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {showClearConfirm && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm px-6">
            <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#0d1121] p-6 shadow-2xl">
              <h3 className="text-base font-bold text-white">确认清除</h3>
              <p className="mt-2 text-sm text-white/50">
                将清除全部 {historyList.length} 条观看记录，此操作不可恢复。
              </p>
              <div className="mt-5 flex gap-3">
                <button
                  onClick={() => setShowClearConfirm(false)}
                  className="flex-1 rounded-xl border border-white/10 bg-white/5 py-2.5 text-sm font-medium text-white/70 transition hover:bg-white/10"
                >
                  取消
                </button>
                <button
                  onClick={handleClear}
                  className="flex-1 rounded-xl bg-red-500 py-2.5 text-sm font-bold text-white transition hover:bg-red-600"
                >
                  确认清除
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default Profile
