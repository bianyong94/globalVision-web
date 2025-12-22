import React, { useEffect, useState, useRef } from "react"
import { ArrowLeft, Cpu, List, History } from "lucide-react"
import { VideoResource, Episode } from "../types"
import { getVideoDetail } from "../services/api"
import { getSmartSummary } from "../services/gemini"
import { User } from "../services/auth"
import Player from "../components/Player"

// 确保这里的地址和你本地一致
const BASE_URL = "http://172.19.203.113:3000/api"

interface DetailProps {
  video: VideoResource
  onBack: () => void
  darkMode: boolean
  currentUser: User | null
  onUpdateUser: (u: User) => void
}

const Detail: React.FC<DetailProps> = ({
  video: initialVideo,
  onBack,
  darkMode,
  currentUser,
  onUpdateUser,
}) => {
  const [video, setVideo] = useState<VideoResource>(initialVideo)
  const [currentEpisode, setCurrentEpisode] = useState<Episode | null>(null)
  const [episodeIndex, setEpisodeIndex] = useState(0)
  const [startTime, setStartTime] = useState(0)

  const [aiSummary, setAiSummary] = useState("")
  const [loadingAi, setLoadingAi] = useState(false)
  const [loading, setLoading] = useState(true)

  // Ref 用于记录最新的进度，供 saveHistory 使用
  const progressRef = useRef(0)
  const episodeRef = useRef(0) // 记录当前集数索引

  // 1. 加载详情 & 恢复历史
  useEffect(() => {
    const loadDetail = async () => {
      setLoading(true)
      // 先把本地传进来的简单信息设进去，防止白屏
      setVideo(initialVideo)

      try {
        const fullDetail = await getVideoDetail(initialVideo.id)
        if (fullDetail) {
          setVideo(fullDetail)

          let targetEpIndex = 0
          let targetTime = 0

          // 🧠 恢复历史记录
          if (currentUser && currentUser.history) {
            // 注意：API 返回的 id 可能是 string 或 number，比较时建议转 string
            const historyItem = currentUser.history.find(
              (h) => String(h.id) === String(initialVideo.id)
            ) as any
            if (historyItem) {
              console.log("恢复历史:", historyItem)
              targetEpIndex = historyItem.episodeIndex || 0
              targetTime = historyItem.progress || 0
            }
          }

          if (fullDetail.episodes && fullDetail.episodes.length > 0) {
            // 确保集数存在（防止越界）
            const safeIndex = fullDetail.episodes[targetEpIndex]
              ? targetEpIndex
              : 0
            setCurrentEpisode(fullDetail.episodes[safeIndex])
            setEpisodeIndex(safeIndex)
            episodeRef.current = safeIndex
            setStartTime(targetTime)
          }
        }
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }

      // AI Summary
      setLoadingAi(true)
      try {
        const summary = await getSmartSummary(
          initialVideo.title,
          initialVideo.overview || ""
        )
        setAiSummary(summary)
      } catch (e) {
        console.error(e)
      } finally {
        setLoadingAi(false)
      }
    }
    loadDetail()
  }, [initialVideo.id])

  // 2. 保存历史记录 (核心逻辑)
  const saveHistory = async (time: number, force = false) => {
    // 没登录就不存
    if (!currentUser) return

    // 防抖：进度变化小于 5 秒且非强制保存，则忽略
    if (!force && Math.abs(time - progressRef.current) < 5) return

    progressRef.current = time

    try {
      const res = await fetch(`${BASE_URL}/user/history`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: currentUser.username,
          video: {
            ...video,
            // 确保存入的是完整的详情信息，而不是初始的简单信息
            id: video.id,
            title: video.title,
            poster: video.poster,
            type: video.type,
          },
          episodeIndex: episodeRef.current, // 使用 Ref 获取最新集数
          progress: time,
        }),
      })
      const newHistory = await res.json()

      // 更新本地状态，确保 UI (我的页面) 立即刷新
      if (newHistory && Array.isArray(newHistory)) {
        onUpdateUser({ ...currentUser, history: newHistory })
      }
    } catch (e) {
      console.error("History save failed", e)
    }
  }

  // 切换集数
  const changeEpisode = (ep: Episode, idx: number) => {
    // 切换前强制保存旧的一集进度
    saveHistory(progressRef.current, true)

    setCurrentEpisode(ep)
    setEpisodeIndex(idx)
    episodeRef.current = idx // 更新Ref
    setStartTime(0) // 新的一集从头开始
    progressRef.current = 0
  }

  // 组件卸载时保存 (例如点击返回按钮)
  useEffect(() => {
    return () => {
      if (progressRef.current > 0) {
        saveHistory(progressRef.current, true)
      }
    }
  }, [])

  return (
    // 🛠️ 布局修复：去除 fixed inset-0，使用 min-h-screen
    <div
      className={`min-h-screen flex flex-col ${
        darkMode ? "bg-zinc-950 text-white" : "bg-white text-gray-900"
      }`}
    >
      {/* 📺 播放器容器 */}
      {/* 🛠️ 布局修复：使用 sticky top-0 确保吸顶，但 z-index 要够高 */}
      <div className="sticky top-0 z-[50] bg-black w-full aspect-video shadow-2xl shrink-0">
        {currentEpisode ? (
          <div className="w-full h-full relative group">
            <Player
              url={currentEpisode.link}
              poster={video.backdrop || video.poster}
              initialTime={startTime}
              // 传递回调
              onTimeUpdate={(t) => saveHistory(t)}
            />

            {/* 返回按钮 */}
            <button
              onClick={() => {
                saveHistory(progressRef.current, true) // 返回前保存
                onBack()
              }}
              className="absolute top-4 left-4 p-2 bg-black/30 backdrop-blur-md rounded-full text-white z-[60] hover:bg-black/60 transition-colors"
            >
              <ArrowLeft size={20} />
            </button>
          </div>
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center gap-3">
            <div className="w-10 h-10 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-zinc-500 text-xs">正在解析资源...</p>
          </div>
        )}
      </div>

      {/* 内容区域 */}
      {/* 🛠️ 布局修复：正常文档流，padding-top 不需要很大，因为播放器是 sticky 的，不占文档流上方空间 */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="p-4 space-y-4 animate-pulse">
            <div className="h-6 bg-zinc-800 rounded w-3/4"></div>
            <div className="h-4 bg-zinc-800 rounded w-1/4"></div>
            <div className="h-24 bg-zinc-800 rounded"></div>
          </div>
        ) : (
          <div className="p-4 space-y-6 pb-20">
            {/* 标题 & 历史提示 */}
            <div>
              <h1 className="text-xl font-black leading-tight">
                {video.title}
              </h1>

              <div className="flex flex-wrap items-center gap-2 mt-3">
                <span className="text-xs text-blue-500 font-bold bg-blue-500/10 px-2 py-0.5 rounded">
                  {video.remarks || "高清"}
                </span>
                <span className="text-xs text-zinc-500 border border-zinc-700 px-2 py-0.5 rounded">
                  {video.type}
                </span>
                <span className="text-xs text-zinc-500 border border-zinc-700 px-2 py-0.5 rounded">
                  {video.year}
                </span>
              </div>

              {/* 续播提示 */}
              {startTime > 5 && (
                <div className="mt-3 inline-flex items-center gap-1.5 text-xs text-orange-400 bg-orange-400/10 px-3 py-1 rounded-full">
                  <History size={12} />
                  上次看到: 第{episodeIndex + 1}集 {Math.floor(startTime / 60)}
                  分{Math.floor(startTime % 60)}秒
                </div>
              )}
            </div>

            {/* 选集播放 */}
            {video.episodes && video.episodes.length > 0 && (
              <div>
                <h3 className="font-bold mb-3 flex items-center gap-2 text-sm uppercase tracking-wider">
                  <List size={16} className="text-blue-500" /> 选集播放
                </h3>
                {/* 选集网格 */}
                <div className="grid grid-cols-4 gap-2 max-h-48 overflow-y-auto pr-1 custom-scrollbar">
                  {video.episodes.map((ep, idx) => (
                    <button
                      key={idx}
                      onClick={() => changeEpisode(ep, idx)}
                      className={`py-2.5 px-1 rounded-lg text-xs font-medium truncate transition-all ${
                        episodeIndex === idx
                          ? "bg-blue-600 text-white shadow-lg shadow-blue-500/20"
                          : darkMode
                          ? "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
                          : "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {ep.name.replace(/第|集/g, "")}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* AI 助手 */}
            <div
              className={`p-4 rounded-2xl border transition-all ${
                darkMode
                  ? "bg-zinc-900/40 border-blue-900/30"
                  : "bg-blue-50/50 border-blue-100"
              }`}
            >
              <div className="flex items-center gap-2 mb-2">
                <Cpu size={18} className="text-blue-500" />
                <h3 className="text-sm font-bold text-blue-600">AI 观影助手</h3>
              </div>
              {loadingAi ? (
                <div className="space-y-2 animate-pulse">
                  <div className="h-3 bg-zinc-800 rounded w-3/4"></div>
                  <div className="h-3 bg-zinc-800 rounded w-1/2"></div>
                </div>
              ) : (
                <p className="text-xs leading-relaxed opacity-80 italic">
                  "{aiSummary}"
                </p>
              )}
            </div>

            {/* 简介区 */}
            <div>
              <h3 className="font-bold mb-2 text-sm uppercase tracking-wider">
                内容简介
              </h3>
              <p className="text-xs leading-relaxed opacity-70 text-justify tracking-wide">
                {video.overview || "暂无详细介绍"}
              </p>
            </div>

            {/* 底部垫高，防止内容被遮挡 */}
            <div className="h-10"></div>
          </div>
        )}
      </div>
    </div>
  )
}

export default Detail
