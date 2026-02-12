import React, { useEffect, useState, useRef, useCallback, useMemo } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { getProxyUrl } from "../utils/common"
import {
  fetchVideoDetail,
  fetchVideos,
  saveHistory,
  fetchHistory,
  fetchVideoSources,
} from "../services/api"
import { VideoDetail, VideoSummary } from "../types"
import Player from "../components/Player"
import { useAuth } from "../context/AuthContext"
import toast from "react-hot-toast"
import {
  ChevronLeft,
  PlayCircle,
  Info,
  Loader2,
  Globe,
  Check,
  Search,
  Layers,
  Sparkles,
  X,
} from "lucide-react"
import SEO from "../components/SEO"

// 定义统一的源结构
interface UnifiedSource {
  id: string
  name: string
  remarks: string
  vod_play_url: string
  type: "local" | "external"
}

const Detail = () => {
  const { id: routeId } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()

  // 状态
  const [detail, setDetail] = useState<VideoDetail | null>(null)
  const [isDetailLoading, setIsDetailLoading] = useState(true)
  const [recommendations, setRecommendations] = useState<VideoSummary[]>([])
  const [isRecLoading, setIsRecLoading] = useState(true)

  // 当前激活的播放源（对应某一季）
  const [activeSource, setActiveSource] = useState<UnifiedSource | null>(null)

  // 外部搜索源
  const [externalSources, setExternalSources] = useState<UnifiedSource[]>([])
  const [isSourceSearching, setIsSourceSearching] = useState(false)
  const [showExternalPanel, setShowExternalPanel] = useState(false) // 改名为外部源面板

  // 播放进度与集数
  const [currentEpIndex, setCurrentEpIndex] = useState(0)
  const [startTime, setStartTime] = useState(0)
  const [isDescExpanded, setIsDescExpanded] = useState(false)

  // Refs
  const detailRef = useRef<VideoDetail | null>(null)
  const currentEpIndexRef = useRef(0)
  const currentTimeRef = useRef(0)
  const userRef = useRef(user)

  // 🔄 核心修复：进入页面强制滚动到顶部
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [routeId])

  useEffect(() => {
    userRef.current = user
  }, [user])

  // 计算当前源的集数列表
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

  // 1. 加载数据
  useEffect(() => {
    if (!routeId) return
    // 重置状态
    setDetail(null)
    setExternalSources([])
    setActiveSource(null)
    setIsDetailLoading(true)
    setIsRecLoading(true)
    setRecommendations([])
    setCurrentEpIndex(0)
    setStartTime(0)
    setShowExternalPanel(false)

    const loadData = async () => {
      try {
        const [videoData, historyList] = await Promise.all([
          fetchVideoDetail(routeId),
          user ? fetchHistory(user.username) : Promise.resolve([]),
        ])

        setDetail(videoData)
        detailRef.current = videoData
        setIsDetailLoading(false)

        // 🎯 默认选中第一个源（第一季或最新季，取决于你入库顺序）
        if (videoData.sources && videoData.sources.length > 0) {
          const defaultSource = videoData.sources[0]
          setActiveSource({
            id: `local_0`,
            name:
              defaultSource.vod_name || defaultSource.source_name || "默认资源",
            remarks: defaultSource.remarks,
            vod_play_url: defaultSource.vod_play_url,
            type: "local",
          })
        }

        // 恢复历史记录
        if (user && historyList) {
          const record = historyList.find(
            (h: any) => String(h.id) === String(videoData.id),
          )
          if (record) {
            setCurrentEpIndex(record.episodeIndex || 0)
            setStartTime(record.progress || 0)
          }
        }

        loadRecommendations(videoData.category || "movie", videoData.id)
        // 悄悄在后台搜一下外部源，以备用户需要
        searchExternalSources(videoData.title)
      } catch (e) {
        console.error(e)
        toast.error("资源加载失败")
        setIsDetailLoading(false)
      }
    }
    loadData()
  }, [routeId, user?.username])

  const searchExternalSources = async (title: string) => {
    const cleanTitle = title
      .replace(/第[0-9一二三四五六七八九十]+[季部]/, "")
      .trim()
    setIsSourceSearching(true)
    try {
      const list = await fetchVideoSources(cleanTitle)
      setExternalSources(
        list.map((item: any) => ({
          id: item.id,
          name: item.title,
          remarks: `${item.source_name} • ${item.remarks}`,
          vod_play_url: item.vod_play_url,
          type: "external",
        })),
      )
    } catch {
      // 失败也不影响主流程
    } finally {
      setIsSourceSearching(false)
    }
  }

  const handleSourceChange = (newSource: UnifiedSource) => {
    if (activeSource?.id === newSource.id) return
    saveProgressToDB()
    setActiveSource(newSource)
    setCurrentEpIndex(0) // 切换季/源后，重置到第一集
    setStartTime(0)
    setShowExternalPanel(false)
    toast.success(`已切换至: ${newSource.name}`)
  }

  const loadRecommendations = async (cat: string, currentId: string) => {
    try {
      let res = await fetchVideos({ cat, pg: 1 }).catch(() => ({ list: [] }))
      setRecommendations(
        (res.list || [])
          .filter((v: any) => String(v.id) !== String(currentId))
          .slice(0, 9),
      )
    } finally {
      setIsRecLoading(false)
    }
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

  const handleBack = useCallback(
    (e: React.MouseEvent | React.PointerEvent) => {
      console.log("handleBack")
      e.preventDefault()
      e.stopPropagation()
      setTimeout(() => {
        if (window.history.length > 1) {
          window.history.back()
        } else {
          navigate("/", { replace: true })
        }
      }, 10)
    },
    [navigate],
  )

  useEffect(() => {
    const handleVis = () =>
      document.visibilityState === "hidden" && saveProgressToDB()
    document.addEventListener("visibilitychange", handleVis)
    return () => {
      saveProgressToDB()
      document.removeEventListener("visibilitychange", handleVis)
    }
  }, [saveProgressToDB])

  const handleEpisodeChange = (idx: number) => {
    if (idx === currentEpIndex) return
    saveProgressToDB()
    setCurrentEpIndex(idx)
    currentEpIndexRef.current = idx
    setStartTime(0)
  }

  const currentEp = episodes[currentEpIndex]

  // ✨ 新增：生成 SEO 元数据
  const seoData = useMemo(() => {
    if (!detail) return null

    // 1. 清洗简介 HTML 标签，并截取前 120 字作为 description
    const rawDesc = detail.content ? detail.content.replace(/<[^>]+>/g, "") : ""
    const shortDesc =
      rawDesc.slice(0, 120) + (rawDesc.length > 120 ? "..." : "")

    // 2. 构建描述
    const description = `在线观看《${detail.title}》(${detail.year})。${
      detail.remarks ? `更新至${detail.remarks}。` : ""
    }剧情简介：${shortDesc}`

    // 3. 构建关键词 (片名 + 演员 + 导演 + 类型)
    const keywords = [
      detail.title,
      detail.year?.toString(),
      detail.category,
      detail.director,
      ...(detail.actors ? detail.actors.split(",") : []), // 假设演员是逗号分隔字符串
      "高清在线",
      "免费观看",
      "极影聚合",
    ].filter(Boolean) as string[]

    return {
      title: `${detail.title} ${detail.remarks ? `- ${detail.remarks}` : ""} - 高清在线观看`,
      description,
      keywords,
      image: detail.poster,
    }
  }, [detail])

  // ✨ 新增：生成结构化数据 (Schema.org) - 让 Google 显示富文本电影卡片
  const jsonLd = useMemo(() => {
    if (!detail) return null

    // 区分电影还是电视剧
    const isMovie = detail.category === "movie" || detail.type === "movie"
    const schemaType = isMovie ? "Movie" : "TVSeries"

    return {
      "@context": "https://schema.org",
      "@type": schemaType,
      name: detail.title,
      image: getProxyUrl(detail.poster),
      description: detail.content?.replace(/<[^>]+>/g, ""),
      datePublished: detail.year,
      director: {
        "@type": "Person",
        name: detail.director || "Unknown",
      },
      actor:
        detail.actors?.split(",").map((name) => ({
          "@type": "Person",
          name: name.trim(),
        })) || [],
      offers: {
        "@type": "Offer",
        availability: "https://schema.org/InStock",
        price: "0",
        priceCurrency: "CNY",
      },
    }
  }, [detail])

  // 📺 渲染全网搜索面板 (仅用于外部源)
  const renderExternalPanel = () => (
    <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex items-end sm:items-center justify-center p-4 animate-in fade-in">
      <div
        className="bg-[#1a1a1a] w-full max-w-md rounded-2xl max-h-[70vh] flex flex-col shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 border-b border-white/10 flex items-center justify-between">
          <h3 className="font-bold text-white flex items-center gap-2">
            <Globe size={16} className="text-blue-400" /> 全网云搜结果
          </h3>
          <button
            onClick={() => setShowExternalPanel(false)}
            className="p-1 text-gray-400 hover:text-white"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-2 overflow-y-auto custom-scrollbar">
          {isSourceSearching ? (
            <div className="py-8 flex flex-col items-center text-gray-500 gap-2">
              <Loader2 size={24} className="animate-spin text-blue-500" />
              <span className="text-xs">正在搜索全网资源...</span>
            </div>
          ) : externalSources.length === 0 ? (
            <div className="py-8 text-center text-gray-500 text-sm">
              未找到相关外部资源
            </div>
          ) : (
            <div className="grid gap-2">
              {externalSources.map((item) => (
                <button
                  key={item.id}
                  onClick={() => handleSourceChange(item)}
                  className={`flex items-center justify-between p-3 rounded-lg border transition-all active:scale-95 text-left ${
                    activeSource?.id === item.id
                      ? "bg-blue-500/10 border-blue-500/50 text-blue-400"
                      : "bg-[#252525] border-white/5 text-gray-300 hover:bg-[#333]"
                  }`}
                >
                  <div className="min-w-0">
                    <span className="text-xs font-bold block truncate">
                      {item.name}
                    </span>
                    <span className="text-[10px] opacity-50 block mt-1">
                      {item.remarks}
                    </span>
                  </div>
                  {activeSource?.id === item.id && <Check size={14} />}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )

  return (
    // 💡 修复滚动条问题：去掉 h-screen 和 overflow-hidden，使用 min-h-screen
    <div className="min-h-screen bg-[#0a0a0a] text-gray-100 font-sans relative pb-10">
      {/* ✅ 插入 SEO 组件 */}
      {seoData && (
        <SEO
          title={seoData.title}
          description={seoData.description}
          keywords={seoData.keywords}
          image={getProxyUrl(seoData.image)} // 确保使用代理后的图片地址
          type={detail?.category === "movie" ? "video.movie" : "video.tv_show"}
        />
      )}

      {/* ✅ 插入 JSON-LD 结构化数据 (这对 Google 收录极重要) */}
      {jsonLd && (
        <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
      )}

      {/* 1. 播放器区域 (Sticky 吸顶) */}
      <div className="sticky top-0 z-40 w-full bg-black shrink-0 shadow-xl shadow-black/50">
        <div className="aspect-video w-full relative group">
          <button
            onPointerUp={handleBack}
            className="absolute top-4 left-4 z-50 p-2.5 bg-black/40 backdrop-blur-md rounded-full text-white hover:bg-emerald-500 transition-all active:scale-90 border border-white/10"
          >
            <ChevronLeft size={20} />
          </button>

          {isDetailLoading ? (
            <div className="w-full h-full flex flex-col items-center justify-center bg-[#111]">
              <Loader2 className="animate-spin text-emerald-500" size={32} />
            </div>
          ) : currentEp ? (
            <Player
              key={currentEp.link}
              url={currentEp.link}
              poster={detail?.backdrop || detail?.poster}
              initialTime={startTime}
              onTimeUpdate={(t) => (currentTimeRef.current = t)}
              onEnded={() => {
                if (currentEpIndex < episodes.length - 1) {
                  handleEpisodeChange(currentEpIndex + 1)
                  toast.success("自动播放下一集")
                }
              }}
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center text-gray-500 gap-3 bg-[#111]">
              <Info size={32} />
              <div className="text-center">
                <p className="text-sm font-bold">暂无播放资源</p>
                <p className="text-xs opacity-50 mt-1">
                  请尝试下方的“全网搜索”功能
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 2. 核心优化：季/源选择栏 (横向滚动) */}
      {/* 这一块直接展示在文档流中，不再需要折叠 */}
      <div className="bg-[#121212] border-b border-white/5">
        <div className="px-4 py-3">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-bold text-gray-400 flex items-center gap-1">
              <Layers size={12} /> 版本 / 季数
            </h3>
            {/* 外部源搜素入口 */}
            <button
              onClick={() => setShowExternalPanel(true)}
              className="text-[10px] text-blue-400 flex items-center gap-1 px-2 py-1 rounded-full bg-blue-500/10 active:bg-blue-500/20"
            >
              <Search size={10} />
              全网云搜
            </button>
          </div>

          <div className="flex flex-wrap justify-between  items-center pb-1">
            {/* 渲染本地源 (即: 每一季) */}
            {detail?.sources?.map((source, idx) => {
              const sourceId = `local_${idx}`
              const isActive = activeSource?.id === sourceId
              return (
                <button
                  key={sourceId}
                  onClick={() =>
                    handleSourceChange({
                      id: sourceId,
                      name: source.vod_name || `版本 ${idx + 1}`,
                      remarks: source.remarks,
                      vod_play_url: source.vod_play_url,
                      type: "local",
                    })
                  }
                  className={`flex-shrink-0 px-4 py-2 rounded-lg w-[48%] my-2 text-xs font-bold transition-all border ${
                    isActive
                      ? "bg-emerald-600 text-white border-emerald-500 shadow-lg shadow-emerald-900/20"
                      : "bg-[#1E1E1E] text-gray-400 border-white/5 hover:bg-[#252525]"
                  }`}
                >
                  {/* 优先显示 vod_name (例如: 怪奇物语 第二季) */}
                  {source.vod_name || source.source_name || `线路 ${idx + 1}`}
                  {source.remarks && (
                    <span className="ml-1 opacity-60 text-[10px] font-normal">
                      ({source.remarks})
                    </span>
                  )}
                </button>
              )
            })}

            {/* 如果当前选中的是外部源，也显示在这里 */}
            {activeSource?.type === "external" && (
              <button className="flex-shrink-0 px-4 py-2 rounded-lg text-xs font-bold bg-blue-600 text-white border border-blue-500">
                <Globe size={10} className="inline mr-1" />
                {activeSource.name}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 3. 视频信息区域 */}
      <div className="p-4 space-y-6">
        {/* 标题与简介 */}
        <div>
          <h1 className="text-xl font-bold text-white mb-2 leading-snug">
            {detail?.title}
          </h1>
          <div className="flex flex-wrap gap-2 mb-3">
            {detail?.year && (
              <span className="text-[10px] bg-white/10 text-gray-300 px-2 py-0.5 rounded backdrop-blur-md">
                {detail.year}
              </span>
            )}
            {detail?.category && (
              <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded border border-emerald-500/20">
                {detail.category}
              </span>
            )}
            {activeSource?.type === "local" && (
              <span className="text-[10px] bg-gray-800 text-gray-400 px-2 py-0.5 rounded flex items-center gap-1">
                <Sparkles size={10} /> 本地极速
              </span>
            )}
          </div>

          <div
            onClick={() => setIsDescExpanded(!isDescExpanded)}
            className="active:opacity-70 group cursor-pointer"
          >
            <p
              className={`text-xs text-gray-400 leading-relaxed transition-all ${!isDescExpanded ? "line-clamp-2" : ""}`}
            >
              {detail?.content
                ? detail.content.replace(/<[^>]+>/g, "")
                : "暂无简介"}
            </p>
            {!isDescExpanded && (
              <div className="flex justify-center -mt-2 group-hover:translate-y-1 transition-transform">
                <span className="text-[10px] text-gray-600">▼</span>
              </div>
            )}
          </div>
        </div>

        {/* 4. 选集区域 (Grid) */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <PlayCircle size={16} className="text-emerald-500" />
              <span className="text-sm font-bold text-white">
                选集 (
                {activeSource?.name?.replace(detail?.title || "", "").trim() ||
                  "正片"}
                )
              </span>
            </div>
            <span className="text-[10px] text-gray-500 bg-[#1a1a1a] px-2 py-1 rounded-full">
              共 {episodes.length} 集
            </span>
          </div>

          {episodes.length > 0 ? (
            <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
              {episodes.map((ep, idx) => {
                const isActive = idx === currentEpIndex
                // 清洗集数名称，去掉冗余的“第”“集”
                const cleanName = ep.name
                  .replace(/第|集|Season|Episode/gi, "")
                  .trim()

                return (
                  <button
                    key={idx}
                    onClick={() => handleEpisodeChange(idx)}
                    className={`
                      h-10 rounded-lg flex items-center justify-center text-xs font-bold truncate transition-all active:scale-95
                      ${
                        isActive
                          ? "bg-emerald-600 text-white shadow-lg shadow-emerald-900/30"
                          : "bg-[#1A1A1A] text-gray-400 border border-white/5 hover:bg-[#252525] hover:text-white"
                      }
                    `}
                  >
                    {cleanName.length > 4 ? (
                      <span className="text-[10px]">{cleanName}</span>
                    ) : (
                      cleanName
                    )}
                  </button>
                )
              })}
            </div>
          ) : (
            <div className="text-center py-8 bg-[#151515] rounded-xl border border-dashed border-white/5">
              <p className="text-xs text-gray-500">
                该源暂无集数信息，请尝试切换其他版本
              </p>
            </div>
          )}
        </div>

        {/* 5. 猜你喜欢 */}
        {!isRecLoading && recommendations.length > 0 && (
          <div className="pt-6 mt-6 border-t border-white/5">
            <h3 className="text-sm font-bold mb-4 text-gray-200">猜你喜欢</h3>
            <div className="grid grid-cols-3 gap-3">
              {recommendations.map((item) => (
                <div
                  key={item.id}
                  onClick={() => {
                    navigate(`/detail/${item.id}`)
                    window.scrollTo(0, 0)
                  }}
                  className="group active:scale-95 transition-transform duration-200 cursor-pointer"
                >
                  <div className="aspect-[2/3] bg-[#1a1a1a] rounded-lg overflow-hidden relative">
                    <img
                      src={getProxyUrl(item.poster)}
                      alt={item.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      loading="lazy"
                    />
                    <div className="absolute top-1 right-1 bg-black/60 backdrop-blur-sm px-1.5 py-0.5 rounded text-[10px] font-bold text-white">
                      {item.year}
                    </div>
                  </div>
                  <h4 className="text-xs text-gray-300 mt-2 line-clamp-1 group-hover:text-emerald-400 transition-colors">
                    {item.title}
                  </h4>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 弹出的全网搜索面板 */}
      {showExternalPanel && renderExternalPanel()}
    </div>
  )
}

export default Detail
