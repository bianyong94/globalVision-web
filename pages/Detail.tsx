import React, { useEffect, useState, useRef } from "react"
import { useParams, useNavigate } from "react-router-dom"
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
  Loader2,
  ChevronLeft,
  PlayCircle,
  Info,
  Cast,
  ThumbsUp,
  MessageSquare,
  Send,
} from "lucide-react"

const Detail = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()

  // 数据状态
  const [detail, setDetail] = useState<VideoDetail | null>(null)
  const [recommendations, setRecommendations] = useState<VideoSummary[]>([])
  const [loading, setLoading] = useState(true)

  // 播放状态
  const [currentEpIndex, setCurrentEpIndex] = useState(0)
  const [startTime, setStartTime] = useState(0)
  const [isDescExpanded, setIsDescExpanded] = useState(false)

  // Refs
  const detailRef = useRef<VideoDetail | null>(null)
  const currentEpIndexRef = useRef(0)

  // 1. 加载数据核心逻辑
  useEffect(() => {
    if (!id) return

    // 初始化重置
    setDetail(null)
    setRecommendations([])
    setLoading(true)
    setCurrentEpIndex(0)
    setStartTime(0)

    const load = async () => {
      try {
        // A. 获取详情
        const data = await fetchVideoDetail(id)
        setDetail(data)
        detailRef.current = data

        // B. 获取推荐 (增强版兜底逻辑)
        // 尝试1: 按分类搜
        let recRes = await fetchVideos({ t: data.type, pg: 1 }).catch(() => ({
          list: [],
        }))
        let recList = recRes.list || []

        // 尝试2: 如果分类搜不到，就搜最新热门 (兜底，保证有数据)
        if (recList.length === 0) {
          console.log("分类推荐为空，切换为热门推荐")
          const hotRes = await fetchVideos({ pg: 1 }).catch(() => ({
            list: [],
          }))
          recList = hotRes.list || []
        }

        // 过滤掉当前视频自己
        const finalRecs = recList
          .filter((v: any) => String(v.id) !== String(data.id))
          .slice(0, 6)
        setRecommendations(finalRecs)

        // C. 获取历史进度
        if (user) {
          const historyList = await fetchHistory(user.username)
          const record = historyList.find(
            (h: any) => String(h.id) === String(data.id)
          )
          if (record) {
            const savedEpIdx = record.episodeIndex || 0
            if (savedEpIdx < data.episodes.length) {
              setCurrentEpIndex(savedEpIdx)
              currentEpIndexRef.current = savedEpIdx
            }
            setStartTime(record.progress || 0)
          }
        }
      } catch (e) {
        console.error(e)
        toast.error("资源加载异常")
      } finally {
        setLoading(false)
      }
    }
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, user?.username])

  // 2. 历史记录保存
  const handleSaveHistory = (time: number) => {
    if (!user || !detailRef.current) return
    if (time > 5 && time % 5 === 0) {
      saveHistory({
        username: user.username,
        video: {
          id: detailRef.current.id,
          title: detailRef.current.title,
          poster: detailRef.current.poster,
          type: detailRef.current.type,
        },
        episodeIndex: currentEpIndexRef.current,
        progress: time,
      }).catch(() => {})
    }
  }

  const handleEpisodeChange = (index: number) => {
    setCurrentEpIndex(index)
    currentEpIndexRef.current = index
    setStartTime(0)
    handleSaveHistory(0)
  }

  if (loading)
    return (
      <div className="h-screen bg-black flex items-center justify-center">
        <Loader2 className="animate-spin text-emerald-500 w-8 h-8" />
      </div>
    )

  if (!detail)
    return (
      <div className="h-screen bg-black flex flex-col items-center justify-center text-gray-500 gap-4">
        <Info size={40} />
        <p>无法加载该资源</p>
        <button
          onClick={() => navigate(-1)}
          className="border border-white/20 px-4 py-2 rounded-full text-sm text-white"
        >
          返回
        </button>
      </div>
    )

  const currentEp = detail.episodes[currentEpIndex]

  return (
    // 最外层容器：标准 Flex 纵向布局
    <div className="min-h-screen bg-[#0a0a0a] text-gray-100 font-sans flex flex-col">
      {/* --- 第一块：播放器 (Sticky 吸顶) --- */}
      <div className="sticky top-0 z-50 w-full bg-black shrink-0">
        <div className="aspect-video w-full relative">
          {/* 返回按钮 */}
          <button
            onClick={() => navigate(-1)}
            className="absolute top-4 left-4 z-20 p-2 bg-black/40 backdrop-blur rounded-full text-white hover:bg-emerald-500 transition-colors"
          >
            <ChevronLeft size={20} />
          </button>

          {currentEp ? (
            <Player
              url={currentEp.link}
              poster={detail.backdrop || detail.poster}
              initialTime={startTime}
              onTimeUpdate={handleSaveHistory}
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center text-gray-500 gap-2 bg-[#111]">
              <Info size={32} />
              <span className="text-xs">暂无播放源</span>
            </div>
          )}
        </div>
      </div>

      {/* --- 第二块：操作条 (截图里的 投屏+弹幕条) --- */}
      {/* 这里是标准流布局，紧贴播放器下方，绝不重叠 */}
      <div className="bg-[#121212] px-4 py-3  flex items-center gap-3 border-b border-white/5 shrink-0">
        <button
          onClick={() => toast("请使用浏览器自带投屏功能", { icon: "📺" })}
          className="flex items-center gap-1 text-gray-400 hover:text-white shrink-0"
        >
          <Cast size={18} />
          <span className="text-xs">投屏</span>
        </button>
      </div>

      {/* --- 第三块：详情信息 (流式布局) --- */}
      <div className="p-4 space-y-6 flex-1 overflow-y-auto">
        {/* 1. 标题和标签 */}
        <div>
          <h1 className="text-lg font-bold text-white mb-2 leading-snug">
            {detail.title}
          </h1>
          <div className="flex items-center flex-wrap gap-2">
            <span className="text-emerald-500 bg-emerald-500/10 px-1.5 py-0.5 rounded text-[10px] font-bold">
              {detail.year || "2024"}
            </span>
            <span className="text-gray-400 bg-white/5 px-1.5 py-0.5 rounded text-[10px]">
              {detail.area}
            </span>
            <span className="text-gray-400 bg-white/5 px-1.5 py-0.5 rounded text-[10px]">
              {detail.type}
            </span>
          </div>
        </div>

        {/* 2. 简介 (折叠) */}
        <div
          className="bg-[#161616] p-3 rounded-xl border border-white/5"
          onClick={() => setIsDescExpanded(!isDescExpanded)}
        >
          <p
            className={`text-xs text-gray-400 leading-relaxed ${
              isDescExpanded ? "" : "line-clamp-2"
            }`}
          >
            {detail.overview ? detail.overview.trim() : "暂无简介"}
          </p>
          <div className="flex justify-center mt-1">
            <div
              className={`w-8 h-1 bg-white/10 rounded-full ${
                isDescExpanded ? "bg-emerald-500/50" : ""
              }`}
            />
          </div>
        </div>

        {/* 3. 选集 (常规流式布局，Flex Wrap) */}
        {/* 你说不要Grid，这里改用 Flex Wrap，更符合"常规流" */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <PlayCircle size={16} className="text-emerald-500" />
              <h3 className="text-sm font-bold text-white">选集</h3>
            </div>
            <span className="text-xs text-gray-500">
              共 {detail.episodes.length} 集
            </span>
          </div>

          <div className="flex flex-wrap gap-2 max-h-80 overflow-y-auto content-start">
            {detail.episodes.map((ep, idx) => {
              const isActive = idx === currentEpIndex
              return (
                <button
                  key={idx}
                  onClick={() => handleEpisodeChange(idx)}
                  // w-[calc(20%-8px)] 意思是每行大约5个，用 flex 模拟 grid
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
        </div>

        {/* 4. 相关推荐 (底部模块) */}
        {recommendations.length > 0 && (
          <div className="pt-6 mt-6 border-t border-white/5">
            <div className="flex items-center gap-2 mb-4">
              <ThumbsUp size={16} className="text-pink-500" />
              <h3 className="text-sm font-bold text-white">猜你喜欢</h3>
            </div>

            {/* 推荐列表使用 Grid (封面墙适合 Grid) */}
            <div className="grid grid-cols-3 gap-3">
              {recommendations.map((item) => (
                <div
                  key={item.id}
                  onClick={() => {
                    navigate(`/detail/${item.id}`)
                    window.scrollTo({ top: 0, behavior: "smooth" })
                  }}
                  className="space-y-1.5"
                >
                  <div className="aspect-[2/3] bg-[#1a1a1a] rounded-lg overflow-hidden relative">
                    <img
                      src={item.poster}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                    <div className="absolute top-1 right-1 bg-black/60 text-[10px] text-white px-1 rounded backdrop-blur">
                      {item.rating || "Hot"}
                    </div>
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
