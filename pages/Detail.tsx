import React, { useEffect, useState, useRef, useCallback, useMemo } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { getProxyUrl } from "../utils/common"
import {
  fetchVideoDetail,
  fetchVideos,
  saveHistory,
  fetchHistory,
} from "../services/api"
import { VideoDetail, VideoSummary } from "../types"
import Player from "../components/Player"
import { useAuth } from "../context/AuthContext"
import toast from "react-hot-toast"
import {
  ChevronLeft,
  PlayCircle,
  Info,
  Cast,
  Loader2,
  Server,
  Check,
  ChevronDown,
} from "lucide-react"

// --- 🦴 骨架屏组件 ---
const Skeleton = ({ className }: { className: string }) => (
  <div className={`bg-white/5 animate-pulse rounded-md ${className}`} />
)

const Detail = () => {
  const { id: routeId } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()

  // --- 状态管理 ---
  const [detail, setDetail] = useState<VideoDetail | null>(null)
  const [isDetailLoading, setIsDetailLoading] = useState(true)
  const [recommendations, setRecommendations] = useState<VideoSummary[]>([])
  const [isRecLoading, setIsRecLoading] = useState(true)

  // 🔥 1. 新增：当前选中的源索引 (默认第0个)
  const [currentSourceIndex, setCurrentSourceIndex] = useState(0)

  // 播放状态
  const [currentEpIndex, setCurrentEpIndex] = useState(0)
  const [startTime, setStartTime] = useState(0)
  const [isDescExpanded, setIsDescExpanded] = useState(false)
  const [showSourcePanel, setShowSourcePanel] = useState(false)

  // --- Refs ---
  const detailRef = useRef<VideoDetail | null>(null)
  const currentEpIndexRef = useRef(0)
  const currentTimeRef = useRef(0)
  const userRef = useRef(user)

  // 同步 user
  useEffect(() => {
    userRef.current = user
  }, [user])

  // 🔥🔥🔥 核心修复：前端动态解析集数 🔥🔥🔥
  // 根据当前选中的源 (currentSourceIndex) 解析 vod_play_url
  const episodes = useMemo(() => {
    if (!detail || !detail.sources || detail.sources.length === 0) return []

    // 获取当前源
    const source = detail.sources[currentSourceIndex]
    if (!source || !source.vod_play_url) return []

    // 解析 m3u8 字符串: "第1集$url#第2集$url"
    return source.vod_play_url.split("#").map((segment) => {
      const parts = segment.split("$")
      return {
        name: parts.length > 1 ? parts[0] : "正片",
        link: parts.length > 1 ? parts[1] : parts[0],
      }
    })
  }, [detail, currentSourceIndex])

  // 2. 🚀 保存历史
  const saveProgressToDB = useCallback(() => {
    const currentUser = userRef.current
    const currentDetail = detailRef.current
    const time = currentTimeRef.current
    const epIdx = currentEpIndexRef.current

    if (!currentUser || !currentDetail) return

    if (time > 5 || time === 0) {
      saveHistory({
        username: currentUser.username,
        video: {
          id: currentDetail.id,
          title: currentDetail.title,
          poster: currentDetail.poster,
          type: currentDetail.category || "video",
        },
        episodeIndex: epIdx,
        progress: time,
      }).catch((err) => console.error("保存历史失败", err))
    }
  }, [])

  const handleTimeUpdate = (time: number) => {
    currentTimeRef.current = time
  }

  // 3. 🔄 生命周期与数据加载
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") saveProgressToDB()
    }
    document.addEventListener("visibilitychange", handleVisibilityChange)
    return () => {
      saveProgressToDB()
      document.removeEventListener("visibilitychange", handleVisibilityChange)
    }
  }, [saveProgressToDB])

  // 加载数据
  useEffect(() => {
    if (!routeId) return

    setDetail(null)
    setIsDetailLoading(true)
    setIsRecLoading(true)
    setCurrentEpIndex(0)
    setStartTime(0)
    setCurrentSourceIndex(0) // 重置源

    const loadCoreData = async () => {
      try {
        const [videoData, historyList] = await Promise.all([
          fetchVideoDetail(routeId),
          user ? fetchHistory(user.username) : Promise.resolve([]),
        ])

        setDetail(videoData)
        detailRef.current = videoData
        setIsDetailLoading(false)

        // 恢复历史记录
        if (user && historyList) {
          const record = historyList.find(
            (h: any) => String(h.id) === String(videoData.id)
          )
          if (record) {
            // 这里简单恢复集数，稍微复杂点可以判断该集数在当前源是否存在
            setCurrentEpIndex(record.episodeIndex || 0)
            currentEpIndexRef.current = record.episodeIndex || 0
            setStartTime(record.progress || 0)
            currentTimeRef.current = record.progress || 0
          }
        }

        loadRecommendations(videoData.category || "movie", videoData.id)
      } catch (e) {
        console.error(e)
        toast.error("视频加载失败，请刷新重试")
        setIsDetailLoading(false)
      }
    }

    loadCoreData()
  }, [routeId, user?.username])

  const loadRecommendations = async (cat: string, currentId: string) => {
    try {
      let recRes = await fetchVideos({ cat, pg: 1 }).catch(() => ({ list: [] }))
      let recList = recRes.list || []
      const finalRecs = recList
        .filter((v: any) => String(v.id) !== String(currentId))
        .slice(0, 9)
      setRecommendations(finalRecs)
    } catch (error) {
      console.warn("推荐加载失败", error)
    } finally {
      setIsRecLoading(false)
    }
  }

  // 4. 交互处理
  const handleEpisodeChange = (index: number) => {
    if (index === currentEpIndex) return
    saveProgressToDB()
    setCurrentEpIndex(index)
    currentEpIndexRef.current = index
    setStartTime(0)
    currentTimeRef.current = 0
  }

  // 🔥 切换源处理
  const handleSourceChange = (index: number) => {
    if (index === currentSourceIndex) return
    saveProgressToDB() // 切源前保存进度

    toast.success(`切换至：${detail?.sources[index].source_name || "新线路"}`)
    setCurrentSourceIndex(index)
    setCurrentEpIndex(0) // 切源后重置到第一集
    setStartTime(0)
    setShowSourcePanel(false)
  }

  const handleVideoEnded = () => {
    if (currentEpIndex < episodes.length - 1) {
      handleEpisodeChange(currentEpIndex + 1)
      toast.success("自动播放下一集")
    } else {
      toast("已播放完毕", { icon: "🏁" })
    }
  }

  // 获取当前播放集
  // 🔥🔥🔥 修复点：使用计算出来的 episodes，而不是 detail.episodes
  const currentEp = episodes[currentEpIndex]

  // 获取当前源名称
  const currentSourceName =
    detail?.sources?.[currentSourceIndex]?.source_name || "默认线路"

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-gray-100 font-sans flex flex-col">
      {/* 播放器区域 */}
      <div className="sticky top-0 z-50 w-full bg-black shrink-0">
        <div className="aspect-video w-full relative group">
          <button
            onClick={() => navigate(-1)}
            className="absolute top-4 left-4 z-20 p-2 bg-black/40 backdrop-blur-md rounded-full text-white hover:bg-emerald-500 transition-colors active:scale-90"
          >
            <ChevronLeft size={20} />
          </button>

          {isDetailLoading ? (
            <div className="w-full h-full flex flex-col items-center justify-center bg-[#111]">
              <Loader2 className="animate-spin text-emerald-500" size={32} />
            </div>
          ) : currentEp ? (
            <Player
              url={currentEp.link}
              poster={detail?.pic || detail?.poster}
              initialTime={startTime}
              onTimeUpdate={handleTimeUpdate}
              onEnded={handleVideoEnded}
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center text-gray-500 gap-2 bg-[#111]">
              <Info size={32} />
              <span className="text-xs">暂无播放资源</span>
            </div>
          )}
        </div>
      </div>

      {/* 操作条 */}
      <div className="bg-[#121212] px-4 py-3 flex items-center justify-between border-b border-white/5 shrink-0">
        <div className="flex items-center gap-4">
          <button className="flex items-center gap-1.5 text-gray-400 hover:text-white shrink-0">
            <Cast size={16} />
            <span className="text-xs font-medium">投屏</span>
          </button>

          {/* 源切换按钮 */}
          <div
            onClick={() => setShowSourcePanel(!showSourcePanel)}
            className="flex items-center gap-1.5 px-3 py-1 bg-white/5 rounded-full cursor-pointer border border-white/5 hover:border-emerald-500/30"
          >
            <Server
              size={12}
              className={showSourcePanel ? "text-emerald-500" : "text-gray-400"}
            />
            <span
              className={`text-[10px] ${
                showSourcePanel ? "text-emerald-500" : "text-gray-400"
              }`}
            >
              {currentSourceName}
            </span>
            <ChevronDown
              size={12}
              className={`text-gray-500 ${showSourcePanel ? "rotate-180" : ""}`}
            />
          </div>
        </div>
      </div>

      {/* 源切换面板 */}
      {showSourcePanel && detail?.sources && (
        <div className="bg-[#0f0f0f] border-b border-white/5 p-4 animate-in slide-in-from-top-2">
          <h3 className="text-xs font-bold text-gray-400 mb-3">
            可用线路 ({detail.sources.length})
          </h3>
          <div className="grid grid-cols-2 gap-3">
            {detail.sources.map((source, idx) => (
              <button
                key={idx}
                onClick={() => handleSourceChange(idx)}
                className={`flex items-center justify-between p-3 rounded-xl border transition-all text-left ${
                  idx === currentSourceIndex
                    ? "bg-emerald-500/10 border-emerald-500/50 text-emerald-400"
                    : "bg-[#1a1a1a] border-white/5 text-gray-300"
                }`}
              >
                <div className="flex flex-col min-w-0">
                  <span className="text-xs font-bold truncate">
                    {source.source_name || `线路 ${idx + 1}`}
                  </span>
                  <span className="text-[10px] opacity-60 mt-0.5 truncate">
                    {source.remarks}
                  </span>
                </div>
                {idx === currentSourceIndex && (
                  <Check size={14} className="text-emerald-500 shrink-0 ml-2" />
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 详情内容 */}
      <div className="p-4 space-y-6 flex-1 overflow-y-auto">
        {/* 标题 */}
        <div>
          <h1 className="text-xl font-bold text-white mb-2">{detail?.title}</h1>
          <div className="flex flex-wrap gap-2 mb-4">
            <span className="text-[10px] bg-white/10 px-2 py-0.5 rounded text-gray-300">
              {detail?.year}
            </span>
            <span className="text-[10px] bg-emerald-500/10 text-emerald-500 px-2 py-0.5 rounded">
              {detail?.category}
            </span>
          </div>
          <p
            className={`text-xs text-gray-400 leading-relaxed ${
              !isDescExpanded ? "line-clamp-2" : ""
            }`}
            onClick={() => setIsDescExpanded(!isDescExpanded)}
          >
            {detail?.content || "暂无简介"}
          </p>
        </div>

        {/* 选集 */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <PlayCircle size={16} className="text-emerald-500" /> 选集
            </h3>
            <span className="text-xs text-gray-500">
              共 {episodes.length} 集
            </span>
          </div>

          <div className="flex flex-wrap gap-2 max-h-80 overflow-y-auto content-start pr-1 custom-scrollbar">
            {episodes.map((ep, idx) => (
              <button
                key={idx}
                onClick={() => handleEpisodeChange(idx)}
                className={`
                  w-[calc(20%-6.5px)] h-10 rounded-lg text-xs font-medium truncate px-1 transition-all
                  ${
                    idx === currentEpIndex
                      ? "bg-emerald-600 text-white shadow-lg shadow-emerald-900/40 border border-emerald-500/50"
                      : "bg-[#1A1A1A] text-gray-400 border border-white/5"
                  }
                `}
              >
                {ep.name.replace(/第|集/g, "")}
              </button>
            ))}
          </div>
        </div>

        {/* 猜你喜欢 */}
        {!isRecLoading && recommendations.length > 0 && (
          <div className="pt-6 mt-6 border-t border-white/5">
            <h3 className="text-sm font-bold text-white mb-4">猜你喜欢</h3>
            <div className="grid grid-cols-3 gap-3">
              {recommendations.map((item) => (
                <div
                  key={item.id}
                  onClick={() => {
                    navigate(`/detail/${item.id}`)
                    window.scrollTo(0, 0)
                  }}
                >
                  <div className="aspect-[2/3] bg-[#1a1a1a] rounded-lg overflow-hidden relative">
                    <img
                      src={getProxyUrl(item.poster)}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  </div>
                  <h4 className="text-xs text-gray-300 mt-2 line-clamp-1">
                    {item.title}
                  </h4>
                </div>
              ))}
            </div>
          </div>
        )}
        <div className="h-10"></div>
      </div>
    </div>
  )
}

export default Detail
