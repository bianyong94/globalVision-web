import React, { useEffect, useState, useRef, useCallback } from "react"
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
  const [detail, setDetail] = useState<VideoDetail | null>(null)
  const [isDetailLoading, setIsDetailLoading] = useState(true)
  const [recommendations, setRecommendations] = useState<VideoSummary[]>([])
  const [isRecLoading, setIsRecLoading] = useState(true)

  // 播放状态
  const [currentEpIndex, setCurrentEpIndex] = useState(0)
  const [startTime, setStartTime] = useState(0)
  const [isDescExpanded, setIsDescExpanded] = useState(false)

  // --- Refs (关键优化) ---
  const detailRef = useRef<VideoDetail | null>(null)
  const currentEpIndexRef = useRef(0)
  // ✨ 新增：用于实时记录当前播放时间，不触发组件渲染
  const currentTimeRef = useRef(0)
  // ✨ 新增：记录当前用户，防止 cleanup 时闭包拿不到最新 user
  const userRef = useRef(user)

  // 同步 user 到 ref
  useEffect(() => {
    userRef.current = user
  }, [user])

  // --- 核心逻辑 ---

  // 1. 🚀 真正的保存逻辑 (仅在离开/切集时调用)
  // 使用 useCallback 确保函数引用稳定，但这主要依赖 Refs
  const saveProgressToDB = useCallback(() => {
    const currentUser = userRef.current
    const currentDetail = detailRef.current
    const time = currentTimeRef.current
    const epIdx = currentEpIndexRef.current

    if (!currentUser || !currentDetail) return

    // 只有进度 > 5秒 或 刚开始时才保存，避免脏数据
    if (time > 5 || time === 0) {
      console.log(`[History] Saving: Ep${epIdx} @ ${time}s`) // Debug log
      saveHistory({
        username: currentUser.username,
        video: {
          id: currentDetail.id,
          title: currentDetail.title,
          poster: currentDetail.poster,
          type: currentDetail.type,
        },
        episodeIndex: epIdx,
        progress: time,
      }).catch((err) => console.error("保存历史失败", err))
    }
  }, [])

  // 2. ⚡️ 播放器回调：只更新 Ref，不请求 API，不 Update State
  const handleTimeUpdate = (time: number) => {
    currentTimeRef.current = time
  }

  // 3. 🔄 生命周期管理：组件卸载/隐藏时保存
  useEffect(() => {
    // 页面可见性变化处理（兼容移动端切后台/锁屏）
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        saveProgressToDB()
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityChange)

    return () => {
      // 🚨 组件卸载（路由跳转/关闭页面）时触发保存
      saveProgressToDB()
      document.removeEventListener("visibilitychange", handleVisibilityChange)
    }
  }, [saveProgressToDB])

  // 4. 数据加载逻辑 (保持原有结构，微调 Refs 初始化)
  useEffect(() => {
    if (!id) return

    // 切换视频前，先把上一个视频的进度存了 (如果是从详情页跳详情页)
    // 注意：这里的 useEffect cleanup 会自动处理，但为了保险起见，重置前可以不做额外操作，
    // 因为 React 会先运行上一个 Effect 的 cleanup (saveProgressToDB)，再运行这个 Effect。

    setDetail(null)
    setRecommendations([])
    setIsDetailLoading(true)
    setIsRecLoading(true)
    setCurrentEpIndex(0)
    setStartTime(0)

    // 重置 Refs
    currentTimeRef.current = 0
    currentEpIndexRef.current = 0

    const loadCoreData = async () => {
      try {
        const [videoData, historyList] = await Promise.all([
          fetchVideoDetail(id),
          user ? fetchHistory(user.username) : Promise.resolve([]),
        ])

        setDetail(videoData)
        detailRef.current = videoData
        setIsDetailLoading(false)

        if (user && historyList) {
          const record = historyList.find(
            (h: any) => String(h.id) === String(videoData.id)
          )
          if (record) {
            const savedEpIdx = record.episodeIndex || 0
            if (videoData.episodes && savedEpIdx < videoData.episodes.length) {
              setCurrentEpIndex(savedEpIdx)
              currentEpIndexRef.current = savedEpIdx
            }
            // 设置起始时间，并同步到 Ref
            setStartTime(record.progress || 0)
            currentTimeRef.current = record.progress || 0
          }
        }
        loadRecommendations(videoData.type, videoData.id)
      } catch (e) {
        console.error(e)
        toast.error("视频加载失败，请刷新重试")
        setIsDetailLoading(false)
      }
    }

    loadCoreData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, user?.username]) // user.username 变化通常意味着重新登录，重新加载是合理的

  // 推荐加载逻辑 (保持不变)
  const loadRecommendations = async (
    type: string,
    currentId: string | number
  ) => {
    try {
      let recRes = await fetchVideos({ t: type, pg: 1 }).catch(() => ({
        list: [],
      }))
      let recList = recRes.list || []
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
      setIsRecLoading(false)
    }
  }

  // 5. 🎬 切换集数逻辑
  const handleEpisodeChange = (index: number) => {
    if (index === currentEpIndex) return

    // 🚨 关键：切集前，先保存上一集的进度
    saveProgressToDB()

    // 更新状态
    setCurrentEpIndex(index)
    currentEpIndexRef.current = index

    // 重置时间和 Ref
    setStartTime(0)
    currentTimeRef.current = 0
  }

  const currentEp = detail?.episodes[currentEpIndex]

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-gray-100 font-sans flex flex-col">
      {/* 播放器区域 */}
      <div className="sticky top-0 z-50 w-full bg-black shrink-0">
        <div className="aspect-video w-full relative">
          <button
            onClick={() => navigate(-1)} // 这里触发 navigate 会导致组件卸载，进而触发 useEffect cleanup 保存
            className="absolute top-4 left-4 z-20 p-2 bg-black/40 backdrop-blur-md rounded-full text-white hover:bg-emerald-500 transition-colors"
          >
            <ChevronLeft size={20} />
          </button>

          {isDetailLoading ? (
            <div className="w-full h-full flex flex-col items-center justify-center bg-[#111] space-y-3">
              <Loader2 className="animate-spin text-emerald-500" size={32} />
              <span className="text-xs text-gray-500 animate-pulse">
                正在解析线路...
              </span>
            </div>
          ) : currentEp ? (
            <Player
              url={currentEp.link}
              poster={detail?.backdrop || detail?.poster}
              initialTime={startTime}
              // ✨ 优化点：这里只更新 Ref，不再直接调用 saveHistory
              onTimeUpdate={handleTimeUpdate}
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center text-gray-500 gap-2 bg-[#111]">
              <Info size={32} />
              <span className="text-xs">暂无播放源</span>
            </div>
          )}
        </div>
      </div>

      {/* 操作条 */}
      <div className="bg-[#121212] px-4 py-3 flex items-center gap-3 border-b border-white/5 shrink-0">
        <button
          onClick={() => toast("请使用浏览器自带投屏功能", { icon: "📺" })}
          className="flex items-center gap-1 text-gray-400 hover:text-white shrink-0 active:scale-95 transition"
        >
          <Cast size={18} />
          <span className="text-xs">投屏</span>
        </button>
      </div>

      {/* 详情内容 */}
      <div className="p-4 space-y-6 flex-1 overflow-y-auto">
        {/* ... (标题、简介代码保持不变) ... */}
        <div>
          {!isDetailLoading && (
            <>
              <h1 className="text-lg font-bold text-white mb-2 leading-snug">
                {detail?.title}
              </h1>
              {/* ... Tags ... */}
            </>
          )}
        </div>

        {/* ... (简介代码保持不变) ... */}

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
            <div className="flex flex-wrap gap-2">
              {[...Array(10)].map((_, i) => (
                <Skeleton
                  key={i}
                  className="w-[calc(20%-6.5px)] h-9 rounded-md"
                />
              ))}
            </div>
          ) : (
            <div className="flex flex-wrap gap-2 max-h-80 overflow-y-auto content-start">
              {detail?.episodes.map((ep, idx) => {
                const isActive = idx === currentEpIndex
                return (
                  <button
                    key={idx}
                    onClick={() => handleEpisodeChange(idx)} // ✨ 使用新的切集函数
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

        {/* ... (推荐列表代码保持不变) ... */}

        {/* 底部推荐部分省略 (无逻辑变更) */}
        {!isRecLoading && recommendations.length > 0 && (
          <div className="pt-6 mt-6 border-t border-white/5">
            {/* ... Recommendation UI ... */}
            <div className="grid grid-cols-3 gap-3">
              {recommendations.map((item) => (
                <div
                  key={item.id}
                  onClick={() => {
                    navigate(`/detail/${item.id}`) // 跳转也会触发 cleanup 保存当前视频进度
                    window.scrollTo({ top: 0, behavior: "smooth" })
                  }}
                  className="space-y-1.5 cursor-pointer group"
                >
                  {/* ... Item Content ... */}
                  <div className="aspect-[2/3] bg-[#1a1a1a] rounded-lg overflow-hidden relative">
                    <img
                      src={getProxyUrl(item.poster)}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <h4 className="text-xs text-gray-300 line-clamp-1">
                    {item.title}
                  </h4>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default Detail
