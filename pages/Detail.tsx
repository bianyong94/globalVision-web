import React, { useEffect, useState, useRef, useCallback } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { getProxyUrl } from "../utils/common"
import {
  fetchVideoDetail,
  fetchVideos,
  saveHistory,
  fetchHistory,
  fetchVideoSources,
} from "../services/api"
import { VideoDetail, VideoSummary, VideoSource } from "../types"
import Player from "../components/Player"
import { useAuth } from "../context/AuthContext"
import toast from "react-hot-toast"
import {
  ChevronLeft,
  PlayCircle,
  Info,
  Cast,
  Loader2,
  Server, // 新增图标
  Check,
  ChevronDown,
  RefreshCcw,
} from "lucide-react"

// --- 🦴 骨架屏组件 (占位符) ---
const Skeleton = ({ className }: { className: string }) => (
  <div className={`bg-white/5 animate-pulse rounded-md ${className}`} />
)

const Detail = () => {
  const { id: routeId } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()

  // 🔥 1. 新增：内部 ID 状态，用于无刷新切换
  const [activeId, setActiveId] = useState(routeId || "")
  // 监听路由变化（比如点击推荐列表跳转），同步更新 activeId
  useEffect(() => {
    if (routeId) setActiveId(routeId)
  }, [routeId])

  // --- 状态管理 ---
  const [detail, setDetail] = useState<VideoDetail | null>(null)
  const [isDetailLoading, setIsDetailLoading] = useState(true)
  const [recommendations, setRecommendations] = useState<VideoSummary[]>([])
  const [isRecLoading, setIsRecLoading] = useState(true)

  // 🔥 新增：源列表状态
  const [sources, setSources] = useState<VideoSource[]>([])
  const [isSourcesLoading, setIsSourcesLoading] = useState(false)

  // 播放状态
  const [currentEpIndex, setCurrentEpIndex] = useState(0)
  const [startTime, setStartTime] = useState(0)
  const [isDescExpanded, setIsDescExpanded] = useState(false)

  // 源切换面板状态
  const [showSourcePanel, setShowSourcePanel] = useState(false)

  // --- Refs (性能优化与闭包陷阱解决) ---
  const detailRef = useRef<VideoDetail | null>(null)
  const currentEpIndexRef = useRef(0)
  const currentTimeRef = useRef(0) // 实时记录播放进度，不触发渲染
  const userRef = useRef(user)

  // 同步 user 到 ref
  useEffect(() => {
    userRef.current = user
  }, [user])

  // --- 核心逻辑 ---

  // 1. 🚀 保存观看历史 (核心函数)
  const saveProgressToDB = useCallback(() => {
    const currentUser = userRef.current
    const currentDetail = detailRef.current
    const time = currentTimeRef.current
    const epIdx = currentEpIndexRef.current

    if (!currentUser || !currentDetail) return

    // 只有进度 > 5秒 或 刚开始时才保存，避免脏数据
    if (time > 5 || time === 0) {
      console.log(`[History] Saving: Ep${epIdx} @ ${time}s`)
      saveHistory({
        username: currentUser.username,
        video: {
          id: currentDetail.id,
          title: currentDetail.title,
          poster: currentDetail.poster,
          type: currentDetail.category || "video", // 适配新字段
        },
        episodeIndex: epIdx,
        progress: time,
      }).catch((err) => console.error("保存历史失败", err))
    }
  }, [])

  // 2. ⚡️ 播放器回调：只更新 Ref，不触发 React 重渲染
  const handleTimeUpdate = (time: number) => {
    currentTimeRef.current = time
  }

  // 3. 🔄 生命周期管理：组件卸载/隐藏/ID变化前保存
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        saveProgressToDB()
      }
    }
    document.addEventListener("visibilitychange", handleVisibilityChange)
    return () => {
      saveProgressToDB() // 离开页面时保存
      document.removeEventListener("visibilitychange", handleVisibilityChange)
    }
  }, [saveProgressToDB])

  // 4. 数据加载逻辑
  useEffect(() => {
    if (!activeId) return

    // ID 变化意味着切剧或换源：
    // 1. 先保存旧数据的进度 (由上一个 useEffect 的 cleanup 处理，这里主要负责重置状态)

    setDetail(null)
    setSources([])
    setRecommendations([])
    setIsDetailLoading(true)
    setIsRecLoading(true)
    // 换源时保留集数体验更好，切剧时重置。这里简单起见重置，稍后在 loadCoreData 里恢复历史
    setCurrentEpIndex(0)
    setStartTime(0)
    setShowSourcePanel(false)

    // 重置 Refs
    currentTimeRef.current = 0
    currentEpIndexRef.current = 0
    detailRef.current = null

    const loadCoreData = async () => {
      try {
        const [videoData, historyList] = await Promise.all([
          fetchVideoDetail(activeId),
          user ? fetchHistory(user.username) : Promise.resolve([]),
        ])

        setDetail(videoData)
        detailRef.current = videoData
        setIsDetailLoading(false)

        if (user && historyList) {
          // 注意：历史记录匹配需要逻辑健壮，防止源ID不同导致匹配失败
          // 如果后端统一了 title 匹配，这里可以用 title 或 unique_id
          const record = historyList.find(
            (h: any) => String(h.id) === String(videoData.id)
          )

          if (record) {
            // 恢复上次观看的集数
            const savedEpIdx = record.episodeIndex || 0
            if (videoData.episodes && savedEpIdx < videoData.episodes.length) {
              setCurrentEpIndex(savedEpIdx)
              currentEpIndexRef.current = savedEpIdx
            }
            // 恢复进度
            setStartTime(record.progress || 0)
            currentTimeRef.current = record.progress || 0
          }
        }

        // 加载推荐 (只在第一次加载详情时加载，或者每次都加载)
        loadRecommendations(videoData.category || "movie", videoData.id)
        // 🔥🔥🔥 核心：拿到详情后，立即触发全网搜源
        loadSources(videoData.title)
      } catch (e) {
        console.error(e)
        toast.error("视频加载失败，请刷新重试")
        setIsDetailLoading(false)
      }
    }

    loadCoreData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId, user?.username])

  // 🔥 加载可用源
  const loadSources = async (title: string) => {
    if (!title) return
    setIsSourcesLoading(true)
    try {
      const list = await fetchVideoSources(title)
      setSources(list)
    } catch (e) {
      console.warn("搜源失败", e)
    } finally {
      setIsSourcesLoading(false)
    }
  }
  const loadRecommendations = async (
    cat: string,
    currentId: string | number
  ) => {
    try {
      // 使用新的 v2 接口参数
      let recRes = await fetchVideos({ cat: cat, pg: 1 }).catch(() => ({
        list: [],
      }))
      let recList = recRes.list || []

      if (recList.length === 0) {
        const hotRes = await fetchVideos({ pg: 1 }).catch(() => ({ list: [] }))
        recList = hotRes.list || []
      }

      const finalRecs = recList
        .filter((v: any) => String(v.id) !== String(currentId))
        .slice(0, 9) // 展示9个
      setRecommendations(finalRecs)
    } catch (error) {
      console.warn("推荐加载失败", error)
    } finally {
      setIsRecLoading(false)
    }
  }

  // 5. 🎬 切换集数
  const handleEpisodeChange = (index: number) => {
    if (index === currentEpIndex) return
    saveProgressToDB() // 切集前保存上一集
    setCurrentEpIndex(index)
    currentEpIndexRef.current = index
    setStartTime(0) // 新集从头开始
    currentTimeRef.current = 0
  }

  // 🔥 自动连播下一集逻辑
  const handleVideoEnded = () => {
    if (!detail?.episodes) return

    // 如果不是最后一集
    if (currentEpIndex < detail.episodes.length - 1) {
      const nextIndex = currentEpIndex + 1
      toast.success(`即将播放第 ${nextIndex + 1} 集`, {
        icon: "📺",
        duration: 3000,
      })
      handleEpisodeChange(nextIndex)
    } else {
      // 最后一集播完
      toast("已播放完毕", { icon: "🏁" })
    }
  }

  // 🔄 切换源点击处理
  const handleSourceChange = (newSourceId: string) => {
    // 如果点击的是当前正在播放的源，不做处理
    if (newSourceId === detail?.id) return

    saveProgressToDB() // 保存当前源的进度
    // 2. 更新 activeId 触发重新加载
    setActiveId(newSourceId)

    // 3. 静默更新 URL (不刷新页面)
    window.history.replaceState(null, "", `/detail/${newSourceId}`)

    toast.success("正在切换线路...")
  }

  const currentEp = detail?.episodes[currentEpIndex]

  // 渲染源列表项
  const renderSourceItem = (source: any) => {
    const isCurrent = source.id === detail?.id
    return (
      <button
        key={source.id}
        onClick={() => handleSourceChange(source.id)}
        className={`
          flex items-center justify-between p-3 rounded-xl border transition-all active:scale-95
          ${
            isCurrent
              ? "bg-emerald-500/10 border-emerald-500/50 text-emerald-400"
              : "bg-[#1a1a1a] border-white/5 text-gray-300 hover:bg-[#252525]"
          }
        `}
      >
        <div className="flex flex-col items-start">
          <span className="text-xs font-bold">{source.name}</span>
          <span className="text-[10px] opacity-60 mt-0.5">
            {source.remarks || "无备注"}
          </span>
        </div>
        {isCurrent && <Check size={14} className="text-emerald-500" />}
      </button>
    )
  }

  // 🔥 计算当前显示的源名称
  // 逻辑：优先在 sources 列表里找当前 activeId 对应的名字，找不到则用 detail 里的，再找不到显示 ID 前缀
  const currentSourceName =
    sources.find((s) => s.id === activeId)?.name ||
    detail?.current_source?.name ||
    activeId.split("_")[0] ||
    "默认源"

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-gray-100 font-sans flex flex-col">
      {/* 播放器区域 (Sticky Top) */}
      <div className="sticky top-0 z-50 w-full bg-black shrink-0">
        <div className="aspect-video w-full relative group">
          <button
            onClick={() => navigate(-1)}
            className="absolute top-4 left-4 z-20 p-2 bg-black/40 backdrop-blur-md rounded-full text-white hover:bg-emerald-500 transition-colors active:scale-90"
          >
            <ChevronLeft size={20} />
          </button>

          {isDetailLoading ? (
            <div className="w-full h-full flex flex-col items-center justify-center bg-[#111] space-y-3">
              <Loader2 className="animate-spin text-emerald-500" size={32} />
              <span className="text-xs text-gray-500 animate-pulse tracking-wider">
                正在解析极速线路...
              </span>
            </div>
          ) : currentEp ? (
            <Player
              url={currentEp.link}
              poster={detail?.pic || detail?.poster} // 兼容字段
              initialTime={startTime}
              onTimeUpdate={handleTimeUpdate}
              onEnded={handleVideoEnded}
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center text-gray-500 gap-2 bg-[#111]">
              <Info size={32} />
              <span className="text-xs">暂无播放源，请尝试切换线路</span>
            </div>
          )}
        </div>
      </div>

      {/* 核心操作条：投屏 + 换源 */}
      <div className="bg-[#121212] px-4 py-3 flex items-center justify-between border-b border-white/5 shrink-0">
        <div className="flex items-center gap-4">
          <button
            onClick={() => toast("请使用浏览器自带投屏功能", { icon: "📺" })}
            className="flex items-center gap-1.5 text-gray-400 hover:text-white shrink-0 active:scale-95 transition"
          >
            <Cast size={16} />
            <span className="text-xs font-medium">投屏</span>
          </button>

          {/* 源状态显示 */}
          <div
            onClick={() => setShowSourcePanel(!showSourcePanel)}
            className="flex items-center gap-1.5 px-3 py-1 bg-white/5 rounded-full cursor-pointer active:scale-95 transition border border-white/5 hover:border-emerald-500/30"
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
              className={`text-gray-500 transition-transform ${
                showSourcePanel ? "rotate-180" : ""
              }`}
            />
          </div>
        </div>
      </div>

      {/* 换源面板 (可折叠) */}
      {showSourcePanel && (
        <div className="bg-[#0f0f0f] border-b border-white/5 animate-in slide-in-from-top-2 duration-200">
          <div className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-bold text-gray-400">
                全网可用线路 ({sources.length})
              </h3>
              {isSourcesLoading && (
                <span className="text-[10px] text-emerald-500 flex items-center gap-1">
                  <Loader2 size={10} className="animate-spin" /> 实时搜索中...
                </span>
              )}
            </div>

            {sources.length > 0 ? (
              <div className="grid grid-cols-2 gap-3">
                {sources.map((source) => {
                  // ✅ 修复：使用 activeId 判断高亮，响应更及时
                  const isCurrent = source.id === activeId
                  return (
                    <button
                      key={source.id}
                      onClick={() => handleSourceChange(source.id)}
                      className={`
                         flex items-center justify-between p-3 rounded-xl border transition-all active:scale-95 text-left
                         ${
                           isCurrent
                             ? "bg-emerald-500/10 border-emerald-500/50 text-emerald-400"
                             : "bg-[#1a1a1a] border-white/5 text-gray-300 hover:bg-[#252525]"
                         }
                       `}
                    >
                      <div className="flex flex-col items-start min-w-0">
                        <span className="text-xs font-bold truncate w-full">
                          {source.name}
                        </span>
                        <span className="text-[10px] opacity-60 mt-0.5 truncate w-full">
                          {source.remarks || "无备注"}
                        </span>
                      </div>
                      {isCurrent && (
                        <Check
                          size={14}
                          className="text-emerald-500 shrink-0 ml-2"
                        />
                      )}
                    </button>
                  )
                })}
              </div>
            ) : (
              <div className="py-4 text-center text-xs text-gray-500">
                {isSourcesLoading
                  ? "正在搜索全网资源..."
                  : "未找到其他可用线路"}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 详情内容滚动区 */}
      <div className="p-4 space-y-6 flex-1 overflow-y-auto">
        {/* 标题与简介 */}
        <div>
          {!isDetailLoading ? (
            <>
              <div className="flex justify-between items-start gap-4">
                <h1 className="text-xl font-bold text-white mb-2 leading-snug">
                  {detail?.title}
                </h1>
                {detail?.rating && detail.rating > 0 && (
                  <span className="bg-amber-500 text-black text-xs font-black px-1.5 py-0.5 rounded shadow-lg shadow-amber-500/20 shrink-0">
                    {detail.rating.toFixed(1)}
                  </span>
                )}
              </div>

              <div className="flex flex-wrap gap-2 mb-4">
                {detail?.year && (
                  <span className="text-[10px] bg-white/10 px-2 py-0.5 rounded text-gray-300">
                    {detail.year}
                  </span>
                )}
                {detail?.area && (
                  <span className="text-[10px] bg-white/10 px-2 py-0.5 rounded text-gray-300">
                    {detail.area}
                  </span>
                )}
                {detail?.category && (
                  <span className="text-[10px] bg-emerald-500/10 text-emerald-500 px-2 py-0.5 rounded border border-emerald-500/20">
                    {detail.category}
                  </span>
                )}
              </div>

              <div
                className="relative"
                onClick={() => setIsDescExpanded(!isDescExpanded)}
              >
                <p
                  className={`text-xs text-gray-400 leading-relaxed ${
                    !isDescExpanded ? "line-clamp-2" : ""
                  }`}
                >
                  {detail?.content || "暂无简介"}
                </p>
                {!isDescExpanded &&
                  detail?.content &&
                  detail.content.length > 50 && (
                    <div className="absolute bottom-0 right-0 pl-8 bg-gradient-to-l from-[#0a0a0a] to-transparent">
                      <span className="text-emerald-500 text-xs font-medium">
                        展开
                      </span>
                    </div>
                  )}
              </div>
            </>
          ) : (
            <div className="space-y-3">
              <Skeleton className="w-3/4 h-6" />
              <div className="flex gap-2">
                <Skeleton className="w-10 h-4" />
                <Skeleton className="w-10 h-4" />
              </div>
              <Skeleton className="w-full h-12" />
            </div>
          )}
        </div>

        {/* 选集区 */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <PlayCircle size={16} className="text-emerald-500" />
              <h3 className="text-sm font-bold text-white">选集</h3>
            </div>
            {!isDetailLoading && (
              <span className="text-xs text-gray-500">
                更新至 {detail?.episodes.length} 集
              </span>
            )}
          </div>

          {isDetailLoading ? (
            <div className="flex flex-wrap gap-2">
              {[...Array(8)].map((_, i) => (
                <Skeleton
                  key={i}
                  className="w-[calc(20%-6.5px)] h-10 rounded-lg"
                />
              ))}
            </div>
          ) : (
            <div className="flex flex-wrap gap-2 max-h-80 overflow-y-auto content-start pr-1 custom-scrollbar">
              {detail?.episodes.map((ep, idx) => {
                const isActive = idx === currentEpIndex
                return (
                  <button
                    key={idx}
                    onClick={() => handleEpisodeChange(idx)}
                    className={`
                      w-[calc(20%-6.5px)] h-10 rounded-lg text-xs font-medium truncate px-1 transition-all active:scale-95
                      ${
                        isActive
                          ? "bg-emerald-600 text-white shadow-lg shadow-emerald-900/40 border border-emerald-500/50"
                          : "bg-[#1A1A1A] text-gray-400 border border-white/5 hover:bg-[#252525] hover:border-white/10"
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

        {/* 猜你喜欢 */}
        {!isRecLoading && recommendations.length > 0 && (
          <div className="pt-6 mt-6 border-t border-white/5">
            <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
              <span className="w-1 h-4 bg-emerald-500 rounded-full" /> 猜你喜欢
            </h3>
            <div className="grid grid-cols-3 gap-3">
              {recommendations.map((item) => (
                <div
                  key={item.id}
                  onClick={() => {
                    navigate(`/detail/${item.id}`)
                    window.scrollTo({ top: 0, behavior: "smooth" })
                  }}
                  className="space-y-2 cursor-pointer group active:opacity-80 transition"
                >
                  <div className="aspect-[2/3] bg-[#1a1a1a] rounded-lg overflow-hidden relative border border-white/5 shadow-md">
                    <img
                      src={getProxyUrl(item.poster)}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                      loading="lazy"
                      alt={item.title}
                    />
                    {item.rating && item.rating > 0 && (
                      <div className="absolute top-1 right-1 bg-black/60 backdrop-blur-sm text-[9px] text-emerald-400 px-1.5 py-0.5 rounded">
                        {item.rating}
                      </div>
                    )}
                  </div>
                  <h4 className="text-xs text-gray-300 line-clamp-1 group-hover:text-emerald-400 transition-colors">
                    {item.title}
                  </h4>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 底部留白 */}
        <div className="h-10"></div>
      </div>
    </div>
  )
}

export default Detail
