import React, { useEffect, useState } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { fetchVideoDetail, saveHistory } from "../services/api"
import { VideoDetail } from "../types"
import Player from "../components/Player" // 引入新播放器
import { useAuth } from "../context/AuthContext"
import {
  Loader2,
  ChevronLeft,
  Calendar,
  MapPin,
  Tag,
  PlayCircle,
  Info,
} from "lucide-react"

const Detail = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()

  const [detail, setDetail] = useState<VideoDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [currentEpIndex, setCurrentEpIndex] = useState(0)

  useEffect(() => {
    if (!id) return
    const load = async () => {
      setLoading(true)
      try {
        const data = await fetchVideoDetail(id)
        setDetail(data)

        // 自动保存历史记录 (仅在第一次加载时，或者切换集数时单独处理)
        if (user && data) {
          saveCurrentHistory(data, 0)
        }
      } catch (e) {
        console.error(e)
      } finally {
        setLoading(false)
      }
    }
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]) // user 不放入依赖，防止因为 user 状态变化导致页面重刷

  // 封装保存历史记录，切换集数时也调用
  const saveCurrentHistory = (videoData: VideoDetail, epIndex: number) => {
    if (!user) return
    saveHistory({
      username: user.username,
      video: {
        id: videoData.id,
        title: videoData.title,
        poster: videoData.poster,
        type: videoData.type,
      },
      episodeIndex: epIndex,
      progress: 0,
    })
  }

  const handleEpisodeChange = (index: number) => {
    setCurrentEpIndex(index)
    if (detail) saveCurrentHistory(detail, index)
  }

  if (loading)
    return (
      <div className="h-screen bg-black flex items-center justify-center">
        <Loader2 className="animate-spin text-primary w-8 h-8" />
      </div>
    )
  if (!detail)
    return (
      <div className="h-screen bg-black flex items-center justify-center text-gray-400">
        资源不存在或已删除
      </div>
    )

  const currentEp = detail.episodes[currentEpIndex]

  return (
    <div className="min-h-screen bg-[#0a0a0a] pb-20 text-gray-100 font-sans">
      {/* 顶部导航栏 - 磨砂玻璃效果 */}
      <div className="sticky top-0 z-30 bg-black/60 backdrop-blur-md border-b border-white/5 px-4 h-14 flex items-center gap-3 transition-all">
        <button
          onClick={() => navigate(-1)}
          className="p-2 -ml-2 rounded-full hover:bg-white/10 active:scale-95 transition"
        >
          <ChevronLeft className="text-white w-6 h-6" />
        </button>
        <h1 className="text-white font-medium truncate flex-1 text-lg tracking-wide">
          {detail.title}
          <span className="text-xs text-gray-400 ml-2 font-normal">
            {currentEp ? `正在播放: ${currentEp.name}` : ""}
          </span>
        </h1>
      </div>

      {/* 播放器区域 - 粘性布局 */}
      <div className="w-full sticky top-14 z-20 shadow-xl bg-black">
        {currentEp ? (
          <Player
            url={currentEp.link}
            poster={detail.backdrop || detail.poster}
          />
        ) : (
          <div className="aspect-video bg-gray-900 flex flex-col items-center justify-center text-gray-500 gap-2">
            <Info size={32} />
            <span>暂无播放源</span>
          </div>
        )}
      </div>

      <div className="max-w-4xl mx-auto">
        {/* 影片核心信息区 */}
        <div className="p-5 space-y-4">
          <div className="flex justify-between items-start">
            <div className="space-y-1">
              <h2 className="text-2xl font-bold text-white tracking-tight">
                {detail.title}
              </h2>
              <div className="flex items-center flex-wrap gap-3 text-xs text-gray-400">
                {detail.year > 0 && (
                  <span className="flex items-center gap-1 bg-white/5 px-2 py-0.5 rounded">
                    <Calendar size={12} /> {detail.year}
                  </span>
                )}
                {detail.area && (
                  <span className="flex items-center gap-1 bg-white/5 px-2 py-0.5 rounded">
                    <MapPin size={12} /> {detail.area}
                  </span>
                )}
                {detail.type && (
                  <span className="flex items-center gap-1 bg-white/5 px-2 py-0.5 rounded">
                    <Tag size={12} /> {detail.type}
                  </span>
                )}
              </div>
            </div>
            {/* 评分徽章 */}
            {detail.rating > 0 && (
              <div className="flex flex-col items-end">
                <span className="text-2xl font-bold text-yellow-500 leading-none">
                  {detail.rating}
                </span>
                <span className="text-[10px] text-gray-500 mt-1">豆瓣评分</span>
              </div>
            )}
          </div>

          {/* 简介折叠/展开逻辑可以使用简单的 CSS line-clamp 或者手动做状态 */}
          <p className="text-sm text-gray-400 leading-relaxed text-justify bg-white/5 p-3 rounded-lg border border-white/5">
            {detail.overview ? detail.overview.trim() : "暂无简介"}
          </p>
        </div>

        {/* 选集区域 - Bilibili 风格网格 */}
        <div className="px-5 pb-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <PlayCircle size={18} className="text-primary" />
              <h3 className="font-bold text-white">
                选集 ({detail.episodes.length})
              </h3>
            </div>
            <span className="text-xs text-gray-500">
              更新至 {detail.episodes[detail.episodes.length - 1]?.name}
            </span>
          </div>

          {/* 使用 Grid 布局，自动适应，类似 B站 APP */}
          <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2 max-h-80 overflow-y-auto pr-1 custom-scrollbar">
            {detail.episodes.map((ep, idx) => {
              const isActive = idx === currentEpIndex
              return (
                <button
                  key={idx}
                  onClick={() => handleEpisodeChange(idx)}
                  className={`
                                relative text-xs h-10 rounded-md transition-all duration-200 font-medium truncate px-1
                                ${
                                  isActive
                                    ? "bg-primary text-white shadow-lg shadow-primary/20 scale-[1.02]"
                                    : "bg-white/10 text-gray-300 hover:bg-white/20"
                                }
                            `}
                >
                  {/* 正在播放的动画图标 (可选) */}
                  {isActive && (
                    <span className="absolute top-1 right-1 w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
                  )}
                  {ep.name.replace(/第|集/g, "")}
                </button>
              )
            })}
          </div>
        </div>

        {/* 演员表信息 */}
        {detail.actors && (
          <div className="px-5 pb-10">
            <div className="border-t border-white/10 pt-4 mt-2">
              <h3 className="font-bold text-gray-300 text-sm mb-2">演职员表</h3>
              <div className="text-xs text-gray-500 space-y-1">
                <p>
                  <span className="text-gray-400 mr-2">导演:</span>{" "}
                  {detail.director || "未知"}
                </p>
                <p className="leading-5">
                  <span className="text-gray-400 mr-2">主演:</span>{" "}
                  {detail.actors}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default Detail
