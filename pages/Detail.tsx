import React, { useEffect, useState, useRef, useCallback, useMemo } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { getProxyUrl } from "../utils/common"
import {
  fetchVideoDetail,
  fetchVideos,
  saveHistory,
  fetchHistory,
  fetchVideoSources, // 确保引入了这个
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
  Globe,
  Database,
} from "lucide-react"
import { FocusableWrapper } from "../components/tv/FocusableWrapper"

// 定义统一的源结构
interface UnifiedSource {
  id: string // 唯一标识 (内部源用 index，外部源用 id)
  name: string // 显示名称 (如 "怪奇物语 第二季" 或 "非凡资源")
  remarks: string // 备注 (如 "完结")
  vod_play_url: string // 播放地址字符串
  type: "local" | "external" // 标记来源类型
}

const Detail = () => {
  const { id: routeId } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()

  // --- 基础状态 ---
  const [detail, setDetail] = useState<VideoDetail | null>(null)
  const [isDetailLoading, setIsDetailLoading] = useState(true)
  const [recommendations, setRecommendations] = useState<VideoSummary[]>([])
  const [isRecLoading, setIsRecLoading] = useState(true)

  // --- 播放源状态 (核心) ---
  const [activeSource, setActiveSource] = useState<UnifiedSource | null>(null)
  const [externalSources, setExternalSources] = useState<UnifiedSource[]>([])
  const [isSourceSearching, setIsSourceSearching] = useState(false)

  // --- 播放状态 ---
  const [currentEpIndex, setCurrentEpIndex] = useState(0)
  const [startTime, setStartTime] = useState(0)
  const [isDescExpanded, setIsDescExpanded] = useState(false)
  const [showSourcePanel, setShowSourcePanel] = useState(false)

  // --- Refs ---
  const detailRef = useRef<VideoDetail | null>(null)
  const currentEpIndexRef = useRef(0)
  const currentTimeRef = useRef(0)
  const userRef = useRef(user)

  useEffect(() => {
    userRef.current = user
  }, [user])

  // 🔥 1. 动态计算集数列表 (依赖 activeSource)
  const episodes = useMemo(() => {
    if (!activeSource || !activeSource.vod_play_url) return []

    return activeSource.vod_play_url.split("#").map((segment) => {
      const parts = segment.split("$")
      return {
        name: parts.length > 1 ? parts[0] : "正片",
        link: parts.length > 1 ? parts[1] : parts[0],
      }
    })
  }, [activeSource])

  // 🔥 2. 初始化加载逻辑
  useEffect(() => {
    if (!routeId) return

    // 重置所有状态
    setDetail(null)
    setExternalSources([])
    setActiveSource(null)
    setIsDetailLoading(true)
    setCurrentEpIndex(0)
    setStartTime(0)

    const loadData = async () => {
      try {
        const [videoData, historyList] = await Promise.all([
          fetchVideoDetail(routeId),
          user ? fetchHistory(user.username) : Promise.resolve([]),
        ])

        setDetail(videoData)
        detailRef.current = videoData
        setIsDetailLoading(false)

        // A. 初始化默认源 (取数据库第一个)
        if (videoData.sources && videoData.sources.length > 0) {
          const defaultSource = videoData.sources[0]
          const initialSource: UnifiedSource = {
            id: `local_0`,
            name:
              defaultSource.vod_name || defaultSource.source_name || "默认线路",
            remarks: defaultSource.remarks,
            vod_play_url: defaultSource.vod_play_url,
            type: "local",
          }
          setActiveSource(initialSource)
        }

        // B. 恢复历史进度
        if (user && historyList) {
          const record = historyList.find(
            (h: any) => String(h.id) === String(videoData.id),
          )
          if (record) {
            setCurrentEpIndex(record.episodeIndex || 0)
            setStartTime(record.progress || 0)
            // TODO: 如果历史记录里存了 sourceId，这里可以恢复到上次看的那个源
          }
        }

        // C. 加载推荐
        loadRecommendations(videoData.category || "movie", videoData.id)

        // D. 触发全网搜索 (静默后台进行)
        searchExternalSources(videoData.title)
      } catch (e) {
        console.error(e)
        toast.error("视频加载失败")
        setIsDetailLoading(false)
      }
    }

    loadData()
  }, [routeId, user?.username])

  // 🔥 3. 全网搜源逻辑
  const searchExternalSources = async (title: string) => {
    const cleanTitle = title
      .replace(/第[0-9一二三四五六七八九十]+[季部]/, "")
      .trim()
    setIsSourceSearching(true)

    try {
      const list = await fetchVideoSources(cleanTitle)

      // 转换格式
      const formatted: UnifiedSource[] = list.map((item: any) => ({
        id: item.id, // 这里 id 通常是 "feifan_12345"
        name: item.title, // "怪奇物语 第二季"
        remarks: `${item.source_name} • ${item.remarks}`, // "非凡 • 完结"
        vod_play_url: item.vod_play_url, // 假设后端接口返回了这个，如果没有需要回源查详情
        type: "external",
      }))

      // 过滤掉已经在本地存在的 (根据 vod_play_url 简单去重，或者 ID)
      setExternalSources(formatted)
    } catch (e) {
      console.error(e)
    } finally {
      setIsSourceSearching(false)
    }
  }

  // 🔥 4. 切换源逻辑 (无刷新)
  const handleSourceChange = (newSource: UnifiedSource) => {
    if (activeSource?.id === newSource.id) return

    saveProgressToDB() // 切源前保存进度

    setActiveSource(newSource)
    setCurrentEpIndex(0) // 重置集数
    setStartTime(0) // 重置时间
    setShowSourcePanel(false)

    toast.success(`已切换至: ${newSource.name}`)
  }

  // 辅助逻辑
  const loadRecommendations = async (cat: string, currentId: string) => {
    try {
      let res = await fetchVideos({ cat, pg: 1 }).catch(() => ({ list: [] }))
      setRecommendations(
        (res.list || [])
          .filter((v: any) => String(v.id) !== String(currentId))
          .slice(0, 9),
      )
    } catch {}
  }

  const saveProgressToDB = useCallback(() => {
    if (!userRef.current || !detailRef.current) return
    if (currentTimeRef.current > 5) {
      saveHistory({
        username: userRef.current.username,
        video: {
          id: detailRef.current.id,
          title: detailRef.current.title,
          poster: detailRef.current.poster,
          type: detailRef.current.category || "video",
        },
        episodeIndex: currentEpIndexRef.current,
        progress: currentTimeRef.current,
      }).catch(console.error)
    }
  }, [])

  // 页面离开保存
  useEffect(() => {
    const handleVis = () =>
      document.visibilityState === "hidden" && saveProgressToDB()
    document.addEventListener("visibilitychange", handleVis)
    return () => {
      saveProgressToDB()
      document.removeEventListener("visibilitychange", handleVis)
    }
  }, [saveProgressToDB])

  // 播放器交互
  const handleEpisodeChange = (idx: number) => {
    if (idx === currentEpIndex) return
    saveProgressToDB()
    setCurrentEpIndex(idx)
    currentEpIndexRef.current = idx
    setStartTime(0)
  }

  const currentEp = episodes[currentEpIndex]

  // 渲染源面板
  const renderSourcePanel = () => (
    <div className="bg-[#0f0f0f] border-b border-white/5 p-4 animate-in slide-in-from-top-2 max-h-[60vh] overflow-y-auto">
      {/* A. 本地数据库源 (不同季度/线路) */}
      {detail?.sources && detail.sources.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3 text-emerald-500">
            <Database size={14} />
            <h3 className="text-xs font-bold">精选线路 / 季度</h3>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {detail.sources.map((source, idx) => {
              const sourceId = `local_${idx}`
              const isCurrent = activeSource?.id === sourceId
              const unifiedSource: UnifiedSource = {
                id: sourceId,
                name:
                  source.vod_name || source.source_name || `线路 ${idx + 1}`,
                remarks: source.remarks,
                vod_play_url: source.vod_play_url,
                type: "local",
              }

              return (
                <FocusableWrapper
                  key={sourceId}
                  onEnter={() => handleSourceChange(unifiedSource)}
                  className={`
                    flex items-center justify-between p-3 rounded-xl border transition-all text-left
                    ${
                      isCurrent
                        ? "bg-emerald-500/10 border-emerald-500/50 text-emerald-400"
                        : "bg-[#1a1a1a] border-white/5 text-gray-300 hover:bg-[#252525]"
                    }
                  `}
                >
                  <div className="flex flex-col min-w-0">
                    <span className="text-xs font-bold truncate">
                      {unifiedSource.name}
                    </span>
                    <span className="text-[10px] opacity-50 mt-0.5 truncate">
                      {source.source_name}
                    </span>
                  </div>
                  {isCurrent && (
                    <Check
                      size={14}
                      className="text-emerald-500 shrink-0 ml-2"
                    />
                  )}
                </FocusableWrapper>
              )
            })}
          </div>
        </div>
      )}

      {/* B. 全网搜索源 */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2 text-blue-400">
            <Globe size={14} />
            <h3 className="text-xs font-bold">全网搜索结果</h3>
          </div>
          {isSourceSearching && (
            <span className="text-[10px] text-gray-500 flex items-center gap-1">
              <Loader2 size={10} className="animate-spin" /> 搜索中...
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 gap-2">
          {externalSources.length > 0
            ? externalSources.map((item) => {
                const isCurrent = activeSource?.id === item.id
                return (
                  <FocusableWrapper
                    key={item.id}
                    onEnter={() => handleSourceChange(item)}
                    className={`
                    flex items-center justify-between p-3 rounded-xl border transition-all
                    ${isCurrent ? "bg-blue-500/10 border-blue-500/50 text-blue-400" : "bg-[#1a1a1a] border-white/5 text-gray-300"}
                  `}
                  >
                    <div>
                      <span className="text-xs font-bold block">
                        {item.name}
                      </span>
                      <span className="text-[10px] opacity-50">
                        {item.remarks}
                      </span>
                    </div>
                    {isCurrent && <Check size={14} />}
                  </FocusableWrapper>
                )
              })
            : !isSourceSearching && (
                <div className="text-[10px] text-gray-600 text-center py-4">
                  暂无额外资源
                </div>
              )}
        </div>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-gray-100 font-sans flex flex-col">
      {/* 播放器 (Sticky) */}
      <div className="sticky top-0 z-50 w-full bg-black shrink-0">
        <div className="aspect-video w-full relative group">
          <FocusableWrapper
            onEnter={() => navigate(-1)}
            className="absolute top-4 left-4 z-20 p-2 bg-black/40 backdrop-blur-md rounded-full text-white hover:bg-emerald-500 transition-colors active:scale-90"
          >
            <ChevronLeft size={20} />
          </FocusableWrapper>

          {isDetailLoading ? (
            <div className="w-full h-full flex flex-col items-center justify-center bg-[#111]">
              <Loader2 className="animate-spin text-emerald-500" size={32} />
            </div>
          ) : currentEp ? (
            <Player
              key={currentEp.link} // URL 变化时强制重载播放器
              url={currentEp.link}
              poster={detail?.pic || detail?.poster}
              initialTime={startTime}
              onTimeUpdate={(t) => (currentTimeRef.current = t)}
              onEnded={() => {
                if (currentEpIndex < episodes.length - 1) {
                  handleEpisodeChange(currentEpIndex + 1)
                  toast.success("下一集")
                }
              }}
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center text-gray-500 gap-2 bg-[#111]">
              <Info size={32} />
              <span className="text-xs">暂无播放资源</span>
            </div>
          )}
        </div>
      </div>

      {/* 顶部操作条 */}
      <div className="bg-[#121212] px-4 py-3 flex items-center justify-between border-b border-white/5 shrink-0">
        <div className="flex items-center gap-3 overflow-x-auto no-scrollbar">
          {/* 换源按钮 */}
          <FocusableWrapper
            onEnter={() => setShowSourcePanel(!showSourcePanel)}
            className="flex items-center gap-2 px-3 py-1.5 bg-white/5 rounded-full border border-white/5 active:bg-white/10"
          >
            {activeSource?.type === "local" ? (
              <Database size={12} className="text-emerald-500" />
            ) : (
              <Globe size={12} className="text-blue-400" />
            )}
            <span className="text-[10px] font-bold max-w-[150px] truncate">
              {activeSource?.name || "选择线路"}
            </span>
            <ChevronDown
              size={12}
              className={`text-gray-500 transition-transform ${showSourcePanel ? "rotate-180" : ""}`}
            />
          </FocusableWrapper>

          <FocusableWrapper
            className="px-2 py-1"
            onEnter={() => toast("暂不支持", { icon: "📺" })}
          >
            <Cast size={16} className="text-gray-400" />
          </FocusableWrapper>
        </div>
      </div>

      {/* 源面板 */}
      {showSourcePanel && renderSourcePanel()}

      {/* 详情信息 */}
      <div className="p-4 space-y-6 flex-1 overflow-y-auto">
        <div>
          <h1 className="text-xl font-bold text-white mb-2">{detail?.title}</h1>
          <div className="flex gap-2 mb-3">
            <span className="text-[10px] bg-emerald-900/30 text-emerald-400 px-2 py-0.5 rounded border border-emerald-500/20">
              {detail?.year}
            </span>
            <span className="text-[10px] bg-white/10 text-gray-300 px-2 py-0.5 rounded">
              {detail?.category}
            </span>
          </div>
          <FocusableWrapper
            onEnter={() => setIsDescExpanded(!isDescExpanded)}
            className="p-1 rounded"
          >
            <p
              className={`text-xs text-gray-400 leading-relaxed ${!isDescExpanded ? "line-clamp-2" : ""}`}
            >
              {detail?.content || "暂无简介"}
            </p>
          </FocusableWrapper>
        </div>

        {/* 选集 */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <PlayCircle size={16} className="text-emerald-500" />
              <span className="text-sm font-bold">选集</span>
            </div>
            <span className="text-[10px] text-gray-500">
              {episodes.length} 集
            </span>
          </div>

          <div className="flex flex-wrap gap-2 max-h-80 overflow-y-auto content-start pr-1 custom-scrollbar">
            {episodes.map((ep, idx) => (
              <FocusableWrapper
                key={idx}
                onEnter={() => handleEpisodeChange(idx)}
                className={`
                  w-[calc(20%-6.5px)] h-10 rounded-lg flex items-center justify-center text-xs font-medium truncate px-1 transition-all
                  ${
                    idx === currentEpIndex
                      ? "bg-emerald-600 text-white shadow-lg shadow-emerald-900/40"
                      : "bg-[#1A1A1A] text-gray-400 border border-white/5"
                  }
                `}
              >
                {ep.name.replace(/第|集/g, "")}
              </FocusableWrapper>
            ))}
          </div>
        </div>

        {/* 猜你喜欢 */}
        {!isRecLoading && recommendations.length > 0 && (
          <div className="pt-6 mt-6 border-t border-white/5">
            <h3 className="text-sm font-bold mb-4">猜你喜欢</h3>
            <div className="grid grid-cols-3 gap-3">
              {recommendations.map((item) => (
                <FocusableWrapper
                  key={item.id}
                  onEnter={() => {
                    navigate(`/detail/${item.id}`)
                    window.scrollTo(0, 0)
                  }}
                  className="rounded-lg overflow-hidden"
                >
                  <div className="aspect-[2/3] bg-[#1a1a1a] relative">
                    <img
                      src={getProxyUrl(item.poster)}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  </div>
                  <h4 className="text-xs text-gray-300 mt-2 line-clamp-1 p-1">
                    {item.title}
                  </h4>
                </FocusableWrapper>
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
