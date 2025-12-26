import React, { useEffect, useState, useRef } from "react"
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
  ThumbsUp,
  Loader2,
} from "lucide-react"

// --- 🦴 骨架屏组件 (占位符) ---
const Skeleton = ({ className }: { className: string }) => (
  <div className={`bg-white/5 animate-pulse rounded-md ${className}`} />
)

const Detail = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()

  // --- 状态拆分 ---
  // 核心详情数据
  const [detail, setDetail] = useState<VideoDetail | null>(null)
  const [isDetailLoading, setIsDetailLoading] = useState(true)

  // 推荐数据 (次要，不阻塞主界面)
  const [recommendations, setRecommendations] = useState<VideoSummary[]>([])
  const [isRecLoading, setIsRecLoading] = useState(true)

  // 播放状态
  const [currentEpIndex, setCurrentEpIndex] = useState(0)
  const [startTime, setStartTime] = useState(0)
  const [isDescExpanded, setIsDescExpanded] = useState(false)

  // Refs
  const detailRef = useRef<VideoDetail | null>(null)
  const currentEpIndexRef = useRef(0)

  // 1. 核心逻辑：优先加载详情和历史记录
  useEffect(() => {
    if (!id) return

    // 重置状态
    setDetail(null)
    setRecommendations([])
    setIsDetailLoading(true) // 开启详情骨架屏
    setIsRecLoading(true) // 开启推荐骨架屏
    setCurrentEpIndex(0)
    setStartTime(0)

    const loadCoreData = async () => {
      try {
        // 并行请求：详情 + 历史记录 (这两者决定了播放器能否初始化)
        // 使用 Promise.all 同时发起，节省时间
        const [videoData, historyList] = await Promise.all([
          fetchVideoDetail(id),
          user ? fetchHistory(user.username) : Promise.resolve([]),
        ])

        // 设置详情
        setDetail(videoData)
        detailRef.current = videoData
        setIsDetailLoading(false) // 🚨 核心数据拿到，立即关闭骨架屏，展示内容

        // 处理历史记录
        if (user && historyList) {
          const record = historyList.find(
            (h: any) => String(h.id) === String(videoData.id)
          )
          if (record) {
            const savedEpIdx = record.episodeIndex || 0
            // 确保集数没越界
            if (videoData.episodes && savedEpIdx < videoData.episodes.length) {
              setCurrentEpIndex(savedEpIdx)
              currentEpIndexRef.current = savedEpIdx
            }
            setStartTime(record.progress || 0)
          }
        }

        // 🚀 核心数据加载完后，再去偷偷加载推荐数据 (不阻塞界面)
        loadRecommendations(videoData.type, videoData.id)
      } catch (e) {
        console.error(e)
        toast.error("视频加载失败，请刷新重试")
        setIsDetailLoading(false) // 即使失败也要取消 Loading
      }
    }

    loadCoreData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, user?.username])

  // 2. 独立的推荐加载函数 (延迟加载)
  const loadRecommendations = async (
    type: string,
    currentId: string | number
  ) => {
    try {
      // 尝试1: 按分类搜
      let recRes = await fetchVideos({ t: type, pg: 1 }).catch(() => ({
        list: [],
      }))
      let recList = recRes.list || []

      // 尝试2: 兜底热门
      if (recList.length === 0) {
        const hotRes = await fetchVideos({ pg: 1 }).catch(() => ({ list: [] }))
        recList = hotRes.list || []
      }

      const finalRecs = recList
        .filter((v: any) => String(v.id) !== String(currentId))
        .slice(0, 6)

      setRecommendations(finalRecs)
    } catch (error) {
      console.warn("推荐加载失败", error)
    } finally {
      setIsRecLoading(false) // 关闭推荐骨架屏
    }
  }

  // 3. 历史记录保存逻辑 (保持不变)
  const handleSaveHistory = (time: number, forceEpIndex?: number) => {
    if (!user || !detailRef.current) return
    const epIdx =
      forceEpIndex !== undefined ? forceEpIndex : currentEpIndexRef.current
    if (time > 5 || time === 0) {
      saveHistory({
        username: user.username,
        video: {
          id: detailRef.current.id,
          title: detailRef.current.title,
          poster: detailRef.current.poster,
          type: detailRef.current.type,
        },
        episodeIndex: epIdx,
        progress: time,
      })
    }
  }

  const handleEpisodeChange = (index: number) => {
    setCurrentEpIndex(index)
    currentEpIndexRef.current = index
    setStartTime(0)
    handleSaveHistory(0, index)
  }

  // 计算当前集
  const currentEp = detail?.episodes[currentEpIndex]

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-gray-100 font-sans flex flex-col">
      {/* --- 1. 播放器区域 (吸顶) --- */}
      <div className="sticky top-0 z-50 w-full bg-black shrink-0">
        <div className="aspect-video w-full relative">
          {/* 返回按钮始终存在 */}
          <button
            onClick={() => navigate(-1)}
            className="absolute top-4 left-4 z-20 p-2 bg-black/40 backdrop-blur-md rounded-full text-white hover:bg-emerald-500 transition-colors"
          >
            <ChevronLeft size={20} />
          </button>

          {isDetailLoading ? (
            // 💀 播放器加载状态
            <div className="w-full h-full flex flex-col items-center justify-center bg-[#111] space-y-3">
              <Loader2 className="animate-spin text-emerald-500" size={32} />
              <span className="text-xs text-gray-500 animate-pulse">
                正在解析线路...
              </span>
            </div>
          ) : currentEp ? (
            // ✅ 播放器就绪
            <Player
              url={currentEp.link}
              poster={detail?.backdrop || detail?.poster}
              initialTime={startTime}
              onTimeUpdate={handleSaveHistory}
            />
          ) : (
            // ❌ 无播放源
            <div className="w-full h-full flex flex-col items-center justify-center text-gray-500 gap-2 bg-[#111]">
              <Info size={32} />
              <span className="text-xs">暂无播放源</span>
            </div>
          )}
        </div>
      </div>

      {/* --- 2. 操作条 --- */}
      <div className="bg-[#121212] px-4 py-3 flex items-center gap-3 border-b border-white/5 shrink-0">
        <button
          onClick={() => toast("请使用浏览器自带投屏功能", { icon: "📺" })}
          className="flex items-center gap-1 text-gray-400 hover:text-white shrink-0 active:scale-95 transition"
        >
          <Cast size={18} />
          <span className="text-xs">投屏</span>
        </button>
      </div>

      {/* --- 3. 详情内容 (流式布局) --- */}
      <div className="p-4 space-y-6 flex-1 overflow-y-auto">
        {/* 标题和标签区 */}
        <div>
          {isDetailLoading ? (
            // 💀 标题骨架屏
            <div className="space-y-3">
              <Skeleton className="h-7 w-3/4" />
              <div className="flex gap-2">
                <Skeleton className="h-5 w-10" />
                <Skeleton className="h-5 w-16" />
                <Skeleton className="h-5 w-12" />
              </div>
            </div>
          ) : (
            // ✅ 真实标题
            <>
              <h1 className="text-lg font-bold text-white mb-2 leading-snug animate-in fade-in duration-500">
                {detail?.title}
              </h1>
              <div className="flex items-center flex-wrap gap-2">
                <span className="text-emerald-500 bg-emerald-500/10 px-1.5 py-0.5 rounded text-[10px] font-bold">
                  {detail?.year || "2024"}
                </span>
                <span className="text-gray-400 bg-white/5 px-1.5 py-0.5 rounded text-[10px]">
                  {detail?.area}
                </span>
                <span className="text-gray-400 bg-white/5 px-1.5 py-0.5 rounded text-[10px]">
                  {detail?.type}
                </span>
              </div>
            </>
          )}
        </div>

        {/* 简介区 */}
        {isDetailLoading ? (
          // 💀 简介骨架屏
          <Skeleton className="h-20 w-full rounded-xl" />
        ) : (
          <div
            className="bg-[#161616] p-3 rounded-xl border border-white/5 active:bg-[#1f1f1f] transition-colors"
            onClick={() => setIsDescExpanded(!isDescExpanded)}
          >
            <p
              className={`text-xs text-gray-400 leading-relaxed ${
                isDescExpanded ? "" : "line-clamp-2"
              }`}
            >
              {detail?.overview ? detail.overview.trim() : "暂无简介"}
            </p>
            <div className="flex justify-center mt-1 opacity-50">
              <div
                className={`w-8 h-1 bg-white/20 rounded-full transition-all ${
                  isDescExpanded ? "bg-emerald-500/50 w-12" : ""
                }`}
              />
            </div>
          </div>
        )}

        {/* 选集区 */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <PlayCircle size={16} className="text-emerald-500" />
              <h3 className="text-sm font-bold text-white">选集</h3>
            </div>
            {!isDetailLoading && (
              <span className="text-xs text-gray-500">
                共 {detail?.episodes.length} 集
              </span>
            )}
          </div>

          {isDetailLoading ? (
            // 💀 选集骨架屏 (模拟一行格子)
            <div className="flex flex-wrap gap-2">
              {[...Array(10)].map((_, i) => (
                <Skeleton
                  key={i}
                  className="w-[calc(20%-6.5px)] h-9 rounded-md"
                />
              ))}
            </div>
          ) : (
            // ✅ 真实选集
            <div className="flex flex-wrap gap-2 max-h-80 overflow-y-auto content-start animate-in fade-in slide-in-from-bottom-2 duration-500">
              {detail?.episodes.map((ep, idx) => {
                const isActive = idx === currentEpIndex
                return (
                  <button
                    key={idx}
                    onClick={() => handleEpisodeChange(idx)}
                    className={`
                      w-[calc(20%-6.5px)] h-9 rounded-md text-xs font-medium truncate px-1 transition-all
                      ${
                        isActive
                          ? "bg-emerald-600 text-white shadow-lg shadow-emerald-900/40"
                          : "bg-[#1A1A1A] text-gray-400 hover:bg-[#252525]"
                      }
                    `}
                  >
                    {ep.name.replace(/第|集/g, "")}
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* 4. 相关推荐 (独立加载，不阻塞上方) */}
        <div className="pt-6 mt-6 border-t border-white/5">
          <div className="flex items-center gap-2 mb-4">
            <ThumbsUp size={16} className="text-pink-500" />
            <h3 className="text-sm font-bold text-white">猜你喜欢</h3>
          </div>

          {isRecLoading ? (
            // 💀 推荐骨架屏 (九宫格)
            <div className="grid grid-cols-3 gap-3">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="space-y-2">
                  <Skeleton className="aspect-[2/3] rounded-lg" />
                  <Skeleton className="h-3 w-3/4" />
                </div>
              ))}
            </div>
          ) : recommendations.length > 0 ? (
            // ✅ 真实推荐
            <div className="grid grid-cols-3 gap-3 animate-in fade-in duration-700">
              {recommendations.map((item) => (
                <div
                  key={item.id}
                  onClick={() => {
                    navigate(`/detail/${item.id}`)
                    window.scrollTo({ top: 0, behavior: "smooth" })
                  }}
                  className="space-y-1.5 cursor-pointer group"
                >
                  <div className="aspect-[2/3] bg-[#1a1a1a] rounded-lg overflow-hidden relative">
                    <img
                      src={getProxyUrl(item.poster)}
                      className="w-full h-full object-cover group-active:scale-95 transition-transform duration-300"
                      loading="lazy"
                    />
                    <div className="absolute top-1 right-1 bg-black/60 text-[10px] text-white px-1 rounded backdrop-blur">
                      {item.rating || "Hot"}
                    </div>
                  </div>
                  <h4 className="text-xs text-gray-300 line-clamp-1 group-active:text-emerald-400">
                    {item.title}
                  </h4>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-gray-600 text-center py-4">
              暂无相关推荐
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

export default Detail
